'use client';

import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { fmtTime, useCountdown, useLive } from '@/lib/client';
import { confetti, sound } from '@/components/fx';
import { Badge, cx, Dot, Logo, ROUND_META, signed, Spinner } from '@/components/ui';
import { POWERUP_INFO } from '@/components/powerups';
import type { BoardView } from '@/components/views';

const ROW = 76;

export default function BoardPage() {
  const { code } = useParams<{ code: string }>();
  const { data, error } = useLive<BoardView>(`/api/board/${encodeURIComponent(code)}`, (d) => d.session.id);
  const [muted, setMuted] = useState(true);
  const [qr, setQr] = useState('');
  const [origin, setOrigin] = useState('');
  const prevLeader = useRef<string | null>(null);
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    setOrigin(location.host);
    QRCode.toDataURL(`${location.origin}/join?code=${code}`, { margin: 1, width: 240, color: { dark: '#070b1a', light: '#ffffff' } }).then(setQr);
  }, [code]);

  // Celebrate lead changes and reveals.
  useEffect(() => {
    if (!data) return;
    const leader = data.teams[0] && data.teams[0].total > 0 ? data.teams[0].id : null;
    if (prevLeader.current !== null && leader && leader !== prevLeader.current) {
      confetti([data.teams[0].color, '#ffffff', '#fbbf24']);
      if (!muted) sound('fanfare');
    }
    if (prevPhase.current && prevPhase.current !== 'revealed' && data.state.phase === 'revealed' && !muted) sound('ding');
    prevLeader.current = leader ?? prevLeader.current;
    prevPhase.current = data.state.phase;
  }, [data, muted]);

  if (error && !data) return <div className="grid min-h-dvh place-items-center text-xl text-muted">{error.message}</div>;
  if (!data) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;

  return (
    <main className="grid-bg flex h-dvh flex-col gap-4 overflow-hidden p-5">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Logo />
          <div className="hidden border-l border-line pl-5 md:block">
            <div className="text-sm text-muted">{data.session.className}</div>
            <div className="text-lg font-bold">{data.session.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => { setMuted(!muted); if (muted) sound('ding'); }} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-muted hover:text-white">
            {muted ? '🔇 Sound off' : '🔊 Sound on'}
          </button>
          <div className="text-right">
            <div className="text-xs text-muted">Join at <b className="text-white">{origin}</b></div>
            <div className="font-mono text-4xl font-black tracking-[.2em] text-brand-2">{data.session.code}</div>
          </div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Join QR code" className="h-20 w-20 rounded-lg" />
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Stage data={data} muted={muted} />
        <Leaderboard data={data} />
      </div>
      <PowerupFlash data={data} muted={muted} />
    </main>
  );
}

function Stage({ data, muted }: { data: BoardView; muted: boolean }) {
  const { state } = data;
  const item = state.item;
  const left = useCountdown(state.phase === 'open' ? state.closesAt : null, state.serverNow);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (left !== null && left <= 5 && left > 0 && left !== lastTick.current && !muted) sound('tick');
    if (left === 0 && lastTick.current && lastTick.current > 0 && !muted) sound('buzz');
    lastTick.current = left;
  }, [left, muted]);

  if (data.session.status === 'ended') {
    const top = data.teams.slice(0, 3);
    return (
      <section className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-line bg-panel/70 p-8 text-center">
        <div className="text-7xl">🏆</div>
        <h2 className="text-5xl font-black">Arena Champion</h2>
        {top[0] && <div className="text-6xl font-black" style={{ color: top[0].color }}>{top[0].name}</div>}
        <div className="flex gap-6 text-xl text-muted">
          {top.map((t, i) => <span key={t.id}>{['🥇', '🥈', '🥉'][i]} {t.name} · {t.total}</span>)}
        </div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-line bg-panel/70 p-8 text-center">
        <h2 className="text-5xl font-black">Get ready!</h2>
        <p className="text-2xl text-muted">Scan the QR code or go to the site and enter <b className="font-mono text-brand-2">{data.session.code}</b></p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {data.teams.map((t) => (
            <span key={t.id} className="rise flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-lg">
              <Dot color={t.color} /> {t.name} <span className="text-muted">({t.members.length})</span>
            </span>
          ))}
        </div>
      </section>
    );
  }

  const meta = ROUND_META[item.round];
  const answeredSet = new Set(data.answered);
  const revealed = state.phase === 'revealed';
  const first = data.teams.find((t) => t.id === data.firstCorrect);
  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-line bg-panel/70 p-6" key={item.id}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{meta.icon}</span>
          <div>
            <div className="text-sm font-bold" style={{ color: meta.color }}>{item.round} · {item.roundTitle}</div>
            <div className="text-3xl font-black">{item.label}</div>
          </div>
        </div>
        {state.phase === 'open' && left !== null && (
          <div className={cx('rounded-2xl px-5 py-2 font-mono text-6xl font-black tabular-nums', left <= 10 ? 'bg-lose/20 text-lose animate-pulse' : 'bg-white/5')}>
            {left === 0 ? "TIME'S UP" : fmtTime(left)}
          </div>
        )}
        {state.phase === 'wager' && <div className="pulse-ring rounded-2xl bg-gold/20 px-5 py-3 text-3xl font-black text-gold">PLACE YOUR WAGERS</div>}
        {state.phase === 'closed' && <Badge className="px-4 py-2 text-xl">Answers locked</Badge>}
        {state.phase === 'idle' && <Badge className="px-4 py-2 text-xl">Up next</Badge>}
      </div>

      <p className="text-3xl font-bold leading-snug">{item.prompt}</p>

      <div className="flex min-h-0 flex-1 gap-5">
        {(item.figure || (revealed && item.answerFigure)) && (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(revealed && item.answerFigure) || item.figure!} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {revealed && (
          <div className={cx('pop flex flex-col justify-center gap-3', item.figure || item.answerFigure ? 'w-[42%]' : 'flex-1')}>
            <div className="rounded-2xl border border-brand-2/40 bg-brand-2/10 p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-brand-2">Answer</div>
              <div className="mt-1 font-mono text-3xl font-black">{item.answerText}</div>
            </div>
            {item.explanation && <p className="text-xl text-muted">{item.explanation}</p>}
            {first && (
              <div className="rounded-2xl bg-gold/15 p-4">
                <div className="text-sm font-semibold uppercase tracking-wider text-gold">🥇 First correct</div>
                <div className="mt-1 flex items-center gap-3 text-3xl font-black"><Dot color={first.color} size={16} /> {first.name}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {!item.manual && (
        <div className="flex flex-wrap gap-2">
          {data.teams.map((t) => {
            const on = answeredSet.has(t.id);
            return (
              <span key={t.id} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold transition', on ? 'bg-white/15 text-white' : 'bg-white/5 text-muted/50')}>
                <Dot color={on ? t.color : '#334155'} /> {t.name} {on && '✓'}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Leaderboard({ data }: { data: BoardView }) {
  const order = data.teams;
  const max = Math.max(1, ...order.map((t) => t.total));
  const byId = [...order].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-line bg-panel/70 p-6">
      <h2 className="text-2xl font-black">Leaderboard</h2>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: order.length * ROW }}>
          {byId.map((t) => {
            const idx = order.findIndex((x) => x.id === t.id);
            return (
              <div key={t.id} className="absolute inset-x-0 flex items-center gap-3 transition-transform duration-700 ease-out"
                style={{ transform: `translateY(${idx * ROW}px)`, height: ROW - 10 }}>
                <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl font-black', t.rank === 1 ? 'bg-gold text-ink' : t.rank === 2 ? 'bg-slate-300 text-ink' : t.rank === 3 ? 'bg-amber-700 text-white' : 'bg-white/5')}>
                  {t.rank}
                </div>
                <div className="relative h-full flex-1 overflow-hidden rounded-xl bg-white/5">
                  <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(2, (Math.max(0, t.total) / max) * 100)}%`, background: `linear-gradient(90deg, ${t.color}55, ${t.color})` }} />
                  <div className="relative flex h-full items-center justify-between px-4">
                    <span className="truncate text-xl font-bold drop-shadow">{t.name}</span>
                    <span className="text-3xl font-black tabular-nums drop-shadow">{t.total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {order.length === 0 && <p className="text-muted">Teams will appear here as they join.</p>}
      </div>
      {data.recent.length > 0 && (
        <div className="border-t border-line pt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Latest</div>
          <ul className="flex flex-col gap-1 text-sm">
            {data.recent.slice(0, 4).map((e, i) => (
              <li key={i} className="rise flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 truncate"><Dot color={e.color} size={8} /> <b>{e.team}</b> <span className="truncate text-muted">{e.reason}</span></span>
                <span className={cx('font-bold tabular-nums', e.points > 0 ? 'text-win' : 'text-lose')}>{signed(e.points)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Big announcement on the projector for a few seconds when a team plays a card. */
function PowerupFlash({ data, muted }: { data: BoardView; muted: boolean }) {
  const latest = data.plays[0];
  const key = latest ? `${latest.team}|${latest.type}|${latest.at}` : null;
  const seen = useRef<string | null | undefined>(undefined);
  const [show, setShow] = useState<BoardView['plays'][number] | null>(null);
  useEffect(() => {
    if (seen.current === undefined) { seen.current = key; return; } // don't replay old cards on page load
    if (!key || key === seen.current) return;
    seen.current = key;
    setShow(latest);
    if (!muted) sound('fanfare');
    const t = setTimeout(() => setShow(null), 6000);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  const info = POWERUP_INFO[show.type] ?? { name: show.type, icon: '★', color: '#a78bfa', text: '' };
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="pop flex flex-col items-center gap-2 rounded-3xl border-2 bg-panel px-14 py-10 text-center"
        style={{ borderColor: info.color, boxShadow: `0 0 80px ${info.color}88` }}>
        <div className="text-8xl" style={{ color: info.color }}>{info.icon}</div>
        <div className="text-2xl font-bold" style={{ color: show.color }}>{show.team}</div>
        <div className="text-5xl font-black">plays {info.name}!</div>
        <div className="text-xl text-muted">{info.text}</div>
      </div>
    </div>
  );
}

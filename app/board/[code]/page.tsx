'use client';

import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { fmtTime, useCountdown, useLive } from '@/lib/client';
import { confetti, sound } from '@/components/fx';
import { Badge, cx, Dot, Logo, ROUND_META, signed, Spinner } from '@/components/ui';
import { playableNow, POWERUP_INFO, POWERUP_ORDER } from '@/components/powerups';
import type { BoardView, PowerupPlay, TeamScore } from '@/components/views';

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
            {data.session.practice && <div className="mt-1 inline-block rounded-full bg-amber-400/20 px-3 py-0.5 text-sm font-bold text-amber-300">🧪 PRACTICE ROUND · scores reset before the real game</div>}
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

  if (data.session.status === 'ended' && data.state.board === 'hidden') {
    return (
      <section className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-line bg-panel/70 p-8 text-center">
        <div className="text-7xl">🥁</div>
        <h2 className="text-5xl font-black">And the champion is…</h2>
        <p className="text-2xl text-muted">The final ranking will be revealed in a moment.</p>
      </section>
    );
  }

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

      {item.hidden ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/[.03] text-center">
          <div className="text-7xl">{state.phase === 'wager' ? '💰' : '🔒'}</div>
          <div className="text-4xl font-black">{state.phase === 'wager' ? 'Lock in your wager!' : 'Get ready…'}</div>
          <div className="text-xl text-muted">The question appears when answering opens.</div>
        </div>
      ) : (
        <p className="text-3xl font-bold leading-snug">{item.prompt}</p>
      )}

      <div className={cx('flex min-h-0 gap-5', !item.hidden && 'flex-1')}>
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
            const card = data.cards.find((c) => c.team_id === t.id && c.status === 'used' && c.item_id === item.id);
            const info = card ? POWERUP_INFO[card.type] : null;
            return (
              <span key={t.id} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold transition', on ? 'bg-white/15 text-white' : 'bg-white/5 text-muted/50')}
                style={info ? { boxShadow: `0 0 0 2px ${info.color}` } : undefined}>
                <Dot color={on ? t.color : '#334155'} /> {t.name} {on && '✓'}
                {info && <span title={info.name} style={{ color: info.color }}>{info.icon}</span>}
              </span>
            );
          })}
        </div>
      )}
      {!item.manual && <CardStrip data={data} />}
    </section>
  );
}

/** Which cards a team could play on this question right now, and which are already working on it. */
function CardStrip({ data }: { data: BoardView }) {
  const { item, phase } = data.state;
  if (!item) return null;
  const now = POWERUP_ORDER.filter((t) => playableNow(t, item, phase));
  const active = data.cards.filter((c) => (c.status === 'used' && c.item_id === item.id) || c.status === 'requested');
  const holding = data.teams.filter((t) => !data.cards.some((c) => c.team_id === t.id)).length;
  const teamOf = (id: string) => data.teams.find((t) => t.id === id);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/[.04] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wider text-muted">🃏 Playable now</span>
        {now.length === 0 && <span className="text-sm text-muted">none on this question</span>}
        {now.map((t) => {
          const info = POWERUP_INFO[t];
          return (
            <span key={t} className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: `${info.color}22`, color: info.color }}>
              {info.icon} {info.name}
            </span>
          );
        })}
        <span className="ml-auto text-sm text-muted">{holding} of {data.teams.length} teams still hold a card</span>
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-muted">⚡ Active on this question</span>
          {active.map((c) => {
            const info = POWERUP_INFO[c.type];
            const t = teamOf(c.team_id);
            return (
              <span key={c.team_id + c.type} className={cx('flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold', c.status === 'requested' && 'opacity-70')}
                style={{ borderColor: info?.color }}>
                <Dot color={t?.color ?? '#888'} size={8} /> {t?.name} <span style={{ color: info?.color }}>{info?.icon} {info?.name}</span>
                {c.status === 'requested' && <span className="text-xs text-muted">waiting for OK</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

type LbView = 'question' | 'overall' | 'rounds' | 'hidden';
const VIEW_TITLE: Record<LbView, string> = { question: 'This question', overall: 'Overall', rounds: 'By round', hidden: 'Hidden' };

/**
 * Picks the leaderboard view. The teacher can pin one (or hide the rankings); on Auto the board
 * shows this question's points right after a reveal, then slides to the overall ranking, and
 * between questions it alternates between the overall and the per-round rankings.
 */
function useLeaderboardView(data: BoardView): LbView {
  const { board, phase, item } = data.state;
  const [auto, setAuto] = useState<'question' | 'overall' | 'rounds'>('overall');
  const revealKey = phase === 'revealed' && item && !item.manual ? item.id : null;
  const prevReveal = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevReveal.current;
    prevReveal.current = revealKey;
    if (prev === undefined || !revealKey || prev === revealKey) return;
    setAuto('question');
    const t = setTimeout(() => setAuto('overall'), 10000);
    return () => clearTimeout(t);
  }, [revealKey]);
  const calm = !item || phase === 'idle' || phase === 'revealed';
  useEffect(() => {
    if (!calm) { setAuto((a) => (a === 'rounds' ? 'overall' : a)); return; }
    const t = setInterval(() => setAuto((a) => (a === 'question' ? a : a === 'overall' ? 'rounds' : 'overall')), 15000);
    return () => clearInterval(t);
  }, [calm]);
  const hasQuestion = phase === 'revealed' && !!item && !item.manual;
  if (board === 'hidden') return 'hidden';
  if (board === 'overall' || board === 'rounds') return board;
  if (board === 'question') return hasQuestion ? 'question' : 'overall';
  return auto === 'question' && !hasQuestion ? 'overall' : auto;
}

function Leaderboard({ data }: { data: BoardView }) {
  const view = useLeaderboardView(data);
  // Big reveal: when the rankings come back from hidden, show them from last place up to first.
  const [revealN, setRevealN] = useState<number | null>(null);
  const prevView = useRef<LbView>(view);
  useEffect(() => {
    const was = prevView.current;
    prevView.current = view;
    if (was === 'hidden' && view !== 'hidden' && data.teams.length) setRevealN(0);
    if (view === 'hidden') setRevealN(null);
  }, [view, data.teams.length]);
  // Live refreshes replace data.teams every few seconds; keep the timer tied to the count only.
  const topColor = useRef<string | undefined>(undefined);
  topColor.current = data.teams[0]?.color;
  const n = data.teams.length;
  useEffect(() => {
    if (revealN === null) return;
    if (revealN >= n) {
      if (topColor.current) confetti([topColor.current, '#ffffff', '#fbbf24']);
      const t = setTimeout(() => setRevealN(null), 1500);
      return () => clearTimeout(t);
    }
    // Slow down for the podium.
    const t = setTimeout(() => setRevealN(revealN + 1), n - revealN <= 3 ? 2600 : 1300);
    return () => clearTimeout(t);
  }, [revealN, n]);
  const shown: LbView = revealN !== null ? 'overall' : view;

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-line bg-panel/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black">Leaderboard</h2>
        {shown !== 'hidden' && (
          <div className="flex gap-1 rounded-full bg-white/5 p-1 text-sm font-semibold">
            {(['question', 'overall', 'rounds'] as const).map((v) => (
              <span key={v} className={cx('rounded-full px-3 py-1 transition', shown === v ? 'bg-brand text-white' : 'text-muted/60')}>{VIEW_TITLE[v]}</span>
            ))}
          </div>
        )}
      </div>
      <div key={shown} className="rise relative flex min-h-0 flex-1 flex-col">
        {shown === 'hidden' ? <HiddenRanks data={data} />
          : shown === 'question' ? <QuestionRanks data={data} />
          : shown === 'rounds' ? <RoundRanks teams={data.teams} />
          : <OverallRanks teams={data.teams} revealN={revealN} />}
      </div>
      {shown === 'overall' && revealN === null && data.recent.length > 0 && (
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

function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <div className={cx('grid shrink-0 place-items-center rounded-xl font-black', rank === 1 ? 'bg-gold text-ink' : rank === 2 ? 'bg-slate-300 text-ink' : rank === 3 ? 'bg-amber-700 text-white' : 'bg-white/5', className ?? 'h-12 w-12 text-xl')}>
      {rank > 0 ? rank : '?'}
    </div>
  );
}

function OverallRanks({ teams, revealN }: { teams: TeamScore[]; revealN: number | null }) {
  const max = Math.max(1, ...teams.map((t) => t.total));
  const byId = [...teams].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="relative" style={{ height: teams.length * ROW }}>
        {byId.map((t) => {
          const idx = teams.findIndex((x) => x.id === t.id);
          const veiled = revealN !== null && idx < teams.length - revealN;
          return (
            <div key={t.id} className="absolute inset-x-0 flex items-center gap-3 transition-transform duration-700 ease-out"
              style={{ transform: `translateY(${idx * ROW}px)`, height: ROW - 10 }}>
              <RankBadge rank={veiled ? 0 : t.rank} />
              <div className="relative h-full flex-1 overflow-hidden rounded-xl bg-white/5">
                {veiled ? (
                  <div className="flex h-full items-center px-4 text-3xl font-black text-muted/40">?</div>
                ) : (
                  <div className="pop h-full">
                    <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(2, (Math.max(0, t.total) / max) * 100)}%`, background: `linear-gradient(90deg, ${t.color}55, ${t.color})` }} />
                    <div className="relative flex h-full items-center justify-between px-4">
                      <span className="truncate text-xl font-bold drop-shadow">{t.name}</span>
                      <span className="text-3xl font-black tabular-nums drop-shadow">{t.total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {teams.length === 0 && <p className="text-muted">Teams will appear here as they join.</p>}
    </div>
  );
}

function QuestionRanks({ data }: { data: BoardView }) {
  const item = data.state.item!;
  const pts = new Map(data.itemPoints.map((p) => [p.team_id, p.points]));
  const answered = new Set(data.answered);
  const rows = [...data.teams].sort((a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const ranks = rows.map((t, i) => (i > 0 && (pts.get(t.id) ?? 0) === (pts.get(rows[i - 1].id) ?? 0) ? -1 : i + 1));
  ranks.forEach((r, i) => { if (r === -1) ranks[i] = ranks[i - 1]; });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="text-sm font-semibold text-muted">{item.round} {item.label} · points earned on this question</div>
      {rows.map((t, i) => {
        const p = pts.get(t.id) ?? 0;
        const card = data.cards.find((c) => c.team_id === t.id && c.status === 'used' && c.item_id === item.id);
        return (
          <div key={t.id} className="rise flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2" style={{ animationDelay: `${i * 80}ms` }}>
            <RankBadge rank={ranks[i]} className="h-10 w-10 text-lg" />
            <Dot color={t.color} />
            <span className="flex-1 truncate text-xl font-bold">
              {t.name} {data.firstCorrect === t.id && '🥇'} {card && <span style={{ color: POWERUP_INFO[card.type]?.color }}>{POWERUP_INFO[card.type]?.icon}</span>}
            </span>
            {!answered.has(t.id) && p === 0 && <span className="text-sm text-muted">no answer</span>}
            <span className={cx('text-3xl font-black tabular-nums', p > 0 ? 'text-win' : p < 0 ? 'text-lose' : 'text-muted')}>{signed(p)}</span>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORY_ROUNDS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

function RoundRanks({ teams }: { teams: TeamScore[] }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto">
      {CATEGORY_ROUNDS.map((r) => {
        const meta = ROUND_META[r];
        const rows = [...teams].sort((a, b) => (b.byRound[r] ?? 0) - (a.byRound[r] ?? 0) || a.name.localeCompare(b.name));
        const played = rows.some((t) => (t.byRound[r] ?? 0) !== 0);
        return (
          <div key={r} className="rounded-2xl border border-line bg-white/[.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: meta.color }}>{meta.icon} {r} · {meta.title}</div>
            {!played ? <p className="text-sm text-muted">Not played yet</p> : (
              <ol className="flex flex-col gap-1">
                {rows.slice(0, 5).map((t, i) => {
                  // Tied teams share a place.
                  const place = rows.findIndex((x) => (x.byRound[r] ?? 0) === (t.byRound[r] ?? 0)) + 1;
                  return (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-base">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="w-5 text-muted">{place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : place}</span>
                      <Dot color={t.color} size={9} /> <b className="truncate">{t.name}</b>
                    </span>
                    <span className="font-black tabular-nums">{t.byRound[r] ?? 0}</span>
                  </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HiddenRanks({ data }: { data: BoardView }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="text-7xl">🤫</div>
      <div className="text-3xl font-black">Rankings are hidden</div>
      <p className="text-lg text-muted">Who&apos;s on top? You&apos;ll find out at the big reveal.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {data.teams.map((t) => (
          <span key={t.id} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5"><Dot color={t.color} /> {t.name}</span>
        ))}
      </div>
    </div>
  );
}

/** Big announcement on the projector when a team plays a card (and when the teacher approves one). Plays queue up. */
function PowerupFlash({ data, muted }: { data: BoardView; muted: boolean }) {
  const keyOf = (p: PowerupPlay) => `${p.id}|${p.at}|${p.status === 'requested' ? 'asked' : 'on'}`;
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<PowerupPlay[]>([]);
  useEffect(() => {
    const keys = data.plays.map(keyOf);
    if (!seen.current) { seen.current = new Set(keys); return; } // don't replay old cards on page load
    const fresh = data.plays.filter((p) => !seen.current!.has(keyOf(p))).reverse(); // oldest first
    if (!fresh.length) return;
    fresh.forEach((p) => seen.current!.add(keyOf(p)));
    setQueue((q) => [...q, ...fresh]);
  }, [data.plays]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = queue[0] ?? null;
  useEffect(() => {
    if (!show) return;
    if (!muted) sound('fanfare');
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4500);
    return () => clearTimeout(t);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  const info = POWERUP_INFO[show.type] ?? { name: show.type, icon: '★', color: '#a78bfa', text: '' };
  const status = show.status === 'requested' ? 'Waiting for the teacher to approve'
    : show.status === 'armed' ? 'Activates on the next question'
    : show.item && show.type !== 'lifeline' && show.type !== 'retry' ? `Active now on ${show.item}` : info.text;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="pop flex flex-col items-center gap-2 rounded-3xl border-2 bg-panel px-14 py-10 text-center"
        style={{ borderColor: info.color, boxShadow: `0 0 80px ${info.color}88` }}>
        <div className="text-8xl" style={{ color: info.color }}>{info.icon}</div>
        <div className="text-2xl font-bold" style={{ color: show.color }}>{show.team}</div>
        <div className="text-5xl font-black">{show.status === 'requested' ? 'wants' : 'plays'} {info.name}!</div>
        <div className="text-xl text-muted">{info.text}</div>
        <div className="mt-2 rounded-full px-4 py-1 text-lg font-bold" style={{ background: `${info.color}22`, color: info.color }}>{status}</div>
      </div>
    </div>
  );
}

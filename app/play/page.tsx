'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, fmtTime, useCountdown, useLive } from '@/lib/client';
import { TeamHeader } from '@/components/TeamHeader';
import { Badge, Button, Card, cx, ErrorNote, Input, Logo, ROUND_META, signed, Spinner } from '@/components/ui';
import type { MeView } from '@/components/views';

const POWERUP_INFO: Record<string, { name: string; text: string; icon: string }> = {
  lifeline: { name: 'Lifeline', text: 'One hint from the teacher', icon: '🛟' },
  double: { name: 'Double Down', text: 'Doubles your next R1/R2 result, win or lose', icon: '2×' },
  steal: { name: 'Steal', text: "Try an item another team got wrong", icon: '🦝' },
};

export default function PlayPage() {
  const { data: me, error, reload } = useLive<MeView>('/api/me', (d) => d.session.id);

  if (error?.status === 401) return <NotJoined />;
  if (!me) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  return (
    <main className="min-h-dvh pb-10">
      <TeamHeader data={me} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">
        <Stage me={me} reload={reload} />
        <Powerups me={me} reload={reload} />
      </div>
    </main>
  );
}

function NotJoined() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5">
      <Logo />
      <Card>
        <h1 className="mb-2 text-xl font-bold">You haven&apos;t joined a game yet</h1>
        <p className="mb-4 text-muted">Get the game code from the projector.</p>
        <Link href="/join"><Button className="w-full" size="lg">Join a game</Button></Link>
      </Card>
    </main>
  );
}

function Stage({ me, reload }: { me: MeView; reload: () => void }) {
  const { state, mine } = me;
  const item = state.item;
  const left = useCountdown(state.phase === 'open' ? state.closesAt : null, state.serverNow);

  if (me.session.status === 'ended') {
    return (
      <Card className="pop text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="mt-2 text-2xl font-black">Game over!</h2>
        <p className="mt-1 text-muted">Your team finished #{me.team.rank} with {me.team.total} points.</p>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card className="text-center">
        <div className="mx-auto mb-3 h-12 w-12 animate-pulse rounded-full bg-brand/30" />
        <h2 className="text-xl font-bold">Waiting for the next question…</h2>
        <p className="mt-1 text-muted">Keep this screen open. It updates by itself.</p>
      </Card>
    );
  }

  const meta = ROUND_META[item.round];
  return (
    <Card className="pop flex flex-col gap-4" key={item.id + state.phase}>
      <div className="flex items-center justify-between">
        <Badge color={meta.color}>{meta.icon} {item.round} · {item.roundTitle} · {item.label}</Badge>
        {state.phase === 'open' && left !== null && (
          <span className={cx('font-mono text-xl font-black tabular-nums', left <= 10 ? 'text-lose animate-pulse' : 'text-white')}>{fmtTime(left)}</span>
        )}
        {state.phase === 'wager' && <Badge color="#fbbf24">Wager time</Badge>}
        {state.phase === 'closed' && <Badge>Time&apos;s up</Badge>}
        {state.phase === 'revealed' && <Badge color="#22d3ee">Answer revealed</Badge>}
      </div>

      <p className="text-lg font-semibold leading-snug">{item.prompt}</p>
      {item.figure && state.phase !== 'idle' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.figure} alt="Figure" className="w-full rounded-xl bg-white p-2" />
      )}

      {item.manual ? (
        <ManualNote round={item.round} revealed={state.phase === 'revealed'} answer={item.answerText} />
      ) : state.phase === 'idle' ? (
        <p className="text-muted">Get ready… the teacher will open this item in a moment.</p>
      ) : state.phase === 'wager' ? (
        <Wager me={me} reload={reload} />
      ) : state.phase === 'open' ? (
        mine.answers ? <Submitted me={me} /> : <AnswerForm me={me} reload={reload} timeUp={left === 0} />
      ) : state.phase === 'closed' ? (
        mine.answers ? <Submitted me={me} /> : <p className="text-muted">Your team didn&apos;t answer this one.</p>
      ) : (
        <Result me={me} />
      )}
    </Card>
  );
}

function ManualNote({ round, revealed, answer }: { round: string; revealed: boolean; answer: string | null }) {
  return (
    <div className="rounded-xl bg-white/5 p-4 text-sm text-muted">
      {round === 'R4'
        ? 'Code Sprint happens on CodeChum. Your teacher encodes solved problems here, and your points will appear on your dashboard.'
        : 'Raise your hand to answer! The first team to name the bug and the fix wins 5 points.'}
      {revealed && answer && <p className="mt-3 text-white"><b>Fix:</b> {answer}</p>}
    </div>
  );
}

function Wager({ me, reload }: { me: MeView; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (me.mine.wager) {
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-center">
        <div className="text-sm text-amber-200">Wager locked{me.mine.by ? ` by ${me.mine.by}` : ''}</div>
        <div className="text-5xl font-black text-gold">{me.mine.wager}</div>
        <div className="text-sm text-muted">Win it if you&apos;re right, lose it if you&apos;re wrong.</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">How many points will your team bet? Agree first: only one wager per team.</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button key={n} variant="outline" size="lg" disabled={busy} className="text-2xl"
            onClick={async () => {
              setBusy(true); setErr('');
              try { await api('/api/wager', { json: { wager: n } }); reload(); } catch (e) { setErr((e as Error).message); reload(); }
              setBusy(false);
            }}>{n}</Button>
        ))}
      </div>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

function AnswerForm({ me, reload, timeUp }: { me: MeView; reload: () => void; timeUp: boolean }) {
  const fields = me.state.item!.fields;
  const [vals, setVals] = useState<string[]>(() => fields.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setVals(fields.map(() => '')), [me.state.item!.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = useMemo(() => vals.every((v) => v.trim()), [vals]);
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!ok) return;
      setBusy(true); setErr('');
      try { await api('/api/submit', { json: { answers: vals } }); } catch (e2) { setErr((e2 as Error).message); }
      reload(); setBusy(false);
    }}>
      {me.state.item!.wager && !me.mine.wager && <p className="text-xs text-amber-200">No wager locked, so this counts as a 1-point wager.</p>}
      {fields.map((f, i) => (
        <label key={i} className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted">{f}</span>
          <Input value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value : v)))}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono text-lg" placeholder="Type here" />
        </label>
      ))}
      <p className="text-xs text-muted">Separate items with spaces or commas. Only your team&apos;s first submission counts.</p>
      <ErrorNote>{err}</ErrorNote>
      <Button type="submit" size="lg" variant="success" disabled={busy || !ok || timeUp}>{busy ? <Spinner /> : timeUp ? "Time's up" : 'Submit answer'}</Button>
    </form>
  );
}

function Submitted({ me }: { me: MeView }) {
  return (
    <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
      <div className="text-sm text-violet-200">Submitted{me.mine.by ? ` by ${me.mine.by}` : ''}. Locked in!</div>
      <div className="mt-2 flex flex-col gap-1 font-mono text-lg">
        {me.mine.answers!.map((a, i) => <div key={i}>{a}</div>)}
      </div>
      {me.mine.wager && <div className="mt-2 text-sm text-amber-200">Wager: {me.mine.wager}</div>}
    </div>
  );
}

function Result({ me }: { me: MeView }) {
  const item = me.state.item!;
  const answered = !!me.mine.answers;
  const pts = me.mine.points ?? 0;
  const good = me.mine.correct;
  return (
    <div className="flex flex-col gap-3">
      <div className={cx('pop rounded-xl p-4 text-center', !answered && !me.mine.wager ? 'bg-white/5' : good ? 'bg-win/15 border border-win/40' : 'bg-lose/15 border border-lose/40')}>
        <div className="text-4xl">{!answered && !me.mine.wager ? '😶' : good ? (me.mine.rank === 1 ? '🥇' : '✅') : '❌'}</div>
        <div className="mt-1 text-xl font-black">
          {!answered && !me.mine.wager ? 'No answer' : good ? (me.mine.rank === 1 ? 'First correct!' : 'Correct!') : 'Not quite'}
        </div>
        <div className={cx('text-3xl font-black tabular-nums', pts > 0 ? 'text-win' : pts < 0 ? 'text-lose' : 'text-muted')}>{signed(pts)}</div>
        {answered && <div className="mt-1 font-mono text-sm text-muted">You said: {me.mine.answers!.join(' | ')}</div>}
      </div>
      <div className="rounded-xl bg-white/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Answer</div>
        <div className="mt-1 font-mono text-lg font-bold text-brand-2">{item.answerText}</div>
        {item.explanation && <p className="mt-2 text-sm text-muted">{item.explanation}</p>}
      </div>
      {item.answerFigure && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.answerFigure} alt="Answer figure" className="w-full rounded-xl bg-white p-2" />
      )}
    </div>
  );
}

function Powerups({ me, reload }: { me: MeView; reload: () => void }) {
  const [err, setErr] = useState('');
  const usedOne = me.powerups.some((p) => p.status !== 'available');
  const order = ['lifeline', 'double', 'steal'];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">Power-up cards</h3>
        <span className="text-xs text-muted">One per game</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {order.map((t) => {
          const p = me.powerups.find((x) => x.type === t);
          const info = POWERUP_INFO[t];
          const status = p?.status ?? 'available';
          return (
            <button key={t} disabled={usedOne}
              onClick={async () => {
                if (!confirm(`Use ${info.name}? Your team only gets one power-up.`)) return;
                setErr('');
                try { await api('/api/powerup', { json: { type: t } }); } catch (e) { setErr((e as Error).message); }
                reload();
              }}
              className={cx('flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition',
                status === 'available' && !usedOne && 'border-line bg-ink/40 hover:border-brand',
                status === 'requested' && 'border-gold bg-gold/10 pulse-ring',
                status === 'armed' && 'border-brand bg-brand/15',
                status === 'used' && 'border-line bg-white/5 opacity-60',
                status === 'available' && usedOne && 'border-line opacity-30')}>
              <span className="text-xl font-black">{info.icon}</span>
              <span className="text-sm font-bold">{info.name}</span>
              <span className="text-[11px] leading-tight text-muted">
                {status === 'requested' ? 'Waiting for teacher…' : status === 'armed' ? 'Active on next item' : status === 'used' ? 'Used' : info.text}
              </span>
            </button>
          );
        })}
      </div>
      <ErrorNote>{err}</ErrorNote>
    </Card>
  );
}

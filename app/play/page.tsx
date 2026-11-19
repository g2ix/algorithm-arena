'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { api, fmtTime, useCountdown, useLive } from '@/lib/client';
import { TeamHeader } from '@/components/TeamHeader';
import { Badge, Button, Card, cx, ErrorNote, Input, Logo, ROUND_META, signed, Spinner } from '@/components/ui';
import { playableNow, POWERUP_INFO, POWERUP_ORDER } from '@/components/powerups';
import type { LifelineHint, MeView } from '@/components/views';

export default function PlayPage() {
  const { data: me, error, reload } = useLive<MeView>('/api/me', (d) => d.session.id);
  // The answer boxes' current text, so the Lifeline can check this draft.
  const draft = useRef<string[]>([]);

  if (error?.status === 401) return <NotJoined />;
  if (!me) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  return (
    <main className="min-h-dvh pb-10">
      <TeamHeader data={me} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">
        <Stage me={me} reload={reload} draft={draft} />
        <Powerups me={me} reload={reload} draft={draft} />
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

function Stage({ me, reload, draft }: { me: MeView; reload: () => void; draft: RefObject<string[]> }) {
  const { state, mine } = me;
  const item = state.item;
  const left = useCountdown(state.phase === 'open' ? state.closesAt : null, state.serverNow);
  const wagerLeft = useCountdown(state.phase === 'wager' ? state.wagerEndsAt : null, state.serverNow);
  const startsIn = useCountdown(state.phase === 'ready' ? state.opensAt : null, state.serverNow);

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
  const lifeline = me.powerups.find((p) => p.type === 'lifeline' && p.item_id === item.id && p.hint);
  return (
    <Card className="pop flex flex-col gap-4" key={item.id + state.phase}>
      <div className="flex items-center justify-between">
        <Badge color={meta.color}>{meta.icon} {item.round} · {item.roundTitle} · {item.label}</Badge>
        {state.phase === 'open' && left !== null && (
          <span className={cx('font-mono text-xl font-black tabular-nums', left <= 10 ? 'text-lose animate-pulse' : 'text-white')}>{fmtTime(left)}</span>
        )}
        {state.phase === 'wager' && <Badge color="#fbbf24">{wagerLeft !== null ? `Wagers lock in ${fmtTime(wagerLeft)}` : 'Wager time'}</Badge>}
        {state.phase === 'ready' && <Badge color="#22c55e">Starts in {startsIn ?? 0}</Badge>}
        {state.phase === 'closed' && <Badge>Time&apos;s up</Badge>}
        {state.phase === 'revealed' && <Badge color="#22d3ee">Answer revealed</Badge>}
      </div>

      {item.hidden ? (
        <div className="rounded-xl bg-white/5 p-4 text-center text-sm text-muted">
          🔒 {state.phase === 'ready' ? 'The question appears when the countdown ends.' : 'The question appears when your teacher opens answering.'}
          {state.phase === 'wager' && ' Bet on how sure you are of this round, not on the question itself.'}
        </div>
      ) : (
        <p className="text-lg font-semibold leading-snug">{item.prompt}</p>
      )}
      {item.figure && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.figure} alt="Figure" className="w-full rounded-xl bg-white p-2" />
      )}

      {item.manual ? (
        <ManualNote round={item.round} revealed={state.phase === 'revealed'} answer={item.answerText} />
      ) : state.phase === 'idle' ? (
        <p className="text-center text-muted">Get ready… the teacher will open this item in a moment.</p>
      ) : state.phase === 'wager' ? (
        <>
          <Wager me={me} reload={reload} />
          <CardNudge me={me} />
        </>
      ) : state.phase === 'ready' ? (
        <>
          <div className="pop rounded-xl border border-win/40 bg-win/10 p-5 text-center">
            <div className="text-sm font-bold uppercase tracking-wider text-win">Get ready</div>
            <div className="font-mono text-7xl font-black tabular-nums">{startsIn ?? 0}</div>
            <div className="text-sm text-muted">Answering starts by itself. Your answer time starts then, not now.</div>
            {item.wager && <div className="mt-2 text-sm text-amber-200">{mine.wager ? `Your wager: ${mine.wager}` : 'No wager locked, so this counts as a 1-point wager.'}</div>}
          </div>
          <CardNudge me={me} />
        </>
      ) : state.phase === 'open' ? (
        mine.answers ? <Submitted me={me} /> : <AnswerForm me={me} reload={reload} timeUp={left === 0} draft={draft} />
      ) : state.phase === 'closed' ? (
        mine.answers ? <Submitted me={me} /> : <p className="text-muted">Your team didn&apos;t answer this one.</p>
      ) : (
        <Result me={me} />
      )}
      {lifeline?.hint && state.phase !== 'revealed' && <HintCard hint={lifeline.hint} />}
    </Card>
  );
}

/** Before answering starts: remind the team it can still play a card that works on this question. */
function CardNudge({ me }: { me: MeView }) {
  const item = me.state.item;
  const mineNow = { submitted: !!me.mine.answers, wagerLocked: !!me.mine.wager };
  const inHand = (t: string) => (me.powerups.find((p) => p.type === t)?.status ?? 'available') === 'available';
  const now = POWERUP_ORDER.filter((t) => inHand(t) && playableNow(t, item, me.state.phase, mineNow));
  if (!now.length) return null;
  return (
    <button onClick={() => document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth' })}
      className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-left text-sm transition hover:border-brand">
      <b>🃏 Play a card before it starts?</b>{' '}
      <span className="text-muted">{now.map((t) => `${POWERUP_INFO[t].icon} ${POWERUP_INFO[t].name}`).join(' · ')} work on this one.</span>{' '}
      <span className="font-bold text-brand">Pick below ↓</span>
    </button>
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
  const high = me.powerups.some((p) => p.type === 'highroller' && p.status === 'used' && p.item_id === me.state.item?.id);
  const choices = Array.from({ length: high ? 10 : 5 }, (_, i) => i + 1);
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
      {high && <p className="text-sm font-bold text-pink-300">🎰 High Roller: you can bet up to 10!</p>}
      <div className="grid grid-cols-5 gap-2">
        {choices.map((n) => (
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

function AnswerForm({ me, reload, timeUp, draft }: { me: MeView; reload: () => void; timeUp: boolean; draft: RefObject<string[]> }) {
  const fields = me.state.item!.fields;
  const [vals, _setVals] = useState<string[]>(() => fields.map(() => ''));
  // Mirror into the ref right away so a Lifeline tap always checks what is on screen.
  const setVals = (v: string[]) => { draft.current = v; _setVals(v); };
  useEffect(() => () => { draft.current = []; }, [draft]);
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

function HintCard({ hint }: { hint: LifelineHint }) {
  return (
    <div className="pop rounded-xl border border-cyan-400/50 bg-cyan-400/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-cyan-200">🛟 Lifeline hint</span>
        <span className="text-xs text-muted">checked {hint.by}&apos;s draft</span>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {hint.hints.map((h, i) => (
          <li key={i} className="text-sm">
            {h.label && <div className="text-xs font-semibold text-muted">{h.label}: <span className="font-mono">{hint.draft[i] || '(blank)'}</span></div>}
            {!h.label && <div className="font-mono text-xs text-muted">{hint.draft[i]}</div>}
            <div className="text-white">{h.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Powerups({ me, reload, draft: draftRef }: { me: MeView; reload: () => void; draft: RefObject<string[]> }) {
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const item = me.state.item;
  const mineNow = { submitted: !!me.mine.answers, wagerLocked: !!me.mine.wager };
  const activeHere = me.powerups.filter((p) => item && p.status === 'used' && p.item_id === item.id && p.type !== 'lifeline' && p.type !== 'retry');
  const left = POWERUP_ORDER.filter((t) => (me.powerups.find((p) => p.type === t)?.status ?? 'available') === 'available').length;
  const play = async (t: string) => {
    const info = POWERUP_INFO[t];
    const draft = draftRef.current;
    if (t === 'lifeline' && !draft.some((d) => d.trim())) {
      setErr('Type your best guess in the answer box first, then tap Lifeline to check it.');
      return;
    }
    if (!confirm(`Play ${info.name}? Each card works once per game.

${info.when}`)) return;
    setErr(''); setNote(''); setBusy(true);
    try {
      const r = await api<{ item?: string }>('/api/powerup', { json: { type: t, answers: t === 'lifeline' ? draft : undefined } });
      setNote(t === 'double' || t === 'steal' ? `${info.name} sent to your teacher for approval.`
        : t === 'lifeline' ? 'Lifeline used: read your hint above.'
        : t === 'retry' ? 'Answer erased: submit again before time runs out.'
        : r.item ? `${info.name} is active on ${r.item}!` : `${info.name} is ready: it activates on the next question your teacher shows.`);
    }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
    reload();
  };
  return (
    <Card id="cards">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">Power-up cards</h3>
        <span className="text-xs text-muted">Each card once per game · {left} left</span>
      </div>
      {activeHere.map((a) => (
        <p key={a.type} className="mb-2 rounded-lg px-3 py-2 text-sm font-bold" style={{ background: `${POWERUP_INFO[a.type].color}22`, color: POWERUP_INFO[a.type].color }}>
          {POWERUP_INFO[a.type].icon} {POWERUP_INFO[a.type].name} is active on this question
        </p>
      ))}
      {left > 0 && item && !item.manual && (
        <p className="mb-3 text-xs text-muted">Cards marked <b className="text-win">WORKS NOW</b> apply to this question. Others wait for a question they fit.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POWERUP_ORDER.map((t) => {
          const p = me.powerups.find((x) => x.type === t);
          const info = POWERUP_INFO[t];
          const status = p?.status ?? 'available';
          const now = status === 'available' && playableNow(t, item, me.state.phase, mineNow);
          // Glow while the card is working (waiting for OK, waiting for a question, or on this one); fade once spent.
          const live = status === 'requested' || status === 'armed' || (status === 'used' && !!item && p?.item_id === item.id);
          return (
            <button key={t} disabled={status !== 'available' || busy} onClick={() => play(t)}
              style={live ? { borderColor: info.color, boxShadow: `0 0 18px ${info.color}55` } : undefined}
              className={cx('flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition',
                status === 'available' && 'border-line bg-ink/40 hover:-translate-y-0.5 hover:border-brand',
                status === 'requested' && 'bg-gold/10 pulse-ring',
                status === 'armed' && 'bg-brand/15',
                status === 'used' && (live ? 'bg-white/5' : 'border-line bg-white/5 opacity-40'))}>
              {now && <span className="rounded-full bg-win/20 px-2 text-[10px] font-black tracking-wider text-win">WORKS NOW</span>}
              <span className="text-2xl font-black" style={{ color: info.color }}>{info.icon}</span>
              <span className="text-sm font-bold">{info.name}</span>
              <span className="text-[11px] leading-tight text-muted">
                {status === 'requested' ? 'Waiting for teacher…'
                  : status === 'armed' ? 'Activates on the next question'
                  : status === 'used' ? (p?.item && t !== 'lifeline' && t !== 'retry' ? `${live ? 'Active on' : 'Used on'} ${p.item}` : 'Played!')
                  : info.text}
              </span>
            </button>
          );
        })}
      </div>
      {note && <p className="mt-3 rounded-lg bg-win/15 px-3 py-2 text-sm text-win">{note}</p>}
      <ErrorNote>{err}</ErrorNote>
    </Card>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, fmtTime, useCountdown, useLive } from '@/lib/client';
import { AdminShell } from '@/components/AdminShell';
import { Badge, Button, Card, cx, Dot, Empty, ErrorNote, Input, ROUND_META, signed, Spinner } from '@/components/ui';
import { playableNow, POWERUP_INFO, POWERUP_ORDER } from '@/components/powerups';
import { QuestionPicker, SetLoader } from '@/components/QuestionPicker';
import type { LifelineHint, PowerupPlay, StateView, TeamScore } from '@/components/views';

type Item = { id: string; round: string; label: string; prompt: string; manual: boolean; points: Record<string, number | boolean>; timeLimit: number; answerText: string; selected: boolean };
type Sub = { id: string; team_id: string; answer_raw: string[] | null; wager: number | null; is_correct: boolean | null; override: boolean; rank: number | null; submitted_at: string | null; member: string | null };
type Pow = { id: string; team_id: string; team: string; type: string; status: string; item_id: string | null; hint: LifelineHint | null };
type Ev = { id: string; team_id: string; item_id: string | null; tag: string; points: number; reason: string; created_at: string };
type Admin = {
  session: { id: string; code: string; title: string; status: string; class_name: string; team_mode: string; max_team_size: number; practice: boolean };
  state: StateView & { currentItemId: string | null; openedAt: string | null };
  current: { id: string; round_id: string; label: string; prompt: string; answer_text: string; explanation: string | null; time_limit_s: number; points: { wager?: boolean }; answer_key: { type: string } } | null;
  items: Item[];
  scoredItemIds: string[];
  teams: TeamScore[];
  members: { id: string; team_id: string; display_name: string }[];
  submissions: Sub[];
  powerups: Pow[];
  plays: PowerupPlay[];
  manualEvents: Ev[];
};

const TABS = ['Control', 'Questions', 'Encode R4 / R5', 'Teams', 'Power-ups & points'] as const;

export default function SessionAdminPage() {
  return (
    <AdminShell wide>
      <SessionAdmin />
    </AdminShell>
  );
}

function SessionAdmin() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLive<Admin>(`/api/admin/sessions/${id}`, id);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Control');
  const [err, setErr] = useState('');

  if (error && !data) return <ErrorNote>{error.message}</ErrorNote>;
  if (!data) return <div className="grid place-items-center py-20"><Spinner /></div>;

  const call = async (url: string, json: unknown, method = 'POST') => {
    setErr('');
    try { await api(url, { method, json }); } catch (e) { setErr((e as Error).message); }
    reload();
  };
  const base = `/api/admin/sessions/${id}`;
  const pending = data.powerups.filter((p) => p.status === 'requested').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted">{data.session.class_name}</div>
          <h1 className="flex items-center gap-3 text-3xl font-black">
            {data.session.title}
            <Badge color={data.session.status === 'live' ? '#22c55e' : data.session.status === 'ended' ? '#94a3b8' : '#22d3ee'}>{data.session.status}</Badge>
            {data.session.practice && <Badge color="#fbbf24">🧪 practice</Badge>}
          </h1>
          <div className="text-sm text-muted">Join code <span className="font-mono text-lg font-bold text-brand-2">{data.session.code}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/board/${data.session.code}`} target="_blank" rel="noreferrer"><Button variant="outline">📺 Open projector board</Button></a>
          <a href={`${base}/csv`}><Button variant="ghost">⬇ CSV</Button></a>
          <Button variant="ghost" onClick={() => confirm(
            'Reset ALL scores to 0?\n\nThis deletes every answer, point and adjustment in this game and gives every team its power-up card back. Teams and players stay. Use it after a practice round, before the real tournament.',
          ) && call(`${base}/control`, { action: 'reset-scores' })}>↺ Reset scores</Button>
          {data.session.status !== 'ended' ? (
            <Button variant="danger" onClick={() => confirm('End the game and show the champion on the board?') && call(base, { status: 'ended' }, 'PATCH')}>🏁 End game</Button>
          ) : (
            <Button variant="ghost" onClick={() => call(base, { status: 'live' }, 'PATCH')}>Reopen game</Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('rounded-lg px-4 py-2 text-sm font-semibold', tab === t ? 'bg-brand text-white' : 'text-muted hover:text-white')}>
            {t}{t === 'Power-ups & points' && pending > 0 && <span className="ml-2 rounded-full bg-gold px-1.5 text-xs text-ink">{pending}</span>}
          </button>
        ))}
      </div>
      <ErrorNote>{err}</ErrorNote>

      {tab === 'Control' && <Control data={data} call={call} base={base} />}
      {tab === 'Questions' && <Questions data={data} call={call} base={base} />}
      {tab === 'Encode R4 / R5' && <Encode data={data} call={call} base={base} />}
      {tab === 'Teams' && <Teams data={data} call={call} base={base} />}
      {tab === 'Power-ups & points' && <PowerPoints data={data} call={call} base={base} />}
    </div>
  );
}

type Call = (url: string, json: unknown, method?: string) => Promise<void>;

// ------------------------------------------------------------------ control

function Control({ data, call, base }: { data: Admin; call: Call; base: string }) {
  const cur = data.current;
  const phase = data.state.phase;
  const [secs, setSecs] = useState<number | ''>('');
  const left = useCountdown(phase === 'open' ? data.state.closesAt : null, data.state.serverNow);
  const ctl = (action: string, extra: object = {}) => call(`${base}/control`, { action, ...extra });
  const inGame = data.items.filter((i) => i.selected);
  const idx = cur ? inGame.findIndex((i) => i.id === cur.id) : -1;
  const next = idx >= 0 ? inGame[idx + 1] : inGame[0];
  const subByTeam = new Map(data.submissions.map((s) => [s.team_id, s]));
  // Submission ranking: 1 = the first team to send an answer for this question.
  const order = data.submissions.filter((s) => s.answer_raw && s.submitted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
  const orderOf = new Map(order.map((s, i) => [s.team_id, i + 1]));
  const opened = data.state.openedAt ? new Date(data.state.openedAt).getTime() : null;
  const rows = [...data.teams].sort((a, b) => (orderOf.get(a.id) ?? 1e9) - (orderOf.get(b.id) ?? 1e9));
  const cardOf = (teamId: string) => data.powerups.find((p) => p.team_id === teamId && p.status !== 'available');
  const isManual = cur?.answer_key.type === 'manual';
  const isWager = !!cur?.points.wager;
  const pending = data.powerups.filter((p) => p.status === 'requested');

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_1fr_320px]">
      {/* Item list */}
      <Card className="max-h-[75vh] overflow-y-auto p-3">
        {(['R1', 'R2', 'R3', 'R4', 'R5'] as const).map((r) => (
          <div key={r} className="mb-3">
            <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider" style={{ color: ROUND_META[r].color }}>
              {ROUND_META[r].icon} {r} · {ROUND_META[r].title}
            </div>
            {inGame.filter((i) => i.round === r).map((i) => {
              const done = data.scoredItemIds.includes(i.id);
              const on = i.id === cur?.id;
              return (
                <button key={i.id} onClick={() => ctl('select', { itemId: i.id })}
                  className={cx('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm', on ? 'bg-brand/25 ring-1 ring-brand' : 'hover:bg-white/5')}>
                  <span className="w-12 shrink-0 font-mono font-bold">{i.label}</span>
                  <span className="line-clamp-1 flex-1 text-muted">{i.prompt}</span>
                  {done && <span className="text-win">✓</span>}
                </button>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Current item */}
      <div className="flex flex-col gap-4">
        {!cur ? (
          <Empty>Pick an item on the left to show it on the board. Students see it when you open answering.</Empty>
        ) : (
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge color={ROUND_META[cur.round_id].color} className="text-sm">{cur.round_id} · {cur.label}</Badge>
              <div className="flex items-center gap-3">
                <Badge className="text-sm">Phase: {phase}</Badge>
                {phase === 'open' && left !== null && <span className={cx('font-mono text-3xl font-black tabular-nums', left <= 10 && 'text-lose')}>{fmtTime(left)}</span>}
              </div>
            </div>
            <p className="text-xl font-semibold">{cur.prompt}</p>
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm">
              <span className="font-semibold text-gold">Key (only you see this): </span>
              <span className="font-mono">{cur.answer_text}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isManual ? (
                <>
                  {phase !== 'revealed'
                    ? <Button onClick={() => ctl('reveal')}>Show the fix on the board</Button>
                    : <Button variant="ghost" onClick={() => ctl('select', { itemId: cur.id })}>Hide the fix</Button>}
                  <span className="text-sm text-muted">Score this in the <b>Encode R4 / R5</b> tab.</span>
                </>
              ) : (
                <>
                  {phase === 'idle' && isWager && <Button size="lg" className="bg-gold text-ink hover:bg-gold/90" onClick={() => ctl('wager')}>💰 Start wagers</Button>}
                  {(phase === 'idle' || phase === 'wager') && (
                    <>
                      <Button size="lg" variant="success" onClick={() => ctl('open', { seconds: secs || undefined })}>▶ Open answering</Button>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <Input type="number" min={5} value={secs} placeholder={String(cur.time_limit_s)} onChange={(e) => setSecs(e.target.value ? Number(e.target.value) : '')} className="w-24 py-2 text-center" />
                        seconds
                      </label>
                    </>
                  )}
                  {phase === 'open' && (
                    <>
                      <Button variant="ghost" onClick={() => ctl('extend')}>+30 s</Button>
                      <Button variant="outline" onClick={() => ctl('close')}>⏹ Close</Button>
                      <Button size="lg" onClick={() => ctl('reveal')}>Reveal &amp; score</Button>
                    </>
                  )}
                  {phase === 'closed' && (
                    <>
                      <Button size="lg" onClick={() => ctl('reveal')}>Reveal &amp; score</Button>
                      <Button variant="ghost" onClick={() => ctl('extend')}>Reopen +30 s</Button>
                    </>
                  )}
                  {phase === 'revealed' && (
                    <Button variant="ghost" onClick={() => confirm('Delete all answers and points for this item so you can run it again?') && ctl('reset')}>↺ Reset item</Button>
                  )}
                </>
              )}
              {next && phase === 'revealed' && (
                <Button size="lg" className="ml-auto" onClick={() => ctl('select', { itemId: next.id })}>Next: {next.round} {next.label} →</Button>
              )}
              {phase !== 'revealed' && next && (
                <button className="ml-auto text-sm text-muted hover:text-white" onClick={() => ctl('select', { itemId: next.id })}>Skip to {next.label} →</button>
              )}
            </div>

            {!isManual && <CardsNow data={data} />}
            {!isManual && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted">
                    <tr><th className="py-2" title="Order in which teams submitted">#</th><th>Team</th>{isWager && <th>Wager</th>}<th>Answer</th><th>By</th><th>Card</th><th>Result</th><th className="text-right">Mark</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((t) => {
                      const s = subByTeam.get(t.id);
                      const n = orderOf.get(t.id);
                      const card = cardOf(t.id);
                      const info = card ? POWERUP_INFO[card.type] : null;
                      const cardHere = card && (card.item_id === cur.id || card.status === 'armed' || card.status === 'requested');
                      return (
                        <tr key={t.id}>
                          <td className="py-2 pr-2">
                            {n ? (
                              <span className={cx('inline-grid h-7 min-w-7 place-items-center rounded-lg px-1 text-xs font-black', n === 1 ? 'bg-gold text-ink' : n === 2 ? 'bg-slate-300 text-ink' : n === 3 ? 'bg-amber-700 text-white' : 'bg-white/10')}>
                                {n}
                              </span>
                            ) : <span className="text-muted">–</span>}
                            {n && opened && s?.submitted_at && <div className="text-[10px] text-muted tabular-nums">{((new Date(s.submitted_at).getTime() - opened) / 1000).toFixed(1)}s</div>}
                          </td>
                          <td className="py-2"><span className="flex items-center gap-2 font-semibold"><Dot color={t.color} size={10} />{t.name}</span></td>
                          {isWager && <td className="font-bold text-gold">{s?.wager ?? '–'}</td>}
                          <td className="max-w-[320px] font-mono">{s?.answer_raw ? s.answer_raw.join(' | ') : <span className="text-muted">–</span>}</td>
                          <td className="text-muted">{s?.member ?? ''}</td>
                          <td className="whitespace-nowrap text-xs">
                            {card && info && cardHere ? (
                              <span style={{ color: info.color }} title={info.text}>
                                {info.icon} {info.name}
                                <span className="text-muted"> · {card.status === 'requested' ? 'needs OK' : card.status === 'armed' ? 'next question' : 'active'}</span>
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {s && phase === 'revealed' && (s.answer_raw || s.wager) ? (
                              <span className={cx('font-semibold', s.is_correct ? 'text-win' : 'text-lose')}>
                                {s.is_correct ? (s.rank === 1 ? '🥇 first' : '✓ correct') : '✗ wrong'}{s.override && ' (you)'}
                              </span>
                            ) : s?.answer_raw ? <span className="text-muted">submitted</span> : null}
                          </td>
                          <td className="text-right">
                            {s?.answer_raw && (
                              <span className="inline-flex gap-1">
                                <Button size="sm" variant="ghost" title="Mark correct" onClick={() => call(`${base}/override`, { submissionId: s.id, correct: true })}>✓</Button>
                                <Button size="sm" variant="ghost" title="Mark wrong" onClick={() => call(`${base}/override`, { submissionId: s.id, correct: false })}>✗</Button>
                                {s.override && <Button size="sm" variant="ghost" title="Back to automatic" onClick={() => call(`${base}/override`, { submissionId: s.id, correct: null })}>auto</Button>}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">Use ✓ / ✗ to accept a valid alternative answer or reject one; points are recalculated instantly.</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Side: scores + requests */}
      <div className="flex flex-col gap-4">
        {pending.length > 0 && (
          <Card className="border-gold/50">
            <h3 className="mb-2 font-bold text-gold">Power-up requests</h3>
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span><b>{p.team}</b> · {POWERUP_INFO[p.type]?.icon} {POWERUP_INFO[p.type]?.name ?? p.type}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="success" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: true })}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: false })}>No</Button>
                </span>
              </div>
            ))}
          </Card>
        )}
        <BoardControl board={data.state.board} ctl={ctl} />
        <MiniBoard teams={data.teams} />
        <PlayFeed plays={data.plays} />
      </div>
    </div>
  );
}

const BOARD_OPTIONS = [
  ['auto', '✨ Auto', 'After each reveal: this question’s points, then the overall ranking. Between questions it alternates with the per-round ranking.'],
  ['question', '❓ This question', 'Points each team earned on the question just revealed.'],
  ['overall', '🏆 Overall', 'Total ranking.'],
  ['rounds', '📊 By round', 'Ranking for each round (R1 to R5).'],
  ['hidden', '🤫 Hide', 'Hide every ranking on the projector and phones. Pick another view later for a last-to-first reveal.'],
] as const;

function BoardControl({ board, ctl }: { board: string; ctl: (action: string, extra?: object) => void }) {
  const cur = BOARD_OPTIONS.find((o) => o[0] === board) ?? BOARD_OPTIONS[0];
  return (
    <Card className={cx(board === 'hidden' && 'border-gold/50')}>
      <h3 className="mb-2 font-bold">Projector leaderboard</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {BOARD_OPTIONS.map(([v, label]) => (
          <button key={v} onClick={() => v !== board && ctl('board', { board: v })}
            className={cx('rounded-lg px-2 py-1.5 text-sm font-semibold', v === board ? 'bg-brand text-white' : 'bg-white/5 text-muted hover:text-white', v === 'hidden' && 'col-span-2')}>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{cur[2]}</p>
      {board === 'hidden' && <p className="mt-1 text-xs font-bold text-gold">Rankings are hidden. Choose Overall to reveal them from last place to first.</p>}
    </Card>
  );
}

function PlayFeed({ plays }: { plays: PowerupPlay[] }) {
  return (
    <Card>
      <h3 className="mb-3 font-bold">Power-up activity</h3>
      {plays.length === 0 ? <p className="text-sm text-muted">No cards played yet.</p> : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {plays.map((p) => {
            const info = POWERUP_INFO[p.type];
            return (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2"><Dot color={p.color} size={9} /><b className="truncate">{p.team}</b>
                  <span style={{ color: info?.color }}>{info?.icon} {info?.name ?? p.type}</span></span>
                <span className="shrink-0 text-xs text-muted">
                  {p.status === 'requested' ? 'needs your OK' : p.status === 'armed' ? 'next question' : p.item && p.type !== 'lifeline' && p.type !== 'retry' ? `on ${p.item}` : p.item ? `used on ${p.item}` : 'played'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CardsNow({ data }: { data: Admin }) {
  const item = data.state.item;
  const now = POWERUP_ORDER.filter((t) => playableNow(t, item, data.state.phase));
  const active = data.powerups.filter((p) => (p.status === 'used' && p.item_id === data.current?.id && p.type !== 'lifeline' && p.type !== 'retry') || p.status === 'armed');
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Playable now</span>
        {now.length === 0 && <span className="text-muted">none</span>}
        {now.map((t) => <span key={t} className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${POWERUP_INFO[t].color}22`, color: POWERUP_INFO[t].color }}>{POWERUP_INFO[t].icon} {POWERUP_INFO[t].name}</span>)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Active</span>
        {active.length === 0 && <span className="text-muted">no card on this question</span>}
        {active.map((p) => (
          <span key={p.id} className="rounded-full border px-2 py-0.5 text-xs font-bold" style={{ borderColor: POWERUP_INFO[p.type]?.color, color: POWERUP_INFO[p.type]?.color }}>
            {p.team}: {POWERUP_INFO[p.type]?.icon} {POWERUP_INFO[p.type]?.name}{p.status === 'armed' && ' (waiting)'}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniBoard({ teams }: { teams: TeamScore[] }) {
  return (
    <Card>
      <h3 className="mb-3 font-bold">Scoreboard</h3>
      <ol className="flex flex-col gap-1.5">
        {teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><span className="w-5 text-muted">{t.rank}</span><Dot color={t.color} size={10} />{t.name}</span>
            <span className="font-bold tabular-nums">{t.total}</span>
          </li>
        ))}
      </ol>
      {teams.length === 0 && <p className="text-sm text-muted">No teams yet.</p>}
    </Card>
  );
}

// ------------------------------------------------------------------ encode

function Encode({ data, call, base }: { data: Admin; call: Call; base: string }) {
  const r4 = data.items.filter((i) => i.round === 'R4');
  const r5 = data.items.filter((i) => i.round === 'R5');
  const has = (item: string, team: string, tag: string) => data.manualEvents.some((e) => e.item_id === item && e.team_id === team && e.tag === tag);
  const enc = (itemId: string, teamId: string, tag: string, on: boolean) => call(`${base}/encode`, { itemId, teamId, tag, on });
  if (!data.teams.length) return <Empty>Add teams first.</Empty>;
  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-x-auto">
        <h2 className="mb-1 text-lg font-bold">💻 R4 Code Sprint (from CodeChum)</h2>
        <p className="mb-4 text-sm text-muted">Tick a box when a team passes all test cases. Tap ⭐ for the first team to solve a problem (+3). Points go to the board immediately.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="py-2 text-left">Team</th>
              {r4.map((i) => <th key={i.id} className="px-2 text-center">{i.label}<div className="font-normal">{String(i.points.solve)} pts</div></th>)}
              <th className="text-right">R4 total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.teams.map((t) => (
              <tr key={t.id}>
                <td className="py-2"><span className="flex items-center gap-2 font-semibold"><Dot color={t.color} size={10} />{t.name}</span></td>
                {r4.map((i) => {
                  const solved = has(i.id, t.id, 'solve');
                  const first = has(i.id, t.id, 'first');
                  return (
                    <td key={i.id} className="px-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => enc(i.id, t.id, 'solve', !solved)}
                          className={cx('grid h-8 w-8 place-items-center rounded-lg border text-base', solved ? 'border-win bg-win/20 text-win' : 'border-line hover:border-brand')}>
                          {solved ? '✓' : ''}
                        </button>
                        <button title="First to solve" onClick={() => enc(i.id, t.id, 'first', !first)}
                          className={cx('text-lg', first ? 'opacity-100' : 'opacity-20 hover:opacity-60')}>⭐</button>
                      </div>
                    </td>
                  );
                })}
                <td className="text-right font-bold tabular-nums">{t.byRound.R4}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold">🐞 R5 Bug Hunt</h2>
        <p className="mb-4 text-sm text-muted">Tap the team that named the bug and the fix first (+5). Tap again to undo. Pick the bug in the Control tab to show it on the board.</p>
        <div className="flex flex-col gap-3">
          {r5.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2">
              <span className="w-20 font-mono font-bold">{i.label}</span>
              {data.teams.map((t) => {
                const won = has(i.id, t.id, 'win');
                return (
                  <button key={t.id} onClick={() => enc(i.id, t.id, 'win', !won)}
                    className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', won ? 'border-win bg-win/20 font-bold' : 'border-line hover:border-brand')}>
                    <Dot color={t.color} size={9} />{t.name}{won && ' +5'}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ teams

function Teams({ data, call, base }: { data: Admin; call: Call; base: string }) {
  const [name, setName] = useState('');
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4 md:grid-cols-2">
        {data.teams.length === 0 && <Empty>No teams yet.</Empty>}
        {data.teams.map((t) => (
          <Card key={t.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-lg font-bold"><Dot color={t.color} />{t.name}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { const n = prompt('New team name', t.name); if (n) void call(`${base}/teams`, { teamId: t.id, name: n }, 'PATCH'); }}>Rename</Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${t.name}, its members and all its points?`) && call(`${base}/teams`, { teamId: t.id }, 'DELETE')}>Delete</Button>
              </span>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {data.members.filter((m) => m.team_id === t.id).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.display_name}</span>
                  <select className="rounded-lg border border-line bg-ink px-2 py-1 text-xs text-muted" value={t.id}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__remove' && !confirm(`Remove ${m.display_name}? Their phone will need to join again.`)) return;
                      void call(`${base}/members`, { memberId: m.id, teamId: v === '__remove' ? null : v }, 'PATCH');
                    }}>
                    {data.teams.map((x) => <option key={x.id} value={x.id}>{x.id === t.id ? 'Move to…' : x.name}</option>)}
                    <option value="__remove">Remove</option>
                  </select>
                </li>
              ))}
              {!data.members.some((m) => m.team_id === t.id) && <li className="text-muted">No one has joined yet.</li>}
            </ul>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <h3 className="mb-2 font-bold">Add a team</h3>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void call(`${base}/teams`, { name }); setName(''); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
            <Button type="submit" disabled={!name.trim()}>Add</Button>
          </form>
        </Card>
        <Card>
          <h3 className="mb-2 font-bold">Joining settings</h3>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center justify-between gap-2">Students can create teams
              <input type="checkbox" checked={data.session.team_mode === 'student'} onChange={(e) => call(base, { teamMode: e.target.checked ? 'student' : 'teacher' }, 'PATCH')} />
            </label>
            <label className="flex items-center justify-between gap-2">Max members per team
              <Input type="number" min={1} max={10} defaultValue={data.session.max_team_size} className="w-20 py-1 text-center"
                onBlur={(e) => call(base, { maxTeamSize: Number(e.target.value) }, 'PATCH')} />
            </label>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ questions in this game

function Questions({ data, call, base }: { data: Admin; call: Call; base: string }) {
  const saved = new Set(data.items.filter((i) => i.selected).map((i) => i.id));
  const [picked, setPicked] = useState<Set<string>>(saved);
  const [practice, setPractice] = useState(data.session.practice);
  const savedKey = [...saved].sort().join();
  useEffect(() => setPicked(new Set(savedKey ? savedKey.split(',') : [])), [savedKey]);
  useEffect(() => setPractice(data.session.practice), [data.session.practice]);
  const dirty = [...picked].sort().join() !== savedKey || practice !== data.session.practice;
  const hasPoints = data.teams.some((t) => t.total !== 0) || data.scoredItemIds.length > 0;
  const played = new Set(data.scoredItemIds);
  const droppingPlayed = [...saved].filter((id) => !picked.has(id) && played.has(id)).length;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Questions in this game</h2>
          <p className="text-sm text-muted">
            <b className="text-white">{picked.size}</b> of {data.items.length} chosen. Only these appear on the Control tab and count toward team totals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => { setPicked(saved); setPractice(data.session.practice); }}>Undo</Button>
          <Button disabled={!dirty || picked.size === 0} onClick={() => {
            if (droppingPlayed && !confirm(`${droppingPlayed} removed question(s) were already played. Their points will no longer count toward totals (you can add them back later). Continue?`)) return;
            void call(base, { itemIds: [...picked], practice }, 'PATCH');
          }}>Save questions</Button>
        </div>
      </div>
      {data.session.practice && hasPoints && (
        <div className="mb-3 rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm">
          <b className="text-gold">Practice finished?</b> Press <b>↺ Reset scores</b> at the top to set every team back to 0
          (power-up cards come back too), then load a tournament set below and save.
        </div>
      )}
      <div className="mb-3 flex flex-col gap-2">
        <SetLoader items={data.items} onLoad={(ids, set) => { setPicked(ids); setPractice(set.kind === 'practice'); }} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="accent-violet-500" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
          Practice round (students and the projector see that scores will be reset)
        </label>
      </div>
      <QuestionPicker items={data.items} selected={picked} onChange={setPicked} maxHeight="65vh" />
    </Card>
  );
}

// ------------------------------------------------------------------ power-ups & adjustments

function PowerPoints({ data, call, base }: { data: Admin; call: Call; base: string }) {
  const [team, setTeam] = useState(data.teams[0]?.id ?? '');
  const [pts, setPts] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? '?';
  const adjustments = data.manualEvents.filter((e) => e.tag === 'adjust');
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-lg font-bold">Power-ups</h2>
        <p className="mb-3 text-sm text-muted">
          Each team plays one card per game. Most cards run by themselves: <b>Lifeline</b> gives the team an automatic hint based on
          their current draft, and <b>Shield</b>, <b>Fast Pass</b>, <b>High Roller</b> and <b>Second Chance</b> are applied by the scoring.
          Only <b>Double Down</b> and <b>Steal</b> wait for your OK (award steal points with an adjustment).
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Team</th><th>Card played</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.teams.map((t) => {
              const p = data.powerups.find((x) => x.team_id === t.id && x.status !== 'available');
              const info = p ? POWERUP_INFO[p.type] : null;
              const on = p?.item_id ? data.items.find((i) => i.id === p.item_id) : null;
              return (
                <tr key={t.id} className="align-top">
                  <td className="py-2 font-semibold">{t.name}</td>
                  <td className="py-2">
                    {p ? <span style={{ color: info?.color }}>{info?.icon} {info?.name ?? p.type}</span> : <span className="text-muted">—</span>}
                    {on && <span className="text-muted"> · {on.round} {on.label}</span>}
                    {p?.hint && (
                      <div className="mt-1 text-xs text-muted">
                        {p.hint.hints.map((h, i) => <div key={i}>{h.label ? `${h.label}: ` : ''}<span className="font-mono">{p.hint!.draft[i]}</span> → {h.text}</div>)}
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    {p?.status === 'requested' ? (
                      <span className="flex gap-1">
                        <Button size="sm" variant="success" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: true })}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: false })}>Deny</Button>
                      </span>
                    ) : p ? (
                      <Badge color={p.status === 'armed' ? '#a78bfa' : '#94a3b8'}>{p.status === 'armed' ? 'waiting for next question' : on && p.type !== 'lifeline' && p.type !== 'retry' ? 'active' : p.status}</Badge>
                    ) : (
                      <Badge>available</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Add or remove points</h2>
        <form className="flex flex-col gap-2" onSubmit={(e) => {
          e.preventDefault();
          void call(`${base}/adjust`, { teamId: team, points: pts, reason });
          setPts(''); setReason('');
        }}>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-xl border border-line bg-ink/70 px-3 py-2.5 text-white">
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Input type="number" value={pts} onChange={(e) => setPts(e.target.value ? Number(e.target.value) : '')} placeholder="±pts" className="text-center" />
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Steal on R1 #4)" />
          <div className="flex flex-wrap gap-2">
            {[['Steal +3', 3], ['Steal +1', 1], ['Penalty -1', -1]].map(([l, v]) => (
              <Button key={l} type="button" size="sm" variant="ghost" onClick={() => { setPts(v as number); setReason(String(l).split(' ')[0]); }}>{l}</Button>
            ))}
          </div>
          <Button type="submit" disabled={!team || !pts}>Save points</Button>
        </form>
        <h3 className="mb-2 mt-5 font-bold">History</h3>
        {adjustments.length === 0 ? <p className="text-sm text-muted">No manual adjustments yet.</p> : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {adjustments.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span><b>{teamName(e.team_id)}</b> <span className="text-muted">{e.reason}</span></span>
                <span className="flex items-center gap-2">
                  <b className={e.points > 0 ? 'text-win' : 'text-lose'}>{signed(e.points)}</b>
                  <button className="text-xs text-muted hover:text-lose" onClick={() => call(`${base}/adjust`, { eventId: e.id }, 'DELETE')}>undo</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

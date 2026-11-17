'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, fmtTime, useCountdown, useLive } from '@/lib/client';
import { AdminShell } from '@/components/AdminShell';
import { Badge, Button, Card, cx, Dot, Empty, ErrorNote, Input, ROUND_META, signed, Spinner } from '@/components/ui';
import type { StateView, TeamScore } from '@/components/views';

type Item = { id: string; round: string; label: string; prompt: string; manual: boolean; points: Record<string, number | boolean>; timeLimit: number; answerText: string };
type Sub = { id: string; team_id: string; answer_raw: string[] | null; wager: number | null; is_correct: boolean | null; override: boolean; rank: number | null; submitted_at: string | null; member: string | null };
type Pow = { id: string; team_id: string; team: string; type: string; status: string };
type Ev = { id: string; team_id: string; item_id: string | null; tag: string; points: number; reason: string; created_at: string };
type Admin = {
  session: { id: string; code: string; title: string; status: string; class_name: string; team_mode: string; max_team_size: number };
  state: StateView & { currentItemId: string | null };
  current: { id: string; round_id: string; label: string; prompt: string; answer_text: string; explanation: string | null; time_limit_s: number; points: { wager?: boolean }; answer_key: { type: string } } | null;
  items: Item[];
  scoredItemIds: string[];
  teams: TeamScore[];
  members: { id: string; team_id: string; display_name: string }[];
  submissions: Sub[];
  powerups: Pow[];
  manualEvents: Ev[];
};

const TABS = ['Control', 'Encode R4 / R5', 'Teams', 'Power-ups & points'] as const;

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
          </h1>
          <div className="text-sm text-muted">Join code <span className="font-mono text-lg font-bold text-brand-2">{data.session.code}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/board/${data.session.code}`} target="_blank" rel="noreferrer"><Button variant="outline">📺 Open projector board</Button></a>
          <a href={`${base}/csv`}><Button variant="ghost">⬇ CSV</Button></a>
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
  const idx = cur ? data.items.findIndex((i) => i.id === cur.id) : -1;
  const next = idx >= 0 ? data.items[idx + 1] : data.items[0];
  const subByTeam = new Map(data.submissions.map((s) => [s.team_id, s]));
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
            {data.items.filter((i) => i.round === r).map((i) => {
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

            {!isManual && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted">
                    <tr><th className="py-2">Team</th>{isWager && <th>Wager</th>}<th>Answer</th><th>By</th><th>Result</th><th className="text-right">Mark</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.teams.map((t) => {
                      const s = subByTeam.get(t.id);
                      return (
                        <tr key={t.id}>
                          <td className="py-2"><span className="flex items-center gap-2 font-semibold"><Dot color={t.color} size={10} />{t.name}</span></td>
                          {isWager && <td className="font-bold text-gold">{s?.wager ?? '–'}</td>}
                          <td className="max-w-[320px] font-mono">{s?.answer_raw ? s.answer_raw.join(' | ') : <span className="text-muted">–</span>}</td>
                          <td className="text-muted">{s?.member ?? ''}</td>
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
                <span><b>{p.team}</b> · {p.type}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="success" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: true })}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: false })}>No</Button>
                </span>
              </div>
            ))}
          </Card>
        )}
        <MiniBoard teams={data.teams} />
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
          Teams request a card from their pad. <b>Double Down</b> becomes active for the next R1 or R2 item you reveal.
          For <b>Steal</b> and <b>Lifeline</b>, approve the card, then run it in class (award steal points with an adjustment).
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Team</th><th>Lifeline</th><th>Double</th><th>Steal</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.teams.map((t) => (
              <tr key={t.id}>
                <td className="py-2 font-semibold">{t.name}</td>
                {['lifeline', 'double', 'steal'].map((ty) => {
                  const p = data.powerups.find((x) => x.team_id === t.id && x.type === ty);
                  if (!p) return <td key={ty} />;
                  return (
                    <td key={ty}>
                      {p.status === 'requested' ? (
                        <span className="flex gap-1">
                          <Button size="sm" variant="success" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: true })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => call(`${base}/powerups`, { powerupId: p.id, approve: false })}>Deny</Button>
                        </span>
                      ) : (
                        <Badge color={p.status === 'available' ? undefined : p.status === 'armed' ? '#a78bfa' : '#94a3b8'}>{p.status}</Badge>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
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

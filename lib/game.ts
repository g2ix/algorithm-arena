import { HttpError, newDeviceToken } from './auth';
import { q, tx, type Query } from './db';
import { scoreItem } from './scoring';
import { TEAM_COLORS } from './seed';
import { answerFields, type ItemRow, type Phase, type SubmissionRow } from './types';

// ---------------------------------------------------------------- helpers

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function genCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

const ROUND_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5', 'Other'] as const;
export const POWERUPS = ['lifeline', 'double', 'steal'] as const;
export type PowerupType = (typeof POWERUPS)[number];

function clean(s: unknown, max = 40) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Every change calls this so live screens (Supabase Realtime on game_state) refresh. */
async function bump(db: Query, sessionId: string) {
  await db(`update game_state set version = version + 1, updated_at = now() where session_id = $1`, [sessionId]);
}

export interface SessionRow {
  id: string; class_id: string; code: string; title: string; status: string;
  team_mode: 'teacher' | 'student'; max_team_size: number; created_at: string; class_name?: string;
}

async function sessionByCode(code: string): Promise<SessionRow> {
  const [s] = await q<SessionRow>(
    `select s.*, c.name as class_name from sessions s join classes c on c.id = s.class_id where s.code = $1`,
    [clean(code, 12).toUpperCase()],
  );
  if (!s) throw new HttpError(404, 'No game with that code. Check the code on the projector.');
  return s;
}

async function sessionById(id: string): Promise<SessionRow> {
  const [s] = await q<SessionRow>(
    `select s.*, c.name as class_name from sessions s join classes c on c.id = s.class_id where s.id = $1`, [id]);
  if (!s) throw new HttpError(404, 'Session not found.');
  return s;
}

async function state(sessionId: string) {
  const [g] = await q<{ current_item_id: string | null; phase: Phase; opened_at: Date | null; closes_at: Date | null; version: bigint }>(
    `select current_item_id, phase, opened_at, closes_at, version from game_state where session_id = $1`, [sessionId]);
  return g;
}

async function itemById(id: string | null): Promise<ItemRow | null> {
  if (!id) return null;
  const [it] = await q<ItemRow>(`select * from items where id = $1`, [id]);
  return it ?? null;
}

const ROUND_TITLES: Record<string, string> = { R1: 'Trace Race', R2: 'Human Tree', R3: 'Map Heist', R4: 'Code Sprint', R5: 'Bug Hunt' };

/** What students and the projector may see about an item. The key appears only once revealed. */
function publicItem(it: ItemRow | null, revealed: boolean) {
  if (!it) return null;
  return {
    id: it.id,
    round: it.round_id,
    roundTitle: ROUND_TITLES[it.round_id],
    label: it.label,
    prompt: it.prompt,
    figure: it.figure_url,
    fields: answerFields(it.answer_key),
    manual: it.answer_key.type === 'manual',
    wager: !!it.points.wager,
    timeLimit: it.time_limit_s,
    answerText: revealed ? it.answer_text : null,
    explanation: revealed ? it.explanation : null,
    answerFigure: revealed ? it.answer_figure_url : null,
  };
}

export interface TeamScore {
  id: string; name: string; color: string; total: number; rank: number;
  byRound: Record<string, number>; members: string[];
}

async function teamScores(sessionId: string): Promise<TeamScore[]> {
  const teams = await q<{ id: string; name: string; color: string }>(
    `select id, name, color from teams where session_id = $1 order by created_at`, [sessionId]);
  const sums = await q<{ team_id: string; round: string | null; pts: number }>(
    `select e.team_id, i.round_id as round, sum(e.points)::int as pts
       from score_events e left join items i on i.id = e.item_id
      where e.session_id = $1 group by e.team_id, i.round_id`, [sessionId]);
  const mem = await q<{ team_id: string; display_name: string }>(
    `select team_id, display_name from members where session_id = $1 order by joined_at`, [sessionId]);
  const out: TeamScore[] = teams.map((t) => {
    const byRound: Record<string, number> = Object.fromEntries(ROUND_KEYS.map((k) => [k, 0]));
    for (const s of sums.filter((x) => x.team_id === t.id)) byRound[s.round ?? 'Other'] += s.pts;
    return {
      ...t, byRound, rank: 0,
      total: Object.values(byRound).reduce((a, b) => a + b, 0),
      members: mem.filter((m) => m.team_id === t.id).map((m) => m.display_name),
    };
  });
  out.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  out.forEach((t, i) => (t.rank = i > 0 && t.total === out[i - 1].total ? out[i - 1].rank : i + 1));
  return out;
}

function stateView(g: Awaited<ReturnType<typeof state>>, it: ItemRow | null) {
  return {
    phase: g?.phase ?? 'idle',
    item: publicItem(it, g?.phase === 'revealed'),
    closesAt: g?.closes_at ? new Date(g.closes_at).toISOString() : null,
    serverNow: new Date().toISOString(),
    version: String(g?.version ?? 0),
  };
}

// ---------------------------------------------------------------- public / board

export async function lobbyInfo(code: string) {
  const s = await sessionByCode(code);
  const teams = await q<{ id: string; name: string; color: string; n: number }>(
    `select t.id, t.name, t.color, count(m.id)::int as n from teams t left join members m on m.team_id = t.id
      where t.session_id = $1 group by t.id order by t.created_at`, [s.id]);
  return {
    session: { id: s.id, code: s.code, title: s.title, className: s.class_name, teamMode: s.team_mode, maxTeamSize: s.max_team_size, status: s.status },
    teams,
  };
}

export async function boardView(code: string) {
  const s = await sessionByCode(code);
  const g = await state(s.id);
  const it = await itemById(g?.current_item_id ?? null);
  const answered = it
    ? (await q<{ team_id: string }>(
        `select team_id from submissions where session_id = $1 and item_id = $2 and (answer_raw is not null or wager is not null)`,
        [s.id, it.id])).map((r) => r.team_id)
    : [];
  const recent = await q<{ team: string; color: string; points: number; reason: string; created_at: Date }>(
    `select t.name as team, t.color, e.points, e.reason, e.created_at from score_events e join teams t on t.id = e.team_id
      where e.session_id = $1 order by e.created_at desc limit 8`, [s.id]);
  const firstCorrect = it && g?.phase === 'revealed'
    ? (await q<{ team_id: string }>(`select team_id from submissions where session_id=$1 and item_id=$2 and rank=1`, [s.id, it.id]))[0]?.team_id ?? null
    : null;
  return {
    session: { id: s.id, code: s.code, title: s.title, className: s.class_name, status: s.status },
    state: stateView(g, it),
    teams: await teamScores(s.id),
    answered,
    firstCorrect,
    recent,
  };
}

// ---------------------------------------------------------------- students

export async function join(input: { code: string; name: string; teamId?: string; newTeam?: string }) {
  const s = await sessionByCode(input.code);
  if (s.status === 'ended') throw new HttpError(400, 'This game has ended.');
  const name = clean(input.name, 24);
  if (!name) throw new HttpError(400, 'Please type your name.');
  return tx(async (db) => {
    let teamId = input.teamId ?? null;
    if (!teamId) {
      if (s.team_mode !== 'student') throw new HttpError(400, 'Pick your team from the list.');
      const tname = clean(input.newTeam, 24);
      if (!tname) throw new HttpError(400, 'Type a team name.');
      const [{ n }] = await db<{ n: number }>(`select count(*)::int as n from teams where session_id = $1`, [s.id]);
      const exists = await db(`select 1 from teams where session_id = $1 and lower(name) = lower($2)`, [s.id, tname]);
      if (exists.length) throw new HttpError(400, 'That team name is taken. Pick it from the list or choose another name.');
      const [t] = await db<{ id: string }>(
        `insert into teams (session_id, name, color) values ($1,$2,$3) returning id`, [s.id, tname, TEAM_COLORS[n % TEAM_COLORS.length]]);
      teamId = t.id;
      await createPowerups(db, s.id, teamId);
    }
    const [t] = await db<{ id: string }>(`select id from teams where id = $1 and session_id = $2 for update`, [teamId, s.id]);
    if (!t) throw new HttpError(400, 'That team is not in this game.');
    const [{ n }] = await db<{ n: number }>(`select count(*)::int as n from members where team_id = $1`, [teamId]);
    if (n >= s.max_team_size) throw new HttpError(400, `That team is full (${s.max_team_size} members).`);
    const token = newDeviceToken();
    await db(`insert into members (session_id, team_id, display_name, device_token) values ($1,$2,$3,$4)`, [s.id, teamId, name, token]);
    await bump(db, s.id);
    return { token, code: s.code };
  });
}

async function createPowerups(db: Query, sessionId: string, teamId: string) {
  for (const p of POWERUPS) {
    await db(`insert into powerups (session_id, team_id, type) values ($1,$2,$3) on conflict do nothing`, [sessionId, teamId, p]);
  }
}

async function memberByToken(token: string | null) {
  if (!token) throw new HttpError(401, 'Join a game first.');
  const [m] = await q<{ id: string; team_id: string; session_id: string; display_name: string }>(
    `select id, team_id, session_id, display_name from members where device_token = $1`, [token]);
  if (!m) throw new HttpError(401, 'Join a game first.');
  return m;
}

export async function memberView(token: string | null) {
  const m = await memberByToken(token);
  const s = await sessionById(m.session_id);
  const g = await state(s.id);
  const it = await itemById(g?.current_item_id ?? null);
  const scores = await teamScores(s.id);
  const team = scores.find((t) => t.id === m.team_id)!;
  const [mine] = it
    ? await q<{ answer_raw: string[] | null; wager: number | null; is_correct: boolean | null; rank: number | null; member: string | null }>(
        `select s.answer_raw, s.wager, s.is_correct, s.rank, m.display_name as member from submissions s
           left join members m on m.id = s.member_id where s.session_id = $1 and s.item_id = $2 and s.team_id = $3`,
        [s.id, it.id, m.team_id])
    : [];
  const revealed = g?.phase === 'revealed';
  const itemPoints = it && revealed
    ? (await q<{ pts: number }>(`select coalesce(sum(points),0)::int as pts from score_events where session_id=$1 and item_id=$2 and team_id=$3`,
        [s.id, it.id, m.team_id]))[0].pts
    : null;
  const powerups = await q<{ type: string; status: string }>(
    `select type, status from powerups where session_id = $1 and team_id = $2`, [s.id, m.team_id]);
  const feed = await q<{ points: number; reason: string; created_at: Date }>(
    `select points, reason, created_at from score_events where session_id = $1 and team_id = $2 order by created_at desc limit 40`,
    [s.id, m.team_id]);
  return {
    me: { name: m.display_name },
    session: { id: s.id, code: s.code, title: s.title, className: s.class_name, status: s.status },
    team,
    teamsCount: scores.length,
    leader: scores[0] ? { name: scores[0].name, total: scores[0].total } : null,
    state: stateView(g, it),
    mine: mine
      ? { answers: mine.answer_raw, wager: mine.wager, by: mine.member, correct: revealed ? mine.is_correct : null, rank: revealed ? mine.rank : null, points: itemPoints }
      : { answers: null, wager: null, by: null, correct: null, rank: null, points: itemPoints },
    powerups,
    feed,
  };
}

export async function submitAnswer(token: string | null, answers: unknown) {
  const m = await memberByToken(token);
  const g = await state(m.session_id);
  const it = await itemById(g?.current_item_id ?? null);
  if (!it || it.answer_key.type === 'manual') throw new HttpError(400, 'There is no question to answer right now.');
  if (g.phase !== 'open') throw new HttpError(400, g.phase === 'wager' ? 'Lock your wager first; answering opens soon.' : 'Answering is closed.');
  if (g.closes_at && Date.now() > new Date(g.closes_at).getTime() + 1500) throw new HttpError(400, "Time's up!");
  const fields = answerFields(it.answer_key);
  const list = Array.isArray(answers) ? answers.map((a) => clean(a, 300)) : [];
  if (list.length !== fields.length || list.every((a) => !a)) throw new HttpError(400, 'Fill in your answer first.');
  return tx(async (db) => {
    const [existing] = await db<{ id: string; answer_raw: unknown }>(
      `select id, answer_raw from submissions where session_id=$1 and item_id=$2 and team_id=$3 for update`, [m.session_id, it.id, m.team_id]);
    if (existing?.answer_raw) throw new HttpError(409, 'Your team already submitted. Only the first answer counts.');
    if (existing) {
      await db(`update submissions set answer_raw=$1::text::jsonb, member_id=$2, submitted_at=clock_timestamp() where id=$3`,
        [JSON.stringify(list), m.id, existing.id]);
    } else {
      const ins = await db(`insert into submissions (session_id, item_id, team_id, member_id, answer_raw, submitted_at)
                values ($1,$2,$3,$4,$5::text::jsonb, clock_timestamp())
                on conflict (session_id, item_id, team_id) do nothing returning id`,
        [m.session_id, it.id, m.team_id, m.id, JSON.stringify(list)]);
      if (!ins.length) throw new HttpError(409, 'A teammate submitted first. Only the first answer counts.');
    }
    await bump(db, m.session_id);
    return { ok: true };
  });
}

export async function lockWager(token: string | null, wager: unknown) {
  const m = await memberByToken(token);
  const g = await state(m.session_id);
  const it = await itemById(g?.current_item_id ?? null);
  if (!it || !it.points.wager) throw new HttpError(400, 'This item has no wager.');
  if (g.phase !== 'wager') throw new HttpError(400, 'Wagers are closed for this item.');
  const w = Math.round(Number(wager));
  if (!(w >= 1 && w <= 5)) throw new HttpError(400, 'Wager must be 1 to 5.');
  return tx(async (db) => {
    const res = await db(
      `insert into submissions (session_id, item_id, team_id, member_id, wager, wager_at) values ($1,$2,$3,$4,$5, now())
       on conflict (session_id, item_id, team_id) do nothing returning id`, [m.session_id, it.id, m.team_id, m.id, w]);
    if (!res.length) throw new HttpError(409, 'Your team already locked a wager.');
    await bump(db, m.session_id);
    return { ok: true };
  });
}

export async function requestPowerup(token: string | null, type: unknown) {
  const m = await memberByToken(token);
  if (!POWERUPS.includes(type as PowerupType)) throw new HttpError(400, 'Unknown power-up.');
  return tx(async (db) => {
    const used = await db(`select 1 from powerups where session_id=$1 and team_id=$2 and status <> 'available'`, [m.session_id, m.team_id]);
    if (used.length) throw new HttpError(409, 'Your team already used its one power-up.');
    await db(`update powerups set status='requested', requested_at=now() where session_id=$1 and team_id=$2 and type=$3`,
      [m.session_id, m.team_id, type]);
    await bump(db, m.session_id);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- teacher: classes & sessions

export async function listClasses() {
  return q(`select c.*, (select count(*)::int from sessions s where s.class_id = c.id) as sessions
              from classes c order by c.created_at`);
}

export async function createClass(name: unknown, schoolYear: unknown) {
  const n = clean(name, 60);
  if (!n) throw new HttpError(400, 'Class name is required.');
  const [c] = await q(`insert into classes (name, school_year) values ($1,$2) returning *`, [n, clean(schoolYear, 20) || null]);
  return c;
}

export async function renameClass(id: string, name: unknown) {
  const n = clean(name, 60);
  if (!n) throw new HttpError(400, 'Class name is required.');
  await q(`update classes set name=$1 where id=$2`, [n, id]);
}

export async function deleteClass(id: string) {
  await q(`delete from classes where id=$1`, [id]);
}

export async function listSessions(classId?: string) {
  return q(
    `select s.*, c.name as class_name, (select count(*)::int from teams t where t.session_id = s.id) as teams
       from sessions s join classes c on c.id = s.class_id
      where ($1::uuid is null or s.class_id = $1) order by s.created_at desc`, [classId ?? null]);
}

export async function createSession(input: { classId: string; title?: string; teamMode?: string; maxTeamSize?: number; teams?: string[] }) {
  return tx(async (db) => {
    const [c] = await db(`select id from classes where id=$1`, [input.classId]);
    if (!c) throw new HttpError(400, 'Pick a class.');
    let code = genCode();
    for (let i = 0; i < 5 && (await db(`select 1 from sessions where code=$1`, [code])).length; i++) code = genCode();
    const mode = input.teamMode === 'student' ? 'student' : 'teacher';
    const size = Math.min(10, Math.max(1, Math.round(Number(input.maxTeamSize) || 4)));
    const [s] = await db<{ id: string }>(
      `insert into sessions (class_id, code, title, team_mode, max_team_size) values ($1,$2,$3,$4,$5) returning id`,
      [input.classId, code, clean(input.title, 60) || 'Algorithm Arena', mode, size]);
    await db(`insert into game_state (session_id) values ($1)`, [s.id]);
    const names = (input.teams ?? []).map((t) => clean(t, 24)).filter(Boolean);
    let i = 0;
    for (const n of [...new Set(names)]) {
      const [t] = await db<{ id: string }>(`insert into teams (session_id, name, color) values ($1,$2,$3) returning id`,
        [s.id, n, TEAM_COLORS[i++ % TEAM_COLORS.length]]);
      await createPowerups(db, s.id, t.id);
    }
    return { id: s.id, code };
  });
}

export async function updateSession(id: string, patch: { status?: string; title?: string; teamMode?: string; maxTeamSize?: number }) {
  if (patch.status && ['lobby', 'live', 'ended'].includes(patch.status)) await q(`update sessions set status=$1 where id=$2`, [patch.status, id]);
  if (patch.title) await q(`update sessions set title=$1 where id=$2`, [clean(patch.title, 60), id]);
  if (patch.teamMode) await q(`update sessions set team_mode=$1 where id=$2`, [patch.teamMode === 'student' ? 'student' : 'teacher', id]);
  if (patch.maxTeamSize) await q(`update sessions set max_team_size=$1 where id=$2`, [Math.min(10, Math.max(1, Math.round(patch.maxTeamSize))), id]);
  await bump(q, id);
}

export async function deleteSession(id: string) {
  await q(`delete from sessions where id=$1`, [id]);
}

export async function addTeam(sessionId: string, name: unknown) {
  const n = clean(name, 24);
  if (!n) throw new HttpError(400, 'Team name is required.');
  return tx(async (db) => {
    const [{ c }] = await db<{ c: number }>(`select count(*)::int as c from teams where session_id=$1`, [sessionId]);
    const dupe = await db(`select 1 from teams where session_id=$1 and lower(name)=lower($2)`, [sessionId, n]);
    if (dupe.length) throw new HttpError(400, 'A team with that name already exists.');
    const [t] = await db<{ id: string }>(`insert into teams (session_id, name, color) values ($1,$2,$3) returning id`,
      [sessionId, n, TEAM_COLORS[c % TEAM_COLORS.length]]);
    await createPowerups(db, sessionId, t.id);
    await bump(db, sessionId);
    return t;
  });
}

export async function renameTeam(sessionId: string, teamId: string, name: unknown) {
  const n = clean(name, 24);
  if (!n) throw new HttpError(400, 'Team name is required.');
  await q(`update teams set name=$1 where id=$2 and session_id=$3`, [n, teamId, sessionId]);
  await bump(q, sessionId);
}

export async function deleteTeam(sessionId: string, teamId: string) {
  await q(`delete from teams where id=$1 and session_id=$2`, [teamId, sessionId]);
  await bump(q, sessionId);
}

export async function moveMember(sessionId: string, memberId: string, teamId: string | null) {
  if (teamId) await q(`update members set team_id=$1 where id=$2 and session_id=$3`, [teamId, memberId, sessionId]);
  else await q(`delete from members where id=$1 and session_id=$2`, [memberId, sessionId]);
  await bump(q, sessionId);
}

// ---------------------------------------------------------------- teacher: game control

export async function adminSessionView(id: string) {
  const s = await sessionById(id);
  const g = await state(id);
  const items = await q<ItemRow>(`select * from items where active order by sort`);
  const it = items.find((i) => i.id === g?.current_item_id) ?? null;
  const teams = await teamScores(id);
  const members = await q(`select id, team_id, display_name, joined_at from members where session_id=$1 order by joined_at`, [id]);
  const subs = it
    ? await q(`select s.id, s.team_id, s.answer_raw, s.wager, s.is_correct, s.override, s.rank, s.submitted_at, m.display_name as member
                 from submissions s left join members m on m.id = s.member_id
                where s.session_id=$1 and s.item_id=$2 order by s.submitted_at nulls last`, [id, it.id])
    : [];
  const powerups = await q(`select p.*, t.name as team from powerups p join teams t on t.id = p.team_id where p.session_id=$1 order by t.created_at, p.type`, [id]);
  const manual = await q(`select e.id, e.team_id, e.item_id, e.tag, e.points, e.reason, e.created_at from score_events e
                            where e.session_id=$1 and e.source='manual' order by e.created_at desc`, [id]);
  const done = await q<{ item_id: string }>(`select distinct item_id from score_events where session_id=$1 and source='auto'`, [id]);
  return {
    session: s,
    state: { ...stateView(g, it), currentItemId: it?.id ?? null },
    current: it ? { ...it } : null,
    items: items.map((i) => ({ id: i.id, round: i.round_id, label: i.label, prompt: i.prompt, manual: i.answer_key.type === 'manual', points: i.points, timeLimit: i.time_limit_s, answerText: i.answer_text })),
    scoredItemIds: done.map((d) => d.item_id),
    teams,
    members,
    submissions: subs,
    powerups,
    manualEvents: manual,
  };
}

export async function control(sessionId: string, action: string, itemId?: string, seconds?: number) {
  const g = await state(sessionId);
  if (!g) throw new HttpError(404, 'Session not found.');
  switch (action) {
    case 'select': {
      const it = await itemById(itemId ?? null);
      if (!it) throw new HttpError(400, 'Pick an item.');
      await q(`update game_state set current_item_id=$1, phase=$2, opened_at=null, closes_at=null where session_id=$3`,
        [it.id, (await alreadyRevealed(sessionId, it.id)) ? 'revealed' : 'idle', sessionId]);
      await q(`update sessions set status='live' where id=$1 and status='lobby'`, [sessionId]);
      break;
    }
    case 'wager': {
      const it = await itemById(g.current_item_id);
      if (!it?.points.wager) throw new HttpError(400, 'Only Map Heist items take wagers.');
      await q(`update game_state set phase='wager' where session_id=$1`, [sessionId]);
      break;
    }
    case 'open': {
      const it = await itemById(g.current_item_id);
      if (!it || it.answer_key.type === 'manual') throw new HttpError(400, 'Pick an auto-scored item first.');
      const secs = Math.max(5, Math.min(3600, Math.round(Number(seconds) || it.time_limit_s)));
      await q(`update game_state set phase='open', opened_at=now(), closes_at=now() + ($1 || ' seconds')::interval where session_id=$2`,
        [String(secs), sessionId]);
      break;
    }
    case 'extend': {
      await q(`update game_state set closes_at = greatest(coalesce(closes_at, now()), now()) + interval '30 seconds', phase='open' where session_id=$1`, [sessionId]);
      break;
    }
    case 'close':
      await q(`update game_state set phase='closed', closes_at=least(coalesce(closes_at, now()), now()) where session_id=$1`, [sessionId]);
      break;
    case 'reveal': {
      if (!g.current_item_id) throw new HttpError(400, 'Pick an item first.');
      const it = await itemById(g.current_item_id);
      if (it && it.answer_key.type !== 'manual') await rescore(sessionId, it.id, true);
      await q(`update game_state set phase='revealed', closes_at=least(coalesce(closes_at, now()), now()) where session_id=$1`, [sessionId]);
      break;
    }
    case 'reset': {
      if (!g.current_item_id) throw new HttpError(400, 'Pick an item first.');
      await tx(async (db) => {
        await db(`delete from submissions where session_id=$1 and item_id=$2`, [sessionId, g.current_item_id]);
        await db(`delete from score_events where session_id=$1 and item_id=$2 and source in ('auto','powerup')`, [sessionId, g.current_item_id]);
        await db(`update powerups set status='armed', item_id=null, used_at=null where session_id=$1 and item_id=$2 and type='double'`, [sessionId, g.current_item_id]);
        await db(`update game_state set phase='idle', opened_at=null, closes_at=null where session_id=$1`, [sessionId]);
      });
      break;
    }
    case 'clear':
      await q(`update game_state set current_item_id=null, phase='idle', opened_at=null, closes_at=null where session_id=$1`, [sessionId]);
      break;
    default:
      throw new HttpError(400, 'Unknown action.');
  }
  await bump(q, sessionId);
}

async function alreadyRevealed(sessionId: string, itemId: string) {
  return (await q(`select 1 from score_events where session_id=$1 and item_id=$2 and source='auto' limit 1`, [sessionId, itemId])).length > 0;
}

/** (Re)compute all automatic points for one item. Safe to run many times. */
export async function rescore(sessionId: string, itemId: string, consumeArmed = false) {
  const it = await itemById(itemId);
  if (!it || it.answer_key.type === 'manual') return;
  await tx(async (db) => {
    if (consumeArmed && !it.points.wager) {
      await db(`update powerups set status='used', item_id=$1, used_at=now() where session_id=$2 and type='double' and status='armed'`, [itemId, sessionId]);
    }
    const doubles = await db<{ team_id: string }>(
      `select team_id from powerups where session_id=$1 and type='double' and status='used' and item_id=$2`, [sessionId, itemId]);
    const subs = await db<SubmissionRow>(
      `select id, team_id, answer_raw, wager, is_correct, override, submitted_at from submissions where session_id=$1 and item_id=$2`,
      [sessionId, itemId]);
    const result = scoreItem(it, subs, new Set(doubles.map((d) => d.team_id)));
    await db(`delete from score_events where session_id=$1 and item_id=$2 and source in ('auto','powerup')`, [sessionId, itemId]);
    for (const s of result.submissions) {
      await db(`update submissions set is_correct=$1, rank=$2 where id=$3`, [s.is_correct, s.rank, s.id]);
    }
    for (const e of result.events) {
      await db(`insert into score_events (session_id, team_id, item_id, source, tag, points, reason) values ($1,$2,$3,$4,$5,$6,$7)`,
        [sessionId, e.team_id, itemId, e.source, e.tag, e.points, e.reason]);
    }
    await bump(db, sessionId);
  });
}

/** Teacher marks a submission right or wrong by hand; points are recomputed. */
export async function overrideSubmission(sessionId: string, submissionId: string, correct: boolean | null) {
  const [s] = await q<{ item_id: string }>(`select item_id from submissions where id=$1 and session_id=$2`, [submissionId, sessionId]);
  if (!s) throw new HttpError(404, 'Submission not found.');
  if (correct === null) await q(`update submissions set override=false where id=$1`, [submissionId]);
  else await q(`update submissions set override=true, is_correct=$1 where id=$2`, [correct, submissionId]);
  if (await alreadyRevealed(sessionId, s.item_id) || (await state(sessionId)).phase === 'revealed') await rescore(sessionId, s.item_id);
  await bump(q, sessionId);
}

// ---------------------------------------------------------------- teacher: manual points

/** R4: tick solved / first-solve. R5: award the win. Toggling off removes the points. */
export async function encode(sessionId: string, input: { itemId: string; teamId: string; tag: 'solve' | 'first' | 'win'; on: boolean }) {
  const it = await itemById(input.itemId);
  if (!it || it.answer_key.type !== 'manual') throw new HttpError(400, 'That item is not encoded by hand.');
  const label = `${it.round_id} ${it.label}`;
  await tx(async (db) => {
    const del = (team: string | null, tag: string) =>
      db(`delete from score_events where session_id=$1 and item_id=$2 and source='manual' and tag=$3 and ($4::uuid is null or team_id=$4)`,
        [sessionId, it.id, tag, team]);
    const add = (tag: string, pts: number, reason: string) =>
      db(`insert into score_events (session_id, team_id, item_id, source, tag, points, reason) values ($1,$2,$3,'manual',$4,$5,$6)`,
        [sessionId, input.teamId, it.id, tag, pts, reason]);
    if (input.tag === 'solve') {
      await del(input.teamId, 'solve');
      if (input.on) await add('solve', it.points.solve ?? 0, `${label}: solved`);
      else await del(input.teamId, 'first');
    } else if (input.tag === 'first') {
      await del(null, 'first');
      if (input.on) {
        await del(input.teamId, 'solve');
        await add('solve', it.points.solve ?? 0, `${label}: solved`);
        await add('first', it.points.first ?? 3, `${label}: first to solve`);
      }
    } else if (input.tag === 'win') {
      await del(null, 'win');
      if (input.on) await add('win', it.points.win ?? 5, `${label}: found the bug`);
    }
    await bump(db, sessionId);
  });
}

export async function adjust(sessionId: string, teamId: string, points: unknown, reason: unknown) {
  const p = Math.round(Number(points));
  if (!Number.isFinite(p) || p === 0 || Math.abs(p) > 100) throw new HttpError(400, 'Points must be a whole number from -100 to 100.');
  const r = clean(reason, 80) || 'Teacher adjustment';
  await q(`insert into score_events (session_id, team_id, source, tag, points, reason) values ($1,$2,'manual','adjust',$3,$4)`,
    [sessionId, teamId, p, r]);
  await bump(q, sessionId);
}

export async function deleteEvent(sessionId: string, eventId: string) {
  await q(`delete from score_events where id=$1 and session_id=$2 and source='manual'`, [eventId, sessionId]);
  await bump(q, sessionId);
}

export async function decidePowerup(sessionId: string, powerupId: string, approve: boolean) {
  const [p] = await q<{ type: string; status: string }>(`select type, status from powerups where id=$1 and session_id=$2`, [powerupId, sessionId]);
  if (!p) throw new HttpError(404, 'Power-up not found.');
  if (!approve) await q(`update powerups set status='available', requested_at=null where id=$1`, [powerupId]);
  else if (p.type === 'double') await q(`update powerups set status='armed' where id=$1`, [powerupId]);
  else await q(`update powerups set status='used', used_at=now() where id=$1`, [powerupId]);
  await bump(q, sessionId);
}

// ---------------------------------------------------------------- question bank

export async function listItems() {
  return q<ItemRow>(`select * from items order by sort`);
}

export async function updateItem(id: string, patch: Partial<Pick<ItemRow, 'prompt' | 'answer_text' | 'explanation' | 'time_limit_s' | 'active' | 'figure_url'>> & { answer_key?: unknown; points?: unknown }) {
  const it = await itemById(id);
  if (!it) throw new HttpError(404, 'Item not found.');
  const key = patch.answer_key ?? it.answer_key;
  const pts = patch.points ?? it.points;
  if (typeof key !== 'object' || !key || !('type' in key)) throw new HttpError(400, 'Answer key must be JSON with a "type".');
  await q(
    `update items set prompt=$1, answer_text=$2, explanation=$3, time_limit_s=$4, active=$5, figure_url=$6, answer_key=$7::text::jsonb, answer_type=$8, points=$9::text::jsonb where id=$10`,
    [clean(patch.prompt ?? it.prompt, 500), patch.answer_text ?? it.answer_text, patch.explanation ?? it.explanation,
     Math.max(5, Math.round(Number(patch.time_limit_s ?? it.time_limit_s))), patch.active ?? it.active, patch.figure_url ?? it.figure_url,
     JSON.stringify(key), (key as { type: string }).type, JSON.stringify(pts), id]);
}

// ---------------------------------------------------------------- reports

export async function report(classId: string) {
  const sessions = await q<{ id: string; title: string; code: string; created_at: Date; status: string }>(
    `select id, title, code, created_at, status from sessions where class_id=$1 order by created_at desc`, [classId]);
  const standings = [];
  for (const s of sessions) standings.push({ session: s, teams: await teamScores(s.id) });
  const items = await q<{ round: string; label: string; prompt: string; answered: number; correct: number }>(
    `select i.round_id as round, i.label, i.prompt,
            count(sub.id) filter (where sub.answer_raw is not null)::int as answered,
            count(sub.id) filter (where sub.is_correct)::int as correct
       from items i
       join submissions sub on sub.item_id = i.id
       join sessions s on s.id = sub.session_id
      where s.class_id = $1 and i.answer_type <> 'manual'
      group by i.id order by i.sort`, [classId]);
  return { sessions, standings, items };
}

export async function sessionCsv(sessionId: string) {
  const s = await sessionById(sessionId);
  const teams = await teamScores(sessionId);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Class', 'Session', 'Code', 'Rank', 'Team', 'Members', 'R1', 'R2', 'R3', 'R4', 'R5', 'Other', 'Total']];
  for (const t of teams) {
    rows.push([s.class_name ?? '', s.title, s.code, String(t.rank), t.name, t.members.join('; '),
      ...['R1', 'R2', 'R3', 'R4', 'R5', 'Other'].map((k) => String(t.byRound[k] ?? 0)), String(t.total)]);
  }
  return { filename: `arena-${s.code}.csv`, csv: rows.map((r) => r.map(esc).join(',')).join('\n') };
}

export async function keepAlive() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from classes`);
  return { ok: true, classes: r.n };
}

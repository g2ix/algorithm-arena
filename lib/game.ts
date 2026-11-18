import { HttpError, newDeviceToken } from './auth';
import { q, tx, type Query } from './db';
import { suggestHint } from './hints';
import { scoreItem } from './scoring';
import { TEAM_COLORS } from './seed';
import { answerFields, type ItemRow, type Phase, type SubmissionRow } from './types';

// ---------------------------------------------------------------- helpers

/** SQL condition on score_events `e`: only points from this game's selected questions (or general adjustments) count. */
const COUNTED = `(e.item_id is null or exists (select 1 from session_items si where si.session_id = e.session_id and si.item_id = e.item_id))`;

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function genCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

const ROUND_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5', 'Other'] as const;
export const POWERUPS = ['lifeline', 'double', 'steal', 'shield', 'fast', 'highroller', 'retry'] as const;
export type PowerupType = (typeof POWERUPS)[number];
/** Cards the teacher must approve. Every other card is applied by the system instantly. */
const NEEDS_APPROVAL: PowerupType[] = ['double', 'steal'];
/** Cards that change the scoring of one question. */
const SCORING_CARDS = `('double','shield','fast','highroller')`;

/** Can this scoring card take effect on the question on screen right now? */
function fitsItem(type: string, it: ItemRow | null, phase: Phase | undefined) {
  if (!it || it.answer_key.type === 'manual' || !phase || phase === 'revealed') return false;
  const wager = !!it.points.wager;
  if (type === 'highroller') return wager && (phase === 'idle' || phase === 'wager');
  if (type === 'shield') return true;
  if (type === 'double' || type === 'fast') return !wager;
  return false;
}

/** Card types that apply to this question, for binding cards that are waiting. */
function cardTypesFor(it: ItemRow) {
  return it.points.wager ? 'shield,highroller' : 'double,fast,shield';
}

function clean(s: unknown, max = 40) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Every change calls this so live screens (Supabase Realtime on game_state) refresh. */
async function bump(db: Query, sessionId: string) {
  await db(`update game_state set version = version + 1, updated_at = now() where session_id = $1`, [sessionId]);
}

export interface SessionRow {
  id: string; class_id: string; code: string; title: string; status: string;
  team_mode: 'teacher' | 'student'; max_team_size: number; created_at: string; class_name?: string; practice: boolean;
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

type GameRow = {
  current_item_id: string | null; phase: Phase; stored: Phase; opened_at: Date | null; closes_at: Date | null;
  wager_ends_at: Date | null; version: bigint; board: BoardMode;
};

/**
 * The phase right now. Timed steps run on the clock, with no request needed:
 * a timed wager turns into the get-ready countdown when betting closes, and the
 * countdown turns into open answering at opened_at.
 */
function livePhase(g: Omit<GameRow, 'phase'>): Phase {
  const now = Date.now();
  if (g.stored === 'wager' && g.wager_ends_at && g.opened_at && now >= +g.wager_ends_at) return now < +g.opened_at ? 'ready' : 'open';
  if (g.stored === 'open' && g.opened_at && now < +g.opened_at) return 'ready';
  return g.stored;
}

async function state(sessionId: string): Promise<GameRow> {
  const [g] = await q<Omit<GameRow, 'phase'>>(
    `select current_item_id, phase as stored, opened_at, closes_at, wager_ends_at, version, board from game_state where session_id = $1`, [sessionId]);
  return g && { ...g, phase: livePhase(g) };
}

async function itemById(id: string | null): Promise<ItemRow | null> {
  if (!id) return null;
  const [it] = await q<ItemRow>(`select * from items where id = $1`, [id]);
  return it ?? null;
}

export const BOARD_MODES = ['auto', 'question', 'overall', 'rounds', 'hidden'] as const;
export type BoardMode = (typeof BOARD_MODES)[number];

/** While the teacher hides the rankings, nobody (projector or phones) receives them. */
function hideScores(teams: TeamScore[]): TeamScore[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({
    ...t, total: 0, rank: 0, byRound: Object.fromEntries(Object.keys(t.byRound).map((k) => [k, 0])),
  }));
}

const ROUND_TITLES: Record<string, string> = { R1: 'Trace Race', R2: 'Human Tree', R3: 'Map Heist', R4: 'Code Sprint', R5: 'Bug Hunt' };

/**
 * What students and the projector may see about an item. The question stays hidden
 * while the item is only selected or during wagers (teams bet before seeing it),
 * and the key appears only once revealed.
 */
function publicItem(it: ItemRow | null, phase: Phase) {
  if (!it) return null;
  const revealed = phase === 'revealed';
  const hidden = it.answer_key.type !== 'manual' && (phase === 'idle' || phase === 'wager' || phase === 'ready');
  return {
    id: it.id,
    round: it.round_id,
    roundTitle: ROUND_TITLES[it.round_id],
    label: it.label,
    hidden,
    prompt: hidden ? null : it.prompt,
    figure: hidden ? null : it.figure_url,
    fields: hidden ? [] : answerFields(it.answer_key),
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
  const [teams, sums, mem] = await Promise.all([
    q<{ id: string; name: string; color: string }>(
      `select id, name, color from teams where session_id = $1 order by created_at`, [sessionId]),
    q<{ team_id: string; round: string | null; pts: number }>(
      `select e.team_id, i.round_id as round, sum(e.points)::int as pts
         from score_events e left join items i on i.id = e.item_id
        where e.session_id = $1 and ${COUNTED} group by e.team_id, i.round_id`, [sessionId]),
    q<{ team_id: string; display_name: string }>(
      `select team_id, display_name from members where session_id = $1 order by joined_at`, [sessionId]),
  ]);
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

function stateView(g: GameRow | undefined, it: ItemRow | null) {
  const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
  const phase = g?.phase ?? 'idle';
  const wagerEndsAt = phase === 'wager' ? iso(g?.wager_ends_at) : null;
  const opensAt = (phase === 'wager' && wagerEndsAt) || phase === 'ready' ? iso(g?.opened_at) : null;
  return {
    phase,
    item: publicItem(it, phase),
    closesAt: iso(g?.closes_at),
    wagerEndsAt,
    opensAt,
    // When the phase changes next on its own; screens reload at that moment.
    nextAt: phase === 'wager' ? wagerEndsAt : phase === 'ready' ? opensAt : null,
    serverNow: new Date().toISOString(),
    version: String(g?.version ?? 0),
    board: g?.board ?? 'auto',
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
  // Independent reads run side by side: each one is a round trip to the database.
  const [it, teams, recent, plays, cards] = await Promise.all([
    itemById(g?.current_item_id ?? null),
    teamScores(s.id),
    q<{ team: string; color: string; points: number; reason: string; created_at: Date }>(
      `select t.name as team, t.color, e.points, e.reason, e.created_at from score_events e join teams t on t.id = e.team_id
        where e.session_id = $1 and ${COUNTED} order by e.created_at desc limit 8`, [s.id]),
    recentPlays(s.id),
    q<{ team_id: string; type: string; status: string; item_id: string | null }>(
      `select team_id, type, status, item_id from powerups where session_id = $1 and status <> 'available'`, [s.id]),
  ]);
  const hidden = g?.board === 'hidden';
  const [answered, firstCorrect, itemPoints] = await Promise.all([
    it
      ? q<{ team_id: string }>(
          `select team_id from submissions where session_id = $1 and item_id = $2 and (answer_raw is not null or wager is not null)`,
          [s.id, it.id]).then((r) => r.map((x) => x.team_id))
      : Promise.resolve([] as string[]),
    it && g?.phase === 'revealed'
      ? q<{ team_id: string }>(`select team_id from submissions where session_id=$1 and item_id=$2 and rank=1`, [s.id, it.id]).then((r) => r[0]?.team_id ?? null)
      : Promise.resolve(null),
    // Points each team earned on the question on screen, for the "this question" leaderboard.
    it && g?.phase === 'revealed' && !hidden
      ? q<{ team_id: string; points: number }>(
          `select team_id, sum(points)::int as points from score_events where session_id=$1 and item_id=$2 group by team_id`, [s.id, it.id])
      : Promise.resolve([] as { team_id: string; points: number }[]),
  ]);
  return {
    session: { id: s.id, code: s.code, title: s.title, className: s.class_name, status: s.status, practice: s.practice },
    state: stateView(g, it),
    plays,
    cards,
    teams: hidden ? hideScores(teams) : teams,
    itemPoints,
    answered,
    firstCorrect,
    recent: hidden ? [] : recent,
  };
}

/** Latest power-up plays, newest first, for the projector announcement and the teacher's feed. */
function recentPlays(sessionId: string) {
  return q<{ id: string; team: string; color: string; type: string; status: string; at: Date; item: string | null }>(
    `select p.id, t.name as team, t.color, p.type, p.status, p.requested_at as at,
            case when i.id is null then null else i.round_id || ' ' || i.label end as item
       from powerups p join teams t on t.id = p.team_id left join items i on i.id = p.item_id
      where p.session_id = $1 and p.status <> 'available' and p.requested_at is not null
      order by p.requested_at desc limit 10`, [sessionId]);
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
  const [s, g] = await Promise.all([sessionById(m.session_id), state(m.session_id)]);
  const itemId = g?.current_item_id ?? null;
  const revealed = g?.phase === 'revealed';
  const [it, scores, mineRows, itemPoints, powerups, feed] = await Promise.all([
    itemById(itemId),
    teamScores(s.id),
    itemId
      ? q<{ answer_raw: string[] | null; wager: number | null; is_correct: boolean | null; rank: number | null; member: string | null }>(
          `select s.answer_raw, s.wager, s.is_correct, s.rank, m.display_name as member from submissions s
             left join members m on m.id = s.member_id where s.session_id = $1 and s.item_id = $2 and s.team_id = $3`,
          [s.id, itemId, m.team_id])
      : Promise.resolve([]),
    itemId && revealed
      ? q<{ pts: number }>(`select coalesce(sum(points),0)::int as pts from score_events where session_id=$1 and item_id=$2 and team_id=$3`,
          [s.id, itemId, m.team_id]).then((r) => r[0].pts)
      : Promise.resolve(null),
    q<{ type: string; status: string; item_id: string | null; hint: unknown; item: string | null }>(
      `select p.type, p.status, p.item_id, p.hint, case when i.id is null then null else i.round_id || ' ' || i.label end as item
         from powerups p left join items i on i.id = p.item_id where p.session_id = $1 and p.team_id = $2`, [s.id, m.team_id]),
    q<{ points: number; reason: string; created_at: Date }>(
      `select e.points, e.reason, e.created_at from score_events e where e.session_id = $1 and e.team_id = $2 and ${COUNTED} order by e.created_at desc limit 40`,
      [s.id, m.team_id]),
  ]);
  const own = scores.find((t) => t.id === m.team_id)!;
  const team = g?.board === 'hidden' ? { ...own, rank: 0 } : own;
  const mine = mineRows[0];
  return {
    me: { name: m.display_name },
    session: { id: s.id, code: s.code, title: s.title, className: s.class_name, status: s.status, practice: s.practice },
    team,
    teamsCount: scores.length,
    leader: scores[0] && g?.board !== 'hidden' ? { name: scores[0].name, total: scores[0].total } : null,
    ranksHidden: g?.board === 'hidden',
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
  if (g.phase !== 'open') throw new HttpError(400, g.phase === 'wager' ? 'Lock your wager first; answering opens soon.' : g.phase === 'ready' ? 'Get ready: answering opens in a few seconds.' : 'Answering is closed.');
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
  if (g.phase !== 'wager') throw new HttpError(400, g.phase === 'ready' || g.phase === 'open' ? 'Time is up for wagers: your team plays this one for 1 point.' : 'Wagers are closed for this item.');
  const w = Math.round(Number(wager));
  const cap = (await highRollers(m.session_id, it.id)).has(m.team_id) ? 10 : 5;
  if (!(w >= 1 && w <= cap)) throw new HttpError(400, `Wager must be 1 to ${cap}.`);
  return tx(async (db) => {
    const res = await db(
      `insert into submissions (session_id, item_id, team_id, member_id, wager, wager_at) values ($1,$2,$3,$4,$5, now())
       on conflict (session_id, item_id, team_id) do nothing returning id`, [m.session_id, it.id, m.team_id, m.id, w]);
    if (!res.length) throw new HttpError(409, 'Your team already locked a wager.');
    await bump(db, m.session_id);
    return { ok: true };
  });
}

export async function requestPowerup(token: string | null, type: unknown, answers?: unknown) {
  const m = await memberByToken(token);
  if (!POWERUPS.includes(type as PowerupType)) throw new HttpError(400, 'Unknown power-up.');
  const t = type as PowerupType;
  const g = await state(m.session_id);
  const it = await itemById(g?.current_item_id ?? null);
  const autoItemOpen = !!it && it.answer_key.type !== 'manual' && g.phase === 'open';
  return tx(async (db) => {
    // Teams created before a card existed get its row on first use.
    await db(`insert into powerups (session_id, team_id, type) values ($1,$2,$3) on conflict do nothing`, [m.session_id, m.team_id, t]);
    const used = await db(`select 1 from powerups where session_id=$1 and team_id=$2 and status <> 'available' for update`, [m.session_id, m.team_id]);
    if (used.length) throw new HttpError(409, 'Your team already used its one power-up.');
    const set = (status: string, extra = '', params: unknown[] = []) =>
      db(`update powerups set status='${status}', requested_at=now()${extra} where session_id=$1 and team_id=$2 and type=$3`,
        [m.session_id, m.team_id, t, ...params]);

    let result: Record<string, unknown> = { ok: true };
    if (NEEDS_APPROVAL.includes(t)) {
      await set('requested');
    } else if (t === 'lifeline') {
      if (!autoItemOpen) throw new HttpError(400, 'Use Lifeline while a question is open for answering.');
      const [sub] = await db<{ answer_raw: unknown }>(`select answer_raw from submissions where session_id=$1 and item_id=$2 and team_id=$3`, [m.session_id, it!.id, m.team_id]);
      if (sub?.answer_raw) throw new HttpError(400, 'Your team already submitted this one. Lifeline checks a draft before you submit.');
      const fields = answerFields(it!.answer_key);
      const list = Array.isArray(answers) ? answers.map((a) => clean(a, 300)) : [];
      if (list.length !== fields.length || list.every((a) => !a)) throw new HttpError(400, 'Type your best guess first: the lifeline checks what you have so far.');
      const hint = { by: m.display_name, draft: list, hints: suggestHint(it!.answer_key, list) };
      await set('used', `, used_at=now(), item_id=$4, hint=$5::text::jsonb`, [it!.id, JSON.stringify(hint)]);
      result = { ok: true, hint };
    } else if (t === 'retry') {
      if (!autoItemOpen) throw new HttpError(400, 'Use Second Chance while a question is open for answering.');
      const cleared = await db(`update submissions set answer_raw=null, member_id=null, submitted_at=null, is_correct=null, rank=null, override=false
                                 where session_id=$1 and item_id=$2 and team_id=$3 and answer_raw is not null returning id`, [m.session_id, it!.id, m.team_id]);
      if (!cleared.length) throw new HttpError(400, 'Second Chance erases a submitted answer. Submit first, then use it if you change your mind.');
      await set('used', `, used_at=now(), item_id=$4`, [it!.id]);
    } else if (fitsItem(t, it, g?.phase)) {
      // Shield, Fast Pass, High Roller: take effect on the question on screen right away.
      if (t === 'highroller') {
        const [w] = await db(`select 1 from submissions where session_id=$1 and item_id=$2 and team_id=$3 and wager is not null`, [m.session_id, it!.id, m.team_id]);
        if (w) throw new HttpError(400, 'Your team already locked its wager on this one. Play High Roller before locking a wager.');
      }
      await set('used', `, used_at=now(), item_id=$4`, [it!.id]);
      result = { ok: true, item: `${it!.round_id} ${it!.label}` };
    } else {
      await set('armed');  // no question it can apply to yet: binds to the next one the teacher selects
    }
    await bump(db, m.session_id);
    return result;
  });
}

async function highRollers(sessionId: string, itemId: string) {
  const rows = await q<{ team_id: string }>(
    `select team_id from powerups where session_id=$1 and type='highroller' and status='used' and item_id=$2`, [sessionId, itemId]);
  return new Set(rows.map((r) => r.team_id));
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

export async function createSession(input: { classId: string; title?: string; teamMode?: string; maxTeamSize?: number; teams?: string[]; itemIds?: unknown; practice?: boolean }) {
  return tx(async (db) => {
    const [c] = await db(`select id from classes where id=$1`, [input.classId]);
    if (!c) throw new HttpError(400, 'Pick a class.');
    let code = genCode();
    for (let i = 0; i < 5 && (await db(`select 1 from sessions where code=$1`, [code])).length; i++) code = genCode();
    const mode = input.teamMode === 'student' ? 'student' : 'teacher';
    const size = Math.min(10, Math.max(1, Math.round(Number(input.maxTeamSize) || 4)));
    const [s] = await db<{ id: string }>(
      `insert into sessions (class_id, code, title, team_mode, max_team_size, practice) values ($1,$2,$3,$4,$5,$6) returning id`,
      [input.classId, code, clean(input.title, 60) || 'Algorithm Arena', mode, size, !!input.practice]);
    await db(`insert into game_state (session_id) values ($1)`, [s.id]);
    await setSessionItems(db, s.id, input.itemIds);
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

/** Replace the game's question list. No list given = every active question. */
async function setSessionItems(db: Query, sessionId: string, itemIds: unknown) {
  const all = await db<{ id: string }>(`select id from items where active`);
  let ids = all.map((i) => i.id);
  if (Array.isArray(itemIds)) {
    const want = new Set(itemIds.map(String));
    const known = await db<{ id: string }>(`select id from items`);
    ids = known.map((i) => i.id).filter((id) => want.has(id));
    if (!ids.length) throw new HttpError(400, 'Pick at least one question for this game.');
  }
  await db(`delete from session_items where session_id = $1`, [sessionId]);
  await db(`insert into session_items (session_id, item_id) select $1, unnest(string_to_array($2, ','))::uuid`, [sessionId, ids.join(',')]);
}

export async function setGameItems(sessionId: string, itemIds: unknown) {
  await tx(async (db) => {
    await setSessionItems(db, sessionId, itemIds);
    await bump(db, sessionId);
  });
}

export async function updateSession(id: string, patch: { status?: string; title?: string; teamMode?: string; maxTeamSize?: number; itemIds?: unknown; practice?: unknown }) {
  if (patch.itemIds !== undefined) await setGameItems(id, patch.itemIds);
  if (typeof patch.practice === 'boolean') await q(`update sessions set practice=$1 where id=$2`, [patch.practice, id]);
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
  const items = await q<ItemRow & { selected: boolean }>(
    `select i.*, exists (select 1 from session_items si where si.session_id = $1 and si.item_id = i.id) as selected
       from items i order by i.sort`, [id]);
  const it = items.find((i) => i.id === g?.current_item_id) ?? null;
  const teams = await teamScores(id);
  const members = await q(`select id, team_id, display_name, joined_at from members where session_id=$1 order by joined_at`, [id]);
  const subs = it
    ? await q(`select s.id, s.team_id, s.answer_raw, s.wager, s.is_correct, s.override, s.rank, s.submitted_at, m.display_name as member
                 from submissions s left join members m on m.id = s.member_id
                where s.session_id=$1 and s.item_id=$2 order by s.submitted_at nulls last`, [id, it.id])
    : [];
  const powerups = await q(`select p.*, t.name as team from powerups p join teams t on t.id = p.team_id where p.session_id=$1 order by t.created_at, p.type`, [id]);
  const plays = await recentPlays(id);
  const manual = await q(`select e.id, e.team_id, e.item_id, e.tag, e.points, e.reason, e.created_at from score_events e
                            where e.session_id=$1 and e.source='manual' order by e.created_at desc`, [id]);
  const done = await q<{ item_id: string }>(`select distinct item_id from score_events where session_id=$1 and source='auto'`, [id]);
  return {
    session: s,
    state: { ...stateView(g, it), currentItemId: it?.id ?? null, openedAt: g?.opened_at ? new Date(g.opened_at).toISOString() : null },
    current: it ? { ...it } : null,
    items: items.filter((i) => i.active || i.selected).map((i) => ({ id: i.id, round: i.round_id, label: i.label, prompt: i.prompt, manual: i.answer_key.type === 'manual', points: i.points, timeLimit: i.time_limit_s, answerText: i.answer_text, selected: i.selected })),
    scoredItemIds: done.map((d) => d.item_id),
    teams,
    members,
    submissions: subs,
    powerups,
    plays,
    manualEvents: manual,
  };
}

export type ControlOpts = { itemId?: string; seconds?: number; board?: string; lead?: number; wagerSeconds?: number };

const clampSecs = (v: unknown, lo: number, hi: number, dflt: number) => {
  if (v === null || v === undefined || v === '') return dflt;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

export async function control(sessionId: string, action: string, opts: ControlOpts = {}) {
  const { itemId, seconds, board } = opts;
  const g = await state(sessionId);
  if (!g) throw new HttpError(404, 'Session not found.');
  switch (action) {
    case 'select': {
      const it = await itemById(itemId ?? null);
      if (!it) throw new HttpError(400, 'Pick an item.');
      const inGame = await q(`select 1 from session_items where session_id=$1 and item_id=$2`, [sessionId, it.id]);
      if (!inGame.length) throw new HttpError(400, 'That question is not part of this game. Add it in the Questions tab first.');
      const revealed = await alreadyRevealed(sessionId, it.id);
      await tx(async (db) => {
        await db(`update game_state set current_item_id=$1, phase=$2, opened_at=null, closes_at=null, wager_ends_at=null where session_id=$3`,
          [it.id, revealed ? 'revealed' : 'idle', sessionId]);
        await db(`update sessions set status='live' where id=$1 and status='lobby'`, [sessionId]);
        // A card bound to a question that was skipped before scoring goes back to waiting...
        await db(`update powerups p set status='armed', item_id=null, used_at=null
                   where p.session_id=$1 and p.type in ${SCORING_CARDS} and p.status='used' and p.item_id is not null and p.item_id <> $2
                     and not exists (select 1 from score_events e where e.session_id=p.session_id and e.item_id=p.item_id and e.source='auto')`,
          [sessionId, it.id]);
        // ...and every waiting card that fits this question takes effect on it now.
        if (!revealed && it.answer_key.type !== 'manual') {
          await db(`update powerups set status='used', item_id=$1, used_at=now()
                     where session_id=$2 and status='armed' and type = any(string_to_array($3, ','))`, [it.id, sessionId, cardTypesFor(it)]);
        }
      });
      break;
    }
    case 'wager': {
      const it = await itemById(g.current_item_id);
      if (!it?.points.wager) throw new HttpError(400, 'Only Map Heist items take wagers.');
      await q(`update powerups set status='used', item_id=$1, used_at=now() where session_id=$2 and type='highroller' and status='armed'`, [it.id, sessionId]);
      // Timed wagers run the whole start on the clock: betting, then the get-ready countdown, then answering.
      const w = clampSecs(opts.wagerSeconds, 0, 600, 0);
      const lead = clampSecs(opts.lead, 0, 60, 10);
      const secs = clampSecs(seconds, 5, 3600, it.time_limit_s);
      if (w > 0) {
        await q(`update game_state set phase='wager', wager_ends_at=now() + make_interval(secs => $1::float8),
                   opened_at=now() + make_interval(secs => $1::float8 + $2::float8), closes_at=now() + make_interval(secs => $1::float8 + $2::float8 + $3::float8) where session_id=$4`,
          [w, lead, secs, sessionId]);
      } else {
        await q(`update game_state set phase='wager', wager_ends_at=null, opened_at=null, closes_at=null where session_id=$1`, [sessionId]);
      }
      break;
    }
    case 'open': {
      const it = await itemById(g.current_item_id);
      if (!it || it.answer_key.type === 'manual') throw new HttpError(400, 'Pick an auto-scored item first.');
      const secs = clampSecs(seconds, 5, 3600, it.time_limit_s);
      const lead = clampSecs(opts.lead, 0, 60, 0);
      await q(`update game_state set phase='open', wager_ends_at=null, opened_at=now() + make_interval(secs => $1::float8),
                 closes_at=now() + make_interval(secs => $1::float8 + $2::float8) where session_id=$3`, [lead, secs, sessionId]);
      break;
    }
    case 'skip': {
      // Jump to the next step now: end betting (the countdown starts) or end the countdown (answering starts).
      const ans = g.opened_at && g.closes_at ? (+g.closes_at - +g.opened_at) / 1000 : null;
      if (g.phase === 'wager' && g.wager_ends_at && g.opened_at && ans !== null) {
        const lead = (+g.opened_at - +g.wager_ends_at) / 1000;
        await q(`update game_state set wager_ends_at=now(), opened_at=now() + make_interval(secs => $1::float8),
                   closes_at=now() + make_interval(secs => $1::float8 + $2::float8) where session_id=$3`, [lead, ans, sessionId]);
      } else if (g.phase === 'ready' && ans !== null) {
        await q(`update game_state set phase='open', wager_ends_at=null, opened_at=now(), closes_at=now() + make_interval(secs => $1::float8) where session_id=$2`,
          [ans, sessionId]);
      } else {
        throw new HttpError(400, 'Nothing is counting down.');
      }
      break;
    }
    case 'more': {
      // +15 s on whatever is counting down (betting or get-ready); answering time is unchanged.
      if (g.phase === 'wager' && g.wager_ends_at) {
        await q(`update game_state set wager_ends_at=wager_ends_at + interval '15 seconds', opened_at=opened_at + interval '15 seconds',
                   closes_at=closes_at + interval '15 seconds' where session_id=$1`, [sessionId]);
      } else if (g.phase === 'ready') {
        await q(`update game_state set opened_at=opened_at + interval '15 seconds', closes_at=closes_at + interval '15 seconds' where session_id=$1`, [sessionId]);
      } else {
        throw new HttpError(400, 'Nothing is counting down.');
      }
      break;
    }
    case 'extend': {
      await q(`update game_state set closes_at = greatest(coalesce(closes_at, now()), now()) + interval '30 seconds', phase='open' where session_id=$1`, [sessionId]);
      break;
    }
    case 'close':
      await q(`update game_state set phase='closed', wager_ends_at=null, closes_at=least(coalesce(closes_at, now()), now()) where session_id=$1`, [sessionId]);
      break;
    case 'reveal': {
      if (!g.current_item_id) throw new HttpError(400, 'Pick an item first.');
      const it = await itemById(g.current_item_id);
      if (it && it.answer_key.type !== 'manual') await rescore(sessionId, it.id, true);
      await q(`update game_state set phase='revealed', wager_ends_at=null, closes_at=least(coalesce(closes_at, now()), now()) where session_id=$1`, [sessionId]);
      break;
    }
    case 'reset': {
      if (!g.current_item_id) throw new HttpError(400, 'Pick an item first.');
      await tx(async (db) => {
        await db(`delete from submissions where session_id=$1 and item_id=$2`, [sessionId, g.current_item_id]);
        await db(`delete from score_events where session_id=$1 and item_id=$2 and source in ('auto','powerup')`, [sessionId, g.current_item_id]);
        await db(`update powerups set status='available', item_id=null, used_at=null, requested_at=null, hint=null where session_id=$1 and item_id=$2 and type in ('lifeline','retry')`, [sessionId, g.current_item_id]);
        await db(`update game_state set phase='idle', opened_at=null, closes_at=null, wager_ends_at=null where session_id=$1`, [sessionId]);
      });
      break;
    }
    case 'board': {
      if (!BOARD_MODES.includes(board as BoardMode)) throw new HttpError(400, 'Unknown leaderboard view.');
      await q(`update game_state set board=$1 where session_id=$2`, [board, sessionId]);
      break;
    }
    case 'clear':
      await q(`update game_state set current_item_id=null, phase='idle', opened_at=null, closes_at=null, wager_ends_at=null where session_id=$1`, [sessionId]);
      break;
    case 'reset-scores':
      // After a practice round: wipe every answer, point and played power-up card. Teams and members stay.
      await tx(async (db) => {
        await db(`delete from submissions where session_id=$1`, [sessionId]);
        await db(`delete from score_events where session_id=$1`, [sessionId]);
        await db(`update powerups set status='available', item_id=null, requested_at=null, used_at=null, hint=null where session_id=$1`, [sessionId]);
        await db(`update game_state set current_item_id=null, phase='idle', opened_at=null, closes_at=null, wager_ends_at=null where session_id=$1`, [sessionId]);
        await db(`update sessions set practice=false, status=case when status='ended' then 'live' else status end where id=$1`, [sessionId]);
      });
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
    if (consumeArmed) {
      const types = it.points.wager ? `('shield')` : `('double','fast','shield')`;
      await db(`update powerups set status='used', item_id=$1, used_at=now() where session_id=$2 and type in ${types} and status='armed'`, [itemId, sessionId]);
    }
    const active = await db<{ team_id: string; type: string }>(
      `select team_id, type from powerups where session_id=$1 and status='used' and item_id=$2`, [sessionId, itemId]);
    const teamsWith = (ty: string) => new Set(active.filter((p) => p.type === ty).map((p) => p.team_id));
    const subs = await db<SubmissionRow>(
      `select id, team_id, answer_raw, wager, is_correct, override, submitted_at from submissions where session_id=$1 and item_id=$2`,
      [sessionId, itemId]);
    const result = scoreItem(it, subs, { double: teamsWith('double'), shield: teamsWith('shield'), fast: teamsWith('fast'), highRoller: teamsWith('highroller') });
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
  else if (p.type === 'double') {
    const g = await state(sessionId);
    const it = await itemById(g?.current_item_id ?? null);
    if (fitsItem('double', it, g?.phase)) await q(`update powerups set status='used', used_at=now(), item_id=$2 where id=$1`, [powerupId, it!.id]);
    else await q(`update powerups set status='armed' where id=$1`, [powerupId]);
  }
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
       join session_items si on si.session_id = s.id and si.item_id = i.id
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

import postgres from 'postgres';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import { ITEMS, RETIRED, ROUNDS } from './seed';

type Sql = ReturnType<typeof postgres>;
export type Query = <T = any>(text: string, params?: unknown[]) => Promise<T[]>;

declare global {
  // eslint-disable-next-line no-var
  var __arenaSql: Sql | undefined;
  // eslint-disable-next-line no-var
  var __arenaInit: Promise<void> | undefined;
}

function connectionUrl(): string {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error('No database configured. Set POSTGRES_URL (added automatically by the Vercel Supabase integration) or DATABASE_URL.');
  return raw;
}

function client(): Sql {
  if (!globalThis.__arenaSql) {
    const url = new URL(connectionUrl());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    // Vercel's Supabase URLs carry extra query params (e.g. supa=...) that
    // Postgres would reject as unknown settings, so drop them all.
    url.search = '';
    globalThis.__arenaSql = postgres(url.toString(), {
      ssl: local ? false : 'require',
      prepare: false, // required for Supabase's transaction pooler
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      types: { bigint: postgres.BigInt },
      transform: { undefined: null },
    });
  }
  return globalThis.__arenaSql;
}

async function init(sql: Sql) {
  await sql.begin(async (t) => {
    // Fail fast instead of hanging if another instance is stuck holding the setup lock.
    await t.unsafe(`set local lock_timeout = '15s'`);
    await t.unsafe(`set local statement_timeout = '60s'`);
    await t.unsafe('select pg_advisory_xact_lock(424242)');
    const [{ ok }] = await t.unsafe<{ ok: string | null }[]>(`select to_regclass('public.app_meta')::text as ok`);
    let version: string | null = null;
    if (ok) {
      const rows = await t.unsafe<{ value: string }[]>(`select value from app_meta where key = 'schema_version'`);
      version = rows[0]?.value ?? null;
    }
    if (version === SCHEMA_VERSION) return;
    await t.unsafe(SCHEMA_SQL);
    // One statement per table (not one per row): the database may be far away, and
    // every round trip adds latency while all other requests wait for this lock.
    await t.unsafe(
      `insert into rounds (id, title, scoring_mode, sort)
       select x.id, x.title, x.scoring_mode, x.sort from jsonb_to_recordset($1::text::jsonb) as x(id text, title text, scoring_mode text, sort int)
       on conflict (id) do update set title = excluded.title, scoring_mode = excluded.scoring_mode, sort = excluded.sort`,
      [JSON.stringify(ROUNDS)],
    );
    const rows = ITEMS.map((it, i) => ({
      round_id: it.round_id, label: it.label, sort: (i + 1) * 10, prompt: it.prompt,
      figure_url: it.figure_url ?? null, answer_figure_url: it.answer_figure_url ?? null, answer_type: it.answer_key.type,
      answer_key: it.answer_key, answer_text: it.answer_text, explanation: it.explanation ?? null, points: it.points, time_limit_s: it.time_limit_s,
    }));
    await t.unsafe(
      `insert into items (round_id, label, sort, prompt, figure_url, answer_figure_url, answer_type, answer_key, answer_text, explanation, points, time_limit_s)
       select x.round_id, x.label, x.sort, x.prompt, x.figure_url, x.answer_figure_url, x.answer_type, x.answer_key, x.answer_text, x.explanation, x.points, x.time_limit_s
         from jsonb_to_recordset($1::text::jsonb) as x(round_id text, label text, sort int, prompt text, figure_url text, answer_figure_url text,
              answer_type text, answer_key jsonb, answer_text text, explanation text, points jsonb, time_limit_s int)
       on conflict (round_id, label) do update set sort = excluded.sort`,
      [JSON.stringify(rows)],
    );
    await t.unsafe(
      `update items i set active = false from jsonb_to_recordset($1::text::jsonb) as r(round_id text, label text)
        where i.round_id = r.round_id and i.label = r.label`,
      [JSON.stringify(RETIRED.map(([round_id, label]) => ({ round_id, label })))],
    );
    await t.unsafe(
      `insert into app_meta (key, value) values ('schema_version', $1) on conflict (key) do update set value = excluded.value`,
      [SCHEMA_VERSION],
    );
  });
}

async function ready(): Promise<Sql> {
  const sql = client();
  if (!globalThis.__arenaInit) {
    globalThis.__arenaInit = init(sql).catch((e) => {
      globalThis.__arenaInit = undefined;
      throw e;
    });
  }
  await globalThis.__arenaInit;
  return sql;
}

/** Run one parameterized query ($1, $2, ...). */
export const q: Query = async (text, params = []) => {
  const sql = await ready();
  return (await sql.unsafe(text, params as any[])) as any;
};

/** Run several queries in one transaction. */
export async function tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  const sql = await ready();
  return (await sql.begin(async (t) => fn(async (text, params = []) => (await t.unsafe(text, params as any[])) as any))) as T;
}

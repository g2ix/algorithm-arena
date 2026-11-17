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
    await t.unsafe('select pg_advisory_xact_lock(424242)');
    const [{ ok }] = await t.unsafe<{ ok: string | null }[]>(`select to_regclass('public.app_meta')::text as ok`);
    let version: string | null = null;
    if (ok) {
      const rows = await t.unsafe<{ value: string }[]>(`select value from app_meta where key = 'schema_version'`);
      version = rows[0]?.value ?? null;
    }
    if (version === SCHEMA_VERSION) return;
    await t.unsafe(SCHEMA_SQL);
    for (const r of ROUNDS) {
      await t.unsafe(
        `insert into rounds (id, title, scoring_mode, sort) values ($1,$2,$3,$4)
         on conflict (id) do update set title = excluded.title, scoring_mode = excluded.scoring_mode, sort = excluded.sort`,
        [r.id, r.title, r.scoring_mode, r.sort],
      );
    }
    let sort = 0;
    for (const it of ITEMS) {
      sort += 10;
      await t.unsafe(
        `insert into items (round_id, label, sort, prompt, figure_url, answer_figure_url, answer_type, answer_key, answer_text, explanation, points, time_limit_s)
         values ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9,$10,$11::text::jsonb,$12)
         on conflict (round_id, label) do update set sort = excluded.sort`,
        [it.round_id, it.label, sort, it.prompt, it.figure_url ?? null, it.answer_figure_url ?? null, it.answer_key.type,
         JSON.stringify(it.answer_key), it.answer_text, it.explanation ?? null, JSON.stringify(it.points), it.time_limit_s],
      );
    }
    for (const [round, label] of RETIRED) {
      await t.unsafe(`update items set active = false where round_id = $1 and label = $2`, [round, label]);
    }
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

// Database schema. Runs automatically the first time the app talks to the
// database (see lib/db.ts), and is also saved as supabase/migrations/001_init.sql.
export const SCHEMA_VERSION = '2';

export const SCHEMA_SQL = `
create table if not exists app_meta (
  key text primary key,
  value text not null
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_year text,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  code text not null unique,
  title text not null,
  status text not null default 'lobby',          -- lobby | live | ended
  team_mode text not null default 'teacher',     -- teacher | student
  max_team_size int not null default 4,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (session_id, name)
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  display_name text not null,
  device_token text not null unique,
  joined_at timestamptz not null default clock_timestamp()
);

create table if not exists rounds (
  id text primary key,                           -- R1 .. R5
  title text not null,
  scoring_mode text not null,                    -- auto | manual
  sort int not null
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  round_id text not null references rounds(id),
  label text not null,
  sort int not null,
  prompt text not null,
  figure_url text,
  answer_figure_url text,
  answer_type text not null,                     -- sequence | array | number | multi | manual
  answer_key jsonb not null,
  answer_text text,                              -- shown on reveal
  explanation text,
  points jsonb not null,
  time_limit_s int not null default 60,
  active boolean not null default true,
  unique (round_id, label)
);

create table if not exists game_state (
  session_id uuid primary key references sessions(id) on delete cascade,
  current_item_id uuid references items(id) on delete set null,
  phase text not null default 'idle',            -- idle | wager | open | closed | revealed
  opened_at timestamptz,
  closes_at timestamptz,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  answer_raw jsonb,
  wager int,
  is_correct boolean,
  override boolean not null default false,
  rank int,
  wager_at timestamptz,
  submitted_at timestamptz,
  unique (session_id, item_id, team_id)
);

create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  source text not null,                          -- auto | manual | powerup
  tag text not null,                             -- first | correct | wrong | wager | double | solve | win | adjust
  points int not null,
  reason text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists score_events_session_idx on score_events(session_id);

create table if not exists powerups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  type text not null,                            -- lifeline | double | steal | shield | fast | highroller | retry
  status text not null default 'available',      -- available | requested | armed | used
  item_id uuid references items(id) on delete set null,
  requested_at timestamptz,
  used_at timestamptz,
  unique (session_id, team_id, type)
);
alter table powerups add column if not exists hint jsonb;   -- Lifeline: the system's hint for the team's draft

-- Supabase exposes tables to browsers through its REST API. Row level
-- security with no policy blocks all of that, so answer keys stay private.
-- The app's server connects as the database owner and is not affected.
alter table app_meta enable row level security;
alter table classes enable row level security;
alter table sessions enable row level security;
alter table teams enable row level security;
alter table members enable row level security;
alter table rounds enable row level security;
alter table items enable row level security;
alter table game_state enable row level security;
alter table submissions enable row level security;
alter table score_events enable row level security;
alter table powerups enable row level security;

-- Browsers may only read game_state (no secrets in it) so they can listen
-- for live changes with Supabase Realtime.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if not exists (select 1 from pg_policies where tablename = 'game_state' and policyname = 'live read') then
      execute 'create policy "live read" on game_state for select to anon, authenticated using (true)';
    end if;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_state') then
      execute 'alter publication supabase_realtime add table game_state';
    end if;
  end if;
end $$;
`;

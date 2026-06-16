-- AI Tools page: Grade Tracker + Gym Tracker tables.
-- Idempotent; mirrors the live schema applied 2026-06-16.

-- ── Grade Tracker ────────────────────────────────────────────────────────────
-- One row per assessment. Weighted average + projected final are computed in the
-- UI from earned/max/weight; feedback feeds the AI catch-up plan.
create table if not exists public.grades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course      text default '',
  name        text not null,
  earned      numeric,                       -- null until graded
  max         numeric not null default 100,
  weight      numeric not null default 0,    -- % weight toward the final mark
  feedback    text default '',
  sort_order  integer,
  created_at  timestamptz default now()
);
create index if not exists grades_user_idx on public.grades(user_id);
alter table public.grades enable row level security;
drop policy if exists "grades owner" on public.grades;
create policy "grades owner" on public.grades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Gym Tracker ──────────────────────────────────────────────────────────────
-- One row per logged set/exercise entry. PRs (max weight per exercise) and
-- progression are derived in the UI. Weight is in POUNDS (Scott's unit).
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  exercise    text not null,
  weight      numeric default 0,
  reps        integer default 0,
  sets        integer default 1,
  notes       text default '',
  created_at  timestamptz default now()
);
create index if not exists workouts_user_idx on public.workouts(user_id);
create index if not exists workouts_user_exercise_idx on public.workouts(user_id, exercise);
alter table public.workouts enable row level security;
drop policy if exists "workouts owner" on public.workouts;
create policy "workouts owner" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

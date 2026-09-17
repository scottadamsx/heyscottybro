-- Health space (Achilles inside heyScottyBro, DR-018): workout plans, live sessions and sets.
-- Food (food_logs), body weight (weight_logs) and targets (nutrition_profiles) reuse the
-- existing tables. Set weights are pounds (weight_lb); body weight stays in kilograms
-- (weight_logs.weight_kg, as stored since June) and is shown in pounds.

create table if not exists public.workout_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  notes          text not null default '',
  source         text not null default 'manual' check (source in ('manual', 'ai')),
  prompt         text,                                   -- what Scott asked the AI for
  -- [{ "name", "sets", "repMin", "repMax", "restSec", "note" }] (schema_version 1)
  exercises      jsonb not null default '[]' check (jsonb_typeof(exercises) = 'array'),
  schema_version integer not null default 1,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id     uuid references public.workout_plans(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,                               -- null = in progress
  notes       text not null default '',
  -- the plan's exercises when the workout started, plus any added during it
  exercises   jsonb not null default '[]' check (jsonb_typeof(exercises) = 'array'),
  created_at  timestamptz not null default now(),
  constraint workout_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);
-- One workout in progress at a time.
create unique index if not exists workout_sessions_one_open on public.workout_sessions (user_id) where ended_at is null;
create index if not exists workout_sessions_user_started on public.workout_sessions (user_id, started_at desc);

create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  exercise    text not null check (char_length(exercise) between 1 and 120),
  set_number  integer not null check (set_number between 1 and 50),
  reps        integer not null check (reps between 0 and 200),
  weight_lb   numeric(6,2) not null default 0 check (weight_lb between 0 and 2000),
  rpe         numeric(3,1) check (rpe is null or rpe between 1 and 10),
  logged_at   timestamptz not null default now()
);
create index if not exists workout_sets_session on public.workout_sets (session_id);
create index if not exists workout_sets_user_exercise on public.workout_sets (user_id, exercise, logged_at desc);

alter table public.workout_plans    enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets     enable row level security;

drop policy if exists "workout_plans owner" on public.workout_plans;
create policy "workout_plans owner" on public.workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_sessions owner" on public.workout_sessions;
create policy "workout_sessions owner" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_sets owner" on public.workout_sets;
create policy "workout_sets owner" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A set can only go into one of your own sessions.
create or replace function public.workout_sets_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from workout_sessions s where s.id = new.session_id and s.user_id = new.user_id) then
    raise exception 'workout set must belong to one of your own workouts';
  end if;
  return new;
end;
$$;
drop trigger if exists workout_sets_same_owner on public.workout_sets;
create trigger workout_sets_same_owner before insert or update on public.workout_sets
  for each row execute function public.workout_sets_same_owner();

-- Bring the old flat gym log (workouts: one row = weight × reps × sets) in as history,
-- one finished session per day, so suggestions start from what was already lifted.
-- The workouts table itself is left as it was.
do $$
declare d record; sid uuid;
begin
  if exists (select 1 from workout_sessions) then return; end if;   -- only on first run
  for d in select user_id, date from workouts group by user_id, date order by date loop
    insert into workout_sessions (user_id, name, started_at, ended_at, notes, exercises)
    values (
      d.user_id, 'Workout',
      (d.date::timestamp + time '18:00') at time zone 'America/St_Johns',
      (d.date::timestamp + time '19:00') at time zone 'America/St_Johns',
      'Imported from the old gym log',
      coalesce((select jsonb_agg(jsonb_build_object('name', w.exercise, 'sets', greatest(w.sets, 1), 'repMin', 8, 'repMax', 12, 'restSec', 90, 'note', '') order by w.created_at)
                from workouts w where w.user_id = d.user_id and w.date = d.date), '[]'::jsonb)
    ) returning id into sid;
    insert into workout_sets (user_id, session_id, exercise, set_number, reps, weight_lb, logged_at)
    select w.user_id, sid, w.exercise, g.n, greatest(w.reps, 0), greatest(w.weight, 0),
           (d.date::timestamp + time '18:00') at time zone 'America/St_Johns'
    from workouts w cross join lateral generate_series(1, greatest(w.sets, 1)) as g(n)
    where w.user_id = d.user_id and w.date = d.date;
  end loop;
end;
$$;

-- One health profile per person (the app is single-user; two concurrent first loads used to
-- create two). Creating it is then an upsert that can't duplicate.
create unique index if not exists nutrition_profiles_one_per_user on public.nutrition_profiles (user_id);

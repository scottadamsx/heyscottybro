-- Durable owner-scoped exercise library. Workout sets remain the performance source
-- of truth; PRs are derived in the app so edits/deletes cannot leave stale records.

create table if not exists public.exercise_library (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  normalized_name text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  goal_weight_lb  numeric(6,2) check (goal_weight_lb is null or goal_weight_lb > 0 and goal_weight_lb <= 2000),
  goal_reps       integer check (goal_reps is null or goal_reps between 1 and 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint exercise_library_goal_pair check ((goal_weight_lb is null) = (goal_reps is null)),
  constraint exercise_library_owner_name unique (user_id, normalized_name)
);

create index if not exists exercise_library_user_updated
  on public.exercise_library (user_id, updated_at desc);

alter table public.exercise_library enable row level security;

drop policy if exists "exercise_library owner" on public.exercise_library;
create policy "exercise_library owner" on public.exercise_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.remember_exercise(owner_id uuid, exercise_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare clean_name text := left(regexp_replace(btrim(exercise_name), '\s+', ' ', 'g'), 120);
begin
  if owner_id is null or clean_name = '' then return; end if;
  insert into exercise_library (user_id, name)
  values (owner_id, clean_name)
  on conflict (user_id, normalized_name) do nothing;
end;
$$;
revoke execute on function public.remember_exercise(uuid, text) from public, anon, authenticated;

create or replace function public.remember_plan_exercises() returns trigger
language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(coalesce(new.exercises, '[]'::jsonb)) loop
    perform remember_exercise(new.user_id, item->>'name');
  end loop;
  return new;
end;
$$;
revoke execute on function public.remember_plan_exercises() from public, anon, authenticated;

drop trigger if exists workout_plans_remember_exercises on public.workout_plans;
create trigger workout_plans_remember_exercises
  after insert or update of exercises on public.workout_plans
  for each row execute function public.remember_plan_exercises();

drop trigger if exists workout_sessions_remember_exercises on public.workout_sessions;
create trigger workout_sessions_remember_exercises
  after insert or update of exercises on public.workout_sessions
  for each row execute function public.remember_plan_exercises();

create or replace function public.remember_set_exercise() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform remember_exercise(new.user_id, new.exercise);
  return new;
end;
$$;
revoke execute on function public.remember_set_exercise() from public, anon, authenticated;

drop trigger if exists workout_sets_remember_exercise on public.workout_sets;
create trigger workout_sets_remember_exercise
  after insert or update of exercise on public.workout_sets
  for each row execute function public.remember_set_exercise();

-- Backfill anything already used in logged sets, saved plans, or workout snapshots.
insert into public.exercise_library (user_id, name)
select source.user_id, source.name
from (
  select user_id, left(regexp_replace(btrim(exercise), '\s+', ' ', 'g'), 120) as name
  from public.workout_sets
  union
  select p.user_id, left(regexp_replace(btrim(item->>'name'), '\s+', ' ', 'g'), 120)
  from public.workout_plans p cross join lateral jsonb_array_elements(p.exercises) item
  union
  select s.user_id, left(regexp_replace(btrim(item->>'name'), '\s+', ' ', 'g'), 120)
  from public.workout_sessions s cross join lateral jsonb_array_elements(s.exercises) item
) source
where source.name <> ''
on conflict (user_id, normalized_name) do nothing;

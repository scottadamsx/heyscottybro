-- Event people and event location: Connected Pages Phase 2, slice 1 (DR-033).
-- See docs/features/connected-pages.md, "Phase 2, slice 1".
-- Idempotent. Additive only.
set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.events add column if not exists location text;

create table if not exists public.event_people (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  person_id  text not null,
  created_at timestamptz not null default now(),
  unique (event_id, person_id)
);

create index if not exists event_people_user_event_idx
  on public.event_people (user_id, event_id);

alter table public.event_people enable row level security;
drop policy if exists "event_people owner" on public.event_people;
create policy "event_people owner" on public.event_people
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- This project requires explicit grants on new public tables.
grant select, insert, update, delete on public.event_people to authenticated;
grant select, insert, update, delete on public.event_people to service_role;

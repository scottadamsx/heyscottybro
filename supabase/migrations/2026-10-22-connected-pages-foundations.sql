-- Connected Pages Phase 0: generated-task provenance on reminders, and
-- gap-watcher state. See docs/features/connected-pages.md (Design 3 and 4).
-- Idempotent. Additive only. NOT YET APPLIED (needs Scott's Supabase sign-in).
set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.reminders
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists generator text,
  add column if not exists generated_hash text,
  add column if not exists managed_state text not null default 'manual';

do $$
begin
  alter table public.reminders
    add constraint reminders_managed_state_check
    check (managed_state in ('manual', 'generated', 'detached'));
exception when duplicate_object then null;
end $$;

-- At most one OPEN generated task per source role. Completed rows never block
-- a genuinely new later episode (its source key differs by design).
create unique index if not exists reminders_open_generated_key_uidx
  on public.reminders (user_id, source_type, source_id, source_key)
  where source_type is not null and completed = false;

create table if not exists public.gap_watchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watcher_key text not null,
  scope_type text not null,
  scope_id text not null,
  scope_start date,
  scope_end date,
  status text not null default 'active'
    check (status in ('active', 'resolved', 'suppressed', 'expired')),
  gap_fingerprint text not null,
  gap_details jsonb not null default '{}'::jsonb,
  reminder_id uuid references public.reminders(id) on delete set null,
  episode integer not null default 1,
  first_detected_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now(),
  resolved_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gap_watchers_scope_idx
  on public.gap_watchers (user_id, watcher_key, scope_type, scope_id, episode desc);

alter table public.gap_watchers enable row level security;
drop policy if exists "gap_watchers owner" on public.gap_watchers;
create policy "gap_watchers owner" on public.gap_watchers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists gap_watchers_updated_at on public.gap_watchers;
create trigger gap_watchers_updated_at before update on public.gap_watchers
  for each row execute function set_updated_at();

-- This project requires explicit grants on new public tables.
grant select, insert, update, delete on public.gap_watchers to authenticated;
grant select, insert, update, delete on public.gap_watchers to service_role;

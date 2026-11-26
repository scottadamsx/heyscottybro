-- Reminder action history (BUG-102): every create, edit, completion and
-- delete of a reminder is recorded with before/after snapshots so any change
-- can be reverted from the task's History section. Idempotent.
-- NOT yet applied to production — run manually when ready.
create table if not exists public.reminder_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null,                    -- plain id, no FK: history must survive the reminder being deleted
  action      text not null,                    -- created | edited | completed | completed_early | deleted
  summary     text not null default '',
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb,
  reverted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists reminder_history_reminder_idx
  on public.reminder_history (user_id, reminder_id, created_at desc);
alter table public.reminder_history enable row level security;
drop policy if exists "reminder_history owner" on public.reminder_history;
create policy "reminder_history owner" on public.reminder_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI Inbox: Gmail connector dedup columns.
-- Idempotent. Adds an external message id (Gmail message id) + thread id so the
-- /api/inbox-sync poller never imports the same email twice. The unique index is
-- per-user and ignores rows with no external_id (manual messages stay NULL).

alter table public.messages add column if not exists external_id text;
alter table public.messages add column if not exists thread_id   text;

-- One row per (user, external message). Plain unique index (not partial) so that
-- PostgREST upserts can target it via on_conflict. Postgres treats NULLs as
-- distinct, so manual messages (external_id NULL) are unaffected and unlimited.
create unique index if not exists messages_user_external_uidx
  on public.messages(user_id, external_id);

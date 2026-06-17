-- AI Inbox: per-message read/unread state.
-- Idempotent. `read` mirrors Gmail's UNREAD label for email messages and is set
-- when Scott opens a message in the app; manual messages use it as a plain flag.

alter table public.messages add column if not exists read boolean not null default false;

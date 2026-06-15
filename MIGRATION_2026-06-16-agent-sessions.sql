-- Agent chat persistence — so Command Center conversations survive a refresh.
-- One row per (user, agent): the visible thread (`display`) and the model
-- history (`convo`) so both the UI and the agent's context are restored.
-- Idempotent.

create table if not exists public.agent_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  agent_id    text not null,
  display     jsonb default '[]'::jsonb,   -- [{ role, text }] for the UI
  convo       jsonb default '[]'::jsonb,   -- Anthropic message history (with tool blocks)
  updated_at  timestamptz default now(),
  unique (user_id, agent_id)
);

create index if not exists agent_sessions_user_idx on public.agent_sessions(user_id);

alter table public.agent_sessions enable row level security;
drop policy if exists "agent_sessions owner" on public.agent_sessions;
create policy "agent_sessions owner" on public.agent_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

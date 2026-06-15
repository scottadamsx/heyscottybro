-- Brain graph + agent provenance
-- The app already reads/writes brain_nodes & brain_links (src/api/brainApi.js)
-- but they were never in source control. This makes them reproducible. Node
-- provenance rides on the `source` column (e.g. "galadriel"). Idempotent — safe
-- to re-run; mirrors the live schema.

-- ── brain_nodes ──────────────────────────────────────────────────────────────
create table if not exists public.brain_nodes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null,
  title       text not null,
  body        text default '',
  type        text default 'note',          -- root | projects | checkpoints | procedures | note
  tags        text[] default '{}',
  source      text,                          -- vault | manual | agent id (e.g. galadriel)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, slug)
);

alter table public.brain_nodes add column if not exists source text;

create index if not exists brain_nodes_user_idx on public.brain_nodes(user_id);

-- ── brain_links ──────────────────────────────────────────────────────────────
create table if not exists public.brain_links (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source_slug  text not null,
  target_slug  text not null,
  created_at   timestamptz default now(),
  unique (user_id, source_slug, target_slug)
);

create index if not exists brain_links_user_idx on public.brain_links(user_id);

-- ── RLS: a user only sees their own graph ────────────────────────────────────
alter table public.brain_nodes enable row level security;
alter table public.brain_links enable row level security;

drop policy if exists "brain_nodes owner" on public.brain_nodes;
create policy "brain_nodes owner" on public.brain_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "brain_links owner" on public.brain_links;
create policy "brain_links owner" on public.brain_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

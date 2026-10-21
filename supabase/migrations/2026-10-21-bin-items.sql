-- Bin: holding spaces where Scott drops text, files, and links from any
-- computer for Muse to work or save as life context. See docs/features/bin.md.
-- Idempotent. Additive only.
set lock_timeout = '5s';
set statement_timeout = '30s';

create table if not exists public.bin_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Untitled',
  kind       text not null default 'text' check (kind in ('text', 'file', 'link')),
  body       text,
  file_path  text,
  file_name  text,
  file_size  bigint,
  is_context boolean not null default false,
  status     text not null default 'new' check (status in ('new', 'picked_up', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bin_items_user_created_idx
  on public.bin_items (user_id, created_at desc);

alter table public.bin_items enable row level security;
drop policy if exists "bin_items owner" on public.bin_items;
create policy "bin_items owner" on public.bin_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists bin_items_updated_at on public.bin_items;
create trigger bin_items_updated_at before update on public.bin_items
  for each row execute function set_updated_at();

-- This project requires explicit grants on new public tables.
grant select, insert, update, delete on public.bin_items to authenticated;
grant select, insert, update, delete on public.bin_items to service_role;

-- Work log: what Scott did each day, with notes and the project it was for.
-- Idempotent. Surfaces in Plan > Work and to agents as the "work_log" collection.
create table if not exists public.work_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  task        text not null,
  notes       text default '',
  project_id  uuid references public.projects(id) on delete set null,
  minutes     integer,                       -- optional time spent
  created_at  timestamptz default now()
);
create index if not exists work_log_user_date_idx on public.work_log(user_id, date desc);
alter table public.work_log enable row level security;
drop policy if exists "work_log owner" on public.work_log;
create policy "work_log owner" on public.work_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

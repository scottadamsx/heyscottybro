-- Projects 2.0: project lifecycle stage, task workflow status, subtasks,
-- follow-up links, milestones and project updates.
-- Migration: 2026-11-13-projects-2
-- Idempotent. Additive only.
-- Note: projects.due_date / archived / sort_order already exist in the
-- schema (SUPABASE_SETUP.sql) and are NOT re-added here.
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Projects: lifecycle stage (pipeline needs a lane for every project).
alter table public.projects
  add column if not exists stage text not null default 'planning';

do $$
begin
  alter table public.projects
    add constraint projects_stage_check
    check (stage in ('idea', 'discovery', 'planning', 'development', 'testing', 'launch', 'maintenance', 'completed'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_projects_stage on public.projects(stage);
create index if not exists idx_projects_user_stage on public.projects(user_id, stage);

-- Reminders (the one task system): workflow status, subtasks, follow-up link.
alter table public.reminders
  add column if not exists status text,
  add column if not exists parent_id uuid references public.reminders(id) on delete cascade,
  add column if not exists linked_task_id uuid references public.reminders(id) on delete set null;

do $$
begin
  alter table public.reminders
    add constraint reminders_status_check
    check (status is null or status in ('backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_reminders_status on public.reminders(status);
create index if not exists idx_reminders_parent_id on public.reminders(parent_id);
create index if not exists idx_reminders_linked_task_id on public.reminders(linked_task_id);

-- Project milestones
create table if not exists public.project_milestones (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  name           text not null,
  target_date    date,
  criteria       text default '',
  completed      boolean not null default false,
  completed_date date,
  created_at     timestamptz not null default now()
);

create index if not exists idx_project_milestones_project on public.project_milestones(project_id);
create index if not exists idx_project_milestones_user_project on public.project_milestones(user_id, project_id);

alter table public.project_milestones enable row level security;
drop policy if exists "owner only" on public.project_milestones;
create policy "owner only" on public.project_milestones using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Project updates (notes, decisions, problems, next steps, automatic entries)
create table if not exists public.project_updates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       text not null default 'note',
  body       text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.project_updates
    add constraint project_updates_kind_check
    check (kind in ('note', 'decision', 'problem', 'next_step', 'auto'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_project_updates_project on public.project_updates(project_id);
create index if not exists idx_project_updates_user_project on public.project_updates(user_id, project_id, created_at desc);

alter table public.project_updates enable row level security;
drop policy if exists "owner only" on public.project_updates;
create policy "owner only" on public.project_updates using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- This project requires explicit grants on new public tables.
grant select, insert, update, delete on public.project_milestones to authenticated;
grant select, insert, update, delete on public.project_milestones to service_role;
grant select, insert, update, delete on public.project_updates to authenticated;
grant select, insert, update, delete on public.project_updates to service_role;

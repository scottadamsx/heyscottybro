-- Goal-aware external agent activity
-- Extends the existing agent_actions audit table instead of creating a second log.
-- Safe to re-run. Existing Frodo/Sam/Gandalf rows remain valid.

alter table public.agent_actions
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists task_id text,
  add column if not exists parent_task_id text,
  add column if not exists work_session_id text,
  add column if not exists event_type text,
  add column if not exists summary text,
  add column if not exists goal_alignment text,
  add column if not exists next_step text,
  add column if not exists blockers jsonb not null default '[]'::jsonb,
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists agent_actions_project_time_idx
  on public.agent_actions (project_id, created_at desc)
  where project_id is not null;

create index if not exists agent_actions_task_idx
  on public.agent_actions (task_id)
  where task_id is not null;

create index if not exists agent_actions_work_session_idx
  on public.agent_actions (work_session_id)
  where work_session_id is not null;

comment on column public.agent_actions.event_type is
  'Observable work event such as task_started, task_progress, file_changed, decision_made, blocker_found, task_completed, agent_error.';
comment on column public.agent_actions.summary is
  'Plain-English description of what the agent did or discovered. Never chain-of-thought.';
comment on column public.agent_actions.goal_alignment is
  'How this work advances the parent task, milestone, or overall project goal.';
comment on column public.agent_actions.blockers is
  'Structured list of remaining blockers/risks.';

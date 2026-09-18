-- 2026-09-18 performance: indexes for how the app actually reads (every list is "my rows, in order").
-- Several of these were written in older setup files but never existed in the live database.
create index if not exists reminders_user_date_idx      on public.reminders (user_id, date);
create index if not exists reminders_project_idx        on public.reminders (project_id) where project_id is not null;
create index if not exists reminders_event_idx          on public.reminders (event_id) where event_id is not null;
create index if not exists events_user_date_idx         on public.events (user_id, date);
create index if not exists events_project_idx           on public.events (project_id) where project_id is not null;
create index if not exists journal_user_date_idx        on public.journal (user_id, date desc);
create index if not exists transactions_user_date_idx   on public.transactions (user_id, date desc);
create index if not exists projects_user_created_idx    on public.projects (user_id, created_at);
create index if not exists projects_parent_idx          on public.projects (parent_id) where parent_id is not null;
create index if not exists event_types_user_name_idx    on public.event_types (user_id, name);
create index if not exists initiatives_user_created_idx on public.initiatives (user_id, created_at);
create index if not exists workout_plans_user_idx       on public.workout_plans (user_id, updated_at desc);
create index if not exists hiker_imports_user_idx       on public.hiker_imports (user_id, imported_at desc);
create index if not exists grocery_items_receipt_idx    on public.grocery_receipt_items (receipt_id);
analyze public.reminders, public.events, public.journal, public.transactions, public.projects;

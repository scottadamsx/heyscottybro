-- Private, forward-only analytics foundations.
-- Existing domain rows remain the historical source of truth; these tables
-- start measuring only when this migration is applied.

create table if not exists public.activity_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  idempotency_key  text not null check (char_length(idempotency_key) between 1 and 200),
  event_type       text not null check (char_length(event_type) between 3 and 100 and event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type      text not null check (char_length(entity_type) between 1 and 80),
  entity_id        text check (entity_id is null or char_length(entity_id) <= 200),
  entity_label     text check (entity_label is null or char_length(entity_label) <= 160),
  occurred_at      timestamptz not null default now(),
  source           text not null default 'app' check (char_length(source) between 1 and 80),
  schema_version   integer not null default 1 check (schema_version = 1),
  metadata         jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and metadata - 'precision' - 'attachment_count' = '{}'::jsonb
  ),
  created_at       timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists activity_events_owner_time
  on public.activity_events (user_id, occurred_at desc, id desc);
create index if not exists activity_events_owner_type_time
  on public.activity_events (user_id, event_type, occurred_at desc);

alter table public.activity_events enable row level security;
drop policy if exists "activity_events owner read" on public.activity_events;
create policy "activity_events owner read" on public.activity_events
  for select using (auth.uid() = user_id);
drop policy if exists "activity_events owner insert" on public.activity_events;
create policy "activity_events owner insert" on public.activity_events
  for insert with check (auth.uid() = user_id);

create table if not exists public.page_usage_sessions (
  visit_id        uuid primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  route_key       text not null check (route_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  active_ms       bigint not null default 0 check (active_ms >= 0),
  last_seen_at    timestamptz not null,
  schema_version  integer not null default 1 check (schema_version = 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ended_at >= started_at)
);

create index if not exists page_usage_owner_start
  on public.page_usage_sessions (user_id, started_at desc);
create index if not exists page_usage_owner_route_start
  on public.page_usage_sessions (user_id, route_key, started_at desc);

alter table public.page_usage_sessions enable row level security;
drop policy if exists "page_usage owner" on public.page_usage_sessions;
create policy "page_usage owner" on public.page_usage_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One safe trigger records canonical successful writes atomically with their
-- source row. Arguments are a stable entity type and an allowlisted label key.
create or replace function public.record_product_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  row_json jsonb;
  old_json jsonb;
  owner_id uuid;
  entity_id_value text;
  event_name text;
  event_verb text;
  safe_label text;
begin
  row_json := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_json := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  owner_id := nullif(row_json ->> 'user_id', '')::uuid;
  if owner_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  entity_id_value := row_json ->> 'id';
  safe_label := case
    when tg_table_name = 'orbit_events'
      then left(coalesce(nullif(row_json #>> '{doc,title}', ''), 'People event'), 160)
    else left(coalesce(nullif(row_json ->> tg_argv[1], ''), tg_argv[0]), 160)
  end;
  event_verb := case tg_op
    when 'INSERT' then 'created'
    when 'UPDATE' then 'updated'
    when 'DELETE' then 'deleted'
  end;
  event_name := case
    when tg_argv[0] = 'people_event' then 'people.event.' || event_verb
    else tg_argv[0] || '.' || event_verb
  end;

  if tg_table_name = 'reminders' and tg_op = 'UPDATE'
     and coalesce((old_json ->> 'completed')::boolean, false) = false
     and coalesce((row_json ->> 'completed')::boolean, false) = true then
    event_name := 'task.completed';
  elsif tg_table_name = 'workout_sessions' and tg_op = 'UPDATE'
     and nullif(old_json ->> 'ended_at', '') is null
     and nullif(row_json ->> 'ended_at', '') is not null then
    event_name := 'workout.completed';
  end if;

  insert into public.activity_events (
    user_id, idempotency_key, event_type, entity_type, entity_id,
    entity_label, occurred_at, source, metadata
  ) values (
    owner_id,
    tg_table_name || ':' || coalesce(entity_id_value, 'none') || ':' || lower(tg_op) || ':' || gen_random_uuid()::text,
    event_name,
    tg_argv[0],
    entity_id_value,
    safe_label,
    clock_timestamp(),
    'database_trigger',
    jsonb_build_object('precision', 'exact')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare spec record;
begin
  for spec in
    select * from (values
      ('reminders', 'task', 'name'),
      ('journal', 'journal', 'title'),
      ('events', 'calendar_event', 'title'),
      ('transactions', 'transaction', 'category'),
      ('projects', 'project', 'name'),
      ('food_logs', 'meal', 'name'),
      ('weight_logs', 'weight', 'date'),
      ('workout_sessions', 'workout', 'name'),
      ('orbit_events', 'people_event', 'id')
    ) as source(table_name, entity_type, label_key)
  loop
    if to_regclass('public.' || spec.table_name) is not null then
      execute format('drop trigger if exists analytics_activity on public.%I', spec.table_name);
      execute format(
        'create trigger analytics_activity after insert or update or delete on public.%I for each row execute function public.record_product_activity(%L, %L)',
        spec.table_name, spec.entity_type, spec.label_key
      );
    end if;
  end loop;
end;
$$;

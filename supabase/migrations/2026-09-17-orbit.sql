-- Orbit (people) moves into heyScottyBro as the People space (DR-017).
-- One row per person / event; the Orbit record itself is the `doc` (validated by Orbit's repo.js
-- before it gets here). Every change a request makes is applied by one function call, so a delete
-- and its cascade (events, linked facts) land together or not at all.

create table if not exists public.orbit_people (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  doc        jsonb not null check (jsonb_typeof(doc) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.orbit_events (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  doc        jsonb not null check (jsonb_typeof(doc) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.orbit_settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  doc            jsonb not null check (jsonb_typeof(doc) = 'object'),
  schema_version integer not null default 1,
  updated_at     timestamptz not null default now()
);

alter table public.orbit_people   enable row level security;
alter table public.orbit_events   enable row level security;
alter table public.orbit_settings enable row level security;

drop policy if exists "orbit_people owner" on public.orbit_people;
create policy "orbit_people owner" on public.orbit_people
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "orbit_events owner" on public.orbit_events;
create policy "orbit_events owner" on public.orbit_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "orbit_settings owner" on public.orbit_settings;
create policy "orbit_settings owner" on public.orbit_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ops: [{ "t": "people"|"events", "op": "put"|"del", "id": "...", "doc": {...} },
--       { "t": "settings", "op": "put", "doc": {...} }]
-- Anything malformed raises, which rolls back the whole batch.
create or replace function public.orbit_apply_ops(p_user uuid, ops jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  o jsonb;
  n integer := 0;
begin
  if p_user is null then raise exception 'orbit_apply: not signed in'; end if;
  if jsonb_typeof(ops) <> 'array' then raise exception 'orbit_apply: ops must be an array'; end if;
  for o in select value from jsonb_array_elements(ops) loop
    if o->>'t' = 'people' and o->>'op' = 'put' then
      insert into orbit_people (user_id, id, doc) values (p_user, o->>'id', o->'doc')
      on conflict (user_id, id) do update set doc = excluded.doc, updated_at = now();
    elsif o->>'t' = 'people' and o->>'op' = 'del' then
      delete from orbit_people where user_id = p_user and id = o->>'id';
    elsif o->>'t' = 'events' and o->>'op' = 'put' then
      insert into orbit_events (user_id, id, doc) values (p_user, o->>'id', o->'doc')
      on conflict (user_id, id) do update set doc = excluded.doc, updated_at = now();
    elsif o->>'t' = 'events' and o->>'op' = 'del' then
      delete from orbit_events where user_id = p_user and id = o->>'id';
    elsif o->>'t' = 'settings' and o->>'op' = 'put' then
      insert into orbit_settings (user_id, doc) values (p_user, o->'doc')
      on conflict (user_id) do update set doc = excluded.doc, updated_at = now();
    else
      raise exception 'orbit_apply: bad op %', o;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Signed-in callers can only ever write their own rows.
create or replace function public.orbit_apply(ops jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.orbit_apply_ops(auth.uid(), ops);
end;
$$;

revoke all on function public.orbit_apply_ops(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.orbit_apply_ops(uuid, jsonb) to service_role;
revoke all on function public.orbit_apply(jsonb) from public, anon;
grant execute on function public.orbit_apply(jsonb) to authenticated;

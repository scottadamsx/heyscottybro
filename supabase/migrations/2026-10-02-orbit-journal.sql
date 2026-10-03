-- Orbit journal: owner-only entries and guarded, owner-serialized multi-record commits.
-- Source copy; apply the matching heyScottyBro migration only at the release gate.
create table if not exists public.orbit_journal (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and (doc->>'schemaVersion')::integer = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.orbit_journal enable row level security;
drop policy if exists "orbit_journal owner" on public.orbit_journal;
create policy "orbit_journal owner" on public.orbit_journal
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ordinary edits and journal commits must serialize against the same owner.
create or replace function public.orbit_apply_ops(p_user uuid, ops jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare o jsonb; n integer := 0; actual jsonb;
begin
  if p_user is null then raise exception 'orbit_apply: not signed in'; end if;
  if jsonb_typeof(ops) <> 'array' then raise exception 'orbit_apply: ops must be an array'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  for o in select value from jsonb_array_elements(ops) loop
    if o ? 'expected' and o->>'t' in ('people', 'events') then
      if o->>'t' = 'people' then
        select doc into actual from orbit_people where user_id = p_user and id = o->>'id';
      else
        select doc into actual from orbit_events where user_id = p_user and id = o->>'id';
      end if;
      if coalesce(actual, 'null'::jsonb) <> coalesce(o->'expected', 'null'::jsonb)
        then raise exception 'journal conflict: stale ordinary write'; end if;
      actual := null;
    end if;
    if o->>'guardUnique' = 'true' and o->>'t' = 'people' and exists (
      select 1 from orbit_people p where p.user_id = p_user and p.id <> o->>'id'
        and lower(regexp_replace(coalesce(p.doc->>'name',''), '[^[:alnum:]]', '', 'g')) =
            lower(regexp_replace(coalesce(o->'doc'->>'name',''), '[^[:alnum:]]', '', 'g'))
    ) then raise exception 'journal conflict: duplicate person'; end if;
    if o->>'guardUnique' = 'true' and o->>'t' = 'events' and exists (
      select 1 from orbit_events e where e.user_id = p_user and e.id <> o->>'id'
        and e.doc->>'date' = o->'doc'->>'date' and e.doc->>'kind' = o->'doc'->>'kind'
        and e.doc->'people' @> o->'doc'->'people' and o->'doc'->'people' @> e.doc->'people'
    ) then raise exception 'journal conflict: duplicate event'; end if;
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
      raise exception 'orbit_apply: bad op';
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.orbit_journal_apply_ops(p_user uuid, tx jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c jsonb; o jsonb; u jsonb; actual jsonb; n integer := 0;
begin
  if p_user is null then raise exception 'journal conflict: no owner'; end if;
  if jsonb_typeof(tx->'checks') <> 'array' or jsonb_typeof(tx->'ops') <> 'array'
    or jsonb_typeof(tx->'unique') <> 'array' then raise exception 'journal conflict: malformed transaction'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  for o in select value from jsonb_array_elements(tx->'ops') loop
    if o->>'t' not in ('people', 'events', 'journal') or o->>'op' not in ('put', 'del')
      or coalesce(o->>'id','') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'journal conflict: bad operation'; end if;
    if not exists (
      select 1 from jsonb_array_elements(tx->'checks') x
      where x->>'t' = o->>'t' and x->>'id' = o->>'id'
    ) then raise exception 'journal conflict: missing check'; end if;
  end loop;
  for c in select value from jsonb_array_elements(tx->'checks') loop
    if c->>'t' = 'people' then
      select doc into actual from orbit_people where user_id = p_user and id = c->>'id';
    elsif c->>'t' = 'events' then
      select doc into actual from orbit_events where user_id = p_user and id = c->>'id';
    elsif c->>'t' = 'journal' then
      select doc into actual from orbit_journal where user_id = p_user and id = c->>'id';
    else raise exception 'journal conflict: bad check';
    end if;
    if c->>'exists' = 'true' and actual is null then raise exception 'journal conflict: missing reference'; end if;
    if c->>'exists' is distinct from 'true' and coalesce(actual, 'null'::jsonb) <> coalesce(c->'doc', 'null'::jsonb)
      then raise exception 'journal conflict: stale record'; end if;
    actual := null;
  end loop;
  for u in select value from jsonb_array_elements(tx->'unique') loop
    if u->>'t' = 'people' then
      if exists (
        select 1 from orbit_people p where p.user_id = p_user and p.id <> u->>'id'
          and lower(regexp_replace(coalesce(p.doc->>'name',''), '[^[:alnum:]]', '', 'g')) =
              lower(regexp_replace(coalesce(u->>'name',''), '[^[:alnum:]]', '', 'g'))
      ) then raise exception 'journal conflict: duplicate person'; end if;
    elsif u->>'t' = 'events' then
      if exists (
        select 1 from orbit_events e where e.user_id = p_user and e.id <> u->>'id'
          and e.doc->>'date' = u->'doc'->>'date' and e.doc->>'kind' = u->'doc'->>'kind'
          and e.doc->'people' @> u->'doc'->'people' and u->'doc'->'people' @> e.doc->'people'
      ) then raise exception 'journal conflict: duplicate event'; end if;
    else raise exception 'journal conflict: bad uniqueness check';
    end if;
  end loop;
  for o in select value from jsonb_array_elements(tx->'ops') loop
    if o->>'t' = 'journal' and o->>'op' = 'put' then
      insert into orbit_journal (user_id, id, doc) values (p_user, o->>'id', o->'doc')
      on conflict (user_id, id) do update set doc = excluded.doc, updated_at = now();
    elsif o->>'t' = 'journal' and o->>'op' = 'del' then
      delete from orbit_journal where user_id = p_user and id = o->>'id';
    else
      perform public.orbit_apply_ops(p_user, jsonb_build_array(o));
    end if;
    n := n + 1;
  end loop;
  if exists (
    select 1 from orbit_events e, jsonb_array_elements_text(coalesce(e.doc->'people', '[]'::jsonb)) attendee
    where e.user_id = p_user and not exists (
      select 1 from orbit_people p where p.user_id = p_user and p.id = attendee.value
    )
  ) or exists (
    select 1 from orbit_people p, jsonb_array_elements(coalesce(p.doc->'facts', '[]'::jsonb)) fact
    where p.user_id = p_user and fact->>'ref' is not null and not exists (
      select 1 from orbit_people target where target.user_id = p_user and target.id = fact->>'ref'
    )
  ) then raise exception 'journal conflict: broken person reference'; end if;
  return n;
end;
$$;

create or replace function public.orbit_journal_apply(tx jsonb)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.orbit_journal_apply_ops(auth.uid(), tx);
end;
$$;

revoke all on function public.orbit_journal_apply_ops(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.orbit_journal_apply_ops(uuid, jsonb) to service_role;
revoke all on function public.orbit_journal_apply(jsonb) from public, anon;
grant execute on function public.orbit_journal_apply(jsonb) to authenticated;

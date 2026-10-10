-- Journal/Orbit integration state. Additive only; apply separately after review.
-- Existing events are deliberately excluded from new post-event prompts.
alter table public.events
  add column if not exists orbit_log_status text not null default 'legacy',
  add column if not exists orbit_event_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_orbit_log_status_check') then
    alter table public.events
      add constraint events_orbit_log_status_check
      check (orbit_log_status in ('legacy', 'pending', 'dismissed', 'logged'));
  end if;
end $$;

create index if not exists events_orbit_log_pending_idx
  on public.events (user_id, date)
  where orbit_log_status = 'pending';

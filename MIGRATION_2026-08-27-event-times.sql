-- Events get a start and end time so the day can actually be planned around them.
-- Idempotent. Both nullable: an event with no start_time is all-day.
alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists end_time time;

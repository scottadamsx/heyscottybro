-- Sleep tracking in the Health space (BUG-086): one row per night, keyed by the
-- morning the sleep ended (date), mirroring weight_logs. Bed and wake times are
-- local wall-clock "HH:MM" text exactly as entered; duration_minutes is computed
-- by the app at save time so lists never re-derive it and no timezone conversion
-- can shift a night. Apply by pasting this file into the Supabase SQL Editor for
-- project mogoybejtmkoheqvfvuc and running it once.

create table if not exists public.sleep_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id       uuid not null references public.nutrition_profiles(id) on delete cascade,
  date             date not null,                        -- the morning the sleep ended
  bed_time         text not null check (bed_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake_time        text not null check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes integer not null check (duration_minutes between 30 and 1200),
  note             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (profile_id, date)                              -- one entry per night
);
create index if not exists sleep_logs_profile_date on public.sleep_logs (profile_id, date desc);

alter table public.sleep_logs enable row level security;

drop policy if exists "sleep_logs owner" on public.sleep_logs;
create policy "sleep_logs owner" on public.sleep_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

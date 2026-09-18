-- 2026-09-18 site polish (DR-020).

-- 1. Journal entries show "Last updated": give them an updated_at kept by the existing trigger function.
alter table public.journal add column if not exists updated_at timestamptz;
update public.journal set updated_at = created_at where updated_at is null;
alter table public.journal alter column updated_at set default now();
alter table public.journal alter column updated_at set not null;
drop trigger if exists journal_updated_at on public.journal;
create trigger journal_updated_at before update on public.journal
  for each row execute function public.set_updated_at();

-- 2. Newsletter sign-ups from the public site. Anyone may add their address; nobody can read
--    the list through the public API (Scott reads it in Supabase). One row per address.
create table if not exists public.newsletter_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source     text not null default 'site' check (char_length(source) <= 60),
  created_at timestamptz not null default now()
);
create unique index if not exists newsletter_signups_email_unique on public.newsletter_signups (lower(email));
alter table public.newsletter_signups enable row level security;
drop policy if exists "newsletter insert only" on public.newsletter_signups;
create policy "newsletter insert only" on public.newsletter_signups
  for insert to anon, authenticated with check (true);
grant insert on public.newsletter_signups to anon, authenticated;
revoke select, update, delete on public.newsletter_signups from anon, authenticated;

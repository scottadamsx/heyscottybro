-- Optional provenance for a saved journal body that exactly matches an
-- accepted AI cleanup. Existing rows remain null; owner RLS stays unchanged.
alter table public.journal
  add column if not exists ai_provenance jsonb;

alter table public.journal
  drop constraint if exists journal_ai_provenance_object;

alter table public.journal
  add constraint journal_ai_provenance_object
  check (ai_provenance is null or jsonb_typeof(ai_provenance) = 'object');

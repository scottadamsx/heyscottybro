-- ============================================================================
--  Migrate localStorage data -> Supabase  (project: mogoybejtmkoheqvfvuc)
--  Run this in the Supabase dashboard SQL editor for your live project.
--  Safe to run more than once (idempotent: IF NOT EXISTS / ON CONFLICT).
--
--  user_id below = your auth user (scottadamsx@gmail.com), taken from your
--  current session token. If you ever run this for a different user, swap it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Weed tracker: one state row per user (mirrors the app's in-memory shape).
--    Whole-state upsert keeps the wiring simple and matches how the page works.
-- ---------------------------------------------------------------------------
create table if not exists public.weed_state (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.weed_state enable row level security;

drop policy if exists "weed_state owner" on public.weed_state;
create policy "weed_state owner" on public.weed_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 1b. Accountability: one state row per user ({ trackers, logs } blob).
--     (No seed here — your accountability data wasn't in the dump you shared.
--      The app auto-pushes any device's local trackers up on first load.)
-- ---------------------------------------------------------------------------
create table if not exists public.accountability_state (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  state       jsonb not null default '{"trackers":[],"logs":[]}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.accountability_state enable row level security;

drop policy if exists "accountability_state owner" on public.accountability_state;
create policy "accountability_state owner" on public.accountability_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Budget: the BudgetPage tracks pay schedule + saved simulations, which the
--    existing budget_config table didn't have columns for. Add them.
-- ---------------------------------------------------------------------------
--    (transactions is the budget's own ledger array — kept self-contained here,
--     NOT the shared public.transactions table the dashboard/calendar use.)
alter table public.budget_config
  add column if not exists pay_schedule jsonb default '{"type":"biweekly","anchorDate":null,"customDays":null}'::jsonb,
  add column if not exists simulations  jsonb default '[]'::jsonb,
  add column if not exists transactions jsonb default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. Seed your current localStorage data.
-- ---------------------------------------------------------------------------

-- 3a. Budget config (categories, income, bills, pay schedule).
--     ON CONFLICT DO NOTHING so it will NOT clobber a row if one already exists.
--     If budget still looks empty in the app after running, see the note at
--     the bottom to force-overwrite instead.
insert into public.budget_config
  (user_id, categories, income_sources, recurring_bills, pay_schedule, starting_balance, tax_rate)
values (
  '8dcb8317-68bb-4a7f-ba8d-45649adfa388',
  '["Housing","Groceries","Transportation","Utilities","Entertainment","Dining Out","Personal","Subscriptions","Health","Savings","Other"]'::jsonb,
  '[{"id":"txtsquad","name":"TxtSquad","amount":740,"frequency":"biweekly","nextDate":"2026-06-19"}]'::jsonb,
  '[{"id":"rent","name":"Rent","amount":700,"category":"Housing","frequency":"monthly","startDate":"2026-06-01","autoPay":false},{"id":"electrical","name":"Electrical","amount":150,"category":"Utilities","frequency":"monthly","startDate":"2026-06-15","autoPay":false},{"id":"phone","name":"Phone","amount":156,"category":"Utilities","frequency":"monthly","startDate":"2026-06-05","autoPay":true},{"id":"insurance","name":"Insurance","amount":220,"category":"Personal","frequency":"monthly","startDate":"2026-06-01","autoPay":true},{"id":"googleone","name":"Google One","amount":35,"category":"Subscriptions","frequency":"monthly","startDate":"2026-06-01","autoPay":true},{"id":"claude","name":"Claude Pro","amount":32.99,"category":"Subscriptions","frequency":"monthly","startDate":"2026-06-07","autoPay":true}]'::jsonb,
  '{"type":"biweekly","anchorDate":"2026-06-19","customDays":null}'::jsonb,
  0,
  0.18
)
on conflict (user_id) do nothing;

-- 3b. Weed tracker state (settings for both profiles; logs are currently empty).
insert into public.weed_state (user_id, state)
values (
  '8dcb8317-68bb-4a7f-ba8d-45649adfa388',
  '{"activeProfile":"maria","penGramEquiv":0.1,"scott":{"dailyCapG":1.5,"taperEnabled":true,"taperStart":null,"logs":[]},"maria":{"hitsPerDayCap":8,"cartridgeMg":1000,"mgPerSec":1.5,"hitSec":6,"daysTarget":14,"taperEnabled":true,"taperStart":null,"penStart":1781030839856,"logs":[]}}'::jsonb
)
on conflict (user_id) do nothing;

-- 3c. (Optional) the single reminder that was sitting in localStorage.
--     project_id is intentionally omitted to avoid a foreign-key error if that
--     project doesn't exist on this database. Delete this block if you don't
--     want the old "Fix nutrition_profiles" note (that bug is already resolved).
insert into public.reminders
  (id, user_id, name, description, date, recurrence, completed, show_on_calendar, created_at)
values (
  'ee7fdb82-6a8f-4f1b-87d0-dc4ceb29c6a7',
  '8dcb8317-68bb-4a7f-ba8d-45649adfa388',
  'Fix: Could not find table ''public.nutrition_profiles'' in schema cache',
  'Error occurs when trying to create a nutrition profile. Need to investigate schema cache and nutrition_profiles table initialization.',
  '2026-06-09',
  'none',
  false,
  true,
  '2026-06-09T18:54:07.327Z'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- NOTE: if budget data already existed and step 3a did nothing, run this to
--       overwrite it with the values above (uncomment, then re-run 3a):
--
-- update public.budget_config set
--   categories      = excluded.categories,
--   income_sources  = excluded.income_sources,
--   recurring_bills = excluded.recurring_bills,
--   pay_schedule    = excluded.pay_schedule
-- ...  -- (or just adjust ON CONFLICT to DO UPDATE)
-- ---------------------------------------------------------------------------

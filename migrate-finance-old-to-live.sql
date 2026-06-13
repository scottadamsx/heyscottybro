-- ============================================================================
--  Migrate Finance data:  OLD project (zduuliifucwgottomtgk)
--                      ->  LIVE project (mogoybejtmkoheqvfvuc)
--
--  Run this in the LIVE project's Supabase SQL editor.
--
--  IMPORTANT: your live finance tables were created from an OUTDATED
--  SUPABASE_SETUP.sql and are missing columns the current app code uses
--  (opening_balance, anchor_date, savings_percentage, future_income_horizon_days,
--   savings_reserved, …). The June 12 migration fixed other tables but skipped
--  finance. So SECTION 0 below first catches the live schema up to what the code
--  expects, THEN sections 1–6 load the data.
--
--  - Schema changes are ADD COLUMN IF NOT EXISTS (safe / re-runnable, no data loss).
--  - Data load uses an explicit column list so live-only NOT NULL columns
--    (reserve_pct, net_worth_start) fall back to their DEFAULTS instead of erroring.
--  - Original row IDs are preserved so foreign keys stay intact.
--  - user_id is re-mapped to your live login (8dcb8317-68bb-4a7f-ba8d-45649adfa388).
--  - ON CONFLICT DO NOTHING -> safe to run more than once.
-- ============================================================================

-- ── SECTION 0: catch the live finance schema up to the app code ────────────
alter table public.fin_settings
  add column if not exists opening_balance            integer  not null default 0,
  add column if not exists anchor_date                date     not null default current_date,
  add column if not exists savings_percentage         integer  not null default 20,
  add column if not exists future_income_horizon_days integer  not null default 30,
  add column if not exists tax_rate                   numeric           default 0.18,
  add column if not exists created_at                 timestamptz not null default now();

alter table public.fin_categories
  add column if not exists kind       text    not null default 'expense',
  add column if not exists color      text,
  add column if not exists icon       text,
  add column if not exists is_default boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.fin_income
  add column if not exists source           text,
  add column if not exists notes            text,
  add column if not exists savings_reserved integer not null default 0,
  add column if not exists received         boolean not null default false,
  add column if not exists created_at       timestamptz not null default now();

alter table public.fin_recurring_bills
  add column if not exists category_id uuid,
  add column if not exists due_day     integer,
  add column if not exists autopay     boolean not null default false,
  add column if not exists active      boolean not null default true,
  add column if not exists start_date  date,
  add column if not exists end_date    date,
  add column if not exists notes       text,
  add column if not exists created_at  timestamptz not null default now();

alter table public.fin_bill_instances
  add column if not exists recurring_bill_id uuid,
  add column if not exists category_id       uuid,
  add column if not exists paid              boolean not null default false,
  add column if not exists paid_date         date,
  add column if not exists created_at        timestamptz not null default now();

alter table public.fin_expenses
  add column if not exists category_id uuid,
  add column if not exists description text,
  add column if not exists created_at  timestamptz not null default now();

-- ── SECTION 1: Settings ────────────────────────────────────────────────────
-- (omits reserve_pct / net_worth_start -> they take their column defaults)
insert into public.fin_settings
  (id, user_id, currency, tax_rate, created_at, updated_at, anchor_date, opening_balance, savings_percentage, future_income_horizon_days)
select id, user_id, currency, tax_rate, created_at, updated_at, anchor_date, opening_balance, savings_percentage, future_income_horizon_days
from jsonb_to_recordset($j$
[{"id":"b4892990-ebfa-406e-8440-31420c50094d","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","currency":"CAD","tax_rate":0.18,"created_at":"2026-06-08T00:05:21.896227+00:00","updated_at":"2026-06-08T00:05:21.896227+00:00","anchor_date":"2026-04-01","opening_balance":500000,"savings_percentage":20,"future_income_horizon_days":30}]
$j$::jsonb) as x(id uuid, user_id uuid, currency text, tax_rate numeric, created_at timestamptz, updated_at timestamptz, anchor_date date, opening_balance integer, savings_percentage integer, future_income_horizon_days integer)
on conflict (user_id) do nothing;

-- ── SECTION 2: Categories (parents of bills/expenses) ──────────────────────
insert into public.fin_categories
  (id, user_id, name, kind, color, icon, is_default, created_at)
select id, user_id, name, kind, color, icon, is_default, created_at
from jsonb_to_recordset($j$
[{"id":"8d18aab4-0095-4dca-8da8-52bc3dfe4602","icon":null,"kind":"expense","name":"Food","color":"#4ade80","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"a6473959-24b0-45fa-9fd5-ce3ec1bfdf8a","icon":null,"kind":"expense","name":"Transport","color":"#60a5fa","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"ad813103-e255-43de-a401-9c6119b9d680","icon":null,"kind":"expense","name":"Bills","color":"#f59e0b","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"b5c7a510-88e3-4547-91f5-c09d77e4687f","icon":null,"kind":"expense","name":"Entertainment","color":"#f472b6","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"617bfbe7-d0f2-47ea-8a4d-19626e5ccb70","icon":null,"kind":"expense","name":"Housing","color":"#a78bfa","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"7647556f-d1dd-46c7-8848-125bf10114a6","icon":null,"kind":"expense","name":"Car","color":"#34d399","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","icon":null,"kind":"expense","name":"Subscriptions","color":"#fb7185","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"0095ecef-7176-443a-83b3-e02f84fe1f9d","icon":null,"kind":"expense","name":"Travel","color":"#22d3ee","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"c56ba83e-4402-4a82-8684-cedf84a8626c","icon":null,"kind":"expense","name":"Other","color":"#facc15","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true},{"id":"e4a934d7-50c8-4f31-9fa2-371ada3cf6dc","icon":null,"kind":"income","name":"Income","color":"#4ade80","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","is_default":true}]
$j$::jsonb) as x(id uuid, user_id uuid, name text, kind text, color text, icon text, is_default boolean, created_at timestamptz)
on conflict (id) do nothing;

-- ── SECTION 3: Income ──────────────────────────────────────────────────────
insert into public.fin_income
  (id, user_id, amount, pay_date, source, notes, savings_reserved, received, created_at)
select id, user_id, amount, pay_date, source, notes, savings_reserved, received, created_at
from jsonb_to_recordset($j$
[{"id":"2751549e-5d40-49ce-9128-9538e6a2b518","notes":"End of April","amount":300000,"source":"Lump sum #1","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-04-30","received":true,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":60000},{"id":"ef5e3dc5-757b-413d-a275-9352f3037724","notes":"End of May","amount":300000,"source":"Lump sum #2","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-05-31","received":true,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":60000},{"id":"b1f26981-9f4b-470f-9c1c-a7c7b2e1cac7","notes":"$15k / 4mo, net 18% tax","amount":307500,"source":"Contract (Phase 1)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-07-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":61500},{"id":"bf02c044-2ff7-492c-ab99-c1bc6a1be642","notes":"$15k / 4mo, net 18% tax","amount":307500,"source":"Contract (Phase 1)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-08-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":61500},{"id":"b4070ce8-0fde-4046-aa62-594bd4a60011","notes":"40hr/wk @ $24, net 18% tax","amount":340858,"source":"Full-time salary (Phase 2)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-09-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":68172},{"id":"a5df8c18-b93b-4e2c-9e3e-ce64bcdb9523","notes":"40hr/wk @ $24, net 18% tax","amount":340858,"source":"Full-time salary (Phase 2)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-10-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":68172},{"id":"0b3969c7-f725-4766-b1e6-9d03ae59c87c","notes":"40hr/wk @ $24, net 18% tax","amount":340858,"source":"Full-time salary (Phase 2)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-11-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":68172},{"id":"b6919321-c039-4d97-869e-1560be65697b","notes":"40hr/wk @ $24, net 18% tax","amount":340858,"source":"Full-time salary (Phase 2)","user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","pay_date":"2026-12-01","received":false,"created_at":"2026-06-08T00:05:21.896227+00:00","savings_reserved":68172}]
$j$::jsonb) as x(id uuid, user_id uuid, amount integer, pay_date date, source text, notes text, savings_reserved integer, received boolean, created_at timestamptz)
on conflict (id) do nothing;

-- ── SECTION 4: Recurring bills (FK -> categories) ──────────────────────────
insert into public.fin_recurring_bills
  (id, user_id, name, amount, category_id, due_day, autopay, active, start_date, end_date, notes, created_at)
select id, user_id, name, amount, category_id, due_day, autopay, active, start_date, end_date, notes, created_at
from jsonb_to_recordset($j$
[{"id":"d8764f45-f385-46ba-9fc3-1c836994d468","name":"Rent","notes":"Marine Institute","active":true,"amount":87500,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"617bfbe7-d0f2-47ea-8a4d-19626e5ccb70"},{"id":"e109854a-411b-4747-9d4f-ae12f9c81e07","name":"Spotify","notes":"","active":true,"amount":700,"autopay":true,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059"},{"id":"f259dd76-48f5-44e8-980f-f8f541f2872b","name":"Claude Pro","notes":"","active":true,"amount":3200,"autopay":true,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059"},{"id":"9fb92f2a-9104-476e-bb1f-f0e8c77bf9ee","name":"PlayStation Plus","notes":"","active":true,"amount":2500,"autopay":true,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059"},{"id":"b4fd5d4a-a356-4d43-8d44-a1aebc40499c","name":"Phone Bill","notes":"","active":true,"amount":15000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"ad813103-e255-43de-a401-9c6119b9d680"},{"id":"fdb85e0e-9c72-4e02-9b49-e0595c9a65c3","name":"Car Insurance","notes":"","active":true,"amount":26000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"7647556f-d1dd-46c7-8848-125bf10114a6"},{"id":"86fba178-1e42-421c-a5dc-fd28f43f874e","name":"Gas","notes":"","active":true,"amount":20000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"a6473959-24b0-45fa-9fd5-ce3ec1bfdf8a"},{"id":"8d429969-c9c3-48ee-b963-89461e6062e4","name":"Groceries","notes":"","active":true,"amount":30000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"8d18aab4-0095-4dca-8da8-52bc3dfe4602"},{"id":"c966c5ee-47f5-450f-af5b-35f782dd7081","name":"Toiletries","notes":"","active":true,"amount":10000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"c56ba83e-4402-4a82-8684-cedf84a8626c"},{"id":"123ca90e-109c-47da-a0d9-68b59d88100f","name":"Fun Money","notes":"Discretionary","active":true,"amount":40000,"autopay":false,"due_day":1,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","end_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","start_date":"2026-04-01","category_id":"b5c7a510-88e3-4547-91f5-c09d77e4687f"}]
$j$::jsonb) as x(id uuid, user_id uuid, name text, amount integer, category_id uuid, due_day integer, autopay boolean, active boolean, start_date date, end_date date, notes text, created_at timestamptz)
on conflict (id) do nothing;

-- ── SECTION 5: Bill instances (FK -> categories + recurring_bills) ─────────
insert into public.fin_bill_instances
  (id, user_id, name, amount, due_date, paid, paid_date, category_id, recurring_bill_id, created_at)
select id, user_id, name, amount, due_date, paid, paid_date, category_id, recurring_bill_id, created_at
from jsonb_to_recordset($j$
[{"id":"3cc795dd-2540-43e5-b7f6-95f8b03cc156","name":"Rent","paid":false,"amount":87500,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"617bfbe7-d0f2-47ea-8a4d-19626e5ccb70","recurring_bill_id":"d8764f45-f385-46ba-9fc3-1c836994d468"},{"id":"5bf6c28c-b27b-4a86-9a2b-cb871a62aa56","name":"Rent","paid":false,"amount":87500,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"617bfbe7-d0f2-47ea-8a4d-19626e5ccb70","recurring_bill_id":"d8764f45-f385-46ba-9fc3-1c836994d468"},{"id":"a05fc772-7cd4-408f-acab-88b7c54012f2","name":"Spotify","paid":false,"amount":700,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"e109854a-411b-4747-9d4f-ae12f9c81e07"},{"id":"afe792a6-434f-4645-bda5-0ee322ad6623","name":"Spotify","paid":false,"amount":700,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"e109854a-411b-4747-9d4f-ae12f9c81e07"},{"id":"f3888322-1720-49a8-a58d-96f6e9dae110","name":"Claude Pro","paid":false,"amount":3200,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"f259dd76-48f5-44e8-980f-f8f541f2872b"},{"id":"fb2cfeed-56ff-4fbf-a0c2-b7652705df96","name":"Claude Pro","paid":false,"amount":3200,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"f259dd76-48f5-44e8-980f-f8f541f2872b"},{"id":"11b558f7-e9cf-4cce-a311-7a1ae97fbaf6","name":"PlayStation Plus","paid":false,"amount":2500,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"9fb92f2a-9104-476e-bb1f-f0e8c77bf9ee"},{"id":"d8863119-3b67-420f-a079-1a3e2bf9883a","name":"PlayStation Plus","paid":false,"amount":2500,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"46eba39c-7ec9-41aa-a122-f1b1a7583059","recurring_bill_id":"9fb92f2a-9104-476e-bb1f-f0e8c77bf9ee"},{"id":"d97da77e-9883-4529-8a15-5dd73e01b7ff","name":"Phone Bill","paid":false,"amount":15000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"ad813103-e255-43de-a401-9c6119b9d680","recurring_bill_id":"b4fd5d4a-a356-4d43-8d44-a1aebc40499c"},{"id":"519c9204-c499-4d48-abe4-ec8437d858fb","name":"Phone Bill","paid":false,"amount":15000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"ad813103-e255-43de-a401-9c6119b9d680","recurring_bill_id":"b4fd5d4a-a356-4d43-8d44-a1aebc40499c"},{"id":"3c8bd54c-bd58-46fb-812a-7253e7281bdf","name":"Car Insurance","paid":false,"amount":26000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"7647556f-d1dd-46c7-8848-125bf10114a6","recurring_bill_id":"fdb85e0e-9c72-4e02-9b49-e0595c9a65c3"},{"id":"a9c60c7a-971d-4ac2-a2dc-e8505fc3c35c","name":"Car Insurance","paid":false,"amount":26000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"7647556f-d1dd-46c7-8848-125bf10114a6","recurring_bill_id":"fdb85e0e-9c72-4e02-9b49-e0595c9a65c3"},{"id":"0fceea6c-c7de-4555-a517-5cd3bfa53bb2","name":"Gas","paid":false,"amount":20000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"a6473959-24b0-45fa-9fd5-ce3ec1bfdf8a","recurring_bill_id":"86fba178-1e42-421c-a5dc-fd28f43f874e"},{"id":"bccd371a-0f58-4099-b856-6e940794dd96","name":"Gas","paid":false,"amount":20000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"a6473959-24b0-45fa-9fd5-ce3ec1bfdf8a","recurring_bill_id":"86fba178-1e42-421c-a5dc-fd28f43f874e"},{"id":"34460f32-f0b4-4bfb-a79e-4e3f4c2e4b18","name":"Groceries","paid":false,"amount":30000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"8d18aab4-0095-4dca-8da8-52bc3dfe4602","recurring_bill_id":"8d429969-c9c3-48ee-b963-89461e6062e4"},{"id":"5af91ec8-88e6-4c63-98b0-7537b9473ca2","name":"Groceries","paid":false,"amount":30000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"8d18aab4-0095-4dca-8da8-52bc3dfe4602","recurring_bill_id":"8d429969-c9c3-48ee-b963-89461e6062e4"},{"id":"27d639db-8398-4ef7-a673-b8db78bc3a76","name":"Toiletries","paid":false,"amount":10000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"c56ba83e-4402-4a82-8684-cedf84a8626c","recurring_bill_id":"c966c5ee-47f5-450f-af5b-35f782dd7081"},{"id":"8765774f-9e5e-41eb-9bc4-d759f62b1ed2","name":"Toiletries","paid":false,"amount":10000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"c56ba83e-4402-4a82-8684-cedf84a8626c","recurring_bill_id":"c966c5ee-47f5-450f-af5b-35f782dd7081"},{"id":"56558bf5-4408-4a7e-ba9d-6638554bb048","name":"Fun Money","paid":false,"amount":40000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-06-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"b5c7a510-88e3-4547-91f5-c09d77e4687f","recurring_bill_id":"123ca90e-109c-47da-a0d9-68b59d88100f"},{"id":"19c32b61-0203-4047-a240-96b01284838b","name":"Fun Money","paid":false,"amount":40000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","due_date":"2026-07-01","paid_date":null,"created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"b5c7a510-88e3-4547-91f5-c09d77e4687f","recurring_bill_id":"123ca90e-109c-47da-a0d9-68b59d88100f"}]
$j$::jsonb) as x(id uuid, user_id uuid, name text, amount integer, due_date date, paid boolean, paid_date date, category_id uuid, recurring_bill_id uuid, created_at timestamptz)
on conflict (id) do nothing;

-- ── SECTION 6: One-off expenses (FK -> categories) ─────────────────────────
insert into public.fin_expenses
  (id, user_id, amount, date, category_id, description, created_at)
select id, user_id, amount, date, category_id, description, created_at
from jsonb_to_recordset($j$
[{"id":"91eca3ad-ed08-45ba-b967-90cb68f82933","date":"2026-04-05","amount":400000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"7647556f-d1dd-46c7-8848-125bf10114a6","description":"Car purchase — Bought before lump sum"},{"id":"f4efbdc9-6fbf-4982-98c1-bdcc304576cc","date":"2026-04-10","amount":65625,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"617bfbe7-d0f2-47ea-8a4d-19626e5ccb70","description":"Damage deposit — 75% of first month rent"},{"id":"fcce4095-fe54-4b4f-82cd-89aa71719b6a","date":"2026-05-15","amount":100000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"0095ecef-7176-443a-83b3-e02f84fe1f9d","description":"Trinidad flight — August trip"},{"id":"15ed3d4e-2377-4b50-aa36-441d97a78e30","date":"2026-08-15","amount":50000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"0095ecef-7176-443a-83b3-e02f84fe1f9d","description":"Trinidad spending money — Last 2 weeks of August"},{"id":"20195f49-a88c-441c-8ce4-a9586755e13e","date":"2026-04-28","amount":4000,"user_id":"8dcb8317-68bb-4a7f-ba8d-45649adfa388","created_at":"2026-06-08T00:05:21.896227+00:00","category_id":"b5c7a510-88e3-4547-91f5-c09d77e4687f","description":"Movie with mom"}]
$j$::jsonb) as x(id uuid, user_id uuid, amount integer, date date, category_id uuid, description text, created_at timestamptz)
on conflict (id) do nothing;

-- ── Sanity check: expect income=8, bills=10, instances=20, expenses=5 ──────
select 'settings'  as t, count(*) from public.fin_settings        where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388'
union all select 'categories', count(*) from public.fin_categories      where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388'
union all select 'income',     count(*) from public.fin_income          where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388'
union all select 'bills',      count(*) from public.fin_recurring_bills where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388'
union all select 'instances',  count(*) from public.fin_bill_instances  where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388'
union all select 'expenses',   count(*) from public.fin_expenses        where user_id='8dcb8317-68bb-4a7f-ba8d-45649adfa388';

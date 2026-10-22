-- Connected Pages Phase 1: grocery price snapshots, ingredient matches,
-- Finance grocery week budgets, Meal Plan, shopping, cost snapshots.
-- See docs/features/connected-pages.md (Design 2 and the data model drafts).
-- Idempotent. Additive only. NOT YET APPLIED (needs Scott's Supabase sign-in).
set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── Price snapshots ──────────────────────────────────────────────────────────
create table if not exists public.grocery_price_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null,
  source_ref text,
  dataset_version text,
  checksum text not null,
  captured_at timestamptz not null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  rejected_count integer not null default 0,
  status text not null default 'imported'
    check (status in ('imported', 'failed', 'superseded')),
  notes text,
  unique (user_id, checksum)
);

create table if not exists public.grocery_price_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null references public.grocery_price_imports(id) on delete cascade,
  store_key text not null,
  store_name text not null,
  external_product_key text not null,
  product_name text not null,
  normalized_name text not null,
  brand text,
  category text,
  product_url text,
  package_label text,
  unit_kind text not null check (unit_kind in ('mass', 'volume', 'count')),
  package_quantity_milliunits bigint not null check (package_quantity_milliunits > 0),
  package_price_cents integer not null check (package_price_cents >= 0),
  source_price_per_100_cents numeric(12,4),
  availability text,
  created_at timestamptz not null default now(),
  unique (import_id, store_key, external_product_key)
);

create index if not exists grocery_price_items_product_idx
  on public.grocery_price_items (user_id, store_key, external_product_key);

create table if not exists public.ingredient_product_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_ingredient text not null,
  store_key text not null,
  external_product_key text not null,
  status text not null default 'confirmed'
    check (status in ('suggested', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_ingredient, store_key)
);

-- ── Finance grocery week budgets ─────────────────────────────────────────────
create table if not exists public.grocery_budget_weeks (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  amount_cents integer not null check (amount_cents >= 0),
  finance_category text not null default 'Groceries',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- ── Recipes: structured-ingredient cutover support ───────────────────────────
alter table public.recipes
  add column if not exists ingredients_schema_version integer not null default 1,
  add column if not exists prep_profile jsonb not null default '{}'::jsonb,
  add column if not exists archived boolean not null default false;

-- ── Meal Plan ────────────────────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'completed', 'cancelled')),
  shopping_store_key text,
  shopping_store_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  planned_date date not null,
  meal_slot text not null
    check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes(id) on delete restrict,
  custom_title text,
  custom_ingredients jsonb not null default '[]'::jsonb,
  servings numeric(8,2) not null default 1 check (servings > 0),
  eat_time time,
  status text not null default 'planned'
    check (status in ('planned', 'intentional_skip', 'cooked', 'cancelled')),
  skip_reason text,
  advance_prep_kind text not null default 'none'
    check (advance_prep_kind in ('none', 'night_before', 'morning', 'lead_time')),
  advance_prep_lead_minutes integer,
  advance_prep_note text,
  food_log_id uuid references public.food_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, planned_date, meal_slot),
  check (recipe_id is not null or custom_title is not null or status = 'intentional_skip')
);

alter table public.food_logs
  add column if not exists meal_plan_item_id uuid
  references public.meal_plan_items(id) on delete set null;

create unique index if not exists food_logs_meal_plan_item_uidx
  on public.food_logs (meal_plan_item_id)
  where meal_plan_item_id is not null;

create table if not exists public.meal_plan_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  price_import_id uuid references public.grocery_price_imports(id) on delete set null,
  store_key text,
  store_name text,
  purchase_total_cents integer not null default 0,
  consumed_total_cents integer not null default 0,
  required_line_count integer not null default 0,
  priced_line_count integer not null default 0,
  coverage_status text not null default 'partial'
    check (coverage_status in ('complete', 'partial')),
  details jsonb not null default '{}'::jsonb,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null unique references public.meal_plans(id) on delete cascade,
  store_key text,
  store_name text,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plan_shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shopping_list_id uuid not null references public.meal_plan_shopping_lists(id) on delete cascade,
  ingredient_key text not null,
  display_name text not null,
  unit_kind text not null check (unit_kind in ('mass', 'volume', 'count')),
  required_quantity_milliunits bigint not null default 0,
  store_key text,
  external_product_key text,
  packages_needed integer,
  package_price_cents integer,
  purchase_cost_cents integer,
  state text not null default 'needed'
    check (state in ('needed', 'already_have', 'purchased', 'unpriced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shopping_list_id, ingredient_key, store_key, external_product_key)
);

-- ── RLS, triggers, grants (owner-only, per project convention) ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'grocery_price_imports', 'grocery_price_items', 'ingredient_product_matches',
    'grocery_budget_weeks', 'meal_plans', 'meal_plan_items',
    'meal_plan_cost_snapshots', 'meal_plan_shopping_lists', 'meal_plan_shopping_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' owner', t);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || ' owner', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'ingredient_product_matches', 'grocery_budget_weeks', 'meal_plans',
    'meal_plan_items', 'meal_plan_shopping_lists', 'meal_plan_shopping_items'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

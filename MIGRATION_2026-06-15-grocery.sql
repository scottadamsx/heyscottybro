-- ═══════════════════════════════════════════
-- Grocery + Meal Planning (grocery_* schema)
-- Idempotent. RLS owner-only on every table. Base weight unit = GRAMS.
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Stores
CREATE TABLE IF NOT EXISTS grocery_stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  website    TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
ALTER TABLE grocery_stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grocery_stores;
CREATE POLICY "owner only" ON grocery_stores USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Ingredients (abstract cooking items; base unit = grams)
CREATE TABLE IF NOT EXISTS ingredients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  category            TEXT DEFAULT '',
  avg_grams_per_count NUMERIC,             -- 1 chicken breast ~ 175; NULL if only sold by weight
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON ingredients;
CREATE POLICY "owner only" ON ingredients USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS ingredients_updated_at ON ingredients;
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS ingredients_user_idx ON ingredients (user_id, name);

-- Products (concrete store SKUs that provide an ingredient)
CREATE TABLE IF NOT EXISTS grocery_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id          UUID REFERENCES grocery_stores(id) ON DELETE SET NULL,
  ingredient_id     UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  package_grams     NUMERIC,              -- NULL for by-weight items
  is_by_weight      BOOLEAN DEFAULT FALSE,
  latest_unit_price NUMERIC,              -- price per package, or price per kg if by-weight
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE grocery_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grocery_products;
CREATE POLICY "owner only" ON grocery_products USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS grocery_products_updated_at ON grocery_products;
CREATE TRIGGER grocery_products_updated_at BEFORE UPDATE ON grocery_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS grocery_products_user_idx ON grocery_products (user_id);
CREATE INDEX IF NOT EXISTS grocery_products_ingredient_idx ON grocery_products (ingredient_id);

-- Aliases: cryptic receipt text -> product. The learning layer.
CREATE TABLE IF NOT EXISTS product_aliases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id   UUID REFERENCES grocery_stores(id) ON DELETE CASCADE,
  raw_text   TEXT NOT NULL,              -- normalized as UPPER(TRIM(text))
  product_id UUID REFERENCES grocery_products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, store_id, raw_text)
);
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON product_aliases;
CREATE POLICY "owner only" ON product_aliases USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS product_aliases_lookup_idx ON product_aliases (user_id, store_id, raw_text);

-- Receipts
CREATE TABLE IF NOT EXISTS grocery_receipts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id      UUID REFERENCES grocery_stores(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal      NUMERIC,
  total         NUMERIC,
  image_path    TEXT,                    -- path inside the 'receipts' storage bucket
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE grocery_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grocery_receipts;
CREATE POLICY "owner only" ON grocery_receipts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS grocery_receipts_user_date_idx ON grocery_receipts (user_id, purchase_date DESC);

-- Receipt line items
CREATE TABLE IF NOT EXISTS grocery_receipt_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receipt_id     UUID REFERENCES grocery_receipts(id) ON DELETE CASCADE NOT NULL,
  raw_text       TEXT NOT NULL,
  quantity       NUMERIC DEFAULT 1,
  unit_price     NUMERIC,
  total_price    NUMERIC,
  product_id     UUID REFERENCES grocery_products(id) ON DELETE SET NULL,
  resolved_grams NUMERIC,                -- grams added to pantry once resolved
  resolved       BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE grocery_receipt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grocery_receipt_items;
CREATE POLICY "owner only" ON grocery_receipt_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS grocery_receipt_items_receipt_idx ON grocery_receipt_items (receipt_id);

-- Pantry ledger: current stock per ingredient = SUM(delta_grams)
CREATE TABLE IF NOT EXISTS pantry_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE NOT NULL,
  delta_grams   NUMERIC NOT NULL,        -- positive for purchase, negative for usage
  source        TEXT NOT NULL DEFAULT 'adjustment' CHECK (source IN ('purchase','usage','adjustment')),
  reference_id  UUID,                    -- receipt id or meal_plan_item id
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pantry_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON pantry_ledger;
CREATE POLICY "owner only" ON pantry_ledger USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS pantry_ledger_ingredient_idx ON pantry_ledger (user_id, ingredient_id);

-- Recipe <-> ingredient structured link (the existing recipes table already exists)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipe_id     UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE NOT NULL,
  grams_needed  NUMERIC NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recipe_id, ingredient_id)
);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON recipe_ingredients;
CREATE POLICY "owner only" ON recipe_ingredients USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id);

-- Meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL DEFAULT 'Untitled plan',
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON meal_plans;
CREATE POLICY "owner only" ON meal_plans USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS meal_plans_user_idx ON meal_plans (user_id, week_start DESC);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_plan_id     UUID REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  recipe_id        UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  planned_servings INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON meal_plan_items;
CREATE POLICY "owner only" ON meal_plan_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS meal_plan_items_plan_idx ON meal_plan_items (meal_plan_id);

-- Receipts storage bucket (private, images). Mirrors the existing 'nutrition' bucket policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760,
        ARRAY['image/png','image/jpeg','image/webp','image/heic'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "receipts owner upload" ON storage.objects;
CREATE POLICY "receipts owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "receipts owner read" ON storage.objects;
CREATE POLICY "receipts owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "receipts owner delete" ON storage.objects;
CREATE POLICY "receipts owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Food item cache (2026-10-18): per-item nutrition database for the food log AI.
-- Each distinct food item the AI estimates is saved here after the first lookup.
-- Next time a known item is entered, estimateFood pulls from this table instead
-- of searching the web / calling the AI again.
-- NOT YET APPLIED. Apply manually in the Supabase SQL editor when approved.

CREATE TABLE IF NOT EXISTS food_item_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id      UUID REFERENCES nutrition_profiles(id) ON DELETE CASCADE NOT NULL,
  name_normalized TEXT NOT NULL,
  name_display    TEXT NOT NULL,
  calories        NUMERIC NOT NULL DEFAULT 0,
  protein_g       NUMERIC NOT NULL DEFAULT 0,
  carbs_g         NUMERIC NOT NULL DEFAULT 0,
  fat_g           NUMERIC NOT NULL DEFAULT 0,
  quantity_basis  TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'estimated',
  source_url      TEXT,
  use_count       INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_item_cache_profile_name_unique UNIQUE (profile_id, name_normalized)
);

ALTER TABLE food_item_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON food_item_cache;
CREATE POLICY "owner only" ON food_item_cache
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS food_item_cache_profile_lookup_idx
  ON food_item_cache (profile_id, name_normalized);

-- Allow 'ai-cache' as a food_logs source for rows restored from the item cache.
ALTER TABLE food_logs DROP CONSTRAINT IF EXISTS food_logs_source_check;
ALTER TABLE food_logs ADD CONSTRAINT food_logs_source_check
  CHECK (source IN ('manual', 'ai', 'ai-cache', 'photo', 'recipe'));

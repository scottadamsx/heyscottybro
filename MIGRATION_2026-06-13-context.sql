-- =================================================================
-- MIGRATION 2026-06-13: move the Context store into Supabase
--
-- Run in: Supabase dashboard > SQL Editor > New query > paste > Run
-- Project: mogoybejtmkoheqvfvuc (the one in .env)
--
-- Why: context facts were localStorage-only, so localhost and the deployed
-- web app each had their own independent set. This table makes context a
-- single synced source of truth like the rest of the planner data.
--
-- Safe to re-run.
-- =================================================================

CREATE TABLE IF NOT EXISTS context_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text        TEXT NOT NULL,
  tags        JSONB DEFAULT '[]',
  by          TEXT DEFAULT 'manual',   -- manual | frodo | scott | maria
  why         TEXT,
  ts          BIGINT,                  -- original client timestamp (ms), for ordering/de-dupe
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE context_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON context_entries;
CREATE POLICY "owner only" ON context_entries USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS context_entries_user_idx ON context_entries (user_id, created_at DESC);

-- Verify: expect one row, "ok"
SELECT 'table context_entries' AS obj, 'ok' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='context_entries');

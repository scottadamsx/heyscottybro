-- =================================================================
-- MIGRATION 2026-06-13: move Date Planner data into Supabase
--
-- Run in: Supabase dashboard > SQL Editor > New query > paste > Run
-- Project: mogoybejtmkoheqvfvuc
-- =================================================================

CREATE TABLE IF NOT EXISTS date_ideas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  emoji       TEXT DEFAULT '💖',
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE date_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON date_ideas;
CREATE POLICY "owner only" ON date_ideas USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS date_completed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  emoji       TEXT DEFAULT '💖',
  note        TEXT,
  memory      TEXT,
  done_on     DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE date_completed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON date_completed;
CREATE POLICY "owner only" ON date_completed USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Verify
SELECT 'table date_ideas' AS obj, 'ok' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='date_ideas')
UNION ALL
SELECT 'table date_completed', 'ok'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='date_completed');

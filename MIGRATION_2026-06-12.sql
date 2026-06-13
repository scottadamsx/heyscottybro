-- =================================================================
-- MIGRATION 2026-06-12: catch the live DB up to everything the app writes
--
-- Run this in: Supabase dashboard > SQL Editor > New query > paste > Run
-- Project: mogoybejtmkoheqvfvuc (the one in .env)
--
-- Why: the live project was created from an older SUPABASE_SETUP.sql, so
-- inserts carrying these columns returned 400 and silently fell back to
-- localStorage. Items appeared, then vanished on refresh.
--
-- Safe to re-run (all IF NOT EXISTS). No data is deleted: the only DROPs
-- are policy/constraint recreations, immediately re-added.
-- =================================================================

-- events: recurrence model (same as reminders)
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence  TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN IF NOT EXISTS recur_until DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recur_times INTEGER;

-- events: scheduling detail used by the calendar + agent
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost     NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS time     TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day  BOOLEAN DEFAULT FALSE;

-- reminders: tasks may have no due date (live DB had a legacy NOT NULL)
ALTER TABLE reminders ALTER COLUMN date DROP NOT NULL;

-- reminders: time/description/calendar visibility/priority/manual ordering
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS time             TIME;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN DEFAULT TRUE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS priority         TEXT DEFAULT 'none';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sort_order       INTEGER;

-- projects: sub-projects (parent_id), archive flag, due date, manual ordering
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id  UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived   BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date   DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- -----------------------------------------------------------------
-- Hiker database (bug #9: import stuck on "importing"; bugs #14/#15:
-- hike tracking & attendance). hike_attendees doesn't exist in the live
-- DB at all, so every CSV import died halfway and fell back to localStorage.

ALTER TABLE hiker_imports ADD COLUMN IF NOT EXISTS hike_name TEXT;
ALTER TABLE hiker_imports ADD COLUMN IF NOT EXISTS hike_date DATE;

CREATE TABLE IF NOT EXISTS hike_attendees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hike_import_id UUID REFERENCES hiker_imports(id) ON DELETE CASCADE NOT NULL,
  member_id      UUID REFERENCES hiker_members(id) ON DELETE CASCADE NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE hike_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON hike_attendees;
CREATE POLICY "owner only" ON hike_attendees
  USING (EXISTS (SELECT 1 FROM hiker_imports i WHERE i.id = hike_import_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM hiker_imports i WHERE i.id = hike_import_id AND i.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS hike_attendees_import_idx ON hike_attendees (hike_import_id);

-- -----------------------------------------------------------------
-- Vault prompts (bug #18): widen the snippets type whitelist so a new
-- "prompt" category can be saved. Re-runnable: drop + recreate the CHECK.
ALTER TABLE snippets DROP CONSTRAINT IF EXISTS snippets_type_check;
ALTER TABLE snippets ADD CONSTRAINT snippets_type_check
  CHECK (type IN ('code','password','wifi','card','note','prompt','other'));

-- -----------------------------------------------------------------
-- Frodo action log (bug #13): audit trail of every assistant action.
-- Created ahead of the feature so the schema is ready when the UI lands.
CREATE TABLE IF NOT EXISTS agent_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier        TEXT DEFAULT 'frodo',          -- frodo | sam | gandalf
  tool        TEXT NOT NULL,                 -- e.g. create_item, update_item
  collection  TEXT,                          -- e.g. reminders, events
  item_id     TEXT,                          -- id of the row touched (if any)
  args        JSONB,                         -- tool arguments as given
  status      TEXT NOT NULL DEFAULT 'ok',    -- ok | error
  error       TEXT,                          -- error message when status = error
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON agent_actions;
CREATE POLICY "owner only" ON agent_actions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS agent_actions_user_time_idx ON agent_actions (user_id, created_at DESC);

-- Verify: expect 22 rows, all "ok"
SELECT 'reminders.' || c AS col, 'ok' AS status
FROM unnest(ARRAY['time','description','show_on_calendar','priority','sort_order']) c
WHERE EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='reminders' AND column_name=c)
UNION ALL
SELECT 'projects.' || c, 'ok'
FROM unnest(ARRAY['parent_id','archived','due_date','sort_order']) c
WHERE EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='projects' AND column_name=c)
UNION ALL
SELECT 'events.' || c, 'ok'
FROM unnest(ARRAY['recurrence','recur_until','recur_times','cost','time','end_time','end_date','location','all_day']) c
WHERE EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='events' AND column_name=c)
UNION ALL
SELECT 'hiker_imports.' || c, 'ok'
FROM unnest(ARRAY['hike_name','hike_date']) c
WHERE EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='hiker_imports' AND column_name=c)
UNION ALL
SELECT 'table hike_attendees', 'ok'
WHERE EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='hike_attendees')
UNION ALL
SELECT 'table agent_actions', 'ok'
WHERE EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='agent_actions');

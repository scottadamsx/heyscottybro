-- ═══════════════════════════════════════════
-- heyScottyBro Planner — Supabase Schema
-- Run this in your Supabase SQL editor
-- Idempotent: safe to re-run on an existing database without losing data.
-- ═══════════════════════════════════════════

-- ⚠️ DANGER — clean-slate wipe. Only uncomment if you intend to ERASE ALL DATA.
-- DROP TABLE IF EXISTS budget_config CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS events CASCADE;
-- DROP TABLE IF EXISTS journal CASCADE;
-- DROP TABLE IF EXISTS reminders CASCADE;

-- Enable Row Level Security on all tables
-- (your user_id from Supabase Auth is stored on each row)

-- Reminders / Tasks
CREATE TABLE IF NOT EXISTS reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  date          DATE,                  -- optional: tasks may have no due date
  recurrence    TEXT DEFAULT 'none',   -- none | daily | weekly | monthly
  completed     BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON reminders;
CREATE POLICY "owner only" ON reminders USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Journal entries
CREATE TABLE IF NOT EXISTS journal (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  entry      TEXT NOT NULL,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON journal;
CREATE POLICY "owner only" ON journal USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Calendar events
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON events;
CREATE POLICY "owner only" ON events USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budget transactions
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  type        TEXT NOT NULL,           -- expense | income | future
  category    TEXT DEFAULT 'Other',
  date        DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON transactions;
CREATE POLICY "owner only" ON transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budget config (one row per user)
CREATE TABLE IF NOT EXISTS budget_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  categories     JSONB DEFAULT '["Food","Transport","Bills","Entertainment","Other"]',
  income         JSONB DEFAULT '[]',
  recurring_bills JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE budget_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON budget_config;
CREATE POLICY "owner only" ON budget_config USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════
-- Projects & Scheduling — run AFTER main setup
-- ═══════════════════════════════════════════

-- Projects (ongoing named initiatives)
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON projects;
CREATE POLICY "owner only" ON projects USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Event types (e.g. "hike", "meeting") with auto-task templates
CREATE TABLE IF NOT EXISTS event_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#22d3ee',
  -- auto_tasks: [{offset_days: -3, name: "Post preview", kind: "social"}]
  auto_tasks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON event_types;
CREATE POLICY "owner only" ON event_types USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Initiatives (recurring project-level tasks, e.g. social media posts)
CREATE TABLE IF NOT EXISTS initiatives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  recurrence  TEXT DEFAULT 'weekly',   -- daily | weekly | monthly
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON initiatives;
CREATE POLICY "owner only" ON initiatives USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Extend reminders with project linkage and limited recurrence
ALTER TABLE reminders ALTER COLUMN date DROP NOT NULL;  -- allow tasks without a due date
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_until   DATE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_times   INTEGER;
-- Columns the UI already writes (must exist or inserts fail)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS time             TIME;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN DEFAULT TRUE;
-- Future-proofing: priority + manual ordering
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS priority   TEXT DEFAULT 'none' CHECK (priority IN ('none','low','medium','high'));
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Extend events with project and event type linkage
ALTER TABLE events ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost          NUMERIC DEFAULT 0;
-- Future-proofing: times, multi-day events, location
ALTER TABLE events ADD COLUMN IF NOT EXISTS time      TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time  TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date  DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location  TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day   BOOLEAN DEFAULT TRUE;

-- Future-proofing: journal tags + mood
ALTER TABLE journal ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE journal ADD COLUMN IF NOT EXISTS mood TEXT;

-- Future-proofing: project lifecycle
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived   BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date   DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Indexes for the common "my stuff by date" queries
CREATE INDEX IF NOT EXISTS reminders_user_date_idx    ON reminders (user_id, date);
CREATE INDEX IF NOT EXISTS reminders_user_project_idx ON reminders (user_id, project_id);
CREATE INDEX IF NOT EXISTS events_user_date_idx       ON events (user_id, date);
CREATE INDEX IF NOT EXISTS journal_user_date_idx      ON journal (user_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, date DESC);

-- ═══════════════════════════════════════════
-- SJHC Hiker Database
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hiker_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first         TEXT NOT NULL,
  last          TEXT NOT NULL,
  email         TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  attendance    INTEGER DEFAULT 1,
  joined_date   DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, first, last)
);
ALTER TABLE hiker_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON hiker_members;
CREATE POLICY "owner only" ON hiker_members USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS hiker_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename        TEXT,
  imported_at     DATE,
  first_timers    INTEGER DEFAULT 0,
  returning_count INTEGER DEFAULT 0,
  total           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE hiker_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON hiker_imports;
CREATE POLICY "owner only" ON hiker_imports USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Hike metadata + per-hike attendance (matches live schema)
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

-- ═══════════════════════════════════════════
-- Budget Rewrite Migration (Apr 2026 — 9-month plan)
-- Idempotent: safe to run multiple times.
-- Resolves user_id from auth.users by email.
-- ═══════════════════════════════════════════

-- Rename income → income_sources if the old column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_config' AND column_name = 'income'
  ) THEN
    ALTER TABLE budget_config RENAME COLUMN income TO income_sources;
  END IF;
END $$;

-- Add projection/config columns
ALTER TABLE budget_config ADD COLUMN IF NOT EXISTS income_sources   JSONB  DEFAULT '[]';
ALTER TABLE budget_config ADD COLUMN IF NOT EXISTS tax_rate         NUMERIC DEFAULT 0.18;
ALTER TABLE budget_config ADD COLUMN IF NOT EXISTS starting_balance NUMERIC DEFAULT 0;

-- Link a real transaction to the recurring bill or income source it fulfills
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fulfills_recurring_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fulfills_income_id    TEXT;

-- Seed the plan for scottadamsx@gmail.com
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'scottadamsx@gmail.com' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found — skipping budget seed';
    RETURN;
  END IF;

  -- Config (upsert)
  INSERT INTO budget_config (user_id, categories, income_sources, recurring_bills, tax_rate, starting_balance)
  VALUES (
    v_user_id,
    '["Food","Transport","Bills","Entertainment","Housing","Car","Subscriptions","Travel","Other"]'::jsonb,
    '[
      {"id":"inc-contract","name":"Contract (Phase 1)","amount":3075.00,"frequency":"monthly","startDate":"2026-04-01","endDate":"2026-08-31","notes":"$15k / 4mo, net 18% tax"},
      {"id":"inc-salary","name":"Full-time salary (Phase 2)","amount":3408.58,"frequency":"monthly","startDate":"2026-09-01","endDate":null,"notes":"40hr/wk @ $24, net 18% tax"}
    ]'::jsonb,
    '[
      {"id":"rb-rent","name":"Rent — Marine Institute","amount":875.00,"category":"Housing","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":"2-person room"},
      {"id":"rb-spotify","name":"Spotify","amount":7.00,"category":"Subscriptions","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":true,"notes":""},
      {"id":"rb-claude","name":"Claude Pro","amount":32.00,"category":"Subscriptions","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":true,"notes":""},
      {"id":"rb-psn","name":"PlayStation Plus","amount":25.00,"category":"Subscriptions","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":true,"notes":""},
      {"id":"rb-phone","name":"Phone Bill","amount":150.00,"category":"Bills","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":""},
      {"id":"rb-carins","name":"Car Insurance","amount":200.00,"category":"Car","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":"Starts once moved in"},
      {"id":"rb-gas","name":"Gas","amount":200.00,"category":"Transport","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":""},
      {"id":"rb-groceries","name":"Groceries","amount":300.00,"category":"Food","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":""},
      {"id":"rb-toiletries","name":"Toiletries","amount":100.00,"category":"Other","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":""},
      {"id":"rb-fun","name":"Fun Money","amount":400.00,"category":"Entertainment","frequency":"monthly","startDate":"2026-04-01","endDate":null,"autoPay":false,"notes":"Discretionary"}
    ]'::jsonb,
    0.18,
    5000.00
  )
  ON CONFLICT (user_id) DO UPDATE SET
    categories       = EXCLUDED.categories,
    income_sources   = EXCLUDED.income_sources,
    recurring_bills  = EXCLUDED.recurring_bills,
    tax_rate         = EXCLUDED.tax_rate,
    starting_balance = EXCLUDED.starting_balance;

  -- Known one-time transactions (amounts signed: expense negative, income positive)
  -- Each guarded with WHERE NOT EXISTS so re-runs don't duplicate.
  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Car purchase', -4000.00, 'future', 'Car', '2026-04-05', 'Bought before lump sum arrived'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Car purchase' AND date = '2026-04-05');

  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Damage deposit — MI', -656.25, 'future', 'Housing', '2026-04-10', '75% of $875 rent'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Damage deposit — MI' AND date = '2026-04-10');

  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Lump sum #1', 3000.00, 'income', 'Other', '2026-04-30', 'End of April'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Lump sum #1' AND date = '2026-04-30');

  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Lump sum #2', 3000.00, 'income', 'Other', '2026-05-31', 'End of May'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Lump sum #2' AND date = '2026-05-31');

  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Trinidad flight', -1000.00, 'expense', 'Travel', '2026-05-15', 'August trip'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Trinidad flight' AND date = '2026-05-15');

  INSERT INTO transactions (user_id, description, amount, type, category, date, notes)
  SELECT v_user_id, 'Trinidad spending money', -500.00, 'expense', 'Travel', '2026-08-15', 'Last 2 weeks of August'
  WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND description = 'Trinidad spending money' AND date = '2026-08-15');
END $$;

-- ═══════════════════════════════════════════
-- Shared trigger helper (used by several features below)
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ═══════════════════════════════════════════
-- Vault / Snippets  (June 2026)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS snippets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT        NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  value       TEXT        NOT NULL CHECK (char_length(value) >= 1),
  type        TEXT        NOT NULL DEFAULT 'other'
                          CHECK (type IN ('code','password','wifi','card','note','other')),
  secret      BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON snippets;
CREATE POLICY "owner only" ON snippets USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS snippets_updated_at ON snippets;
CREATE TRIGGER snippets_updated_at BEFORE UPDATE ON snippets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS snippets_user_id_idx    ON snippets (user_id);
CREATE INDEX IF NOT EXISTS snippets_user_type_idx  ON snippets (user_id, type);
CREATE INDEX IF NOT EXISTS snippets_created_at_idx ON snippets (user_id, created_at DESC);

-- ═══════════════════════════════════════════
-- Documents + share links  (June 2026)
-- Private storage bucket 'documents'; public shares served via Vercel function
-- /api/doc-signed-url using the service-role key.
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  description   TEXT DEFAULT '',
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON documents;
CREATE POLICY "owner only" ON documents USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS document_shares (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  token             TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_email TEXT,
  expires_at        TIMESTAMPTZ,
  accessed_at       TIMESTAMPTZ,
  access_count      INTEGER DEFAULT 0,
  revoked           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manage shares" ON document_shares;
CREATE POLICY "owner manage shares" ON document_shares USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE INDEX IF NOT EXISTS document_shares_token_idx ON document_shares (token);
CREATE INDEX IF NOT EXISTS document_shares_doc_idx   ON document_shares (document_id);
CREATE INDEX IF NOT EXISTS documents_user_idx        ON documents (user_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800,
  ARRAY['application/pdf','image/png','image/jpeg','image/gif','image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "documents owner upload" ON storage.objects;
CREATE POLICY "documents owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "documents owner read" ON storage.objects;
CREATE POLICY "documents owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "documents owner delete" ON storage.objects;
CREATE POLICY "documents owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════
-- Nutrition: profiles, food logs, weight logs  (June 2026)
-- Two profiles (you + partner) under one account. Private 'nutrition' bucket for photos.
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nutrition_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  emoji           TEXT DEFAULT '🙂',
  color           TEXT DEFAULT '#6366f1',
  sex             TEXT CHECK (sex IN ('male','female','other')),
  height_cm       NUMERIC,
  birth_year      INTEGER,
  activity_level  TEXT DEFAULT 'moderate' CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  goal            TEXT DEFAULT 'maintain' CHECK (goal IN ('lose','maintain','gain')),
  target_calories INTEGER,
  start_weight_kg NUMERIC,
  goal_weight_kg  NUMERIC,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON nutrition_profiles;
CREATE POLICY "owner only" ON nutrition_profiles USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS food_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id   UUID REFERENCES nutrition_profiles(id) ON DELETE CASCADE NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type    TEXT DEFAULT 'snack' CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  calories     NUMERIC NOT NULL DEFAULT 0,
  protein_g    NUMERIC DEFAULT 0,
  carbs_g      NUMERIC DEFAULT 0,
  fat_g        NUMERIC DEFAULT 0,
  quantity     NUMERIC DEFAULT 1,
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual','ai','photo','recipe')),
  image_path   TEXT,
  items        JSONB DEFAULT '[]',
  recipe_id    UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON food_logs;
CREATE POLICY "owner only" ON food_logs USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS food_logs_profile_date_idx ON food_logs (profile_id, date DESC);
CREATE INDEX IF NOT EXISTS food_logs_user_idx ON food_logs (user_id, date DESC);

CREATE TABLE IF NOT EXISTS weight_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id  UUID REFERENCES nutrition_profiles(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg   NUMERIC NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, date)
);
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON weight_logs;
CREATE POLICY "owner only" ON weight_logs USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS weight_logs_profile_date_idx ON weight_logs (profile_id, date DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('nutrition', 'nutrition', false, 10485760,
        ARRAY['image/png','image/jpeg','image/webp','image/gif','image/heic'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "nutrition owner upload" ON storage.objects;
CREATE POLICY "nutrition owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nutrition' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "nutrition owner read" ON storage.objects;
CREATE POLICY "nutrition owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nutrition' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "nutrition owner delete" ON storage.objects;
CREATE POLICY "nutrition owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nutrition' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════
-- Recipes (AI + manual)  (June 2026)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recipes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT DEFAULT '',
  servings             INTEGER DEFAULT 1,
  prep_minutes         INTEGER DEFAULT 0,
  cook_minutes         INTEGER DEFAULT 0,
  ingredients          JSONB DEFAULT '[]',
  steps                JSONB DEFAULT '[]',
  calories_per_serving NUMERIC DEFAULT 0,
  protein_g            NUMERIC DEFAULT 0,
  carbs_g              NUMERIC DEFAULT 0,
  fat_g                NUMERIC DEFAULT 0,
  tags                 TEXT[] DEFAULT '{}',
  image_path           TEXT,
  source               TEXT DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  favorite             BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON recipes;
CREATE POLICY "owner only" ON recipes USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS recipes_updated_at ON recipes;
CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS recipes_user_idx ON recipes (user_id, created_at DESC);

-- ═══════════════════════════════════════════
-- Finance  (fin_* schema)
-- Idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════

-- Settings (one row per user)
CREATE TABLE IF NOT EXISTS fin_settings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  currency        TEXT        NOT NULL DEFAULT 'CAD',
  reserve_pct     NUMERIC     NOT NULL DEFAULT 0.20,   -- fraction of income auto-reserved
  net_worth_start NUMERIC     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_settings;
CREATE POLICY "owner only" ON fin_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Categories (expense / income buckets)
CREATE TABLE IF NOT EXISTS fin_categories (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name    TEXT NOT NULL,
  kind    TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','income')),
  color   TEXT DEFAULT '#6366f1',
  icon    TEXT DEFAULT ''
);
ALTER TABLE fin_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_categories;
CREATE POLICY "owner only" ON fin_categories USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_categories_user_idx ON fin_categories (user_id);

-- Income records
CREATE TABLE IF NOT EXISTS fin_income (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount   NUMERIC     NOT NULL,
  pay_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  source   TEXT        DEFAULT '',
  notes    TEXT        DEFAULT '',
  received BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_income;
CREATE POLICY "owner only" ON fin_income USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_income_user_date_idx ON fin_income (user_id, pay_date DESC);

-- Recurring bills (templates)
CREATE TABLE IF NOT EXISTS fin_recurring_bills (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT    NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  due_day     INTEGER NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  category_id UUID    REFERENCES fin_categories(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  auto_pay    BOOLEAN NOT NULL DEFAULT false,
  notes       TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_recurring_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_recurring_bills;
CREATE POLICY "owner only" ON fin_recurring_bills USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_recurring_bills_user_idx ON fin_recurring_bills (user_id);

-- Bill instances (one per bill per month, or one-off)
CREATE TABLE IF NOT EXISTS fin_bill_instances (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recurring_bill_id   UUID    REFERENCES fin_recurring_bills(id) ON DELETE SET NULL,
  name                TEXT    NOT NULL,
  amount              NUMERIC NOT NULL DEFAULT 0,
  due_date            DATE    NOT NULL,
  category_id         UUID    REFERENCES fin_categories(id) ON DELETE SET NULL,
  paid                BOOLEAN NOT NULL DEFAULT false,
  paid_date           DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_bill_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_bill_instances;
CREATE POLICY "owner only" ON fin_bill_instances USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_bill_instances_user_date_idx ON fin_bill_instances (user_id, due_date);

-- Expenses
CREATE TABLE IF NOT EXISTS fin_expenses (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount      NUMERIC NOT NULL,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID    REFERENCES fin_categories(id) ON DELETE SET NULL,
  description TEXT    NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_expenses;
CREATE POLICY "owner only" ON fin_expenses USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_expenses_user_date_idx ON fin_expenses (user_id, date DESC);

-- Savings goals
CREATE TABLE IF NOT EXISTS fin_savings_goals (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name           TEXT    NOT NULL,
  target_amount  NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  due_date       DATE,
  notes          TEXT    DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_savings_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_savings_goals;
CREATE POLICY "owner only" ON fin_savings_goals USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_savings_goals_user_idx ON fin_savings_goals (user_id);

-- Savings allocations
CREATE TABLE IF NOT EXISTS fin_savings_allocations (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID    REFERENCES fin_savings_goals(id) ON DELETE CASCADE NOT NULL,
  amount  NUMERIC NOT NULL,
  source  TEXT    NOT NULL DEFAULT 'pool',
  date    DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_savings_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_savings_allocations;
CREATE POLICY "owner only" ON fin_savings_allocations USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_savings_alloc_goal_idx ON fin_savings_allocations (goal_id);

-- Debts
CREATE TABLE IF NOT EXISTS fin_debts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT    NOT NULL,
  principal       NUMERIC NOT NULL DEFAULT 0,   -- original balance
  balance         NUMERIC NOT NULL DEFAULT 0,   -- current remaining
  interest_rate   NUMERIC NOT NULL DEFAULT 0,   -- APR as decimal (e.g. 0.19)
  minimum_payment NUMERIC NOT NULL DEFAULT 0,
  due_day         INTEGER DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  notes           TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_debts;
CREATE POLICY "owner only" ON fin_debts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_debts_user_idx ON fin_debts (user_id);

-- Debt payments
CREATE TABLE IF NOT EXISTS fin_debt_payments (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  debt_id   UUID    REFERENCES fin_debts(id) ON DELETE CASCADE NOT NULL,
  amount    NUMERIC NOT NULL,
  principal NUMERIC NOT NULL DEFAULT 0,
  interest  NUMERIC NOT NULL DEFAULT 0,
  date      DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fin_debt_payments;
CREATE POLICY "owner only" ON fin_debt_payments USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fin_debt_payments_debt_idx ON fin_debt_payments (debt_id, date DESC);

-- ── RPCs ──────────────────────────────────────────────────────────────

-- fin_add_income: insert income row and return it
CREATE OR REPLACE FUNCTION fin_add_income(
  p_amount   NUMERIC,
  p_pay_date DATE,
  p_source   TEXT    DEFAULT NULL,
  p_notes    TEXT    DEFAULT NULL,
  p_received BOOLEAN DEFAULT false
)
RETURNS fin_income LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row     fin_income;
BEGIN
  INSERT INTO fin_income (user_id, amount, pay_date, source, notes, received)
  VALUES (v_user_id, p_amount, p_pay_date, COALESCE(p_source,''), COALESCE(p_notes,''), p_received)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- fin_generate_bill_instances: create instances for active recurring bills in a given month
CREATE OR REPLACE FUNCTION fin_generate_bill_instances(p_month DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bill    fin_recurring_bills;
  v_count   INTEGER := 0;
  v_due     DATE;
  v_last    DATE;
BEGIN
  v_last := (date_trunc('month', p_month) + interval '1 month - 1 day')::DATE;
  FOR v_bill IN
    SELECT * FROM fin_recurring_bills WHERE user_id = v_user_id AND active = true
  LOOP
    -- Clamp due_day to actual last day of month
    v_due := date_trunc('month', p_month)::DATE + LEAST(v_bill.due_day, EXTRACT(DAY FROM v_last)::INTEGER) - 1;
    -- Skip if already exists for this bill+month
    IF NOT EXISTS (
      SELECT 1 FROM fin_bill_instances
      WHERE user_id = v_user_id
        AND recurring_bill_id = v_bill.id
        AND date_trunc('month', due_date) = date_trunc('month', p_month)
    ) THEN
      INSERT INTO fin_bill_instances (user_id, recurring_bill_id, name, amount, due_date, category_id, paid)
      VALUES (v_user_id, v_bill.id, v_bill.name, v_bill.amount, v_due, v_bill.category_id, false);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- fin_allocate_to_goal: add amount to savings goal
CREATE OR REPLACE FUNCTION fin_allocate_to_goal(
  p_goal_id UUID,
  p_amount  NUMERIC,
  p_source  TEXT DEFAULT 'pool'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO fin_savings_allocations (user_id, goal_id, amount, source)
  VALUES (v_user_id, p_goal_id, p_amount, p_source);
  UPDATE fin_savings_goals SET current_amount = current_amount + p_amount WHERE id = p_goal_id AND user_id = v_user_id;
END;
$$;

-- fin_record_debt_payment: record payment and reduce debt balance
CREATE OR REPLACE FUNCTION fin_record_debt_payment(
  p_debt_id  UUID,
  p_amount   NUMERIC,
  p_principal NUMERIC DEFAULT NULL,
  p_interest  NUMERIC DEFAULT 0,
  p_date      DATE    DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_principal NUMERIC := COALESCE(p_principal, p_amount);
BEGIN
  INSERT INTO fin_debt_payments (user_id, debt_id, amount, principal, interest, date)
  VALUES (v_user_id, p_debt_id, p_amount, v_principal, p_interest, COALESCE(p_date, CURRENT_DATE));
  UPDATE fin_debts SET balance = GREATEST(0, balance - v_principal) WHERE id = p_debt_id AND user_id = v_user_id;
END;
$$;

-- fin_soft_reset: clear transactional data, keep recurring bills & settings
CREATE OR REPLACE FUNCTION fin_soft_reset()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  DELETE FROM fin_income WHERE user_id = v_user_id;
  DELETE FROM fin_bill_instances WHERE user_id = v_user_id;
  DELETE FROM fin_expenses WHERE user_id = v_user_id;
  DELETE FROM fin_savings_allocations WHERE user_id = v_user_id;
  DELETE FROM fin_debt_payments WHERE user_id = v_user_id;
  UPDATE fin_savings_goals SET current_amount = 0 WHERE user_id = v_user_id;
  UPDATE fin_debts SET balance = principal WHERE user_id = v_user_id;
END;
$$;

-- fin_factory_reset: wipe everything for the user
CREATE OR REPLACE FUNCTION fin_factory_reset()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  DELETE FROM fin_debt_payments WHERE user_id = v_user_id;
  DELETE FROM fin_debts WHERE user_id = v_user_id;
  DELETE FROM fin_savings_allocations WHERE user_id = v_user_id;
  DELETE FROM fin_savings_goals WHERE user_id = v_user_id;
  DELETE FROM fin_expenses WHERE user_id = v_user_id;
  DELETE FROM fin_bill_instances WHERE user_id = v_user_id;
  DELETE FROM fin_recurring_bills WHERE user_id = v_user_id;
  DELETE FROM fin_income WHERE user_id = v_user_id;
  DELETE FROM fin_categories WHERE user_id = v_user_id;
  DELETE FROM fin_settings WHERE user_id = v_user_id;
END;
$$;

-- ── Hardening (Supabase advisor fixes) ────────────────────────────────
-- Pin search_path on helper/RPC functions and keep finance RPCs
-- (SECURITY DEFINER) away from the anon role — they're authed-only.
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_updated_at','update_updated_at','fin_seed_categories',
                        'fin_add_income','fin_generate_bill_instances','fin_allocate_to_goal',
                        'fin_record_debt_payment','fin_soft_reset','fin_factory_reset',
                        'get_user_org_id','get_user_role')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.sig);
  END LOOP;

  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'fin\_%' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
  END LOOP;
END $$;

-- Default settings row (upsert so re-runs are safe)
-- Must be run after a user exists. Uncomment and fill in your user ID if you want a seed row:
-- INSERT INTO fin_settings (user_id) VALUES ('<your-user-uuid>') ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Migration (2026-06-12): recurring events
-- Events gain the same recurrence model reminders already use, so the
-- AI agent and the calendar can create "weekly until <date>" events.
-- Safe to re-run.
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence  TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN IF NOT EXISTS recur_until DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recur_times INTEGER;

-- ─────────────────────────────────────────────────────────────────
-- Migration (2026-06-12): catch the live DB up to everything the app writes.
-- The deployed project was created from an older version of this file, so
-- inserts carrying these columns 400'd and silently fell back to localStorage.
-- Safe to re-run (all IF NOT EXISTS).

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

-- events: scheduling detail used by the calendar + agent
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost     NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS time     TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day  BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- storage_usage(): exposes database + file-storage sizes to the app via RPC.
-- Returns only names + byte counts (no row data). See the Storage card on the
-- admin dashboard. Restricted to signed-in users.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (
      SELECT coalesce(json_agg(t ORDER BY t.bytes DESC), '[]'::json)
      FROM (SELECT relname AS name, pg_total_relation_size(relid) AS bytes
            FROM pg_catalog.pg_statio_user_tables) t
    ),
    'buckets', (
      SELECT coalesce(json_agg(b ORDER BY b.bytes DESC), '[]'::json)
      FROM (SELECT bucket_id AS name, count(*) AS files,
                   coalesce(sum((metadata->>'size')::bigint), 0) AS bytes
            FROM storage.objects GROUP BY bucket_id) b
    ),
    'measured_at', now()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.storage_usage() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.storage_usage() TO authenticated;


-- ═══ Grocery + Meal Planning (appended 2026-06-15) ═══
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

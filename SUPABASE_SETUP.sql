-- ═══════════════════════════════════════════
-- heyScottyBro Planner — Supabase Schema
-- Run this in your Supabase SQL editor
-- ═══════════════════════════════════════════

-- Drop existing tables (clean slate)
DROP TABLE IF EXISTS budget_config CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS journal CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;

-- Enable Row Level Security on all tables
-- (your user_id from Supabase Auth is stored on each row)

-- Reminders / Tasks
CREATE TABLE reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  recurrence    TEXT DEFAULT 'none',   -- none | daily | weekly | monthly
  completed     BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON reminders USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Journal entries
CREATE TABLE journal (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  entry      TEXT NOT NULL,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON journal USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Calendar events
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON events USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budget transactions
CREATE TABLE transactions (
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
CREATE POLICY "owner only" ON transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budget config (one row per user)
CREATE TABLE budget_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  categories     JSONB DEFAULT '["Food","Transport","Bills","Entertainment","Other"]',
  income         JSONB DEFAULT '[]',
  recurring_bills JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE budget_config ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "owner only" ON initiatives USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Extend reminders with project linkage and limited recurrence
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_until   DATE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recur_times   INTEGER;

-- Extend events with project and event type linkage
ALTER TABLE events ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL;

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
CREATE POLICY "owner only" ON hiker_members USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS hiker_imports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename      TEXT,
  imported_at   DATE,
  first_timers  INTEGER DEFAULT 0,
  returning     INTEGER DEFAULT 0,
  total         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE hiker_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON hiker_imports USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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

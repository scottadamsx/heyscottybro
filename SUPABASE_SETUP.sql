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

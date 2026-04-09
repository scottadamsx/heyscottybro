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

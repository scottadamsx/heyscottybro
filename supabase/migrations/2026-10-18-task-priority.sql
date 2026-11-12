-- Add priority field to reminders (tasks)
-- Migration: 2026-10-18-task-priority

ALTER TABLE reminders
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high'));

-- Set default for existing rows
UPDATE reminders SET priority = 'medium' WHERE priority IS NULL;

-- Index for filtering by priority
CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority);

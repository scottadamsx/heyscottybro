-- Phase 1 (2026-09-06): link auto-generated tasks to the event that made them.
-- Deleting an event now deletes its tasks (the app also does this explicitly,
-- so a DB that hasn't run this yet only loses the link, loudly, not the insert).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS reminders_event_id_idx ON reminders (event_id);

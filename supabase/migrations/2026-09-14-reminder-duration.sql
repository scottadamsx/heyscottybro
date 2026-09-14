-- 2026-09-14: time-boxing. A task can carry how long Scott thinks it will
-- take, so the "Fit it in" dialog can place it on the day's timeline.
-- Minutes, 1..1440; NULL = not estimated (the app treats that as 30).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS duration_min INTEGER
  CHECK (duration_min IS NULL OR (duration_min > 0 AND duration_min <= 1440));

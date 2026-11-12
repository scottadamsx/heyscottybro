# Feature: Task Priority Field

## Plan
Add a `priority` field to tasks (reminders table) with three levels: Low, Medium, High.

## Pseudocode
1. Migration: ALTER TABLE reminders ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))
2. TaskFormModal: Add priority dropdown (Low/Medium/High) next to recurrence/project selectors
3. TaskDetailPage: Show priority badge in the badges row (color-coded: red for high, yellow for medium, gray for low)
4. taskToForm: Include priority in form mapping
5. fieldsFromForm: Include priority in save payload
6. plannerApi: carry `priority` through `reminderRow` (create) and the
   `updateReminder` whitelist (edit), using the existing missing-column
   fallback so task saves still succeed before the migration is applied
   (the save reports `priority` in `dropped`, like `duration_min`).

## Steps
- [x] Create migration SQL (`supabase/migrations/2026-10-18-task-priority.sql`)
- [x] Update TaskFormModal.jsx (dropdown, form mapping, save payload)
- [x] Update TaskDetailPage.jsx (priority badges)
- [x] Update plannerApi.js save path (create + edit, missing-column tolerant)
- [ ] Run migration on Supabase — BLOCKED 2026-10-22: no authenticated
      Supabase session is available to the agent environment (no CLI token,
      dashboard needs Scott's sign-in). Until it is applied, the form and
      badges ship inert: saves succeed with priority dropped, and no badge
      renders because stored rows have no priority yet.
- [ ] Verify in UI — after the migration is applied, set the Leo's
      Restaurant task (`4a77d218-e2f6-415b-9e4e-57eb17ac264e`) to high and
      confirm the badge and edit round trip.
- [ ] Completion document

## Build record (2026-10-22)

Shipped under Scott's "go on all items" (2026-10-22). Code, migration source,
and this record committed and pushed; the migration itself awaits Scott's
Supabase sign-in, per the blocked step above.

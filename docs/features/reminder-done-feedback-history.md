# Reminder Done feedback, no accidental future completions, and revertable history

Status: implemented 2026-11-26 (history storage needs the migration below run before it records in production).

## Problem (BUG-102, reported by Scott 2026-11-17)

Scott clicked Done on the daily "Log last night's sleep" reminder about six times because the button gave no feedback that the click registered. Each click completed another future occurrence, leaving the reminder showing last done Friday Nov 20th and next due Saturday Nov 21st.

## Behaviour

1. **Immediate feedback.** The Done button (Tasks list and task detail) disables while the completion is saving, shows a spinner and "Saving…", then a visible check state, with a success toast in the list. One click is obviously enough.
2. **Done never completes a future occurrence.** `completeReminder` refuses a recurring occurrence dated after today unless the caller passes `{ early: true }`. When a recurring task's pending occurrence is in the future, the UI shows a separate **Do early** button (same pattern as habits, commit 9d84ccd) instead of Done. Overdue and due-today occurrences still complete through Done.
3. **Action history with revert.** Every create, edit, completion (including reopen) and delete of a reminder is recorded in a new `reminder_history` table with before/after snapshots. The task detail page gains a History section listing the changes newest first; the newest unreverted change can be reverted, which restores its before snapshot (a completion revert restores the previous `completed` / `completed_date`, so last done and next due return to what they were). Reverts unwind newest first so a chain of accidental completions restores step by step.

## Pseudocode

```
completeReminder(id, occurrenceDate, opts):
  row = read reminder
  target = occurrenceDate or today
  if row recurs and target > today and not opts.early: throw "not due yet"
  patch = existing patchFor(row)          # unchanged maths
  write patch
  record history { action: completed|completed_early, before: {completed, completed_date}, after: patch }

updateReminder / newReminders / deleteReminder:
  capture before snapshot (changed keys only for edits; full row for delete)
  write as today
  record history { action: edited|created|deleted, before, after }

revertReminderHistory(entryId):
  entry = read entry; fail unless it is the newest unreverted entry for the reminder
  completed|edited -> write entry.before fields back onto the reminder
  created          -> delete the reminder
  deleted          -> re-insert entry.before row
  mark entry reverted_at = now
```

Recording is best-effort: if the `reminder_history` table is missing (migration not yet run) the change itself still succeeds and a single console warning names the migration, matching the Projects 2.0 missing-table pattern. Local mode stores history in the local store instead.

## Steps

- [x] Migration file `supabase/migrations/2026-11-26-reminder-history.sql` (NOT applied; Scott runs migrations).
- [x] `plannerUtils.isEarlyCompletion` + unit tests.
- [x] `plannerApi`: early guard, history record/load/revert, hooks in complete/update/new/delete.
- [x] `RemindersPage`: busy + done-flash feedback, Do early button, success toast.
- [x] `TaskDetailPage`: busy feedback, Do early button, History section with revert.
- [x] `plan.css`: done-flash and history row styles.
- [x] BUGS.md BUG-102, WORKLOG.md, CHANGELOG.md entries.
- [x] Validation: plannerUtils tests, ESLint on changed files, production build.

## Acceptance check

- Clicking Done once on a due-today reminder marks only today's occurrence done; the button visibly responds on the first click; further clicks do nothing to future occurrences (the button becomes Do early and the API refuses without the early flag).
- After a repeat-click accident, opening the task's History and reverting the extra completions restores the previous last done and next due dates with no database edit. (Live once the migration is run; before that the History section says recording is not turned on yet.)

# Habit schedules: due days, streaks, and where habits appear

Status: implemented 2026-11-16 (BUG-101), on Scott's direct instruction in chat
("fix it, push and everything, look for other bugs too"), which is the
approval of record for this change.

## The contract

A scheduled habit exists in the UI only on its days:

- **Due** means: today is one of the habit's cadence days and it is not yet
  handled. Cadence days start at the schedule's `startDate` and step by the
  interval (every N days or weeks). Handling the habit (a log, or "Missed
  it") re-anchors the cadence to the handled day; a log dated before its
  cadence day counts as doing that occurrence early.
- An occurrence that passes unhandled is **skipped**: it does not carry over
  as overdue, does not appear on later days, and is not recorded as a miss.
  The habit returns on its next cadence day.
- A **streak** counts consecutive handled cadence days. Days the habit was
  never scheduled can neither build nor break it; today still in progress
  does not break it. A skipped or explicitly missed cadence day does.
- Trackers with no schedule (tallies) have no due days: they never appear in
  due lists, and their streak stays the plain calendar-day streak.

## Where it applies

One shared calculation in `src/utils/habitSchedule.js`
(`habitOccurrences`, `dueHabits`, `habitStreak`, `nextHabitDueDate`) feeds
every surface:

- Reminders page "Habits due" card (`dueHabits`).
- Today page Habits card: only habits due today, handled today, or
  unscheduled are listed.
- Habits page: streaks come from `habitStreak`; a scheduled habit that is
  not due today shows "Next due …" instead of Mark done / "Missed it"
  controls for today.

## Pseudocode

```
occurrences(state, tracker, today):
  if schedule is none: return []
  step = every * (unit == weeks ? 7 : 1)
  handled = { date: done|missed } from logs and misses, startDate..today
  next = startDate
  for date in sorted(handled):
    while next < date: emit(next, skipped); next += step
    if next == date: emit(date, handled[date])
    else: emit(next, handled[date], handledOn=date)   # done early
    next = date + step
  while next < today: emit(next, skipped); next += step
  if next == today: emit(today, due)
dueHabits = trackers with a "due" occurrence today
streak = trailing "done" occurrences, ignoring a trailing "due"
```

## Agent-created habits

The assistant contract for the habits collection now includes `schedule`,
and the library create/update paths validate and keep it. Before this, a
habit created by talking to Frodo silently became a daily habit no matter
what was asked for.

# Feature: Hourly day calendar beside day modal

**Status:** Complete — commit approved
**Owner:** Scott
**Started:** 2026-09-28

## User problem

Opening a day or choosing a date does not consistently show what is already scheduled that day. Scott must leave the current context or remember the schedule before assigning a time.

## Desired outcome

When a day is opened from the Planner, show its complete hourly schedule beside the day modal so existing commitments are visible without leaving the task.

## Requested reference

Reuse the interaction language of the existing **Fit it in** schedule panel, including positioned events such as “Gym, 4:30–6:00 PM” and “Minecraft with Carter, 10:00–11:00 PM.”

## Current behavior and findings

- `CalendarPage.jsx` opens one day in a 480 px details modal. It already expands recurring events and reminders for the selected date.
- `RescheduleSheet.jsx` contains a separate hourly timeline used by **Fit it in**. Its rendering is embedded in that modal instead of being reusable.
- `dayBlocks()` in `src/utils/reschedule.js` already converts expanded events and reminders into timed and untimed blocks.
- The existing timeline renders 6:00 AM–11:00 PM. A complete day view must not silently clip earlier or later commitments.
- The current mobile day modal is intentionally full-screen. A second permanent column would make it unusable on narrow screens.
- The local UI redirected to sign-in in the available test browser, so authenticated visual inspection remains required after implementation.

## Scope

### Included

- Extract the existing timeline presentation into a shared component used by both **Fit it in** and the Planner day modal.
- Add a read-only, 24-hour schedule panel to the selected-day modal.
- Show timed events and timed reminders at their real times, plus all-day and anytime items above the timeline.
- Keep overlapping blocks readable instead of drawing them directly over one another.
- Keep details and schedule visible together on desktop; provide an in-modal Details/Schedule switch on mobile.
- Show explicit loading failure and empty states.

### Not included

- Editing or creating items directly on the schedule panel.
- Dragging items within the day modal.
- Database, API, schema, dependency, or recurrence changes.
- Adding the panel to unrelated date inputs before they adopt the shared component in a separately approved task.

## Experience contract

- Desktop: day details and hourly context should remain visible together.
- Mobile: use a Details/Schedule switch inside the existing full-screen sheet; Details remains the default so existing behavior is preserved.
- Keyboard and screen reader: the schedule must be navigable and events must expose names and times as text.
- Loading, empty, and error states: must be explicit and must not imply an empty day after a failed load.

## Acceptance criteria

- [x] Opening a Planner day shows the correct date's hourly schedule without navigation.
- [x] Timed events appear at the correct start and end times.
- [x] The panel stays synchronized if the selected day changes.
- [x] Empty days have a clear empty state.
- [x] Existing day-modal actions continue to work.
- [x] Desktop and mobile layouts are intentionally designed and verified.
- [x] Automated regression coverage and visual evidence are recorded.
- [x] Commitments before 6:00 AM or after 11:00 PM remain visible.
- [x] Overlapping commitments remain individually readable.
- [x] **Fit it in** continues to use the same timeline behavior without regression.

## Pseudocode

```text
WHEN CalendarPage opens a selected date
  derive every event occurrence and unfinished reminder occurrence for that date
  do not alter or persist any source data
  pass the expanded items and selected date to the shared DayTimeline

IN DayTimeline
  convert the expanded items with the existing dayBlocks rule
  place items without a clock time in the All day / Anytime group
  place timed items against minute positions on the hourly rail
  use 00:00–24:00 for the Planner's read-only view
  preserve the existing 06:00–23:00 scheduling bounds for Fit it in
  assign overlapping blocks to adjacent lanes so each title and time remains visible
  show a current-time line only when the displayed date is today
  expose every item name and time as readable text for assistive technology

IF event or reminder loading failed
  show Schedule unavailable and a Retry action
  never represent the failed load as an empty day
ELSE IF there are no timed or untimed blocks
  show a clear empty schedule state

ON desktop
  widen the day modal and render Details and Schedule in two columns
  keep the existing header, navigation, edit actions, and add controls working

ON mobile
  render one panel at a time inside the existing full-screen modal
  provide keyboard-operable Details and Schedule controls
  default to Details whenever a day is opened
  reset to Details when the selected date changes

IN RescheduleSheet
  replace its embedded timeline markup with the same DayTimeline component
  retain candidate dragging, clicking, keyboard movement, overlap warnings,
  first-free-slot behavior, and 06:00–23:00 scheduling limits

TEST
  verify block conversion and overlap lane assignment
  verify all-day, early, late, empty, and overlapping schedules
  verify existing rescheduling logic remains green
  run lint, full tests, and production build
  visually inspect authenticated desktop and mobile layouts
```

## Ordered task checklist

- [x] Read governing workspace and product rules.
- [x] Inspect the selected-day modal, Fit it in timeline, utilities, styles, tests, and current Git state.
- [x] Document the experience contract, scope, pseudocode, risks, and acceptance criteria.
- [x] Receive Scott's approval of this pseudocode.
- [x] Extract and test the shared timeline component and overlap layout helper.
- [x] Integrate the shared timeline into Fit it in without changing its scheduling behavior.
- [x] Add the desktop split view and mobile Details/Schedule switch to the Planner day modal.
- [x] Run focused tests, lint, full tests, and production build.
- [x] Receive Scott's approval to compact the Planner timeline around 8:00 AM–midnight while retaining the full scrollable day.
- [x] Add a Planner-only compact time scale and 8:00 AM starting position; leave Fit it in unchanged.
- [x] Receive Scott's approval for a today-aware opening position: current hour for today, 8:00 AM for other dates.
- [x] Implement and test the today-aware opening position.
- [x] Recheck the refined desktop and mobile layouts and rerun automated gates.
- [x] Complete authenticated desktop and mobile visual verification.
- [x] Complete documentation, logs, changelog, diff review, and post-task checklist.

## Implementation record

Scott approved the pseudocode on 2026-09-28. Application implementation is now authorized.

- Added `DayTimeline.jsx` and its token-based shared stylesheet.
- Added `layoutTimelineBlocks()` to position direct and transitive overlaps in adjacent lanes without mutating source data.
- Added focused regression tests for overlap layout.
- Replaced Fit it in's embedded rail markup with `DayTimeline` while retaining its candidate block, dragging, clicking, keyboard movement, clash warnings, and 06:00–23:00 bounds.
- Moved shared timeline styling out of `reschedule.css` into the component-owned stylesheet.
- Added a filter-independent 24-hour schedule beside the Planner day details on desktop.
- Added a mobile Details/Schedule switch that resets to Details whenever another date opens.
- Added honest schedule failure, retry, all-day/anytime, and empty states.
- Scott approved a visual refinement on 2026-09-29: the Planner view should show roughly 8:00 AM–midnight at once without removing access to the rest of the day.
- Added an optional timeline scale. Planner uses 0.4 px per minute and opens at 8:00 AM so 8:00 AM–midnight fits in the panel; Fit it in retains its original 1 px per minute scale and bounds.
- Scott approved a second refinement on 2026-09-29: today opens at the beginning of the current hour, while every other date continues to open at 8:00 AM.
- Added a pure, bounded opening-position rule with regression coverage for today's current-hour behavior and another date's 8:00 AM default.

## Validation

- Source inspection: complete.
- Focused timeline logic: `node --test src/utils/reschedule.test.js` — 15 passed.
- Focused lint: `npx eslint src/components/DayTimeline.jsx src/utils/reschedule.js src/utils/reschedule.test.js` — passed.
- Fit it in integration lint: passed.
- Interim production build after Fit it in integration: passed.
- Planner integration focused lint: passed.
- Planner integration focused tests: 15 passed.
- Planner integration production build: passed.
- Full lint: `npm run lint` — passed.
- Full test suite before final refinements: `npm test` — 92 passed.
- Final production build: `npm run build` — passed with only the existing large-chunk advisory.
- Final diff hygiene: `git diff --check` passed. All feature and workflow changes remain uncommitted pending Scott's review and approval.
- Compact-scale regression gates: `npm run lint` passed, `npm test` passed all 92 tests, and `npm run build` passed with only the existing large-chunk advisory.
- Today-aware focused validation: `node --test src/utils/reschedule.test.js` passed all 16 tests; focused ESLint passed.
- Final full gates: `npm run lint` passed, `npm test` passed all 93 tests, and `npm run build` passed with only the existing large-chunk advisory.
- Authenticated desktop: verified 1040 px two-column modal, hidden mobile switch, correct Office/Gym positions, compact full-day rail, and existing controls.
- Authenticated mobile: verified full-screen Details/Schedule panes, 8:00 AM–midnight in one view on another date, today's current-hour position, and the empty-day message.
- Fit it in: verified its original 06:00–23:00 labels and 1 px-per-minute height remain intact.
- Final review: `git diff --check` passed; the reviewed feature and workflow changes remain uncommitted pending Scott's approval.

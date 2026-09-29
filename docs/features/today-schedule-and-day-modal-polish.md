# Feature: Today schedule and refined day modal

**Status:** Complete — approved for commit
**Owner:** Scott
**Started:** 2026-09-29

## User problem

The Today page does not show the day's hourly shape, and the Planner day modal feels visually flat and improvised even though it contains useful information.

## Desired outcome

Make today's schedule a prominent, detailed part of Today, and make the Planner day modal feel calm, structured, and Apple-clean without removing any existing controls or data.

## Requested Today layout refinement

Scott reviewed the desktop Today page on 2026-09-29 and requested this revised hierarchy:

- Top area remains a two-column layout.
- Left column: Due today, Free to spend, and Spent summary across the top; Frodo's take directly underneath.
- Right column: the hourly day schedule, using the same width as Up next rather than spanning the full page.
- The schedule should be compact rather than extra tall.
- Event titles must remain fully readable; compactness must not come from truncating their text.
- The existing Spending and Up next row remains below this top area.

Scott approved this refinement by saying “go” on 2026-09-29.

## Final Today dashboard map

Scott replaced the intermediate layout with a denser, fully aligned dashboard map on 2026-09-29:

- First row: Today's schedule and Up next, each taking half of the available width.
- Second row: one KPI section on the left containing Due today, Free to spend, Spent, and Frodo's take; Habits on the right.
- Third row: Spending on the left and This week on the right.
- Remaining secondary cards continue below in their existing detail grid.
- All primary sections share the same two-column grid, aligned edges, and consistent gaps instead of appearing as disconnected floating cards.
- Mobile follows the same priority: schedule, Up next, KPI/Frodo, Habits, Spending, then This week.
- Existing schedule, Up next, Frodo, habit, spending, and navigation behavior must remain unchanged.

Scott authorized this exact map by saying “go” on 2026-09-29.

## Compact spacing revision

After reviewing the completed dashboard, Scott requested tighter space between cards and a shorter Morning Brief. The approved refinement is:

- Reduce the primary dashboard and page-section gutters without changing the mapped layout.
- Show at most three Morning Brief items per category.
- Preserve a truthful “+N more” count for hidden brief items.
- Keep the tighter rhythm responsive and preserve all existing destinations and behavior.

Scott authorized this refinement by saying exactly “go” on 2026-09-29.

This was an intermediate approved revision. The tighter gutters remain, while the later top-brief revision supersedes the three-items-per-category presentation.

## Top brief and first-view revision

Scott refined the top-of-page hierarchy again on 2026-09-29:

- Place a thin Morning Brief immediately below the Today header.
- Show exactly three highlight cards: Priority, Agenda, and Money.
- Each highlight shows at most one visually truncated line while retaining its full accessible text and original destination.
- Remove the former full-width Morning Brief card lower on the page.
- Shorten the paired Schedule/Up next desktop row so the first viewport also reveals the beginning of both KPI/Frodo and Habits.
- Keep schedule and Up next fully reachable through their existing internal scrolling.

Scott authorized this exact refinement by saying “go” on 2026-09-29.

## Approval

Scott approved the previously presented implementation plan on 2026-09-29 by saying “go.” This document records that approved contract and pseudocode before application-code edits.

## Baseline behavior and findings

- Today loads reminders and events but presents them only through counts and the compact Up next list.
- `DayTimeline` already renders all-day items, timed commitments, overlap lanes, current time, and a configurable scale.
- Planner's day modal already uses `DayTimeline`, preserves filter-independent schedule context, and supports desktop and mobile layouts.
- The modal's content is mostly one white plane with weak grouping. On mobile, this makes dense events, tasks, habits, and actions harder to scan.
- The existing data model and APIs already contain everything this feature needs.

## Scope

### Included

- Add a dedicated “Today’s schedule” section to Today using the shared timeline.
- Show all-day/anytime items, timed reminders, and timed events with more vertical detail than the compact Planner panel.
- Open today's schedule at the current hour while keeping the full day scrollable.
- Show an honest schedule error with Retry if reminders or events fail to load.
- Refine the existing Planner day modal's hierarchy, spacing, surfaces, header controls, content sections, and mobile presentation.
- Preserve every current day-modal action, pane switch, navigation control, add flow, and schedule behavior.

### Not included

- New persistence, APIs, schema, dependencies, or production-data changes.
- Editing, dragging, or creating directly on the Today timeline.
- Changing recurrence or reminder business rules.
- Redesigning Planner outside the day modal or changing Today modules beyond Scott's later approved dashboard-layout revisions recorded above.

## Experience contract

- Today: a thin Priority/Agenda/Money brief leads into the schedule beside Up next, with a clear Planner link.
- Detail: use a taller scale than Planner's compact modal so event names and times are easier to read.
- Desktop: schedule and Up next share one bounded row; the opening viewport also reveals the beginning of KPI/Frodo and Habits.
- Mobile: the brief becomes a compact horizontal strip, and the schedule remains readable in the approved single-column order with touch-safe controls and bounded scrolling.
- Planner modal: use calm card grouping, stronger date hierarchy, restrained counts, and one clear bottom action.
- Accessibility: keep semantic buttons, dialog labels, visible focus, textual time labels, and non-colour status cues.
- Failure and empty states must be distinct.

## Acceptance criteria

- [x] Today shows the current date's all-day, anytime, and timed plan without leaving the page.
- [x] Today's timeline opens at the current hour and the entire day remains reachable.
- [x] Today uses the same event/reminder conversion and overlap behavior as Planner.
- [x] A plan-data failure is shown as unavailable, not as an empty day, and Retry works.
- [x] The Planner modal has a cleaner visual hierarchy on desktop and mobile.
- [x] Existing edit, delete, complete, undo, navigation, add, and pane controls remain wired to their original behavior.
- [x] Empty, long-content, overlapping, desktop, and mobile states are verified.
- [x] Focused tests, lint, full tests, and production build pass.

## Pseudocode

```text
WHEN Today finishes loading plan data
  expand unfinished reminders for today's date
  expand event occurrences for today's date
  convert both collections with the existing dayBlocks rule
  calculate the opening position with the existing today/current-hour rule
  do not modify or persist source data

IN the Today schedule section
  show a title, a short item summary, and a link to the full Planner
  render the shared DayTimeline with a more detailed vertical scale than Planner
  keep 00:00–24:00 reachable by scrolling
  show all-day and anytime items above the hour rail
  show overlapping commitments in adjacent lanes
  show the current-time line

IF reminders or events failed to load
  show Schedule unavailable and a Retry button
  on Retry, reload both plan sources and replace the error only after success
ELSE IF there are no timed or untimed blocks
  show a calm empty-day message without hiding the hour rail

WHEN the Planner day modal opens
  preserve its selected date, derived data, and actions
  group the header's day navigation controls together
  present the date as the strongest label
  place each details section on a quiet, bordered surface
  place the schedule on its own matching surface
  keep the primary add action in the footer

ON mobile
  retain the full-screen sheet and Details/Schedule switch
  keep only the active pane visible
  make section surfaces, controls, and spacing fit the narrow width
  preserve safe-area padding and body scroll lock

TEST
  verify the shared opening-position and block-conversion rules
  run focused timeline tests
  run lint, the full test suite, and the production build
  visually inspect Today and the Planner modal at desktop and mobile widths
  exercise empty, populated, overlapping, and failure presentation where available

LAY OUT the final Today dashboard
  place a thin Morning Brief directly below the Today header
  show one Priority, one Agenda item, and one Money item
  keep each highlight to one visual line while preserving its full accessible text and destination
  create one aligned two-column primary dashboard grid
  place Today's schedule left and Up next right in the first row
  bound the first desktop row so KPI/Frodo and Habits begin within the opening viewport
  keep dense Schedule and Up next content reachable through internal scrolling
  place the KPI section left and Habits right in the second row
  keep Frodo's take inside the KPI section beneath its three values
  place Spending left and This week right in the third row
  keep secondary detail cards below the primary grid
  on narrow screens, stack the primary sections in their priority order
  preserve every existing interaction and data source
```

## Ordered task checklist

- [x] Read governing workspace, design, workflow, and decision records.
- [x] Inspect current Today data flow, shared timeline, Planner modal, tests, responsive CSS, and live mobile UI.
- [x] Record the approved feature contract and pseudocode.
- [x] Confirm Scott's approval from his 2026-09-29 “go.”
- [x] Add and test Today's detailed schedule data and error handling.
- [x] Add the Today schedule presentation and responsive styling.
- [x] Refine the Planner day modal without changing behavior.
- [x] Run focused and full automated quality gates.
- [x] Visually verify desktop and mobile Today and Planner states.
- [x] Complete feature documentation, changelog, work log, bug ledger, active-work handoff, and diff review.
- [x] Receive Scott's approval for the revised top-left summary/Frodo and top-right compact schedule layout.
- [x] Implement the revised desktop hierarchy and readable compact event blocks.
- [x] Re-run focused, full, desktop, and mobile verification after the revision.
- [x] Record Scott's final aligned dashboard map and exact “go” authorization.
- [x] Implement the final two-column section order without changing behavior.
- [x] Promote Habits from the lower detail grid into the primary dashboard.
- [x] Verify aligned desktop layout and priority-ordered mobile stacking.
- [x] Re-run all quality gates and complete post-task records.
- [x] Record Scott's compact-spacing request and exact “go” authorization.
- [x] Tighten dashboard and page-section gutters.
- [x] Limit Morning Brief categories to three visible items with an accurate remainder.
- [x] Verify desktop/mobile spacing and rerun proportional quality checks.
- [x] Record the top-brief/first-view contract and Scott's exact “go.”
- [x] Move Morning Brief directly below the Today header as three one-line highlights.
- [x] Remove the former lower full-width brief and shorten the desktop Schedule/Up next row.
- [x] Verify that KPI/Frodo and Habits enter the first desktop viewport.
- [x] Run focused and full validation, then complete post-task records.

## Validation

- Source and live mobile inspection: complete before implementation.
- Today implementation: shared `dayBlocks`, `plannerTimelineStartMinute`, and `DayTimeline`; plan-source errors remain distinct from an empty day and can be retried.
- Planner modal refinement: grouped navigation controls, stronger date and schedule hierarchy, token-based canvas and card surfaces, calmer spacing, and 44 px mobile header controls; all existing data and actions remain in place.
- Today desktop revision: the top uses the existing 7/5 column ratio; KPIs and Frodo stack on the left, the schedule occupies the right, and Spending/Up next remain below. The schedule rail is fixed at 390 px, uses a 0.55 px-per-minute scale inside that scroll area, and permits titles to wrap instead of ellipsizing.
- Revised-layout focused validation: Dashboard ESLint passed and all 16 schedule/rescheduling tests passed.
- Responsive visual refinement: the first compact render was too zoomed in to show the day's first commitments near midnight. The final bounded scale shows roughly twelve hours at once while retaining full-day scrolling and readable block width.
- Final dashboard implementation: one equal-width grid now maps schedule/Up next, KPI plus Frodo/Habits, and Spending/This week into three aligned rows. Habits uses the existing `AccountabilitySummary` component and remains connected to the same data and actions.
- Final-layout focused validation: Dashboard ESLint and the repository whitespace check passed after the structural change.
- Accessibility refinement: reordered the primary dashboard's source markup to match its visual and mobile priority order—schedule, Up next, KPI/Frodo, Habits, Spending, and This week—so keyboard and assistive-technology reading order do not contradict the layout. Focused lint and whitespace checks remained clean.
- Desktop density refinement: fixed schedule and Up next to one balanced 520 px row and made dense Up next content scroll within its card; fixed KPI/Frodo and Habits to one balanced 430 px row and made the habit list scroll within its card. Narrow layouts return to natural heights. This week uses a compact three-column card grid on desktop.
- Naming refinement: the promoted Today card is labeled “Habits” through an optional shared-component title while preserving “Accountability” as the component's default elsewhere.
- Final rendered inspection: desktop shows three aligned paired rows without the prior schedule-side dead region; mobile presents schedule, Up next, KPI/Frodo, and Habits in the approved order with natural page flow.
- Final focused checks: Dashboard and Accountability summary ESLint passed, all 16 schedule/rescheduling tests passed, and `git diff --check` passed.
- Focused ESLint: `DashboardPage.jsx` and `CalendarPage.jsx` passed.
- Focused timeline regression suite: all 16 tests passed.
- Full lint: `npm run lint` passed.
- Full test suite: `npm test` passed all 93 tests.
- Production build: `npm run build` passed with only the existing large-chunk advisory.
- Mobile Today: authenticated rendered inspection confirmed the new panel, real timed events, current-time line, detailed scale, Planner link, and responsive header.
- Mobile Planner: authenticated rendered inspection confirmed the refined full-screen sheet, card grouping, readable dense content, grouped header controls, and pinned add action.
- Desktop: authenticated Safari inspection confirmed the equal-width schedule/Up next row, KPI plus Frodo/Habits row, compact Spending/This week row, readable schedule titles, and bounded dense lists without the prior dead region.
- Mobile: authenticated in-app inspection confirmed the natural-height priority order—schedule, Up next, KPI/Frodo, Habits, Spending, and This week—with readable event content and no desktop-only nested-card heights.
- Final full lint: `npm run lint` passed.
- Final full test suite: `npm test` passed all 93 tests.
- Final production build: `npm run build` passed with only the existing large-chunk advisory.
- Final diff review: `git diff --check` passed; no dependencies, schema, secrets, production data, or deployment behavior changed. The existing bug-report import, governance records, and this feature remain uncommitted together.
- Compact-spacing implementation: page and primary-grid gutters now use the tighter shared spacing tokens, with a smaller mobile rhythm. Morning Brief renders three items per category and calculates the remaining count from the same constant.
- Compact-spacing focused validation: Dashboard ESLint and `git diff --check` passed.
- Top-brief implementation: the header is followed by Priority, Agenda, and Money highlights using the first item from the existing full brief data. Each card preserves its original action and full accessible/title text while visually ellipsizing to one line. The exported brief remains complete.
- First-view implementation: removed the lower full brief card and reduced the paired desktop schedule/Up next row from 520 px to 430 px; the timeline uses a 300 px internal viewport while retaining the full scrollable day. Dashboard ESLint and `git diff --check` pass.
- Final rendered check: authenticated desktop Safari shows the thin three-card brief, the complete paired Schedule/Up next row, and the opening portions of KPI/Frodo and Habits in one viewport. Authenticated mobile shows a thin horizontally scrollable brief strip followed immediately by the schedule, with every highlight retaining one visible line.
- Final top-brief gates: `npm run lint` passed, `npm test` passed all 93 tests, and `npm run build` passed with only the existing large-chunk advisory.
- Diff hygiene: `git diff --check` passed. Review found no secrets, dependencies, schema changes, production writes, or unrelated application-code edits.

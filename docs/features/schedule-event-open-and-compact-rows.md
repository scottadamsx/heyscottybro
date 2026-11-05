# Feature: Schedule events open on click, and event rows are compact (BUG-080)

**Status:** Built and verified locally 2026-11-05; committed locally, push/deploy awaits Scott's approval
**Owner:** Scott
**Started:** 2026-11-05

## User problem

Scott, on 2026-11-05: "two bugs on heyscottybro, when youre on the schedule page, clicking an event doesnt go into it, and I also dont like how ugly the list items look for events, theylre too long with the document shit showing, making it look really unofficial, can you change this please".

Diagnosis (code read, 2026-11-05):

1. No event surface opens the event itself. In the Planner day modal, the Details pane renders each event as a plain div: only the small pencil (inline edit form) and X (delete) buttons act, and the row body does nothing. The Schedule pane's `DayTimeline` blocks (and its all-day pills) are plain divs with no click handling at all. The Planner "Upcoming events" list rows open the day modal, not the event. Tasks in the same lists navigate to a task detail page, so events behave inconsistently with everything around them.
2. The Details-pane event row inlines everything: description, attendee chips, the full `DocLinks` documents list, and the Orbit log prompt, so one event can run very tall and the day's list reads cluttered and unofficial.

## Desired outcome

- Clicking an event anywhere it appears in the Planner (Upcoming list, day modal Details list, day modal Schedule timeline) opens that event.
- Event rows in the day list are compact and clean by default: colour dot, time, one-line title, one meta line (location, attendees). Nothing else shows until the event is opened.
- Opening an event expands it in place and shows everything that used to be inline: description, attendee chips, the Documents list, the Orbit log prompt and status, and the Edit and Delete actions (same handlers as today).
- Tasks keep working exactly as today; timeline task blocks open the task page, matching the Details list.

## Plan

1. `CalendarPage.jsx`: add `openEventId` state. `openDay(date, eventId)` gains an optional event to open; day switches without an event collapse any open event. Upcoming event rows pass their event id.
2. `CalendarPage.jsx` Details pane: event rows become a compact head (click or Enter/Space toggles, `aria-expanded`) plus an expanded detail region holding description, `AttendeeChips`, `DocLinks`, the Orbit prompt/status block, and Edit/Delete buttons wired to the existing handlers. An event that needs its Orbit log prompt keeps a compact "Log in Orbit" button on the collapsed row so the action is never hidden. The inline edit form branch is unchanged.
3. `DayTimeline.jsx`: optional `onBlockClick(block)` prop. When present, timed blocks and all-day pills render as real buttons and stop propagation so the rail click does not also fire; when absent, rendering is byte-for-byte the current divs (the Today page passes no handler and is unchanged).
4. `CalendarPage.jsx` Schedule pane: pass `onBlockClick`; an event block switches to the Details pane and opens that event (scrolling it into view), a task block navigates to the task page.
5. CSS: compact row styles in `plan.css` (single-line title and meta with ellipsis, chevron rotation, detail region spacing), button resets for clickable timeline blocks and pills in `day-timeline.css`. DM Sans/DM Mono system unchanged; no new colours.
6. Source tests for the new wiring (event head toggle, DocLinks only inside the detail region, DayTimeline button rendering behind the prop), full suite, lint, build, and a rendered harness check at desktop and 390px with screenshots read.

## Approval

Scott's direct order on 2026-11-05 (quoted above) authorises the fix and a local commit, per the BUG-078/BUG-079 precedent in ACTIVE_WORK. Push/deploy need Scott's separate explicit approval.

## Validation record (2026-11-05)

- `npm run lint` clean; `npm test` green end to end (exit 0), including the 5 new source tests in `src/pages/admin/calendarEventRows.test.js`; `npm run build` pass (pre-existing large-chunk advisory only).
- Rendered harness (scratch Vite pages, app stylesheets including globals tokens, Playwright): the real `DayTimeline` with a handler fired `event:e101`, `task:r202`, and `event:e303` for a timed event block, a timed task block, and an all-day pill; a second timeline without a handler rendered 0 buttons and 2 plain div blocks, unchanged.
- Row geometry: old row 178px tall at desktop width and 368px at 390px; new collapsed row 55px at both widths; opened row 231px/249px with the detail card. No horizontal overflow at either width (scrollWidth equals innerWidth). Screenshots read: `verification/bug080-rows-{before,after}-{desktop,phone}.png`, `verification/bug080-timeline-after-click.png`.
- Harness limit: Font Awesome does not load in the bare scratch page, so the chevron and location icons render in production only; their layout space is reserved by the flex row.
- Remaining gate: Scott approves the push; then the signed-in production check (tap an event in the live day view, tap a block on the live Schedule timeline).

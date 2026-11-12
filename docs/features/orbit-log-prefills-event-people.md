# Feature: Log in Orbit starts from the event's people (BUG-081)

**Status:** Built and verified locally 2026-11-06; committed locally, push/deploy awaits Scott's approval
**Owner:** Scott
**Started:** 2026-11-06

## User problem

Scott, on 2026-11-06 (with a screenshot of the manual Log a hangout form and its full people list): "in heyscottybro, when you click the 'log in orbit' button it goes to manual input, this is shitty, it should grab the person who is involved from the event and ask me 'what happened at the event' so I can legit prompt it the info not manual search that's genuinely too much work".

Diagnosis (code read, 2026-11-06):

1. `CalendarPage.openOrbitLog` navigates to `/admin/people` carrying only `sourceHostEventId`, `title`, and `date`. The event's attendees exist in the host (the `eventPeople` link map, resolved everywhere else on the page) but are never sent.
2. Orbit's `RoutedLayer` (`orbit/src/pages/App.jsx`) forwards only those same fields into `open('log', ...)`, so the log opens with nobody attached.
3. Everything downstream already handles prefilled people: `LogModal` seeds its form from `prefill.people` and passes it to `InterviewDrawer` as `eventPeople`, whose opening turn then starts with those people and asks what happened. The people just never arrive.

## Desired outcome

- Tapping "Log in Orbit" on an event with people attached opens the Orbit log with those people already in it: the interview starts by naming them and asking what happened; the manual form shows them already picked, with the per-person update fields and Notes ready.
- An event with nobody attached behaves exactly as today: Orbit asks who was there.
- No new picker, no new storage: attendee ids travel in the same URL handoff the title and date already use, and are removed from the URL right after they are consumed, like the existing fields.

## Plan

1. `src/pages/admin/CalendarPage.jsx`: `openOrbitLog` adds `people` (the event's normalized attendee ids, comma-joined) to the navigation query when the event has any. `normalizeAttendeeIds` joins the existing attendees import.
2. `orbit/src/pages/App.jsx`: `RoutedLayer` parses the `people` param into an id list, passes it into the `open('log', ...)` prefill when non-empty, and deletes it from the URL with the other handoff fields.
3. No change to `LogModal` or `InterviewDrawer`: both already consume `prefill.people`.
4. Source-wiring tests (`src/pages/admin/orbitLogPrefill.test.js`): the page builds the people param from the event's links; the Orbit layer forwards and consumes it.
5. Full suite, lint, build, and a rendered harness check of the real LogModal in both modes (interview available and manual), prefilled from an event, at desktop and 390px with screenshots read.

## Steps

- [x] Diagnosis recorded (this doc, BUGS.md BUG-081)
- [x] Host sends the event's people (`CalendarPage.jsx`)
- [x] Orbit forwards them into the log prefill (`orbit/src/pages/App.jsx`)
- [x] Source tests added and passing
- [x] Full suite, lint, build pass
- [x] Rendered harness check read at desktop and 390px
- [x] WORKLOG entry; commit locally; push only on Scott's say-so

## Edge cases

- Event with no attendees: no `people` param; today's behaviour is preserved exactly.
- Attendee id Orbit no longer has: ids resolve against Orbit's current people everywhere they render; the interview names only people it can resolve, and the manual picker's value tolerates the id. No crash path (all lookups are optional-chained today).
- Recurring events: the links map is keyed by the base event id, the same key the page already uses to render attendee chips for these rows, so the handoff matches what Scott sees on the event.

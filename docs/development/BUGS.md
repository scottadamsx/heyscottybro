# Bug and fix ledger

Every discovered software defect belongs here, including defects found while building another feature. Entries are never deleted; resolved entries retain the cause and proof of the fix.

## Entry format

### BUG-000 — Short title

- **Status:** Open | Investigating | Resolved | Deferred
- **Discovered:** YYYY-MM-DD
- **Area:**
- **Observed:** What happened.
- **Expected:** What should happen.
- **Impact:** Who or what is affected.
- **Cause:** Unknown until established; never guess.
- **Fix:** The implemented correction.
- **Regression coverage:** Test or repeatable manual check.
- **Related work:** Feature document, commit, or decision ID.

## Entries

### BUG-001 — Mobile day-view switch visible on desktop

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Planner day modal
- **Observed:** The Details/Schedule switch intended for the mobile sheet also appears above the desktop two-column layout.
- **Expected:** Desktop shows details and schedule together without a view switch; the switch appears only at the mobile breakpoint.
- **Impact:** Desktop layout contains a redundant, misleading control.
- **Cause:** The shared `.admin-shell .segmented` display rule has greater selector specificity than `.day-view-switch`, so the desktop hidden state is overridden.
- **Fix:** Scoped the hidden and mobile display rules to `.admin-shell .day-modal .day-view-switch`, giving them precedence over the shared segmented-control rule.
- **Regression coverage:** Authenticated 1091 px desktop check confirmed a two-column grid with the switch hidden; authenticated mobile check confirmed the switch remains visible and operable.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`

### BUG-002 — Hidden mobile schedule loses its opening position

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Planner mobile day modal
- **Observed:** A newly opened day's schedule can remain at midnight after switching from the default Details pane.
- **Expected:** Switching to Schedule applies the approved opening position: current hour today or 8:00 AM on another date.
- **Impact:** Mobile users may initially see the wrong portion of the day.
- **Cause:** The timeline's scroll effect runs while the mobile Schedule pane is `display: none`; the browser clamps the hidden rail to zero and the effect does not rerun when the pane becomes visible.
- **Fix:** Added a pane-state scroll key so `DayTimeline` reapplies its opening position when Schedule becomes visible.
- **Regression coverage:** Focused current-hour/8:00 AM unit test plus authenticated mobile verification that September 30 opens at 8:00 AM after switching from Details.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`

### BUG-003 — Frodo chat opens at the oldest message

- **Status:** Open
- **Discovered:** 2026-09-28; imported 2026-09-29
- **Area:** Frodo chat panel
- **Observed:** Opening chat starts at the top of its history.
- **Expected:** Chat opens at the newest message.
- **Impact:** Users must manually traverse the conversation to resume it.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify initial scroll position with short and long histories.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-004 — Long Frodo responses disappear on iPhone

- **Status:** Open
- **Discovered:** 2026-09-28; imported 2026-09-29
- **Area:** Frodo chat panel on iPhone
- **Observed:** After a long table-heavy response, message content becomes blank while close controls and fragments remain.
- **Expected:** The complete response remains visible and scrollable.
- **Impact:** Mobile users lose the answer they requested.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; source evidence: `frodo-chat-message-content-disappears-after-long-response-on-c16ddf-1.jpg`.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-005 — Food log primary and secondary actions are reversed

- **Status:** Open
- **Discovered:** 2026-09-10; imported 2026-09-29
- **Area:** Life › Food › Add Meal
- **Observed:** Save is on the left and Back is on the right.
- **Expected:** Back appears on the left and Save to Log on the right.
- **Impact:** The form conflicts with the product's expected action order.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify desktop and mobile action order.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-006 — Frodo incorrectly reports that Planner has no Habits section

- **Status:** Open
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Assistant product knowledge
- **Observed:** Frodo denied the existence of Planner habits even though the section exists.
- **Expected:** Frodo verifies current product capabilities before answering.
- **Impact:** Users receive incorrect guidance and may create data in the wrong place.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; query Frodo about an existing Planner section.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-007 — Recurring reminders without due dates do not appear on the calendar

- **Status:** Open
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Reminders and Calendar
- **Observed:** Recurring reminders created without a due date are absent from Calendar.
- **Expected:** Their recurrence dates make them visible on the relevant calendar days.
- **Impact:** Scheduled commitments can disappear from planning views.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; cover recurring reminders with and without an explicit first due date.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-008 — Frodo claims an unverified task exists

- **Status:** Open
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Assistant data verification
- **Observed:** Frodo claimed a task named “Scrub” existed on July 30 without confirming stored data.
- **Expected:** Frodo checks the authoritative task source before making a factual claim.
- **Impact:** Users cannot trust task-status answers.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; request a date-specific task that does not exist.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-009 — Frodo schedules repeated reminders consecutively

- **Status:** Open
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Reminder scheduling
- **Observed:** Multiple weekly reminder occurrences were initially placed on consecutive days despite an instruction to spread them out.
- **Expected:** Frodo honors explicit spacing and uses sensible distribution when spacing is implicit.
- **Impact:** Plans become impractical and require manual correction.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; cover explicit and inferred weekly spacing.
- **Related work:** Consolidates two open source reports; `docs/backlog/bug-report-2026-09-29.md`.

### BUG-010 — Created reminders do not notify the user

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Reminders and notifications
- **Observed:** A reminder can exist without producing its expected notification.
- **Expected:** Eligible reminders notify at their configured time, or clearly disclose why they cannot.
- **Impact:** Users can miss time-sensitive commitments.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify permission, scheduling, and delivery paths.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-011 — Dates page is visually cluttered and inconsistent

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Life › Dates
- **Observed:** The page has inconsistent spacing, hierarchy, and controls compared with the design system.
- **Expected:** A clean, coherent layout that follows current product standards.
- **Impact:** The page is harder to scan and feels unfinished.
- **Cause:** Unknown; requires current UI review.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; source evidence: `dates-page-ui-is-cluttered-and-inconsistent-with-design-stan-aa0565-1.png`.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-012 — Frodo fails to recall earlier-session reminders

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Frodo memory and conversation continuity
- **Observed:** Frodo cannot reliably recall reminders or conversation context from earlier sessions.
- **Expected:** Frodo retrieves relevant durable context before answering.
- **Impact:** Users must repeat themselves and may receive contradictory responses.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify cross-session recall against stored reminders and conversation summaries.
- **Related work:** Consolidates two open source reports; `docs/backlog/bug-report-2026-09-29.md`.

### BUG-013 — Reminders are missing from primary mobile views

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Mobile Homepage, Today, and Reminders
- **Observed:** Existing reminders do not display in the primary mobile views.
- **Expected:** The same eligible reminders appear consistently across mobile planning surfaces.
- **Impact:** Critical planning data is unavailable on mobile.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; compare a known reminder across all three mobile views.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-014 — Mobile full-screen day view is broken

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Plan › Overview day view
- **Observed:** The full-screen day view is unusable or incorrectly laid out on mobile.
- **Expected:** Day details remain readable, navigable, and operable at phone widths.
- **Impact:** Mobile users cannot reliably inspect a day.
- **Cause:** Unknown; requires current verification because related day-modal work shipped after the report.
- **Fix:** Not established by this import.
- **Regression coverage:** Verify current behavior before implementation; source evidence: `day-full-screen-view-broken-on-mobile-4e6c4a-1.png`.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`; `docs/backlog/bug-report-2026-09-29.md`

### BUG-015 — Uploaded photos are not visible in chat

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Frodo chat attachments
- **Observed:** A photo can be uploaded or signaled without appearing as usable visual content in chat.
- **Expected:** The user and assistant can see the attached image and its state.
- **Impact:** Image-based requests cannot be completed reliably.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; cover upload, preview, persistence, and assistant access.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-016 — Frodo creates duplicate bug and feature records

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Assistant issue logging
- **Observed:** Frodo creates a new record without checking for an existing matching item.
- **Expected:** Frodo searches current tracking records and updates or links the canonical item.
- **Impact:** The backlog becomes noisy and status fragments across duplicates.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; submit the same issue twice and verify canonical reuse.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-017 — Frodo receives attachment metadata but cannot inspect the screenshot

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Assistant attachment pipeline
- **Observed:** Frodo knows an attachment exists but cannot access its image content.
- **Expected:** Supported screenshots reach the assistant as inspectable visual input.
- **Impact:** Frodo cannot diagnose screenshot-based reports.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify metadata and image bytes reach the same conversation turn.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-018 — `consult_archivist` returns HTML instead of JSON

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Brain / Archivist integration
- **Observed:** Creating Brain notes through `consult_archivist` returns an HTML MIME response where JSON is expected.
- **Expected:** The tool returns its documented JSON success or error payload.
- **Impact:** Brain-note creation fails and callers cannot safely parse the result.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; exercise successful and failed note creation responses.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-019 — Screenshot upload rejects a valid request pattern

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Tools › Bugs screenshot upload
- **Observed:** Upload fails with “string did not match the expected pattern.”
- **Expected:** Supported screenshot files upload, or validation explains the invalid field.
- **Impact:** Visual evidence cannot be attached to bug records.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; test accepted formats, filenames, and validation errors.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

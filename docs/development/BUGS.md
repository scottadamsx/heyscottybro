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

# Feature: Sleep tracking in Health (BUG-086)

**Status:** Built locally on `feature/sleep-tracking`; not pushed. Migration not applied.
**Owner:** Scott
**Started:** 2026-11-09

## User problem

Scott asked on 2026-11-09 to track sleep in heyscottybro ("start tracking sleep in
heyscottybro", then "sleep could be in health"). The app had no sleep log anywhere:
Health covered workouts, food, and weight only. A stopgap daily reminder
("Log last night's sleep", 8:00 AM) holds the first entry in its notes.

## Desired outcome

Log each night's sleep inside Health: bedtime, wake time, and the morning it ended,
with the duration worked out automatically, a list of past nights, and a small
summary (last night, average of the last 7 logged nights).

## Current behavior

Health tabs: Overview, Workouts, Exercises, Food, Meal Plan, Body (weight only).
Weight logging is the closest pattern: a `FormModal` (`WeightModal`), rows in
`weight_logs` (one per day, upsert on save), loaded by `useHealthData`, written
through `src/api/healthApi.js`, deletes confirmed inline in the list.

## Scope

### Included

- A Sleep tab in Health, after Body.
- Log/edit form in a modal: date (the morning the sleep ended), bedtime, wake
  time, live duration preview, optional note. One entry per night; saving the
  same date replaces it.
- Entry list, most recent first: date, duration, bedtime to wake time, note.
- Summary: last night's duration and the average of the last 7 logged nights.
- Edit and delete from the list (food/weight patterns).
- New `sleep_logs` table via a migration file (not applied by this work).
- Pure duration/format helpers in `src/utils/sleep.js` with tests.

### Not included

- No change to the stopgap reminder (it stays as the daily prompt; its notes
  remain the record until Scott backfills or deletes it).
- No Apple Health import, no sleep stages or quality scores.
- No Overview KPI for sleep.
- No push, no deployment, no live data writes.

## Experience contract

- Desktop: tab content matches the Body tab layout (actions row, cards, list).
- Mobile: same stack; controls keep the app's 44px touch minimums.
- Keyboard and screen reader: real buttons, labelled icon buttons for delete,
  the duration preview is an `aria-live` region.
- Loading, empty, and error states: the Health page skeleton covers loading; an
  empty list shows "No sleep logged yet"; if the `sleep_logs` table is missing
  (migration not yet applied) the tab says so instead of failing the page.
- List-card counts: the Nights card header shows the entry count (`N`).

## Acceptance criteria

- [ ] Sleep tab appears in Health and opens via `?tab=sleep`.
- [ ] Logging 10:55 PM to 6:23 AM for Nov 9, 2026 shows 7h 28m before saving
  (the watch's 6h 52m is its asleep-only figure; the app duration is bedtime
  to wake time, per the approved scope).
- [ ] Saved nights list most recent first with duration and times.
- [ ] Summary shows last night and the 7-night average.
- [ ] Edit updates a night; delete removes it after confirmation.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass.
- [ ] Rendered check at desktop and 390px with local test data looks right.

## Edge cases

- Wake time earlier than bedtime means the night crossed midnight (add 24h).
- Bedtime after midnight (e.g. 12:40 AM to 8:00 AM) works the same way.
- Durations under 30 minutes or over 20 hours are refused as mistakes.
- Saving a date that already has an entry replaces it (one night per date).
- Missing table (migration pending): tab shows a plain notice, page still loads.

## Pseudocode

```text
Migration: create sleep_logs like weight_logs (profile_id, date unique per
profile, bed_time and wake_time as "HH:MM" text, duration_minutes integer,
note), owner-only RLS, index on (profile_id, date desc).

Utils (pure, tested): minutes between bed and wake, wrapping past midnight;
format minutes as "6h 52m"; format "22:55" as "10:55 PM"; summarise a
most-recent-first list into last night plus the average of up to 7 nights.

API (healthApi): loadSleep (newest first), saveSleep (validate times, compute
duration, upsert on profile+date), updateSleep (by id), deleteSleep. Every
write emits the health data-change event, like weight.

Data hook: load sleep alongside the other Health data, but non-critically
(the exercises pattern): a failure records sleepError and leaves the rest of
Health working.

UI: Sleep tab in HealthPage with a Log sleep button, a Summary card, and a
Nights card. SleepModal (HealthModals) mirrors WeightModal: DatePicker for
the morning date, two time fields, the computed duration shown live, a note.
Rows follow the food pattern: tap the row to edit, trash icon to delete.
```

## Ordered task checklist

- [x] Inspect Health page, modals, API, hook, and the health migration
- [x] Write this feature document
- [x] Migration file for `sleep_logs`
- [x] `src/utils/sleep.js` plus tests, added to the test chain
- [x] `healthApi` sleep functions and `useHealthData` loading
- [x] `SleepModal`, Sleep tab, summary, and list in HealthPage
- [x] Lint, full test suite, production build
- [x] Rendered harness at desktop and 390px, screenshots read
- [x] Post-task checklist records (WORKLOG, CHANGELOG, ACTIVE_WORK)
- [x] Local commit on `feature/sleep-tracking` (no push)

## Implementation record

- Files changed:
  - `supabase/migrations/2026-11-09-sleep-logs.sql` (new): `sleep_logs` table,
    owner-only RLS, `(profile_id, date)` unique, `(profile_id, date desc)` index.
  - `src/utils/sleep.js` (new) and `src/utils/sleep.test.js` (new): duration
    math with midnight wrap, duration/clock formatting, 7-night summary.
    Test added to the `npm test` chain in `package.json`.
  - `src/api/healthApi.js`: `loadSleep`, `saveSleep` (upsert, one per night),
    `updateSleep`, `deleteSleep`, validation via the shared duration helper.
  - `src/components/health/useHealthData.js`: sleep loads non-critically
    (exercises pattern); a missing table sets `sleepError`, Health still loads.
  - `src/components/health/HealthModals.jsx`: `SleepModal` mirroring
    `WeightModal`, with a live duration preview.
  - `src/pages/admin/HealthPage.jsx`: Sleep tab, `SleepTab` (Summary card,
    Nights card with count, food-pattern rows), modal wiring.
  - `src/pages/admin/health.css`: one rule for the modal duration preview.
- Decisions:
  - New table over reusing an existing one: no existing health table fits
    bed/wake times; `weight_logs` is the shape copied.
  - Times stored as local "HH:MM" text and duration stored as minutes at save
    time, so lists never re-derive it and no timezone conversion can shift a
    night. The date is the morning the sleep ended.
  - Branch is from `origin/main` (95041fc), independent of the unpushed
    BUG-085 commit on local main.
- Data or API changes: new `sleep_logs` table (migration file only, not
  applied); no existing table or API shape changed.

## Validation

- Automated: `npm run lint` clean; `npm test` green (exit 0), including 5 new
  sleep tests; `npm run build` passes.
- Desktop visual check: rendered harness (real `SleepTab` and `SleepModal`
  with local fixture data) at 1280px, screenshot read: summary and list match
  the Body tab's look, DM Sans/DM Mono, one accent, no overflow.
- Mobile visual check: same harness at 390px, screenshot read: rows stack
  cleanly, duration preview reads "6h 52m" for 10:55 PM to 6:23 AM, modal
  fits with no horizontal overflow.
- Known limitations: the live round trip (real Supabase) is unverified until
  the migration is applied and the branch is pushed with Scott's approval;
  the harness used fixture data in place of the API. In the harness
  screenshots the Font Awesome glyphs (plus, trash, close) did not render
  because the sandbox browser did not load the CDN icon font; the rows use
  the identical `icon-btn` + `fa-trash` markup as the live Food and weigh-in
  rows, so the icons follow in production. The stopgap reminder still holds
  the Nov 8 to 9 entry in its notes; backfilling it into the new tab is a
  one-line manual log once the feature is live.

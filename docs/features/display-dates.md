# Display Dates

Scott requested full weekday, abbreviated month and ordinal day everywhere a calendar date is displayed, for example `Thursday, Jan 15th`. The year remains in storage, not display. Settings adds an optional full-month style; the preferred format remains the default.

## Implementation

1. Read the device's `setting:dateFormat`, defaulting safely when absent or unavailable.
2. Parse date-only values locally, without shifting them through UTC.
3. Render weekday, selected month style and ordinal day. Retain time where relevant.
4. Route host and Orbit labels, receipts, date-picker summaries, tooltips and human-readable reports through shared formatters.
5. Keep original entry text, machine exports, stored years and calendar editing/navigation semantics intact.

The host Settings selector persists through the existing settings store. Canonical Orbit reads the same preference in the embedded app. Long chart labels show endpoints with per-point tooltips; picker summaries wrap instead of truncating.

## Verification

- Host full test command passed, including its final 310-test suite.
- Three focused host formatter tests passed: default, ordinal exceptions, format options and stored-year preservation.
- Orbit suite passed 205 tests before adding the storage-preference regression; that additional test is checked separately.
- Host production build and lint passed. Existing large-bundle warning remains.
- Local Settings route reached sign-in. Authenticated settings interaction, persistence after browser reload, and desktop/mobile visual checks remain unverified.
- Local changes only; no commit, push, migration or deployment performed for this request.

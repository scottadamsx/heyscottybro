# Changelog

User-visible product changes are recorded here. Internal work appears in `docs/development/WORKLOG.md`.

## Unreleased

### Added

- Frodo can now search safe planner and Brain shelves in parallel with source-labelled results, use bounded rich data filters, and ask for the actual occurrences inside a reminder/event date range.
- Health now has a durable Exercises library with logged-set history, derived heaviest and estimated-strength personal records, exact weight-times-reps goals, and clearly labelled estimated goal progress. Release awaits its additive database migration.
- Live workouts now show the six completed sessions behind each weight recommendation, including confidence and a plain-language reason.
- People / Orbit now has a locally implemented conversational journal with person/date clarification, source-backed memory updates, saved receipts, pending-entry history, and conflict-aware undo. Hosted release awaits its separate database migration and live-provider validation.
- Journal create and edit now include Unicode-aware live character/word counts and a resumable active-writing timer with pause, reset, idle pause, and draft recovery.
- Journal AI cleanup is available only through an authenticated, server-enabled, default-off Anthropic connector; it uses explicit confirmation, a before/after comparison, accept/undo controls, and truthful saved provenance.
- Analytics is now a top-level private workspace with Overview, Activity History, AI Usage, truthful stored-record ranges, safe filters, and honest partial-source notices.
- Forward activity and page-use tracking now has privacy-safe owner-scoped schema and client behavior ready for a separately approved database migration.
- Planner day details now include a complete hourly schedule: side-by-side on desktop and behind a Details/Schedule switch on mobile.
- Overlapping commitments remain readable in separate lanes, and all-day or anytime items appear above the hourly rail.
- The compact Planner schedule shows 8:00 AM–midnight together; today instead opens at the beginning of the current hour.
- Today now includes a detailed hourly schedule with real events, all-day or anytime items, overlap handling, current-time context, and a direct link to the full Planner.
- Development sessions now have a permanent sanitized transcript, machine-readable manifest, and supervisor-ready summary under `docs/sessions/`.

### Changed

- Workout progression now uses up to six completed sessions, gradual rep improvement, two top-range confirmations before a one-step increase, optional RPE as a brake, personal training-gap confidence, and a one-step recovery response after two poor sessions.
- Mission Control now opens on Brain and retains Brain, Inbox, and Research; the unused Agents page and duplicate Usage tab are gone.
- The retired Bug Tracker surface, dashboard pulse, assistant tools, suggestions, and Library entry are removed without changing its old rows or private storage bucket.
- Planner's day modal now uses a calmer card hierarchy, clearer date and schedule titles, grouped navigation, and larger mobile header controls.
- Today now opens with a thin Priority/Agenda/Money brief, followed by Schedule beside Up next, KPI and Frodo beside Habits, and Spending beside This week. Dense desktop lists scroll within their cards, while mobile uses a compact brief rail and the same priority in a natural single-column flow.
- Frodo now uses a safe-area full-screen sheet through 900 px, opens restored history at the newest message, keeps only the conversation scrolling, contains wide tables/code, and preserves the desktop dock above that breakpoint.
- Frodo and Command Center history now loads and saves under the authenticated owner with ordered writes, fail-closed hydration, account-transition isolation, and retryable loading errors.
- Settings now clears the current account's Frodo, Command Center, and Griphook conversations through one coordinated action, while reporting partial failures and preserving unowned quarantined backups.
- Griphook history is now owner-bound, synchronizes safely across Money-page remounts, and cannot race an active turn against Clear.

### Fixed

- Frodo no longer misses recurring planner occurrences in date-specific questions; recurring multi-day events now repeat their whole span correctly.
- Explicit weights in AI workout requests now populate the editable starting-weight field instead of being stranded in an exercise note.
- Orbit keeps original journal input separate from event Notes; successful undo closes the log window with a brief confirmation. History is available through Entries rather than cluttering the composer.
- Paginated Journal lists now report the visible count as `N of M` until every loaded entry is shown.
- Saved Frodo images now renew expired private preview links once and provide an accessible retry fallback instead of remaining broken.
- Similar People events stay separate by default; attendee lists merge only after explicit same-occasion intent.
- Production deployment now stays within Vercel's serverless-function limit while preserving the public Kiwi shared-tasks endpoint; the redesigned Today dashboard and Frodo reliability updates are live.
- Chat screenshots can survive reload through private signed previews, still reach Frodo when staging fails, reject undecodable HEIC honestly, move into canonical bug evidence when claimed, and clean up only after the durable session is cleared.
- Frodo's task claims require a successful current-turn reminders query; Life › Habits knowledge now comes from one shared tested contract.
- Bug logging now checks canonical open reports before creating, fails closed when lookup fails, merges duplicate evidence safely, and rolls back partial copies/rows on failure.
- Lazy-load recovery, HTML-response diagnostics, service-worker navigation fallback, and generated screenshot storage keys now have deterministic regressions.
- Agent tool calls now save accepted turns and balanced per-action checkpoints before further side effects, refresh account authorization before every model request, and keep successful replies visible when only terminal persistence needs retry.
- Generic Frodo memory demonstrations now avoid volunteering access, location, health, financial, relationship, identity, legal, and private-schedule details.

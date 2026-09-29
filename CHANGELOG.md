# Changelog

User-visible product changes are recorded here. Internal work appears in `docs/development/WORKLOG.md`.

## Unreleased

### Added

- Planner day details now include a complete hourly schedule: side-by-side on desktop and behind a Details/Schedule switch on mobile.
- Overlapping commitments remain readable in separate lanes, and all-day or anytime items appear above the hourly rail.
- The compact Planner schedule shows 8:00 AM–midnight together; today instead opens at the beginning of the current hour.
- Today now includes a detailed hourly schedule with real events, all-day or anytime items, overlap handling, current-time context, and a direct link to the full Planner.
- Development sessions now have a permanent sanitized transcript, machine-readable manifest, and supervisor-ready summary under `docs/sessions/`.

### Changed

- Planner's day modal now uses a calmer card hierarchy, clearer date and schedule titles, grouped navigation, and larger mobile header controls.
- Today now opens with a thin Priority/Agenda/Money brief, followed by Schedule beside Up next, KPI and Frodo beside Habits, and Spending beside This week. Dense desktop lists scroll within their cards, while mobile uses a compact brief rail and the same priority in a natural single-column flow.
- Frodo now uses a safe-area full-screen sheet through 900 px, opens restored history at the newest message, keeps only the conversation scrolling, contains wide tables/code, and preserves the desktop dock above that breakpoint.
- Frodo and Command Center history now loads and saves under the authenticated owner with ordered writes, fail-closed hydration, account-transition isolation, and retryable loading errors.
- Settings now clears the current account's Frodo, Command Center, and Griphook conversations through one coordinated action, while reporting partial failures and preserving unowned quarantined backups.
- Griphook history is now owner-bound, synchronizes safely across Money-page remounts, and cannot race an active turn against Clear.

### Fixed

- Production deployment now stays within Vercel's serverless-function limit while preserving the public Kiwi shared-tasks endpoint; the redesigned Today dashboard and Frodo reliability updates are live.
- Chat screenshots can survive reload through private signed previews, still reach Frodo when staging fails, reject undecodable HEIC honestly, move into canonical bug evidence when claimed, and clean up only after the durable session is cleared.
- Frodo's task claims require a successful current-turn reminders query; Life › Habits knowledge now comes from one shared tested contract.
- Bug logging now checks canonical open reports before creating, fails closed when lookup fails, merges duplicate evidence safely, and rolls back partial copies/rows on failure.
- Lazy-load recovery, HTML-response diagnostics, service-worker navigation fallback, and generated screenshot storage keys now have deterministic regressions.
- Agent tool calls now save accepted turns and balanced per-action checkpoints before further side effects, refresh account authorization before every model request, and keep successful replies visible when only terminal persistence needs retry.
- Generic Frodo memory demonstrations now avoid volunteering access, location, health, financial, relationship, identity, legal, and private-schedule details.

# Changelog

User-visible product changes are recorded here. Internal work appears in `docs/development/WORKLOG.md`.

## Unreleased

### Added

- Planner day details now include a complete hourly schedule: side-by-side on desktop and behind a Details/Schedule switch on mobile.
- Overlapping commitments remain readable in separate lanes, and all-day or anytime items appear above the hourly rail.
- The compact Planner schedule shows 8:00 AM–midnight together; today instead opens at the beginning of the current hour.
- Today now includes a detailed hourly schedule with real events, all-day or anytime items, overlap handling, current-time context, and a direct link to the full Planner.

### Changed

- Planner's day modal now uses a calmer card hierarchy, clearer date and schedule titles, grouped navigation, and larger mobile header controls.
- Today now opens with a thin Priority/Agenda/Money brief, followed by Schedule beside Up next, KPI and Frodo beside Habits, and Spending beside This week. Dense desktop lists scroll within their cards, while mobile uses a compact brief rail and the same priority in a natural single-column flow.

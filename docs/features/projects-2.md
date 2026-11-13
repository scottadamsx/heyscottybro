# Projects 2.0

Status: built and verified locally 2026-11-13; approved by Scott 2026-11-13 ("looks good, push it") after his click-through of the verification replica. Deployment: migration `supabase/migrations/2026-11-13-projects-2.sql` applied to production, branch `projects-2.0` fast-forwarded to `main`, live verification after deploy.

## Why

The live audit of 2026-11-13 found Projects was a filing cabinet: a project held only name, description and colour; no status, progress, counts or dates; no subtasks, stages, blocked state, milestones or updates; and ten defects including a silently failing project delete (BUG-087), false empty states on every load (BUG-088), and new reminders invisible until reload (BUG-089). Full audit, code audit, competitor comparison (Jira, Linear, Trello, Notion) and design reference were delivered with the mission and are filed in HQ Documents.

## What shipped

- Data (additive, reversible): `projects.stage` (idea, discovery, planning, development, testing, launch, maintenance, completed); the previously dead `projects.due_date`, `archived`, `sort_order` wired up; `reminders.status` (backlog, ready, in_progress, blocked, review, done; the completed flag stays the completion source of truth), `reminders.parent_id` (subtasks), `reminders.linked_task_id` (follow-up reminders); new tables `project_milestones` and `project_updates` with owner-only RLS. A board drag writes status only, never a date, so cascade and auto tasks are never detached.
- Attention dashboard: seven live tiles (active projects, due today, overdue, blocked, due this week, stalled 14+ days, recently completed), Needs attention list, labelled Suggested next steps panel (accept creates the task or update; nothing runs on its own), enriched project cards (counts, progress, stage chip, target date, overdue and blocked badges), search, filter, sort.
- Kanban board: all-projects and per-project, six lanes, drag plus Move-to menu plus keyboard operation, per-lane quick add, canonical TaskFormModal for editing.
- Project detail tabs: Overview (stage Stepper, health counts, progress), Tasks (board and list, subtasks, Completed section), Milestones, Updates (notes, decisions, problems, next steps, automatic entries, since-last-visit marker), Resources (document links).
- Lifecycle pipeline: projects grouped by stage, stalled projects highlighted.
- Reminder integration: Schedule follow-up on any task creates a linked reminder; the New Reminder form has an optional project selector.
- P0 fixes: BUG-087 to BUG-094 (see BUGS.md). The Bug 2 fix removed the AdminLayout page transition app-wide; it was the root cause of the fake 404 flash.

## Validation

- New unit tests for the rollup library (`projectRollups.test.js`, 15 tests); full `npm test` chain passed, ESLint clean, `npm run build` passed.
- Twelve end-to-end journeys run against the local build (create project, quick add, drag and Move-to, subtask, blocked, milestone add and complete, post update, follow-up reminder, pipeline): 12 of 12 passed, zero page errors. Screenshots in the mission record.
- Scott verified the behaviour in a clickable replica seeded with his real projects before approving the push.

## Known limits

- Resources links documents only; the doc-links system has no URL support, so no web or GitHub links yet.
- The all-projects board quick add opens the full task form instead of title-only create.
- Deferred: task dependencies, labels and saved filters, project templates, a dedicated full-bleed /admin/projects route (the board scrolls horizontally inside the tab by design), BUG-095, BUG-096.

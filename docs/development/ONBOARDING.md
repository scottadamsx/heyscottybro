# Workspace onboarding

**Status:** Governing
**Last reviewed:** 2026-09-28

This repository contains Scott's personal operating system. It holds private planning, health, financial, school, relationship, and AI-assistant features. Reliability and data integrity take priority over speed.

## Repository map

- `src/pages/` — route-level user experiences
- `src/components/` — reusable product components
- `src/api/` — browser-side data access; use these modules instead of direct queries in UI code
- `src/utils/` and `src/lib/` — pure behavior and shared services
- `src/styles/` — design tokens and the shared component system
- `api/` — Vercel serverless endpoints; capacity is constrained
- `supabase/` and root migrations — database definitions and migrations
- `docs/features/` — approved behavior, pseudocode, implementation record, and evidence
- `docs/development/` — workflow, active work, quality gates, bug log, and work log
- `ledger.jsonl` — append-only architectural decision record

`orbit/` is a synchronized read-only copy. Never edit it here.

## Environment

- Node: 24, matching CI
- Install: `npm ci`
- Development: `npm run dev`
- Required final checks: `npm run lint`, `npm test`, `npm run build`
- Secrets belong only in ignored environment files. Never print, copy, document, or commit their values.

## Start a task

1. Follow the startup sequence in `AGENTS.md`.
2. Confirm the working tree and preserve unrelated changes.
3. Find the task in `ACTIVE_WORK.md`; create a feature document from `FEATURE_TEMPLATE.md` if none exists.
4. Inspect the real behavior and record findings in the feature document.
5. Write testable acceptance criteria and pseudocode.
6. Wait for Scott's approval before implementation.

## End a work session

Update the active feature status, validation evidence, `ACTIVE_WORK.md`, and `WORKLOG.md`. Record discovered bugs in `BUGS.md`. State clearly what changed, what remains, and whether anything is unverified. Never commit, push, migrate, or deploy without Scott's approval.

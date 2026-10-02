# Active work

**Last updated:** 2026-10-01

## Journal writing tools

- **Feature document:** `docs/features/journal-writing-tools.md`
- **Requested scope:** Inspect and plan live character and word counts, privacy-safe grammar and spelling cleanup, and a writing timer within the current journal create/edit experience.
- **Approval:** Scott approved the original contract with exact **“go”** on 2026-10-01, chose the compliant expanded cleanup scope with **“cleanup everything,”** and then approved the revised ten-unit contract with exact **“go.”** Local application edits and creation of the additive migration source are authorized.
- **Current state:** `SAI00000004` is active and bound. The revised ten-unit implementation is complete and uncommitted: create/edit share Unicode counts and an active-writing timer; cleanup is authenticated, server-gated, default-off, confirmed, validated, compared, undoable, and provenance-aware; `BUG-062` is resolved locally. Thirty-one focused tests, lint, build, deterministic evals, the AI validator, function ceiling, registry check, JSON/JSONL checks, privacy review, whitespace check, and desktop/390×844 local-data inspection pass. The full suite reports 305/306 because the already-recorded unrelated `BUG-058` projection test still hard-codes two sessions while the authoritative four-session validator passes. All inherited changes remain preserved.
- **Next permitted work:** Scott said **“push,”** but `main` and `origin/main` are still identical because the completed workspace is uncommitted. The presented combined release is: commit the journal implementation plus preserved closeout records, push `main`, and verify the resulting CI/automatic Vercel Production deployment while leaving the provenance migration unapplied and cleanup disabled. Await Scott's exact **“go”** for that combined consequence. Live AI/eval calls, provider-account changes, production data, migration application, and enabling journal cleanup remain separate gates; apply the provenance migration before enabling cleanup.
- **Data restrictions:** Journal text is sensitive. Do not place it in telemetry, logs, fixtures, prompts, screenshots, or session archives, and do not make a live cleanup request during discovery.

## Frodo previews, People integrity, analytics, and activity history

- **Feature document:** `docs/features/frodo-people-analytics-activity.md`
- **Requested scope:** Diagnose and plan Frodo image previews, People event isolation/edit/delete, obsolete-page removal, truthful cross-domain analytics, reusable Activity History, and honest page-usage telemetry.
- **Approval:** Scott approved the recorded contract and pseudocode with exact **“go”** on 2026-10-01, separately approved the Orbit and main commits with exact **“go commit,”** and after consequence review approved both pushes plus automatic Vercel Production deployment with exact **“go.”** Production migration application, production-data changes/deletion, dependency changes, and live AI/API calls remain unauthorized.
- **Current state:** `SAI00000003` is closed. Orbit `c5a1b8a` and heyScottyBro `7afd2d5` are published. Vercel Production deployment `6785320311` succeeded for `7afd2d5`; the public production shell and deployed Analytics/Mission chunks are verified. GitHub Actions failed only at reopened `BUG-058`. Fresh-session authenticated smoke testing is blocked by newly logged `BUG-061`, the displayed but disabled Google provider. The additive migration remains unapplied.
- **Next permitted work:** Finish post-release/session records and present the documentation-only closeout diff for a separate commit decision. Do not fix `BUG-058` or `BUG-061`, apply the database migration, or write/delete production data without separately approved work.
- **Data restrictions:** Use real stored-record capabilities only, never fabricate historical telemetry, never expose private journal/chat contents in analytics metadata, and never use the dead `bugs` collection.

## Vercel function-limit repair

- **Feature document:** `docs/features/vercel-function-limit-repair.md`
- **Requested scope:** Restore successful Vercel Production deployment from `main` while preserving the public Kiwi shared-tasks API and the committed Today/Frodo behavior.
- **Approval:** Scott approved the recorded contract and pseudocode with exact **“go”** on 2026-09-29. After reviewing the settled implementation and exact release target, Scott said exact **“go”** again on 2026-09-29, authorizing commit, push to `origin/main`, automatic Vercel Production deployment, and live verification.
- **Current state:** Complete and released from commit `7cc8db44966d4cc9674564bd19b766444f3cbc9b`. GitHub deployment `6736243162` reports Vercel Production success, the production alias serves the new thin Morning Brief and hourly Today schedule after a full-origin refresh, Frodo passed non-destructive open/expand/close checks, and the Project Manager closed and reconciled SAI00000002. No model request or production-data write occurred.
- **Next permitted work:** Present the documentation-only post-release closeout diff for separate commit approval; no further application or production work remains.
- **Release target:** Vercel project `scottadamsxs-projects/heyscottybro`, branch `main`, production alias `https://heyscottybro.vercel.app`.
- **Deferred findings:** `BUG-055` and `BUG-056` remain direct-composition validation debt and were not expanded into this repair.

## Bonsai development session identities

- **Feature document:** `docs/features/bonsai-development-session-identities.md`
- **Requested scope:** Give every coded development session a Project Manager-owned sequential SAI identity, exact Bonsai chat title, first-message bootstrap, append-only registry, and readable glossary. This does not apply to heyScottyBro/Frodo product conversations.
- **Approval:** Scott approved the presented contract and pseudocode with exact **“go.”**
- **Current session:** `SAI00000001`, bound to Codex thread `01a0ea22-5d76-7502-a006-a16c39e7c228`; the chat title has been changed to `Bonsai Chat SAI00000001`.
- **Current state:** Complete and uncommitted. The title, registry, glossary, injection, governing-document integration, validator, decisions, and current archive reconciliation are complete. All 262 tests, zero-warning lint, production build, registry/JSONL/transcript-count, privacy/secret, 23-path manifest-inventory, whitespace, final-diff, and repository-state checks pass. Project Manager-owned SAI00000002 records are also intentionally uncommitted.
- **Next permitted work:** Preserve the governance and current-session records while the separately listed Vercel repair proceeds through its approval gate. No commit, push, migration, deployment, dependency, or production write is approved.
- **Deferred findings:** `BUG-055` and `BUG-056` remain logged without implementation. `SEC-001 — Software Security Requirements` remains queued and unstarted.
- **Approved companion rule:** `docs/features/list-card-item-counts.md` records Scott's permanent requirement that settled row-list cards show an accurate small count. This work unit changes standards only; it does not authorize an uninspected application-wide retrofit.

Only work listed here is active. Application implementation or additional scope requires Scott's exact “go” or “I approve.”

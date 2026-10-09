# Active work

## Frodo assistant expansion

- Feature: `docs/features/frodo-assistant-expansion.md`.
- Scott authorized building the expanded assistant on 2026-10-09.
- Scott requested voice and résumé-grounded file answers, then clarified app uploads and phone files selected in the app. Added owner-scoped PDF/DOCX/TXT extraction, bounded excerpts, source instructions, and explicit browser dictation/read-aloud controls. Browser dictation may send audio to its speech service. Lint/build/whitespace pass; tests and rendered/mobile verification were not run in this pass.
- Latest steering: Griphook renamed to Banker locally; Research page and navigation removed without deleting stored records. Lint, full tests and build pass. Frodo / Orbit / Banker-only consolidation is requested but not yet implemented; internal helpers and historical session clearing require compatibility review. No release or rendered UI verification yet.
- Shared execution/evidence rules and search coverage are being implemented locally. Web search, general file extraction, voice, durable memory upgrades and browser actions remain incomplete; their infrastructure is being assessed. No production activation is implied by local work.

## Admin lazy-chunk recovery

- **Feature document:** `docs/features/admin-lazy-chunk-recovery.md`
- **Requested scope:** Recover a phone/PWA admin route from the reported module-script import failure without masking genuine component errors.
- **Approval:** Scott said “go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. All admin route chunks now use the existing one-reload stale-module recovery wrapper; a blocked storage guard cannot loop. Focused tests, lint, the 325-test suite, build, and whitespace check pass. No service-worker strategy, data, dependency, migration, commit, push, or deployment changed.
- **Next permitted work:** Commit, push, and deploy require separate approval. After release, reproduce the stale-tab/PWA route transition to verify one reload and normal recovery.

## Frodo productivity foundation

- **Feature document:** `docs/features/frodo-productivity-foundation.md`
- **Requested scope:** Make Frodo’s data retrieval smarter and more productive: recurrence-aware planning, cross-collection search, and richer safe query filters.
- **Approval:** Scott said “go” on 2026-10-09 after reviewing the roadmap.
- **Current state:** Resolved locally and uncommitted. `query` now supports safe occurrence expansion and bounded rich filters; `global_search` performs source-labelled parallel retrieval without searching Vault secrets. A recurring multi-day event span now repeats correctly. Focused tests, lint, 322-test suite, build, and whitespace check pass; no database or production data changed.
- **Next permitted work:** Commit/push/release require separate approval. Batch/RPC writes, structured memory, hybrid/vector Brain retrieval, and proactive-rule delivery remain distinct future contracts.

## Admin home redirect

- **Feature document:** `docs/features/admin-home-redirect.md`
- **Requested scope:** Send an already-authenticated admin who opens the root URL to Today, while leaving the public home intact for signed-out visitors.
- **Approval:** Scott said “go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. The root route dynamically checks an existing session and replaces it with Today only for an authenticated owner. The focused test, lint, 322-test suite, and build pass; no authentication state or stored data was changed.
- **Next permitted work:** Commit/push/release require separate approval. After release, verify the redirect on a signed-in phone browser and the public-root fallback while signed out.

## Frodo history recovery

- **Feature document:** `docs/features/frodo-history-recovery.md`
- **Requested scope:** Recover Frodo when a compatible legacy display-history message is rejected, without weakening validation for unknown or unsafe saved content.
- **Approval:** Scott said “find the fix and fix it, go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. Frodo now accepts its own persisted tier-handoff `note` display rows; the focused 19-test suite, lint, complete 321-test suite, and build pass. No stored data was cleared or overwritten.
- **Next permitted work:** Commit/push/release require separate approval. After release, reload the affected Frodo session at desktop and mobile widths to confirm recovery.

## Adaptive workout progression

- **Feature document:** `docs/features/adaptive-workout-progression.md`
- **Requested scope:** Use several completed sessions, reps, optional RPE, recency, equipment increments, and transparent history to recommend gradually progressive exercise weights. Add a durable Exercises list whose records are created from exercises actually added, show derived logged PRs/history, and save one weight-times-reps goal per exercise. Form knowledge is deferred.
- **Approval:** Scott approved the original cited progression contract and load-step decision, then approved the complete expanded exercise-library/PR-goal contract and pseudocode with exact **“go”** on 2026-10-03. Local implementation is authorized.
- **Current state:** Local implementation and automated validation are complete: 30 focused cases, all 320 registered tests, zero-warning lint, and the 3,154-module build pass. The Exercises UI, derived PRs/goals, transactional schema source, progression evidence, and `BUG-065` repair are uncommitted. The configured project ref was verified as the intended linked target, but migration inspection/application is blocked because neither the official CLI nor the isolated Supabase dashboard has an authenticated owner session. No migration or database write occurred.
- **Next permitted work:** Scott approved only the exercise-library migration with exact **“go.”** After Scott signs in to Supabase, inspect the remote migration history, apply only `2026-10-03-exercise-library.sql` without including unrelated pending migrations, then validate backfill, RLS-visible data, triggers, and desktop/mobile rendering. Goal-write testing remains a separate production-data gate. Live/provider calls, unrelated production-data operations, dependency change, commit, push, and deployment remain closed.

## AI workout builder validation

- **Feature document:** `docs/features/ai-workout-builder-validation.md`
- **Requested scope:** User-led end-to-end testing of the existing **Build a workout with AI** flow, one explicit action and screenshot at a time.
- **Approval:** Scott said **“lets test”** on 2026-10-03. This authorizes observation of his live test flow, not an agent-initiated model request, application fix, save, production write, commit, push, migration, or deployment.
- **Current state:** The real-provider request completed into an unsaved six-exercise review. Visible movements were grounded, and `BUG-065` records that an explicit 60 lb request was placed only in a cue while the functional Weight field stayed blank. Scott stopped the test before exercise 3, recovery, cancellation, persistence, duplicate-submit, or database save/reload checks. Other active and inherited workspace changes remain preserved.
- **Next permitted work:** None for this validation unless Scott resumes it. No fix is approved.

## Release CI repair

- Scott requested repair after the push error. GitHub run37086391814 confirms BUG-058 is the sole failed test (six sessions versus hard-coded two).
- Scope: replace the stale test expectation with reservation-based assertions, cover registry growth and consumed closed/abandoned IDs, run all host gates, and publish the follow-up repair. No application behavior, database, dependency or provider changes.
- Completed: reproduced the exact remote failure, repaired regression and added four fixtures; full tests pass (final suite310/310), lint/build/registry pass. Next: commit/push and inspect replacement CI result.

## Orbit conversational journal

- **Feature document:** `docs/features/orbit-journal.md`
- **Approval:** Scott's 2026-10-02 instruction to oversee agents and "lets get this cooking" authorizes local implementation of the discussed journal and memory-reconciliation plan.
- **Current state:** Two supervised Sol agents implemented the backend and UI in canonical Orbit. Supervisor review, 181 Orbit tests, 6 offline checks, desktop/mobile browser checks, host lint/build and local synchronization pass. Host full suite retains pre-existing BUG-058 (305/306); no assertions were weakened. Migration source is unapplied; real provider behavior and live database semantics remain unverified. See the feature record for release limits and evidence.
- **Next permitted work:** Scott authorized "commitvchanges and push": commit canonical Orbit, synchronize from that commit, commit the host and push both main branches. The existing host deployment may run automatically. Migration application and live-provider calls remain outside authorization. Preserve other active records.

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

## Retired Bonsai development session identities

- **Feature document:** `docs/features/bonsai-development-session-identities.md`
- **Requested scope:** Give every coded development session a Project Manager-owned sequential SAI identity, exact Bonsai chat title, first-message bootstrap, append-only registry, and readable glossary. This does not apply to heyScottyBro/Frodo product conversations.
- **Approval:** Scott approved the presented contract and pseudocode with exact **“go.”**
- **Current session:** `SAI00000001`, bound to Codex thread `01a0ea22-5d76-7502-a006-a16c39e7c228`; the chat title has been changed to `Bonsai Chat SAI00000001`.
- **Current state:** Retired as a governing mechanism on 2026-10-09 at Scott's direction. Historical archives and SAI records remain available for retrieval only; they do not gate development work.
- **Next permitted work:** None. Use the ordinary documentation-first workflow and durable project records instead.
- **Deferred findings:** `BUG-055` and `BUG-056` remain logged without implementation. `SEC-001 — Software Security Requirements` remains queued and unstarted.
- **Approved companion rule:** `docs/features/list-card-item-counts.md` records Scott's permanent requirement that settled row-list cards show an accurate small count. This work unit changes standards only; it does not authorize an uninspected application-wide retrofit.

Only work listed here is active. Application implementation or additional scope requires Scott's exact “go” or “I approve.”

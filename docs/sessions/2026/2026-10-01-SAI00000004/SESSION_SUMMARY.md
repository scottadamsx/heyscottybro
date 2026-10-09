# SAI00000004 session summary

## Identity and approved boundary

- **SAI ID:** `SAI00000004`
- **Exact title:** `Bonsai Chat SAI00000004`
- **Codex thread:** `01a0f7b7-c3ae-7623-a880-dad1f4591efa`
- **Status:** Active — journal and adaptive-workout implementations complete locally; migration and release gates remain closed
- **Base:** `main` at `4d8a4063eb3ccbc49d278dcedf8425ffc6f4a481`

Scott requested journal character/word counts, grammar/spelling cleanup, and a writing timer. He approved the original plan with exact **“go,”** then directed **“cleanup everything”** after the inherited AI rules exposed a specification gap, and approved the revised ten-unit contract with a second exact **“go.”** That authorized local application edits and an additive migration source. It did not authorize live AI/eval calls, provider-account changes, migration application, feature enablement, production-data operations, a commit, push, or deployment.

Ten documentation-only SAI00000003 closeout changes predated this session and remain preserved. `BUG-058`, `BUG-061`, and the prior unapplied analytics/activity migration remain outside this task.

On 2026-10-03 Scott also requested a scientifically grounded workout-weight algorithm, then expanded it to a durable Exercises list with logged history, calculated PRs, and weight-times-reps goals such as Bench Press 225 lb × 1. He approved the research-backed progression contract, the sub-2% smallest-step decision, and the complete expanded data/UI contract with three exact **“go”** messages. Those approvals authorized local implementation and an additive migration source, but not migration application, production data, a live provider call, commit, push, or deployment.

## Outcome

### Adaptive workouts and exercise library

- Weight recommendations now analyze up to six completed same-exercise sessions, isolate repeated working loads from warm-ups, add reps within range, require two top-range confirmations before one smallest increase, cap increases at 10%, allow a smallest sub-2% equipment step, use fully logged RPE above 9 only as a brake, hold after a personal training gap, and lower one step after two poor sessions.
- Every live exercise exposes the exact session evidence, reason, and Low/Medium/High confidence behind its recommendation. Open-session sets cannot influence their own next-workout recommendation; Scott's first manually logged weight still controls later prefills that day.
- The unapplied owner-scoped `exercise_library` migration source adds normalized per-owner identity, paired weight-times-reps goals, RLS, transactional plan/session/set triggers, and historical backfill. Logged sets remain the performance source of truth.
- Health gains an Exercises tab with an accurate count, complete logged-set history, heaviest-load PR, best estimated-strength PR with its producing set, exact actual-set goal achievement, and clearly labelled estimated progress. Edits/deletions recalculate rather than leaving stale PR rows.
- `BUG-065` is resolved locally: explicitly supplied AI-workout weights use structured `startWeightLb`; a deterministic client check removes any model weight absent from Scott's prompt. No live provider call was made.
- Form knowledge is intentionally deferred, while the exercise record can be extended by a later approved feature.

### Journal writing tools

- Journal create and edit now share Unicode-aware live body character and word counts.
- A local active-writing timer starts on first body input, supports pause/resume/reset, auto-pauses after 60 seconds idle or when hidden/blurred/closed, checkpoints every five seconds, and restores through schema-2 drafts. Schema-1 drafts remain readable.
- Journal cleanup is absent unless an authenticated status check finds both the server key and `JOURNAL_CLEANUP_ENABLED=1`, and the default-off device connector is enabled.
- Cleanup requires explicit Anthropic disclosure/confirmation, sends only the captured body, uses a server-owned centrally configured Sonnet model and versioned grounded prompt, preserves user emoji through exact placeholders, validates structured output, and retries at most once only after invalid output.
- A local comparison shows original, suggestion, and accessible insert/delete changes. **Use suggestion** updates only the draft, **Undo cleanup** restores the original, and the normal Save action remains separate. Stale responses cannot overwrite later typing, another entry, a closed editor, or an owner change.
- The additive unapplied migration introduces nullable `journal.ai_provenance`. Exact-match accepted text can show **Cleaned with AI** plus model, prompt version, and time; manual edits and undo clear provenance.
- `BUG-062` is resolved locally: the journal index reports `N of M` while pagination hides loaded rows and `N` when complete.
- Every provider model literal now comes from `src/config/aiModels.js`; the browser-prefixed Anthropic key fallback is removed; the deterministic `npm run eval` entry point and journal prompt are present; the inherited AI validator is green.
- Local development `/api/chat` now uses the same authenticated route and cleanup boundary as production.

No dependency or thirteenth Vercel function was added. No journal row, private/production data, provider configuration, live model, deployed environment, or database schema was touched.

## Validation evidence

- 30 focused adaptive-progression, explicit-weight, goal-validation, and derived-PR cases pass.
- The complete registered suite passes 320/320; zero-warning lint and the 3,154-module production build pass.
- Local Health rendering correctly showed a visible retryable schema error because the exercise migration is intentionally unapplied. It did not fabricate an empty list. The actual Exercises desktop/mobile layout, backfill, RLS, triggers, and persistence remain unverified until separate migration approval.

- 31 focused feature tests pass across cleanup, route compatibility, client availability, settings, counts/timer, drafts, and the assembled Journal source boundary.
- `npm run lint` passes with zero warnings.
- `npm run build` passes across 3,151 modules with only the existing chunk-size advisory.
- `npm run eval` passes five deterministic fixtures; it makes no provider request.
- The inherited AI validator is green for AI-1/2/3/5/6/7.
- The Vercel function ceiling remains 12.
- `npm run session-registry:check` passes with four IDs and `SAI00000005` next.
- Manifest, registry, and ledger JSON/JSONL parsing; privacy/path review; and `git diff --check` pass.
- `BUG-058` was repaired and released by separate approved work before the final adaptive-workout quality run; it no longer limits this session's suite.
- Isolated local-data inspection passed at desktop and exactly 390×844 using only non-sensitive test text. The sample reported 24 graphemes and four words; first input started the timer, Pause froze it at `00:06`, and reload restored the paused timer and text. The mobile sheet, textarea, wrapped controls, 44-pixel actions, draft status, and footer had no clipping or overlap. Cleanup was absent while unavailable.

## Records and decisions

- `docs/features/adaptive-workout-progression.md` is the approved exercise/progression source of truth; `docs/features/ai-workout-builder-validation.md` preserves the user-led test and `BUG-065` evidence.
- `DR-027` records durable exercise identity, derived PRs, exact goals, transactional auto-creation, and transparent multi-session progression.

- `docs/features/journal-writing-tools.md` is the approved feature source of truth and records all ten implementation units, acceptance evidence, and remaining gates.
- `DR-026` records the durable authenticated, server-owned, provenance-aware cleanup architecture.
- `CHANGELOG.md`, `ACTIVE_WORK.md`, `WORKLOG.md`, `BUGS.md`, `docs/rebuild/current-system.md`, `.env.example`, and this archive reflect the final local state.
- `BUG-062` is resolved locally and uncommitted. `BUG-058` remains the only aggregate-suite failure and is explicitly outside this contract.
- The session remains Active because Scott has not authorized a commit and no Project Manager lifecycle transition is appropriate yet. The Project Manager-owned registry and glossary were not altered during closure.

## Remaining risks and exact handoff

- The exercise-library migration is unapplied. Health intentionally fails visibly against the current schema, so apply the migration before shipping the dependent code.
- Scott approved that migration alone with exact **“go.”** The configured Supabase project ref was verified, but the CLI has no saved access token and the isolated dashboard requires Scott's sign-in. No SQL ran; resume by authenticating, inspecting remote migration history, and applying only the exercise-library file rather than all pending migrations.
- After a separately approved migration application, verify historical backfill, owner RLS, plan/live/set auto-creation, concurrent deduplication, goal persistence/clearing, set edit/delete recalculation, and desktop/mobile rendering.
- The SQL source has been statically reviewed but not executed against PostgreSQL. No database or production-data change is claimed.

- The migration source exists but is unapplied. Apply it before enabling journal cleanup in any environment; otherwise saving accepted provenance can fail.
- The feature flag remains off and the device connector defaults off. Deployed no-key behavior and two live-model eval runs remain unverified because those actions were not authorized.
- Mocked and deterministic checks establish boundary correctness, but live provider output quality is intentionally not claimed.
- The implementation and documentation trail remain uncommitted in a working tree shared with other approved sessions. Review exact file ownership before any commit; do not sweep unrelated changes together.
- Next decision: separate approval to apply the exercise-library migration in the intended environment. Commit, push, deployment, journal migration/enablement, and live AI/evals remain separate gates.

## Productivity and process notes

- The required pre-edit AI review prevented a non-compliant client-selected cleanup design from entering application code. The only design rework occurred in the recorded contract before implementation.
- One route test initially appeared as a thirteenth Vercel function; moving it outside `api/` restored the ceiling without changing runtime behavior.
- One full-suite failure was reproduced, matched to existing `BUG-058`, and left deferred rather than expanding scope.
- One directly related defect (`BUG-062`) was closed with regression coverage. No unrelated defect was fixed.
- The adaptive feature closed one directly related defect (`BUG-065`) and added 30 focused cases. One test-harness import attempt was replaced by a pure validator utility rather than weakening module resolution.
- Rendered verification stopped at the unapplied-schema boundary as required. No attempt was made to bypass the migration approval gate.
- No subagents, new dependencies, live external calls, or destructive operations were used.

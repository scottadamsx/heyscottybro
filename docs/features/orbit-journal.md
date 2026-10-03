# Orbit conversational journal

Status: Scott authorized commit and push of the current changes. Database migration
application and live-provider testing remain unauthorized and unperformed.

## Commit and push authorization

Final pre-push checks: Orbit183/183 and build pass. Canonical commit `307d71c`
was synchronized from a clean tree. Host lint/build pass; its node suite is305/306
with known BUG-058. Database migration and real-provider verification remain open.

Scott's latest instruction, "good job. commitvchanges and push", authorizes committing
the current Orbit and host changes, syncing from committed Orbit, and pushing both
main branches to their existing origins. The host push may trigger its existing
automatic deployment. This supersedes the earlier no-commit/no-push boundary below,
but does not authorize applying the migration or making real-provider calls.

User-led synthetic checks confirmed new Morgan creation, linked event, empty Notes,
reload persistence, existing-person reuse, duplicate-event receipt, and undo of the
duplicate while preserving Morgan and one original event. Typo handling with a real
model and a new-day repeat remain unverified. The duplicate receipt sentence remains
a known presentation issue. Successful undo now closes the drawer and toasts; mocked
browser checks cover both successful dismissal and failure staying open.
Undo navigation follow-up: after a successful undo, close the Orbit drawer and
show the existing toast "Save undone", returning to the underlying view. Failed
undo keeps the drawer open with its error. Undone records remain accessible through
Entries; they are not a mandatory completion screen.
Coverage qualification: selected local flows pass, but the full user-led scenario
matrix is not complete. Unknown-person creation is the next screenshot-led test;
real-provider and real-database scenarios remain untested.

BUG-064: original journal text must never be copied into event Notes. Source text
stays on the linked original entry; no generated note is invented as a fallback.
The event builder now leaves Notes empty. The exact clarified-date case verifies
source preservation, empty Notes and successful undo. Only Scott's identified
synthetic event was repaired, with its undo snapshot kept consistent; no real data
was changed. An existing test asserted the defective copying behavior and was
updated to assert the corrected separation instead.

UI follow-up: Scott requested one Log a hangout button and the title Orbit.
Removed the duplicate Journal quick action, renamed the drawer and manual-mode
switch to Orbit, and retained history/manual entry within the same flow. The nine
focused component tests pass; changes are synchronized locally and uncommitted.

Composer simplicity follow-up: Scott requested minimal chatbot controls and an
Entries button instead of an always-visible history list. History now starts hidden
and toggles through Entries; saved data and contextual entry actions are unchanged.
The composer uses the full available width while history is hidden. This preference
is recorded in host AGENTS.md and canonical Orbit CLAUDE.md for future work.
Owner: Project Manager, with two supervised implementation agents.
Date: 2026-10-02

## Request and authority

Scott requested journal-style hangout logging followed by a second AI pass that
compares every extracted fact with existing Orbit memory and files useful new facts.
The discussed plan includes person disambiguation, incomplete entries, dated facts,
source attribution, duplicate protection, receipts, edit and undo.
Scott then instructed: "are you able to over see agents and report back to me.
lets get this cooking" after discussing Sol implementation with Astra supervision.
That latest instruction authorizes local implementation and delegated agents. It
takes precedence over the older exact-phrase approval wording for this work only.
No commit, push, production deployment, live AI call, dependency change, production
data write, or application of a database migration is included.

## Existing system

Orbit is maintained in ../orbit and synchronized into this repository. Both working
trees were clean at inspection. Orbit base: c5a1b8ab065bd4a64d71399e9001a11f8293c83b;
host base: 5b57081938f43ed0cfbb01a336fbc88755052daa. The existing Anthropic connector,
versioned prompts, validated repo writes, and owner-authenticated hosted API are reused.
Existing person records support facts grouped by topic and a how-met field. Events
need an exact date, so unresolved journals must not masquerade as completed events.
Cloud writes currently use one RPC but have last-write-wins semantics; this feature
needs guarded transactions to protect retries and undo across server instances.

## Contract

- Add a journal conversation to the existing hangout entry point; keep manual entry.
- Persist the original entry before processing. Keep unresolved entries available
  across reloads with a visible needs-details status, separate from event statistics.
- Extract event information and explicit profile facts in a bounded structured pass.
  Reconcile extracted facts against relevant existing records in a second pass.
- Each fact is added, already known, needs clarification, or retained only as context.
  An activity at one event never establishes a lasting preference or habitual venue.
- Resolve today/yesterday against the captured local date and IANA timezone. Ask for
  an exact date when wording is approximate; never invent a day for "last week".
- Resolve unique exact names/aliases; ambiguous identities and new people need a
  targeted question. Do not infer an employer from "from work".
- Clear entries save automatically with a factual receipt. Ambiguous entries ask
  only for missing decisions, then continue. Store source, model, prompt versions,
  processing time, and fact outcomes. Preserve earlier facts when information changes.
- Validate AI output, identities, allowed destinations, references and types in code.
  The model cannot execute database operations. Malformed output gets at most one
  retry per pass. Provider failure preserves the entry and a useful retry state.
- Add a versioned journal collection and an additive, unapplied Supabase migration
  with owner-only access and atomic conditional writes. Existing installations keep
  working and disable journal functionality until the capability is available.
- Stable entry IDs and revision checks prevent replay and stale writes. Undo reverses
  only this entry's mutations, refuses destructive conflicts, and preserves later data.
- Journal text and person details must not enter diagnostics or general audit logs.
  Live provider requests remain unverified in this session; deterministic fake-provider
  integration tests must cover both passes and failure paths.
- Responsive modal/drawer; labeled controls; keyboard operation, busy guards, visible
  errors, focus handling, readable long content, accurate entry counts. No new dependency.
- General natural-language recall/search is a later feature. Saved facts and events
  remain accessible through existing profile, event and search views.

## Pseudocode

1. Opening Log a hangout offers journal entry when journal storage and AI are ready,
   alongside manual entry. Existing pending entries remain readable without AI.
2. Sending text assigns a stable entry ID, captures local date/timezone, saves the
   untouched text as a versioned journal entry, then requests processing for its revision.
3. Extraction receives only that entry and its follow-up answers. Validate its output.
   Match mentions against the owner's roster. Retrieve only relevant profile fields.
4. Reconciliation classifies every extracted fact against existing memory. Validate
   all decisions and evidence; build a bounded set of proposed changes in code.
5. If identity/date/fact decisions remain, persist questions and show needs details.
   Save follow-up answers durably, then repeat processing against the original context.
6. Otherwise stage all validated people/fact/event changes and the journal receipt.
   Check expected revisions and atomically persist them. Only then report saved.
7. Retry uses the same entry ID. A committed entry returns its existing receipt.
   Failure never discards original text or claims a successful save.
8. Undo compares current data with this entry's changes. Reverse only compatible
   changes in one guarded transaction; otherwise retain data and explain the conflict.

## Ordered work and ownership

Shared transport contract (the backend may add private internal fields):

- `health.journal.available` advertises storage readiness independently of AI readiness.
- `GET /journal` returns `{ok, entries, available}` with entries keyed by ID.
- `PUT /journal/:id` accepts `{text, referenceDate, timeZone, revision?, answers?}`
  and returns `{ok, entry}`. Follow-up answers are a question-ID to string map.
- `POST /ai/journal/:id` accepts `{revision}` and returns `{ok, entry}`.
- `POST /journal/:id/undo` accepts `{revision}` and returns `{ok, entry}`.
- Entries have `id`, `schemaVersion:1`, `revision`, `text`, `referenceDate`,
  `timeZone`, creation/update timestamps, `status`, `questions`, `answers`, optional
  `receipt`, `error`, and `provenance`. Status is draft, needs_details, saved, undone,
  or error. Questions contain `id`, `text`, `kind` (date/person/fact) and optional
  choices `{value,label}`. Receipts contain `summary`, `lines`, and optional `eventId`.

1. [x] Inspect both repositories, architecture, storage boundaries and project rules.
2. [x] Record scope, authority, contract, pseudocode and agent ownership.
3. [x] Backend agent: journal storage, guarded API, two AI passes, matching, dates,
   reconciliation, provenance, receipts/undo, migration source and focused tests.
4. [x] UI agent: journal conversation, entry history, clarification, receipts, undo,
   manual fallback, source display, adapters and responsive styles.
5. [x] Supervisor: reconcile API contract, review patches and integrity edge cases.
6. [x] Synchronize the local Orbit changes into heyScottyBro without committing.
7. [x] Run focused and full automated checks in both repositories.
8. [x] Render and exercise desktop/mobile with synthetic data only.
9. [x] Complete records, archives, final diff review and handoff.

## Validation and remaining work

Local implementation and independent review are complete. No real journal/profile
data has been read or sent to a model. All changes are uncommitted.

- Orbit final `npm test`: 181/181 passed. The backend agent also reports two full
  passes. Offline `npx vitest run --config evals/journal-vite.config.js`: 6/6 passed.
- Orbit build, UI, AI, ledger and whitespace checks passed. Ledger compilation
  retains its pre-existing DRAFT state with 32 unconfirmed defaults.
- Host lint and production build passed. Full host suite retains the same known
  BUG-058 failure: 305/306 in its final node suite, earlier suites passed. The
  authoritative registry validator passes; the stale assertion was not weakened.
- Synthetic real-browser tests passed save/event/fact, pending person/date questions,
  390px bounds and no page errors. Host-style shadow-root verification passed light
  desktop 1365x900, dark mobile 390x844, focus containment and Escape close.
  Final continuation also passed reload of a pending entry, exact identity/date
  answers, successful undo, edited-event undo conflict, and AI-off manual fallback.
- No new serverless function or dependency was added. The existing Orbit function
  includes both versioned prompts. The host's central model setting is preserved
  by an explicit sync integration rather than being overwritten by standalone config.
- Migration sources are identical but not executed against Postgres. Cloud tests
  use a deterministic simulated adapter; they do not prove live RLS/RPC behavior.
- Live Anthropic accuracy, provider compatibility and latency are unverified.
  The local preview uses a fake localhost provider and synthetic people only.
- Export now includes journal entries. Import still handles people/events only;
  it is not a journal restore flow. Local journal backups remain the recovery path.
- General chatbot recall and full journal restore/import remain outside this slice.

Release order: review the uncommitted diff; approve and test the migration in an
isolated database; evaluate both prompts against synthetic cases with the real
provider; approve source commit and host sync; approve push/deployment and migration
application; verify authenticated hosted behavior. Existing BUG-058 and BUG-061
remain separate known host issues. Do not describe this feature as live yet.

Baseline verification before implementation:

- Orbit `npm test`: 136/136 passed.
- heyScottyBro `npm test`: 305/306 node-suite tests passed; the existing BUG-058
  session-registry fixture still assumes exactly two sessions. Earlier suites passed.
  This unrelated defect is deferred; no test assertion was weakened.
- `npm run session-registry:check`: passed, six valid identities, next SAI00000007.
- Runtime available in the shell is Node 22.23.2; project CI targets Node 24.

## Activity

- 2026-10-02: Completed read-only discovery and confirmed canonical Orbit ownership.
  Identified separate pending-entry storage and guarded cloud writes as required work.
- 2026-10-02: Reserved, bootstrapped, titled, bound and activated backend SAI00000005
  and frontend SAI00000006 as Sol High subagents. Confirmed disjoint write ownership
  and a common journal API/entry contract before application changes.
- 2026-10-02: Supervisor reviewed initial persistence and UI changes, requested stable
  draft retry IDs and cloud guards shared with ordinary writes. Prepared an isolated
  localhost preview using synthetic contacts, separate files, and a fake local provider.
  Updated the existing sync script so --allow-dirty accurately records uncommitted
  source provenance instead of claiming the generated copy exactly matches a commit.
  Host baseline lint passed with zero warnings.
- 2026-10-02: Initial real-browser smoke passed synthetic journal-to-event and profile
  fact save, ambiguous person/date pending state, 390px layout width, and no page errors.
  Reviewed desktop/mobile screenshots. Follow-up review requested truthful descriptive
  receipts, immutable source text, supported-fact preservation and edited-event undo guards.
  These are interim checks; final backend changes still require a complete rerun.
- 2026-10-02: Embedded-style browser verification passed desktop light (1365x900)
  and mobile dark (390x844), with the actual host token stylesheet and Orbit shadow-root
  scoping. Verified drawer bounds, keyboard focus containment and Escape close. Evidence
  is synthetic and stored only in the local temporary preview directory.
- 2026-10-02: Supervisor added eight independent regressions for missing/relative dates,
  replay, bounded invalid-output retry, invented date rejection, contradictory facts,
  edited-event undo and independent fact support. All passed. Interim full Orbit suite
  passed 175/175 after rerunning HTTP tests with localhost permission (the first scoped
  invocation could not bind a test port). No test was weakened for the environment.
- 2026-10-02: Completed review corrections for attribution, negation, existing
  coworker fields, semantic fact support, duplicate creation races and stale writes.
  The expanded suite exposed pending file-write cleanup in test setup/teardown;
  explicit flushes fixed the race, and the independent 181-test rerun passed.
  Synchronized the feature, verified the host build/lint and preserved its central
  model policy. No production operation or real provider call occurred.

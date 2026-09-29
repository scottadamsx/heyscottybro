# Feature: Bonsai development session identities

**Status:** Complete — uncommitted  
**Owner:** Scott  
**Started:** 2026-09-29  
**Approval:** Scott said exact **“go”** after reviewing the contract and pseudocode.

## User problem

Development chats need durable identities and consistent startup context. A future agent or supervisor should be able to identify a session, find its records, and understand its authority without relying on chat history.

## Desired outcome

Every coded development session is created and tracked by the Project Manager under a unique sequential `SAI########` identity. Its exact chat title is `Bonsai Chat SAI########`, its first visible message is a structured Project Manager injection, and its current status is available in both a human glossary and an append-only machine registry.

## Current behavior

Session archives are keyed by immutable Codex thread IDs. They preserve context well, but there is no short human-facing identity, central ID glossary, collision check, or standard Project Manager bootstrap.

This existing thread is the seed session. Scott assigned it `SAI00000001` after it had already begun, so its title and records are being updated retrospectively. Its existing archive path remains stable.

## Scope

### Included

- Sequential IDs beginning with `SAI00000001`, zero-padded to eight digits.
- Exact titles in the form `Bonsai Chat <SAI ID>`.
- Project Manager-only reservation, binding, and lifecycle recording.
- An append-only JSONL registry and a readable glossary.
- A reusable first-message injection template and startup gate.
- Dual identity: SAI ID for people; immutable Codex thread ID for technical traceability.
- Updated workflow, onboarding, archive, decision, and current-session records.
- A local validator for uniqueness, sequence, event order, thread binding, titles, and glossary coverage.

### Not included

- heyScottyBro/Frodo product conversations or any other non-development chat.
- Renaming or moving historical archive folders automatically.
- Product code, production data, dependencies, migrations, deployment, or external AI/API checks.
- Giving the injection higher authority than Scott or repository rules.

## Experience contract

- The Project Manager reserves the next unused ID before creating or renaming a development chat.
- An ID is never reused, including after abandonment.
- The chat title contains only `Bonsai Chat SAI########`; the glossary carries the friendly purpose.
- A new development chat receives the complete bootstrap as its first visible prompt.
- If a development chat has no valid ID or bootstrap, the agent stops before code changes and routes it through Project Manager registration.
- The seed session `SAI00000001` is explicitly marked retrospective because its start cannot be changed after the fact.

## Acceptance criteria

- [x] `SAI00000001` is reserved and bound to this thread exactly once.
- [x] The current chat title is `Bonsai Chat SAI00000001`.
- [x] The append-only registry rejects duplicate IDs, skipped reservation numbers, duplicate thread bindings, invalid titles, and lifecycle events before reservation.
- [x] The glossary lists every reserved ID and its purpose, status, thread, and archive/summary links.
- [x] The Project Manager injection names scope, authority, approval state, repository state, constraints, inherited context, validation, and closure requirements.
- [x] Governing startup and archive documents describe the same contract.
- [x] Current session records retain the original title and stable archive path while adding the SAI identity.
- [x] Local documentation and registry checks pass.
- [x] No commit or push occurs without separate approval.

## Edge cases

- A reserved chat that is never used becomes `abandoned`; its number remains consumed.
- A chat can have only one SAI ID, and an SAI ID can bind to only one Codex thread ID.
- A newly created chat may not expose its immutable thread ID until creation completes; reserve first, then append the binding event.
- Existing archives keep their paths. New archives use the SAI ID in the folder name and retain the thread ID in their manifest.
- Corrections use new registry events; prior JSONL records are never edited or removed.
- The human glossary is a current projection. The JSONL registry is the lifecycle history.

## Pseudocode

```text
WHEN the Project Manager opens a coded development session
  READ every registry event and validate the existing history
  FIND the highest SAI number ever reserved
  RESERVE exactly the next number and append the reservation before chat creation
  CREATE or rename the chat to "Bonsai Chat <SAI ID>"
  BIND the immutable Codex thread ID to that reserved SAI ID
  APPEND the binding without changing earlier registry events
  ADD or refresh the glossary entry and session archive metadata
  SEND the Project Manager bootstrap as the first visible prompt

WHEN the development agent receives the bootstrap
  TREAT it as handoff context below Scott and repository rules
  READ the required startup documents and inspect Git state
  REPORT the plan and approval boundary briefly
  DO NOT change application code until Scott gives an accepted approval phrase

WHEN the session changes state
  APPEND an activated, closed, or abandoned event
  REFRESH the glossary projection and session archive records
  NEVER reuse its number

VALIDATE locally
  REQUIRE IDs to match SAI plus eight digits
  REQUIRE reservations to begin at 1 and remain sequential without duplicates
  REQUIRE exact titles and reserve-before-bind ordering
  REQUIRE one-to-one SAI/thread bindings
  REQUIRE every reserved ID to appear in the glossary
```

## Ordered task checklist

- [x] Step 1 — Record the approved contract, pseudocode, ordered work, and seed-session title change.
- [x] Step 2 — Create the append-only registry, glossary, and Project Manager injection template.
- [x] Step 3 — Update governing startup, workflow, onboarding, and archive documents.
- [x] Step 4 — Add and run the deterministic registry validator.
- [x] Step 5 — Update the current archive, decision ledger, work log, and active-work handoff.
- [x] Step 6 — Complete the post-task checklist and report the uncommitted result.

## Implementation record

- Chat title changed to `Bonsai Chat SAI00000001` through the Codex thread-title control.
- Added `docs/sessions/registry.jsonl`, `GLOSSARY.md`, and `PROJECT_MANAGER_INJECTION.md` as the machine history, human index, and reusable startup contract.
- Integrated the identity gate and lifecycle rules into `AGENTS.md`, workflow, onboarding, documentation navigation, archive policy, and the post-task checklist.
- Added a dependency-free validator plus seven regressions for sequence, uniqueness, binding order, exact titles, and glossary coverage.
- Added `DR-024` and reconciled the current transcript, manifest, and supervisor summary while retaining the stable legacy archive path.
- No product code, production state, dependency, migration, deployment, commit, or push is in scope.

## Validation

- Automated: `npm run session-registry:check` passed and selected `SAI00000002` next; all 262 registered tests passed; zero-warning lint passed; production build passed with the existing mixed-import and large-chunk advisories; manifest/registry/ledger JSON and transcript counts passed; `git diff --check` passed.
- Visual check: Not applicable; this is development governance.
- Known limitation: The seed session's bootstrap is retrospective because the thread predates this system.
- Post-task review: All 23 changed paths are present in the manifest; high-risk secret, unsafe transcript path/context, unrelated-diff, and repository-state checks passed. `CHANGELOG.md` and `BUGS.md` were not changed because no product behavior or software defect changed.

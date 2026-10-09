# Feature: Frodo history recovery

**Status:** Approved implementation
**Owner:** Scott
**Started:** 2026-10-09
**Approval:** Scott said “find the fix and fix it, go” on 2026-10-09.

## User problem

Frodo cannot open when an older stored display-history message no longer matches the strict current validator. The user sees a retry loop even though the record may contain enough safe content to recover.

## Desired outcome

Frodo loads safe legacy display messages, preserves the existing fail-closed handling for unsafe or unrecognizable content, and remains usable after a compatible history upgrade.

## Current behavior

`agentSessionsCore` rejects the entire Frodo history whenever any display message fails `isValidDisplayHistory`, producing “stored display history contains an unsupported message; no data was changed.”

## Scope

### Included

- Inspect the display-history compatibility boundary and the persisted Frodo shape.
- Add a conservative, tested normalization path for known legacy display-message forms.
- Preserve fail-closed behavior and no-write semantics for unsupported content.

### Not included

- Clearing or overwriting production chat history.
- Changing model-history validation, ownership, attachment storage, or data schema.

## Experience contract

- Desktop and mobile: Frodo becomes usable once a compatible legacy record is normalized.
- Keyboard and screen reader: Existing loading, error, retry, focus, and labelled-control behavior remains unchanged.
- Error state: Unknown or unsafe message shapes still fail without writing data.
- List-card counts: Not applicable.

## Acceptance criteria

- [x] A known legacy Frodo display message hydrates and is saved only through the existing authenticated persistence path.
- [x] Unsupported display/model messages remain blocked before any write.
- [x] Existing valid display messages retain their fields and behavior.
- [x] The focused regression suite, lint, full tests, and build are recorded.

## Edge cases

- Empty or absent display history remains an empty safe history.
- A mixed valid/legacy display history normalizes only recognized legacy messages.
- Null, primitive, malformed nested, owner-mismatched, and future model-history data remains rejected.

## Pseudocode

```text
WHEN Frodo session history loads
  VALIDATE the row owner and top-level display/model arrays as today
  FOR each display message
    ACCEPT it unchanged when it matches the current safe display contract
    OTHERWISE, recognize only an explicitly supported legacy display shape
    NORMALIZE that shape into the current safe message contract without inventing content
    REJECT every other shape before the session becomes writable
  KEEP model-history validation strict and unchanged
  RETURN the normalized display history to the existing hydration flow

WHEN validation rejects a message
  SHOW the existing error and retry control
  DO NOT write, clear, or overwrite stored history

TEST valid, legacy-compatible, mixed, and unsupported display histories
  ASSERT compatible messages hydrate safely
  ASSERT unsupported content still fails before any write
```

## Ordered task checklist

- [x] Step 1 — Record the request, contract, and approved recovery boundary.
- [x] Step 2 — Identify the exact incompatible legacy message form and update the compatibility helper.
- [x] Step 3 — Add focused regression coverage and run required checks.
- [ ] Step 4 — Verify the rendered Frodo experience at desktop and mobile widths after release.
- [x] Complete the post-task checklist, except the post-release visual check.

## Implementation record

- Files changed: `src/api/agentSessionsCore.js`, `src/api/agentSessionsCore.test.js`.
- Decisions: Allow only Frodo's existing `note` display role; do not mutate unknown historical content or broaden model-history acceptance.
- Data or API changes: None planned.

## Validation

- Automated: `node --test src/api/agentSessionsCore.test.js` (19/19), `npm run lint`, `npm test` (321/321), and `npm run build` (3,154 modules) passed on 2026-10-09.
- Desktop visual check: Pending release; the local environment has no authenticated Frodo session carrying the affected saved message.
- Mobile visual check: Pending release; the local environment has no authenticated Frodo session carrying the affected saved message.
- Known limitations: This is a local, uncommitted repair. No stored history was altered or cleared; live confirmation requires a released build and normal reload.

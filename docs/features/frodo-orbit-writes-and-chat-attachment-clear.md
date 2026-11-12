# Feature: Frodo writes to Orbit, and the chat composer clears sent attachments

**Status:** Built and verified locally 2026-10-28; committed locally, push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-10-28

## User problem

Scott asked Frodo (with a screenshot attached) to add Aaron Burke to Orbit, noting they used to work together at Anderson's Butcher. Frodo replied that the People collection is read-only for it and sent Scott to People › Interview me. Scott's framing: "a clear bug in Frodo's capabilities to pass stuff to orbit and for orbit to pass stuff to frodo." In the same screenshot, the attached image's preview stayed in the composer after the message was sent ("it sticks around even after sent").

## Desired outcome

- Frodo can add a new person to Orbit and edit an existing person (name plus context: how Scott knows them, notes, saved facts) and confirm what it saved, without sending Scott to another flow.
- Orbit data keeps flowing back to Frodo (reads already work through the Library `people` query).
- After Scott sends a chat message with an image attached, the composer's attachment preview clears as the message is handed off; if the send is refused, the attachment comes back so nothing is lost.

## Current behavior

- Bug 1 (BUG-075): the Library registers `people` with `load` only (src/api/aiLibrary.js), so the generic write tools refuse it with "people is read-only". Its catalog description and Frodo's system prompt (src/api/aiTiers.js) both tell the model People is read-only and to redirect Scott to People › Interview me. The People UI writes through Orbit's own API (`PUT /api/orbit/people/:id`, the signed-in session's token), whose server (Orbit's repo module) validates and de-duplicates every write. The Library never calls that API.
- Bug 2 (BUG-076): ChatBot's `doSend` clears staged composer shots only after `sendMessage` resolves, and `sendMessage` runs the entire agent turn (model calls, tool calls, escalations) before returning. The sent message appears in the transcript immediately, but its attachment preview stays in the composer for the whole reply, which reads as "stuck after sent".

## Scope

### Included

- Library `people` gains create and update through Orbit's own API (`/api/orbit`), the same endpoint, token, validation, and duplicate rules the People UI uses. No direct writes to the `orbit_people` rows.
- Create supports name (required), group, birthday, how, notes, and facts (appended "label: value" pairs). Update supports the same fields, merged into the person's existing Orbit document so facts, intents, and everything not named are preserved.
- `people_events` stays read-only (hangout logging already has its own Journal–Orbit flow).
- Frodo's system prompt and the `people` catalog description stop claiming read-only and describe the write path, including the duplicate-name behaviour.
- ChatBot clears the sent shots from the composer when the message is handed to `sendMessage`; a refused send (returns false) restores them.
- Ledger record DR-034 for the capability decision; CLAUDE.md's People paragraph updated to match.

### Not included

- Deleting people from Frodo (Orbit's delete cascades into events; not requested).
- Writing `people_events`, settings, merges, or imports from agents.
- Editing anything under `orbit/` (read-only copy; no Orbit change is needed, its API already supports this).
- Any migration, dependency change, or production-data write by the agent doing this work. Push/deploy: separate approval gate (see Approval).

## Experience contract

- Desktop: unchanged surfaces; Frodo confirms a saved person by name in chat.
- Mobile: same; the composer thumbnail strip empties when a message with an image is sent.
- Keyboard and screen reader: no control changes; the existing status announcements cover the turn.
- Loading, empty, and error states: a refused or failed Orbit write returns Orbit's own message (for example an exact-name duplicate) as the tool error, so Frodo reports it instead of claiming success. A refused chat send restores the staged thumbnails.
- List-card counts: not applicable (no list card changes).

## Acceptance criteria

- [x] `create_item` on `people` with a name creates the person through `PUT /api/orbit/people/:id`; the tool result echoes the stored name, group, how, and birthday. (Verified against the real Orbit server; see Validation.)
- [x] `update_item` on `people` changes only the named fields; existing facts and intents survive.
- [x] An exact-name duplicate create surfaces Orbit's duplicate error, not a silent second record.
- [x] `facts` passed as "label: value; label: value" are stored as Orbit facts; a malformed pair is a clear validation error and nothing is written.
- [x] `open_items` passed on a write is refused with a message pointing at notes (intents are not round-tripped from the flattened summary).
- [x] Neither the system prompt nor the catalog describes `people` as read-only or redirects to Interview me for adds/edits.
- [x] Sending a chat message with an attached image empties the composer thumbnail strip at handoff; if `sendMessage` refuses, the thumbnails return. (Pinned by the source-order regression test; signed-in rendered check deferred to the post-deploy pass, see Validation.)
- [x] Lint, full test suite, and production build pass; new pure-logic tests cover the person doc build/merge/facts parsing.

## Edge cases

- Update for an id Orbit no longer has: Orbit's current-document read finds nothing, the write is refused with a "query for the real id" message (the Library also pre-checks existence through its normal read path).
- Facts that link to another person (`ref`) are never created by this gateway; parsed facts carry no ref.
- A shot removed from the composer before sending is untouched by the send clearing (clearing is by the sent shots' ids, not "all shots").
- Shots that failed decoding (`rejected`) were never sendable and stay in the composer, as today.
- A screenshot staged during a turn is not one of the sent shots and stays staged.

## Pseudocode

```text
Bug 1 — Library people writes (src/api/peopleApi.js + pure helpers in src/api/peopleCore.js)

createPerson(data):
  1. If data.open_items is present, stop with a clear error (intents are a
     read-only summary in the Library; the detail belongs in notes).
  2. Parse data.facts, when present, from "label: value; label: value" into
     Orbit fact objects { k, v }. A segment without a label and a colon is a
     validation error; nothing is written.
  3. Build the same document the People UI's Add People form saves:
     { name, group or "other", birthday or "", how or "", notes or "",
       facts, intents: [], createdAt: now } under a fresh Orbit person id
     (Orbit's own id generator).
  4. PUT /api/orbit/people/<id> with the signed-in session's auth headers —
     the exact request the People UI makes. Orbit's server validates the
     document and refuses exact-name duplicates; any refusal is thrown as
     the tool error, unchanged.
  5. Return the stored document flattened the same way loadPeople flattens
     it, so the Library echoes what was actually saved.

updatePerson(id, data):
  1. Same open_items and facts guards as create.
  2. GET /api/orbit/people (the UI's list call) and take the person's current
     full document. Missing id → clear error, nothing written.
  3. Merge only the fields Scott named (name, group, birthday, how, notes)
     onto the current document; append parsed facts to its existing facts.
     Everything else (intents, createdAt, linked facts) is preserved as-is.
  4. PUT the merged document to /api/orbit/people/<id>; Orbit validates it
     again (a rename onto an existing exact name is refused server-side).
  5. Return the stored document flattened, like create.

Registration (src/api/aiLibrary.js): the people collection gains
create/update and a description that teaches the write path; name becomes
required on create. The catalog's "[read-only]" marker disappears on its own
because it is derived from the registered operations.

Prompt (src/api/aiTiers.js): the PEOPLE bullet says Frodo adds and changes
people itself through create_item/update_item on "people", and that an
exact-name duplicate error means asking Scott whether to update the existing
person instead.

Bug 2 — composer clears at handoff (src/components/ChatBot.jsx, doSend)

  1. Keep today's order: save-for-later uploads finish first, then the vision
     attachments are built from the ready shots.
  2. Before awaiting sendMessage, remove exactly the sent shots (by id) from
     the composer state. Rejected (undecodable) shots and any shot staged
     later are not touched. Staged storage paths stay in stagedPathsRef on
     purpose: confirmed Clear still needs them to clean up staged copies
     (the sent shots' paths also remain reachable from the saved transcript).
  3. If sendMessage returns false (it refused to start), put the sent shots
     back into the composer and keep today's error message. If it returns
     true, nothing more to do — the message, with its images, is in the
     transcript and the composer is already clear. Failures inside the turn
     still return true (the hook posts its own error reply), which is
     correct: the message was sent.
```

## Ordered task checklist

- [x] Inspect the Frodo tool path, the People data layer, and the chat composer; record both root causes
- [x] Write this feature document; log BUG-075 and BUG-076 in BUGS.md
- [x] Add pure person write helpers (peopleCore) with tests; wire peopleApi writes through /api/orbit
- [x] Register people create/update in the Library; update the catalog description and Frodo's PEOPLE prompt bullet
- [x] Append ledger DR-034; align CLAUDE.md's People paragraph
- [x] Fix ChatBot doSend to clear sent shots at handoff and restore them on a refused send
- [x] Run focused tests, lint, full test suite, and build
- [x] Verify Bug 1 against the live API path with a test person, then remove the test person (verified against the real Orbit server on a throwaway data dir; production is untouched because no signed-in session exists in the fix environment — see Validation)
- [x] Verify Bug 2 in a locally run app with an attached image and screenshot the cleared composer, or record why that check could not run (could not run: auth-gated chat plus a live provider turn; recorded in Validation, pinned by a regression test instead)
- [x] Close out: BUGS.md resolutions, WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md, post-task checklist
- [x] Commit locally; push and deploy wait for Scott's separate approval

## Approval

Scott's direct order on 2026-10-28 ("this is a clear bug in frodos capabilities to pass stuff to orbit and for orbit to pass stuff to frodo, fix this", followed by "also see the image bug? it sticks around even after sent") authorizes implementing both fixes and a local commit. Per AGENTS.md and the post-task checklist, push and deployment require Scott's separate explicit approval and are not part of this work unit.

## Implementation record

- Files changed:
  - `src/api/peopleCore.js` (new): pure person-write document logic (UI-shaped create document, facts parsing, merge update, read-model flattening).
  - `src/api/peopleCore.test.js` (new): 7 tests for the above; registered in the `npm test` chain in `package.json`.
  - `src/api/peopleApi.js`: `createPerson` / `updatePerson` through `/api/orbit` with the session's auth headers; reads now share the core flattening.
  - `src/api/aiLibrary.js`: `people` gains create/update, `name` required on create, catalog description rewritten for the write path.
  - `src/api/aiTiers.js`: PEOPLE prompt bullet rewritten (add/change people itself; duplicate behaviour; `people_events` stays read-only).
  - `src/components/ChatBot.jsx`: `doSend` clears the sent shots at handoff and restores them when `sendMessage` refuses.
  - `src/components/chatBotUi.test.js`: BUG-076 source-order regression test.
  - `CLAUDE.md`: People paragraph aligned with DR-034.
  - `ledger.jsonl`: DR-034 appended.
  - `docs/development/BUGS.md` (BUG-075, BUG-076), `docs/development/WORKLOG.md`, `docs/development/ACTIVE_WORK.md`, `CHANGELOG.md`: records.
  - `verification/bug075-orbit-api-verify.mjs` + output (evidence only, not committed).
- Decisions: DR-034 (appended to ledger.jsonl). Delete stays closed for agents; intents stay unwritable through the Library gateway (open_items guard).
- Data or API changes: none to schema or stored data; agents gain a write path through the existing `/api/orbit` endpoint.

## Validation

- Automated: `npm run lint` clean; `npm test` green end to end (final node --test group 334 pass / 0 fail, plus the plain-assertion files); `npm run build` passes (pre-existing large-chunk advisory only). No typecheck script exists in this repo; lint and the Vite build are its static gates.
- Bug 1, API path: the real Orbit server (`orbit/server/app.js` → `repo.js` → `validate.js`) was booted on a throwaway `ORBIT_DATA_DIR` and driven with the exact requests `peopleApi` makes, built by the real `peopleCore` helpers and Orbit's real id generator. Create of the Aaron Burke-shaped request succeeded and echoed the stored fields; read-back found the person in the People data; an exact-name duplicate was refused 409 ("…is already in Orbit", with the existing id); a merge update changed group/notes, appended a fact, and preserved an existing intent and `createdAt`; a nameless document was refused 400 ("name is required"); the test person was then deleted through the API. Harness and full output: `verification/bug075-orbit-api-verify.mjs`, `verification/bug075-orbit-api-verify-output.txt`.
- Desktop visual check: not run. The Frodo chat is behind Scott's sign-in and a send needs a live provider turn; neither exists in the fix environment.
- Mobile visual check: not run, same reason.
- Known limitations: the one link not exercised end to end is the hosted (Supabase-backed) variant of `/api/orbit` with a real session token; it runs the same app/repo/validation code verified locally, and `peopleApi` takes its headers from the same `getAuthHeaders` the People UI uses. The signed-in checks for both bugs are listed as the next gate in ACTIVE_WORK.md. The post-deploy pass should also confirm the transcript's in-bubble attachment strip (`.chat-shots` inside the user message) reads well; it is a separate cosmetic question from BUG-076 and was left untouched.

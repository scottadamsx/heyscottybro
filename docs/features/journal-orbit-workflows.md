# Feature: Journal–Orbit workflows

**Status:** Locally approved — implementation in progress  
**Owner:** Scott  
**Started:** 2026-10-09

## User problem

Journal entries, calendar events, Orbit people, and actionable reminders are currently separate. Journal writing has AI cleanup, but names and person-related updates do not flow into Orbit; event creation is manual; past events have no guided Orbit logging action; and app-action reminders do not open their destination.

## Desired outcome

From a journal, Scott can review AI cleanup, link known people to their Orbit profiles, and selectively add explicit person updates to Orbit with a clear action receipt. Event creation can accept a natural-language description and prefill the existing form, while keeping manual entry available. After eligible events pass, a persistent prompt offers a one-click path into Orbit's existing logging form. Recognized app-action reminders open the matching logging flow and complete only after that action is actually saved.

## Approval and boundaries

- This document records the requested scope and the three decisions Scott answered on 2026-10-09: review proposed journal links/profile changes before saving; prompt for past-event Orbit logging; and open the relevant flow for app-action reminders.
- Scott also approved an initial explicit reminder phrase map for weight, food, workout, journal, and Orbit hangout actions.
- Scott approved this complete contract and pseudocode with exact **“go”** on 2026-10-09. Local uncommitted implementation in both repositories and additive migration-source files is authorized.
- Repository policy requires Scott to approve this exact contract and pseudocode with **“go”** or **“I approve”** before application-code changes.
- Approval would authorize local, uncommitted work in the host and canonical Orbit repositories, plus source files for any additive migrations. It does not authorize applying migrations, live AI calls, writing production data, commits, pushes, or deployment.
- Never send journal text or profile content to logs, analytics, fixtures, or session archives. Any AI transmission must be explicit and disclose the exact categories of text/data sent.
- Orbit remains the sole writer of Orbit records. The synchronized `orbit/` copy in this repository is read-only; canonical Orbit changes belong in `../orbit` and are synchronized only through the repository's approved mechanism.

## Current behavior and architecture

- Journal create/edit is `src/pages/admin/JournalPage.jsx` at `/admin/life?tab=journal`. It already has opt-in, explicit-confirmation AI grammar cleanup, a preview, acceptance, and a separate Save action. The saved entry body is currently displayed as plain text. `journal` records are owner-scoped through `plannerApi`.
- People is canonical Orbit embedded in a shadow root at `/admin/people`. A person drawer has a stable route `/admin/people/person/<id>`. Orbit owns all person/event writes through its authenticated API; the host Library exposes People read-only.
- Orbit already has journal-style hangout processing and a manual event form. Profile history displays per-person updates from Orbit events; profile facts use Orbit's guarded dedupe/merge behavior.
- Planner, Calendar, and Projects share `src/components/EventForm.jsx`; it currently edits structured date/title/time/description fields only.
- Reminders in `src/pages/admin/RemindersPage.jsx` are generic tasks. Completion records the current occurrence, including for recurring reminders; the UI has no action destination.

## Scope

### Included

- Extend the existing explicit Journal cleanup review to include exact known-person references and proposed person-related updates. Do not add a background AI call or silently change text or profiles.
- Render approved known-person references as links to the exact Orbit profile route while preserving the journal's readable plain-text body in the editor. Unmatched names stay plain text; ambiguous matches require a focused selection. Do not create a person from a mention.
- Let Scott inspect the cleaned entry, every proposed profile fact/context update, and the exact destination before accepting. Only checked, explicitly accepted updates are sent through Orbit's validated write path. Preserve existing journal Save behavior and show a receipt of successful links, profile changes, and context actions. A failed or partial cross-system write must identify what succeeded and support safe retry without duplicate Orbit records.
- Add a natural-language event-description mode to the shared new-event form, with a **Manual entry** action always available. AI may prefill supported fields but never save an event. Keep project/event type selections under Scott's control.
- After a newly eligible event's end time passes, show a persistent, dismissible **Log in Orbit** prompt. The action opens Orbit's existing conversational Interview flow, renamed **Orbit**, prefilled with event date/title and a source-event reference; a manual-entry fallback remains available. Do not invent attendees. Successful Orbit save marks the source event as logged; retry is idempotent. Historical events already present when this feature is enabled are not prompted.
- Add deterministic, conservative reminder intents for: log/record weight, food/meal, workout, journal entry, and Orbit hangout. Show a direct action only for a recognized reminder. Open the existing destination flow; complete the current reminder occurrence only after that destination reports a successful save. Cancel, error, or closing the destination leaves the reminder incomplete.
- Reuse existing authentication, AI disclosures, forms, date handling, Orbit transaction/write guards, and responsive modal patterns. Add no dependency or Vercel function.

### Not included

- Autonomous AI writes, auto-creating people, inferred attendees, or silently marking an app-action reminder complete.
- Automatic notifications while the app is closed, recurring-event expansion changes, or changing existing one-time/recurring reminder semantics.
- Applying a database migration, modifying production records, provider calls, commit, push, or deployment.
- Unrelated Journal, Planner, Orbit, reminder, Health, or Life redesign.

## Experience contract

- **Journal:** Use the existing Clean up with AI action and its disclosure. Review side-by-side cleaned text and exact mention/profile proposals. Each profile/context write is independently selectable and names the Orbit destination. The safe default is no unchecked profile changes. Accept updates the draft; the existing journal Save action remains distinct. Show per-action success/failure and a factual summary. Profile links open Orbit's embedded person drawer. Unknown names remain unlinked; genuinely ambiguous matches ask which existing person.
- **Event entry:** On new events, offer a short description and **Fill form**, plus **Manual entry**. AI suggestions populate the ordinary fields for review. Nothing is saved until the normal Add event action. Existing edits remain manual. If the date cannot be resolved from the captured local date/timezone, leave it blank and identify the ambiguity rather than guessing.
- **Past event:** Once a newly eligible event's end has passed in the owner's local timezone, surface a non-blocking prompt in Planner/Calendar with **Log in Orbit** and **Dismiss**. It remains available from the event until logged or dismissed; no modal appears unexpectedly. Logging opens Orbit's existing Interview flow with the exact title/date and source identity, plus an explicit manual-entry fallback. The normal Orbit save tools validate and persist the event; source linking makes retries idempotent.
- **App-action reminders:** When due, a recognized reminder offers a named action such as **Log weight**. The destination stays usable on desktop/mobile; the reminder is completed only after the matching save succeeds. Unrecognized reminder text keeps the ordinary Done action.
- **Keyboard/accessibility:** Use real labelled buttons, visible focus, existing dialog focus/escape behavior, clear busy states, and announced action receipts/errors. Links expose the person's name. The UI must work at 390px without horizontal overflow.
- **Errors and retries:** Preserve the original journal draft, event description, reminder, and Orbit state on failure. Report partial writes precisely. Reopening/retrying must not duplicate a source journal update, event log, or action completion.

## Acceptance criteria

- [ ] Journal cleanup is explicit, disclosed, and leaves original/saved text untouched until acceptance and Save.
- [ ] Every displayed person link targets a real owner-loaded Orbit ID; unknown or ambiguous names are never guessed.
- [ ] Profile changes are previewed individually and written only when selected and accepted; receipts describe only verified successful actions.
- [ ] Orbit writes are validated, owner-authenticated, idempotent by journal source/revision, and conflict-aware; retry and undo cannot erase unrelated later edits.
- [x] Natural-language event input fills only supported fields; manual entry remains available; no AI result saves an event.
- [x] Passing-event prompts apply only to events created after enablement; log links to exactly one Orbit event, and dismissed/logged prompts stay closed across reloads/devices.
- [x] Each of the five app-action reminder intents opens the correct existing form; complete only after its save succeeds; cancel/failure leaves the occurrence open.
- [ ] Full scenario matrix covers known/unknown/ambiguous people, fact/context/aspiration distinctions, duplicates, stale profile revisions, partial cross-system failures, retries, undo, event parsing ambiguity, time boundaries/timezone, duplicate log attempts, reminder recurrence, destination cancellation, reload, keyboard and mobile.
- [ ] No private text enters diagnostics/fixtures; deterministic tests make no real provider calls.

## Product decisions recorded

- **Review before saving** for every proposed person link/profile update.
- **Prompt to log in Orbit** once a newly eligible event passes; use an explicit **Log** action.
- **Open the relevant logging flow** for recognized app-action reminders.
- Start with an explicit phrase map for **weight, food, workout, journal, and Orbit hangout**; do not use model inference to decide whether a reminder is actionable.

## Decisions settled at approval

- **Orbit update storage and partial-write contract:** Use Orbit's existing fact merge path for durable facts and a source-linked `Note` event for episodic context; expose validated per-change outcomes, stable journal source/revision identity, and conflict-safe undo.
- **Event prompt dismissal:** Dismiss permanently for that event, while retaining a reopen action on its event detail.
- **Reminder completion after destination save:** Complete only the current due occurrence after the linked destination save succeeds, for each of the five supported intents.
- **Natural-language privacy disclosure:** Each explicit Fill form click discloses that the event description is sent to the configured AI provider; cancellation sends nothing.
- **Event AI connector:** Settled 2026-10-09: Scott chose a separate default-off **AI event drafting** device setting, distinct from Journal cleanup. Every explicit send remains individually disclosed.
- **Orbit hangout logging UI:** Settled 2026-10-09: Scott asked to reuse Orbit's existing Interview code for the hangout flow and rename its user-facing title/launcher from “Interview”/“Interview me” to **Orbit**. Internal route and component names may remain unchanged.

## Pseudocode

```text
JOURNAL CLEANUP AND ORBIT REVIEW
1. Scott writes or edits an entry and explicitly chooses Clean up with AI.
2. Show the existing provider disclosure, updated to name all sent content. Cancel sends nothing.
3. Send only the current body to the authenticated server cleanup operation. Request cleaned text plus exact quoted person mentions, proposed durable facts, and proposed episodic context; do not send the full Orbit roster to the model.
4. Validate that every quote occurs in the submitted body and every claim is grounded in that text. Resolve names against the owner-loaded Orbit roster. Link only one unambiguous real profile ID; leave unknown names plain and ask Scott to choose if multiple profiles match.
5. Show the cleaned body and each proposed update with exact text, destination person, classification, and an unchecked/checked choice. Preserve the original and current draft until Scott accepts.
6. On acceptance, place the cleaned body and selected safe person-reference spans in the draft; apply only selected Orbit updates through Orbit's authenticated validated API, with journal ID/revision source identity. Do not make direct host writes to Orbit rows.
7. Return per-action outcomes. Retry only failed actions using their stable source IDs. Never report a failed write as complete. Existing journal Save remains explicit.
8. Render link spans as safe links to /admin/people/person/<exact id>, leaving the stored prose/editor text readable. Export the references as Markdown links. On edit, revalidate offsets/text and present removal/update of stale links; never silently transfer one to another person.

NATURAL-LANGUAGE EVENT ENTRY
1. On a new shared EventForm, Scott enters a description and selects Fill form.
2. Disclose the provider request. On cancel, do not send. Capture the local date/timezone and send only the description plus required date context.
3. Parse title, date, end date, start/end time and description. Treat project and event type as manual fields. Validate ranges and unresolved dates before populating the form.
4. Show every populated value in the ordinary editable form; retain the original description until Scott confirms or edits it. Manual entry remains one click away.
5. Save only through the existing Add event action. AI never creates or updates an event by itself.

PAST EVENT → ORBIT
1. New events receive an owner-scoped Orbit-log state; existing historical rows are excluded when the additive migration is installed.
2. Compare event end date/time with the owner's current local time. When it passes, show a persistent non-blocking prompt with Log in Orbit and Dismiss.
3. Log opens Orbit's existing conversational Interview flow (shown as **Orbit**) with source event ID, date and title. It asks one question at a time and does not guess attendees; manual entry remains available.
4. Orbit saves with a unique source-host-event reference. If a retry arrives, return the existing Orbit event instead of creating a duplicate.
5. Only after Orbit confirms the save, mark the host event linked and save the Orbit event ID. If the host update fails, retry resolves the Orbit source reference first.
6. Dismiss stores a per-event dismissal state. A deliberate reopen remains available on event detail.

APP-ACTION REMINDERS
1. For a due reminder, apply the fixed phrase map. If no unique action matches, retain the generic reminder UI.
2. Open the existing destination form for the action: Health weight, Food, workout, Journal compose, or Orbit log.
3. After a destination save succeeds, complete only the current reminder occurrence. On cancellation, validation/network error, or close, keep the occurrence incomplete and leave a retryable status.
4. For recurring tasks, advance only through the existing completion API for that occurrence; never complete the whole series because one log succeeded.
```

## Ordered task checklist

- [x] Inspect host Journal, Planner/EventForm, Reminders, Orbit integration, current prompt/cleanup protections, and documented ownership boundaries.
- [x] Record Scott's decisions for review, past-event prompt, and initial reminder action map.
- [x] Resolve the four SPEC-GAPs using the documented recommendations and approve the full contract/pseudocode.
- [x] Resolve the event-AI connector switch: separate default-off device setting.
- [x] Inspect canonical Orbit's own instructions/schema and implement the smallest validated, source-aware API needed for approved event writes; add additive migration sources only.
- [ ] Implement journal cleanup proposals, person matching/review, safe profile links, verified receipts, retry/undo handling, and focused tests.
- [x] Implement natural-language event prefill plus permanent manual-entry fallback and boundary tests.
- [x] Implement persistent post-event Orbit logging prompt, idempotent cross-link, dismiss/reopen behavior, and tests.
- [x] Implement the five deterministic reminder actions and completion-after-success behavior with recurrence/error tests.
- [ ] Run full automated gates and synthetic desktop/mobile flows; record untested provider/database cases.
- [ ] Update changelog, active work, work log, and implementation evidence; complete post-task checklist.

## Implementation record

- Files changed: host event drafting, calendar, reminders, health/workout/journal flows and settings; Orbit's conversational event logger/host linking; `src/utils/journalOrbit.js` and tests; additive unapplied host migration; feature record, decision ledger and work logs.
- Decisions: Four originally identified SPEC-GAPs were accepted with Scott's exact “go”. The event-drafting switch is separate and default-off. Hangout logging now reuses the existing Interview tool loop under the Orbit UI name, with source-aware linking and manual fallback. Journal review/profile reconciliation remains outstanding.
- Data/API: Proposed additive schema/API work in host and canonical Orbit. No database or production data has been touched.

## Validation

- Automated: Host `npm run lint`, `npm test` (328 tests), and `npm run build` pass. Canonical Orbit `npm test` (209 tests), `npm run build`, `npm run check:ui`, `npm run check:ai`, and ledger-only validation pass. Full Orbit ledger validation detects the expected stale generated-doc count after the new ledger entry; the repository has no checked-in compiler executable, and generated docs were not hand-edited.
- Desktop/mobile visual check: Not run; no real provider request or hosted/database test was performed.
- Known limitations: Journal cleanup's Orbit profile proposals/review/links/receipts are not implemented. Provider-backed event drafting was not called. The additive migration is unapplied; no production data was changed.

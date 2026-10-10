# Feature: Journal–Orbit workflows

**Status:** Implemented — release approved; release checks in progress; rendered and live-provider checks remain
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
- Scott subsequently requested browser voice dictation for journal entries, with the transcript sent through the same Orbit people/entity review. He explicitly approved the voice addition with **“go”** on 2026-10-10.
- Scott explicitly approved deployment of the current Journal–Orbit change set with **“go”** on 2026-10-10. This authorizes commits and pushes of canonical Orbit and the synchronized host to their existing `main` branches, plus verification of the host's automatic production deployment. It does not authorize a new database migration, production-record write, or live AI request.
- Repository policy requires Scott to approve this exact contract and pseudocode with **“go”** or **“I approve”** before application-code changes.
- The local implementation was authorized separately. Deployment approval does not authorize applying a migration, making a production-record write, or initiating live AI/provider calls.
- Never send journal text or profile content to logs, analytics, fixtures, or session archives. Any AI transmission must be explicit and disclose the exact categories of text/data sent.
- Orbit remains the sole writer of Orbit records. The synchronized `orbit/` copy in this repository is read-only; canonical Orbit changes belong in `../orbit` and are synchronized only through the repository's approved mechanism.

## Current behavior and architecture

- Journal create/edit is `src/pages/admin/JournalPage.jsx` at `/admin/life?tab=journal`. It already has opt-in, explicit-confirmation AI grammar cleanup, a preview, acceptance, and a separate Save action. Saved body text remains plain in storage/editor; approved Orbit references are rendered as safe links. `journal` records are owner-scoped through `plannerApi`.
- Both Journal editors now offer browser speech dictation. It is opt-in per click, discloses that the browser's speech provider may process audio, and appends final transcript text to the normal editable, locally autosaved draft. Saving still requires the existing explicit Save action.
- People is canonical Orbit embedded in a shadow root at `/admin/people`. A person drawer has a stable route `/admin/people/person/<id>`. Orbit owns all person/event writes through its authenticated API; the host Library exposes People read-only.
- Orbit already has journal-style hangout processing and a manual event form. Profile history displays per-person updates from Orbit events; profile facts use Orbit's guarded dedupe/merge behavior.
- Planner, Calendar, and Projects share `src/components/EventForm.jsx`; it currently edits structured date/title/time/description fields only.
- Reminders in `src/pages/admin/RemindersPage.jsx` are generic tasks. Completion records the current occurrence, including for recurring reminders; the UI has no action destination.

## Scope

### Included

- Extend journal writing to identify exact known-person references and proposed person-related updates in Orbit after an explicit Journal save. Do not add a background AI call or silently change text or profiles.
- Render approved known-person references as links to the exact Orbit profile route while preserving the journal's readable plain-text body in the editor. Unmatched names stay plain text; ambiguous matches require a focused selection. Do not create a person from a mention.
- Let Scott inspect each proposed profile fact/context update, its exact destination, and person link before Orbit writes it. Each change requires an explicit answer; unknown names can remain unlinked and no person is created from host journal text. Preserve existing journal Save behavior and show a receipt of successful links/profile changes. Orbit's existing transaction makes each review submission atomic; a failed transaction remains retryable without duplicate Orbit records.
- Add a natural-language event-description mode to the shared new-event form, with a **Manual entry** action always available. AI may prefill supported fields but never save an event. Keep project/event type selections under Scott's control.
- After a newly eligible event's end time passes, show a persistent, dismissible **Log in Orbit** prompt. The action opens Orbit's existing conversational Interview flow, renamed **Orbit**, prefilled with event date/title and a source-event reference; a manual-entry fallback remains available. Do not invent attendees. Successful Orbit save marks the source event as logged; retry is idempotent. Historical events already present when this feature is enabled are not prompted.
- Add deterministic, conservative reminder intents for: log/record weight, food/meal, workout, journal entry, and Orbit hangout. Show a direct action only for a recognized reminder. Open the existing destination flow; complete the current reminder occurrence only after that destination reports a successful save. Cancel, error, or closing the destination leaves the reminder incomplete.
- Reuse existing authentication, AI disclosures, forms, date handling, Orbit transaction/write guards, and responsive modal patterns. Add no dependency or Vercel function.

### Not included

- Autonomous AI writes, auto-creating people, inferred attendees, or silently marking an app-action reminder complete.
- Automatic notifications while the app is closed, recurring-event expansion changes, or changing existing one-time/recurring reminder semantics.
- Applying a database migration, modifying production records, or initiating live AI/provider calls.
- Unrelated Journal, Planner, Orbit, reminder, Health, or Life redesign.

## Experience contract

- **Journal:** The existing optional Clean up with AI action remains disclosed, previewed, and undoable. New or edited journal text may also be spoken using a browser-supported speech-recognition API; only an explicit click starts the microphone flow. The browser may process audio. Final words append to the editable draft and are not saved until Scott chooses Save. A successful save opens Orbit's review. Orbit asks before linking any person or adding each proposed profile fact; unknown names remain unlinked, ambiguous matches require a specific existing profile, and declined changes stay journal-only. Orbit's transaction receipt is linked back to the host journal, the approved names render as safe profile links, and Orbit's Undo clears those links after the undo succeeds.
- **Event entry:** On new events, offer a short description and **Fill form**, plus **Manual entry**. AI suggestions populate the ordinary fields for review. Nothing is saved until the normal Add event action. Existing edits remain manual. If the date cannot be resolved from the captured local date/timezone, leave it blank and identify the ambiguity rather than guessing.
- **Past event:** Once a newly eligible event's end has passed in the owner's local timezone, surface a non-blocking prompt in Planner/Calendar with **Log in Orbit** and **Dismiss**. It remains available from the event until logged or dismissed; no modal appears unexpectedly. Logging opens Orbit's existing Interview flow with the exact title/date and source identity, plus an explicit manual-entry fallback. The normal Orbit save tools validate and persist the event; source linking makes retries idempotent.
- **App-action reminders:** When due, a recognized reminder offers a named action such as **Log weight**. The destination stays usable on desktop/mobile; the reminder is completed only after the matching save succeeds. Unrecognized reminder text keeps the ordinary Done action.
- **Keyboard/accessibility:** Use real labelled buttons, visible focus, existing dialog focus/escape behavior, clear busy states, and announced action receipts/errors. Links expose the person's name. The UI must work at 390px without horizontal overflow.
- **Errors and retries:** Preserve the original journal draft, event description, reminder, and Orbit state on failure. Report partial writes precisely. Reopening/retrying must not duplicate a source journal update, event log, or action completion.

## Acceptance criteria

- [x] Existing Journal cleanup stays explicit, disclosed, undoable, and separate from the Save action; voice transcripts stay editable until ordinary Save.
- [x] Every displayed person link targets an Orbit ID selected in the review; unknown names remain unlinked and ambiguous names require a specific existing profile.
- [x] Profile facts and support relationships are reviewed individually; declined changes remain journal-only and receipts follow Orbit's confirmed atomic save.
- [x] Orbit writes use its authenticated transaction, stable source identity, and conflict-aware undo; retries reuse the same source ID.
- [x] Natural-language event input fills only supported fields; manual entry remains available; no AI result saves an event.
- [x] Passing-event prompts apply only to events created after enablement; log links to exactly one Orbit event, and dismissed/logged prompts stay closed across reloads/devices.
- [x] Each of the five app-action reminder intents opens the correct existing form; complete only after its save succeeds; cancel/failure leaves the occurrence open.
- [ ] Full scenario matrix covers voice permissions/errors, known/unknown/ambiguous people, fact/context/aspiration distinctions, duplicates, stale profile revisions, retries, undo, event parsing ambiguity, time boundaries/timezone, duplicate log attempts, reminder recurrence, destination cancellation, reload, keyboard and mobile.
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
1. Scott writes or edits an entry and may explicitly choose the existing Clean up with AI action; its disclosure, preview, accept, undo, and separate Save behavior remain unchanged.
2. Scott may choose Speak entry. Start browser speech recognition only after that action, disclose that the browser provider may process audio, append final results to the editable draft, and never save or run cleanup automatically. Disable Save while recognition is active and until the browser's stop/end event has delivered any final result; a surfaced recognition error returns the form to a savable state.
3. Save through the existing owner-scoped Journal API. After success, queue an in-memory handoff to embedded Orbit using the stable host entry ID and content-derived Orbit ID; do not put journal text in the URL or browser storage.
4. Orbit extracts evidence-grounded mentions, facts, and events using its existing authenticated processing; do not send the Orbit roster to the model.
5. Before any profile fact or journal-support relationship is written, ask a targeted review question for each proposed change. Ask which existing person a genuinely ambiguous mention refers to. Unknown host-journal mentions can be left unlinked; do not create people from a mention.
6. Commit approved profile facts, support references, and any identified Orbit event through Orbit's atomic validated transaction. A declined fact stays only in the journal. A failed transaction is not reported as saved and can be retried with the same source identity.
7. Return verified receipt and approved mention-to-profile IDs to the host. Persist them in the existing Journal provenance JSON, render links only to selected Orbit IDs, and show the action summary. Orbit's conflict-aware Undo removes only its recorded changes; clear host-side links only after Orbit confirms.
8. Editing the body clears stale Orbit provenance/links. Keep the stored/editor body as readable plain text; Markdown export omits private profile-routing metadata.

VOICE JOURNAL ENTRY
1. On a new or edit Journal form, Scott explicitly chooses Speak entry; disclose that browser speech recognition may process audio through its provider.
2. Request microphone access only after that user action. Append final recognized words to the current draft without overwriting typed text; keep the result editable and auto-saved as a local draft.
3. Stop, unsupported browser, permission denial, and recognition errors remain visible and preserve existing text. Do not call the AI cleanup service automatically.
4. Save only through the existing Journal Save action. Then use the same Orbit review as typed entries; entity links/profile changes remain individually reviewable before Orbit commits them.

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
- [x] Implement Orbit journal person matching/review, safe profile links, receipts, conflict-aware retry/undo handling, and focused tests.
- [x] Add explicitly initiated, disclosed browser voice dictation to new/edit Journal drafts and route saved transcripts through Orbit review.
- [x] Implement natural-language event prefill plus permanent manual-entry fallback and boundary tests.
- [x] Implement persistent post-event Orbit logging prompt, idempotent cross-link, dismiss/reopen behavior, and tests.
- [x] Implement the five deterministic reminder actions and completion-after-success behavior with recurrence/error tests.
- [ ] Run full automated gates and synthetic desktop/mobile flows; record untested provider/database cases.
- [x] Update changelog, active work, work log, and implementation evidence; complete documented closure items that do not require live UI verification.

## Implementation record

- Files changed: host event drafting, calendar, reminders, health/workout/journal flows and settings; Orbit's conversational event logger/host linking; `src/utils/journalOrbit.js` and tests; additive unapplied host migration; feature record, decision ledger and work logs.
- Decisions: Four originally identified SPEC-GAPs were accepted with Scott's exact “go”. The event-drafting switch is separate and default-off. Hangout logging reuses the existing Interview tool loop under the Orbit UI name, with source-aware linking and manual fallback. Host-sourced journal updates now require explicit per-person and per-fact review; all Orbit writes remain in Orbit. Scott approved voice dictation and then deployment of the canonical Orbit + synchronized host change set with exact “go” on 2026-10-10. No new migration, production-record write, or live provider request is authorized.
- Data/API: Event source-link migration `journal_orbit_links` was applied and verified on 2026-10-10 as recorded in `ACTIVE_WORK.md`. No new schema or production journal/profile data was changed for this implementation; no live AI/provider call was made.

## Validation

- Automated: After final sync, host `npm run lint`, `npm test` (329 tests), `npm run build`, `npm run session-registry:check`, and `git diff --check` pass. Canonical Orbit `npm test` (212 tests), `npm run build`, `npm run check:ui`, `npm run check:ai`, `npm run check:ledger -- --ledger-only`, and whitespace checks pass. Full Orbit ledger validation has a generated-document compilation warning; generated docs were not hand-edited. Live-provider evals were not run because they send requests to Anthropic and are outside deployment approval.
- Desktop/mobile visual check: Not run. Browser microphone behavior, actual device permission prompts, real-provider extraction, and live linked-record behavior remain unverified.
- Known limitations: Voice dictation uses the browser speech-recognition provider and may transmit audio; only the user-initiated UI flow was implemented, not live microphone verification. Event AI drafting was not called. The applied migration covers event links only; no new schema was added for journal links/receipts, which are stored in the host journal's existing provenance JSON.

# Feature: Log in Orbit opens on the prompt, not the manual form (BUG-084)

**Status:** Built and verified locally 2026-11-07; committed locally, push/deploy awaits Scott's approval
**Owner:** Scott
**Started:** 2026-11-07

## User problem

Scott, on 2026-11-07 (screenshot of the manual "Log a hangout" form for the Nov 4, 2026 event "NLHS Innovation Summit (attending)", "Who was there" completely empty): "dude it still goes to manual log wtf is wrong with you I thought we had this fixed?"

BUG-081 fixed only half of Scott's 2026-11-06 request. He asked for the log to grab the event's people and ASK "what happened at the event" so he can type or dictate the answer. What shipped: the people now travel with the handoff, but on the live app the log still opens as the full manual field form, and for an event with nobody attached that form opens with an empty people picker, which reads as completely unfixed.

## Diagnosis (code read, 2026-11-07)

1. **Why it still goes manual on live.** `LogModal` (`orbit/src/components/LogModal.jsx`) starts in the interview only when `ai.available` is true (`startInOrbit`, and the render branch re-checks it). `ai` comes from `pickAi(health?.ai)` in `OrbitContext`, and `health` comes from `GET /api/orbit/health`, whose `aiStatus` (`orbit/server/ai/config.js`) reports available only when the server process has an `ANTHROPIC_API_KEY` **and** the Anthropic connector is enabled in settings. The hosted Vercel app has no key configured for Orbit, so `ai.available` is false on live, the adapter is the null adapter, and every log falls through to the manual form. `InterviewDrawer` cannot run without that backend: every turn is a live `ai.interview` call. Wiring it up would need a new live AI backend, which is out of scope (and against Scott's local-models direction); the prompt-first flow is therefore built on the existing manual save path, which needs no AI.
2. **Why the NLHS form had nobody picked.** `CalendarPage.openOrbitLog` only adds the `people` param when `eventPeople[event.id]` is non-empty. The NLHS Innovation Summit event has no attendees attached in the planner (it is an attended conference, nobody was ever linked), so nothing travels and the picker opens empty. The title and date did arrive, which the screenshot confirms ("What" and Date prefilled). No data fix is possible or wanted here; the flow itself has to handle the no-people case gracefully instead of presenting a blank full form.

## Desired outcome

- Arriving at Orbit from a Planner event log prompt (a `sourceHostEventId` handoff for an event not yet logged, not a plan) opens a **prompt-first view**, whether or not the AI interview is available:
  - It names the event (title and date) and its people by name when the event has people attached.
  - It asks **"What happened at the event?"** with ONE free-text answer area (the answer is filed as the log's Notes through the existing save path).
  - One primary save action files the Orbit log with the event's date, title, and people, including the existing duplicate check, host-event-saved event, and notifications.
- When the event has **no people** attached, the prompt view still opens first; because a log requires at least one person, it shows the people picker inside the prompt view under "Who was there?" so Scott picks once, in place, instead of facing the full form. An "Edit people" toggle does the same when people are prefilled.
- Escape hatch: a secondary "Full form" action switches to the existing manual form with everything carried over; the manual form for an event handoff gains a "Back to quick log" action. Nothing is lost either way.
- When the AI interview IS available, behaviour is unchanged: the interview opens first, exactly as today, and its "Use manual entry" path still lands on the manual form.
- Editing an existing log, planning a hangout, and logging from anywhere other than a Planner event prompt are unchanged.

## Pseudocode

```
LogModal:
  eventLogPrompt = prefill.sourceHostEventId && !existing && !prefill.plan
  initial entryMode =
    if ai.available and eventLog conditions (today's startInOrbit) -> 'orbit'
    else if eventLogPrompt -> 'prompt'
    else -> 'manual'
  if entryMode == 'orbit' and ai.available -> InterviewDrawer (unchanged)
  if entryMode == 'prompt' and eventLogPrompt ->
    render prompt Modal:
      line: event title, formatted date
      if form.people non-empty: "With <names>." + Edit people toggle -> PeoplePicker
      else: PeoplePicker under "Who was there?" + people error if saving empty
      question label "What happened at the event?" over a TextArea bound to form.notes
      duplicate notice (same as manual) when save() finds one
      footer: Cancel | Full form (secondary, sets entryMode 'manual') | Log it (primary, save(false))
  manual form (unchanged) + when eventLogPrompt: a "Back to quick log" button -> 'prompt'
```

## Plan

1. `orbit/src/components/LogModal.jsx`: add the `prompt` entry mode, its render branch, and the manual form's back button. No save-path, storage, or API changes.
2. Source tests: extend `src/pages/admin/orbitLogPrefill.test.js` (or a sibling test file in the `npm test` chain) covering: prompt mode is the initial mode for a source-host handoff when AI is unavailable, the prompt names the event and asks the question, the answer binds to the existing notes/save path, the no-people case renders the picker in prompt mode, and the interview still wins when AI is available.
3. Full suite, lint, build.
4. Rendered harness: real `LogModal` with stubbed Orbit/UI contexts (the BUG-081 harness pattern), AI unavailable, at 390px: (a) with a person prefilled, the prompt opens naming the event and the person, typing an answer and saving calls `saveEvent` with the event's date, title, people, and the answer as notes; (b) with no people, the prompt opens with the picker, and saving after picking files the same shape. Screenshots read; scratch files deleted before commit.

## Steps

- [x] Diagnosis recorded (this doc, BUGS.md BUG-084)
- [x] Prompt-first mode in `LogModal`
- [x] Source tests added and passing
- [x] Full suite, lint, build pass
- [x] Rendered harness check at 390px, with-people and no-people cases, save proven
- [x] WORKLOG, BUGS.md, ACTIVE_WORK updated; commit locally; push only on Scott's say-so

## Validation record (2026-11-07)

- Four new source tests in `src/pages/admin/orbitLogPrefill.test.js` (7 in the file, all passing, in the `npm test` chain). Full suite green (exit 0), lint clean, production build pass.
- Rendered harness, real `LogModal` with only Orbit's two context modules stubbed and `ai.available` set false to match the live app, at 390px:
  - With people ("Drinks with Lizwe", Nov 5): the prompt opened first, not the manual form; it named the event and "With Lizwe.", showed an Edit people toggle and exactly one answer area, no overflow, and saving called `saveEvent` with id `host_4242`, the event's date and title, people `[p_lizwe]`, and the typed answer as notes.
  - No people ("NLHS Innovation Summit (attending)", Nov 4, the screenshot's shape): the prompt opened with the people picker inside it; saving with nobody picked was refused with the existing "Pick at least one person." error and nothing was saved; after picking Lizwe and typing an answer, saving filed the same shape under `host_777`.
  - Zero page errors in both cases. Screenshots read: `verification/bug084-prompt-people-390.png`, `verification/bug084-prompt-nopeople-390.png` (not committed). Scratch entry, stubs, and Vite config deleted after the run; the verification script stays in `verification/`.
- Not verified: the signed-in production tap-through (post-deploy gate, needs Scott's push approval), and the AI-available path in a rendered harness (unchanged code path; covered by source tests asserting the interview still wins when `ai.available`).

## Edge cases

- Event already logged (`existing`): opens the manual edit form as today; no prompt mode.
- Planned events (`prefill.plan`): unchanged, manual form.
- Answer left empty: allowed, matching the manual form (Notes is optional there too); people and date remain the only required fields, with the same error messages.
- Duplicate event: the existing duplicate check runs on save from prompt mode too; the notice renders inside the prompt view with Open it / Save anyway.
- Attendee id Orbit no longer has: names resolve optionally (same as BUG-081); the picker tolerates the id; no crash path.

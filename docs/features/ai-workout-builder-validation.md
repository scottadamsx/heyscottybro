# AI workout builder validation

**Status:** User-led validation stopped by Scott; no application change approved
**Session:** `SAI00000004`
**Started:** 2026-10-03

## Request and boundary

Scott said **“lets test”** and supplied a screenshot of **Build a workout with AI** after submitting a back-day request. The modal visibly remains in **Saving…** at the captured moment. The screenshot is evidence only; its health-related prompt text and binary are not copied into the session archive.

This task tests the existing workout-builder flow one action at a time. It does not authorize a live request initiated by the agent, an application fix, a commit, a push, a deployment, a migration, or production-data changes. Scott controls the live UI and sends each result screenshot.

## Scenario matrix

| Scenario | State | Evidence |
| --- | --- | --- |
| Normal request reaches editable **Review AI workout** | Passed | Real-provider request resolved to a six-exercise editable draft in under one minute |
| Provider or network failure becomes a visible recoverable error | Untested | Await result |
| Ambiguous or typo-like exercise wording is handled without invented exercises | Testing | Visible exercises 1, 2, and 4–6 are grounded; exercise 3 remains unseen |
| Requested exercise set, explicit weight, and ordering are preserved truthfully | Failed in part | Six exercises returned and compounds precede curls as designed, but the explicit 60 lb appears only in a cue while the actual Weight field is blank (`BUG-065`) |
| Cancel/close during or after generation does not save a workout | Untested | Later step only |
| Review edits remain local until **Save workout** | Untested | Later step only |
| Save, reload persistence, and duplicate-submit protection | Untested | Later step only; production write requires explicit approval before execution |

Scripted-provider, real-provider, and real-database evidence will be labelled separately. No partial run will be called complete.

## Ordered test steps

1. [x] Establish whether the current real-provider request resolves or remains stuck after a bounded wait.
2. [ ] Inspect either the visible error/recovery state or the complete generated review draft. Items 1, 2, and 4–6 were inspected; Scott declined the exercise-3 screenshot, so item 3 remains untested.
3. [ ] Check exercise interpretation, requested ordering, set/rep/rest values, and any explicit starting weight without saving.
4. [ ] Test cancellation and retry/recovery without creating a workout.
5. [ ] Present any production-write step separately before saving; do not perform it without exact approval.
6. [ ] Record results, defects, privacy evidence, and the next permitted action.

## Test log

- 2026-10-03: Initial user screenshot shows the submitted real-provider request in a disabled **Saving…** state. Duration is not established, so this is not yet classified as a hang. Next: wait 60 seconds from the captured state and report whether the modal changes.
- 2026-10-03: Two follow-up screenshots show the real-provider request completed and opened an editable, unsaved six-exercise **Review AI workout** draft. The visible lat pulldown, seated row, straight-arm pulldown, rear-delt machine fly, and biceps curl choices are grounded in the request. The saved profile's fat-loss goal was supplied to the model, so its higher-rep/short-rest note is contextual rather than invented. Compound-first reordering matches the existing system contract. The explicit 60 lb is not placed in the Straight Arm Pulldown Weight field; it survives only as note text, so `BUG-065` is logged. Exercise 3 is missing from the screenshots. Next: center exercise 3 and capture it without saving.
- 2026-10-03: Scott replied **“nah”** to the next screenshot step. User-led testing stops without saving the draft. Exercise 3, failure/retry, cancellation behavior, persistence, duplicate-submit protection, and real-database save/reload remain explicitly untested. No fix, save, production write, or release action occurred.
- 2026-10-03: Recorded the current weight-selection behavior for Scott's question. AI does not calculate working weight. At workout time, `suggestNext` matches exercise history by case-insensitive exact name and uses double progression: first-time exercises use an optional saved starting weight or stay blank; completing every working set at the top of the rep range adds 5 lb (2.5 lb below 20); falling below the minimum holds the same weight; three consecutive short sessions deload 10%; otherwise it holds the weight and targets one more rep. Suggestions round to 2.5 lb, or a loadable 5 lb total for barbells. A manually logged first set becomes the weight for later sets that session.

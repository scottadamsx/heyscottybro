# Feature: Journal writing tools

**Status:** Revised complete contract approved — implementation in progress
**Owner:** Scott
**Started:** 2026-10-01
**Session:** `SAI00000004`

## User problem

The journal editor does not currently give Scott immediate writing measurements, a safe way to clean up grammar and spelling, or an elapsed writing timer.

## Desired outcome

While creating or editing a journal entry, Scott can see deterministic live character and word counts, track the current writing session, and request a privacy-safe grammar and spelling cleanup that never replaces his original text without an explicit acceptance step.

## Approval boundary

Scott approved the original recorded contract and pseudocode with exact **“go”** on 2026-10-01. That approval authorized the original seven local implementation units but expressly excluded database/provider-state work.

Before application edits, the required inherited `housestyle-ai.md` review exposed a conflict that was not represented in the approved contract. AI-3/AI-7 require versioned prompt files and runnable evals; AI-8 requires cleanup controls to disappear when the server key or user-facing connector is off; AI-10 requires saved model-written output to carry model, prompt version, and timestamp. The approved design uses the existing opaque `/api/chat` proxy, adds no connector-state surface, and saves accepted cleanup into the current journal body without provenance or a database change. Implementation is paused under QF-8 until Scott resolves the recorded `SPEC-GAP`; no application file has been edited.

Scott then directed **“cleanup everything.”** This resolves the product choice in favour of retaining all requested journal tools and expanding the contract enough to comply with the inherited AI floors. Because that wording is not one of the repository's exact implementation-approval phrases and materially changes the approved schema/API/governance boundary, application work remains paused until Scott approves this revised contract with exact **“go”** or **“I approve.”** Creating a migration source file will then be authorized; applying it, making live model calls, changing provider-account configuration, committing, pushing, deploying, or writing production data will remain separate gates.

Scott approved this revised ten-unit contract with exact **“go”** on 2026-10-01. Local application edits and creation of the additive migration source are authorized. Applying the migration, making live model/eval calls, changing provider-account configuration, committing, pushing, deploying, or writing production data remain separate gates.

## Inherited repository baseline

- `main` and `origin/main` both began at `7afd2d56a540da23ed651797bfb73afcf4dfc68f`.
- Ten documentation-only `SAI00000003` closeout paths were already modified; `SAI00000004` registry, glossary, and archive records were then added by the Project Manager. All are preserved.
- `BUG-058`, `BUG-061`, and the unapplied analytics/activity migration are unrelated and remain outside this feature.
- Journal text is sensitive and must not enter telemetry, logs, fixtures, screenshots, prompts, or session archives during discovery.

## Current behavior

### Route and component map

```text
/admin/life?tab=journal
  LifePage
    JournalPage
      URL state: ?new=1 opens compose; ?id=<entry> selects an entry
      FormModal: shared create/edit dialog, focus trap, Escape, busy/error handling
      DatePicker: edit-date control
      journal index: newest first, 60 rows initially, Show more pagination
      plannerApi: owner-scoped Supabase/local-mode reads and explicit writes
      drafts: versioned browser-local write-through cache
```

`JournalPage` owns both create and edit form state. There is no separate `journalEditDone` component or identifier in the application; Scott's phrase maps to the existing **Edit entry → Save changes** flow.

### Data and save lifecycle

- The owner-scoped `journal` row stores `id`, `user_id`, `title`, `entry`, `date`, `created_at`, and deployed `updated_at`; the setup also declares unused `mood` and `tags`. The revised feature adds one nullable, owner-protected `ai_provenance jsonb` field so a saved body that exactly matches an accepted cleanup can be traced to its model, prompt name/version, generation time, and acceptance time. Existing rows remain valid with `null` provenance.
- Create and edit textareas are controlled plain-text fields. Browser paste strips rich formatting; line breaks remain plain text.
- Every title/body edit is synchronously written to versioned `localStorage` draft keys. New entries use `draft:journal:new`; edits use `draft:journal:edit:<id>`. Closing the modal, changing entries, changing Life tabs, reload, or a crash retains a readable draft.
- An unreadable/future draft is moved aside and reported rather than silently replaced. A browser-storage failure is visible and the typed React state remains available while the page stays open.
- Supabase/local journal data changes only when **Save entry** or **Save changes** is pressed. Create waits for the insert and reload; edit updates the visible list optimistically, rolls back on failure, then reloads the trigger-produced `updated_at` after success.
- Successful save or confirmed discard clears that draft. Save failure keeps the form and draft. Edit discard and entry deletion require confirmation. Closing an unchanged edit clears a redundant edit draft.
- Save trims the outer title/body whitespace; the live writing tools will describe the current textarea value, before that existing save normalization.

### Current presentation and tests

- Desktop uses the shared Life shell. When an entry is selected, a reading sheet sits beside a 320-pixel index until the layout stacks below 1180 pixels.
- Create/edit uses the shared 720-pixel `FormModal`; at 390×844 it renders as the existing bottom sheet with a 240-pixel minimum body field. The entry field receives focus, Tab remains trapped, Escape closes, and focus returns to the opening button.
- The settled empty index shows an accessible `0`. `BUG-062` records that a list above 60 rows incorrectly reports the total as complete instead of `60 of M` while rows remain hidden.
- Existing registered coverage tests draft schema/read/write/failure behavior and Markdown export. No focused test currently exercises the assembled journal create/edit component, counts, cleanup, or timer.
- Rendered discovery used isolated local-data mode at 1280×900 and 390×844. It did not load, type, save, transmit, or capture private journal content.

## Scope

### Included

- Live body character and word counts in the existing create/edit journal experience.
- A user-triggered grammar and spelling cleanup using the existing authenticated Anthropic proxy, with pre-transmission confirmation, local comparison, explicit acceptance, and an immediate undo.
- An active-writing timer with manual controls, idle/background handling, and local draft continuity.
- Reuse of current journal UI, persistence, draft, responsive, accessibility, error, and confirmation patterns.
- Repair of directly related `BUG-062` when `JournalPage` is materially changed.
- The minimum shared AI-governance repair needed for this feature: remove the browser-key fallback, centralize model IDs, add the versioned journal prompt and eval runner, expose authenticated server availability through the existing function, and add a default-off journal-cleanup connector setting.
- An additive nullable journal provenance migration and truthful provenance display for a body that still exactly matches the accepted suggestion.
- Focused automated and rendered validation requirements.

### Not included

- A second journal editor, silent rewriting, live background grammar requests, or analytics containing journal text.
- A new dependency, new serverless function, provider-account/configuration change, migration application, journal backfill, or production-data change.
- Product-wide redesign of existing AI experiences beyond the shared mechanical fixes required to make the inherited validator green. Review-gate defects discovered in an unrelated AI feature are logged, not silently expanded into this journal task.
- Saving timer duration on a journal row, showing it in exports, or backfilling old entries.
- Style, tone, factual, or creative rewriting beyond necessary grammar, spelling, capitalization, and punctuation corrections.
- Live AI/API calls during discovery or tests.
- Unrelated fixes, including `BUG-058`, `BUG-061`, or analytics/activity migration work.

## Experience contract

- Desktop: Keep the existing modal. Place one compact writing-tools row directly below the body textarea: `N characters · N words`, timer, timer controls, and **Clean up writing**. Cleanup comparison opens in the shared modal shell with original and suggested text side by side plus an accessible change view.
- Mobile: Keep the existing 390-pixel bottom sheet. The writing-tools row wraps without horizontal overflow or hiding the textarea/footer. Cleanup comparison stacks original above suggestion; footer controls remain at least 44 pixels high.
- Keyboard and screen reader: All actions are real labelled buttons with visible focus. The count and timer group has an accessible name but is not a live region, avoiding an announcement on every keystroke/second. Cleanup loading, success, unchanged, and failure transitions use concise status/alert announcements. The comparison identifies removed and added text in words as well as visually; Cancel is the safe default and focus returns to **Clean up writing**.
- Loading, empty, and error states: Counts are synchronous. Timer controls remain local. Cleanup is absent unless the authenticated server reports the provider and journal feature configured and the device's connector switch is on; when present, it is disabled for a blank body, while offline, and above the request limit. The editor and draft never change during cleanup loading/failure. Provider/auth/shape/network failures stay inside the modal and are retryable only by a new explicit click.
- List-card counts (`N`, `N of M`, `0`, or not applicable): Preserve `0` for a loaded empty index; show `N` when every loaded entry is rendered and `N of M` while `Show more` pagination hides entries. Loading/error shows no fabricated count.

## Proposed product defaults for approval

### Character count

- Count only the journal body, not title, date, labels, or hidden draft metadata.
- Count user-perceived Unicode characters (grapheme clusters). A combined emoji or base letter plus combining mark is one character.
- Spaces, tabs, and each normalized line break count as one character. Whitespace-only content can therefore have a non-zero character count while the existing Save action remains disabled because there are zero words/non-whitespace body content.
- The empty body is `0 characters`; singular labels use `1 character` / `1 word`.
- Rich pasted content is counted after the textarea converts it to plain text. Browser-normalized CRLF becomes one `\n` character.
- Use `Intl.Segmenter` with grapheme granularity where supported and an explicitly tested Unicode-code-point fallback; no dependency is added.

### Word count

- Tokenize with one app-owned Unicode-aware rule, not locale-dependent browser segmentation.
- A word begins with one or more Unicode letters or decimal digits. Combining marks stay with their base.
- Internal straight/curly apostrophes and hyphens join adjacent letter/number groups: `can't`, `Scott’s`, and `mother-in-law` each count as one word.
- Leading/trailing punctuation is ignored. Other punctuation separates tokens, so `hello,world` is two words. Emoji and standalone punctuation are not words.
- Multiple spaces, tabs, and line breaks are separators only. Empty or whitespace-only content is `0 words`.

### Grammar and spelling cleanup

- **Trigger:** Explicit **Clean up writing** button only. There is no debounce, background check, autosend, or call during save.
- **Availability and opt-in:** Extend authenticated same-origin `/api/chat` with a read-only status response; do not add a thirteenth Vercel function. The server reports whether the Anthropic key and journal-cleanup feature flag are configured. Settings shows a default-off **Journal AI cleanup** device connector only when that server state is ready. The journal renders no cleanup control unless both states are on. The setting uses its own versioned, fail-loud local envelope and never contains journal text.
- **Provider and transport:** Add a server-owned `journal_cleanup` operation to the existing `/api/chat` handler. The server—not the browser—chooses the centrally configured Sonnet model, versioned prompt, structured schema, token ceiling, and validation path. Existing generic authenticated proxy behavior remains compatible. No web search or prompt/model override is accepted from this feature.
- **Data sent:** After confirmation, send only a snapshot of the body plus a fixed cleanup instruction and structured-output schema. Do not send title, date, entry ID, other journal entries, timer, counts, user profile, analytics, or draft keys. The body travels through the user's Vercel function to Anthropic.
- **Disclosure:** Every request first asks: “Send this entry text to Anthropic for grammar and spelling cleanup? The text is not saved to your journal unless you accept the suggestion and then save the entry.” Cancel sends nothing.
- **Provider privacy boundary:** Anthropic currently says commercial API inputs/outputs are not used for training by default and are normally deleted from its backend within 30 days, with exceptions for agreed terms, law, and usage-policy enforcement. Zero-data-retention is a separate approved arrangement and must not be claimed for this app. Sources: [training](https://privacy.anthropic.com/en/articles/7996868-is-my-data-used-for-model-training), [retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [zero retention](https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to).
- **Prompt and scope:** Store the instruction in `prompts/journal-cleanup.md` with a numeric version. It permits grammar, spelling, capitalization, and punctuation corrections while preserving meaning, voice, paragraph breaks, intentional fragments, supplied names, and supplied pronouns. It says to use only the submitted text, never invent, never infer gender, never add facts/advice/summaries/tone changes, and never generate emoji.
- **Emoji preservation:** Replace each user-authored emoji sequence with a deterministic opaque placeholder before the model call. Validate that every placeholder returns exactly once and in order, then restore the original sequences locally. Reject any model-generated emoji or missing/duplicated placeholder. This preserves Scott's text without allowing generated emoji into a saved suggestion.
- **Validation and retry:** Require a non-empty `cleaned_text` string, the expected placeholder set, the maximum length, and no unexpected emoji or unsupported fields. On output-validation failure only, the server makes at most one retry that names the failed constraint; network, auth, rate-limit, and provider failures never retry automatically. If the second result fails, return a safe visible error and no suggestion.
- **Limit and cost control:** Reject bodies above 12,000 live characters before confirmation/transmission. Use a forced structured result and centrally capped output. One click therefore makes one model request normally and at most two only after invalid output. No live request is allowed during implementation or tests without separate approval.
- **Race safety:** Capture the exact submitted snapshot. The textarea remains available; if it changes before the response returns, do not offer an overwrite—report that the entry changed and require a fresh cleanup request.
- **Preview:** Compute the comparison locally. Desktop shows original and suggestion side by side; mobile stacks them. An accessible added/removed text view accompanies colour styling. If the result is identical, say no changes were suggested and offer only Close.
- **Acceptance and provenance:** **Use suggestion** replaces only the draft textarea; it does not write the journal row. Preserve the pre-cleanup body and pending provenance in schema-2 draft metadata and show **Undo cleanup** until the next manual body edit, cleanup, save, or discard. Scott must still press the existing Save button. Saving a body that exactly matches the accepted suggestion writes nullable `ai_provenance` with feature, actual model ID, prompt name/version, generation time, and acceptance time. The reading UI labels it **Cleaned with AI** and shows those details accessibly. Undo or any later manual body edit clears pending/stored provenance before save so the label never overclaims authorship.
- **Failure/offline:** Never mutate the body, draft, timer, or saved entry. Show the real error and a new explicit retry action. Missing API configuration/auth and malformed/empty responses fail visibly.
- **Shared AI governance:** Put every model literal in one shared source module, remove the browser-prefixed Anthropic-key fallback, and add a runnable eval entry point. The journal eval covers unchanged clean text, ordinary corrections, voice/fact/paragraph preservation, names/pronouns, emoji placeholder preservation, invention rejection, invalid shape, over-length output, and retry exhaustion. Existing Orbit prompt files remain versioned and grounded. The inherited mechanical AI validator must be green before handoff.
- **Testing and eval gate:** Unit/integration tests use deterministic mocked responses and no private text. The eval runner supports checked-in deterministic fixtures without a provider call. The inherited ship checklist still requires two separately authorized live eval runs and human review before deployment; those calls are not implied by implementation approval.

### Writing timer

- Measure active writing time, not modal-open wall time.
- Initial state is `00:00` and idle. The first body input—including type, paste, cut, or undo—starts it. Title/date changes do not.
- While running, display elapsed `MM:SS`, switching to `H:MM:SS` after one hour. Use monotonic runtime time so system-clock changes cannot inflate the live session.
- **Pause** freezes immediately. A manual pause remains paused while typing until **Resume** is pressed.
- Automatically pause on modal close, window blur, hidden document, or 60 seconds without body input. A later body input automatically resumes only an automatic pause, never a manual pause.
- **Reset** requires confirmation when elapsed time is non-zero and returns to idle `00:00`. Saving or confirmed discard clears the timer without another confirmation because the primary action already ends/discards the draft.
- Store only accumulated duration, pause reason, and safe timestamps in versioned local draft metadata. It survives close/reopen and reload for that draft but never counts closed/background time; reopening resumes on the next body input unless it was manually paused.
- Timer metadata is separate for the new-entry draft and every edit draft. It is cleared with the existing draft after successful save/discard/delete and is never written to Supabase, exports, activity events, logs, or analytics.
- Bump the draft envelope to schema 2 with an explicit schema-1 reader that preserves existing fields and initializes missing timer/cleanup metadata safely. Future/corrupt envelopes keep the current fail-loud quarantine behavior.
- Checkpoint timer metadata on state transitions and at a bounded five-second cadence while running, not every display tick. A sudden crash may lose at most the last checkpoint interval, which must be documented rather than overstated.

## Decisions and revised approval gate

```text
SPEC-GAP
decision: How should journal cleanup satisfy inherited AI-3, AI-7, AI-8, and AI-10 when the approved contract prohibits the provider-state and stored-provenance changes those floors require?
options: Expand this feature to add a versioned prompt/eval boundary, a server-reported cleanup availability switch, and stored cleanup provenance through a separately reviewed schema/API change | Implement counts and timer only and defer cleanup to a separately contracted AI-governance feature | deliberately change the inherited AI house rules outside this session before resuming the approved cleanup design
resolution: Scott chose the compliant expansion with **“cleanup everything”** on 2026-10-01. The revised contract includes availability/opt-in, prompt/version, output validation, eval, centralized-model/key-boundary repair, and nullable saved provenance. No inherited AI floor is waived.
blocked-task: Application implementation remains blocked only until Scott gives exact **“go”** or **“I approve”** for this materially revised contract.
```

```text
SPEC-GAP
decision: What counts as a character and a word?
options: Unicode grapheme characters plus the explicit Unicode word rule above | UTF-16/string-length characters and whitespace-split words
recommendation: Unicode graphemes plus the explicit tokenizer, because the displayed numbers match what a person sees and remain testable across punctuation, contractions, Unicode, whitespace, and paste.
blocked-task: Implementation units 1–2
```

```text
SPEC-GAP
decision: May a user-triggered cleanup send the current body through Vercel to the Anthropic API under the disclosed retention/training boundary?
options: Explicit confirmed Anthropic request with preview | Local-only counts/timer and no grammar cleanup | separately approve a new on-device dependency/model
recommendation: Explicit confirmed Anthropic request with preview, because the infrastructure already exists, no new function/dependency is needed, and the user retains two acceptance gates; local browser spellcheck is inconsistent and does not provide the requested grammar cleanup.
blocked-task: Implementation unit 4 and any live production use
```

```text
SPEC-GAP
decision: What should the writing timer measure and retain?
options: Active writing time in local draft metadata | modal-open wall time | elapsed duration stored on journal rows
recommendation: Active writing time in local draft metadata, because it excludes idle/background time, survives a draft reopen, requires no database migration, and does not turn private writing behavior into durable analytics.
blocked-task: Implementation unit 3
```

## Acceptance criteria

- [x] Both create and edit body fields show correct live singular/plural character and word counts from the current unsaved textarea value.
- [x] Character regressions cover empty text, whitespace, normalized newlines, combining marks, emoji sequences, and pasted plain text.
- [x] Word regressions cover punctuation, straight/curly contractions, internal hyphens, Unicode letters/marks, digits, emoji, multiple whitespace, and punctuation without whitespace.
- [x] Existing outer-whitespace trimming on explicit save remains unchanged and documented.
- [x] Timer transitions cover idle, first input, running, manual pause/resume, automatic idle/blur/hidden/modal-close pauses, manual-pause precedence, reset confirmation, reopen/reload, successful save/discard, and failed save.
- [x] Existing schema-1 drafts restore without data loss; schema-2 timer/undo metadata round-trips; corrupt/future records remain quarantined and reported.
- [x] Without a server key/feature flag or with the default-off connector disabled, no journal cleanup control renders and counts/timer/save continue to work.
- [x] Cleanup sends nothing until the user confirms, sends only the captured body plus the server-owned versioned contract/schema, performs no web search, and rejects blank or over-limit text locally.
- [x] Cleanup loading/failure/stale-response states leave editor, draft, timer, and saved journal row unchanged.
- [x] Cleanup output is shape/length/placeholder/emoji validated, receives at most one server retry only after failed validation, is compared locally, and cannot overwrite a body changed after request start.
- [x] Identical cleanup returns a no-changes state. Changed output requires **Use suggestion**, remains unsaved until the existing Save action, offers immediate **Undo cleanup**, and carries pending provenance only while the body exactly matches the suggestion.
- [x] The additive nullable `journal.ai_provenance` migration is idempotent and owner isolation remains unchanged; existing rows need no backfill.
- [x] A saved accepted suggestion displays **Cleaned with AI** plus model, prompt name/version, and time; undo or subsequent manual body changes clear provenance before save.
- [x] User-authored emoji are restored from exact placeholders, while newly generated emoji, missing/duplicate placeholders, invented facts, or invalid results are rejected and never shown or saved.
- [x] No journal text enters console logs, telemetry/activity metadata, fixtures, screenshots, session archives, or error messages.
- [x] No dependency or additional Vercel function is introduced; migration source exists but is not applied without separate approval.
- [x] All model literals are centralized, the browser-exposed key fallback is removed, versioned prompts remain grounded, `npm run eval` exists, and the inherited AI validator is green.
- [x] The journal index count shows `0`, `N`, or `N of M` accurately as loading, pagination, and Show more change the rendered rows, resolving `BUG-062`.
- [x] Keyboard-only operation reaches all controls, dialogs trap/restore focus, additions/removals have non-colour semantics, and count/timer updates do not spam screen readers.
- [x] Desktop and 390-pixel layouts have no page/modal horizontal overflow, clipped footer, overlapping controls, or body field below the agreed usable height.
- [ ] Focused tests use deterministic mocks and are registered in `npm test`; zero-warning lint, the registered suite, production build, registry/JSON validation, `git diff --check`, and privacy review pass before implementation handoff.

The final combined gate is intentionally left open only because the already-recorded unrelated `BUG-058` makes one stale session-count projection test fail; 305 of 306 tests pass and the authoritative registry validator passes with four sessions. Every other named gate passes.

## Edge cases

- A body containing only spaces/newlines has a character count but zero words; Save and cleanup remain disabled.
- Mixed newline input is normalized by the textarea before counts/cleanup; no formatted HTML is stored or sent.
- Apostrophes/hyphens at token edges are punctuation, while internal joiners keep one word.
- A cleanup response arrives after typing, closing, switching entries, signing out, or owner change: it is ignored/fails closed and cannot mutate another draft.
- Cleanup suggests an empty string, a non-string value, a structurally invalid tool result, or exactly the input: fail visibly or show no changes; never blank the editor.
- Network/auth/rate-limit/provider failure and missing API key preserve every local state and incur no automatic second request; only a structurally invalid model result can trigger the single bounded retry.
- The original contains emoji: exact grapheme placeholders survive the model round trip and restore unchanged; any new emoji or placeholder mismatch rejects the suggestion.
- The connector is off, the server feature flag is off, or the key is missing: no cleanup button renders, while all non-AI journal tools remain usable.
- A suggestion is accepted and then manually edited before Save: pending provenance is cleared, and saving clears any earlier stored cleanup provenance rather than displaying a stale AI label.
- The browser reports offline incorrectly: the attempted request still uses ordinary failure handling.
- Timer crosses one hour, browser clock changes, tab sleeps, idle threshold fires between display ticks, or reload occurs between five-second checkpoints.
- Manual pause followed by typing does not resume. Automatic pause followed by body input does.
- Close with unsaved text retains counts derived on reopen and the locally checkpointed duration, but accrues no closed time.
- Save failure keeps timer/draft; successful save clears local timer/undo metadata only after the database operation succeeds.
- Two tabs editing the same draft retain the existing last-writer-wins localStorage limitation; this feature does not claim cross-tab coordination.
- More than 60 entries reports `60 of M`; each Show more action advances the visible count until the full `M` is shown.

## Pseudocode

```text
COUNT THE CURRENT BODY
When the create or edit body value changes:
  treat the textarea's plain-text value as the only count input
  count visible Unicode grapheme characters, including whitespace and line breaks
  tokenize words with the approved Unicode letter/digit and internal apostrophe/hyphen rule
  render correctly pluralized counts in the quiet accessible writing-tools group
  save the existing draft fields without changing database-save behavior

RUN THE ACTIVE-WRITING TIMER
For each new/edit draft, restore valid schema-2 timer metadata or initialize zero time
When the first body input occurs:
  if the timer is idle or automatically paused, start/resume it
  if it is manually paused, leave it paused
While running:
  derive the visible elapsed time from accumulated monotonic time
  update only the display each second
  checkpoint safe local metadata at most every five seconds and on every state transition
When there is no body input for 60 seconds, the window blurs, the document hides, or the modal closes:
  add only eligible active time and automatically pause
When Pause is pressed:
  add eligible active time and mark the pause manual
When Resume is pressed in a visible focused editor:
  start from the accumulated duration
When Reset is pressed with elapsed time:
  ask for confirmation, then return this draft's timer to idle zero
On successful journal save or confirmed discard/delete:
  clear the existing draft, timer, and cleanup-undo metadata together
On failed save:
  preserve all local state and show the existing form error

REQUEST CLEANUP
On Settings/Journal load, read authenticated /api/chat status
Show the default-off Journal AI cleanup connector only when the server key and feature flag are configured
Render Clean up writing only when server readiness and the device connector are both on
Enable it only when the body has non-whitespace text, is within 12,000 characters, is online, and no request is running
When pressed:
  show a confirmation naming Anthropic, the exact body-only scope, and that acceptance plus Save are still required
If cancelled:
  send nothing and return focus to the button
If confirmed:
  capture the current owner and exact body snapshot
  replace user-authored emoji sequences with exact opaque placeholders
  request the server-owned journal_cleanup operation through /api/chat
  never include title, date, id, timer, counts, other entries, or profile context
On the server:
  choose the model only from the shared server configuration
  load the versioned grounded journal prompt and forced schema
  require a non-empty bounded cleaned_text string, exact placeholders, and no generated emoji
  retry once only when output validation fails, naming the failed constraint
  return cleaned text plus actual model, prompt name/version, and generation time
When the response arrives:
  verify the owner/modal/entry still match and current body still equals the submitted snapshot
  restore each original emoji from its exact placeholder and validate again
  if not, discard the suggestion and ask for a fresh request
  if identical, announce that no changes were suggested
  otherwise compute a local accessible added/removed comparison and open the review modal
On request failure:
  preserve text, draft, timer, and saved row; show the real safe error; require another explicit click

REVIEW AND ACCEPT CLEANUP
Show original and suggestion side by side on desktop and stacked on mobile
Expose removed/added semantics in text, not colour alone
Make Cancel the safe default and keep the editor unchanged
When Use suggestion is pressed:
  preserve the submitted original in local draft metadata
  replace only the textarea draft value with the suggestion
  retain returned provenance as pending metadata tied to that exact suggestion
  close review, return focus, and show Undo cleanup
  do not save the journal row
When Undo cleanup is pressed before another manual body edit/cleanup/save/discard:
  restore the original draft body and remove undo and pending provenance
On the next manual body edit:
  clear cleanup undo and pending provenance to avoid overwriting or mislabelling newer writing
On explicit Save:
  if the trimmed saved body still exactly matches the accepted suggestion, save its model/prompt/version/generation/acceptance provenance
  otherwise save null provenance when the body changed, including over an older AI-cleaned row
In the reading sheet:
  show Cleaned with AI and accessible provenance details only while stored provenance describes the current saved body

REPAIR THE SHARED AI FLOOR
Remove the browser key fallback from local development
Move every model id literal into one shared configuration source and preserve each existing caller's chosen tier
Add the grounded versioned journal prompt and a runnable deterministic eval command
Run the inherited validator and require every mechanical check to pass
Do not make a live eval request until Scott separately authorizes provider usage

REPORT THE JOURNAL INDEX COUNT
While loading or failed, do not show a count
After a successful load:
  show 0 for an empty list
  show the total when every loaded row is visible
  otherwise show visible of total
  recompute after each Show more action from the same paged collection that renders rows

Scott approved this revised recorded contract with exact **“go”** on 2026-10-01.
```

## Ordered task checklist

- [x] Verify the SAI00000004 identity, binding, startup injection, repository baseline, and approval boundary.
- [x] Inspect the exact journal component boundaries, navigation, data model, save/autosave/draft lifecycle, error paths, and existing automated coverage.
- [x] Inspect reusable UI, accessibility, responsive, confirmation, and AI/provider infrastructure without sending journal content or making a live request.
- [x] Render and inspect the current journal experience on desktop and at 390-pixel mobile width using non-sensitive local/test content only.
- [x] Record deterministic character-count, word-tokenization, cleanup/privacy, and writing-timer rules plus genuine product decisions.
- [x] Complete the contract, acceptance criteria, edge cases, ordered implementation units, and plain-language pseudocode.
- [x] Update active-work, work-log, and SAI00000004 archive records; run documentation, JSON, registry, privacy, whitespace, and repository-state checks.
- [x] Present the proposed contract and receive Scott's exact **“go”** before application-code changes.
- [x] Complete the post-task checklist for this planning work unit.
- [x] Read the inherited AI contract, run its validator, identify the original contract conflict, and pause before application edits.
- [x] Record Scott's **“cleanup everything”** direction as the choice to retain all tools and expand the compliance scope.
- [x] Revise the contract, pseudocode, acceptance criteria, and ordered units for server availability, opt-in, prompt/eval, validation/retry, emoji preservation, shared mechanical AI repair, and stored provenance.
- [x] Receive Scott's exact **“go”** or **“I approve”** for the revised implementation boundary.

## Ordered implementation units after revised approval

1. [x] Repair the shared mechanical AI floor: remove the browser-key fallback, centralize existing model literals without changing their tiers, add the versioned grounded journal prompt and deterministic eval entry point, and make `validate-ai.mjs` green.
2. [x] Add the authenticated `/api/chat` status and server-owned `journal_cleanup` operation with bounded input, emoji placeholders, structured validation, single invalid-output retry, safe errors, and focused server tests; preserve generic proxy compatibility.
3. [x] Add the default-off versioned journal-cleanup connector setting and availability client; prove every cleanup control disappears when the server is unavailable or the connector is off.
4. [x] Add pure Unicode count/token and timer-state utilities with exhaustive focused tests; register them in the suite.
5. [x] Add the shared writing-tools row to both create/edit fields and correct `BUG-062` from the rendered pagination state.
6. [x] Upgrade local drafts compatibly to schema 2 and integrate timer checkpoint/restore plus cleanup undo/pending-provenance behavior.
7. [x] Add the additive nullable journal-provenance migration source, API/local-mode handling, truthful provenance clearing, and reading-sheet label; do not apply the migration.
8. [x] Add the accessible cleanup confirmation, comparison, accept, and undo interaction to the existing modal system, including mocked failure/race/retry cases and desktop/mobile styles.
9. [x] Run focused regressions continuously, then the complete automated, deterministic eval, inherited AI validator, accessibility, desktop, 390-pixel, privacy, documentation, and repository gates. Record that two live eval runs and deployed no-key verification remain separately gated.
10. [x] Complete the post-task checklist and present the exact changed scope before any commit, live-eval, migration, or release decision.

## Planning work log

- 2026-10-01: Verified `SAI00000004` is bound to thread `01a0f7b7-c3ae-7623-a880-dad1f4591efa`, titled `Bonsai Chat SAI00000004`, active in the registry/glossary, and backed by its archive folder. `npm run session-registry:check` passed with four IDs and selected `SAI00000005` next. Recorded the inherited Git baseline and the no-implementation/no-live-AI boundary. Next: inspect the current journal system.
- 2026-10-01: Traced the journal's routed tab, shared page component, create/edit modals, local draft cache, database API, schema, pagination, and registered tests. Rendered the empty journal and create editor in isolated local-data mode at 1280×900 and 390×844; confirmed the modal focus trap, entry autofocus, mobile bottom sheet, Escape close, and focus return. No private or production journal content was read, written, transmitted, or captured. Logged directly related `BUG-062`: the paged index must show `N of M` when more than 60 loaded entries are not yet rendered. Next: finish the proposed rules and pseudocode.
- 2026-10-01: Inspected the existing authenticated `/api/chat` proxy, allowed models, structured AI-client pattern, auth/error boundary, function-count ceiling, and current official Anthropic privacy/retention/pricing material. Chose a proposed body-only, confirmed, single-request Haiku flow with no web search, automatic retry, dependency, serverless function, database change, or live discovery call. Recorded the deterministic count rules, local active-time state machine, accessibility/responsive contract, acceptance criteria, edge cases, three `SPEC-GAP` decisions, pseudocode, and ordered implementation units. Next: reconcile planning records and validate them before presenting Scott's approval gate.
- 2026-10-01: Reconciled `ACTIVE_WORK.md`, `WORKLOG.md`, `BUGS.md`, and the SAI00000004 transcript/manifest/summary. The registry validates with four IDs and `SAI00000005` next; manifest and all JSONL parse; `git diff --check` and the planning privacy/path scan pass; the tracked diff remains documentation-only. Application tests/lint/build were not run for this documentation-only planning unit and remain required after approved implementation. Next: present the three proposed defaults for Scott's decision.
- 2026-10-01: Scott approved the complete recorded contract, three recommended defaults, acceptance criteria, and pseudocode with exact **“go.”** The seven ordered local implementation units are authorized. Commit, push, live AI/API use, dependency/provider changes, database migration, production data, and deployment remain separate gates. Next: read the inherited styling/persistence rules and begin unit 1.
- 2026-10-01: Read the required inherited `housestyle.md`, `housestyle-ui.md`, and `housestyle-ai.md` before application changes. The AI floors revealed an unapproved architectural conflict: the no-schema/no-provider-state cleanup cannot satisfy versioned prompt/eval, unavailable-control, and saved-output provenance requirements. Recorded the exact `SPEC-GAP` and paused before touching application code. Next: await Scott's choice; recommendation is counts/timer now and a separate compliant cleanup contract.
- 2026-10-01: Scott directed **“cleanup everything,”** choosing to retain counts, timer, `BUG-062`, and AI cleanup with all required safeguards. Re-ran the inherited validator and confirmed the existing mechanical baseline: one browser-key fallback, model literals in 15 source files, and no eval runner; Orbit's existing versioned grounded prompts already pass AI-3/AI-5. Revised the feature contract to include the bounded shared repair, authenticated server availability, default-off connector, server-owned cleanup operation, output validation with one invalid-output retry, emoji placeholders, deterministic evals, and nullable saved provenance. No application file, migration, provider setting, or live model was changed or called. Next: present this materially revised contract for Scott's exact **“go”** or **“I approve.”**
- 2026-10-01: Reconciled the revised feature, active-work, work-log, and SAI00000004 archive records. Manifest/registry/ledger JSON parses, the session registry passes with four IDs and `SAI00000005` next, `git diff --check` passes, and the archive privacy/path scan passes. The inherited AI validator's recorded failures are the implementation target, not a planning-validation failure. Next: request exact approval for the revised ten-unit boundary.
- 2026-10-01: Scott approved the revised ten-unit contract with exact **“go.”** Local application edits and creation of the additive migration source are authorized. Live model/eval calls, provider-account configuration, migration application, production-data operations, commit, push, and deployment remain separate closed gates. Next: begin implementation unit 1 while preserving every inherited change.
- 2026-10-01: Completed implementation unit 1. Centralized all provider model IDs in `src/config/aiModels.js` without changing existing caller tiers, removed the browser-prefixed key fallback, added the grounded versioned journal prompt and deterministic eval command, and added the server cleanup core plus focused mock tests as the start of unit 2. Six cleanup tests and five deterministic eval fixtures pass; the inherited AI validator is green for AI-1/2/3/5/6/7. No live model call occurred. Next: finish the API status/dispatch boundary and its compatibility tests.
- 2026-10-01: Completed implementation unit 2. `/api/chat` now has an authenticated read-only journal availability response and dispatches the server-owned cleanup operation while leaving generic proxy requests unchanged. The cleanup enforces the 12,000-grapheme limit, exact emoji placeholders, structured output, safe errors, provenance, and one retry only after invalid output. Moved route tests outside `api/` after the function-count regression correctly identified a test file as a thirteenth deployment entry; all 13 focused API/client/setting tests and the 12-function ceiling now pass. Began unit 3 with the fail-closed cached availability client, default-off versioned connector setting, and conditional Settings control. Next: build count/timer utilities before integrating the shared journal row.
- 2026-10-01: Completed implementation unit 4. Added deterministic Unicode grapheme/word counting and the active-writing timer state machine for input start, manual pause precedence, resume, bounded idle auto-pause, checkpoint metadata, restore, and hour formatting. Upgraded draft storage to schema 2 with a schema-1 reader and metadata-aware blank handling as the start of unit 6. All 12 focused writing/draft tests pass. Next: add the provenance migration/API path, then integrate one shared editor control into create and edit.
- 2026-10-01: Completed implementation units 3 and 5–8. Settings now shows a default-off journal connector only when authenticated server availability is ready; otherwise every cleanup control disappears. Create/edit share live counts, timer controls, cleanup confirmation/status/review/accept/undo, and stale-response protection. Draft schema 2 checkpoints timer and pending cleanup, while schema 1 remains readable. Added the unapplied nullable provenance migration source, API/local support, truthful clearing, and reading-sheet label. `BUG-062` now derives `N of M` from rendered rows. Thirty-one feature tests, focused zero-warning lint, production build, deterministic eval, 12-function ceiling, and inherited AI validator pass. No live model call or migration application occurred. Next: render desktop/mobile and complete the full repository gates.
- 2026-10-01: Rendered the implemented create editor in isolated local-data mode at the default desktop viewport and 390×844. A non-sensitive Unicode sample reported 24 graphemes and 4 words; first body input started the timer, Pause froze it at `00:06`, and reload restored the same text/counts/paused duration from schema 2. Desktop remained balanced; at 390 pixels the bottom sheet, textarea, wrapped statistics/buttons, 44-pixel actions, draft status, and footer had no horizontal clipping or overlap. Cleanup was absent while the server feature was unavailable, proving the fail-closed UI state. No entry was saved, no production/private data was read or written, and no model request occurred. Next: run the complete gates and reconcile closure records.
- 2026-10-01: Completed implementation gate 9. The 31 focused tests, zero-warning lint, production build, five-case deterministic eval, inherited AI validator, 12-function ceiling, authoritative four-session registry check, JSON/JSONL parsing, privacy review, and whitespace check pass. The registered suite reports 305 of 306 because known unrelated `BUG-058` still expects two sessions; it was not changed. Live model evals, deployed no-key verification, migration application, and feature enablement remain separately gated. Next: complete the post-task records and present the uncommitted scope.
- 2026-10-01: Completed implementation unit 10 and the post-task checklist. Updated the changelog, current-system guide, environment example, active-work/bug/work-log records, `DR-026`, and the complete SAI00000004 transcript/manifest/summary. Final focused tests pass 33/33, zero-warning lint and deterministic evals pass, the AI validator is green, the registry/JSONL/privacy/whitespace checks pass, and the exact working tree is recorded. The session correctly remains Active—no Project Manager lifecycle event is due before Scott's commit decision. No commit, live eval, migration, enablement, push, or release action occurred.
- 2026-10-02: Scott said **“push.”** Read-only verification confirmed `main` and `origin/main` remain identical at `7afd2d5`; the completed implementation is still uncommitted, so there is no new commit to push. A commit plus push would publish the journal work and preserved closeout records to `origin/main`, trigger CI and automatic Vercel Production deployment, leave the migration unapplied, and leave cleanup disabled. Because **“push”** is not the repository's exact approval phrase and does not explicitly resolve the prerequisite commit, no commit or push occurred. Next: present those consequences and await exact **“go”** for the combined commit-and-push release.

## Implementation record

- Files changed: Added shared model governance, the server cleanup core, versioned prompt/eval, client availability/setting, writing utilities/tests, migration source, and focused route/component tests; updated the existing API handler, dev handler, journal/settings UI, drafts, journal persistence, styles, schema setup, package scripts, environment example, and governing records.
- Decisions: Scott approved both the original defaults and the revised complete ten-unit contract with exact **“go.”** The cleanup remains absent unless the server flag and key are ready and the device setting is enabled; accepted text remains a draft until the normal Save action.
- Data or API changes: `/api/chat` now exposes authenticated cleanup status and the `journal_cleanup` operation while preserving generic proxy compatibility. The unapplied migration adds nullable, owner-scoped `journal.ai_provenance`; no live schema or production row changed.

## Validation

- Automated: 31 focused feature tests pass. Repository lint passes with zero warnings; the production build passes with its existing chunk-size advisory; five deterministic eval fixtures pass; the inherited AI validator is green; the deployment function count remains 12; the four-session registry check, JSON/JSONL parsing, privacy review, and `git diff --check` pass. The complete suite reports 305/306 only because known unrelated `BUG-058` contains a stale two-session expectation.
- Desktop visual check: The implemented create editor passed isolated local-data inspection at the default desktop viewport. Counts, timer start/pause, reload recovery, and the unavailable-cleanup state behaved as recorded; no private content loaded.
- Mobile visual check: At exactly 390×844, the bottom sheet, usable textarea, wrapped writing-tools row, 44-pixel actions, draft status, and footer remained readable without horizontal clipping or overlap.
- Known limitations: No live Anthropic request or live eval was authorized, so output quality has deterministic/mocked coverage only. The additive migration is not applied, the server flag is not enabled, and deployed no-key behavior is not verified. Apply the migration before enabling cleanup. The existing unrelated `BUG-058` prevents a completely green aggregate suite; it remains outside this approved task.

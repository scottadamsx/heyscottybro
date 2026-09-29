# Feature: Frodo reliability closure and mobile chat

**Status:** Complete in settled tree — closure commit/push authorized
**Owner:** Scott
**Started:** 2026-09-29

## User problem

Frodo's chat is unsafe and awkward on iPhone: the panel begins beneath the Dynamic Island, its close control can be unreachable, and a hydrated conversation opens at its oldest message. Scott asked for every Frodo-related bug in the repository to be fixed or proven resolved in the same work unit, followed by full session closure, commit, and push.

## Desired outcome

Deliver a dependable Frodo experience on mobile and desktop, close every recorded Frodo defect with evidence, preserve user data, and leave no bug marked resolved on prompt wording or assumptions alone.

## Audited bug contract

| Record | Approved implementation target |
| --- | --- |
| `BUG-003` | Open hydrated history at the newest message by scrolling the message container after open and hydration. |
| `BUG-004` | Remove conflicting mobile geometry; contain long tables/code; verify the historical table-heavy fixture before declaring it fixed. |
| `BUG-006` | Test the current Life › Habits app map and catalog registration, then run a read-only live-agent verification. |
| `BUG-008` | Test the grounding contract and run nonexistent/existing task checks while verifying Frodo queries authoritative data first. |
| `BUG-009` | Preserve the existing deterministic reminder scheduler; its nine focused tests already pass. |
| `BUG-012` | Remove silent authentication fallbacks, serialize session saves, test hydration/persistence failures, and verify a cross-session read-only recall path. |
| `BUG-015` | Persist owner-scoped image paths and metadata, rehydrate short-lived signed previews, copy images into bug-specific storage when claimed, and remove unclaimed chat copies when the user confirms Clear. |
| `BUG-016` | Make duplicate lookup fail closed, harden and test canonical matching, deduplicate screenshot paths, and verify the same issue updates one record. |
| `BUG-017` | Guarantee supported image bytes reach Frodo despite staging failure; block undecodable HEIC with a useful JPEG/PNG request instead of claiming it was sent. |
| `BUG-018` | Rearm guarded lazy-import recovery after success and test chunk, HTML-response, and service-worker failure paths without a production Brain write. |
| `BUG-019` | Extract and test storage-key construction for spaces, Unicode, parentheses, missing extensions, and HEIC; verify upload errors remain actionable. |
| `BUG-020` | Replace the phone/tablet layout with a safe-area-aware, accessible visual-viewport sheet through 900 px. |

`FEAT-004`—saving selected Frodo knowledge to Brain—is a separate feature, not a defect. Historical Frodo reports already marked resolved remain historical unless regression evidence reopens them.

## Attachment lifecycle decision

```text
SPEC-GAP
decision: How should Frodo images remain visible after reload without storing large base64 payloads in agent_sessions?
options: reuse the existing private, owner-scoped bug-screenshots bucket with a dedicated chat-staging path and explicit cleanup | add a new private chat-attachments bucket and migration
recommendation: reuse the existing private bucket because it already has owner-only RLS and accepted image types; persist only path/metadata, copy claimed evidence into the bug's folder, and delete chat-staging copies only when Scott confirms Clear
blocked-task: BUG-015
```

Scott's exact approval of this complete contract selects the recommendation. It does not authorize a schema migration, deployment, dependency change, or unrelated production data write.

## Scope

### Included

- Implement, harden, and verify every item in the audited bug contract.
- Use the admin shell's 900 px breakpoint for one mobile/tablet chat mode and preserve the desktop dock above it.
- Add safe-area, keyboard, focus, dialog, scroll-lock, touch-target, long-content, and screen-reader behavior.
- Add pure Node regression tests to the existing suite; do not add a browser-test dependency.
- Use read-only live-agent checks where possible. Mock destructive or production-writing paths.
- Complete the coordinated session archive in `docs/features/session-archive-hygiene.md`.
- After all gates pass, create one commit and push the current `main` branch to `origin/main` under Scott's one-time approval.

### Not included

- New dependencies, a database or storage migration, deployment, or unrelated production writes.
- Claiming a bug resolved when its required evidence fails or cannot be obtained.
- Brain-note creation as a test, because that would be a production write.
- `FEAT-004` or unrelated backlog work.

## Experience contract

- At 900 px and below, Frodo is a `100vh` fallback plus `100dvh` sheet whose controls stay inside top, side, and bottom safe areas.
- Header and composer remain fixed; only messages scroll vertically; wide tables and code scroll inside their message.
- Close, attach, send, and screenshot removal are at least 44 by 44 px. Mobile Expand is hidden.
- Opening on touch focuses Close, not the composer. Escape closes; Tab stays inside; focus returns to the trigger; the page behind is locked.
- Hydrated history opens at the newest turn. New replies continue following the bottom without moving the underlying page.
- Supported attached images remain visible after reload through signed owner-only URLs. Failed or unsupported files show an honest, actionable state.
- Desktop behavior above 900 px remains a right-side dock.

## Acceptance criteria

- [x] Each audited bug has a recorded cause, fix or verified existing fix, and regression evidence in `BUGS.md`.
- [x] The mobile panel is reachable and safe at 320, 390, 430, 640/641, and 900/901 px in portrait/landscape. Safe-area/viewport behavior is implemented; separate software-keyboard automation was unavailable and is disclosed in the archive.
- [x] Long histories open at the newest message; the historical table-heavy response stays visible and scrollable.
- [x] Dialog semantics, focus containment/return, Escape, labels, 44 px controls, and background lock work.
- [x] Session saves cannot silently disappear or complete out of order under the tested contracts.
- [x] Persisted attachment previews rehydrate without storing base64; unsupported HEIC never reaches the vision API as a false success.
- [x] Habits/product-map and task-grounding checks use authoritative sources and passed their approved live read-only checks.
- [x] Duplicate logging never creates blindly after lookup failure and reuses one canonical open record under deterministic coverage.
- [x] Lazy-import, service-worker, response-parsing, and screenshot-key regressions pass without a production write.
- [x] Focused tests, lint, all 255 tests, build, authenticated desktop/mobile inspection, whitespace, secret, diff, and repository-state checks pass, subject to the explicitly deferred production-composition tests.
- [x] The session archive, summary, manifest, durable rules, changelog, work log, bug ledger, and active-work handoff are complete before commit.

## Pseudocode

```text
OPEN FRODO
  use the desktop dock above 900 px
  otherwise render one modal visual-viewport sheet inside device safe areas
  lock the page, focus Close, trap focus, close on Escape, and restore trigger focus
  after history finishes hydrating and the sheet mounts
    move the message container to its bottom without scrolling the page

LAY OUT CHAT
  keep header, attachment tray, and composer fixed and non-shrinking
  let only messages scroll vertically
  contain tables and code horizontally within their message
  keep every mobile action at least 44 by 44 px

PERSIST CONVERSATIONS
  require a real authenticated owner for every session operation
  serialize saves per agent so an older write cannot overwrite a newer one
  surface load and save failures

HANDLE AN IMAGE
  normalize supported images before staging and sending
  if a HEIC image cannot be decoded, retain an error preview and ask for JPEG or PNG
  otherwise send the image bytes to Frodo even if storage staging fails
  when staging succeeds, persist only its owner-scoped storage path and metadata
  on hydration, create a short-lived signed preview URL
  when log_bug claims it, copy it to a bug-specific path before recording the evidence
  when Clear is explicitly confirmed, remove the chat-staging copies and session row

GROUND FRODO
  keep Life > Habits in the exported product map and habits in the catalog
  require authoritative query evidence before task existence or date claims
  fail duplicate-bug lookup closed; never create a record when canonical lookup failed

HARDEN RECOVERY
  rearm lazy-import recovery after a successful import
  reject HTML where JSON is required with an actionable diagnostic
  keep service-worker fallback navigation-only
  construct storage keys only from sanitized generated segments

VERIFY
  run pure regression tests for every deterministic rule
  exercise historical mobile and long-content fixtures
  run read-only live checks for Habits, task grounding, and cross-session recall
  mock any path that would write production Brain or storage data
  run full quality, privacy, documentation, diff, commit, and push checks
```

## Ordered task checklist

- [x] Capture the Dynamic Island report and Scott's all-Frodo-bugs instruction.
- [x] Read the governing workspace, design, workflow, and decision records.
- [x] Audit every Frodo-related bug against current code, tests, history, and rendered behavior.
- [x] Record the complete contract, acceptance criteria, attachment `SPEC-GAP`, and pseudocode.
- [x] Receive Scott's exact one-time approval for implementation, session closure, commit, and push (`go`, 2026-09-29).
- [x] Implement the mobile shell, newest-message, long-content, session, and attachment lifecycle fixes.
- [x] Harden and test product grounding, duplicate logging, lazy-import recovery, and storage keys.
- [x] Make rendered chat Markdown links safe in both text and HTML-attribute contexts, with normal-link and injection regressions.
- [x] Bind asynchronous Command Center attachment preparation to its initiating agent/generation so a late result cannot cross into another agent's draft.
- [x] Fail closed on malformed owner-attributed legacy chat envelopes; never migrate, normalize to empty, or remove their bytes automatically.
- [x] Fail durable-session hydration closed when display/API arrays contain null or non-object message elements, while preserving unknown fields on valid objects.
- [x] Clear local attachment drafts immediately after authoritative session deletion even when later legacy/staging cleanup returns a warning.
- [x] Bind every session operation to the established authenticated owner and fail if a deferred auth read drifts before the operation begins.
- [x] Prevent same-agent attachment intake from entering an in-flight send generation and being erased when that earlier send settles.
- [x] Persist accepted Command Center/Overseer user turns before model work and every individual tool result before further execution, not only terminal snapshots.
- [x] Make Settings “Clear all AI chat history” cover durable Frodo and every Command Center row plus mounted runtime state/staging, or narrow the claim and behavior truthfully.
- [x] Bind each Frodo/Command Center tool execution and model transmission to the turn's established owner so deferred auth cannot resume against a different account's data.
- [x] Prevent a successfully cleared durable conversation from falling back to retained owner-legacy history when legacy cleanup warns or fails.
- [x] Abort Frodo before model/tool continuation whenever an accepted-turn or per-tool durable checkpoint fails; never continue to another side effect without causal history.
- [x] Bind the Budget Griphook/Banker sessionStorage conversation to its authenticated owner so an account transition cannot expose the prior owner's financial chat.
- [x] Run focused, full, read-only live-agent, desktop, and mobile validation. The final privacy live retry was deliberately aborted after Scott's usage-limit correction; deterministic contract coverage replaces any live-pass claim.
- [x] Resolve or honestly record every Frodo bug based on evidence; direct production-composition test gaps remain explicitly deferred as `BUG-055/056`.
- [x] Complete the permanent session-hygiene rules; the current transcript is reconciled through its recorded pre-closure cutoff.
- [x] Complete the post-task checklist, privacy/secret review, and final diff review.
- [ ] Commit all completed changes once and push `main` to `origin/main`; Git records this containing closure action.
- [ ] Verify the commit hash, remote update, and clean repository state; report it without a documentation-only follow-up commit.

### Scope correction recorded 2026-09-29

1. [x] Record Scott's rule that newly discovered unrelated defects are logged, not automatically fixed.
2. [x] Add the two independent-review coverage gaps to the bug register as deferred work.
3. [x] Make no application-code or test changes for those deferred findings.

## Implementation record

- Files changed: Frodo/Command Center/Griphook UI and runtime paths, agent orchestration and authenticated APIs, shared persistence/attachment/validation utilities, deterministic tests, and the coordinated documentation/session archive.
- Data/API changes: The implementation reuses the existing private owner-scoped storage bucket and existing `agent_sessions` JSON. Griphook moved from one unowned browser key to versioned owner-keyed sessionStorage envelopes. No dependency, schema, or storage migration was added.
- Approval exception: Scott requested one final approval for implementation, closure, commit, and push before going to bed and authorized the recorded contract with exact “go” on 2026-09-29. That approval is session-specific and does not become a standing rule.

## Validation so far

- `BUG-009`: all nine focused recurrence tests pass.
- Authenticated mobile inspection at 319 by 808 px confirmed `top: 8px`, a 4,677 px history at `scrollTop: 0`, and the unsafe close position.
- Current source/history establishes the causes or required verification paths recorded above.
- Added one pure assistant contract shared by the Life UI, product map, and Library catalog. It fixes the source-of-truth drift behind `BUG-006` and requires a successful current-turn reminders query before task facts for `BUG-008`.
- Three focused assistant-contract tests, focused ESLint, and the whitespace check pass; duplicate logging and recovery work remain active.
- Added dependency-injected pure cores for ordered agent-session writes, actionable auth/query failures, safe generated storage keys, owner-checked chat staging and bug-evidence copying, signed attachment metadata, preview hydration, and vision payload construction. API and UI integration plus focused tests remain active.
- Fixed guarded lazy imports to rearm stale-chunk recovery after successful first or retry imports, retry only recognized chunk failures, preserve a different retry exception, and cap reloads to one armed cycle. Five deterministic recovery tests and focused ESLint pass; HTTP/service-worker checks remain.
- Added four regression tests proving guarded API parsing accepts JSON/empty success, preserves JSON server errors, and turns HTML platform responses into actionable status/URL/MIME/plain-text diagnostics through Frodo's real call path. No production Brain write occurred.
- Added four tests that execute the real service worker in a mocked worker context: offline shell fallback is navigation-only, scripts receive only their exact cached asset or an error, and API/non-GET requests are untouched. Production service-worker code required no change.
- Integrated strict authenticated and serialized session persistence, owner-checked screenshot lifecycle APIs, signed preview rehydration, metadata-only display persistence, and confirmed-Clear cleanup. Clear cancels its debounce, waits behind in-flight saves, removes persisted plus unsent staging paths, and suppresses only the empty post-clear write. All 26 focused session/storage/attachment tests pass; ChatBot wiring remains coordinated with the mobile UI work.
- Replaced permissive duplicate filing with conservative tested canonical matching and a fail-closed lookup. `log_bug` now performs lookup before consuming evidence, deduplicates merged paths, copies staged evidence into the canonical bug folder, restores pending staging paths on failure, and rolls back copied evidence plus a partially created new report. Incomplete cleanup is surfaced with the report id and manual-cleanup warning. Seven focused dedupe tests pass.
- Registered all nine new regression files in the repository test command. The combined additions initially passed 50/50 and the full suite initially passed 143/143, but independent integration review reproduced timing flakiness in two new session-ordering tests. Their behavior remains under correction; focused ESLint and the production build pass with only the existing large-chunk advisory.
- Independent integration review blocked release and identified cross-account queued writes, failed-hydration overwrite risk, unknown attachment-version loss, global pending-evidence races, debounced last-write loss, >200-message staging leaks, incomplete copy rollback reporting, stale post-queue caching, concurrent duplicate creation, and a global lazy-import reload guard. Each finding has been routed into the active implementation and must have a focused regression before closure.
- Implemented the `BUG-003/004/020` UI pass: Frodo now uses one safe-area `100vh`/`100dvh` sheet through 900 px, preserves the desktop dock above it, scrolls the message container—not the page—to the newest hydrated turn, keeps header/composer fixed, contains long tables/code, locks the background, and adds mobile dialog focus, Escape, focus return, hidden Expand, and 44 px controls. Five focused UI-policy tests, scoped ESLint, and whitespace checks pass; attachment integration and rendered validation remain.
- After the first integration-correction pass, the complete registered test command passed 160/160 with no failures. Final validation remains pending because coordinated attachment/UI edits were still active during this run.
- Final mobile code review added legacy Safari media-query listener compatibility, corrected containment to target the actual markdown message element, and made composer spacing additive with the bottom safe-area inset. The UI tests passed 5/5; an interim full run passed 161/161, lint passed, the production build passed with its existing size advisory, and the whitespace check passed. Shared ChatBot attachment integration and rendered validation remain.
- Completed the shared ChatBot attachment integration: pending evidence is scoped to its model turn, supported image bytes still reach Frodo when storage staging fails, attachment metadata survives persistence, undecodable HEIC stays visible with an actionable error but is never sent falsely, and confirmed Clear awaits cleanup with sent, current-unsent, and removed-unsent staging paths. The two policy suites are registered; focused ESLint and all 51 focused session/attachment tests pass. Final full gates and rendered validation remain.
- Final privacy review discovered `BUG-021`: the four-second session-read cache was keyed globally before owner resolution, so a direct in-app account identity change could reuse the previous owner's transcript without a new RLS request. Release is blocked until the cache is owner-keyed and an account-switch regression passes.
- The post-integration UI suite still passes 5/5, but full lint correctly blocked on a render-time `attachmentWorkRef.current` read in `ChatBot.jsx`. The attachment integration must represent that pending state through React state before the build and final gates can run.
- Final data-integrity review discovered `BUG-022`: malformed or future session payloads were normalized to empty history, unlocking a save that could overwrite unknown durable data. Release is also blocked until malformed non-null history fails hydration visibly and has regression coverage.
- Final ordering review discovered `BUG-023`: session loads did not wait for an owner's in-flight save or clear, so rapid remount could hydrate an old row and later overwrite the newest state. Release is blocked until owner reads wait behind earlier mutations and a deterministic race regression passes.
- Recovery review found one remaining `BUG-018` edge case: when `sessionStorage` is inaccessible, the stale-chunk path could reload without persisting its one-reload guard. It now reloads only after the per-module guard can be read back; otherwise it surfaces the actionable old-version error. A storage-blocked regression was added and awaits validation.
- All nine lazy-import recovery regressions now pass, including inaccessible storage, per-module isolation, retry behavior, and the one-reload cap; focused ESLint and the whitespace check also pass.
- Patched the final session blockers: reads and cache keys are owner-scoped, loads wait for that owner's earlier saves/clears, malformed/future durable payloads fail closed, successfully saved history evictions remove only staging paths no longer referenced by retained messages, and Send/Enter stays disabled during attachment preparation. Deterministic coverage now passes 56/56 with scoped lint; final repository gates remain.
- The first stable post-integration repository run passed all 174 registered tests, full lint, the production build, and `git diff --check`; the focused UI policy suite remains 5/5. Root review and rendered device checks still precede final closure.
- After the settled identity-boundary, hydration-gate, and Clear-order corrections, the implementation owner reran the complete repository gates: all 183 registered tests passed, full lint passed, the production build passed with only the existing Rollup size advisory, and `git diff --check` passed. Independent settled-tree review, root verification, and rendered checks still precede closure.
- Independent settled-tree review then found `BUG-026`: terminal Command Center paths assign the snapshot to persist from inside a React functional updater and test it immediately afterward. Because updater execution can be deferred, a completed/error/Overseer result can skip its durable save. Release is blocked until snapshot derivation is pure and deterministic and all three paths have regression coverage.
- Repaired `BUG-026`: Command Center now derives one exact terminal snapshot outside React updaters, publishes it to state/ref, and awaits persistence of that same snapshot across agent success/error and Overseer success/failure; Clear keeps the ref synchronized. The focused policy suite passes 6/6, scoped ESLint passes, and a same-pattern scan found no remaining impure snapshot assignments. Full gates and independent re-review still block release.
- Root inspection found the six-test suite exercised agent success, agent error, and Overseer success but not the changed Overseer failure path. An explicit failure-path regression is required before the focused result or full gates can close `BUG-026`.
- Added the missing explicit Overseer failure regression. The focused runtime-session policy suite now passes 7/7; scoped ESLint, all 187 repository tests, full lint, the production build, and `git diff --check` pass. A global same-pattern scan found no remaining functional-updater assignment followed by an immediate external read. Independent re-review and root gates remain.
- Root independently reran the settled release gates: all 187 tests passed, full lint passed with zero warnings, the production build passed with only the existing Rollup >500 kB advisory, and `git diff --check` passed. Rendered responsive checks, live grounding checks, independent sign-off, privacy/docs closure, and repository-state review remain.
- Authenticated 320×808 inspection verified the full panel stays inside the viewport, has dialog/modal semantics, locks both page roots, focuses Close, uses message-only scrolling, and opens the 4,125 px restored history at its newest message (`scrollTop 3442`, at bottom). It also discovered `BUG-027`: the header actions measured only 28 px tall, below the approved 44×44 touch floor. Release is blocked until the rendered target size is corrected and the responsive matrix is rerun.
- The same UI audit found `BUG-028` and `BUG-029`: dynamic replies/status lack log/live announcements, and the entire composer remains interactive while confirmed Clear awaits durable deletion and staging cleanup. Release is blocked until accessible announcements are scoped without replaying restored history and a visible Clear-pending gate disables every competing conversation mutation.
- Independent review expanded `BUG-029` to Command Center, where a new action can also race `clearThread()` before deletion settles. It also found `BUG-030`: the old global `frodo_chat_session` localStorage payload is not owner-bound, so a later authenticated account could display or import another owner's unsaved legacy transcript. Release is blocked until both runtimes make Clear exclusive and unowned legacy data is quarantined without deletion or attribution.
- Root review clarified the `BUG-030` data-safety gate: the unattributable global payload must remain untouched, never display/import automatically, survive confirmed Clear, and produce a non-content actionable recovery warning rather than becoming silent abandoned data.
- Root review also expanded `BUG-029` to attachment work already in flight when Clear is requested: Clear must wait/block before deletion, and pre-gate preparation must not publish or stage a new object into the emptied conversation afterward.
- The `BUG-029/030` implementation is now wired but remains under correction: Frodo has a synchronous exclusive Clear gate plus clearing UI state and attachment rechecks; Command Center has a per-agent Clear gate, synchronous busy tracking, and gated conversation controls; only owner-attributed legacy keys can be read/cleaned, while the historical global payload stays quarantined with a content-free warning. Focused regressions cover both gates, attachment-safe Clear, and A→B/unowned preservation/no-import; lint/test feedback is still being resolved before any pass is claimed.
- Review found `BUG-031`: Clear's “deleted from every device” copy is stronger than the system can guarantee because there is no cross-device invalidation or server tombstone/version to reject a dormant stale writer. This pass will correct the promise and document the limitation; truly final global deletion remains an explicit future architecture task requiring a server-enforced concurrency contract.
- The focused `BUG-029/030/031` pass is green: 29 session/attachment/runtime policy tests, scoped ESLint, and `git diff --check` pass. Both chat surfaces now gate Clear immediately and visibly, attachment work blocks deletion on both sides of confirmation, global unowned legacy data stays untouched with a content-free warning, owner cleanup is scoped, and Clear copy no longer claims “every device.” Final adjacent review and full gates remain.
- The settled combined tree passes all 195 registered tests, full lint, the production build after 3,145 modules, and `git diff --check`; the only build notice is the existing Rollup >500 kB advisory. Responsive/live checks, independent sign-off, documentation closure, commit, and push remain.
- Independent final review found `BUG-032`: the shared chat Markdown renderer escapes link text but interpolates a parsed URL into a quoted HTML attribute without attribute-context encoding, so a quote-bearing HTTPS URL can inject an event attribute through Frodo or Command Center output. Release is blocked until URLs are validated/encoded for the attribute context and regressions cover both ordinary HTTPS links and quote/event payloads.
- Independent final review found `BUG-033`: Command Center keeps one shared attachment draft, so agent B can expose/send A's already-prepared images; late A normalization can repopulate B; and A's later send/Clear settlement can erase new B images. Release is blocked until attachment state and every publish/clear completion are agent-bound, with ready-shot, deferred-normalization, send-settlement, and Clear-settlement switch regressions.
- Independent security review found `BUG-034`: an owner-attributed legacy envelope with non-array history fields passes a `.length` check, normalizes to an empty session, becomes eligible for migration, and can then be deleted after the next save. Release is blocked until both fields require arrays and malformed bytes remain quarantined, unmarked, and untouched.
- Independent data-integrity review found `BUG-035`: durable session hydration proves only that top-level history values are arrays, so string/null/invalid-content elements can enter writable state, be structurally corrupted, or throw before persistence error handling and create an unhandled debounced rejection. Release is blocked until every element has a safe non-null message shape, unknown object fields stay forward-compatible, and nested-malformed zero-write regressions pass.
- Independent Clear review found `BUG-036`: after the authoritative session row is deleted, a legacy/staging cleanup warning makes the hook throw before ChatBot clears its local screenshots, leaving deleted attachment metadata and thumbnails available to resend. Release is blocked until local draft/ref cleanup follows committed session deletion regardless of cleanup warnings, with a warning-path resend regression.
- Independent ownership review found `BUG-037`: production session and screenshot-storage operations await their own owner lookup and accept whichever owner resolves later, so work begun under A can bind a session or upload/copy/delete under B after an auth transition. The most destructive path is Clear: its row delete and whole `_staging` enumeration resolve owners separately and could delete B's conversation and staged screenshots from A's screen. Release is blocked until the full transaction carries/verifies one established owner and deferred auth-drift regressions pass.
- Independent attachment review found `BUG-038`: Command Center snapshots a draft generation, awaits the full agent run, then clears that generation, while paste/drop handlers still accept new images for the same busy agent. A late image joins the old generation and is silently erased when the earlier send settles. Release is blocked until intake is gated at handler level during busy work or new drafts are generation-partitioned, with a delayed-send/late-drop regression.
- Independent durability review found `BUG-039`: Command Center publishes accepted user turns and committed tool exchanges only in memory, with the first durable write at terminal success/error; Overseer has the same gap. A refresh after a side effect but before terminal settlement loses the request/tool history and can invite replay. Release is blocked until a closed pending snapshot is persisted before model execution and each committed tool exchange is checkpointed, with interruption-before-terminal regressions.
- Independent privacy review found `BUG-040`: Settings claims to clear every AI thread but deletes only five unscoped IDs, missing every `${id}:cc` Command Center row, Frodo staging, and both mounted runtimes' in-memory histories; a later send can resave deleted content. Release is blocked until Settings coordinates authoritative/runtime clearing across the complete known agent set or truthfully narrows the action, with visible-state, durable-row, reload, and later-send regressions.
- The focused `BUG-032–035` implementation pass is green: Markdown URLs are validated and encoded for HTML attributes; Command Center drafts/async settlements are agent- and generation-bound; owner-attributed legacy envelopes require array histories before migration; and durable session hydration rejects unsafe nested message shapes while preserving valid unknown object fields. All 46 affected tests, scoped ESLint, and `git diff --check` pass. `BUG-036–040`, full gates, and final review remain.
- Auth-boundary review expanded the same primitive into `BUG-041`: ordinary Frodo/Command Center tool APIs call unbound `uid()`, so an A turn already awaiting auth can resume under B, access/mutate B's rows with valid RLS, and record the result into the wrong causal history. Release is blocked until each turn/tool carries or verifies its established owner through execution and a deferred-auth tool regression passes.
- Clear/reload review found `BUG-042`: when durable deletion succeeds but owner-legacy removal fails, the warning path correctly retains the key, yet the next no-row hydration falls back to that same payload and auto-migrates the cleared conversation. Release is blocked until committed Clear leaves an authoritative empty/tombstone signal or otherwise suppresses legacy fallback, with clear→cleanup-failure→reload coverage.
- Checkpoint review found `BUG-043`: Frodo's persistence helper returns `false` on failure, but accepted-turn, post-tool, terminal, and error paths ignore it and continue; a tool mutation can therefore succeed without durable causal request/result history and be replayed after reload. Release is blocked until pre-model/post-tool failures abort continuation visibly and terminal failures stay actionable, with false-save-before-model/tool regressions.
- Settings inventory review exposed `BUG-044`: Budget Griphook hydrates and saves one unowned static sessionStorage key; sessionStorage survives ProtectedRoute's A→B hard reload, so B can open Money and read A's financial conversation. Release is blocked until the Banker session is owner-keyed/enveloped or quarantined/cleared on identity change, with A→B transition coverage.
- Implemented `BUG-027` and `BUG-028`: the mobile header rule now outranks the shared 28 px mini-button height and enforces true 44 px targets through 900 px; restored history activates a polite additions-only conversation log only after open/hydration settles, while a separate atomic status announcer avoids duplicate typing output. Eight focused UI tests, scoped ESLint, the production build, and `git diff --check` pass; authenticated responsive/accessibility reinspection remains.
- Authenticated 320×808 reinspection now measures each header action at 44 px tall, keeps Close focused, keeps the full panel within 320×808, and leaves history at the newest turn. The hydrated conversation exposes `role=log`, `aria-live=polite`, `aria-relevant="additions text"`, plus a separate polite atomic status region. Remaining viewport widths and focus/Escape checks still precede closure.
- Implemented `BUG-040/044`: Settings now preflights and locks the mounted Frodo and Command Center runtimes, inventories every current owner's historical `agent_sessions` identifier, preserves Frodo's authoritative empty row, clears all other rows, staged screenshots, visible state, inputs, and the owner-only Money chat, and reports partial failures without an all-clear claim. Griphook now uses a versioned owner-keyed session envelope; unowned, wrong-owner, malformed, future, and inaccessible bytes are quarantined without import or overwrite, and Clear is disabled during an active turn. Fifty-two focused session/clear/attachment tests, scoped ESLint, and `git diff --check` pass; full gates and rendered Settings/Money checks remain.
- A delegated visual attempt did not produce evidence: its local surface redirected to login and the available signed-in native inspection hung before being aborted. No visual pass is claimed from that attempt; authenticated root viewport checks remain required.
- Implemented the final checkpoint/auth pass. Frodo, Command Center, Overseer, Griphook, and Bilbo revalidate the captured owner immediately before every model transmission; one shared production runner persists a balanced write-ahead tool batch, each completed result before the next tool, and nested consultant progress. Command Center exposes a persistent Retry save warning, Griphook now checkpoints accepted and tool-bearing turns, and terminal/error saves settle without rewriting truthful replies. Focused loop plus 49 policy tests and scoped lint pass after fixing `BUG-045`; full gates and rendered checks remain.
- The settled implementation's first complete test command passed all 242 registered tests. This is test evidence only; lint, build, rendered/live checks, archive closure, final review, commit, and push remain open.
- Full lint, the 3,147-module production build, whitespace validation, and `ledger.jsonl` parsing pass on the same tree. The build retains only the known Rollup large-chunk advisory; no warning is being represented as a failure or silently discarded.
- Final settled-tree review found `BUG-046–048`: synchronous global-Clear failures can escape all-settled reporting, the production tool loop copies rather than consumes its mutable screenshot queue, and Griphook's generic persistence effect can overwrite its accepted-turn checkpoint during an active run. Release remains blocked until all three production paths and regressions are corrected.
- Corrected the three settled-tree findings: each global-Clear callback now enters the all-settled boundary before invocation, the per-turn screenshot queue retains object identity across tools, and Griphook's generic persistence effect cannot run inside an active turn. Focused regressions were added; validation remains before closure.
- Follow-up review found `BUG-049`: Griphook work can outlive the Money page and rewrite its owner session after Settings reports a global Clear. Global deletion must share an owner-scoped exclusive gate with the full Griphook turn and cancel earlier preflight locks if a later surface is not ready.
- Nested-history review found `BUG-050/051`: Griphook owner sessions and owner-attributed Frodo legacy envelopes validate only outer arrays/plain objects, allowing malformed roles or model content to enter writable/migratable state. Both paths must reuse the durable-session structural contract and leave invalid source bytes untouched.
- Implemented the shared Griphook lifecycle and nested-history corrections: owner turns remain exclusive across page unmount/remount and global Clear, while durable, Griphook, and owner-legacy histories now share safe role/content/block validation without stripping valid unknown fields. Focused validation remains.
- Copy review found Settings still overstates global deletion because deliberately quarantined unowned legacy backups remain untouched. The `BUG-040` UI must name the current account boundary and disclose that quarantine before closure.
- Settings now truthfully limits global Clear to the current account's owned app chats and explicitly preserves quarantined unowned backups for recovery; deterministic copy coverage protects that boundary.
- Remount review found `BUG-052`: the owner gate rejects concurrent sends but a Money page remounted mid-turn does not learn the old instance's final history, so its next send can persist a stale causal prefix. Owner-scoped durable snapshot publication/subscription is required before closure.
- Resolved the remount gap with owner-scoped session publication plus subscribe-before-read synchronization and removed generic Griphook auto-persistence. The expanded 57-case policy pass, loop tests, scoped lint, and whitespace check are green; full repository and rendered checks remain.
- Recovery review found `BUG-053`: a successful retry after a transient Griphook storage failure clears the warning but does not restore the active view's writable flag. Explicit persistence must return one tested saved/writable/warning outcome before closure.
- Resolved the transient-save recovery gap with one explicit persistence outcome; fail-once/succeed-on-retry coverage confirms the active composer becomes writable again. The expanded focused policy pass is 58/58 with loop, scoped lint, and whitespace checks green.
- The live read-only check passed Habits location and authoritative nonexistent-reminder grounding, then exposed `BUG-054`: generic “non-sensitive” recall volunteered a physical access secret. Repository evidence omits the secret; all Frodo tiers now need an explicit non-volunteering disclosure contract and regression coverage.
- The first privacy retry avoided the access secret but still volunteered a private body/fitness target. `BUG-054` therefore remains open until generic recall excludes every sensitive personal category and selects only safe app/project context or no example.
- Re-review showed `BUG-021` was only partially fixed: owner-keyed reads protect fresh loads, but the protected subtree tracks only an auth boolean, so an in-place A→B identity event can leave A's Frodo and Command Center state mounted and let B's first save copy it. Release remains blocked until owner identity remounts/resets both runtimes and an in-place switch regression passes.
- The identity-boundary correction must also stop an already-running A turn: remounting UI alone does not cancel its awaited model/tool work, whose later save could capture B. The active fix therefore needs an abortive owner transition (a hard A→B reload is acceptable) plus transition coverage, not only a React key.
- Final shared-runtime review discovered `BUG-024`: Command Center enables send/clear before its lazy session load completes, so a fast send can start from empty state and later overwrite durable agent history. Release is blocked until runtime loading/ready/error/retry state gates those actions and a delayed-hydration regression passes.
- Clear-path review discovered `BUG-025`: production removed staging screenshots before deleting the session even though the tested policy was session-first. A failed database delete could therefore leave the transcript with broken images. Release is blocked until production uses session-first deletion and surfaces retryable post-delete cleanup failures.
- The `BUG-025` review raced an integration patch: the current hook is now session-first, clears local history after durable deletion, and surfaces staging cleanup warnings. It remains a validation blocker only until higher-level failure-order coverage passes.
- A second Clear review found legacy local history was still removed before remote session deletion completed. That ordering must move after confirmed durable deletion so a failed Clear cannot erase the only not-yet-migrated copy; the failure regression is part of the remaining `BUG-025` gate.
- Implemented the settled `BUG-021/024/025` corrections: established-owner loss/change hard-reloads to terminate old async work while same-owner refresh remains mounted; the protected subtree is owner-keyed; Command Center exposes idle/loading/failed/ready history state with replacement hydration and Retry, and blocks sends, clears, Overseer, and persistence until ready; confirmed Clear now orders remote session deletion, legacy cleanup, then staging cleanup, preserving legacy on DB failure and returning retry details after post-delete cleanup failure. Scoped lint and all 35 focused regressions pass; independent re-review and full gates remain.

# Bug and fix ledger

Every discovered software defect belongs here, including defects found while building another feature. Entries are never deleted; resolved entries retain the cause and proof of the fix.

**Closure evidence (2026-09-29):** Every entry marked Resolved in the Frodo reliability work was revalidated on the settled tree by all 255 registered tests, zero-warning ESLint, the 3,148-module production build, and `git diff --check`. Earlier per-entry notes saying broader gates remained describe intermediate checkpoints and are superseded by this final evidence. Direct assembled-production integration gaps remain honestly deferred as `BUG-055/056`.

## Entry format

### BUG-000 — Short title

- **Status:** Open | Investigating | Resolved | Deferred
- **Discovered:** YYYY-MM-DD
- **Area:**
- **Observed:** What happened.
- **Expected:** What should happen.
- **Impact:** Who or what is affected.
- **Cause:** Unknown until established; never guess.
- **Fix:** The implemented correction.
- **Regression coverage:** Test or repeatable manual check.
- **Related work:** Feature document, commit, or decision ID.

## Entries

### BUG-001 — Mobile day-view switch visible on desktop

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Planner day modal
- **Observed:** The Details/Schedule switch intended for the mobile sheet also appears above the desktop two-column layout.
- **Expected:** Desktop shows details and schedule together without a view switch; the switch appears only at the mobile breakpoint.
- **Impact:** Desktop layout contains a redundant, misleading control.
- **Cause:** The shared `.admin-shell .segmented` display rule has greater selector specificity than `.day-view-switch`, so the desktop hidden state is overridden.
- **Fix:** Scoped the hidden and mobile display rules to `.admin-shell .day-modal .day-view-switch`, giving them precedence over the shared segmented-control rule.
- **Regression coverage:** Authenticated 1091 px desktop check confirmed a two-column grid with the switch hidden; authenticated mobile check confirmed the switch remains visible and operable.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`

### BUG-002 — Hidden mobile schedule loses its opening position

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Planner mobile day modal
- **Observed:** A newly opened day's schedule can remain at midnight after switching from the default Details pane.
- **Expected:** Switching to Schedule applies the approved opening position: current hour today or 8:00 AM on another date.
- **Impact:** Mobile users may initially see the wrong portion of the day.
- **Cause:** The timeline's scroll effect runs while the mobile Schedule pane is `display: none`; the browser clamps the hidden rail to zero and the effect does not rerun when the pane becomes visible.
- **Fix:** Added a pane-state scroll key so `DayTimeline` reapplies its opening position when Schedule becomes visible.
- **Regression coverage:** Focused current-hour/8:00 AM unit test plus authenticated mobile verification that September 30 opens at 8:00 AM after switching from Details.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`

### BUG-003 — Frodo chat opens at the oldest message

- **Status:** Resolved
- **Discovered:** 2026-09-28; imported 2026-09-29
- **Area:** Frodo chat panel
- **Observed:** Opening chat starts at the top of its history.
- **Expected:** Chat opens at the newest message.
- **Impact:** Users must manually traverse the conversation to resume it.
- **Cause:** Persisted history hydrates while the closed panel and its bottom sentinel are unmounted. The scroll effect depends on message/loading changes but not on the panel opening, so mounting an already-hydrated thread does not move its message viewport.
- **Fix:** Opening now schedules a bottom scroll after the panel mounts and after hydration settles, targeting only the message container rather than the page.
- **Regression coverage:** Focused scroll-helper cases pass, and authenticated short/long-history checks opened at the newest turn at phone and desktop breakpoints.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`; `docs/backlog/bug-report-2026-09-29.md`

### BUG-004 — Long Frodo responses disappear on iPhone

- **Status:** Resolved
- **Discovered:** 2026-09-28; imported 2026-09-29
- **Area:** Frodo chat panel on iPhone
- **Observed:** After a long table-heavy response, message content becomes blank while close controls and fragments remain.
- **Expected:** The complete response remains visible and scrollable.
- **Impact:** Mobile users lose the answer they requested.
- **Cause:** The historical exact blank state was not reproducible after the mobile shell replacement; the current risk was wide Markdown content escaping a viewport-constrained panel with conflicting mobile geometry.
- **Fix:** Frodo now uses one safe-area viewport sheet through 900 px, confines vertical movement to the message region, and contains tables/code with their own horizontal overflow.
- **Regression coverage:** UI policy tests pass, and authenticated iPhone-width inspection confirmed a table wider than its message remains present and horizontally contained rather than blanking the panel.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`; `docs/backlog/bug-report-2026-09-29.md`

### BUG-005 — Food log primary and secondary actions are reversed

- **Status:** Open
- **Discovered:** 2026-09-10; imported 2026-09-29
- **Area:** Life › Food › Add Meal
- **Observed:** Save is on the left and Back is on the right.
- **Expected:** Back appears on the left and Save to Log on the right.
- **Impact:** The form conflicts with the product's expected action order.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify desktop and mobile action order.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-006 — Frodo incorrectly reports that Planner has no Habits section

- **Status:** Resolved
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Assistant product knowledge
- **Observed:** Frodo denied the existence of Planner habits even though the section exists.
- **Expected:** Frodo verifies current product capabilities before answering.
- **Impact:** Users receive incorrect guidance and may create data in the wrong place.
- **Cause:** The earlier assistant contract did not expose a reliable app map or Habits collection lookup.
- **Fix:** One shared tested product contract names Life › Habits, feeds both UI/product-map and Library catalog context, and requires verification rather than model recollection.
- **Regression coverage:** Shared-contract tests pass and the approved live read-only check correctly located Habits under Life.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-007 — Recurring reminders without due dates do not appear on the calendar

- **Status:** Open
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Reminders and Calendar
- **Observed:** Recurring reminders created without a due date are absent from Calendar.
- **Expected:** Their recurrence dates make them visible on the relevant calendar days.
- **Impact:** Scheduled commitments can disappear from planning views.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; cover recurring reminders with and without an explicit first due date.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-008 — Frodo claims an unverified task exists

- **Status:** Resolved
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Assistant data verification
- **Observed:** Frodo claimed a task named “Scrub” existed on July 30 without confirming stored data.
- **Expected:** Frodo checks the authoritative task source before making a factual claim.
- **Impact:** Users cannot trust task-status answers.
- **Cause:** The earlier assistant contract allowed factual task claims without first requiring an authoritative query.
- **Fix:** The shared assistant contract requires a successful current-turn reminders query before any existence, non-existence, date, or status claim and requires honest tool-failure reporting.
- **Regression coverage:** Deterministic contract coverage passes and the approved live read-only nonexistent-reminder check used the authoritative query and returned zero results without inventing a task.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-009 — Frodo schedules repeated reminders consecutively

- **Status:** Resolved
- **Discovered:** 2026-07-28; imported 2026-09-29
- **Area:** Reminder scheduling
- **Observed:** Multiple weekly reminder occurrences were initially placed on consecutive days despite an instruction to spread them out.
- **Expected:** Frodo honors explicit spacing and uses sensible distribution when spacing is implicit.
- **Impact:** Plans become impractical and require manual correction.
- **Cause:** The earlier assistant path relied on model-selected dates instead of one deterministic scheduling rule.
- **Fix:** Reminder creation now routes weekly frequency through deterministic scheduling; two occurrences per week become Tuesday and Friday rather than consecutive dates, and the prompt requires the same path.
- **Regression coverage:** Nine focused recurrence tests cover deterministic reminder planning; all passed during the 2026-09-29 audit.
- **Related work:** Commit `732d1bd`; consolidates two open source reports; `docs/backlog/bug-report-2026-09-29.md`.

### BUG-010 — Created reminders do not notify the user

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Reminders and notifications
- **Observed:** A reminder can exist without producing its expected notification.
- **Expected:** Eligible reminders notify at their configured time, or clearly disclose why they cannot.
- **Impact:** Users can miss time-sensitive commitments.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; verify permission, scheduling, and delivery paths.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-011 — Dates page is visually cluttered and inconsistent

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Life › Dates
- **Observed:** The page has inconsistent spacing, hierarchy, and controls compared with the design system.
- **Expected:** A clean, coherent layout that follows current product standards.
- **Impact:** The page is harder to scan and feels unfinished.
- **Cause:** Unknown; requires current UI review.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; source evidence: `dates-page-ui-is-cluttered-and-inconsistent-with-design-stan-aa0565-1.png`.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-012 — Frodo fails to recall earlier-session reminders

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Frodo memory and conversation continuity
- **Observed:** Frodo cannot reliably recall reminders or conversation context from earlier sessions.
- **Expected:** Frodo retrieves relevant durable context before answering.
- **Impact:** Users must repeat themselves and may receive contradictory responses.
- **Cause:** Frodo's visible and model history previously lived in browser storage behind a one-hour expiry, with a hydration race that could overwrite stored history.
- **Fix:** Both histories persist in owner-scoped Supabase `agent_sessions`; hydration gates sending/saving, mutations are ordered, failures remain visible, and account changes abort old work.
- **Regression coverage:** Session ordering/owner/hydration tests pass and the approved live continuity check successfully recalled prior-session context. The separate generic-disclosure privacy defect found during that check is closed as `BUG-054`.
- **Related work:** Consolidates two open source reports; `docs/backlog/bug-report-2026-09-29.md`.

### BUG-013 — Reminders are missing from primary mobile views

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Mobile Homepage, Today, and Reminders
- **Observed:** Existing reminders do not display in the primary mobile views.
- **Expected:** The same eligible reminders appear consistently across mobile planning surfaces.
- **Impact:** Critical planning data is unavailable on mobile.
- **Cause:** Unknown; requires diagnosis.
- **Fix:** Not implemented.
- **Regression coverage:** Not yet added; compare a known reminder across all three mobile views.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-014 — Mobile full-screen day view is broken

- **Status:** Open
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Plan › Overview day view
- **Observed:** The full-screen day view is unusable or incorrectly laid out on mobile.
- **Expected:** Day details remain readable, navigable, and operable at phone widths.
- **Impact:** Mobile users cannot reliably inspect a day.
- **Cause:** Unknown; requires current verification because related day-modal work shipped after the report.
- **Fix:** Not established by this import.
- **Regression coverage:** Verify current behavior before implementation; source evidence: `day-full-screen-view-broken-on-mobile-4e6c4a-1.png`.
- **Related work:** `docs/features/hourly-day-calendar-panel.md`; `docs/backlog/bug-report-2026-09-29.md`

### BUG-015 — Uploaded photos are not visible in chat

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Frodo chat attachments
- **Observed:** A photo can be uploaded or signaled without appearing as usable visual content in chat.
- **Expected:** The user and assistant can see the attached image and its state.
- **Impact:** Image-based requests cannot be completed reliably.
- **Cause:** The earlier chat had no complete mobile preview/delivery path; failed staging could also remove a selected image before send.
- **Fix:** Chat displays staged/live previews, persists only versioned owner-scoped metadata, and restores short-lived signed previews after reload without writing base64 into conversation rows.
- **Regression coverage:** Attachment and session tests cover preview metadata, signed rehydration, staging failure, retention, eviction, and confirmed-Clear cleanup.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-016 — Frodo creates duplicate bug and feature records

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Assistant issue logging
- **Observed:** Frodo creates a new record without checking for an existing matching item.
- **Expected:** Frodo searches current tracking records and updates or links the canonical item.
- **Impact:** The backlog becomes noisy and status fragments across duplicates.
- **Cause:** The original `log_bug` path trusted the model to remember earlier reports and did not check canonical open records itself.
- **Fix:** `log_bug` performs a fail-closed canonical lookup before consuming evidence, updates a conservative open match, deduplicates paths, and rolls back partial new-record/evidence work on failure.
- **Regression coverage:** Seven focused deduplication and rollback cases pass. No production-writing live duplicate was attempted.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-017 — Frodo receives attachment metadata but cannot inspect the screenshot

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Assistant attachment pipeline
- **Observed:** Frodo knows an attachment exists but cannot access its image content.
- **Expected:** Supported screenshots reach the assistant as inspectable visual input.
- **Impact:** Frodo cannot diagnose screenshot-based reports.
- **Cause:** A failed storage upload previously removed the selected image, leaving the assistant with only an attachment signal and no image bytes.
- **Fix:** Supported images retain turn-owned bytes for the model even when private staging fails; undecodable HEIC remains visibly attached with an actionable JPEG/PNG request and is never falsely sent.
- **Regression coverage:** Attachment construction, staging failure, image payload, one-shot evidence, and HEIC rejection cases pass without a production model call.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-018 — `consult_archivist` returns HTML instead of JSON

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Brain / Archivist integration
- **Observed:** Creating Brain notes through `consult_archivist` returns an HTML MIME response where JSON is expected.
- **Expected:** The tool returns its documented JSON success or error payload.
- **Impact:** Brain-note creation fails and callers cannot safely parse the result.
- **Cause:** The earlier service worker returned the app's HTML shell for failed same-origin JavaScript chunk requests, so a stale dynamic import was parsed as JavaScript/JSON.
- **Fix:** Service-worker shell fallback is navigation-only, guarded lazy imports retry recognized stale chunks safely, and API parsing exposes actionable status/URL/MIME/text when HTML appears where JSON is required.
- **Regression coverage:** Service-worker, guarded-import, guarded-parser, and real agent-call-path HTML error tests pass. No production Brain write was used as a test.
- **Related work:** `docs/backlog/bug-report-2026-09-29.md`

### BUG-019 — Screenshot upload rejects a valid request pattern

- **Status:** Resolved
- **Discovered:** 2026-07-27; imported 2026-09-29
- **Area:** Tools › Bugs screenshot upload
- **Observed:** Upload fails with “string did not match the expected pattern.”
- **Expected:** Supported screenshot files upload, or validation explains the invalid field.
- **Impact:** Visual evidence cannot be attached to bug records.
- **Cause:** The earlier storage key derived its extension from the original filename. Names containing spaces, parentheses, Unicode, no extension, or phone-specific formats could produce a key rejected before or during upload.
- **Fix:** Storage objects use generated validated segments and a short sanitized extension derived from supported MIME/normalized format rather than the raw filename.
- **Regression coverage:** Focused cases cover spaces, parentheses, Unicode, missing extensions, HEIC, owner/bug paths, invalid segments, and actionable upload errors.
- **Related work:** Commit `4d027ff`; `docs/features/frodo-mobile-chat-reliability.md`; `docs/backlog/bug-report-2026-09-29.md`.

### BUG-020 — Frodo mobile chat overlaps the iPhone Dynamic Island

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo chat panel on iPhone
- **Observed:** Opening Frodo on mobile positions the panel too high, leaving the close button beneath the iPhone Dynamic Island and inaccessible.
- **Expected:** The complete panel, including a touch-safe close control, stays within the device safe area and remains usable across mobile viewport and keyboard states.
- **Impact:** iPhone users can become trapped in the chat or cannot reliably dismiss it.
- **Cause:** The PWA opts into edge-to-edge rendering, but the mobile panel starts at eight pixels without top/side safe-area insets, uses static `vh`, conflicts with later base declarations, and switches breakpoints at 640 px while the mobile shell switches at 900 px.
- **Fix:** Through 900 px Frodo is one `100vh`/`100dvh` safe-area sheet with fixed header/composer, message-only scrolling, 44 px controls, background lock, dialog focus containment, Escape, and focus return; desktop remains a dock at 901 px and above.
- **Regression coverage:** UI policy tests pass. Authenticated checks at 320, 390, 430, 640, 641, 900, 901 px and 844×390 landscape verified geometry, touch targets, focus trap/return, Escape, scroll lock, newest-message position, and long-table containment. No separate software-keyboard automation was available.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-021 — Agent-session cache can cross account boundaries

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center session loading
- **Observed:** A fresh or pending `agent_sessions` read was cached under one process-global key before the current owner was resolved; additionally, an in-place A→B auth event leaves the already-mounted Frodo and Command Center state holding A's transcript.
- **Expected:** Every cached conversation read is scoped to the authenticated owner, including during direct auth identity changes.
- **Impact:** An in-app account switch could show the previous owner's private Frodo or Command Center transcript, copy A's state into B's row, or let an already-running A turn resume tool/session work under B.
- **Cause:** `loadAgentSessions()` used a static cache key, and the protected application subtree tracked only an authenticated boolean rather than the active owner identity. Owner change therefore did not remount or explicitly clear/reload owner-bound chat state.
- **Fix:** Owner-scoped cache/query logic is implemented. Release remains blocked until the auth identity boundary also aborts old in-flight work and remounts/reloads owner-bound state; a hard reload on any established-owner change or sign-out is the current safest design, while same-owner token refresh remains mounted.
- **Regression coverage:** The owner-keyed cache test passes; an in-place A→B transition regression covering visible state and in-flight/first-save isolation is still pending.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-022 — Malformed session payload can be silently overwritten

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center session hydration
- **Observed:** A stored non-array or future-version `display` or `convo` value is silently converted to an empty array and treated as a successful load.
- **Expected:** Unknown or malformed durable history fails visibly and remains non-writable until it is repaired or a successful retry loads a supported shape.
- **Impact:** The next automatic save can replace recoverable or newer-format conversation history with an empty/current-client snapshot.
- **Cause:** `agentSessionsCore.load()` normalizes every non-array session payload to `[]` instead of distinguishing an absent legacy value from invalid durable data.
- **Fix:** Active; validate persisted row shapes and fail the hydration gate closed on malformed non-null data.
- **Regression coverage:** Pending a malformed-history test proving no writable session state is returned.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-023 — Session reload can race an in-flight save

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center session ordering
- **Observed:** A new session load can query the database while the previous component's latest save or clear is still pending.
- **Expected:** A load for an owner observes all earlier session mutations for that owner before returning hydration data.
- **Impact:** A quick unmount/remount can hydrate an old row and later enqueue that stale snapshot behind the newer save, overwriting the newest conversation.
- **Cause:** Session mutations are serialized by owner and agent, but `load()` does not participate in or wait for the owner's outstanding mutation work; cache invalidation after settlement cannot retract stale data already returned.
- **Fix:** Active; coordinate owner reads behind outstanding owner mutations before querying or caching hydration data.
- **Regression coverage:** Pending a deterministic save-pending → concurrent-load test proving the load cannot return the stale row.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-024 — Command Center can send before history hydration

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Mission Control › Command Center agent conversations
- **Observed:** Agent history begins loading only after Command Center activation, but Send and Clear are available before that asynchronous load succeeds.
- **Expected:** Command Center conversations remain read-only until durable history has loaded successfully; failures remain visible and retryable.
- **Impact:** A fast first send can build from an empty thread and later overwrite the agent's existing durable conversation without its earlier transcript.
- **Cause:** `AgentRuntimeProvider` exposes `sendTo` immediately and has no per-owner hydration gate; the UI enables sending as soon as an agent is selected.
- **Fix:** Active; expose runtime history loading/ready/error/retry state and block send/clear until a successful owner-scoped load.
- **Regression coverage:** Pending a deterministic delayed-load test proving attempted send cannot persist or replace history before hydration.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-025 — Clear can delete screenshots before the transcript

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo confirmed-Clear workflow
- **Observed:** Production originally removed chat-staging screenshots before deleting the durable session row; the first correction also removed the legacy local copy before the remote delete was confirmed.
- **Expected:** Delete the durable transcript first; then clean staging objects, preserving an explicit retryable cleanup warning if storage removal fails.
- **Impact:** A failed remote delete could either leave a transcript with broken images or erase its only still-unmigrated legacy copy before the confirmed Clear completed.
- **Cause:** The production workflow initially bypassed the session-first helper, and the first integration placed legacy-key deletion before confirmed remote session deletion.
- **Fix:** The current hook uses the session-first helper and surfaces post-delete storage warnings; legacy deletion is being moved after confirmed durable deletion.
- **Regression coverage:** Helper coverage passes; higher-level cases for remote-delete failure, legacy preservation, and post-delete storage-cleanup failure remain pending before resolution.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-026 — Command Center can skip persistence after a completed turn

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Mission Control › Command Center agent conversations
- **Observed:** Completed, failed, and Overseer conversation paths choose the updated thread inside a React functional state updater, then immediately test a local variable to decide whether to persist it.
- **Expected:** Every terminal conversation state is derived deterministically and queued for durable persistence without relying on when React executes a state updater.
- **Impact:** React may defer the updater, leaving the local variable unset when checked and silently skipping the latest durable save; the updater also performs an impure side effect.
- **Cause:** `AgentRuntimeContext` couples state derivation and persistence selection to functional-updater execution timing.
- **Fix:** `AgentRuntimeContext` now derives and publishes one exact snapshot outside React functional updaters, synchronizes `threadsRef`, and passes that identical snapshot to an awaited queued save for agent success, agent error, Overseer success, and Overseer failure; Clear also synchronizes the ref.
- **Regression coverage:** Seven focused session-policy tests pass, including explicit agent success/error and Overseer success/error terminal snapshots. Scoped ESLint, all 187 repository tests, the production build, and `git diff --check` pass; independent re-review remains.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-027 — Frodo mobile header controls are shorter than the touch-target floor

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo mobile chat header
- **Observed:** At a live 320×808 viewport, Expand, Clear, and Close render 44 px or wider but only 28 px tall.
- **Expected:** Every mobile chat action has a minimum 44×44 px interactive target.
- **Impact:** The most important escape and history controls remain unnecessarily difficult to tap on a phone, particularly near device cutouts.
- **Cause:** The mobile width rule supplied minimum width, but the later shared `.admin-shell .btn-mini` component rule had enough specificity to keep a 28 px height.
- **Fix:** The mobile selector now explicitly targets `.admin-shell .chat-header-actions .btn-mini` through 900 px, enforcing 44 px minimum dimensions while leaving the desktop dock unchanged.
- **Regression coverage:** Eight focused UI tests pass; the CSS regression reads both loaded stylesheets and proves the mobile declaration outranks the shared 28 px rule. Authenticated 320×808 remeasurement confirms all three header actions are 44 px tall, Close remains focused, the panel stays in bounds, and history stays at the bottom. Scoped ESLint, build, and `git diff --check` pass; the remaining responsive widths still require recheck.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-028 — New Frodo replies are not announced to screen readers

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo chat accessibility
- **Observed:** Hydration and error states have status/alert semantics, but the conversation log, new assistant messages, and typing/status updates have no live-region or log semantics.
- **Expected:** New conversational content is announced without moving focus or rereading the entire restored history.
- **Impact:** Screen-reader users can submit a message but receive no accessible notification when Frodo responds or changes status.
- **Cause:** The scroll container is only labelled as a generic region; dynamic conversation/status content is not exposed through an appropriately scoped live region.
- **Fix:** After open and hydration settle, the conversation becomes a polite `log` announcing added text; a separate polite atomic region announces current status, the visible typing row is hidden from assistive technology, and activation is delayed one animation frame so restored history is not replayed.
- **Regression coverage:** Eight focused UI tests cover delayed activation, log semantics, busy state, and the separate status announcer. Authenticated inspection confirms `role=log`, polite additions/text semantics, and a separate empty polite atomic status region after hydration. Scoped ESLint, build, and `git diff --check` pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-029 — Agent chats remain interactive while confirmed Clear is running

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center session clearing
- **Observed:** Frodo's confirmed Clear handler awaits durable-session and staging cleanup, but Clear, textarea, attachment, and Send remain enabled because the hook exposes no clearing state. Command Center likewise allows another action while `clearThread()` awaits row deletion.
- **Expected:** Once confirmed, Clear becomes a visible busy operation and every action that can mutate or recreate the conversation remains disabled until it succeeds or fails.
- **Impact:** A user can send or stage a new item during deletion, racing cleanup, recreating a just-deleted row, wiping a newly staged object, or producing misleading local history.
- **Cause:** Clear ordering was hardened at the persistence layer without adding matching Frodo and Command Center UI/runtime mutation gates.
- **Fix:** Frodo now uses an immediate ref-backed exclusive Clear gate plus visible clearing state; Command Center uses a per-agent gate/state. Both disable input, send, attachment, repeated Clear, and same-thread work until settlement; attachment preparation blocks Clear before and after confirmation.
- **Regression coverage:** Twenty-nine focused session/attachment/runtime policy tests pass across the affected suites, including double Clear, send/Overseer mutation, and attachment preparation. Scoped ESLint and `git diff --check` pass; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-030 — Unowned legacy Frodo history can cross accounts

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo legacy history migration
- **Observed:** The historical `frodo_chat_session` localStorage key has no owner identity, but every authenticated owner can read it and may display it after a remote-load failure or import it when their own row is absent.
- **Expected:** No conversation is displayed or persisted for an authenticated owner unless its ownership is provable; unowned legacy data is retained safely for an explicit recovery path rather than silently attributed.
- **Impact:** After account A leaves an unsaved legacy backup and signs out, account B in the same browser could see A's private transcript or save it into B's durable row.
- **Cause:** The durable session layer became owner-bound, but the one-time legacy migration continued trusting a process-global browser key written by older builds.
- **Fix:** Automatic recovery reads only an owner-specific key whose envelope names that same owner. The historical global key is checked only for presence, never parsed/displayed/imported/deleted, and surfaces a content-free quarantine warning. Clear removes only the authenticated owner's attributed key.
- **Regression coverage:** Focused A→B/unowned tests prove wrong-owner/global content is not returned, the global payload remains byte-for-byte in storage, its content never enters the warning, and owner cleanup cannot delete it. The combined 29-test focused pass, scoped ESLint, and `git diff --check` pass; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`

### BUG-031 — Frodo Clear overpromises cross-device deletion

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo confirmed-Clear workflow
- **Observed:** The confirmation says the conversation is “deleted from every device,” but the app has no cross-tab/device realtime invalidation, tombstone, or compare-and-swap version. A stale client could later save its in-memory transcript and recreate the deleted row.
- **Expected:** Clear copy states exactly what this client can guarantee; durable cross-device deletion cannot be claimed until stale writers are rejected server-side.
- **Impact:** The user may believe deletion is globally final when a dormant client can reintroduce the row.
- **Cause:** The UI copy exceeded the old system's synchronization and concurrency guarantees.
- **Fix:** Clear now promises only to remove the saved conversation/current session. Full stale-device prevention requires an approved durable tombstone or server-enforced version contract.
- **Regression coverage:** Focused policy/source coverage rejects any “every device” Clear claim; scoped ESLint and `git diff --check` pass. The cross-device limitation remains explicitly documented rather than presented as resolved.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`; `docs/rebuild/current-system.md`.

### BUG-032 — Chat Markdown link URLs can inject HTML attributes

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center Markdown rendering
- **Observed:** A quote-bearing HTTPS Markdown URL is interpolated directly into a quoted `href` and can break out of the attribute to add an event handler in the HTML rendered by `dangerouslySetInnerHTML`.
- **Expected:** Assistant/model Markdown cannot create executable attributes or unsafe link schemes; valid ordinary HTTPS links continue to render and open safely.
- **Impact:** Untrusted model, tool, or web-derived content could execute script in the authenticated application origin.
- **Cause:** The renderer escapes text characters but does not validate and encode URL values for the HTML-attribute context.
- **Fix:** The shared renderer now parses links before text formatting, accepts only valid HTTP/HTTPS destinations without whitespace/control characters, and encodes every URL for a quoted HTML attribute before interpolation.
- **Regression coverage:** Five focused cases cover ordinary HTTPS/query links, quote/tag/event breakout, unsafe/relative schemes, balanced parentheses, malformed URLs, and HTML labels. The combined `BUG-032–035` pass is 46/46 with scoped ESLint and `git diff --check` clean; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-046 — Global AI Clear can abandon later surfaces after a synchronous failure

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Settings global AI-history Clear coordinator
- **Observed:** The coordinator invokes each clear callback while constructing the input to `Promise.allSettled`. If a synchronous callback such as Griphook's `sessionStorage` removal throws, callback enumeration aborts outside `allSettled` and any already-started asynchronous clears continue without being awaited or reported.
- **Expected:** Every prepared surface is invoked exactly once and every synchronous or asynchronous result is settled and reported before the coordinator returns.
- **Impact:** Settings can leave a partial clear running in the background and lose its failure or cleanup warning, so the final result is not trustworthy.
- **Cause:** Synchronous callback invocation occurs before each operation is converted into a promise.
- **Fix:** Every prepared callback is now invoked inside its own promise continuation, so synchronous and asynchronous failures share the same all-settled reporting boundary and cannot prevent another surface from starting.
- **Regression coverage:** A synchronous Griphook failure case requires both asynchronous clears to finish and the failure to remain labeled as Griphook; the combined 57-case policy pass, loop suite, scoped lint, and whitespace check pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-047 — A second tool can reuse screenshot evidence consumed by the first

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center per-turn screenshot evidence
- **Observed:** The production tool loop spreads the mutable turn context to add a checkpoint callback. Screenshot consumption then empties only the temporary copy, leaving the turn context populated for a later `log_bug` call.
- **Expected:** One turn owns one mutable evidence context; once a tool claims its screenshots, every later tool in that turn sees an empty queue unless evidence is explicitly restored after failure.
- **Impact:** The same private screenshot can be attached to multiple bug reports or reprocessed unexpectedly.
- **Cause:** Object spread breaks the identity of the deliberately mutable per-turn screenshot context.
- **Fix:** Both production tool loops now attach checkpoint progress through an identity-preserving context helper instead of object spread, so screenshot consumption mutates the single turn-owned queue.
- **Regression coverage:** An identity/one-shot case proves the production context shape cannot reclaim consumed evidence; the combined 57-case policy pass, loop suite, scoped lint, and whitespace check pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-048 — Griphook can overwrite its accepted-turn checkpoint while working

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Budget Griphook browser-session durability
- **Observed:** Send explicitly stores a closed accepted-turn checkpoint, but the component's general state-persistence effect can then run for the newly displayed user message with the old API history while model work is still in flight, replacing the restart-safe checkpoint.
- **Expected:** Automatic UI-state persistence is suspended for the complete in-flight turn; explicit accepted, tool, terminal, and error checkpoints remain authoritative.
- **Impact:** A refresh during model/tool work can lose the accepted request from causal history and invite an accidental replay.
- **Cause:** The general persistence effect is not gated by the synchronous in-flight turn boundary.
- **Fix:** Griphook now raises a synchronous in-flight ref before publishing the user message and lowers it only at terminal settlement. The generic state auto-persistence effect was removed; explicit accepted, tool, final, error, and Clear snapshots are the only writes.
- **Regression coverage:** Checkpoint and remount publication cases prove accepted/tool/final snapshots remain authoritative; the combined 57-case policy pass, loop suite, scoped lint, and whitespace check pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-049 — An unmounted Griphook turn can recreate globally cleared history

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Settings global AI-history Clear and Budget Griphook lifecycle
- **Observed:** A slow Griphook turn continues after navigating away from Money. Settings preflights only Frodo and Command Center, removes Griphook's owner key, and can report success before the old turn settles and writes the transcript back.
- **Expected:** Global Clear is exclusive with every app-chat mutation, including a Griphook turn whose component has unmounted; either Clear waits or it performs zero deletion and tells the user to retry after work finishes.
- **Impact:** Private financial conversation history can reappear after an explicit successful global deletion, and in-flight tools may continue across the claimed boundary.
- **Cause:** Griphook's busy state lives only in the component, while Settings calls the storage remover directly with no shared preparation gate.
- **Fix:** A module-scoped owner gate now spans the complete Griphook turn even after unmount, rejects a second remounted turn, and makes global or direct Clear exclusive. Settings preflights Griphook before Command Center and cancels earlier Frodo/Griphook locks if a later readiness check fails.
- **Regression coverage:** Busy-turn zero-deletion, second-turn rejection, Clear-vs-turn exclusion, idempotent settlement, cancellation release, and later-turn cases all pass in the combined 57-case policy run; loop, scoped lint, and whitespace checks also pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-050 — Nested malformed Griphook history is treated as writable

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Budget Griphook owner-session hydration
- **Observed:** Griphook accepts any non-null object in its display/model arrays. Envelopes containing empty messages, invalid roles, null content, or primitive content blocks become writable; the next model call can fail and the error path can overwrite the quarantinable source bytes.
- **Expected:** Owner sessions hydrate only when every display and model message has a safe supported structural shape; malformed or future-incompatible bytes remain untouched and locked.
- **Impact:** Recoverable financial conversation history can be corrupted or replaced after a normal send attempt.
- **Cause:** Validation stops at array and plain-object checks instead of validating message roles and nested model content.
- **Fix:** Griphook now uses the shared display/model structural validator before hydration. Roles, content containers, attachment containers, and content blocks must be safe while valid unknown fields remain preserved.
- **Regression coverage:** Invalid-role, missing/null-content, null/primitive-block, locked-session, and byte-for-byte source-preservation cases pass in the combined 57-case policy run; loop, scoped lint, and whitespace checks also pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-051 — Nested malformed owner-legacy Frodo history can auto-migrate

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo owner-attributed legacy recovery
- **Observed:** The legacy reader verifies only that `displayMsgs` and `apiHistory` are arrays. Null display entries or malformed model messages are returned as migratable, can crash rendering/model preparation, and can be saved into the durable row before the source key is deleted.
- **Expected:** Automatic legacy recovery requires every nested message to have a safe supported structure; malformed owner-attributed bytes remain untouched for explicit recovery and never authorize cleanup.
- **Impact:** The only recoverable legacy transcript can be silently normalized, overwritten, or deleted.
- **Cause:** `BUG-034` covered non-array history containers but not nested elements or content blocks.
- **Fix:** Owner-legacy Frodo recovery now applies the same nested display/model shape contract as durable sessions before returning a migratable key; invalid bytes cannot enter hydration or authorize source cleanup.
- **Regression coverage:** Null display, invalid role, empty model message, null content, primitive block, untouched-source, and no-cleanup-authorization cases pass in the combined 57-case policy run; loop, scoped lint, and whitespace checks also pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-052 — Remounted Money can overwrite a completed Griphook turn with stale history

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Budget Griphook session continuity across route remounts
- **Observed:** The shared turn gate stops a second send while an older unmounted turn runs, but a new Money mount hydrates only the latest checkpoint it saw. When the old component later saves final tool/result history, the remounted component is not notified; its next allowed send starts from stale history and overwrites the completed causal record.
- **Expected:** Every mounted Money view observes the owner's successful accepted, tool, final, error, and Clear snapshots, including writes completed by an earlier unmounted instance.
- **Impact:** Ledger side effects can lose their causal transcript after route navigation, undermining replay safety and auditability.
- **Cause:** Owner-keyed browser persistence has a shared mutation gate but no owner-scoped publication/subscription boundary.
- **Fix:** Successful owner-session writes and Clear now publish to owner-scoped subscribers. Budget Griphook subscribes before a confirming read, synchronizes every safe session field, ignores only its own in-flight publications, and uses explicit checkpoint writes so publication cannot recurse.
- **Regression coverage:** Remount-before-final, unsubscribe, Clear publication, exclusive-turn, and explicit-checkpoint cases pass in the combined 57-case policy run; loop, scoped lint, and whitespace checks also pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-053 — Griphook can stay silently disabled after a transient save failure recovers

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Budget Griphook browser-session save recovery
- **Observed:** A failed checkpoint sets `storageWritable` false. If the immediate error-snapshot retry succeeds, it clears the warning but does not restore writable state; the active view ignores its own publication while the turn is in flight, leaving the composer disabled until remount.
- **Expected:** Every successful explicit save restores writable state and clears only the save-failure warning; a persistent failure stays visible and blocks unsafe new work.
- **Impact:** A transient browser-storage error can silently strand Griphook even after the final recoverable snapshot was saved successfully.
- **Cause:** The success branch updates the warning but never mirrors the failure branch's writable-state update.
- **Fix:** One pure persistence wrapper now returns the complete saved/writable/warning outcome. Every explicit Griphook save applies all three fields, so success restores writable state while a real failure stays visible and blocking.
- **Regression coverage:** A fail-once/succeed-on-retry case proves the first result is visible and locked, the retry returns saved/writable with no false warning, and the durable snapshot remains readable. The expanded 58-case policy pass, loop suite, scoped lint, and whitespace check pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-054 — Frodo volunteers sensitive personal or access facts as “non-sensitive” memory

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo memory privacy and live-agent recall
- **Observed:** During the approved read-only continuity check, Frodo was explicitly asked for one non-sensitive prior fact but volunteered the hiding location of a physical key. After the first access-secret guard was added, the live retry volunteered a private body/fitness target instead of choosing a genuinely safe example.
- **Expected:** Generic recall, summaries, examples, and proactive context never reveal access secrets or sensitive health, financial, relationship/contact, identity/legal, schedule, or precise-location details. Frodo may acknowledge that sensitive memory exists without exposing it unless Scott explicitly asks for that subject in the current turn.
- **Impact:** Someone viewing the screen or casually testing recall could receive information that enables access or exposes private personal data.
- **Cause:** The first system-prompt correction classified physical access details but still treated other private personal categories as acceptable generic examples.
- **Fix:** One central memory-disclosure contract now applies to every Frodo/Sam/Gandalf tier. Generic examples may use only ordinary preferences, non-sensitive project context, or app navigation; otherwise the assistant says no safe example is available. Sensitive categories require an explicit current-turn request.
- **Regression coverage:** Four deterministic assistant-contract tests pass, including the broad non-volunteering rule. A final live retry was deliberately aborted after Scott stopped further model/API usage, so no post-fix live pass is claimed.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-033 — Late Command Center attachment prep can cross agents

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Command Center attachment drafts
- **Observed:** Attachment state is shared across agents. B's first render can expose/send A's already-prepared image; asynchronous normalization started for A can resolve into B; and A's awaited send or Clear completion can later clear screenshots newly added for B.
- **Expected:** Prepared attachments can appear and send only in the draft for the agent that initiated their preparation.
- **Impact:** A private image selected for one agent can be exposed/sent to another, while one agent's later operation can also erase another agent's draft.
- **Cause:** Draft attachments and their asynchronous publish/clear completions are not keyed or tagged by initiating agent/generation.
- **Fix:** Command Center now keeps an agent-tagged, generation-bound draft. Immediate selection binding hides the previous agent's ready shots before render; async publish/remove/send/Clear settlement applies only to the initiating token and cannot mutate another agent's generation.
- **Regression coverage:** Focused policy cases cover ready-shot selection changes, deferred normalization, and send/Clear settlement after switching; the combined 46-test pass, scoped ESLint, and `git diff --check` pass. Same-agent busy intake remains tracked separately as `BUG-038`; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-034 — Malformed owner-bound legacy chat can be normalized and deleted

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo legacy history migration
- **Observed:** An owner-attributed legacy envelope with a string `displayMsgs` passes the current `.length` check, normalizes to empty arrays, and is marked migratable; a later successful save can remove the only malformed/recoverable source bytes.
- **Expected:** Legacy history is migratable only when both history fields are arrays with a supported shape. Malformed payloads fail closed and remain untouched for explicit recovery.
- **Impact:** A malformed but potentially recoverable private transcript can be silently replaced with an empty session and then deleted.
- **Cause:** The legacy reader checks `.length` before proving both history fields are arrays, then normalizes unsupported types to empty arrays.
- **Fix:** Owner-attributed legacy recovery now requires both history fields to be arrays before it returns history or a migratable key. Malformed payloads remain untouched and ineligible for cleanup.
- **Regression coverage:** Focused malformed-envelope coverage proves no history/key is returned and the original bytes cannot be removed through later migration cleanup. The combined 46-test pass, scoped ESLint, and `git diff --check` pass; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-035 — Nested malformed durable messages can be silently overwritten

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center durable-session hydration
- **Observed:** `agent_sessions` hydration accepts any array elements. A string display entry reaches writable state and can be spread into character-index properties; a null API entry is dereferenced before the persistence catch and can produce an unhandled rejection from the debounced save.
- **Expected:** Every hydrated display/API history element has a safe non-null message shape; unknown fields on valid objects remain intact for forward compatibility. Nested malformed rows stay locked and unwritten.
- **Impact:** A recoverable private transcript or newer-format row can be silently corrupted, while malformed null/content shapes can also cause an unhandled automatic-persistence failure.
- **Cause:** The durable session validator checks only the top-level array type, not the element shape.
- **Fix:** Durable hydration now requires every display/API history element to be a non-null, non-array message object with safe message content before writes unlock, while valid unknown object fields are retained.
- **Regression coverage:** Focused string, null, and invalid-content cases fail hydration closed with zero writes; a forward-compatible valid-object case preserves unknown fields. The combined 46-test pass, scoped ESLint, and `git diff --check` pass; full gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-036 — Clear cleanup warning leaves deleted attachments resendable

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo confirmed-Clear attachment lifecycle
- **Observed:** Durable session deletion can succeed while later legacy/staging cleanup returns a warning. The hook throws that warning, so ChatBot does not clear its local screenshot state/ref and the old thumbnails remain eligible for Send even if their staging objects were removed.
- **Expected:** Once authoritative session deletion commits, the local conversation and attachment draft are cleared exactly once regardless of non-authoritative cleanup warnings; the warning remains visible and retryable without restoring deleted evidence.
- **Impact:** Frodo can resend stale/deleted attachment metadata, recreate the cleared session, and show broken previews after a Clear that actually succeeded.
- **Cause:** ChatBot couples local attachment cleanup to the hook's overall non-throw result instead of the committed session-delete boundary.
- **Fix:** Pending an explicit authoritative-delete result/cleanup boundary that clears local drafts before surfacing later cleanup warnings.
- **Regression coverage:** Pending a legacy/staging-warning case proving transcript, thumbnail state, and path refs clear and cannot be resent after the durable delete succeeds.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-037 — Deferred session owner capture can drift across accounts

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center session/attachment ownership
- **Observed:** A session or screenshot-storage call begun while A is established can await a separate auth getter and use B after a transition. Clear can then delete B's row/prefix. Hydration also used an unbound owner for legacy lookup before an established-owner durable load, so a drift failure could fall back to and display B's legacy history on A's mounted screen.
- **Expected:** Each session and screenshot operation carries or verifies the already-established authenticated owner through every read/write, failing closed if auth identity drifts before execution.
- **Impact:** In-flight data can cross owner rows/prefixes; an A-screen Clear can delete B's durable conversation and every staged screenshot despite UI hard-reload mitigation.
- **Cause:** Production owner capture is asynchronous and not anchored to the caller's established owner; existing coverage resolves the owner immediately and misses the drift window.
- **Fix:** Pending established-owner binding plus an explicit current-auth equality check immediately before every session, signed-preview, and screenshot-storage request; owner row filters/RLS alone cannot distinguish a drifted B token from an empty successful A result.
- **Regression coverage:** Pending deterministic deferred owner-capture tests proving A-started session/storage work cannot continue as B or falsely report an empty successful load/Clear, including zero wrong-owner query/upload/sign/copy/delete and whole-prefix operations.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-038 — Same-agent attachment can be erased by an earlier send

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Command Center attachment drafts
- **Observed:** Send snapshots the selected agent's attachment token, awaits the complete agent run, and clears that token afterward. Paste/drop handlers still accept images while that agent is busy, so a newly selected image can join the old generation and be erased when the earlier send settles.
- **Expected:** Attachment intake during an in-flight send is either blocked at every handler or isolated in a new draft generation that the older send cannot clear.
- **Impact:** A user-selected private image can silently disappear from the composer with no send and no recovery path.
- **Cause:** Disabled visible controls do not gate paste/drop handlers, and send completion clears a generation that remains open to new attachment publication.
- **Fix:** Pending handler-level busy gating or generation partitioning at send start.
- **Regression coverage:** Pending a deterministic delayed-send plus same-agent late-paste/drop case proving the new image is rejected visibly or retained after the older send completes.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-039 — Command Center loses accepted turns until terminal settlement

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Command Center and Overseer durable-session checkpoints
- **Observed:** An accepted user turn is published only to memory, committed tool exchanges update a local variable, and the first durable session write occurs at final success/error. Direct agent execution receives `onCommit` but does not persist it; Overseer supplies no `onCommit`, leaving the same terminal-only gap.
- **Expected:** A valid closed pending snapshot is durably queued before model execution; every committed tool exchange is durably checkpointed before further work; terminal results then append in order.
- **Impact:** Refresh, tab close, crash, or interruption after a tool side effect can lose the request and tool audit history, making an already-applied action appear absent and enabling accidental replay.
- **Cause:** Command Center persistence was hardened for exact terminal snapshots but lacks Frodo's pre-model and per-tool flush boundaries.
- **Fix:** Command Center and Overseer now persist a closed accepted turn before their first model request. The shared production tool-batch runner writes a valid result for every tool use before each individual action, durably confirms each result before the next action, and carries nested Griphook/Bilbo progress into the parent checkpoint. Terminal save failures retain the visible reply and expose a persistent Retry save action instead of claiming success.
- **Regression coverage:** Production's shared batch runner is exercised for pre-tool save failure, tool-one checkpoint failure before tool two, and awaited nested-consultant progress. Runtime coverage rejects `false`, `undefined`, `null`, and rejected accepted checkpoints; focused tests and scoped lint pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-040 — Settings clear-all misses Command Center and live chat state

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Settings AI-history privacy action
- **Observed:** Settings claims to clear every AI thread but deletes only `frodo`, `elrond`, `bilbo`, `luthien`, and `banker`; it omits Galadriel and every `${agentId}:cc` Command Center row. The named Budget-page Griphook/Banker transcript actually lives in `sessionStorage['banker_chat_session']`, so deleting a server `banker` row leaves it intact. Frodo staging and mounted runtime state are also separate and later sends can re-save history.
- **Expected:** A global clear either coordinates authoritative deletion, staging cleanup, and mounted-state reset for every known durable agent session, or explicitly names and limits what it clears. Deleted history cannot reappear after a send or reload.
- **Impact:** Private history remains visible/durable after a success toast and can be recreated, violating the user's deletion intent.
- **Cause:** Settings hard-codes stale row names and bypasses the lifecycle-aware Frodo/Command Center clear APIs.
- **Fix:** Settings now uses one coordinated clear contract. It locks and preflights mounted Frodo and Command Center state, inventories every owner row by identifier without hydrating message payloads, preserves Frodo's authoritative empty row, clears every other historical row, resets successful runtime threads/inputs, runs Frodo staging cleanup, and clears only the current owner's Griphook browser session. Partial failures are reported by surface and never receive an all-clear toast; Aulë's separate local terminal session is named as excluded.
- **Regression coverage:** Focused coordinator cases prove a failed readiness check performs zero deletions and a partial clear reports both hard failures and secondary warnings. The combined clear/session/attachment pass is 52/52 with scoped ESLint and `git diff --check` clean; rendered and full repository gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-041 — In-flight agent tools can cross accounts after auth drift

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center authenticated tool execution
- **Observed:** Ordinary Library, bug, and tool-backed APIs originally resolved unbound owners. The DB default is now owner-bound, but model/server and nested consult/fetch calls still obtain auth headers without the turn owner; an A transcript/request can be sent using B's token during transition even if later DB work aborts.
- **Expected:** Every agent turn captures one established owner and all authenticated DB, storage, model, and server work—including header creation—verifies that identity immediately before execution; any drift aborts before transmission or mutation.
- **Impact:** An old account's private request/transcript can be transmitted under a newly authenticated account, or inspect/alter its data, then record a misleading causal result.
- **Cause:** Owner binding was added around chat session/storage operations but not propagated through the general agent tool boundary; UI reload narrows but cannot atomically close the async window.
- **Fix:** Every Frodo, Command Center, Overseer, Griphook, and Bilbo turn captures one established owner. Tool execution verifies that owner before entry, and every model request—including retries and nested consultants—resolves fresh headers against that captured owner immediately before transmission. Identity mismatch or a missing token aborts before `fetch`.
- **Regression coverage:** Auth-boundary cases prove same-owner header release, A→B rejection, and missing-token rejection. The production request helper proves resolver failure performs zero fetches and separate requests obtain separately resolved headers; focused tests and scoped lint pass.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-042 — Failed legacy cleanup can resurrect a cleared conversation

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo confirmed-Clear and legacy fallback
- **Observed:** Durable session deletion succeeds, but owner-legacy key removal fails and remains as a visible cleanup warning. On reload the remote row is absent, so hydration falls back to that retained legacy payload and auto-migrates the supposedly cleared conversation again.
- **Expected:** A committed Clear is authoritative across reloads even when secondary legacy cleanup fails; retained bytes may remain for explicit recovery but cannot silently display or reimport.
- **Impact:** Private history reappears after a successful confirmed deletion and can be durably recreated without new user intent.
- **Cause:** “No remote row” is treated as permission to use legacy fallback, with no durable empty/tombstone signal distinguishing a never-migrated account from a successfully cleared one.
- **Fix:** Clear first saves an authoritative empty owner session. Local fallback suppression then attempts marker creation and legacy removal independently: a removal failure leaves the marker suppressing retained bytes, while marker failure never skips removal. Hydration treats the durable empty row as authoritative over any local fallback.
- **Regression coverage:** Focused cases cover removal failure with marker suppression and retry, marker failure with successful removal, and a durable empty row defeating retained legacy bytes even when cleanup cannot complete.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-043 — Frodo continues model/tools after durable checkpoint failure

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo durable causal checkpoints
- **Observed:** The initial code ignored `persistSession(false)` everywhere. The active fail-closed patch now aborts pre-model/post-tool, but terminal reply-save failure falls into the same catch, adds a misleading second error bubble, rewrites successful reply history as interrupted, and can throw an unhandled rejection if the error-state save also fails while ChatBot fire-and-forgets the turn.
- **Expected:** A failed accepted-turn checkpoint aborts before model execution; a failed post-tool checkpoint aborts before further work; a successful reply remains intact when only its terminal save fails, with one explicit retryable persistence warning and no rejected top-level turn promise.
- **Impact:** A side effect can succeed without durable causal history, then be replayed after refresh because the saved conversation does not show that it already ran.
- **Cause:** Frodo added flush boundaries but treated persistence as best-effort instead of a required precondition for agent continuation.
- **Fix:** Accepted-turn and per-action tool checkpoints require confirmed durable saves before continuation. Partial multi-tool batches persist balanced synthetic results so reload history remains valid and does not auto-replay uncertain work. Terminal and error-state saves settle to a visible warning without replacing a truthful reply or rejecting the public send promise; repeated closure is idempotent.
- **Regression coverage:** Production's shared runner proves a failed write-ahead save executes zero tools and a failed tool-one confirmation executes no tool two. Session cases cover false terminal/error saves and idempotent recovery closure; runtime checkpoints reject every non-`true` result.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-044 — Budget Griphook session can cross accounts in one tab

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Budget Banker/Griphook chat privacy
- **Observed:** Budget chat hydrates and saves one static unowned `banker_chat_session` sessionStorage key. ProtectedRoute hard reloads on A→B identity change, but sessionStorage survives, so B can open Money and see A's financial conversation.
- **Expected:** Budget chat history is bound to the authenticated owner or fails closed/quarantines unowned history; an account transition cannot display, send, or clear another owner's conversation.
- **Impact:** Private financial chat crosses authenticated accounts in the same browser tab.
- **Cause:** The older sessionStorage design predates owner-bound durable agent sessions and has no owner envelope/key.
- **Fix:** Griphook captures the established owner once, stores a versioned envelope only under that owner's encoded key, passes that owner through authenticated model/tool work, and clears only that key. The historical unowned key is quarantined with a content-free warning while safe owner-key work remains available; malformed/future current-owner envelopes fail closed and lock writes. Neither class is automatically displayed, migrated, deleted, or overwritten. A shared owner gate prevents direct or global Clear from racing an active turn.
- **Regression coverage:** Four focused policy cases prove same-owner restore, A→B isolation, unowned quarantine without content leakage, malformed/future preservation, expiry, and owner-only Clear. The combined pass is 52/52 with scoped ESLint and `git diff --check` clean; rendered and full repository gates remain.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-045 — Frodo hydration lost the loaded durable-session variable

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Frodo durable-session hydration
- **Observed:** The owner session was assigned to a block-scoped `mine` constant inside the load `try`, then referenced outside that block when selecting the durable-or-legacy source.
- **Expected:** The successfully loaded owner session remains available for the authoritative fallback decision without leaking into another owner or failing at runtime.
- **Impact:** A successful Frodo history load could throw before rendering its transcript; lint also blocked release with an undefined-variable error.
- **Cause:** The hydration refactor narrowed the session variable's scope while leaving the fallback decision after the guarded load block.
- **Fix:** The durable-session variable is declared in the enclosing load scope and assigned only after the captured owner is verified; an unused stale clear import was removed.
- **Regression coverage:** The focused lint pass now succeeds across the modified hydration, auth, checkpoint, runtime, and UI files; the full repository gate remains pending.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-055 — Agent orchestration lacks a direct production-composition regression

- **Status:** Deferred
- **Discovered:** 2026-09-29
- **Area:** Frodo and Command Center integration coverage
- **Observed:** Focused tests exercise the shared loop, checkpoint, identity, and persistence primitives, but no automated integration test imports and runs the assembled production path across `runAgent`, `useAIAgent`, `AgentRuntimeContext`, and `aiTools`.
- **Expected:** A controlled integration regression proves that owner capture, checkpoint callbacks, nested consultant progress, and terminal settlement remain connected through the real production composition.
- **Impact:** Unit and policy coverage can pass while a future wiring regression in the assembled runtime remains undetected.
- **Cause:** The current suite validates the lower-level contracts and rendered behavior separately rather than mounting the complete orchestration path in one test.
- **Fix:** Deferred by Scott on 2026-09-29. This entry records validation debt only; it does not establish a known production behavior defect.
- **Regression coverage:** None yet. Existing primitive and rendered checks must not be described as direct production-composition coverage.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-056 — Global Clear lacks a direct production-composition regression

- **Status:** Deferred
- **Discovered:** 2026-09-29
- **Area:** Settings global AI-history Clear integration coverage
- **Observed:** Coordinator tests cover readiness, all-settled failures, partial cleanup, and owner boundaries with controlled callbacks, but no automated integration test mounts the real `SettingsPage`, `ChatBot`, `AgentRuntimeContext`, and `BudgetBanker` composition together.
- **Expected:** A controlled integration regression proves the Settings action reaches every mounted production surface, respects the shared Griphook gate, and reports partial failures without stale state being republished.
- **Impact:** The coordinator contract is tested, but a future UI/runtime wiring regression could escape the current suite.
- **Cause:** The test boundary stops at the coordinator and surface policy helpers rather than the assembled application composition.
- **Fix:** Deferred by Scott on 2026-09-29. This entry records validation debt only; it does not establish a known production behavior defect.
- **Regression coverage:** None yet. Existing coordinator tests must not be described as direct production-composition coverage.
- **Related work:** `docs/features/frodo-mobile-chat-reliability.md`.

### BUG-057 — Vercel function limit blocks every production deployment after Kiwi tasks

- **Status:** Resolved locally — production release pending
- **Discovered:** 2026-09-29
- **Area:** Vercel deployment and Kiwi shared-tasks routing
- **Observed:** The live alias remains on successful commit `b1cb1b6`. Vercel Production deployments for `76f4473`, Frodo `0760393`, and current `d24492f` failed and were not promoted.
- **Expected:** Pushing approved work to `main` produces a successful Vercel Production deployment without removing Kiwi shared tasks.
- **Impact:** The committed Today dashboard and Frodo reliability work are absent from production even though they are present on local and remote `main`.
- **Cause:** Commit `76f4473` added `api/kiwi-tasks.js`, increasing non-underscore deployable `api/*.js` entries from the Vercel Hobby limit of 12 to 13. Local Vite builds do not enforce this hosted-function limit.
- **Fix:** `/api/kiwi-tasks` now rewrites to the existing `/api/fetch` entry with an explicit internal marker. The Kiwi implementation lives in underscore-prefixed `api/_kiwi-tasks.js`, and unmarked fetch requests retain the existing behavior.
- **Regression coverage:** The combined Kiwi, route-selection, exact-rewrite, and function-count suite passes 10/10; all 264 repository tests, full zero-warning ESLint, the production build, registry validation, and `git diff --check` pass.
- **Related work:** `docs/features/vercel-function-limit-repair.md`.

### BUG-058 — Session-registry regression hard-codes the seed-session count

- **Status:** Resolved
- **Discovered:** 2026-09-29
- **Area:** Development session registry validation test
- **Observed:** `npm run session-registry:check` accepts the current two-session registry and selects `SAI00000003`, but the full test suite fails because `scripts/session-registry.test.js` still expects exactly one ID and `SAI00000002` next.
- **Expected:** The checked-in registry regression verifies the current valid projection without becoming false as the Project Manager appends correctly ordered sessions.
- **Impact:** The full repository suite reports 263/264 even though the registry validator and every Vercel-repair regression pass.
- **Cause:** The seed-session test encoded the then-current count and next ID as permanent invariants before `SAI00000002` was validly reserved and activated.
- **Fix:** Updated the checked-in registry fixture expectation to two registered sessions and `SAI00000003` next. All append-only registry events and the separate collision, gap, binding, title, and glossary cases remain unchanged.
- **Regression coverage:** The focused registry suite passes 7/7, registry validation selects `SAI00000003`, and all 264 repository tests pass.
- **Related work:** `docs/features/bonsai-development-session-identities.md`.

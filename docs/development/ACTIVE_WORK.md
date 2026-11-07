# Active work

## Log in Orbit opens on the prompt, not the manual form (BUG-084)

- **Feature document:** `docs/features/orbit-event-log-prompt-first.md`
- **Approval:** Scott's follow-up on 2026-11-07 ("dude it still goes to manual log wtf is wrong with you I thought we had this fixed?", with a screenshot of the manual form for the Nov 4 NLHS Innovation Summit event, nobody picked) authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-07. Diagnosis: BUG-081 shipped only the people prefill; the interview that was supposed to ask "what happened" needs a live AI backend (`ai.available` requires an `ANTHROPIC_API_KEY` in the hosted server plus the connector on), which the live app does not have, so every live log fell through to the manual form; and the NLHS event has no attendees attached, so its form opened with an empty picker. The fix adds a prompt-first entry mode to `LogModal` for Planner event handoffs that needs no AI: it names the event and its people, asks "What happened at the event?", files the one answer as Notes through the existing save path, shows the picker inside the prompt when nobody is attached, and keeps the full form one tap away. Four new source tests; lint clean, full suite green (exit 0), build pass; rendered harness at 390px proved both the with-people save and the no-people flow (including the empty-save refusal). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, the signed-in check: tap Log in Orbit on a past event and confirm the prompt opens, names the event's people, and saves from the one answer. Note BUG-082 (below) is also committed locally and unpushed, so one push ships both.

## URLs in task Notes are clickable (BUG-082)

- **Feature document:** `docs/features/task-notes-clickable-links.md`
- **Approval:** Scott's direct order on 2026-11-06 ("when I go into topic 11 i can't click the fucking document link") authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-06. Live investigation first proved the Concept 11 task has no linked document and its Notes' ChatGPT bundle URL rendered as dead plain text (same across the concept tasks). The fix linkifies URLs in task Notes (`linkifySegments` + `LinkifiedText`, accent-underlined via plan.css). Seven tests added; lint clean, full suite green (exit 0), build pass; rendered harness passed with the exact Concept 11 note at desktop and 390px. Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, the signed-in check: open the live Concept 11 task and tap the bundle link in Notes. Separate follow-up, not part of this fix: attach the 111 lesson PDFs to their tasks (Mac zip when the Mac is back online, or the ChatGPT pull with Scott present) and remove the ChatGPT references from Notes.

## Log in Orbit starts from the event's people (BUG-081)

- **Feature document:** `docs/features/orbit-log-prefills-event-people.md`
- **Approval:** Scott's direct order on 2026-11-06 ("it should grab the person who is involved from the event and ask me 'what happened at the event'... fix this now", with a screenshot of the manual people picker) authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** LIVE 2026-11-06. Scott approved the push; merged with origin/main (a918bdb) and pushed as d7b568d; the build check fired and the served bundles carry the change (marker-verified in both chunks). Signed-in check proved the prefill end to end on "Drinks with Lizwe" (Nov 5): the link carried Lizwe's id and the form opened with her selected and her update field present. Recorded limits: the prompt lists only events whose end has passed, and the live log opens the manual form because the Orbit assistant is not available on the live app.
- **Next gate:** None. The DocLinks viewer modal shipped in the same push, and its signed-in click-through was exercised later on 2026-11-06 on a real attachment (the Lizwe gym-plan screenshot on the Nov 11 planner event): the document opened in the viewer on the live site. See the WORKLOG follow-up note. The recorded manual-form limit is addressed locally by BUG-084 (see the top section); it reaches live only with that push.


## Linked documents open in the in-app viewer modal

- **Feature document:** `docs/features/doclinks-viewer-modal.md`
- **Approval:** Scott's direct order on 2026-11-05 ("can you link the documents so clicking on them brings up a modal with them with an x once youre done") authorises the change and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-05. `DocLinks` file rows open the existing `DocumentViewer`/`PdfViewer` modal in-app (no more new tab), file links mark read on open, note links still open in the reader. Four source tests added; lint clean, full suite green (exit 0), build pass; rendered harness of the real `PdfViewer` passed (sample PDF paged, X closed it, no phone overflow). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, the signed-in check: open an event, expand Documents, click a PDF, confirm the modal opens and the X closes it.


## Schedule events open on click, compact event rows (BUG-080)

- **Feature document:** `docs/features/schedule-event-open-and-compact-rows.md`
- **Approval:** Scott's direct order on 2026-11-05 ("clicking an event doesnt go into it... theylre too long with the document shit showing... can you change this please") authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-05. Compact clickable event rows with an in-place detail region (documents, description, Orbit prompt, Edit/Delete inside), Upcoming rows open the day with the event expanded, and the Schedule timeline opens events and tasks through a new optional `DayTimeline` `onBlockClick` prop (no-handler rendering unchanged, so Today is untouched). Five source tests added; lint clean, full suite green (exit 0), build pass; rendered harness passed click and geometry checks at desktop and 390px (collapsed row 55px vs the old 178px desktop / 368px phone), screenshots read (see the feature document's validation record). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, signed-in verification: tap an event in the live day view and a block on the live Schedule timeline.


## Money Overview consistency (BUG-079)

- **Feature document:** `docs/features/money-overview-consistency.md`
- **Approval:** Scott's direct order on 2026-11-04 ("do you see the inconsistincenies... make it way better now", with a screenshot of the live Money Overview) authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-04. The Bills card renders fixed bills only (variable bills remain managed in Bills & Income; the unused variable drill helper was removed); a week that has not started shows its planned base with a rollover note (the allowance calculation is unchanged); the budget modal field reads "Amount per pay period". Three regression source tests added; lint clean, full suite green (final group 343), build pass; rendered harness with Scott's exact live figures passed every check at desktop and 390px (see the feature document's validation record). The live data half is already done and verified through the UI: the Nov 4 Orangestore $20.00 entry moved from Transport to Gas, so the live Gas ring reads $20.00 of $70.00 and the rings sum ties to Week 1 spent ($128.49). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, signed-in verification of the Bills card and Week 2. The stale Google One $35 bill (verified Oct 22, 2026: subscription expired, charge should not occur) is flagged for Scott's decision, not deleted.

## Money rings: Groceries, Fun/Entertainment, Gas, and Bills buckets

- **Feature document:** `docs/features/money-rings.md`
- **Approval:** Scott's direct order on 2026-11-04 ("make a groceries, I should have 3 rings in heyscottybro... groceries, fun/entertainment and gas, bills are another bucket but that's already logged, these buckets must be added") authorises the feature and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-04. Pure ring builder in `src/lib/budgetRings.js` (6 unit tests, in the test chain); the Overview's Category budgets card is now a Rings card, first in the money grid, with SVG rings for Groceries, Fun / Entertainment, Gas, plus a display-only Bills ring from billsPaid/billsObligation, reusing the existing budget modals and transaction drill-down; plannerApi fallback categories gained Groceries and Gas. Lint clean, full test suite green, build pass; rendered harness passed all checks at desktop and 390px with screenshots read (see the feature document's validation record). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, the live setup runs through the UI: add Groceries and Gas categories, set budgets (Groceries $150, Entertainment $100, Gas $70, Scott's couples-budget ring amounts), move the four Nov 4, 2026 purchases logged as Other (Walmart $26.78, Dollarama $10.64, Tahitian vanilla $8.99, Sobeys $11.49) to Groceries, then signed-in verification.

## Money Overview Add purchase (BUG-078)

- **Feature document:** `docs/features/money-overview-add-purchase.md`
- **Approval:** Scott's direct order on 2026-11-04 ("there's poor ui because I can't input a purchase put a button near the top of the screen so it's easy or even on the same row as the two arrows on the other side", with a screenshot of the live Money Overview) authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-04. The Money Overview's period arrows now sit in a bar row under the period title with an "Add purchase" button on the right (standard pill, 44px minimum height). `BudgetPage` owns a one-shot nonce: the button bumps it and switches to the Transactions tab, where `BudgetTransactions` opens its existing, untouched "Log transaction" form once and clears the nonce, so a later manual visit does not reopen it. Lint clean, full test suite green (final group 340, including 3 new wiring tests), build pass; a rendered Playwright harness around the real dashboard and transactions components confirmed the row layout at desktop and 390px, the click-through to the open form, and the no-reopen behaviour (see the feature document's validation record). Committed locally; not pushed. This stacks on the same unpushed main as the Orbit pictures, Ad Formats, and Client Finder commits, so one push ships all four.
- **Next gate:** Scott approves the push/deploy; after deployment, run the signed-in check: open Money, confirm the Add purchase button on the arrows row, tap it, and confirm the Log transaction form opens on the Transactions tab.

## Client Finder (Harvey playbook)

- **Feature document:** `docs/features/client-finder-harvey.md`
- **Approval:** Scott's direct order on 2026-11-04 ("get this in heyscottybro", about the Nick Saraev reel presenting Harvey, the open-source AI sales agent) authorises the feature and a local commit, per source-of-truth rule 1 and the Ad Formats precedent. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-11-04. A static `/admin/client-finder` page renders the playbook from `src/lib/clientFinder.js`: the Harvey header with the repo link and verified stats (MIT, Python, 4,361 stars, 912 forks, last push Nov 2, 2026, verified Nov 4, 2026), a verdict card (real tool, demo-only proof, no keyword engagement), the 9 workflow steps as numbered cards, Scott's ICP card on his approved websites terms (free build upfront, $300 if they love it, $50 per month care) with fit signals, the 9-field per-prospect checklist, one original draft example email for a fictional roofing company, and a guardrails card (automatic sending and replies OFF, Scott approves the kit and every batch, CASL, club outreach is a separate lane). Every list section shows its count from the data. Reachable from the More list, the phone sheet, the Settings hide list, and ⌘K. Lint clean, full test suite green (10 new data tests in the chain), build pass; a rendered Playwright run of the real page confirmed every section and the phone layout (see the feature document's validation section). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, run the signed-in checks: open Client Finder from More and from ⌘K, and hide the page in Settings to confirm it disappears from nav and palette. Running Harvey itself is separate, unapproved work.

## Ad Formats library

- **Feature document:** `docs/features/ad-formats-library.md`
- **Approval:** Scott's direct order on 2026-10-29 ("steal these and put them in heyscottybro", about the @byjoeym reel "35 S-Tier Ad Formats to Steal") authorises the feature and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-10-29. A static `/admin/ads` page renders 32 format cards from `src/lib/adFormats.js` (reel numbers 1–31 and 34; 32, 33, and 35 were illegible in the reel and are omitted, not invented; all descriptions and examples are original, rotating across the Lift Club, myBackyard, BONSAI, and Websites at eight each), with a local text filter and the header count reading `N of 32` while filtering. Reachable from the More list, the phone sheet, the Settings hide list, and ⌘K. Lint clean, full test suite green (9 new data tests in the chain), build pass; a rendered Playwright run of the real page confirmed the 32-card grid, the filter narrowing/empty/restore behaviour, and the phone layout (see the feature document's validation section). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, run the signed-in checks: open Ad Formats from More and from ⌘K, filter the grid, and hide the page in Settings to confirm it disappears from nav and palette.

## Person pictures in Orbit

- **Feature document:** `docs/features/person-pictures-in-orbit.md`
- **Approval:** Scott's direct order on 2026-10-28 ("i'm unable to add a picture to orbit, I wanna be able to send screenshots like I can for frodo") authorises the feature and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-10-28. `photo` storage path on the person doc (JSONB, no migration), bytes in the existing private `bug-screenshots` bucket under `<uid>/people/<personId>/`, a host-supplied `media` capability through `configureOrbit`, Avatar rendering with initials fallback, a Picture field in Edit basics (picker, paste, drop, remove), and a Frodo route that claims a chat-staged screenshot as a person's picture (DR-035). Lint clean, full test suite green (337 in the final group), build pass; the real Orbit server harness passes the photo validation matrix, and a rendered run of the real Orbit app (stub media store) covered add, change, and remove with screenshots, see the feature document's validation section. Committed locally; not pushed. Note: the Orbit-side edits land in the `orbit/` copy because the canonical Orbit repo is not present in this environment; they must be ported before the next sync (see the feature document).
- **Next gate:** Scott approves the push/deploy; after deployment, run the signed-in checks: add a picture to a person in People (real bucket upload and signed-URL display) and have Frodo set a picture from an attached screenshot.

## Search modal scroll reset (BUG-077)

- **Feature document:** `docs/features/search-modal-scroll-reset.md`
- **Approval:** Scott's direct order on 2026-10-28 ("there's a bug that if you move the cursor even just a bit when scrolled down on the search modal, it will jump back up to the top so you can never reach what you wanna reach, heyscottybro fix it") authorises the fix and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-10-28. Root cause: `useHiddenPages()` re-parsed on every render, so the palette's `groups` memo changed identity every render and its cursor-reset effect (plus the scroll-into-view effect) snapped the list to the top on the first mouse move after scrolling. Fix shipped in `src/utils/settings.js`: the parse is memoized on the raw stored string; `CommandPalette.jsx` is untouched. Lint clean, full test suite green (335 in the final group), build pass; rendered check of the real palette confirms the scroll position now holds under the mouse (and that reverting the one change reproduces the jump), see the feature document's validation section. Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, repeat the two-minute scroll-and-hover check in the signed-in palette.

## Frodo–Orbit writes and chat attachment clearing (BUG-075, BUG-076)

- **Feature document:** `docs/features/frodo-orbit-writes-and-chat-attachment-clear.md`
- **Approval:** Scott's direct order on 2026-10-28 ("fix this", on Frodo refusing to add Aaron Burke to Orbit and on the sent image's preview sticking in the composer) authorises the fixes and a local commit. Push/deploy need Scott's separate explicit approval.
- **Current state:** Built and verified locally on 2026-10-28. Frodo's Library `people` collection now creates and updates people through Orbit's own API (`/api/orbit`, the People UI's exact path; DR-034); the composer clears sent attachments at handoff and restores them on a refused send. Lint clean, full test suite green, build pass; Bug 075 verified end to end against the real Orbit server on throwaway data (see the feature document's validation section). Committed locally; not pushed.
- **Next gate:** Scott approves the push/deploy; after deployment, run the signed-in checks: ask Frodo to add a person and see them in People, and send a chat message with an image and watch the composer clear.

## Muse-UI rewrite (heyScottyBro in the Muse app UI)

- **Feature document:** `docs/features/muse-ui-rewrite.md`
- **Approval:** Scott said "approval on both" on 2026-10-21, approving this rewrite's executive plan (with its SPEC-GAP recommendations) and Connected Pages. The approved visual reference is `~/workspace/your_files/heyscottybro-ui-before-after/before-after.html`.
- **Current state:** Phase 0 (DM Sans/DM Mono fonts, shell tokens, DR-032) committed locally as `7954182` and Phase 1 (icon rail shell, More popover/sheet, phone bottom bar, detail-panel host with Status view shell, Settings dialog host, palette restyle) committed locally on 2026-10-21; not pushed. Every existing page keeps its interior, routes, data, and APIs. Lint, full tests (333/333), and build pass at both phase boundaries; a production-preview smoke pass returned HTTP 200 for all 15 main admin routes. Signed-in rendered desktop/phone checks were not run (preview is auth-gated). DR-032 and the WORKLOG entries sit in the working tree alongside the prior session's uncommitted DR-031 records.
- **Next gate:** Scott reviews the result (rendered check), then approves the push/deploy. Phase 2 (Today, Planner, Finance interiors) is a separate per-phase approval. Connected Pages surfaces should be born in the new shell.

## Connected Pages (heyscottybro interconnection)

- **Feature document:** `docs/features/connected-pages.md`
- **Approval:** Scott directed the interconnection on 2026-10-21 and approved the plan the same day ("approval on both", covering this plan and the Muse-UI rewrite). The interactive blueprint at `~/workspace/your_files/connected-pages-blueprint/connected-pages-blueprint.html` was delivered 2026-10-21. On 2026-10-22 Scott said "go on all items", approving the build: Phase 0 (cascade and gap-watcher foundations) and Phase 1 (Finance to Meal Plan, subphases 1A to 1D), using the plan's recommended SPEC-GAP defaults.
- **Current state:** Phase 0 and Phase 1 BUILT and pushed 2026-10-22 (commits `357f95f`, `ce0f019`, `a722a36`; lint clean, full test suite green, build pass). Migrations verified APPLIED on 2026-10-23 (dashboard state check: task priority, Bin, foundations, and Phase 1 tables all present; exercise library and event people applied in the same session). Phase 2 slice 1 shipped 2026-10-23 (see below); the rest of Phase 2 is not part of this approval round.
- **Next gate:** Apply `2026-10-18-task-priority.sql`, then `2026-10-22-connected-pages-foundations.sql` and `2026-10-22-connected-pages-phase1.sql` to project `mogoybejtmkoheqvfvuc`; set the Leo's Restaurant task to high priority; then verify the Meal Plan and Finance flows signed-in on desktop and phone.
- **Phase 2 slice 1 (2026-10-23):** Scott directed on 2026-10-23: "I need calendar to allow for putting people in my orbit as attendees for an event, so a little indicator shows who's at an event", then "put this in to heyscottybro, make the migrations yourself and add anything else that you've noticed is interfering with productivity". Approved scope: `event_people` + EventForm People picker + attendee indicator + `events.location` (record and pseudocode at the end of `docs/features/connected-pages.md`), the BUG-074 sidebar fix (plan presented 2026-10-22), and applying the pending approved migrations above (plus Bin and exercise library) when a dashboard session confirms each is missing. Briefs, birthdays, and the profile read model remain unapproved Phase 2 work. **Status: BUILT and migrations applied 2026-10-23; implementation record at the end of the slice section in `docs/features/connected-pages.md`.

## Bin (remote clipboard)

- **Approval:** Scott said "make it live" on 2026-10-21, with the same-day addition that context items are saved, not worked.
- **Current state:** `/admin/bin` is implemented, tested (full suite and lint pass), built, and pushed with the feature record at `docs/features/bin.md`.
- **Next gate:** Apply `supabase/migrations/2026-10-21-bin-items.sql` to project `mogoybejtmkoheqvfvuc` (needs Scott's Supabase sign-in), then verify a signed-in round trip on desktop and phone.

## October 10 Journal–Orbit release

- **Approval:** Scott explicitly said **“go”** on 2026-10-10 to deploy the current Journal–Orbit work. This authorizes committing and pushing the canonical Orbit source and synchronized heyScottyBro host source to their existing `main` branches, then verifying the resulting production deployment. No new database migration, production-record write, or live AI request is included.
- **Release sequence:** Completed canonical Orbit/host validation, canonical-first synchronization, commits, Orbit-then-host pushes, remote SHA checks, GitHub's Vercel Production success check, and a read-only authenticated app-shell smoke reload.
- **Limits:** The `journal_orbit_links` migration is already applied and verified. Real microphone, live-provider extraction, actual profile write/reload, and rendered desktop/mobile checks remain unverified and will be reported honestly.
- **Current state:** Canonical Orbit commit `22d8764508cdf885a77e791c58ac0190b1c1e4cb` and host release are pushed to their existing `main` branches. The host commit is `4352a8f86f86bca671a28081001758e051b32438`; GitHub confirms the Vercel Production check succeeded. Production app shell smoke test passed after refresh: authenticated `/admin` resolved to `/admin/today` and the page finished loading. Host lint, 329 tests, build, session registry, and Orbit 212 tests/build/UI/AI/ledger-only checks pass. Provider evals were not run because they make live Anthropic requests.
- **Next gate:** User-led verification of the Journal voice and Orbit review on the intended desktop/mobile devices, including microphone permission and a real-provider review, remains. No further schema or production-record writes are included in this release.

## October 10 source push

**Migration follow-up:** Scott subsequently requested running the migration. Applied `journal_orbit_links` to verified Command Center project `mogoybejtmkoheqvfvuc`, recorded remotely as `20261010034910`. Verified both columns, allowed-state constraint, partial index, all 80 existing events in legacy state, and unchanged owner-only RLS. Provider activation and full live/mobile feature verification remain open. Earlier references below to this specific migration being unapplied are superseded by this verified result.

Scott explicitly requested pushing the current heyScottyBro changes. This authorizes committing and pushing the existing source snapshot to origin/main, not applying migrations or activating providers. Fresh lint, npm test and production build pass. Journal–Orbit's outstanding review/receipt work and live/mobile verification remain open; this push is not a claim that the full feature is complete.

## Journal–Orbit workflow integration

- **Feature document:** `docs/features/journal-orbit-workflows.md`
- **Requested scope:** Journal-to-Orbit person links and profile proposals, voice dictation, natural-language event prefill, post-event Orbit logging, and action-aware reminders.
- **Decisions received:** Review each proposed journal/profile change; prompt with an explicit Log action after an event passes; open the destination flow for app-action reminders; support weight, food, workout, journal, and Orbit hangout; use a separate default-off event-drafting setting; reuse Orbit's Interview flow under the **Orbit** name.
- **Current state:** Event drafting, persistent event→Orbit prompt/source link (dismiss/reopen), five conservative reminder actions, and save-confirmed current-occurrence completion are implemented locally. Hangout logging reuses Orbit's Interview loop with manual fallback and retry-safe source identity. Journal voice dictation is wired to new/edit drafts with an audio-processing disclosure; saved transcripts open Orbit's review. Host-sourced Orbit changes ask before each profile link, new fact, or support relationship; unknown names stay unlinked, receipts link back to the host journal, and approved names render as profile links. Host tests pass (329), lint/build pass; canonical Orbit tests pass (212), build/UI/AI/ledger-only checks pass. Event-link migration `journal_orbit_links` was applied and verified on the configured project as documented above. No real speech session or live AI call was performed.
- **Approval:** Scott approved the voice-dictation addition with exact **“go”** on 2026-10-10. This covers local implementation and verification only. Real-provider, keyboard, microphone-permission, and rendered desktop/mobile flows remain unverified. No commit/push/deployment occurred in this work unit.
- **Next gate:** User-led microphone/browser verification and rendered desktop/mobile flows remain. Commit, push, and deployment still require separate approval.

## Frodo assistant expansion

- Feature: `docs/features/frodo-assistant-expansion.md`.
- Screenshot persistence is implemented locally: selected chat images save to private Documents with the user's message as searchable context; Frodo can return a safe deep link that opens the existing preview. Chat history stores only the document ID, and Clear does not remove saved Documents. 32 focused tests, 327 full tests, lint, build, and whitespace checks pass. No migration or production data changed; not deployed.
- Scott authorized building the expanded assistant on 2026-10-09.
- Scott requested voice and résumé-grounded file answers, then clarified app uploads and phone files selected in the app. Added owner-scoped PDF/DOCX/TXT extraction, bounded excerpts, source instructions, and explicit browser dictation/read-aloud controls. Browser dictation may send audio to its speech service. Five new document regressions and the full suite, lint, build, and whitespace checks pass. Rendered/mobile and real-provider verification remain.
- Latest steering: Griphook renamed to Banker locally; Research page and navigation removed without deleting stored records. Lint, full tests and build pass. Frodo / Orbit / Banker-only consolidation is requested but not yet implemented; internal helpers and historical session clearing require compatibility review. No release or rendered UI verification yet.
- Shared execution/evidence rules, global search coverage, uploaded file reading, and basic browser voice controls are implemented locally. Web search, continuous live voice, durable memory upgrades, Slack/message integrations and browser actions remain incomplete. No production activation is implied by local work.

## Admin lazy-chunk recovery

- **Feature document:** `docs/features/admin-lazy-chunk-recovery.md`
- **Requested scope:** Recover a phone/PWA admin route from the reported module-script import failure without masking genuine component errors.
- **Approval:** Scott said “go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. All admin route chunks now use the existing one-reload stale-module recovery wrapper; a blocked storage guard cannot loop. Focused tests, lint, the 325-test suite, build, and whitespace check pass. No service-worker strategy, data, dependency, migration, commit, push, or deployment changed.
- **Next permitted work:** Commit, push, and deploy require separate approval. After release, reproduce the stale-tab/PWA route transition to verify one reload and normal recovery.

## Frodo productivity foundation

- **Feature document:** `docs/features/frodo-productivity-foundation.md`
- **Requested scope:** Make Frodo’s data retrieval smarter and more productive: recurrence-aware planning, cross-collection search, and richer safe query filters.
- **Approval:** Scott said “go” on 2026-10-09 after reviewing the roadmap.
- **Current state:** Resolved locally and uncommitted. `query` now supports safe occurrence expansion and bounded rich filters; `global_search` performs source-labelled parallel retrieval without searching Vault secrets. A recurring multi-day event span now repeats correctly. Focused tests, lint, 322-test suite, build, and whitespace check pass; no database or production data changed.
- **Next permitted work:** Commit/push/release require separate approval. Batch/RPC writes, structured memory, hybrid/vector Brain retrieval, and proactive-rule delivery remain distinct future contracts.

## Admin home redirect

- **Feature document:** `docs/features/admin-home-redirect.md`
- **Requested scope:** Send an already-authenticated admin who opens the root URL to Today, while leaving the public home intact for signed-out visitors.
- **Approval:** Scott said “go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. The root route dynamically checks an existing session and replaces it with Today only for an authenticated owner. The focused test, lint, 322-test suite, and build pass; no authentication state or stored data was changed.
- **Next permitted work:** Commit/push/release require separate approval. After release, verify the redirect on a signed-in phone browser and the public-root fallback while signed out.

## Frodo history recovery

- **Feature document:** `docs/features/frodo-history-recovery.md`
- **Requested scope:** Recover Frodo when a compatible legacy display-history message is rejected, without weakening validation for unknown or unsafe saved content.
- **Approval:** Scott said “find the fix and fix it, go” on 2026-10-09.
- **Current state:** Resolved locally and uncommitted. Frodo now accepts its own persisted tier-handoff `note` display rows; the focused 19-test suite, lint, complete 321-test suite, and build pass. No stored data was cleared or overwritten.
- **Next permitted work:** Commit/push/release require separate approval. After release, reload the affected Frodo session at desktop and mobile widths to confirm recovery.

## Adaptive workout progression

- **Feature document:** `docs/features/adaptive-workout-progression.md`
- **Requested scope:** Use several completed sessions, reps, optional RPE, recency, equipment increments, and transparent history to recommend gradually progressive exercise weights. Add a durable Exercises list whose records are created from exercises actually added, show derived logged PRs/history, and save one weight-times-reps goal per exercise. Form knowledge is deferred.
- **Approval:** Scott approved the original cited progression contract and load-step decision, then approved the complete expanded exercise-library/PR-goal contract and pseudocode with exact **“go”** on 2026-10-03. Local implementation is authorized.
- **Current state:** Local implementation and automated validation are complete: 30 focused cases, all 320 registered tests, zero-warning lint, and the 3,154-module build pass. The Exercises UI, derived PRs/goals, transactional schema source, progression evidence, and `BUG-065` repair are uncommitted. The configured project ref was verified as the intended linked target, but migration inspection/application is blocked because neither the official CLI nor the isolated Supabase dashboard has an authenticated owner session. No migration or database write occurred.
- **Next permitted work:** Scott approved only the exercise-library migration with exact **“go.”** After Scott signs in to Supabase, inspect the remote migration history, apply only `2026-10-03-exercise-library.sql` without including unrelated pending migrations, then validate backfill, RLS-visible data, triggers, and desktop/mobile rendering. Goal-write testing remains a separate production-data gate. Live/provider calls, unrelated production-data operations, dependency change, commit, push, and deployment remain closed.

## AI workout builder validation

- **Feature document:** `docs/features/ai-workout-builder-validation.md`
- **Requested scope:** User-led end-to-end testing of the existing **Build a workout with AI** flow, one explicit action and screenshot at a time.
- **Approval:** Scott said **“lets test”** on 2026-10-03. This authorizes observation of his live test flow, not an agent-initiated model request, application fix, save, production write, commit, push, migration, or deployment.
- **Current state:** The real-provider request completed into an unsaved six-exercise review. Visible movements were grounded, and `BUG-065` records that an explicit 60 lb request was placed only in a cue while the functional Weight field stayed blank. Scott stopped the test before exercise 3, recovery, cancellation, persistence, duplicate-submit, or database save/reload checks. Other active and inherited workspace changes remain preserved.
- **Next permitted work:** None for this validation unless Scott resumes it. No fix is approved.

## Release CI repair

- Scott requested repair after the push error. GitHub run37086391814 confirms BUG-058 is the sole failed test (six sessions versus hard-coded two).
- Scope: replace the stale test expectation with reservation-based assertions, cover registry growth and consumed closed/abandoned IDs, run all host gates, and publish the follow-up repair. No application behavior, database, dependency or provider changes.
- Completed: reproduced the exact remote failure, repaired regression and added four fixtures; full tests pass (final suite310/310), lint/build/registry pass. Next: commit/push and inspect replacement CI result.

## Orbit conversational journal

- **Feature document:** `docs/features/orbit-journal.md`
- **Approval:** Scott's 2026-10-02 instruction to oversee agents and "lets get this cooking" authorizes local implementation of the discussed journal and memory-reconciliation plan.
- **Current state:** Two supervised Sol agents implemented the backend and UI in canonical Orbit. Supervisor review, 181 Orbit tests, 6 offline checks, desktop/mobile browser checks, host lint/build and local synchronization pass. Host full suite retains pre-existing BUG-058 (305/306); no assertions were weakened. Migration source is unapplied; real provider behavior and live database semantics remain unverified. See the feature record for release limits and evidence.
- **Next permitted work:** Scott authorized "commitvchanges and push": commit canonical Orbit, synchronize from that commit, commit the host and push both main branches. The existing host deployment may run automatically. Migration application and live-provider calls remain outside authorization. Preserve other active records.

**Last updated:** 2026-10-01

## Journal writing tools

- **Feature document:** `docs/features/journal-writing-tools.md`
- **Requested scope:** Inspect and plan live character and word counts, privacy-safe grammar and spelling cleanup, and a writing timer within the current journal create/edit experience.
- **Approval:** Scott approved the original contract with exact **“go”** on 2026-10-01, chose the compliant expanded cleanup scope with **“cleanup everything,”** and then approved the revised ten-unit contract with exact **“go.”** Local application edits and creation of the additive migration source are authorized.
- **Current state:** `SAI00000004` is active and bound. The revised ten-unit implementation is complete and uncommitted: create/edit share Unicode counts and an active-writing timer; cleanup is authenticated, server-gated, default-off, confirmed, validated, compared, undoable, and provenance-aware; `BUG-062` is resolved locally. Thirty-one focused tests, lint, build, deterministic evals, the AI validator, function ceiling, registry check, JSON/JSONL checks, privacy review, whitespace check, and desktop/390×844 local-data inspection pass. The full suite reports 305/306 because the already-recorded unrelated `BUG-058` projection test still hard-codes two sessions while the authoritative four-session validator passes. All inherited changes remain preserved.
- **Next permitted work:** Scott said **“push,”** but `main` and `origin/main` are still identical because the completed workspace is uncommitted. The presented combined release is: commit the journal implementation plus preserved closeout records, push `main`, and verify the resulting CI/automatic Vercel Production deployment while leaving the provenance migration unapplied and cleanup disabled. Await Scott's exact **“go”** for that combined consequence. Live AI/eval calls, provider-account changes, production data, migration application, and enabling journal cleanup remain separate gates; apply the provenance migration before enabling cleanup.
- **Data restrictions:** Journal text is sensitive. Do not place it in telemetry, logs, fixtures, prompts, screenshots, or session archives, and do not make a live cleanup request during discovery.

## Frodo previews, People integrity, analytics, and activity history

- **Feature document:** `docs/features/frodo-people-analytics-activity.md`
- **Requested scope:** Diagnose and plan Frodo image previews, People event isolation/edit/delete, obsolete-page removal, truthful cross-domain analytics, reusable Activity History, and honest page-usage telemetry.
- **Approval:** Scott approved the recorded contract and pseudocode with exact **“go”** on 2026-10-01, separately approved the Orbit and main commits with exact **“go commit,”** and after consequence review approved both pushes plus automatic Vercel Production deployment with exact **“go.”** Production migration application, production-data changes/deletion, dependency changes, and live AI/API calls remain unauthorized.
- **Current state:** `SAI00000003` is closed. Orbit `c5a1b8a` and heyScottyBro `7afd2d5` are published. Vercel Production deployment `6785320311` succeeded for `7afd2d5`; the public production shell and deployed Analytics/Mission chunks are verified. GitHub Actions failed only at reopened `BUG-058`. Fresh-session authenticated smoke testing is blocked by newly logged `BUG-061`, the displayed but disabled Google provider. The additive migration remains unapplied.
- **Next permitted work:** Finish post-release/session records and present the documentation-only closeout diff for a separate commit decision. Do not fix `BUG-058` or `BUG-061`, apply the database migration, or write/delete production data without separately approved work.
- **Data restrictions:** Use real stored-record capabilities only, never fabricate historical telemetry, never expose private journal/chat contents in analytics metadata, and never use the dead `bugs` collection.

## Vercel function-limit repair

- **Feature document:** `docs/features/vercel-function-limit-repair.md`
- **Requested scope:** Restore successful Vercel Production deployment from `main` while preserving the public Kiwi shared-tasks API and the committed Today/Frodo behavior.
- **Approval:** Scott approved the recorded contract and pseudocode with exact **“go”** on 2026-09-29. After reviewing the settled implementation and exact release target, Scott said exact **“go”** again on 2026-09-29, authorizing commit, push to `origin/main`, automatic Vercel Production deployment, and live verification.
- **Current state:** Complete and released from commit `7cc8db44966d4cc9674564bd19b766444f3cbc9b`. GitHub deployment `6736243162` reports Vercel Production success, the production alias serves the new thin Morning Brief and hourly Today schedule after a full-origin refresh, Frodo passed non-destructive open/expand/close checks, and the Project Manager closed and reconciled SAI00000002. No model request or production-data write occurred.
- **Next permitted work:** Present the documentation-only post-release closeout diff for separate commit approval; no further application or production work remains.
- **Release target:** Vercel project `scottadamsxs-projects/heyscottybro`, branch `main`, production alias `https://heyscottybro.vercel.app`.
- **Deferred findings:** `BUG-055` and `BUG-056` remain direct-composition validation debt and were not expanded into this repair.

## Retired Bonsai development session identities

- **Feature document:** `docs/features/bonsai-development-session-identities.md`
- **Requested scope:** Give every coded development session a Project Manager-owned sequential SAI identity, exact Bonsai chat title, first-message bootstrap, append-only registry, and readable glossary. This does not apply to heyScottyBro/Frodo product conversations.
- **Approval:** Scott approved the presented contract and pseudocode with exact **“go.”**
- **Current session:** `SAI00000001`, bound to Codex thread `01a0ea22-5d76-7502-a006-a16c39e7c228`; the chat title has been changed to `Bonsai Chat SAI00000001`.
- **Current state:** Retired as a governing mechanism on 2026-10-09 at Scott's direction. Historical archives and SAI records remain available for retrieval only; they do not gate development work.
- **Next permitted work:** None. Use the ordinary documentation-first workflow and durable project records instead.
- **Deferred findings:** `BUG-055` and `BUG-056` remain logged without implementation. `SEC-001 — Software Security Requirements` remains queued and unstarted.
- **Approved companion rule:** `docs/features/list-card-item-counts.md` records Scott's permanent requirement that settled row-list cards show an accurate small count. This work unit changes standards only; it does not authorize an uninspected application-wide retrofit.

Only work listed here is active. Application implementation or additional scope requires Scott's exact “go” or “I approve.”

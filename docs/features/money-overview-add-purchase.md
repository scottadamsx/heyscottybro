# Feature: Add purchase button on the Money Overview (BUG-078)

**Status:** Built and verified locally 2026-11-04 (BUG-078 resolved locally); push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-11-04

## User problem

Scott, on the Money page (Overview tab), with a screenshot of the live page: "there's poor ui because I can't input a purchase put a button near the top of the screen so it's easy or even on the same row as the two arrows on the other side".

## Desired outcome

- The Money Overview has an "Add purchase" button near the top of the screen, on the same row as the two period-navigation arrows, on the opposite (right) side of that row.
- Tapping it opens the existing transaction entry form (the same "Log transaction" form the Transactions tab uses), with a purchase (expense) ready to fill in.
- No second entry form, no duplicated form logic.

## Current behavior

- The Overview (`BudgetDashboard`) shows the pay-period title, the previous/next period arrows, and read-only stat cards. There is no way to add a purchase from it.
- The only entry point is on the Transactions tab: `BudgetTransactions` owns a "Log transaction" button that opens a `FormModal` with its own private form state (`showForm`, `openNew`). The form and modal live entirely inside that component; nothing outside the tab can open them.
- Layout mechanism behind Scott's screenshot: `.money-period` is a wrapping flex row (title block, then the arrows). On a phone the title takes the full first row, so the arrows wrap onto their own row, left-aligned, with empty space to their right.

## Scope

### Included

- `BudgetDashboard`: the period arrows move into a dedicated bar row under the period title; the right side of that row carries an "Add purchase" button (plus icon, the standard `.btn` pill, 44px minimum height) shown when the page passes `onAddPurchase`.
- `BudgetPage`: owns a one-shot form nonce. Its add-purchase handler bumps the nonce and switches to the Transactions tab (the tab state the page already owns); it passes a consume callback that clears the nonce.
- `BudgetTransactions`: watches the nonce; a fresh non-zero value opens the existing form via the existing `openNew()` path, then reports the nonce consumed. Form, validation, and save logic are untouched.
- A source-wiring regression test (`src/components/budget/budgetOverviewEntry.test.js`, node:test style like `JournalPage.test.js`), wired into the `npm test` chain in `package.json`.
- Records: BUG-078 in `docs/development/BUGS.md`, this document, `WORKLOG.md`, `CHANGELOG.md`, `ACTIVE_WORK.md`.

### Not included

- Extracting the transaction form into a shared component so the modal could open without leaving the Overview. That rewrite of a working form (state, edit path, bill linking) is a larger change than the outcome needs; the tab-switch reach opens the identical form with one added signal prop. If Scott later wants the form to open in place on the Overview, that extraction is the follow-up.
- Any change to what the form collects, how a transaction saves, or the Transactions tab's own "Log transaction" button.
- Push/deploy: separate approval gate (see Approval).

## Experience contract

- Phone: under the period title, one row: previous/next arrows on the left, "Add purchase" on the right, fully visible, at least 44px tall, no overlap with the period text or the stat cards below.
- Desktop: same bar row under the title block; arrows left, button right.
- Tapping "Add purchase" lands on the Transactions tab with the entry form already open (expense type preselected, as `openNew` already does). Saving shows the new purchase at the top of the list, as today. Closing the form leaves the user on the Transactions tab, one tap from Overview.
- A later manual visit to the Transactions tab does not reopen the form: the nonce is consumed and cleared after one use.
- Keyboard and screen reader: the button is a native button with a text label; the arrows keep their existing aria-labels.

## Acceptance criteria

- [x] The Overview renders an "Add purchase" button on the period arrows row, right side, at desktop and 390px widths, at least 44px tall, not overlapping the period text or stat cards. (Rendered check, passed 2026-11-04.)
- [x] Clicking it opens the existing transaction entry form (the "Log transaction" FormModal) via the Transactions tab. (Rendered check, passed 2026-11-04.)
- [x] Visiting the Transactions tab manually afterwards does not reopen the form. (Rendered check, passed 2026-11-04; also pinned by the wiring test.)
- [x] The Transactions tab's own "Log transaction" button and the edit flow behave exactly as before. (Untouched code path; the form in the rendered check is that same form.)
- [x] Lint, full test suite, and production build pass; the new wiring test is in the `npm test` chain.

## Edge cases

- Rapid double tap on "Add purchase": the nonce increments twice and the tab is already switching; the form opens once with the latest nonce, and consumption clears it.
- StrictMode double effects in development: the consumed-value guard in `BudgetTransactions` makes a repeated effect run with the same nonce a no-op, so the form opens once.
- `BudgetDashboard` rendered without `onAddPurchase` (any other harness or future caller): no button renders; the arrows row is unchanged in behaviour.

## Pseudocode

```text
BudgetPage (owns the tab state and the transactions list):
  state: txFormNonce, starts at 0
  openPurchaseForm():
    txFormNonce = txFormNonce + 1
    switchTab("transactions")
  clearTxFormNonce():
    txFormNonce = 0
  render:
    <BudgetDashboard ... onAddPurchase={openPurchaseForm} />
    <BudgetTransactions ... formNonce={txFormNonce}
                           onFormNonceUsed={clearTxFormNonce} />

BudgetDashboard (Overview):
  period title block (unchanged)
  bar row:
    left:  period nav (previous / Current / next), handlers unchanged
    right: if onAddPurchase was passed,
             "Add purchase" button (fa-plus, .btn) -> onAddPurchase()

BudgetTransactions (owns the entry form):
  consumedNonce = ref(0)
  effect on formNonce:
    if formNonce > 0 and formNonce != consumedNonce:
      consumedNonce = formNonce
      openNew()              // the existing new-transaction path, untouched
      onFormNonceUsed()      // parent clears the nonce back to 0
```

## Ordered task checklist

- [x] Inspect the Money page, dashboard, and transactions components; record the defect as BUG-078; write this document
- [x] Implement: dashboard bar row + button, page nonce wiring, transactions consume effect, one CSS rule
- [x] Add the wiring regression test and put it in the `npm test` chain
- [x] Run focused tests, lint, full test suite, and build
- [x] Verify rendered: screenshot the Overview harness at desktop and 390px (button on the arrows row, right side), and the Transactions harness with a nonce (form opens); view both
- [x] Close out: BUGS.md resolution, WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md, post-task checklist
- [x] Commit locally; push and deploy wait for Scott's separate approval

## Implementation record (2026-11-04)

Files changed:

- `src/components/budget/BudgetDashboard.jsx`: `onAddPurchase` prop; the period nav moved out of `.money-period` into a new `.money-period-bar` row directly under the title block; the bar renders the nav on the left and, only when `onAddPurchase` is passed, the "Add purchase" button (`.btn` pill, `fa-plus`) on the right. Arrow handlers and aria-labels unchanged.
- `src/components/budget/budget.css`: `.money-period-bar` (flex, space-between, `margin-top: var(--space-sm)`) and `.money-period-bar .btn { min-height: 44px; }`. The `.money-period` rule is untouched; with the nav moved out it holds only the title block.
- `src/pages/admin/BudgetPage.jsx`: `txFormNonce` state; `openPurchaseForm` (bumps the nonce, switches to the Transactions tab) passed as `onAddPurchase`; `formNonce` and `onFormNonceUsed={clearTxFormNonce}` passed to `BudgetTransactions`.
- `src/components/budget/BudgetTransactions.jsx`: `formNonce` / `onFormNonceUsed` props; a guarded effect opens the existing form through the existing `openNew()` for a fresh nonce and reports it used. Form, validation, and save logic untouched.
- `src/components/budget/budgetOverviewEntry.test.js` (new) and `package.json` (test chain): the wiring regression test.
- Records: this document, BUG-078 in `docs/development/BUGS.md`, `docs/development/WORKLOG.md`, `CHANGELOG.md`, `docs/development/ACTIVE_WORK.md`.

## Validation record (2026-11-04)

- Focused: `node --test src/components/budget/budgetOverviewEntry.test.js`, 3 pass.
- `npm run lint`: clean (`--max-warnings=0`).
- `npm test`: green end to end; final group 340 pass, 0 fail, including the 3 new wiring tests.
- `npm run build`: pass (pre-existing large-chunk advisory only).
- Rendered check: `verification/bug078-add-purchase-verify.py` (Playwright, venv `~/workspace/.pwenv`) served by Vite from a scratch entry (`bug078-verify.html` / `bug078-verify.jsx` at the repo root, deleted after the run) that mounts the real `BudgetDashboard` and `BudgetTransactions` inside `.admin-shell` with the app's own stylesheets (globals, index, system, budget) and reproduces `BudgetPage`'s exact nonce wiring. Results: desktop, the button sits on the arrows row (same row band as the previous-period arrow), right side, 44px tall, fully inside the viewport, clear of the period title; clicking it lands on the Transactions view with the existing "Log transaction" form open; Cancel closes it; a manual Overview then Transactions round trip does not reopen it; at 390px the button is again on the arrows row, 44px tall, right edge exactly at 390px. Screenshots viewed: `verification/bug078-overview-desktop.png`, `verification/bug078-form-open.png`, `verification/bug078-overview-phone.png`; step output in `verification/bug078-add-purchase-verify-output.txt` (evidence only, not committed).
- Harness limits, stated plainly: `BudgetPage` itself was not mounted (it loads through the planner API, which is auth-gated locally), so the page-level wiring is covered by the source-wiring test and by the harness reproducing it exactly, not by a rendered `BudgetPage`. Dummy Supabase env values were set for the Vite run because `src/utils/supabase.js` throws at import time without them; neither mounted component calls the API. Font Awesome does not load in the bare harness page, so the button's plus icon and the arrows' chevrons are covered by the production pass, not this harness; the button's text label renders.
- Not verified: the signed-in production Money page. That is the post-deploy gate in ACTIVE_WORK.md.

## Approval

Scott's direct order on 2026-11-04 ("there's poor ui because I can't input a purchase put a button near the top of the screen so it's easy or even on the same row as the two arrows on the other side", with a screenshot of the live Money Overview) authorizes implementing the fix and a local commit. Per AGENTS.md and the post-task checklist, push and deployment require Scott's separate explicit approval and are not part of this work unit.

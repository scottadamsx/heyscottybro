# Money rings: Groceries, Fun/Entertainment, Gas, and Bills buckets

## What Scott asked for

Scott, 2026-11-04, after three receipts were logged under the Finance
category "Other" because no proper category existed:

> make a groceries, I should have 3 rings in heyscottybro as I fucking
> asked, and groceries, fun/entertainment and gas, bills are another
> bucket but that's already logged, these buckets must be added

His standing definition of a bucket (recorded 2026-10-21): money set
aside for a period; if the bucket is $80, that is all he can spend from
it; logging a transaction typed to that bucket lowers its remaining
amount.

## Approval

Scott's direct order above, given 2026-11-04, authorises this feature
and a local commit (source-of-truth rule 1, same basis as BUG-078 and
the library pages). Push and deploy need Scott's separate explicit
approval, as usual. The live data setup (adding the categories and the
ring amounts on the live site) happens after deployment, through the
app's own UI.

## What exists today

- Money Overview has a "Category budgets" card: horizontal bars driven
  by `getQuantifiableBudgets` (pay-period spend per category against
  `config.categoryBudgets`), with Add/Edit budget modals already built.
- The live category list is Food, Transport, Bills, Entertainment,
  Housing, Car, Subscriptions, Travel, Other. There is no Groceries and
  no Gas, so grocery and household purchases land in Other.
- Bills already render as their own card with paid count and a bar,
  fed by `billsPaid` / `billsObligation` from the shared snapshot.
- Categories are config data (`budget_config.categories`), editable in
  Bills & Income. Category budgets are config data too.

## The change

### Data (live setup after deploy, through the UI)

1. Add two categories: **Groceries** and **Gas**.
2. Set category budgets from Scott's couples-budget ring amounts:
   Groceries $150, Entertainment $100, Gas $70. The app compares the
   budget figure against pay-period spend (existing semantics of
   `getQuantifiableBudgets`); the amounts are per pay period in effect
   and stay editable in the app.
3. Move the four Nov 4, 2026 purchases logged as Other (Walmart $26.78,
   Dollarama $10.64, Tahitian vanilla $8.99, Sobeys $11.49) to
   Groceries, per Scott's ruling that household essentials are
   Groceries.

### Code (this commit)

1. `src/lib/budgetRings.js`: a pure builder for the four rings.
   Pseudocode:

   ```
   RING_DEFS = [
     { key: "groceries", label: "Groceries", category: "Groceries" },
     { key: "fun", label: "Fun / Entertainment", category: "Entertainment" },
     { key: "gas", label: "Gas", category: "Gas" },
     { key: "bills", label: "Bills", category: null },
   ]
   buildRings(transactions, config, period, billsPaid, billsObligation):
     for each category ring:
       spent = sum of expense transactions in period with that category
       set = config.categoryBudgets[category] or 0
       remaining = set - spent; pct = set > 0 ? spent / set clamped 0..1 : 0
       over = spent > set (only when set > 0)
     bills ring: spent = billsPaid, set = billsObligation, same math
     return the four ring objects in RING_DEFS order
   ```

   Category rings always appear, even with no budget set (set = 0,
   shows spent and a "Set amount" affordance), because Scott's three
   rings must be present, not conditional on setup.

2. `BudgetDashboard.jsx`: the Category budgets card becomes the
   **Rings** card, first card in the money grid. Each ring is an SVG
   circle (track + progress arc, teal / amber over 80% / red over, the
   existing meter tones), centre text is the amount left in DM Mono,
   label and "spent of set" beneath, click the label to drill into the
   ring's transactions (existing TxDrill), click the numbers to edit
   the budget (existing modal). The Bills ring is display-only there
   (its detail lives in the Bills card). The Add category budget button
   and both modals are unchanged. The old per-category bars in this
   card are replaced by the rings; variable bills still render in the
   Bills card as before.

3. `src/api/plannerApi.js`: the fallback category list gains Groceries
   and Gas so the banker's validation fallback matches the live list.
   (The live list comes from config; this only keeps the fallback
   honest.)

4. CSS in `budget.css`: ring layout (wrapping row of rings, 44px+
   touch targets on the label/numbers buttons, centre text sizing).

### Out of scope

- No change to how category budgets are stored or to their "monthly"
  form label; the period comparison is the app's existing behaviour.
  Renaming that label is a separate piece of work if Scott wants it.
- No change to the Bills card, Weekly allowance, or By category card.
- The Scotty & McKenna site is untouched.

## Steps

- [x] Feature document written (this file)
- [x] ACTIVE_WORK.md entry added
- [x] `budgetRings.js` + unit tests (6/6 pass)
- [x] Rings card in BudgetDashboard + CSS
- [x] plannerApi fallback categories
- [x] Lint, full test suite, build
- [x] Rendered harness check (desktop + 390px), screenshots read
- [x] WORKLOG.md + CHANGELOG.md entries
- [ ] Local commit; report to Scott; wait for push approval
- [ ] After deploy: live setup (categories, budgets, re-categorise the
      four Nov 4 purchases) and signed-in verification

## Validation record

- Unit tests: `src/lib/budgetRings.test.js` 6/6 pass (ring order and
  presence, in-period category sums, remaining/pct/over math, unset
  rings, bills ring, empty inputs). Wired into the `npm test` chain.
- Full suite: `npm test` exit 0 (496 checks across the chain, no
  failures). Lint: clean. Production build: pass.
- Rendered harness (the real BudgetDashboard served by Vite from a
  scratch entry, since removed, with the app's stylesheets and stub
  data: Groceries $38.27 of $150, Fun $20 of $100, Gas $75 of $70,
  Bills $150 paid of $850): all checks passed. Four rings with the
  right labels; centre values $111.73 left, $80.00 left, -$5.00 over
  (full red ring), $700.00 left; the Groceries drill listed its two
  transactions; the Gas numbers opened the existing "Gas budget"
  modal; at 390px the rings wrapped 2 by 2 with no overflow.
  Screenshots read and confirmed: `verification/rings-desktop.png`,
  `verification/rings-phone.png`. Script kept at
  `verification/rings-ui-verify.py`.
- Not yet verified: the live site (needs the push, then the live data
  setup and a signed-in check).

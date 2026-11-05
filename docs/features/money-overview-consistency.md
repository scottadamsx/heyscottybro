# Money Overview consistency: one source of truth per number (BUG-079)

## What Scott asked for

Scott, 2026-11-04, sending a screenshot of the live Money Overview:

> do you see the inconsistincenies, you clearly havent taken a good look
> make it way better now

## Approval

Scott's direct order above, given 2026-11-04 after he identified the
defects himself, authorises this fix and a local commit (source-of-truth
rule 1, same basis as the Money rings work). Push and deploy need
Scott's separate explicit approval, as usual. The one live data change
(the $20 gas entry's category) runs through the app's own UI, never the
database.

## The inconsistencies in Scott's screenshot (Nov 4 to 17 period)

1. **Two envelope systems disagree about the same buckets.** The Rings
   card (per pay period, by transaction category) reads Groceries
   $57.90 / $150, Fun / Entertainment $50.59 / $100, Gas $0.00 / $70.
   The Bills card below it renders four variable bills (the older
   envelope system) for the same concepts with different set amounts
   and zero spend: Groceries $0.00 / $300.00 (category Food), Fun Money
   $0.00 / $100.00 (Entertainment), Gas $0.00 / $200.00 (Transport),
   plus Toiletries $0.00 / $100.00 (Other), which has no ring at all.
2. **The variable bills always read $0 for Scott.** `getPeriodBills`
   counts toward a variable bill only transactions explicitly tagged
   with `fulfills_recurring_id`. Scott logs by category, so nothing is
   ever tagged and every envelope reads $0 spent, directly
   contradicting the rings above them.
3. **The $20 gas purchase is invisible to both Gas buckets.** Weekly
   allowance Week 1 spent is $128.49. The three category rings sum to
   $108.49 ($57.90 + $50.59 + $0.00). The difference is exactly the
   $20.00 Orangestore fuel purchase logged under the legacy Transport
   category: the Gas ring counts category Gas only, and the variable
   Gas bill counts tagged transactions only.
4. **A future week presents money as already rolled over.** Week 1
   (Nov 4 to 10, marked Now) shows $195.34 left. Week 2 already shows
   $519.18 left, which is its $323.84 base plus Week 1's unfinished
   $195.34, described in the past tense as rolled over. Read together
   the two weeks claim $714.52 left against $647.67 spendable for the
   whole period.
5. **The Bills card count does not match its rows.** The header reads
   "0 of 2 paid" (the two fixed bills: Google One $35, Rent $700,
   $735 total, matching the Bills ring), but the card lists six rows
   because the four variable envelopes render inside it.
6. **The budget modal calls the ring amounts "Monthly".** The
   category budget editor labels its field "Monthly budget" while the
   Overview compares the same stored figure against pay-period spend
   (the rings' amounts, $150 / $100 / $70, were set per pay period).

Noted, not changed by this work: the Bills list still carries a
Google One $35 bill due Nov 13. Scott's verified Google Play record
(2026-10-22) says that subscription expired Oct 11, 2026 and the
charge should not occur. Removing a recurring bill is a data decision
for Scott; it is flagged in the delivery report, not silently deleted.

## The change

One source of truth per number: rings are the only spending envelopes
on the Overview, the Bills card lists only bills, and a future week
shows its planned base until it starts.

### Code (`BudgetDashboard.jsx`, `budgetCalc.js` comments)

1. **Bills card: fixed bills only.** The variable-bill rows are removed
   from the Bills card. Variable bills are not deleted; they remain
   managed in Bills & Income, which already renders and edits them.
   The card's empty state and paid count now describe exactly the rows
   shown. The now-unused variable-bill drill helper goes with them.
2. **Weekly allowance: future weeks show the plan, not a projection.**
   A week that has not started shows its base amount as "planned" and
   a footnote that rollover is added when the week starts. Current and
   past weeks keep the existing reading (left, spent of allowance
   including real rollover from finished weeks). `computeWeeklyAllowance`
   itself is unchanged, so the home widget's current-week numbers are
   untouched.
3. **Budget modal label.** "Monthly budget" becomes "Amount per pay
   period" (placeholder and the add-mode error follow), matching how
   the Overview uses the figure. Storage is unchanged.

Pseudocode for (2):

```
for each week w in weekly.weeks:
  if w is past or current: render as today (remaining left; spent of allowance incl. carryIn)
  else:  // future
    right side: formatMoney(w.base) + " planned"
    bar: spent / base
    foot: formatMoney(w.spent) + " spent · rollover added when this week starts"
```

### Data (live, through the UI)

4. Move the Nov 4, 2026 Orangestore fuel purchase ($20.00) from
   category Transport to category Gas. After the move the Gas ring
   reads $20.00 of $70.00 and the rings sum ($128.49) equals Week 1
   spent in the Weekly allowance. Rule going forward, already the
   app's model: a ring counts exactly its category, so fuel is logged
   under Gas.

### Out of scope

- No change to `computeWeeklyAllowance`, `computeBudgetSnapshot`, the
  home Dashboard widget, or the Scotty & McKenna site.
- Variable bills keep their tagged-transaction counting inside
  Bills & Income; only their misleading Overview rows go.
- No bill is deleted (see the Google One note above).

## Steps

- [x] Feature document written (this file)
- [x] ACTIVE_WORK.md entry added
- [x] Bills card fixed bills only; unused variable drill removed
- [x] Weekly allowance future-week presentation
- [x] Budget modal per-period label
- [x] Regression source test in the npm test chain (BUG-079)
- [x] Lint, full test suite, build
- [x] Rendered harness check (desktop + 390px), screenshots read
- [x] Live data fix through the UI (Orangestore $20 to Gas) and
      signed-in verification of the Gas ring
- [x] BUGS.md (BUG-079), WORKLOG.md, CHANGELOG.md entries
- [ ] Local commit; report to Scott; wait for push approval
- [ ] After deploy: signed-in verification that the Bills card lists
      only the fixed bills and Week 2 reads as planned

## Validation record

- Regression tests: 3 new source tests in
  `src/components/budget/budgetOverviewEntry.test.js` (no variable-bill
  rendering in the dashboard, future weeks presented as planned base,
  per-period modal label); the file passes 6/6. Full suite: exit 0,
  final group 343 pass / 0 fail (was 340). Lint clean. Production
  build pass (pre-existing large-chunk advisory only).
- Rendered harness: scratch Vite entry (repo root
  `consistency-verify.html` plus `src/consistency-verify.jsx`, both
  deleted after the run) mounting the real `BudgetDashboard` with
  Scott's exact live figures (income $1,516 biweekly from Nov 4;
  Groceries $57.90 of $150; Fun $50.59 of $100; the Orangestore $20
  already under Gas; fixed bills Google One $35 and Rent $700; the
  four variable bills in config; Coach Bag goal) and the app's
  stylesheets, driven with Playwright. All checks passed: ring centres
  $92.10 / $49.41 / $50.00 / $735.00 left with the right spent/set
  lines; the Bills card listed only Google One and Rent with "0 of 2
  paid", and no variable envelope text (Fun Money, Toiletries, the
  $0.00 / $300.00, $0.00 / $200.00, $0.00 / $100.00 lines) appeared
  anywhere on the page; Week 1 read "$128.49 spent of $323.83" with
  "$195.34 left"; Week 2 read "$323.83 planned" with the rollover note
  and "$519.18" appeared nowhere; the Gas budget modal showed "Amount
  per pay period" and no "Monthly budget". Screenshots read at desktop
  (1280px) and 390px; no horizontal overflow at 390px (scrollWidth
  390). Evidence: `verification/bug079-overview-desktop.png`,
  `verification/bug079-overview-phone.png`,
  `verification/bug079-consistency-verify.py` (kept, untracked, as
  with the earlier verify scripts). Harness limits: the KPI cards
  render with a grey wash in the bare scratch page (stylesheet subset)
  and Font Awesome does not load there; both are harness limits also
  present in the BUG-078 and rings harnesses, not app defects.
- Live data fix, verified Nov 4, 2026 through the app UI only (no
  database): Money, Transactions, the Nov 4 entry "Gas - Orangestore
  (North Atlantic Petroleum), 86 Thorburn Rd, St. John's", $20.00,
  edited from category Transport to category Gas; date, amount,
  description, bill status, and notes unchanged, and the Transactions
  list re-read to confirm. Money Overview then read: Gas ring $20.00
  spent of $70.00, $50.00 left (was $0.00 of $70.00); Week 1 unchanged
  at $128.49 spent of $323.83, $195.34 left, so the rings now sum to
  Week 1 spent. The code half of this fix (Bills card, future weeks,
  modal label) still needs the push before its signed-in production
  check can run.

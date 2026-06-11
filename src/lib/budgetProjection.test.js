// Unit tests for the budget projection engine.
// Run with: node src/lib/budgetProjection.test.js
// (No test framework — plain assertions. Exits non-zero on first failure.)

import { buildProjection, defaultHorizon, fulfillmentStatus } from "./budgetProjection.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
    passed++;
  } catch (e) {
    console.error(`\u2717 ${name}\n  ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function near(a, b, eps = 0.01) {
  if (Math.abs(a - b) > eps) throw new Error(`expected ${a} ≈ ${b}`);
}

const TODAY = new Date("2026-04-21");
const HORIZON = defaultHorizon("2026-04", 9);

test("empty inputs → zero'd months with closing = starting", () => {
  const p = buildProjection({ startingBalance: 1000, horizonMonths: HORIZON, today: TODAY });
  assert(p.length === 9, "9 months");
  assert(p[0].openingBalance === 1000, "April opens at 1000");
  // Past has no projection → closes at opening
  assert(p[0].closingBalance === 1000, "April closes at 1000 (past + empty)");
});

test("future one-time transaction shifts subsequent closing balances", () => {
  const txs = [{ description: "Bonus", amount: 500, type: "income", date: "2026-06-15" }];
  const p = buildProjection({ transactions: txs, startingBalance: 1000, horizonMonths: HORIZON, today: TODAY });
  near(p[2].actualIncome, 500); // June index 2
  near(p[2].closingBalance - p[1].closingBalance, 500);
  near(p[8].closingBalance - p[8].openingBalance, 0); // Dec net = 0
  near(p[8].closingBalance, p[2].closingBalance);
});

test("recurring bill with endDate stops appearing after endDate", () => {
  const bills = [{ id: "b1", name: "Rent", amount: 875, category: "Housing", frequency: "monthly", startDate: "2026-05-01", endDate: "2026-07-31" }];
  const p = buildProjection({ recurringBills: bills, startingBalance: 0, horizonMonths: HORIZON, today: TODAY });
  near(p[1].projectedExpenses, -875); // May
  near(p[2].projectedExpenses, -875); // June
  near(p[3].projectedExpenses, -875); // July
  near(p[4].projectedExpenses, 0);    // August — past endDate
});

test("transaction fulfilling a recurring bill → projection does NOT double-count", () => {
  const bills = [{ id: "rb-rent", name: "Rent", amount: 875, category: "Housing", frequency: "monthly", startDate: "2026-05-01" }];
  const txs = [{ id: "t1", description: "Rent paid", amount: -875, type: "expense", category: "Housing", date: "2026-05-01", fulfills_recurring_id: "rb-rent" }];
  const p = buildProjection({ transactions: txs, recurringBills: bills, startingBalance: 0, horizonMonths: HORIZON, today: TODAY });
  near(p[1].actualExpenses, -875);
  near(p[1].projectedExpenses, 0, 0.01); // not added again
});

test("implicit fulfillment by category + ±20% amount", () => {
  const bills = [{ id: "rb-rent", name: "Rent", amount: 875, category: "Housing", frequency: "monthly", startDate: "2026-05-01" }];
  const txs = [{ id: "t1", description: "Rent", amount: -900, type: "expense", category: "Housing", date: "2026-05-03" }];
  const p = buildProjection({ transactions: txs, recurringBills: bills, startingBalance: 0, horizonMonths: HORIZON, today: TODAY });
  near(p[1].projectedExpenses, 0, 0.01);
  const ff = p[1].fulfillments.find(f => f.source.id === "rb-rent");
  assert(ff.status.implicit, "implicit flag should be set");
});

test("past month never gets projected additions", () => {
  // today = 2026-04-21. April is current, March would be past if in horizon. Use Feb–Apr.
  const horizon = ["2026-02", "2026-03", "2026-04"];
  const bills = [{ id: "rb", name: "Old", amount: 100, frequency: "monthly", startDate: "2026-01-01" }];
  const p = buildProjection({ recurringBills: bills, startingBalance: 0, horizonMonths: horizon, today: TODAY });
  near(p[0].projectedExpenses, 0); // past
  near(p[1].projectedExpenses, 0); // past
  near(p[2].projectedExpenses, -100); // current — still projects
});

test("contract endDate excludes Sept+", () => {
  const sources = [{ id: "inc-contract", name: "Contract", amount: 3075, frequency: "monthly", startDate: "2026-05-01", endDate: "2026-08-31" }];
  const p = buildProjection({ incomeSources: sources, startingBalance: 0, horizonMonths: HORIZON, today: TODAY });
  near(p[1].projectedIncome, 3075); // May
  near(p[4].projectedIncome, 3075); // August
  near(p[5].projectedIncome, 0);    // September
});

test("planned ('future') transactions hit the balance but not actuals", () => {
  const txs = [{ id: "t1", description: "Car purchase", amount: -4000, type: "future", category: "Car", date: "2026-06-05" }];
  const p = buildProjection({ transactions: txs, startingBalance: 5000, horizonMonths: HORIZON, today: TODAY });
  const june = p[2];
  near(june.actualExpenses, 0);              // not an actual
  near(june.plannedNet, -4000);              // but it IS planned cash flow
  near(june.closingBalance - june.openingBalance, -4000);
  near(p[8].closingBalance, 1000);           // carries through to the end
});

test("positive-amount 'future' rows are normalized to planned spend", () => {
  // Frodo's tool passes positive amounts; sign must derive from type.
  const txs = [{ id: "t1", description: "Flight", amount: 800, type: "future", date: "2026-07-10" }];
  const p = buildProjection({ transactions: txs, startingBalance: 1000, horizonMonths: HORIZON, today: TODAY });
  near(p[3].plannedNet, -800);
  near(p[3].closingBalance, 200);
});

test("full plan smoke test — April opens 5000, car + deposit + lump sum", () => {
  const txs = [
    { id: "t1", description: "Car", amount: -4000, type: "expense", category: "Car", date: "2026-04-05" },
    { id: "t2", description: "Deposit", amount: -656.25, type: "expense", category: "Housing", date: "2026-04-10" },
    { id: "t3", description: "Lump 1", amount: 3000, type: "income", category: "Other", date: "2026-04-30" },
  ];
  const p = buildProjection({ transactions: txs, startingBalance: 5000, horizonMonths: HORIZON, today: TODAY });
  near(p[0].actualIncome, 3000);
  near(p[0].actualExpenses, -4656.25);
  near(p[0].closingBalance, 3343.75);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Unit tests for the Money rings builder.
// Run with: node src/lib/budgetRings.test.js
// (No test framework — plain assertions. Exits non-zero on first failure.)

import { buildRings, RING_DEFS } from "./budgetRings.js";

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

function near(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps;
}

const PERIOD = { start: "2026-11-04", end: "2026-11-17" };
const tx = (over) => ({ type: "expense", category: "Groceries", amount: 10, date: "2026-11-05", ...over });

test("always returns the four rings in Scott's order", () => {
  const rings = buildRings([], {}, PERIOD, 0, 0);
  assert(rings.length === 4, `expected 4 rings, got ${rings.length}`);
  assert(rings.map((r) => r.key).join(",") === "groceries,fun,gas,bills", "ring order");
  assert(rings[1].category === "Entertainment", "fun ring reads the Entertainment category");
  assert(rings[3].category === null && rings[3].editable === false, "bills ring is display-only");
  assert(RING_DEFS.length === 4, "defs exported");
});

test("category spend sums only in-period expenses in that category", () => {
  const txs = [
    tx({ amount: 26.78 }),
    tx({ amount: 11.49, date: "2026-11-17" }),
    tx({ amount: 99, date: "2026-11-18" }), // after period
    tx({ amount: 99, date: "2026-11-03" }), // before period
    tx({ amount: 99, type: "income" }),
    tx({ amount: 99, category: "Other" }),
    tx({ amount: 5, category: "Gas", date: "2026-11-06" }),
  ];
  const rings = buildRings(txs, { categoryBudgets: { Groceries: 150 } }, PERIOD, 0, 0);
  assert(near(rings[0].spent, 38.27), `groceries spent ${rings[0].spent}`);
  assert(near(rings[2].spent, 5), `gas spent ${rings[2].spent}`);
  assert(near(rings[1].spent, 0), "fun spent 0");
});

test("remaining, pct and over follow the set amount", () => {
  const rings = buildRings([tx({ amount: 200 })], { categoryBudgets: { Groceries: 150 } }, PERIOD, 0, 0);
  const g = rings[0];
  assert(g.hasSet && near(g.set, 150), "set");
  assert(near(g.remaining, -50), `remaining ${g.remaining}`);
  assert(g.pct === 1, "pct clamps at 1");
  assert(g.over === true, "over flag");
});

test("an unset ring still shows, with spend but no over flag", () => {
  const rings = buildRings([tx({ amount: 30, category: "Gas" })], {}, PERIOD, 0, 0);
  const gas = rings[2];
  assert(gas.hasSet === false && near(gas.set, 0), "no set amount");
  assert(near(gas.spent, 30) && gas.pct === 1 && gas.over === false, "spend shows, not over");
  const fun = rings[1];
  assert(fun.pct === 0 && near(fun.remaining, 0), "untouched unset ring reads empty");
});

test("bills ring uses paid against obligation", () => {
  const rings = buildRings([], {}, PERIOD, 150, 457);
  const b = rings[3];
  assert(near(b.spent, 150) && near(b.set, 457) && near(b.remaining, 307), "bills math");
  assert(near(b.pct, 150 / 457), "bills pct");
  assert(b.over === false, "bills not over");
});

test("empty and missing inputs are tolerated", () => {
  const rings = buildRings(null, null, PERIOD);
  assert(rings.length === 4 && rings.every((r) => r.spent === 0), "zeros throughout");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Unit tests for the Connected Pages cascade rules (src/lib/cascades.js).
// Run with: node src/lib/cascades.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import {
  hashManagedFields, addDays, shiftMinutes,
  cookStartFor, buildMealDesiredTasks, buildShoppingDesiredTask,
  planReconciliation, stampEventTaskProvenance,
} from "./cascades.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const recipe = { id: "r1", title: "Spaghetti", prep_minutes: 15, cook_minutes: 45, servings: 2, prep_profile: { kind: "none" } };
const item = { id: "i1", meal_plan_id: "p1", planned_date: "2026-10-26", meal_slot: "dinner", recipe_id: "r1", servings: 2, eat_time: "18:00", status: "planned", advance_prep_kind: "none" };

test("CP-17: cook task is eating time minus prep+cook (18:00 - 60m = 17:00)", () => {
  const tasks = buildMealDesiredTasks(item, recipe);
  eq(tasks.length, 1, "one task");
  eq(tasks[0].name, "Cook Spaghetti");
  eq(tasks[0].date, "2026-10-26");
  eq(tasks[0].time, "17:00");
  eq(tasks[0].source_key, "cook");
  assert(tasks[0].generated_hash, "hash attached");
});

test("45-minute fallback when the recipe has no usable times", () => {
  const bare = { ...recipe, prep_minutes: null, cook_minutes: null };
  const start = cookStartFor(item, bare);
  eq(start.time, "17:15");
});

test("cook start rolls to the previous day instead of clamping", () => {
  const late = { ...item, eat_time: "00:30" };
  const start = cookStartFor(late, recipe);
  eq(start.date, "2026-10-25");
  eq(start.time, "23:30");
});

test("CP-18: night-before prep lands the previous day at 20:00", () => {
  const r = { ...recipe, prep_profile: { kind: "night_before", note: "Marinate the chicken" } };
  const tasks = buildMealDesiredTasks(item, r);
  eq(tasks.length, 2);
  eq(tasks[1].name, "Prep Spaghetti");
  eq(tasks[1].date, "2026-10-25");
  eq(tasks[1].time, "20:00");
  assert(tasks[1].description.includes("Marinate the chicken"), "prep note carried");
});

test("morning prep lands on the meal date at 08:00; lead-time prep subtracts the lead", () => {
  const morning = buildMealDesiredTasks(item, { ...recipe, prep_profile: { kind: "morning" } });
  eq(morning[1].date, "2026-10-26"); eq(morning[1].time, "08:00");
  const lead = buildMealDesiredTasks(item, { ...recipe, prep_profile: { kind: "lead_time", lead_minutes: 90 } });
  eq(lead[1].time, "16:30");
});

test("plan-item prep override beats the recipe profile", () => {
  const overridden = { ...item, advance_prep_kind: "morning", advance_prep_note: "Soak beans" };
  const tasks = buildMealDesiredTasks(overridden, { ...recipe, prep_profile: { kind: "night_before" } });
  eq(tasks[1].time, "08:00");
});

test("prep that duplicates the cook work folds into the cook task", () => {
  // lead_time 60 from 18:00 = 17:00, exactly the cook start.
  const tasks = buildMealDesiredTasks(item, { ...recipe, prep_profile: { kind: "lead_time", lead_minutes: 60, note: "Season early" } });
  eq(tasks.length, 1, "no separate prep task");
  assert(tasks[0].description.includes("Season early"), "note folded into cook task");
});

test("skipped, cancelled, and cooked items desire no tasks", () => {
  for (const status of ["intentional_skip", "cancelled", "cooked"]) {
    eq(buildMealDesiredTasks({ ...item, status }, recipe).length, 0, status);
  }
});

test("reconciliation creates missing, updates changed, retires stale", () => {
  const desired = buildMealDesiredTasks(item, recipe);
  let plan = planReconciliation({ desired, existing: [] });
  eq(plan.create.length, 1);
  const existing = [{ id: "t1", source_key: "cook", completed: false, managed_state: "generated", generated_hash: desired[0].generated_hash }];
  plan = planReconciliation({ desired, existing });
  eq(plan.unchanged.length, 1); eq(plan.create.length, 0);
  const moved = buildMealDesiredTasks({ ...item, eat_time: "19:00" }, recipe);
  plan = planReconciliation({ desired: moved, existing });
  eq(plan.update.length, 1); eq(plan.update[0].id, "t1");
  plan = planReconciliation({ desired: [], existing });
  eq(plan.retire.length, 1);
});

test("CP-21/CP-22: a completed task is never recreated or edited", () => {
  const desired = buildMealDesiredTasks(item, recipe);
  const existing = [{ id: "t1", source_key: "cook", completed: true, managed_state: "generated", generated_hash: "old" }];
  const plan = planReconciliation({ desired, existing });
  eq(plan.create.length, 0); eq(plan.update.length, 0); eq(plan.retire.length, 0);
  eq(plan.completedConflicts.length, 1);
});

test("CP-23: a detached task is left alone and reported", () => {
  const desired = buildMealDesiredTasks(item, recipe);
  const existing = [{ id: "t9", source_key: "cook", completed: false, managed_state: "detached", generated_hash: "x" }];
  const plan = planReconciliation({ desired, existing });
  eq(plan.create.length, 0); eq(plan.update.length, 0); eq(plan.retire.length, 0);
  eq(plan.detached.length, 1);
});

test("hash is stable for identical managed fields and changes with them", () => {
  const a = { name: "Cook X", date: "2026-10-26", time: "17:00", description: "d", source_type: "meal_plan_item", source_id: "i1", source_key: "cook" };
  eq(hashManagedFields(a), hashManagedFields({ ...a }));
  assert(hashManagedFields(a) !== hashManagedFields({ ...a, time: "18:00" }), "time change changes hash");
});

test("shopping task is due the day before the first meal at 17:00", () => {
  const now = new Date("2026-10-22T10:00:00");
  const task = buildShoppingDesiredTask({ id: "p1" }, [item], { itemCount: 9, pricedCount: 9, purchaseTotalCents: 6777, budgetCents: 7500 }, now);
  eq(task.date, "2026-10-25"); eq(task.time, "17:00");
  assert(task.description.includes("$67.77"), "planned spend in description");
  assert(task.description.includes("$75.00"), "budget in description");
});

test("shopping task planned late is due today, not in the past", () => {
  const now = new Date("2026-10-26T09:00:00");
  const task = buildShoppingDesiredTask({ id: "p1" }, [item], { itemCount: 3, pricedCount: 3, purchaseTotalCents: 1000, budgetCents: null }, now);
  eq(task.date, "2026-10-26");
  eq(task.time, "16:00", "two hours before the 18:00 first meal");
});

test("no planned meals means no shopping task", () => {
  eq(buildShoppingDesiredTask({ id: "p1" }, [{ ...item, status: "intentional_skip" }], {}, new Date()), null);
});

test("event auto-task provenance stamping is deterministic", () => {
  const rows = stampEventTaskProvenance([{ name: "A — Ev", date: "2026-10-26" }, { name: "B — Ev", date: "2026-10-27" }], "ev1");
  eq(rows[0].source_type, "event"); eq(rows[0].source_key, "auto:0"); eq(rows[1].source_key, "auto:1");
  eq(rows[0].generator, "event-type-auto-tasks");
  assert(rows[0].generated_hash, "hash present");
});

test("date helpers roll across months", () => {
  eq(addDays("2026-10-31", 1), "2026-11-01");
  eq(shiftMinutes("2026-01-01", "00:15", -30).date, "2025-12-31");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

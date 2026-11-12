// Unit tests for the Connected Pages gap-watcher rules (src/lib/gapWatchers.js).
// Run with: node src/lib/gapWatchers.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import { computeMealsGap, computeBudgetGap, gapFingerprint, decideWatcher } from "./gapWatchers.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// Week of Monday 2026-10-26 .. Sunday 2026-11-01.
const WEEK = "2026-10-26";
const planned = (date, extra = {}) => ({ planned_date: date, meal_slot: "dinner", status: "planned", ...extra });
const fullWeek = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map((d) => planned(d));

test("CP-24: a full unplanned week is a 7-day gap", () => {
  const gap = computeMealsGap({ weekStart: WEEK, items: [], today: "2026-10-25" });
  eq(gap.length, 7);
  eq(gap[0].date, "2026-10-26");
});

test("CP-25: planned and intentionally skipped days satisfy the watcher", () => {
  const items = [...fullWeek.slice(0, 6), planned("2026-11-01", { status: "intentional_skip" })];
  eq(computeMealsGap({ weekStart: WEEK, items, today: "2026-10-25" }).length, 0);
});

test("CP-31: removing the skip reopens that day as a gap", () => {
  const gap = computeMealsGap({ weekStart: WEEK, items: fullWeek.slice(0, 6), today: "2026-10-25" });
  eq(gap.length, 1); eq(gap[0].date, "2026-11-01");
});

test("CP-30: a partial current week ignores days already past", () => {
  const gap = computeMealsGap({ weekStart: WEEK, items: [], today: "2026-10-28" });
  eq(gap.length, 5);
  eq(gap[0].date, "2026-10-28");
});

test("a past week reports no gap (watcher expires instead)", () => {
  eq(computeMealsGap({ weekStart: WEEK, items: [], today: "2026-11-05" }).length, 0);
});

test("cancelled items do not satisfy the watcher; cooked items do", () => {
  const items = [planned("2026-10-26", { status: "cancelled" }), planned("2026-10-27", { status: "cooked" })];
  const gap = computeMealsGap({ weekStart: WEEK, items, today: "2026-10-25" });
  eq(gap.length, 6);
  assert(!gap.some((g) => g.date === "2026-10-27"), "cooked day satisfied");
});

test("fingerprint changes exactly when the gap set changes", () => {
  const a = gapFingerprint([{ date: "2026-10-26", slot: "dinner" }]);
  eq(a, gapFingerprint([{ date: "2026-10-26", slot: "dinner" }]));
  assert(a !== gapFingerprint([{ date: "2026-10-27", slot: "dinner" }]), "different day differs");
  assert(a !== gapFingerprint([]), "empty differs");
});

test("decisions: create, touch, update, resolve across an episode", () => {
  const gap = [{ date: "2026-10-26", slot: "dinner" }];
  const fp = gapFingerprint(gap);
  eq(decideWatcher({ watcher: null, gap, fingerprint: fp, reminderState: null, scopeEnded: false }).action, "create");
  const active = { status: "active", gap_fingerprint: fp, episode: 1 };
  eq(decideWatcher({ watcher: active, gap, fingerprint: fp, reminderState: "open", scopeEnded: false }).action, "touch");
  eq(decideWatcher({ watcher: active, gap: [], fingerprint: gapFingerprint([]), reminderState: "open", scopeEnded: false }).action, "resolve");
  const bigger = [...gap, { date: "2026-10-27", slot: "dinner" }];
  eq(decideWatcher({ watcher: active, gap: bigger, fingerprint: gapFingerprint(bigger), reminderState: "open", scopeEnded: false }).action, "update");
});

test("CP-29: dismissing the reminder suppresses the same gap only", () => {
  const gap = [{ date: "2026-10-26", slot: "dinner" }];
  const fp = gapFingerprint(gap);
  const active = { status: "active", gap_fingerprint: fp, episode: 1 };
  eq(decideWatcher({ watcher: active, gap, fingerprint: fp, reminderState: "completed", scopeEnded: false }).action, "suppress");
  const suppressed = { status: "suppressed", gap_fingerprint: fp, episode: 1 };
  eq(decideWatcher({ watcher: suppressed, gap, fingerprint: fp, reminderState: null, scopeEnded: false }).action, "stay-suppressed");
  const other = [{ date: "2026-10-28", slot: "dinner" }];
  eq(decideWatcher({ watcher: suppressed, gap: other, fingerprint: gapFingerprint(other), reminderState: null, scopeEnded: false }).action, "new-episode");
});

test("CP-28: a gap after resolution is a new episode, never a resurrection", () => {
  const gap = [{ date: "2026-10-26", slot: "dinner" }];
  const resolved = { status: "resolved", gap_fingerprint: gapFingerprint(gap), episode: 1 };
  const d = decideWatcher({ watcher: resolved, gap, fingerprint: gapFingerprint(gap), reminderState: null, scopeEnded: false });
  eq(d.action, "new-episode"); eq(d.episode, 2);
});

test("scope end expires an active watcher and does nothing otherwise", () => {
  const gap = [{ date: "2026-10-26", slot: "dinner" }];
  const active = { status: "active", gap_fingerprint: gapFingerprint(gap), episode: 1 };
  eq(decideWatcher({ watcher: active, gap, fingerprint: gapFingerprint(gap), reminderState: "open", scopeEnded: true }).action, "expire");
  eq(decideWatcher({ watcher: null, gap, fingerprint: gapFingerprint(gap), reminderState: null, scopeEnded: true }).action, "none");
});

test("CP-33: the budget gap exists only when no budget record exists", () => {
  eq(computeBudgetGap({ weekStart: WEEK, budgetWeek: null }).length, 1);
  eq(computeBudgetGap({ weekStart: WEEK, budgetWeek: { amount_cents: 7500 } }).length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

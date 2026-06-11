// Unit tests for planner date utilities — chiefly expandReminders.
// Run with: node src/utils/plannerUtils.test.js
// (No test framework — plain assertions, same style as budgetProjection.test.js.)

import { expandReminders, toDateStr, parseDate, getWeekRange } from "./plannerUtils.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function datesOf(expanded) {
  return expanded.map((r) => r.date);
}

test("toDateStr ↔ parseDate round-trips", () => {
  const d = parseDate("2026-06-11");
  assert(toDateStr(d) === "2026-06-11", "round trip");
  assert(d.getMonth() === 5 && d.getDate() === 11, "local parts");
});

test("getWeekRange starts on Monday, ends on Sunday", () => {
  const { startStr, endStr } = getWeekRange(parseDate("2026-06-11")); // a Thursday
  assert(startStr === "2026-06-08", `week starts Monday, got ${startStr}`);
  assert(endStr === "2026-06-14", `week ends Sunday, got ${endStr}`);
});

test("one-time reminder appears only in its window", () => {
  const r = [{ id: "1", name: "x", date: "2026-06-10", recurrence: "none" }];
  assert(datesOf(expandReminders(r, "2026-06-08", "2026-06-14")).length === 1, "inside window");
  assert(datesOf(expandReminders(r, "2026-06-15", "2026-06-21")).length === 0, "outside window");
});

test("completed and dateless reminders are skipped", () => {
  const r = [
    { id: "1", name: "done", date: "2026-06-10", completed: true },
    { id: "2", name: "no date", date: null },
  ];
  assert(expandReminders(r, "2026-06-01", "2026-06-30").length === 0, "both skipped");
});

test("daily ×3 stops after 3 total occurrences — not 3 per window", () => {
  const r = [{ id: "1", name: "x", date: "2026-06-01", recurrence: "daily", recur_times: 3 }];
  // Window covering the series start: 3 occurrences (Jun 1–3)
  const first = datesOf(expandReminders(r, "2026-06-01", "2026-06-30"));
  assert(first.length === 3, `expected 3, got ${first.length}`);
  assert(first[2] === "2026-06-03", "last occurrence Jun 3");
  // A LATER window must show zero — the series already finished
  const later = expandReminders(r, "2026-07-01", "2026-07-31");
  assert(later.length === 0, `series exhausted — got ${later.length} in July`);
});

test("daily ×5 starting before the window shows only the remainder", () => {
  const r = [{ id: "1", name: "x", date: "2026-05-30", recurrence: "daily", recur_times: 5 }];
  // Occurrences: May 30, 31, Jun 1, 2, 3. June window should see exactly 3.
  const june = datesOf(expandReminders(r, "2026-06-01", "2026-06-30"));
  assert(june.length === 3, `expected 3 remaining, got ${june.length}`);
  assert(june[0] === "2026-06-01" && june[2] === "2026-06-03", "Jun 1–3");
});

test("daily without recur_times fills the whole window", () => {
  const r = [{ id: "1", name: "x", date: "2026-01-01", recurrence: "daily" }];
  const week = expandReminders(r, "2026-06-08", "2026-06-14");
  assert(week.length === 7, `expected 7, got ${week.length}`);
});

test("weekly ×4 exhausts after 4 weeks", () => {
  const r = [{ id: "1", name: "x", date: "2026-06-01", recurrence: "weekly", recur_times: 4 }];
  const june = datesOf(expandReminders(r, "2026-06-01", "2026-06-30"));
  assert(june.join(",") === "2026-06-01,2026-06-08,2026-06-15,2026-06-22", `got ${june.join(",")}`);
  assert(expandReminders(r, "2026-07-01", "2026-07-31").length === 0, "nothing in July");
});

test("weekly recur_until caps the series", () => {
  const r = [{ id: "1", name: "x", date: "2026-06-01", recurrence: "weekly", recur_until: "2026-06-15" }];
  const june = datesOf(expandReminders(r, "2026-06-01", "2026-06-30"));
  assert(june.join(",") === "2026-06-01,2026-06-08,2026-06-15", `got ${june.join(",")}`);
});

test("monthly ×3 exhausts after 3 months", () => {
  const r = [{ id: "1", name: "x", date: "2026-06-15", recurrence: "monthly", recur_times: 3 }];
  const all = datesOf(expandReminders(r, "2026-06-01", "2026-12-31"));
  assert(all.join(",") === "2026-06-15,2026-07-15,2026-08-15", `got ${all.join(",")}`);
  assert(expandReminders(r, "2026-09-01", "2026-09-30").length === 0, "nothing in Sept");
});

test("monthly on the 31st clamps to shorter months", () => {
  const r = [{ id: "1", name: "x", date: "2026-01-31", recurrence: "monthly" }];
  const feb = datesOf(expandReminders(r, "2026-02-01", "2026-02-28"));
  assert(feb[0] === "2026-02-28", `clamped to Feb 28, got ${feb[0]}`);
});

test("monthly recurrence still works far in the future (beyond 3 years)", () => {
  const r = [{ id: "1", name: "x", date: "2026-01-10", recurrence: "monthly" }];
  const far = datesOf(expandReminders(r, "2030-06-01", "2030-06-30"));
  assert(far.length === 1 && far[0] === "2030-06-10", `got ${far.join(",")}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

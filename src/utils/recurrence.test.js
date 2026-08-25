// Run with: node src/utils/recurrence.test.js
import assert from "node:assert/strict";
import { normalizeTime, spacedWeekdays, nextDateForWeekday, planReminderRows, weekdayIndex } from "./recurrence.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}

// 2026-07-28 is a Tuesday.
const TODAY = "2026-07-28";

test("normalizeTime reads human clock times", () => {
  assert.equal(normalizeTime("8am"), "08:00");
  assert.equal(normalizeTime("8:30 PM"), "20:30");
  assert.equal(normalizeTime("20:15"), "20:15");
  assert.equal(normalizeTime("12am"), "00:00");
  assert.equal(normalizeTime("12pm"), "12:00");
  assert.equal(normalizeTime("08:00:00"), "08:00");
  assert.equal(normalizeTime("noonish"), null);
});

test("weekdayIndex accepts names, abbreviations and numbers", () => {
  assert.equal(weekdayIndex("Tuesday"), 2);
  assert.equal(weekdayIndex("fri"), 5);
  assert.equal(weekdayIndex(0), 0);
  assert.equal(weekdayIndex("funday"), null);
});

test("spacedWeekdays spreads occurrences across the week", () => {
  assert.deepEqual(spacedWeekdays(2), [2, 5]);
  assert.deepEqual(spacedWeekdays(3), [1, 3, 5]);
  assert.deepEqual(spacedWeekdays(9), [0, 1, 2, 3, 4, 5, 6]);
});

test("nextDateForWeekday rolls forward when today's time has passed", () => {
  assert.equal(nextDateForWeekday(TODAY, 2, { time: "08:00", nowMinutes: 7 * 60 }), "2026-07-28");
  assert.equal(nextDateForWeekday(TODAY, 2, { time: "08:00", nowMinutes: 9 * 60 }), "2026-08-04");
  assert.equal(nextDateForWeekday(TODAY, 5), "2026-07-31");
});

test("twice weekly for 6 weeks at 8am → Tue + Fri weekly rows with recur_times 6", () => {
  const { rows, notes } = planReminderRows(
    { name: "Strawberry scrub", time: "8am", times_per_week: 2, weeks: 6 },
    { todayStr: TODAY, nowMinutes: 11 * 60 },
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.date), ["2026-08-04", "2026-07-31"]);
  assert.ok(rows.every((r) => r.recurrence === "weekly" && r.recur_times === 6 && r.time === "08:00"));
  assert.ok(rows.every((r) => !("weekdays" in r) && !("times_per_week" in r) && !("weeks" in r)));
  assert.ok(notes.some((n) => /tuesday \+ friday/.test(n)));
});

test("explicit weekdays win over times_per_week; recur_times is split per row", () => {
  const { rows } = planReminderRows(
    { name: "x", weekdays: ["mon", "thu"], recur_times: 12, times_per_week: 2 },
    { todayStr: TODAY },
  );
  assert.deepEqual(rows.map((r) => r.date), ["2026-08-03", "2026-07-30"]);
  assert.ok(rows.every((r) => r.recur_times === 6));
});

test("recurring reminder with no date gets a start date (tomorrow if the time passed)", () => {
  const a = planReminderRows({ name: "x", recurrence: "daily", time: "08:00" }, { todayStr: TODAY, nowMinutes: 7 * 60 });
  assert.equal(a.rows[0].date, "2026-07-28");
  const b = planReminderRows({ name: "x", recurrence: "daily", time: "08:00" }, { todayStr: TODAY, nowMinutes: 9 * 60 });
  assert.equal(b.rows[0].date, "2026-07-29");
});

test("one-off reminders pass through untouched", () => {
  const { rows, notes } = planReminderRows({ name: "Call Nick", date: "2026-08-01" }, { todayStr: TODAY });
  assert.deepEqual(rows, [{ name: "Call Nick", date: "2026-08-01" }]);
  assert.deepEqual(notes, []);
});

test("bad time and bad weekday are loud errors, not silent defaults", () => {
  assert.throws(() => planReminderRows({ name: "x", time: "morning" }, { todayStr: TODAY }), /clock time/);
  assert.throws(() => planReminderRows({ name: "x", weekdays: ["funday"] }, { todayStr: TODAY }), /weekdays/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

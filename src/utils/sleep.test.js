import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClock, formatSleepDuration, sleepDurationMinutes, sleepSummary } from "./sleep.js";

test("duration crosses midnight (Scott's first night: Nov 8 to 9, 2026)", () => {
  // 10:55 PM to 6:23 AM is 7h 28m in bed. The watch's 6h 52m is its
  // asleep-only figure; the app duration is bedtime to wake time.
  assert.equal(sleepDurationMinutes("22:55", "06:23"), 448);
});

test("duration handles bedtime after midnight and same-day naps", () => {
  assert.equal(sleepDurationMinutes("00:40", "08:00"), 440);
  assert.equal(sleepDurationMinutes("13:00", "13:45"), 45);
  assert.equal(sleepDurationMinutes("23:00", "23:00"), 1440);
});

test("duration rejects malformed times", () => {
  assert.equal(sleepDurationMinutes("", "07:00"), null);
  assert.equal(sleepDurationMinutes("24:00", "07:00"), null);
  assert.equal(sleepDurationMinutes(null, undefined), null);
});

test("duration and clock formatting", () => {
  assert.equal(formatSleepDuration(412), "6h 52m");
  assert.equal(formatSleepDuration(448), "7h 28m");
  assert.equal(formatSleepDuration(45), "45m");
  assert.equal(formatSleepDuration(120), "2h 0m");
  assert.equal(formatSleepDuration(null), "—");
  assert.equal(formatClock("22:55"), "10:55 PM");
  assert.equal(formatClock("06:23"), "6:23 AM");
  assert.equal(formatClock("00:05"), "12:05 AM");
  assert.equal(formatClock("12:00"), "12:00 PM");
  assert.equal(formatClock("bad"), "—");
});

test("summary takes last night and averages up to 7 nights", () => {
  const entries = [
    { date: "2026-11-09", durationMinutes: 412 },
    { date: "2026-11-08", durationMinutes: 400 },
    { date: "2026-11-07", durationMinutes: 500 },
  ];
  const s = sleepSummary(entries);
  assert.equal(s.lastNight.date, "2026-11-09");
  assert.equal(s.recentAverage, 437);
  assert.equal(s.recentCount, 3);
  assert.deepEqual(sleepSummary([]), { lastNight: null, recentAverage: null, recentCount: 0 });
  const eight = Array.from({ length: 8 }, (_, i) => ({ date: `2026-11-0${i + 1}`, durationMinutes: i === 0 ? 60 : 420 }));
  assert.equal(sleepSummary(eight).recentCount, 7); // the 8th night is outside the window
});

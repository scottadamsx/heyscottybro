import { test } from "node:test";
import assert from "node:assert/strict";
import { e1rm, increment, isPersonalBest, prefillSet, roundLb, sessionsFor, suggestNext } from "./overload.js";

let seq = 0;
/** session(date, "Bench", [[weight, reps], ...]) → history rows */
const session = (date, exercise, sets) => {
  const sessionId = `s-${date}-${++seq}`;
  return sets.map(([weightLb, reps], i) => ({ id: `${sessionId}-${i}`, sessionId, startedAt: `${date}T18:00:00Z`, exercise, setNumber: i + 1, reps, weightLb }));
};
const target = { sets: 3, repMin: 8, repMax: 12 };

test("first time: no weight unless the plan gives one", () => {
  assert.deepEqual(suggestNext({ history: [], exercise: "Bench", target }).weightLb, null);
  const s = suggestNext({ history: [], exercise: "Bench", target: { ...target, startWeightLb: 96 } });
  assert.equal(s.kind, "first");
  assert.equal(s.weightLb, 95);
  assert.equal(s.reps, 8);
});

test("every set at the top of the range → add weight, back to the bottom", () => {
  const history = session("2026-09-01", "Bench", [[135, 12], [135, 12], [135, 12]]);
  const s = suggestNext({ history, exercise: "bench", target });
  assert.equal(s.kind, "increase");
  assert.equal(s.weightLb, 140);
  assert.equal(s.reps, 8);
});

test("inside the range → same weight, one more rep", () => {
  const history = session("2026-09-01", "Bench", [[135, 10], [135, 9], [135, 8]]);
  const s = suggestNext({ history, exercise: "Bench", target });
  assert.equal(s.kind, "hold");
  assert.equal(s.weightLb, 135);
  assert.equal(s.reps, 11);
});

test("short of the range once → repeat the weight", () => {
  const history = session("2026-09-01", "Bench", [[135, 9], [135, 7], [135, 6]]);
  const s = suggestNext({ history, exercise: "Bench", target });
  assert.equal(s.kind, "repeat");
  assert.equal(s.weightLb, 135);
});

test("short three sessions running at the same weight → deload 10%", () => {
  const history = [
    ...session("2026-08-20", "Squat", [[225, 7], [225, 6], [225, 6]]),
    ...session("2026-08-27", "Squat", [[225, 8], [225, 7], [225, 6]]),
    ...session("2026-09-03", "Squat", [[225, 7], [225, 7], [225, 5]]),
  ];
  const s = suggestNext({ history, exercise: "Squat", target });
  assert.equal(s.kind, "deload");
  assert.equal(s.weightLb, 202.5);
});

test("only the heaviest sets count (warm-ups don't block progress)", () => {
  const history = session("2026-09-01", "Bench", [[95, 5], [135, 12], [135, 12], [135, 12]]);
  assert.equal(suggestNext({ history, exercise: "Bench", target }).kind, "increase");
});

test("the newest session wins and today's own session is ignored", () => {
  const history = [
    ...session("2026-08-01", "Row", [[100, 12], [100, 12], [100, 12]]),
    ...session("2026-09-01", "Row", [[105, 9], [105, 9], [105, 8]]),
  ];
  const today = session("2026-09-17", "Row", [[105, 12]]);
  const s = suggestNext({ history: [...history, ...today], exercise: "Row", target, excludeSessionId: today[0].sessionId });
  assert.equal(s.weightLb, 105);
  assert.equal(sessionsFor(history, "row").length, 2);
});

test("small weights step by 2.5, plates by 5; rounding to 2.5", () => {
  assert.equal(increment(15), 2.5);
  assert.equal(increment(20), 5);
  assert.equal(roundLb(101.2), 100);
  assert.equal(roundLb(-3), 0);
});

test("e1rm (Epley)", () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 133.3);
  assert.equal(e1rm(100, 0), 0);
  assert.equal(e1rm(0, 10), 0);
});

test("prefill: first set from the suggestion, later sets keep today's weight, reps beat last time", () => {
  const last = session("2026-09-01", "Bench", [[135, 10], [135, 9], [135, 8]]);
  const suggestion = suggestNext({ history: last, exercise: "Bench", target });
  const first = prefillSet({ suggestion, doneThisSession: [], lastSessionSets: last, target });
  assert.deepEqual(first, { setNumber: 1, weightLb: 135, reps: 11 });
  const second = prefillSet({ suggestion, doneThisSession: [{ setNumber: 1, weightLb: 140, reps: 8 }], lastSessionSets: last, target });
  assert.equal(second.setNumber, 2);
  assert.equal(second.weightLb, 140);
  const third = prefillSet({ suggestion, doneThisSession: [{ setNumber: 1, weightLb: 135, reps: 11 }, { setNumber: 2, weightLb: 135, reps: 10 }], lastSessionSets: last, target });
  assert.equal(third.reps, 9);
});

test("personal best compares estimated 1RM with every earlier set", () => {
  const history = session("2026-09-01", "Bench", [[135, 10], [135, 9]]);
  assert.equal(isPersonalBest(history, "Bench", { weightLb: 140, reps: 10 }), true);
  assert.equal(isPersonalBest(history, "Bench", { weightLb: 135, reps: 10 }), false);
  assert.equal(isPersonalBest([], "Bench", { weightLb: 135, reps: 10 }), false, "the very first set isn't a PR");
});

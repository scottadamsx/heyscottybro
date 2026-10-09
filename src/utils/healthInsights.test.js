import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, dailyCalories, exerciseLibraryStats, exerciseProgress, kgToLb, lbToKg, weekStart, weeklyVolume } from "./healthInsights.js";

let seq = 0;
const session = (date, exercise, sets) => {
  const sessionId = `s-${date}-${exercise}-${++seq}`;
  return sets.map(([weightLb, reps], i) => ({ sessionId, startedAt: `${date}T18:00:00`, exercise, setNumber: i + 1, reps, weightLb }));
};
const ids = (list) => list.map((i) => i.id);

test("units round-trip", () => {
  assert.equal(kgToLb(102.05828325), 225);
  assert.equal(lbToKg(225), 102.058);
});

test("weeks start on Monday", () => {
  assert.equal(weekStart("2026-09-17"), "2026-09-14");
  assert.equal(weekStart("2026-09-14"), "2026-09-14");
  assert.equal(weekStart("2026-09-13"), "2026-09-07");
});

test("progress and weekly volume", () => {
  const h = [...session("2026-09-08", "Bench", [[135, 10], [135, 10]]), ...session("2026-09-15", "Bench", [[140, 8]])];
  const [bench] = exerciseProgress(h);
  assert.equal(bench.sessions, 2);
  assert.equal(bench.best, 180);
  const vol = weeklyVolume(h, "2026-09-17", 2);
  assert.deepEqual(vol, [{ week: "2026-09-07", volume: 2700, sessions: 1 }, { week: "2026-09-14", volume: 1120, sessions: 1 }]);
});

test("exercise library derives PRs and requires an actual set to achieve the exact goal", () => {
  const exercises = [{ id: "bench", name: "Bench Press", goalWeightLb: 225, goalReps: 5, updatedAt: "2026-09-01" }];
  const history = [
    { id: "older", sessionId: "a", exercise: " bench   press ", weightLb: 225, reps: 4, loggedAt: "2026-09-01T18:00:00Z" },
    { id: "stronger-estimate", sessionId: "b", exercise: "Bench Press", weightLb: 230, reps: 4, loggedAt: "2026-09-08T18:00:00Z" },
    { id: "achieved", sessionId: "c", exercise: "BENCH PRESS", weightLb: 225, reps: 5, loggedAt: "2026-09-15T18:00:00Z" },
  ];
  const [bench] = exerciseLibraryStats(exercises, history);
  assert.equal(bench.heaviest.id, "stronger-estimate");
  assert.equal(bench.strongest.id, "achieved");
  assert.equal(bench.goalAchieved, true);
  assert.equal(bench.achievedSet.id, "achieved");
  assert.equal(bench.estimatedProgress, 100);
  assert.equal(bench.sessions, 3);

  const [withoutActualGoal] = exerciseLibraryStats(exercises, history.filter((set) => set.id !== "achieved"));
  assert.equal(withoutActualGoal.goalAchieved, false, "a heavier set with too few reps is not exact goal achievement");
  assert.equal(withoutActualGoal.estimatedProgress, 99, "equivalent-strength progress stays separate from achievement");
});

test("exercise PR ties use the newest set and removal recalculates", () => {
  const exercise = [{ id: "row", name: "Row", goalWeightLb: null, goalReps: null, updatedAt: "2026-09-01" }];
  const history = [
    { id: "old", sessionId: "a", exercise: "Row", weightLb: 100, reps: 10, loggedAt: "2026-09-01T18:00:00Z" },
    { id: "new", sessionId: "b", exercise: "Row", weightLb: 100, reps: 10, loggedAt: "2026-09-08T18:00:00Z" },
  ];
  assert.equal(exerciseLibraryStats(exercise, history)[0].strongest.id, "new");
  assert.equal(exerciseLibraryStats(exercise, history.slice(0, 1))[0].strongest.id, "old");
  assert.equal(exerciseLibraryStats(exercise, [])[0].strongest, null);
});

test("daily calories fill empty days with 0 and mark them", () => {
  const cal = dailyCalories([{ date: "2026-09-16", calories: 500 }, { date: "2026-09-16", calories: 700.4 }], "2026-09-17", 3);
  assert.deepEqual(cal, [
    { date: "2026-09-15", calories: 0, logged: false },
    { date: "2026-09-16", calories: 1200, logged: true },
    { date: "2026-09-17", calories: 0, logged: false },
  ]);
});

test("empty account gets getting-started insights, nothing invented", () => {
  const out = buildInsights({ today: "2026-09-17" });
  assert.deepEqual(ids(out).sort(), ["food-log", "no-workouts", "weigh-in"]);
});

test("a long gap is flagged first", () => {
  const out = buildInsights({ history: session("2026-09-01", "Bench", [[135, 10]]), today: "2026-09-17" });
  assert.equal(out[0].id, "gap");
  assert.match(out[0].title, /16 days/);
});

test("new best and stall are detected from sessions", () => {
  const h = [
    ...session("2026-08-20", "Squat", [[225, 8]]),
    ...session("2026-08-27", "Squat", [[225, 8]]),
    ...session("2026-09-03", "Squat", [[225, 7]]),
    ...session("2026-09-10", "Squat", [[225, 8]]),
    ...session("2026-09-01", "Bench", [[135, 8]]),
    ...session("2026-09-15", "Bench", [[145, 8]]),
  ];
  const out = buildInsights({ history: h, today: "2026-09-17" });
  assert.ok(ids(out).includes("pr-Bench"));
  assert.ok(ids(out).includes("stall-Squat"));
  assert.ok(!ids(out).includes("pr-Squat"));
});

test("weight trend judged against a cut", () => {
  const weights = [{ date: "2026-08-20", weightLb: 230 }, { date: "2026-09-17", weightLb: 226 }];
  const [trend] = buildInsights({ weights, profile: { goal: "lose", goalWeightLb: 200 }, today: "2026-09-17" }).filter((i) => i.id === "weight-trend");
  assert.equal(trend.tone, "good");
  assert.match(trend.title, /down 1\.0 lb\/week/);
  assert.match(trend.detail, /26\.0 lb to go/);
});

test("calories vs target use only finished logged days; low protein is flagged", () => {
  const foodLogs = [
    { date: "2026-09-15", calories: 3400, protein_g: 80 },
    { date: "2026-09-16", calories: 3200, protein_g: 90 },
    { date: "2026-09-17", calories: 400, protein_g: 20 },
  ];
  const out = buildInsights({ foodLogs, weights: [{ date: "2026-09-10", weightLb: 225 }], profile: { targetCalories: 2800 }, today: "2026-09-17" });
  const cal = out.find((i) => i.id === "calories");
  assert.match(cal.title, /3,300/);
  assert.equal(cal.tone, "warn");
  assert.ok(ids(out).includes("protein"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanExerciseGoal, keepExplicitStartWeights } from "./exerciseLibrary.js";

test("exercise goals require a valid weight and rep pair or clear together", () => {
  assert.deepEqual(cleanExerciseGoal({ weightLb: 225, reps: 5 }), { goal_weight_lb: 225, goal_reps: 5 });
  assert.deepEqual(cleanExerciseGoal({ weightLb: "", reps: "" }), { goal_weight_lb: null, goal_reps: null });
  assert.throws(() => cleanExerciseGoal({ weightLb: 225, reps: "" }), /weight and repetitions/i);
  assert.throws(() => cleanExerciseGoal({ weightLb: "", reps: 5 }), /weight and repetitions/i);
  assert.throws(() => cleanExerciseGoal({ weightLb: -1, reps: 5 }), /weight and repetitions/i);
  assert.throws(() => cleanExerciseGoal({ weightLb: 225, reps: 201 }), /weight and repetitions/i);
  assert.throws(() => cleanExerciseGoal({ weightLb: 225, reps: 5.5 }), /weight and repetitions/i);
});

test("AI starting weights survive only when the prompt explicitly supplied them", () => {
  const exercises = [
    { name: "Straight Arm Pulldown", startWeightLb: 60 },
    { name: "Bench Press", startWeightLb: 135 },
    { name: "Row" },
  ];
  assert.deepEqual(keepExplicitStartWeights(exercises, "pulldowns with 60 lbs"), [
    { name: "Straight Arm Pulldown", startWeightLb: 60 },
    { name: "Bench Press" },
    { name: "Row" },
  ]);
  assert.equal(keepExplicitStartWeights([{ name: "Bench", startWeightLb: 225.5 }], "Bench at 225.5 pounds")[0].startWeightLb, 225.5);
});

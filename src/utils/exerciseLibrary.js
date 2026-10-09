/** Validate the paired performance goal stored on an exercise-library record. */
export function cleanExerciseGoal({ weightLb, reps } = {}) {
  const clearing = (weightLb == null || weightLb === "") && (reps == null || reps === "");
  if (clearing) return { goal_weight_lb: null, goal_reps: null };
  const weight = Math.round(Number(weightLb) * 100) / 100;
  const repetitions = Number(reps);
  if (!(weight > 0 && weight <= 2000) || !Number.isInteger(repetitions) || !(repetitions >= 1 && repetitions <= 200)) {
    throw new Error("Enter a goal weight and repetitions.");
  }
  return { goal_weight_lb: weight, goal_reps: repetitions };
}

/** Keep AI starting weights only when that exact pound value exists in the user's text. */
export function keepExplicitStartWeights(exercises = [], prompt = "") {
  const supplied = new Set(
    [...String(prompt).matchAll(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/gi)]
      .map((match) => Number(match[1]))
      .filter((value) => value > 0),
  );
  return exercises.map((exercise) => {
    const weight = Number(exercise?.startWeightLb);
    if (!(weight > 0) || supplied.has(weight)) return exercise;
    const { startWeightLb: _ignored, ...withoutInventedWeight } = exercise;
    return withoutInventedWeight;
  });
}

// src/utils/overload.js — what to lift next (Health, DR-018). Pure and tested.
//
// Double progression: work inside a rep range at one weight; once every working set
// reaches the top of the range, add weight and start again at the bottom. Three
// sessions in a row short of the bottom of the range at the same weight = deload 10%.
//
// history: [{ sessionId, startedAt (ISO), exercise, setNumber, reps, weightLb }]
// target:  { sets, repMin, repMax } (a plan's exercise; defaults below)

export const DEFAULT_TARGET = { sets: 3, repMin: 8, repMax: 12, restSec: 90 };
const DELOAD = 0.9;

const norm = (name) => String(name || "").trim().toLowerCase();
export const sameExercise = (a, b) => norm(a) === norm(b);

/** Plate-friendly jump: 5 lb from 20 lb up, 2.5 lb below that. */
export function increment(weightLb) {
  return weightLb >= 20 ? 5 : 2.5;
}

/** Round to the nearest 2.5 lb (what the gym actually has). */
export const roundLb = (w) => Math.max(0, Math.round(w / 2.5) * 2.5);

/** Estimated one-rep max (Epley). 0 reps = nothing lifted. */
export function e1rm(weightLb, reps) {
  if (!(reps > 0) || !(weightLb > 0)) return 0;
  if (reps === 1) return weightLb;
  return Math.round(weightLb * (1 + reps / 30) * 10) / 10;
}

/** Past sessions for one exercise, newest first: [{ sessionId, startedAt, sets: [...] }]. */
export function sessionsFor(history, exercise, { excludeSessionId } = {}) {
  const by = new Map();
  for (const s of history) {
    if (!sameExercise(s.exercise, exercise) || s.sessionId === excludeSessionId) continue;
    if (!by.has(s.sessionId)) by.set(s.sessionId, { sessionId: s.sessionId, startedAt: s.startedAt, sets: [] });
    by.get(s.sessionId).sets.push(s);
  }
  return [...by.values()]
    .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.setNumber - b.setNumber) }))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

const topWeight = (sets) => Math.max(0, ...sets.map((s) => Number(s.weightLb) || 0));
const atTop = (sets) => {
  const w = topWeight(sets);
  return sets.filter((s) => Number(s.weightLb) === w);
};

/**
 * The plan for this exercise today: { weightLb, reps, reason, kind }.
 * kind: "first" | "increase" | "hold" | "repeat" | "deload".
 * weightLb is null when there's nothing to go on (first time, no starting weight).
 */
export function suggestNext({ history, exercise, target = {}, excludeSessionId } = {}) {
  const t = { ...DEFAULT_TARGET, ...target };
  const past = sessionsFor(history || [], exercise, { excludeSessionId });
  if (!past.length) {
    return {
      kind: "first",
      weightLb: t.startWeightLb > 0 ? roundLb(t.startWeightLb) : null,
      reps: t.repMin,
      reason: `First time — pick a weight you can lift for ${t.repMin}–${t.repMax} clean reps.`,
    };
  }
  const last = past[0];
  const w = topWeight(last.sets);
  const top = atTop(last.sets);
  const need = Math.min(t.sets, Math.max(top.length, 1));

  // Stalled: the last three sessions all at this weight, each with a set short of the range.
  const recent = past.slice(0, 3);
  const stalled = recent.length === 3
    && recent.every((p) => topWeight(p.sets) === w && atTop(p.sets).some((s) => s.reps < t.repMin));
  if (stalled && w > 0) {
    const down = roundLb(w * DELOAD);
    return {
      kind: "deload",
      weightLb: down,
      reps: t.repMin,
      reason: `Short of ${t.repMin} reps at ${w} lb three times running — drop to ${down} lb and build back up.`,
    };
  }

  const hitTop = top.length >= need && top.length >= Math.min(t.sets, last.sets.length) && top.every((s) => s.reps >= t.repMax);
  if (hitTop && w > 0) {
    const up = roundLb(w + increment(w));
    return {
      kind: "increase",
      weightLb: up,
      reps: t.repMin,
      reason: `You got ${t.repMax}+ on every set at ${w} lb last time — go up to ${up} lb.`,
    };
  }

  if (top.some((s) => s.reps < t.repMin)) {
    return {
      kind: "repeat",
      weightLb: w,
      reps: t.repMin,
      reason: `Last time some sets at ${w} lb fell short of ${t.repMin} — stay at ${w} lb and get every set to ${t.repMin}.`,
    };
  }

  const best = Math.max(...top.map((s) => s.reps));
  return {
    kind: "hold",
    weightLb: w,
    reps: Math.min(t.repMax, best + 1),
    reason: `Stay at ${w} lb and beat last time by a rep (up to ${t.repMax}) before adding weight.`,
  };
}

/**
 * Prefill for the next set in a live workout.
 * doneThisSession: sets of this exercise already logged today (any order).
 * Uses today's last weight once a set is logged (you set it for a reason), and aims for
 * one rep more than the same set last time, within the range.
 */
export function prefillSet({ suggestion, doneThisSession = [], lastSessionSets = [], target = {} }) {
  const t = { ...DEFAULT_TARGET, ...target };
  const setNumber = doneThisSession.length + 1;
  const logged = [...doneThisSession].sort((a, b) => a.setNumber - b.setNumber);
  const lastToday = logged[logged.length - 1];
  const weightLb = lastToday ? Number(lastToday.weightLb) : suggestion?.weightLb ?? null;
  let reps = suggestion?.reps ?? t.repMin;
  const sameSetLastTime = lastSessionSets.find((s) => s.setNumber === setNumber);
  if (suggestion?.kind === "hold" && sameSetLastTime && Number(sameSetLastTime.weightLb) === weightLb) {
    reps = Math.min(t.repMax, sameSetLastTime.reps + 1);
  }
  return { setNumber, weightLb, reps };
}

/** Is this set a new best estimated 1RM for the exercise (compared with all earlier sets)? */
export function isPersonalBest(history, exercise, set, { excludeSetId } = {}) {
  const score = e1rm(Number(set.weightLb), set.reps);
  if (!score) return false;
  const previous = (history || [])
    .filter((s) => sameExercise(s.exercise, exercise) && s.id !== excludeSetId)
    .map((s) => e1rm(Number(s.weightLb), s.reps));
  return previous.length > 0 && score > Math.max(...previous);
}

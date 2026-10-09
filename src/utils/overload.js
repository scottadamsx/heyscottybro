// src/utils/overload.js — what to lift next (Health, DR-018). Pure and tested.
//
// Conservative double progression: use up to six sessions, add reps at one weight,
// require two top-range sessions before one loadable step, and lower one step only
// after two poor sessions. Optional RPE and a personal training gap can brake a jump.
//
// history: [{ sessionId, startedAt (ISO), exercise, setNumber, reps, weightLb }]
// target:  { sets, repMin, repMax } (a plan's exercise; defaults below)

import { loadableTotal } from "./plates.js";

export const DEFAULT_TARGET = { sets: 3, repMin: 8, repMax: 12, restSec: 90 };
export const PROGRESSION_HISTORY_LIMIT = 6;

const norm = (name) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
export const sameExercise = (a, b) => norm(a) === norm(b);

/** Plate-friendly jump: 5 lb from 20 lb up, 2.5 lb below that. */
export function increment(weightLb) {
  return weightLb >= 20 ? 5 : 2.5;
}

/** Round to the nearest 2.5 lb (what the gym actually has). */
export const roundLb = (w) => Math.max(0, Math.round(w / 2.5) * 2.5);

/** On a barbell the plates come in pairs, so totals move in 5 lb steps from the bar. */
const roundFor = (w, t) => (t?.barbell ? loadableTotal(w, t.barLb) : roundLb(w));

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
    if (!sameExercise(s.exercise, exercise) || s.sessionId === excludeSessionId || s.endedAt === null) continue;
    if (!by.has(s.sessionId)) by.set(s.sessionId, { sessionId: s.sessionId, startedAt: s.startedAt, sets: [] });
    by.get(s.sessionId).sets.push(s);
  }
  return [...by.values()]
    .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.setNumber - b.setNumber) }))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

const dayMs = 86_400_000;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const uniqueSets = (sets) => {
  const byNumber = new Map();
  for (const set of sets) {
    const key = Number(set.setNumber) || byNumber.size + 1;
    const previous = byNumber.get(key);
    if (!previous || String(set.loggedAt || "") >= String(previous.loggedAt || "")) byNumber.set(key, set);
  }
  return [...byNumber.values()].sort((a, b) => a.setNumber - b.setNumber);
};

/** The repeated heaviest load is treated as working weight; one-off lighter sets are warm-ups. */
function summarizeSession(session, target) {
  const t = { ...DEFAULT_TARGET, ...target };
  const sets = uniqueSets(session.sets).filter((set) => Number(set.weightLb) > 0);
  const byWeight = new Map();
  for (const set of sets) {
    const weight = Number(set.weightLb);
    if (!byWeight.has(weight)) byWeight.set(weight, []);
    byWeight.get(weight).push(set);
  }
  const repeatedMinimum = Math.min(2, t.sets);
  const repeatedWeights = [...byWeight.entries()].filter(([, rows]) => rows.length >= repeatedMinimum).map(([weight]) => weight);
  const workingWeight = Math.max(0, ...(repeatedWeights.length ? repeatedWeights : [...byWeight.keys()]));
  const workingSets = (byWeight.get(workingWeight) || []).slice(0, t.sets);
  const reps = workingSets.map((set) => Number(set.reps) || 0);
  const rpes = workingSets.map((set) => Number(set.rpe)).filter((value) => Number.isFinite(value));
  const complete = workingSets.length >= t.sets;
  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    weightLb: workingWeight || null,
    reps,
    completedSets: workingSets.length,
    totalReps: reps.reduce((sum, value) => sum + value, 0),
    bestE1rm: Math.max(0, ...workingSets.map((set) => e1rm(Number(set.weightLb), Number(set.reps)))),
    rpeCount: rpes.length,
    averageRpe: rpes.length ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10 : null,
    maxRpe: rpes.length ? Math.max(...rpes) : null,
    complete,
    atTop: complete && reps.every((value) => value >= t.repMax),
    poor: !complete || reps.some((value) => value < t.repMin),
    highEffort: complete && rpes.length >= t.sets && Math.max(...rpes) > 9,
  };
}

export function progressionHistory({ history, exercise, target = {}, excludeSessionId, now = Date.now() } = {}) {
  const raw = sessionsFor(history || [], exercise, { excludeSessionId }).slice(0, PROGRESSION_HISTORY_LIMIT);
  const sessions = raw.map((session) => summarizeSession(session, target)).filter((session) => session.weightLb != null);
  const dates = sessions.map((session) => new Date(session.startedAt).getTime()).filter(Number.isFinite);
  const intervals = dates.slice(0, -1).map((value, index) => Math.abs(value - dates[index + 1]) / dayMs).filter((value) => value > 0);
  const typicalGapDays = intervals.length >= 2 ? median(intervals) : null;
  const daysSinceLast = dates.length ? Math.max(0, (Number(now) - dates[0]) / dayMs) : null;
  const gap = typicalGapDays != null && daysSinceLast > typicalGapDays * 2;
  const confidence = gap || sessions.length < 2 ? "low" : sessions.length >= 4 ? "high" : "medium";
  return { sessions, confidence, gap, daysSinceLast, typicalGapDays };
}

/**
 * The plan for this exercise today: { weightLb, reps, reason, kind }.
 * kind: "first" | "increase" | "hold" | "repeat" | "reduce".
 * weightLb is null when there's nothing to go on (first time, no starting weight).
 */
export function suggestNext({ history, exercise, target = {}, excludeSessionId, now } = {}) {
  const t = { ...DEFAULT_TARGET, ...target };
  const evidence = progressionHistory({ history, exercise, target: t, excludeSessionId, now });
  const past = evidence.sessions;
  if (!past.length) {
    return {
      kind: "first",
      weightLb: t.startWeightLb > 0 ? roundFor(t.startWeightLb, t) : null,
      reps: t.repMin,
      reason: `First time — pick a weight you can lift for ${t.repMin}–${t.repMax} clean reps.`,
      ...evidence,
    };
  }
  const last = past[0];
  const w = last.weightLb;
  if (evidence.gap) {
    return {
      kind: "hold",
      weightLb: w,
      reps: t.repMin,
      reason: `Repeat ${w} lb after a longer-than-usual break; use today's first set to adjust if needed.`,
      ...evidence,
    };
  }

  const previous = past[1];
  const twoTopSessions = last.atTop && previous?.atTop && previous.weightLb === w;
  if (twoTopSessions && !last.highEffort && !previous.highEffort && w > 0) {
    const step = t.barbell ? 5 : increment(w);
    const up = roundFor(w + step, t);
    const increasePercent = Math.round(((up - w) / w) * 1000) / 10;
    if (up > w && increasePercent <= 10) {
      return {
        kind: "increase",
        weightLb: up,
        reps: t.repMin,
        increasePercent,
        reason: `You reached ${t.repMax}+ on every planned set twice — add one ${Math.round((up - w) * 100) / 100} lb step (${increasePercent}%).`,
        ...evidence,
      };
    }
    return {
      kind: "hold",
      weightLb: w,
      reps: t.repMax,
      reason: `Keep ${w} lb: the smallest available increase would exceed 10%.`,
      ...evidence,
    };
  }

  if (last.atTop && last.highEffort) {
    return {
      kind: "hold",
      weightLb: w,
      reps: t.repMax,
      reason: `Keep ${w} lb once more: the completed session was above RPE 9.`,
      ...evidence,
    };
  }

  const poorStreak = past.findIndex((session) => !session.poor);
  const consecutivePoor = poorStreak === -1 ? past.length : poorStreak;
  if (consecutivePoor >= 2) {
    const step = t.barbell ? 5 : increment(w);
    const down = roundFor(Math.max(0, w - step), t);
    return {
      kind: "reduce",
      weightLb: down,
      reps: t.repMin,
      reason: `Two sessions fell short of ${t.repMin} reps or planned sets — lower one step to ${down} lb and rebuild.`,
      ...evidence,
    };
  }

  if (last.poor) {
    return {
      kind: "repeat",
      weightLb: w,
      reps: t.repMin,
      reason: `One session fell short of ${t.repMin} reps or planned sets — repeat ${w} lb before changing it.`,
      ...evidence,
    };
  }

  const best = Math.max(...last.reps);
  return {
    kind: "hold",
    weightLb: w,
    reps: Math.min(t.repMax, best + 1),
    reason: last.atTop
      ? `Repeat ${w} lb: one more top-range session is needed before adding weight.`
      : `Stay at ${w} lb and add one rep where you can (up to ${t.repMax}) before adding weight.`,
    ...evidence,
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

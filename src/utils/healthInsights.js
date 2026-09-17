// src/utils/healthInsights.js — what the numbers say (Health, DR-018). Pure and tested.
// Every insight is computed from saved data and names the numbers behind it; the AI
// "coach" only ever sees these results, never raw guesses.
import { e1rm, sessionsFor } from "./overload.js";

export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg) => Math.round((Number(kg) / KG_PER_LB) * 10) / 10;
export const lbToKg = (lb) => Math.round(Number(lb) * KG_PER_LB * 1000) / 1000;

const DAY = 86400000;
const dayStr = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
/** Monday of the week containing `day` (local). */
export function weekStart(day) {
  const d = parseDay(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayStr(d);
}

/** Per-exercise progress: best e1RM per session, newest last. */
export function exerciseProgress(history) {
  const names = new Map();
  for (const s of history) {
    const k = s.exercise.trim().toLowerCase();
    if (!names.has(k)) names.set(k, s.exercise.trim());
  }
  return [...names.values()].map((exercise) => {
    const sessions = sessionsFor(history, exercise).reverse();
    const points = sessions.map((p) => ({
      date: dayStr(p.startedAt),
      best: Math.max(0, ...p.sets.map((s) => e1rm(Number(s.weightLb), s.reps))),
      topWeight: Math.max(0, ...p.sets.map((s) => Number(s.weightLb) || 0)),
      volume: p.sets.reduce((a, s) => a + (Number(s.weightLb) || 0) * s.reps, 0),
    }));
    const best = Math.max(0, ...points.map((p) => p.best));
    return { exercise, sessions: points.length, best, lastDate: points.at(-1)?.date ?? null, points };
  }).sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)));
}

/** Weekly training volume (lb × reps) and session count, for the last `weeks` weeks ending this week. */
export function weeklyVolume(history, today, weeks = 6) {
  const out = [];
  let start = weekStart(today);
  for (let i = 0; i < weeks; i++) {
    out.unshift({ week: start, volume: 0, sessions: new Set() });
    const d = parseDay(start); d.setDate(d.getDate() - 7); start = dayStr(d);
  }
  const index = new Map(out.map((w) => [w.week, w]));
  for (const s of history) {
    const w = index.get(weekStart(dayStr(s.startedAt)));
    if (!w) continue;
    w.volume += (Number(s.weightLb) || 0) * s.reps;
    w.sessions.add(s.sessionId);
  }
  return out.map((w) => ({ week: w.week, volume: Math.round(w.volume), sessions: w.sessions.size }));
}

/** Calories per day for the last `days` days ending today (0 for days with nothing logged). */
export function dailyCalories(foodLogs, today, days = 14) {
  const totals = new Map();
  for (const f of foodLogs) totals.set(f.date, (totals.get(f.date) || 0) + (Number(f.calories) || 0));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = parseDay(today); d.setDate(d.getDate() - i);
    const key = dayStr(d);
    out.push({ date: key, calories: Math.round(totals.get(key) || 0), logged: totals.has(key) });
  }
  return out;
}

/**
 * The insight list. Inputs:
 *  history   workout sets (overload.js shape), foodLogs [{date, calories, protein_g}],
 *  weights   [{date, weightLb}], profile { goal, targetCalories, goalWeightLb }, today "YYYY-MM-DD"
 * Returns [{ id, tone: good|warn|info, title, detail }] — most useful first.
 */
export function buildInsights({ history = [], foodLogs = [], weights = [], profile = {}, today }) {
  const out = [];
  const progress = exerciseProgress(history);
  const sessionDays = [...new Set(history.map((s) => dayStr(s.startedAt)))].sort();
  const lastDay = sessionDays.at(-1);

  // Training frequency
  if (!lastDay) {
    out.push({ id: "no-workouts", tone: "info", title: "No workouts logged yet", detail: "Start a workout and log each set — suggestions and progress tracking build from there." });
  } else {
    const gap = daysBetween(lastDay, today);
    const vol = weeklyVolume(history, today, 4);
    const perWeek = vol.reduce((a, w) => a + w.sessions, 0) / vol.length;
    if (gap >= 7) out.push({ id: "gap", tone: "warn", title: `${gap} days since your last workout`, detail: `Last session was ${lastDay}. Strength holds for a couple of weeks, but momentum doesn't — get one in this week.` });
    else out.push({ id: "frequency", tone: perWeek >= 3 ? "good" : "info", title: `${perWeek.toFixed(1)} workouts a week (last 4 weeks)`, detail: perWeek >= 3 ? "That's enough frequency to keep progressing." : "Three sessions a week is where most progress comes from; add one if you can." });
    const [prev, cur] = vol.slice(-2);
    if (prev.volume > 0 && cur.volume > 0) {
      const pct = Math.round(((cur.volume - prev.volume) / prev.volume) * 100);
      out.push({ id: "volume", tone: pct >= 0 ? "good" : "info", title: `Volume ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% on last week`, detail: `${cur.volume.toLocaleString()} lb lifted this week vs ${prev.volume.toLocaleString()} lb last week.` });
    }
  }

  // Lifts: new bests and stalls
  for (const p of progress) {
    const pts = p.points;
    if (pts.length >= 2) {
      const latest = pts.at(-1);
      const before = Math.max(...pts.slice(0, -1).map((x) => x.best));
      if (latest.best > before && daysBetween(latest.date, today) <= 14) {
        out.push({ id: `pr-${p.exercise}`, tone: "good", title: `New best on ${p.exercise}`, detail: `Estimated 1-rep max ${latest.best} lb (was ${before} lb) on ${latest.date}.` });
      }
    }
    if (pts.length >= 3) {
      const last3 = pts.slice(-3);
      const earlier = pts.length > 3 ? Math.max(...pts.slice(0, -3).map((x) => x.best)) : last3[0].best;
      const noGain = last3.every((x) => x.best <= earlier) && last3.every((x) => x.topWeight === last3[0].topWeight);
      if (noGain && daysBetween(last3[0].date, today) <= 42) {
        out.push({ id: `stall-${p.exercise}`, tone: "warn", title: `${p.exercise} has stalled`, detail: `Three sessions at ${last3[0].topWeight} lb without beating ${earlier} lb estimated max. Try a 10% deload, a different rep range, or more sleep and protein.` });
      }
    }
  }

  // Body weight
  const ws = [...weights].filter((w) => w.weightLb > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (ws.length >= 2) {
    const latest = ws.at(-1);
    const base = [...ws].reverse().find((w) => daysBetween(w.date, latest.date) >= 14) || ws[0];
    const days = Math.max(1, daysBetween(base.date, latest.date));
    const perWeek = ((latest.weightLb - base.weightLb) / days) * 7;
    const pctPerWeek = (perWeek / base.weightLb) * 100;
    const dir = perWeek < 0 ? "down" : "up";
    let tone = "info";
    let advice = "";
    if (profile.goal === "lose") {
      if (pctPerWeek <= -0.25 && pctPerWeek >= -1.1) { tone = "good"; advice = "A steady, sustainable rate for keeping muscle."; }
      else if (pctPerWeek < -1.1) { tone = "warn"; advice = "Faster than about 1% a week risks losing muscle — eat a bit more, keep protein high."; }
      else { tone = "warn"; advice = "Not moving down yet — tighten calories or add activity."; }
    }
    out.push({ id: "weight-trend", tone, title: `Weight ${dir} ${Math.abs(perWeek).toFixed(1)} lb/week`, detail: `${base.weightLb} lb on ${base.date} → ${latest.weightLb} lb on ${latest.date}.${advice ? ` ${advice}` : ""}${profile.goalWeightLb ? ` Goal: ${profile.goalWeightLb} lb (${Math.abs(latest.weightLb - profile.goalWeightLb).toFixed(1)} lb to go).` : ""}` });
    if (daysBetween(latest.date, today) > 10) out.push({ id: "weigh-in", tone: "info", title: "Time for a weigh-in", detail: `Last one was ${latest.date}. Weekly weigh-ins keep the trend honest.` });
  } else if (ws.length < 2) {
    out.push({ id: "weigh-in", tone: "info", title: "Log your weight", detail: "Two or more weigh-ins show your trend and whether your calories are working." });
  }

  // Calories
  const cal = dailyCalories(foodLogs, today, 7);
  const loggedDays = cal.filter((d) => d.logged && d.date !== today);
  if (loggedDays.length === 0) {
    out.push({ id: "food-log", tone: "info", title: "No food logged this week", detail: "Log meals (a quick description is enough — AI estimates the calories) to see if you're on target." });
  } else if (profile.targetCalories > 0) {
    const avg = Math.round(loggedDays.reduce((a, d) => a + d.calories, 0) / loggedDays.length);
    const diff = avg - profile.targetCalories;
    const tone = Math.abs(diff) <= profile.targetCalories * 0.1 ? "good" : "warn";
    out.push({ id: "calories", tone, title: `Averaging ${avg.toLocaleString()} kcal a day`, detail: `${loggedDays.length} of the last 6 days logged; target ${profile.targetCalories.toLocaleString()} (${diff >= 0 ? "+" : ""}${diff.toLocaleString()}).${loggedDays.length < 4 ? " Log more days for a reliable average." : ""}` });
    const proteinDays = foodLogs.filter((f) => loggedDays.some((d) => d.date === f.date));
    const protein = proteinDays.reduce((a, f) => a + (Number(f.protein_g) || 0), 0) / loggedDays.length;
    const latestLb = ws.at(-1)?.weightLb;
    if (latestLb && protein > 0 && protein < latestLb * 0.7) {
      out.push({ id: "protein", tone: "warn", title: `Protein around ${Math.round(protein)} g a day`, detail: `For building strength aim for roughly ${Math.round(latestLb * 0.7)}–${Math.round(latestLb)} g (0.7–1 g per lb).` });
    }
  }

  const rank = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

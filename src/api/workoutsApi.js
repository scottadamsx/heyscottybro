// src/api/workoutsApi.js — workout logs for the Gym Tracker tool.
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function loadWorkouts() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkout({ date, exercise, weight = 0, reps = 0, sets = 1, notes = "" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("workouts")
    .insert({ user_id: userId, date, exercise: exercise.trim(), weight, reps, sets, notes })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw error;
}

// ── Derived: per-exercise PR (heaviest set) + a simple progression series ─────
export function exerciseSummary(rows = []) {
  const byExercise = {};
  for (const w of rows) {
    const key = (w.exercise || "—").trim();
    (byExercise[key] ||= []).push(w);
  }
  return Object.entries(byExercise)
    .map(([exercise, logs]) => {
      const sorted = logs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const pr = logs.reduce((best, w) => (Number(w.weight) > Number(best?.weight ?? -1) ? w : best), null);
      const est1rm = pr ? Math.round(Number(pr.weight) * (1 + Number(pr.reps || 0) / 30)) : 0; // Epley
      return {
        exercise,
        count: logs.length,
        pr,
        est1rm,
        last: sorted[sorted.length - 1],
        series: sorted.map((w) => ({ date: w.date, weight: Number(w.weight) || 0, reps: Number(w.reps) || 0 })),
      };
    })
    .sort((a, b) => b.count - a.count);
}

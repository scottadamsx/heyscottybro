// src/api/gradesApi.js — assessments for the Grade Tracker tool.
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function loadGrades() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("grades")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGrade({ course = "", name, earned = null, max = 100, weight = 0, feedback = "" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("grades")
    .insert({ user_id: userId, course, name, earned, max, weight, feedback })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateGrade(id, fields) {
  const { data, error } = await supabase.from("grades").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGrade(id) {
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) throw error;
}

// ── Derived figures, shared by the UI ────────────────────────────────────────
// Weighted average over GRADED assessments only; projected final assumes the
// remaining (ungraded) weight earns the same percentage you're averaging now.
export function gradeStats(rows = []) {
  const graded = rows.filter((r) => r.earned != null && Number(r.max) > 0 && Number(r.weight) > 0);
  const earnedWeight = graded.reduce((s, r) => s + Number(r.weight), 0);
  const weightedPoints = graded.reduce((s, r) => s + (Number(r.earned) / Number(r.max)) * Number(r.weight), 0);
  const currentPct = earnedWeight > 0 ? (weightedPoints / earnedWeight) * 100 : null;     // your average so far
  const totalWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  // Points already banked toward the final mark (as % of the whole course).
  const earnedOfFinal = weightedPoints; // each weight is already a % of the final
  const remainingWeight = Math.max(0, totalWeight - earnedWeight);
  const projectedFinal = currentPct != null ? earnedOfFinal + (currentPct / 100) * remainingWeight : null;
  return { currentPct, projectedFinal, totalWeight, earnedWeight, remainingWeight, gradedCount: graded.length };
}

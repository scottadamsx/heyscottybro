// src/api/gradesApi.js — assessments for the Grade Tracker tool.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";


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

// Columns a caller may set. course_id is what the School space scopes on —
// dropping it here (as this once did) silently orphaned every new assessment.
const WRITABLE = ["course_id", "course", "name", "earned", "max", "weight", "feedback", "sort_order"];
const pick = (fields) => Object.fromEntries(Object.entries(fields || {}).filter(([k]) => WRITABLE.includes(k)));

export async function createGrade({ course_id = null, course = "", name, earned = null, max = 100, weight = 0, feedback = "" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("grades")
    .insert({ user_id: userId, course_id, course, name, earned, max, weight, feedback })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateGrade(id, fields) {
  const { data, error } = await supabase.from("grades").update(pick(fields)).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGrade(id) {
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) throw error;
}

// ── Derived figures, shared by the UI ────────────────────────────────────────
// Weighted average over GRADED, WEIGHTED assessments; projected final assumes
// the remaining assigned weight earns the same percentage you're averaging now.
// Nothing here is silently coerced: weights that don't add to 100, graded rows
// with no weight, and a projection that had to be capped all come back as
// `notes` (plain sentences) plus flags, and the UI renders them next to the
// figure (QF-6: a displayed metric must be honest about what it measures).
const r1 = (n) => Math.round(n * 10) / 10;

export function gradeStats(rows = []) {
  const weightOf = (r) => Number(r.weight) || 0;
  const isGraded = (r) => r.earned != null && r.earned !== "" && Number(r.max) > 0;
  const graded = rows.filter((r) => isGraded(r) && weightOf(r) > 0);
  const unweighted = rows.filter((r) => isGraded(r) && weightOf(r) <= 0);
  const earnedWeight = graded.reduce((s, r) => s + weightOf(r), 0);
  const weightedPoints = graded.reduce((s, r) => s + (Number(r.earned) / Number(r.max)) * weightOf(r), 0);
  const currentPct = earnedWeight > 0 ? (weightedPoints / earnedWeight) * 100 : null;     // your average so far
  const weightTotal = r1(rows.reduce((s, r) => s + weightOf(r), 0));
  const unassignedWeight = r1(Math.max(0, 100 - weightTotal));
  const overWeight = weightTotal > 100;
  // Points already banked toward the final mark (each weight is a % of the final).
  const remainingWeight = Math.max(0, weightTotal - earnedWeight);
  let projectedFinal = currentPct != null ? weightedPoints + (currentPct / 100) * remainingWeight : null;
  let projectionClamped = false;
  if (projectedFinal != null && projectedFinal > 100) { projectedFinal = 100; projectionClamped = true; }

  const notes = [];
  if (rows.length && overWeight) notes.push(`weights total ${weightTotal}% — more than 100%, so the projection is not meaningful until they're corrected`);
  else if (rows.length && unassignedWeight > 0) notes.push(`weights total ${weightTotal}% — ${unassignedWeight}% unassigned, so the projection assumes that share earns nothing`);
  if (unweighted.length) notes.push(`${unweighted.length} graded assessment${unweighted.length === 1 ? " has" : "s have"} no weight and ${unweighted.length === 1 ? "isn't" : "aren't"} counted in the average`);
  if (projectionClamped) notes.push("projection capped at 100%");

  return {
    currentPct, projectedFinal, projectionClamped,
    totalWeight: weightTotal, weightTotal, unassignedWeight, overWeight,
    earnedWeight, remainingWeight,
    gradedCount: graded.length, unweightedCount: unweighted.length,
    notes,
  };
}

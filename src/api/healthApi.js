// src/api/healthApi.js — the Health space (Achilles, DR-018): body weight, food, targets,
// workout plans, live workouts and sets. Every call throws with context on failure (QF-3);
// nothing falls back to local storage.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { emitDataChange } from "../utils/dataEvents";
import { toDateStr } from "../utils/dates";
import { kgToLb, lbToKg } from "../utils/healthInsights";
import { DEFAULT_TARGET } from "../utils/overload";

const fail = (what, error) => {
  throw new Error(`Couldn't ${what}: ${error.message}`, { cause: error });
};
const changed = () => emitDataChange("health");

async function allRows(build, what) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) fail(what, error);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// ── Profile & targets (nutrition_profiles: one row for Scott) ─────────────────

const PROFILE_FIELDS = ["target_calories", "goal", "goal_weight_kg", "start_weight_kg", "height_cm", "activity_level", "sex", "birth_year"];

let profileLoad = null;
export function loadProfile() {
  // One request at a time: two first loads at once must not race to create the profile.
  if (!profileLoad) profileLoad = fetchProfile().finally(() => { profileLoad = null; });
  return profileLoad;
}

async function fetchProfile() {
  const userId = await uid();
  const read = () => supabase.from("nutrition_profiles").select("*").eq("user_id", userId).limit(1);
  const { data, error } = await read();
  if (error) fail("load your health profile", error);
  if (data[0]) return shapeProfile(data[0]);
  // One profile per user (unique index): if another tab created it first, keep theirs.
  const { error: e2 } = await supabase.from("nutrition_profiles")
    .upsert({ user_id: userId, name: "Me", goal: "maintain" }, { onConflict: "user_id", ignoreDuplicates: true });
  if (e2) fail("create your health profile", e2);
  const { data: again, error: e3 } = await read();
  if (e3) fail("load your health profile", e3);
  if (!again[0]) throw new Error("Couldn't create your health profile.");
  return shapeProfile(again[0]);
}

const shapeProfile = (p) => ({
  id: p.id,
  goal: p.goal || "maintain",
  targetCalories: p.target_calories || null,
  goalWeightLb: p.goal_weight_kg ? kgToLb(p.goal_weight_kg) : null,
  startWeightLb: p.start_weight_kg ? kgToLb(p.start_weight_kg) : null,
  raw: p,
});

/** fields: { targetCalories, goal, goalWeightLb } */
export async function updateTargets(profileId, { targetCalories, goal, goalWeightLb }) {
  const patch = {
    target_calories: targetCalories ? Math.round(targetCalories) : null,
    goal,
    goal_weight_kg: goalWeightLb ? lbToKg(goalWeightLb) : null,
  };
  for (const k of Object.keys(patch)) if (!PROFILE_FIELDS.includes(k)) delete patch[k];
  const { error } = await supabase.from("nutrition_profiles").update(patch).eq("id", profileId);
  if (error) fail("save your targets", error);
  changed();
}

// ── Body weight (weight_logs; kg in the table, lb everywhere else) ─────────────

export async function loadWeights(profileId) {
  const rows = await allRows(() => supabase.from("weight_logs").select("id, date, weight_kg, note").eq("profile_id", profileId).order("date"), "load your weigh-ins");
  return rows.map((r) => ({ id: r.id, date: r.date, weightLb: kgToLb(r.weight_kg), note: r.note || "" }));
}

/** One weigh-in per day: saving the same date replaces it. */
export async function saveWeight(profileId, { date, weightLb, note = "" }) {
  if (!(weightLb > 0 && weightLb < 1000)) throw new Error("Enter your weight in pounds.");
  const userId = await uid();
  const { error } = await supabase.from("weight_logs")
    .upsert({ user_id: userId, profile_id: profileId, date: date || toDateStr(), weight_kg: lbToKg(weightLb), note }, { onConflict: "profile_id,date" });
  if (error) fail("save your weight", error);
  changed();
}

export async function deleteWeight(id) {
  const { error } = await supabase.from("weight_logs").delete().eq("id", id);
  if (error) fail("delete that weigh-in", error);
  changed();
}

// ── Food (food_logs) ─────────────────────────────────────────────────────────

export const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const FOOD_FIELDS = ["date", "meal_type", "name", "description", "calories", "protein_g", "carbs_g", "fat_g", "quantity", "source", "items"];

export async function loadFood(profileId, { from } = {}) {
  return allRows(() => {
    let q = supabase.from("food_logs").select("id, date, meal_type, name, description, calories, protein_g, carbs_g, fat_g, source, items, created_at").eq("profile_id", profileId);
    if (from) q = q.gte("date", from);
    return q.order("date", { ascending: false }).order("created_at", { ascending: true });
  }, "load your food log");
}

const cleanFood = (f) => {
  const row = {};
  for (const k of FOOD_FIELDS) if (f[k] !== undefined) row[k] = f[k];
  for (const k of ["calories", "protein_g", "carbs_g", "fat_g"]) if (row[k] !== undefined) row[k] = Math.max(0, Math.round(Number(row[k]) || 0));
  if (row.name !== undefined && !String(row.name).trim()) throw new Error("Give the food a name.");
  if (row.meal_type !== undefined && !MEALS.includes(row.meal_type)) row.meal_type = "snack";
  return row;
};

export async function addFood(profileId, food) {
  const userId = await uid();
  const row = { date: toDateStr(), meal_type: "snack", source: "manual", ...cleanFood(food), user_id: userId, profile_id: profileId };
  const { error } = await supabase.from("food_logs").insert(row);
  if (error) fail("log that food", error);
  changed();
}

export async function updateFood(id, food) {
  const { error } = await supabase.from("food_logs").update(cleanFood(food)).eq("id", id);
  if (error) fail("update that food", error);
  changed();
}

export async function deleteFood(id) {
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) fail("delete that food", error);
  changed();
}

// ── Workout plans ────────────────────────────────────────────────────────────

/** Validates and normalises a plan's exercise list (schema 1). Throws on nonsense. */
export function cleanExercises(list) {
  if (!Array.isArray(list)) throw new Error("A workout needs a list of exercises.");
  const out = list.map((e, i) => {
    const name = String(e?.name || "").trim().slice(0, 120);
    if (!name) throw new Error(`Exercise ${i + 1} needs a name.`);
    const sets = Math.round(Number(e.sets ?? DEFAULT_TARGET.sets));
    const repMin = Math.round(Number(e.repMin ?? DEFAULT_TARGET.repMin));
    const repMax = Math.round(Number(e.repMax ?? Math.max(repMin, DEFAULT_TARGET.repMax)));
    const restSec = Math.round(Number(e.restSec ?? DEFAULT_TARGET.restSec));
    if (!(sets >= 1 && sets <= 20)) throw new Error(`${name}: sets must be 1–20.`);
    if (!(repMin >= 1 && repMax >= repMin && repMax <= 100)) throw new Error(`${name}: reps must be a range like 8–12.`);
    if (!(restSec >= 0 && restSec <= 900)) throw new Error(`${name}: rest must be 0–900 seconds.`);
    const row = { name, sets, repMin, repMax, restSec, note: String(e.note || "").slice(0, 300) };
    if (Number(e.startWeightLb) > 0) row.startWeightLb = Number(e.startWeightLb);
    return row;
  });
  if (!out.length) throw new Error("Add at least one exercise.");
  return out;
}

const shapePlan = (p) => ({ id: p.id, name: p.name, notes: p.notes, source: p.source, prompt: p.prompt, exercises: p.exercises || [], archived: p.archived, updatedAt: p.updated_at });

export async function loadPlans() {
  const userId = await uid();
  const rows = await allRows(() => supabase.from("workout_plans").select("*").eq("user_id", userId).eq("archived", false).order("updated_at", { ascending: false }), "load your workouts");
  return rows.map(shapePlan);
}

export async function savePlan({ id, name, notes = "", source = "manual", prompt = null, exercises }) {
  const row = { name: String(name || "").trim().slice(0, 120), notes, source, prompt, exercises: cleanExercises(exercises), schema_version: 1, updated_at: new Date().toISOString() };
  if (!row.name) throw new Error("Give the workout a name.");
  const q = id
    ? supabase.from("workout_plans").update(row).eq("id", id).select().single()
    : supabase.from("workout_plans").insert({ ...row, user_id: await uid() }).select().single();
  const { data, error } = await q;
  if (error) fail("save that workout", error);
  changed();
  return shapePlan(data);
}

export async function archivePlan(id) {
  const { error } = await supabase.from("workout_plans").update({ archived: true, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) fail("remove that workout", error);
  changed();
}

// ── Sessions & sets ──────────────────────────────────────────────────────────

const shapeSession = (s) => ({ id: s.id, planId: s.plan_id, name: s.name, startedAt: s.started_at, endedAt: s.ended_at, notes: s.notes, exercises: s.exercises || [] });
const shapeSet = (s, startedAt) => ({ id: s.id, sessionId: s.session_id, exercise: s.exercise, setNumber: s.set_number, reps: s.reps, weightLb: Number(s.weight_lb), rpe: s.rpe == null ? null : Number(s.rpe), loggedAt: s.logged_at, startedAt });

export async function loadSessions() {
  const userId = await uid();
  const rows = await allRows(() => supabase.from("workout_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }), "load your workouts");
  return rows.map(shapeSession);
}

/** Every set you've logged, with its workout's start time (what suggestions and insights read). */
export async function loadHistory() {
  const userId = await uid();
  const rows = await allRows(() => supabase.from("workout_sets").select("id, session_id, exercise, set_number, reps, weight_lb, rpe, logged_at, workout_sessions!inner(started_at)").eq("user_id", userId).order("logged_at"), "load your lifting history");
  return rows.map((r) => shapeSet(r, r.workout_sessions.started_at));
}

export async function getOpenSession() {
  const userId = await uid();
  const { data, error } = await supabase.from("workout_sessions").select("*").eq("user_id", userId).is("ended_at", null).maybeSingle();
  if (error) fail("check for a workout in progress", error);
  return data ? shapeSession(data) : null;
}

export async function loadSession(id) {
  const [{ data: s, error }, { data: sets, error: e2 }] = await Promise.all([
    supabase.from("workout_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("workout_sets").select("*").eq("session_id", id).order("logged_at"),
  ]);
  if (error) fail("load that workout", error);
  if (e2) fail("load that workout's sets", e2);
  if (!s) return null;
  return { ...shapeSession(s), sets: sets.map((x) => shapeSet(x, s.started_at)) };
}

/** plan: a saved plan, or null for an empty workout you build as you go. */
export async function startSession({ plan = null, name } = {}) {
  const userId = await uid();
  const { data, error } = await supabase.from("workout_sessions").insert({
    user_id: userId,
    plan_id: plan?.id ?? null,
    name: String(name || plan?.name || "Workout").slice(0, 120),
    exercises: plan ? cleanExercises(plan.exercises) : [],
  }).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("You already have a workout in progress — finish or discard it first.", { cause: error });
    fail("start the workout", error);
  }
  changed();
  return shapeSession(data);
}

export async function updateSessionExercises(id, exercises) {
  const { error } = await supabase.from("workout_sessions").update({ exercises: exercises.length ? cleanExercises(exercises) : [] }).eq("id", id);
  if (error) fail("update the workout", error);
  changed();
}

export async function finishSession(id, { notes = "" } = {}) {
  const { error } = await supabase.from("workout_sessions").update({ ended_at: new Date().toISOString(), notes }).eq("id", id).is("ended_at", null);
  if (error) fail("finish the workout", error);
  changed();
}

export async function deleteSession(id) {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", id);
  if (error) fail("discard the workout", error);
  changed();
}

export async function addSet(sessionId, { exercise, setNumber, reps, weightLb, rpe = null }) {
  const row = validateSet({ exercise, setNumber, reps, weightLb, rpe });
  const { data, error } = await supabase.from("workout_sets").insert({ ...row, session_id: sessionId, user_id: await uid() }).select().single();
  if (error) fail("log that set", error);
  changed();
  return shapeSet(data);
}

export async function updateSet(id, fields) {
  const row = validateSet(fields);
  const { error } = await supabase.from("workout_sets").update(row).eq("id", id);
  if (error) fail("update that set", error);
  changed();
}

export async function deleteSet(id) {
  const { error } = await supabase.from("workout_sets").delete().eq("id", id);
  if (error) fail("delete that set", error);
  changed();
}

function validateSet({ exercise, setNumber, reps, weightLb, rpe }) {
  const r = Math.round(Number(reps));
  const w = Math.round(Number(weightLb) * 100) / 100;
  if (!String(exercise || "").trim()) throw new Error("Which exercise was that?");
  if (!(r >= 0 && r <= 200)) throw new Error("Reps must be between 0 and 200.");
  if (!(w >= 0 && w <= 2000)) throw new Error("Weight must be between 0 and 2000 lb.");
  const e = rpe === null || rpe === "" || rpe === undefined ? null : Number(rpe);
  if (e !== null && !(e >= 1 && e <= 10)) throw new Error("RPE is 1–10 (or leave it blank).");
  return { exercise: String(exercise).trim().slice(0, 120), set_number: Math.max(1, Math.round(Number(setNumber) || 1)), reps: r, weight_lb: w, rpe: e };
}

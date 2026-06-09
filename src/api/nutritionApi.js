// src/api/nutritionApi.js
// Calorie + weight tracking for one or more profiles (you + partner) under a
// single admin account. Direct Supabase calls (no localStorage fallback — meal
// photos and shared data can't live in localStorage meaningfully).
import { supabase } from "../utils/supabase";

const BUCKET = "nutrition";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

/* ── Profiles ─────────────────────────────────────────────── */
export async function loadProfiles() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("nutrition_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProfile(fields) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("nutrition_profiles")
    .insert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id, fields) {
  const allowed = ["name", "emoji", "color", "sex", "height_cm", "birth_year",
    "activity_level", "goal", "target_calories", "start_weight_kg", "goal_weight_kg", "sort_order"];
  const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  const { data, error } = await supabase
    .from("nutrition_profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id) {
  const { error } = await supabase.from("nutrition_profiles").delete().eq("id", id);
  if (error) throw error;
}

/* ── Food logs ────────────────────────────────────────────── */
export async function loadFoodLogs(profileId, { from, to } = {}) {
  let q = supabase.from("food_logs").select("*").eq("profile_id", profileId);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q.order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFoodLog(profileId, entry) {
  const userId = await uid();
  const row = {
    user_id: userId,
    profile_id: profileId,
    date: entry.date || new Date().toISOString().split("T")[0],
    meal_type: entry.meal_type || "snack",
    name: entry.name,
    description: entry.description || "",
    calories: Number(entry.calories) || 0,
    protein_g: Number(entry.protein_g) || 0,
    carbs_g: Number(entry.carbs_g) || 0,
    fat_g: Number(entry.fat_g) || 0,
    quantity: Number(entry.quantity) || 1,
    source: entry.source || "manual",
    image_path: entry.image_path || null,
    items: entry.items || [],
    recipe_id: entry.recipe_id || null,
  };
  const { data, error } = await supabase.from("food_logs").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateFoodLog(id, fields) {
  const allowed = ["date", "meal_type", "name", "description", "calories", "protein_g", "carbs_g", "fat_g", "quantity"];
  const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  const { data, error } = await supabase.from("food_logs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFoodLog(log) {
  if (log.image_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([log.image_path]);
    if (storageError) console.warn("Failed to delete meal photo:", storageError.message);
  }
  const { error } = await supabase.from("food_logs").delete().eq("id", log.id);
  if (error) throw error;
}

/* ── Meal photos ──────────────────────────────────────────── */
export async function uploadMealPhoto(profileId, file) {
  const userId = await uid();
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${profileId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function getMealPhotoUrl(path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/* ── Weight logs ──────────────────────────────────────────── */
export async function loadWeightLogs(profileId) {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("profile_id", profileId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Upsert a weight for a given date (one entry per profile per day). */
export async function saveWeight(profileId, { date, weight_kg, note }) {
  const userId = await uid();
  const row = {
    user_id: userId,
    profile_id: profileId,
    date: date || new Date().toISOString().split("T")[0],
    weight_kg: Number(weight_kg),
    note: note || "",
  };
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(row, { onConflict: "profile_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeight(id) {
  const { error } = await supabase.from("weight_logs").delete().eq("id", id);
  if (error) throw error;
}

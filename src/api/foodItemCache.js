// src/api/foodItemCache.js — per-item nutrition cache for the food log AI.
// After the AI estimates a food item once, the result is saved here keyed by a
// normalized name. The next estimate of the same item returns instantly with no
// web search and no AI call. One row per distinct item per profile.
//
// Pure helpers (normalizeFoodName, splitFoodItems, cacheRowToItem) live in
// foodEstimateCore.js so they run under plain node:test; re-exported here
// for convenience.

import { supabase } from "../utils/supabase";
import { uid } from "./_base";

import { normalizeFoodName, splitFoodItems, cacheRowToItem } from "./foodEstimateCore.js";

export { normalizeFoodName, splitFoodItems, cacheRowToItem };

const CACHE_FIELDS =
  "id, profile_id, name_normalized, name_display, calories, protein_g, carbs_g, fat_g, quantity_basis, source, source_url, use_count";

/** Look up one normalized item name. Returns the row or null. */
export async function lookupCache(profileId, normalizedName) {
  const key = normalizeFoodName(normalizedName);
  if (!profileId || !key) return null;
  const { data, error } = await supabase
    .from("food_item_cache")
    .select(CACHE_FIELDS)
    .eq("profile_id", profileId)
    .eq("name_normalized", key)
    .maybeSingle();
  if (error) throw new Error(`Food database lookup failed: ${error.message}`);
  return data || null;
}

/**
 * Save an AI-estimated item to the cache (upsert on profile + normalized name).
 * Bumps use_count so frequently-logged items sort first if we ever list them.
 */
export async function saveToCache(profileId, item) {
  const userId = await uid();
  const nameDisplay = String(item?.name || "").trim().slice(0, 120);
  const key = normalizeFoodName(nameDisplay);
  if (!profileId || !key) return null;
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const row = {
    user_id: userId,
    profile_id: profileId,
    name_normalized: key,
    name_display: nameDisplay,
    calories: n(item.calories),
    protein_g: n(item.protein_g),
    carbs_g: n(item.carbs_g),
    fat_g: n(item.fat_g),
    quantity_basis: String(item.quantity || "").slice(0, 120),
    source: String(item.source || "estimated").slice(0, 120),
    source_url: item.source_url ? String(item.source_url).slice(0, 500) : null,
  };
  const { data, error } = await supabase
    .from("food_item_cache")
    .upsert(row, { onConflict: "profile_id,name_normalized" })
    .select("id, use_count")
    .single();
  if (error) throw new Error(`Saving to the food database failed: ${error.message}`);
  // Bump the hit counter on repeat saves (insert path already starts at 1).
  const { error: bumpError } = await supabase
    .from("food_item_cache")
    .update({ use_count: (data?.use_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (bumpError) throw new Error(`Saving to the food database failed: ${bumpError.message}`);
  return data.id;
}

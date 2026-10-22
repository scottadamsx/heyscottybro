// ── Recipes with structured (version 2) ingredients (connected-pages.md §2.2)
// Legacy rows keep their { item, quantity } JSON untouched in storage until
// Scott reviews the converted lines and saves — reads convert on the fly.

import { supabase } from "../utils/supabase.js";
import { uid, fail } from "./_base.js";
import { cleanIngredientLine, recipeLines } from "../lib/recipeIngredients.js";

const cleanPrepProfile = (p) => ({
  required: !!p?.required,
  kind: ["night_before", "morning", "lead_time"].includes(p?.kind) ? p.kind : "night_before",
  lead_minutes: p?.lead_minutes != null ? Math.max(0, Math.round(Number(p.lead_minutes)) || 0) : null,
  note: String(p?.note || ""),
});

export async function loadRecipes() {
  const user_id = await uid();
  const { data, error } = await supabase.from("recipes")
    .select("*").eq("user_id", user_id).order("title");
  if (error) throw fail("recipesApi.loadRecipes", error);
  return (data || []).map((r) => ({ ...r, lines: recipeLines(r) }));
}

export async function saveRecipe(recipe) {
  const user_id = await uid();
  const payload = {
    user_id,
    title: String(recipe.title || "").trim(),
    description: String(recipe.description || ""),
    servings: Math.max(1, Math.round(Number(recipe.servings) || 1)),
    prep_minutes: Math.max(0, Math.round(Number(recipe.prep_minutes) || 0)),
    cook_minutes: Math.max(0, Math.round(Number(recipe.cook_minutes) || 0)),
    ingredients: (recipe.lines || recipe.ingredients || []).map(cleanIngredientLine),
    ingredients_schema_version: 2,
    prep_profile: cleanPrepProfile(recipe.prep_profile),
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    calories_per_serving: Number(recipe.calories_per_serving) || 0,
    protein_g: Number(recipe.protein_g) || 0,
    carbs_g: Number(recipe.carbs_g) || 0,
    fat_g: Number(recipe.fat_g) || 0,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    favorite: !!recipe.favorite,
  };
  if (!payload.title) throw new Error("A recipe needs a title.");
  if (recipe.id) {
    const { data, error } = await supabase.from("recipes")
      .update(payload).eq("id", recipe.id).select().single();
    if (error) throw fail("recipesApi.saveRecipe", error);
    return { ...data, lines: recipeLines(data) };
  }
  const { data, error } = await supabase.from("recipes").insert(payload).select().single();
  if (error) throw fail("recipesApi.saveRecipe", error);
  return { ...data, lines: recipeLines(data) };
}

export async function setRecipeArchived(id, archived) {
  const { error } = await supabase.from("recipes").update({ archived: !!archived }).eq("id", id);
  if (error) throw fail("recipesApi.setRecipeArchived", error);
}

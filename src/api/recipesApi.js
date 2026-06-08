// src/api/recipesApi.js
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

export async function loadRecipes() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRecipe(recipe) {
  const userId = await uid();
  const row = {
    user_id: userId,
    title: recipe.title,
    description: recipe.description || "",
    servings: Number(recipe.servings) || 1,
    prep_minutes: Number(recipe.prep_minutes) || 0,
    cook_minutes: Number(recipe.cook_minutes) || 0,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    calories_per_serving: Number(recipe.calories_per_serving) || 0,
    protein_g: Number(recipe.protein_g) || 0,
    carbs_g: Number(recipe.carbs_g) || 0,
    fat_g: Number(recipe.fat_g) || 0,
    tags: recipe.tags || [],
    source: recipe.source || "manual",
  };
  const { data, error } = await supabase.from("recipes").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRecipe(id, fields) {
  const allowed = ["title", "description", "servings", "prep_minutes", "cook_minutes",
    "ingredients", "steps", "calories_per_serving", "protein_g", "carbs_g", "fat_g", "tags", "favorite"];
  const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  const { data, error } = await supabase.from("recipes").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

// ── Meal Plan + grocery week budgets + shopping + snapshots ─────────────────
// (connected-pages.md §2.3–§2.7). Planned grocery spend lives here and in
// Finance's shared snapshot read — it is never written as a transaction.

import { supabase } from "../utils/supabase.js";
import { uid, fail } from "./_base.js";

// ── Week plans and items ─────────────────────────────────────────────────────

export async function loadWeekPlan(weekStart) {
  const user_id = await uid();
  const { data, error } = await supabase.from("meal_plans")
    .select("*").eq("user_id", user_id).eq("week_start", weekStart).maybeSingle();
  if (error) throw fail("mealPlanApi.loadWeekPlan", error);
  return data || null;
}

export async function ensureWeekPlan(weekStart) {
  const existing = await loadWeekPlan(weekStart);
  if (existing) return existing;
  const user_id = await uid();
  const { data, error } = await supabase.from("meal_plans")
    .insert({ user_id, week_start: weekStart, status: "draft" }).select().single();
  if (error) throw fail("mealPlanApi.ensureWeekPlan", error);
  return data;
}

export async function updateWeekPlan(id, patch) {
  const { data, error } = await supabase.from("meal_plans")
    .update(patch).eq("id", id).select().single();
  if (error) throw fail("mealPlanApi.updateWeekPlan", error);
  return data;
}

export async function loadWeekItems(planId) {
  const user_id = await uid();
  const { data, error } = await supabase.from("meal_plan_items")
    .select("*").eq("user_id", user_id).eq("meal_plan_id", planId)
    .order("planned_date").order("meal_slot");
  if (error) throw fail("mealPlanApi.loadWeekItems", error);
  return data || [];
}

const cleanItem = (item, user_id) => ({
  user_id,
  meal_plan_id: item.meal_plan_id,
  planned_date: item.planned_date,
  meal_slot: item.meal_slot || "dinner",
  recipe_id: item.recipe_id || null,
  custom_title: item.custom_title || null,
  custom_ingredients: Array.isArray(item.custom_ingredients) ? item.custom_ingredients : [],
  servings: Number(item.servings) || 1,
  eat_time: item.eat_time || null,
  status: item.status || "planned",
  skip_reason: item.skip_reason || null,
  advance_prep_kind: item.advance_prep_kind || "none",
  advance_prep_lead_minutes: item.advance_prep_lead_minutes ?? null,
  advance_prep_note: item.advance_prep_note || null,
  food_log_id: item.food_log_id ?? undefined,
});

export async function saveWeekItem(item) {
  const user_id = await uid();
  const payload = cleanItem(item, user_id);
  if (payload.food_log_id === undefined) delete payload.food_log_id;
  if (item.id) {
    const { data, error } = await supabase.from("meal_plan_items")
      .update(payload).eq("id", item.id).select().single();
    if (error) throw fail("mealPlanApi.saveWeekItem", error);
    return data;
  }
  const { data, error } = await supabase.from("meal_plan_items").insert(payload).select().single();
  if (error) throw fail("mealPlanApi.saveWeekItem", error);
  return data;
}

/** Partial update for status/link changes that must not disturb other fields. */
export async function patchWeekItem(id, patch) {
  const { data, error } = await supabase.from("meal_plan_items")
    .update(patch).eq("id", id).select().single();
  if (error) throw fail("mealPlanApi.patchWeekItem", error);
  return data;
}

export async function loadAllPlans() {
  const user_id = await uid();
  const { data, error } = await supabase.from("meal_plans")
    .select("*").eq("user_id", user_id).order("week_start", { ascending: false });
  if (error) throw fail("mealPlanApi.loadAllPlans", error);
  return data || [];
}

export async function deleteWeekItem(id) {
  const { error } = await supabase.from("meal_plan_items").delete().eq("id", id);
  if (error) throw fail("mealPlanApi.deleteWeekItem", error);
}

// ── Grocery week budgets (Finance owns the record) ───────────────────────────

export async function loadBudgetWeek(weekStart) {
  const user_id = await uid();
  const { data, error } = await supabase.from("grocery_budget_weeks")
    .select("*").eq("user_id", user_id).eq("week_start", weekStart).maybeSingle();
  if (error) throw fail("mealPlanApi.loadBudgetWeek", error);
  return data || null;
}

export async function saveBudgetWeek({ weekStart, amountCents }) {
  const user_id = await uid();
  const { data, error } = await supabase.from("grocery_budget_weeks")
    .upsert({ user_id, week_start: weekStart, amount_cents: Math.max(0, Math.round(amountCents)) },
      { onConflict: "user_id,week_start" })
    .select().single();
  if (error) throw fail("mealPlanApi.saveBudgetWeek", error);
  return data;
}

// ── Shopping lists ───────────────────────────────────────────────────────────

export async function loadShoppingList(planId) {
  const user_id = await uid();
  const { data: list, error } = await supabase.from("meal_plan_shopping_lists")
    .select("*").eq("user_id", user_id).eq("meal_plan_id", planId).maybeSingle();
  if (error) throw fail("mealPlanApi.loadShoppingList", error);
  if (!list) return { list: null, items: [] };
  const { data: items, error: itemsError } = await supabase.from("meal_plan_shopping_items")
    .select("*").eq("user_id", user_id).eq("shopping_list_id", list.id).order("display_name");
  if (itemsError) throw fail("mealPlanApi.loadShoppingList(items)", itemsError);
  return { list, items: items || [] };
}

/**
 * Regenerate the stored list from computed lines. States already_have and
 * purchased survive regeneration for the same ingredient; vanished
 * ingredients are removed (2.4: no orphaned rows).
 */
export async function syncShoppingList({ plan, lines, storeKey, storeName }) {
  const user_id = await uid();
  let { list } = await loadShoppingList(plan.id);
  if (!list) {
    const { data, error } = await supabase.from("meal_plan_shopping_lists")
      .insert({ user_id, meal_plan_id: plan.id, store_key: storeKey, store_name: storeName, status: "draft" })
      .select().single();
    if (error) throw fail("mealPlanApi.syncShoppingList(list)", error);
    list = data;
  } else if (list.store_key !== storeKey || list.store_name !== storeName) {
    const { data, error } = await supabase.from("meal_plan_shopping_lists")
      .update({ store_key: storeKey, store_name: storeName }).eq("id", list.id).select().single();
    if (error) throw fail("mealPlanApi.syncShoppingList(list update)", error);
    list = data;
  }
  const { items: existing } = await loadShoppingList(plan.id);
  const byKey = new Map(existing.map((i) => [`${i.ingredient_key}|${i.unit_kind}`, i]));
  const seen = new Set();
  for (const line of lines) {
    const key = `${line.ingredientKey}|${line.unitKind || "count"}`;
    seen.add(key);
    const prev = byKey.get(key);
    const keepState = prev && (prev.state === "already_have" || prev.state === "purchased");
    const row = {
      user_id,
      shopping_list_id: list.id,
      ingredient_key: line.ingredientKey,
      display_name: line.name,
      unit_kind: line.unitKind || "count",
      required_quantity_milliunits: line.requiredMilli,
      store_key: line.product?.store_key ?? storeKey,
      external_product_key: line.product?.external_product_key ?? null,
      packages_needed: line.packages,
      package_price_cents: line.packagePriceCents,
      purchase_cost_cents: line.purchaseCostCents,
      state: keepState ? prev.state : line.state,
    };
    if (prev) {
      const { error } = await supabase.from("meal_plan_shopping_items").update(row).eq("id", prev.id);
      if (error) throw fail("mealPlanApi.syncShoppingList(item)", error);
    } else {
      const { error } = await supabase.from("meal_plan_shopping_items").insert(row);
      if (error) throw fail("mealPlanApi.syncShoppingList(item)", error);
    }
  }
  for (const prev of existing) {
    if (!seen.has(`${prev.ingredient_key}|${prev.unit_kind}`)) {
      const { error } = await supabase.from("meal_plan_shopping_items").delete().eq("id", prev.id);
      if (error) throw fail("mealPlanApi.syncShoppingList(prune)", error);
    }
  }
  return loadShoppingList(plan.id);
}

export async function setShoppingItemState(id, state) {
  const { data, error } = await supabase.from("meal_plan_shopping_items")
    .update({ state }).eq("id", id).select().single();
  if (error) throw fail("mealPlanApi.setShoppingItemState", error);
  return data;
}

// ── Cost snapshots (Mark week ready) ─────────────────────────────────────────

export async function loadSnapshots(planId) {
  const user_id = await uid();
  const { data, error } = await supabase.from("meal_plan_cost_snapshots")
    .select("*").eq("user_id", user_id).eq("meal_plan_id", planId)
    .order("created_at", { ascending: false });
  if (error) throw fail("mealPlanApi.loadSnapshots", error);
  return data || [];
}

/** The current (non-superseded) snapshot for a week, if Mark ready ran. */
export async function loadCurrentSnapshot(planId) {
  const snapshots = await loadSnapshots(planId);
  return snapshots.find((s) => !s.superseded_at) || null;
}

export async function markWeekReady({ plan, weekCost, priceImportId, storeKey, storeName, details }) {
  const user_id = await uid();
  // Supersede the prior current snapshot; old rows remain as history.
  await supabase.from("meal_plan_cost_snapshots")
    .update({ superseded_at: new Date().toISOString() })
    .eq("user_id", user_id).eq("meal_plan_id", plan.id).is("superseded_at", null);
  const { data, error } = await supabase.from("meal_plan_cost_snapshots").insert({
    user_id,
    meal_plan_id: plan.id,
    price_import_id: priceImportId || null,
    store_key: storeKey || null,
    store_name: storeName || null,
    purchase_total_cents: weekCost.purchaseTotalCents,
    consumed_total_cents: weekCost.consumedTotalCents,
    required_line_count: weekCost.requiredLineCount,
    priced_line_count: weekCost.pricedLineCount,
    coverage_status: weekCost.coverageStatus,
    details,
  }).select().single();
  if (error) throw fail("mealPlanApi.markWeekReady", error);
  await updateWeekPlan(plan.id, {
    status: "ready",
    shopping_store_key: storeKey || null,
    shopping_store_name: storeName || null,
  });
  const { list } = await loadShoppingList(plan.id);
  if (list) {
    await supabase.from("meal_plan_shopping_lists").update({ status: "ready" }).eq("id", list.id);
  }
  return data;
}

/** Shopping items in state "already have it", as the cost engine's map. */
export function alreadyHaveMap(shoppingItems) {
  const map = new Map();
  for (const i of shoppingItems || []) {
    if (i.state === "already_have") {
      map.set(`${i.ingredient_key}|${i.unit_kind}`, Number(i.required_quantity_milliunits) || 0);
    }
  }
  return map;
}

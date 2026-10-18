// src/api/foodEstimateCore.js — pure, testable core of the food estimate flow.
// No side-effect imports: the AI flow and the cache are injected, so this module
// runs under plain node:test without Vite or a Supabase client.

/** "  Veggie-Straws! " -> "veggie straws" — the stable cache key. */
export function normalizeFoodName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Split a free-text description into candidate item names for cache lookup.
 * "Veggie Straws, Grenade White Oreo Bar and a Coke" ->
 * ["Veggie Straws", "Grenade White Oreo Bar", "a Coke"]
 * Best-effort: anything the split gets wrong still goes through the AI flow.
 */
export function splitFoodItems(description) {
  const text = String(description || "").trim();
  if (!text) return [];
  return text
    .split(/\s*(?:,|;|\band\b|\bwith\b|\bplus\b|&)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Shape a cache row like an AI estimate item, flagged as cached. */
export function cacheRowToItem(row) {
  return {
    name: row.name_display,
    quantity: row.quantity_basis || "",
    calories: Number(row.calories) || 0,
    protein_g: Number(row.protein_g) || 0,
    carbs_g: Number(row.carbs_g) || 0,
    fat_g: Number(row.fat_g) || 0,
    source: row.source || "estimated",
    source_url: row.source_url || "",
    cached: true,
  };
}

/** Build the meal-level return shape from a list of items (all cached path). */
export function mealFromItems(items, { mealType, searches = [], source = "", source_url = "" } = {}) {
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const sum = (k) => items.reduce((t, i) => t + n(i[k]), 0);
  const names = items.map((i) => i.name).filter(Boolean);
  return {
    name: names.slice(0, 3).join(" + ") || "Meal",
    meal_type: mealType || "snack",
    calories: sum("calories"),
    protein_g: sum("protein_g"),
    carbs_g: sum("carbs_g"),
    fat_g: sum("fat_g"),
    items,
    assumptions: `${items.length} item${items.length === 1 ? "" : "s"} from your food database`,
    source: source || "your food database",
    source_url,
    searches,
  };
}

/**
 * Testable core of estimateFood. `aiFlow(text)` runs the AI + web-search flow and
 * returns { input, searches }; `cache` supplies { lookupCache, saveToCache }.
 */
export async function estimateFoodCore(text, { mealType, profileId, aiFlow, cache }) {
  if (!text) throw new Error("Describe what you ate first.");
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const { lookupCache, saveToCache } = cache;

  // 1. Whole-description cache hit → instant, zero AI cost.
  if (profileId) {
    const whole = await lookupCache(profileId, text).catch(() => null);
    if (whole && n(whole.calories) > 0) {
      const item = cacheRowToItem(whole);
      return {
        name: item.name,
        meal_type: mealType || "snack",
        calories: n(item.calories),
        protein_g: n(item.protein_g),
        carbs_g: n(item.carbs_g),
        fat_g: n(item.fat_g),
        items: [item],
        assumptions: item.quantity ? `Per ${item.quantity} (from your food database)` : "From your food database",
        source: item.source,
        source_url: item.source_url,
        searches: [],
      };
    }
  }

  // 2. Split into candidate items; cached ones return instantly.
  const cachedItems = [];
  let unknownText = text;
  if (profileId) {
    const candidates = splitFoodItems(text);
    // Only use the per-item path when the split actually found 2+ items;
    // a single candidate is already covered by the whole-description check above.
    if (candidates.length > 1) {
      const unknown = [];
      for (const c of candidates) {
        const row = await lookupCache(profileId, c).catch(() => null);
        if (row && n(row.calories) > 0) cachedItems.push(cacheRowToItem(row));
        else unknown.push(c);
      }
      if (unknown.length === 0) {
        return mealFromItems(cachedItems, { mealType, searches: [] });
      }
      unknownText = unknown.join(", ");
    }
  }

  // 3. AI flow for whatever is still unknown (unchanged behaviour).
  const { input: out, searches } = await aiFlow(unknownText);
  if (!(n(out.calories) > 0)) throw new Error("The estimate came back empty. Add a little more detail and try again.");

  // 4. Save each AI-returned item to the cache for next time.
  const freshItems = [];
  for (const item of out.items || []) {
    const key = normalizeFoodName(item?.name);
    if (profileId && key) {
      try {
        await saveToCache(profileId, { ...item, source: out.source, source_url: out.source_url });
      } catch {
        // Cache write failure must never block the estimate itself.
      }
    }
    freshItems.push({ ...item, cached: false });
  }

  const items = [...cachedItems, ...freshItems];
  if (cachedItems.length > 0 && freshItems.length === 0) {
    return mealFromItems(items, { mealType, searches, source: out.source, source_url: out.source_url });
  }
  return {
    ...out,
    calories: n(out.calories),
    protein_g: n(out.protein_g),
    carbs_g: n(out.carbs_g),
    fat_g: n(out.fat_g),
    items,
    searches,
  };
}

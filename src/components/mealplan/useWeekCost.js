// Shared Meal Plan week read + costing for the Health Meal Plan tab and the
// Finance grocery week card, so both surfaces show the same planned figure
// from the same inputs (connected-pages.md §2.6, SPEC-GAP 6: derived only).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadWeekPlan, loadWeekItems, loadBudgetWeek, loadShoppingList,
  loadSnapshots, alreadyHaveMap,
} from "../../api/mealPlanApi.js";
import { loadRecipes } from "../../api/recipesApi.js";
import { loadActivePriceSnapshot, loadMatches } from "../../api/groceryPricesApi.js";
import { costWeek } from "../../lib/mealPlanCost.js";
import { parseLocalDate, toDateStr } from "../../utils/dates.js";

/** Monday (yyyy-mm-dd) of the week containing dateStr. */
export function mondayOf(dateStr) {
  const d = parseLocalDate(dateStr);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDateStr(d);
}

export function useWeekCost(weekStart) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeChoice, setStoreChoice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plan, recipes, budgetWeek, snapshot, matches] = await Promise.all([
        loadWeekPlan(weekStart),
        loadRecipes(),
        loadBudgetWeek(weekStart),
        loadActivePriceSnapshot(),
        loadMatches(),
      ]);
      const [items, shopping, snapshots] = plan
        ? await Promise.all([loadWeekItems(plan.id), loadShoppingList(plan.id), loadSnapshots(plan.id)])
        : [[], { list: null, items: [] }, []];
      setData({
        plan, items, recipes, budgetWeek,
        priceImport: snapshot.importRow, priceItems: snapshot.items,
        matches, shopping, snapshots,
      });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const stores = useMemo(() => {
    if (!data) return [];
    const seen = new Map();
    for (const i of data.priceItems) if (!seen.has(i.store_key)) seen.set(i.store_key, i.store_name);
    return [...seen.entries()].map(([key, name]) => ({ key, name }));
  }, [data]);

  const storeKey = storeChoice
    || data?.plan?.shopping_store_key
    || stores[0]?.key
    || null;

  const weekCost = useMemo(() => {
    if (!data || !storeKey) return null;
    const byId = new Map(data.recipes.map((r) => [r.id, r]));
    return costWeek({
      entries: data.items.map((item) => ({ item, recipe: item.recipe_id ? byId.get(item.recipe_id) || null : null })),
      matches: data.matches,
      priceItems: data.priceItems,
      storeKey,
      alreadyHaveMilli: alreadyHaveMap(data.shopping.items),
    });
  }, [data, storeKey]);

  const currentSnapshot = useMemo(
    () => (data?.snapshots || []).find((s) => !s.superseded_at) || null,
    [data],
  );

  return {
    loading, error, reload: load,
    plan: data?.plan || null,
    items: data?.items || [],
    recipes: data?.recipes || [],
    budgetWeek: data?.budgetWeek || null,
    priceImport: data?.priceImport || null,
    priceItems: data?.priceItems || [],
    matches: data?.matches || [],
    shopping: data?.shopping || { list: null, items: [] },
    snapshots: data?.snapshots || [],
    currentSnapshot,
    stores, storeKey, setStoreKey: setStoreChoice,
    weekCost,
  };
}

// ── Connected Pages: meal + week costing (connected-pages.md §2.5, §2.6) ────
//
// Two different numbers, never blended:
//  - meal cost: the value of the food a meal uses (unit rates × quantities);
//  - planned grocery spend: whole packages Scott must buy for the week,
//    rounded up AFTER weekly aggregation, minus "already have it" amounts.
// Quantities are integer milliunits; money is integer cents at the boundary.
// Optional ingredient lines are excluded from required counts and costing.
// A line with no confirmed product match for the selected store, a unit-kind
// mismatch, or a needs-review parse is UNPRICED — never zero, never guessed.

import { recipeLines } from "./recipeIngredients.js";

export function productIndex(priceItems) {
  const map = new Map();
  for (const p of priceItems || []) map.set(`${p.store_key}|${p.external_product_key}`, p);
  return map;
}

/** Confirmed matches only (SPEC-GAP 5 default) for one store. */
export function confirmedMatch(matches, normalizedName, storeKey) {
  return (matches || []).find(
    (m) => m.normalized_ingredient === normalizedName && m.store_key === storeKey && m.status === "confirmed",
  ) || null;
}

export function resolveProduct(line, { matches, products, storeKey }) {
  const match = confirmedMatch(matches, line.normalized_name, storeKey);
  if (!match) return null;
  const product = products.get(`${storeKey}|${match.external_product_key}`) || null;
  if (!product || product.unit_kind !== line.unit_kind) return null;
  return product;
}

function costLines(lines, scale, ctx) {
  const out = [];
  for (const line of lines || []) {
    if (line.optional) continue;
    const requiredMilli = line.quantity_milliunits != null
      ? Math.round(line.quantity_milliunits * scale)
      : null;
    if (line.parse_status === "needs_review" || !line.costable || requiredMilli == null) {
      out.push({ key: line.normalized_name, name: line.name, unitKind: line.unit_kind, requiredMilli: requiredMilli ?? 0, product: null, usedCost: null, state: "needs_review" });
      continue;
    }
    const product = resolveProduct(line, ctx);
    if (!product) {
      out.push({ key: line.normalized_name, name: line.name, unitKind: line.unit_kind, requiredMilli, product: null, usedCost: null, state: "unpriced" });
      continue;
    }
    const usedCost = (requiredMilli * product.package_price_cents) / product.package_quantity_milliunits;
    out.push({ key: line.normalized_name, name: line.name, unitKind: line.unit_kind, requiredMilli, product, usedCost, state: "priced" });
  }
  return out;
}

const summariseLines = (lines) => ({
  requiredLineCount: lines.length,
  pricedLineCount: lines.filter((l) => l.state === "priced").length,
  unpricedNames: lines.filter((l) => l.state !== "priced").map((l) => l.name),
});

/** Cost one meal: a recipe at planned servings, or a custom meal's own lines. */
export function costMeal({ recipe = null, customLines = null, servings = 1 }, ctx) {
  const lines = customLines ?? recipeLines(recipe);
  const recipeServings = Number(recipe?.servings) || 1;
  const scale = (Number(servings) || 1) / recipeServings;
  const costed = costLines(lines, scale, ctx);
  const rawTotal = costed.reduce((s, l) => s + (l.usedCost || 0), 0);
  return { lines: costed, mealCostCents: Math.round(rawTotal), rawTotal, ...summariseLines(costed) };
}

/**
 * Cost a whole week. entries: [{ item, recipe }] for planned items.
 * alreadyHaveMilli: Map keyed `${normalized}|${unitKind}` of milliunits the
 * shopping list marks "already have it" — excluded from purchase rounding,
 * never from meal cost.
 */
export function costWeek({ entries = [], matches, priceItems, storeKey, alreadyHaveMilli = new Map() }) {
  const products = productIndex(priceItems);
  const ctx = { matches, products, storeKey };
  const meals = [];
  const aggregate = new Map();
  let consumedRaw = 0;

  for (const { item, recipe } of entries) {
    if (item.status !== "planned") continue;
    const meal = costMeal({
      recipe,
      customLines: item.custom_ingredients?.length ? item.custom_ingredients : null,
      servings: item.servings,
    }, ctx);
    consumedRaw += meal.rawTotal;
    meals.push({
      itemId: item.id, date: item.planned_date, slot: item.meal_slot,
      title: item.custom_title || recipe?.title || "Meal",
      mealCostCents: meal.mealCostCents,
      requiredLineCount: meal.requiredLineCount, pricedLineCount: meal.pricedLineCount,
    });
    for (const line of meal.lines) {
      const aggKey = `${line.key}|${line.unitKind || ""}`;
      const agg = aggregate.get(aggKey) || {
        ingredientKey: line.key, name: line.name, unitKind: line.unitKind,
        requiredMilli: 0, product: null, partial: false,
      };
      agg.requiredMilli += line.requiredMilli;
      if (line.product) agg.product = line.product;
      if (line.state === "needs_review") agg.partial = true;
      aggregate.set(aggKey, agg);
    }
  }

  const shoppingLines = [];
  let purchaseTotalCents = 0;
  for (const agg of aggregate.values()) {
    const have = Number(alreadyHaveMilli.get(`${agg.ingredientKey}|${agg.unitKind || ""}`) || 0);
    const remaining = Math.max(0, agg.requiredMilli - have);
    if (!agg.product) {
      shoppingLines.push({
        ingredientKey: agg.ingredientKey, name: agg.name, unitKind: agg.unitKind,
        requiredMilli: agg.requiredMilli, product: null, packages: null,
        packagePriceCents: null, purchaseCostCents: null, partial: agg.partial, state: "unpriced",
      });
      continue;
    }
    const packages = remaining === 0 ? 0 : Math.ceil(remaining / agg.product.package_quantity_milliunits);
    const cost = packages * agg.product.package_price_cents;
    purchaseTotalCents += cost;
    shoppingLines.push({
      ingredientKey: agg.ingredientKey, name: agg.name, unitKind: agg.unitKind,
      requiredMilli: agg.requiredMilli, product: agg.product, packages,
      packagePriceCents: agg.product.package_price_cents, purchaseCostCents: cost,
      partial: agg.partial,
      state: packages === 0 ? "already_have" : "needed",
    });
  }

  const requiredLineCount = shoppingLines.length;
  const pricedLineCount = shoppingLines.filter((l) => l.product && !l.partial).length;
  return {
    meals,
    shoppingLines,
    purchaseTotalCents,
    consumedTotalCents: Math.round(consumedRaw),
    requiredLineCount,
    pricedLineCount,
    coverageStatus: pricedLineCount === requiredLineCount ? "complete" : "partial",
    unpricedNames: shoppingLines.filter((l) => !l.product || l.partial).map((l) => l.name),
  };
}

/** Serializable snapshot details (stored on meal_plan_cost_snapshots). */
export function snapshotDetails(weekCost) {
  return {
    meals: weekCost.meals,
    shopping: weekCost.shoppingLines.map((l) => ({
      ingredientKey: l.ingredientKey, name: l.name, unitKind: l.unitKind,
      requiredMilli: l.requiredMilli,
      productKey: l.product?.external_product_key ?? null,
      productName: l.product?.product_name ?? null,
      packages: l.packages, packagePriceCents: l.packagePriceCents,
      purchaseCostCents: l.purchaseCostCents, state: l.state,
    })),
    unpriced: weekCost.unpricedNames,
  };
}

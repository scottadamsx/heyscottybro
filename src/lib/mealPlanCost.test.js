// Plain-assertion tests for mealPlanCost.js. Run: node src/lib/mealPlanCost.test.js
// Covers CP-11 (partial cost is partial, never zero or complete) and
// CP-12 (packages round once, after weekly aggregation).
import { costMeal, costWeek, productIndex } from "./mealPlanCost.js";

let pass = 0, failCount = 0;
const ok = (cond, label) => { if (cond) pass++; else { failCount++; console.error("FAIL:", label); } };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const FLOUR = { store_key: "colemans", external_product_key: "flour-1kg", product_name: "Flour 1 kg", unit_kind: "mass", package_quantity_milliunits: 1000000, package_price_cents: 500 };
const EGGS = { store_key: "colemans", external_product_key: "eggs-12", product_name: "Eggs 12", unit_kind: "count", package_quantity_milliunits: 12000, package_price_cents: 600 };
const items = [FLOUR, EGGS];
const matches = [
  { normalized_ingredient: "flour", store_key: "colemans", external_product_key: "flour-1kg", status: "confirmed" },
  { normalized_ingredient: "eggs", store_key: "colemans", external_product_key: "eggs-12", status: "confirmed" },
];
const ctx = { matches, products: productIndex(items), storeKey: "colemans" };
const line = (name, qty, kind, extra = {}) => ({
  name, normalized_name: name.toLowerCase(), quantity_milliunits: qty, unit_kind: kind,
  display_quantity: "", preparation: "", optional: false, costable: true, parse_status: "ready", ...extra,
});

// One meal: recipe serves 2, uses 300 g flour; planned for 4 → 600 g → $3.00.
const pancakes = { title: "Pancakes", servings: 2, ingredients_schema_version: 2, ingredients: [line("Flour", 300000, "mass")] };
const meal = costMeal({ recipe: pancakes, servings: 4 }, ctx);
eq(meal.mealCostCents, 300, "meal cost scales by servings at the product unit rate");
eq(meal.pricedLineCount, 1, "one priced line");

// CP-11: an unmatched ingredient is unpriced — partial coverage, no fake zero.
const withMystery = { title: "Stew", servings: 1, ingredients_schema_version: 2, ingredients: [line("Flour", 100000, "mass"), line("Saffron", 1000, "mass")] };
const partial = costMeal({ recipe: withMystery, servings: 1 }, ctx);
eq(partial.mealCostCents, 50, "partial meal cost counts only priced lines");
eq(partial.pricedLineCount, 1, "partial: one of two lines priced");
eq(partial.requiredLineCount, 2, "partial: two required lines");
ok(partial.unpricedNames.includes("Saffron"), "unpriced line is named");

// Unit-kind mismatch never prices (volume recipe line vs mass product).
const mismatch = costMeal({ recipe: { title: "X", servings: 1, ingredients_schema_version: 2, ingredients: [line("Flour", 250000, "volume")] }, servings: 1 }, ctx);
eq(mismatch.pricedLineCount, 0, "unit mismatch stays unpriced");

// Count product: 6 eggs of a 12-pack at $6.00 → $3.00.
const omelette = costMeal({ recipe: { title: "Omelette", servings: 1, ingredients_schema_version: 2, ingredients: [line("Eggs", 6000, "count")] }, servings: 1 }, ctx);
eq(omelette.mealCostCents, 300, "count lines price proportionally");

// CP-12: three meals × 400 g flour → 1200 g aggregated → 2 packages ($10.00),
// not three separately rounded packages.
const mkItem = (id, date) => ({ id, planned_date: date, meal_slot: "dinner", servings: 1, status: "planned", recipe_id: "r1", custom_ingredients: [] });
const flourMeal = { title: "Bread", servings: 1, ingredients_schema_version: 2, ingredients: [line("Flour", 400000, "mass")] };
const week = costWeek({
  entries: [
    { item: mkItem("a", "2026-10-26"), recipe: flourMeal },
    { item: mkItem("b", "2026-10-27"), recipe: flourMeal },
    { item: mkItem("c", "2026-10-28"), recipe: flourMeal },
  ],
  matches, priceItems: items, storeKey: "colemans",
});
eq(week.shoppingLines.length, 1, "week aggregates to one flour line");
eq(week.shoppingLines[0].packages, 2, "1200 g against 1 kg bags rounds to 2 packages after aggregation");
eq(week.purchaseTotalCents, 1000, "planned spend is whole packages: $10.00");
eq(week.consumedTotalCents, 600, "meal cost is consumption value: 3 × $2.00");
eq(week.coverageStatus, "complete", "fully priced week is complete");

// Already-have subtracts before rounding: have 1000 g of the 1200 g → 1 bag.
const weekHave = costWeek({
  entries: [
    { item: mkItem("a", "2026-10-26"), recipe: flourMeal },
    { item: mkItem("b", "2026-10-27"), recipe: flourMeal },
    { item: mkItem("c", "2026-10-28"), recipe: flourMeal },
  ],
  matches, priceItems: items, storeKey: "colemans",
  alreadyHaveMilli: new Map([["flour|mass", 1000000]]),
});
eq(weekHave.shoppingLines[0].packages, 1, "already-have amount is excluded before package rounding");
eq(weekHave.consumedTotalCents, 600, "already-have never changes meal cost");

// Non-planned items do not cost or shop.
const weekSkip = costWeek({
  entries: [{ item: { ...mkItem("s", "2026-10-29"), status: "intentional_skip" }, recipe: flourMeal }],
  matches, priceItems: items, storeKey: "colemans",
});
eq(weekSkip.shoppingLines.length, 0, "an intentional skip buys nothing");
eq(weekSkip.purchaseTotalCents, 0, "skip week spends nothing");

console.log(`${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);

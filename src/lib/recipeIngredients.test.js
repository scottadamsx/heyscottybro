// Plain-assertion tests for recipeIngredients.js. Run: node src/lib/recipeIngredients.test.js
import {
  normalizeIngredientName, parseLegacyIngredient, structuredFromLegacy,
  cleanIngredientLine, recipeLines,
} from "./recipeIngredients.js";

let pass = 0, failCount = 0;
const ok = (cond, label) => { if (cond) pass++; else { failCount++; console.error("FAIL:", label); } };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

eq(normalizeIngredientName("  Olive Oil! "), "olive oil", "normalize strips punctuation and case");
eq(normalizeIngredientName("Extra-Virgin   Olive Oil"), "extra virgin olive oil", "normalize collapses spaces");

const grams = parseLegacyIngredient({ item: "Flour", quantity: "500 g" });
eq(grams.parse_status, "ready", "grams parse ready");
eq(grams.unit_kind, "mass", "grams are mass");
eq(grams.quantity_milliunits, 500000, "500 g = 500000 milli");

const kg = parseLegacyIngredient({ item: "Potatoes", quantity: "1 kg" });
eq(kg.quantity_milliunits, 1000000, "1 kg = 1000000 milli");

const cups = parseLegacyIngredient({ item: "Milk", quantity: "2 cups" });
eq(cups.unit_kind, "volume", "cups are volume");
eq(cups.quantity_milliunits, 500000, "2 cups = 500 ml in milliunits");

const halfTsp = parseLegacyIngredient({ item: "Salt", quantity: "1/2 tsp" });
eq(halfTsp.quantity_milliunits, 2500, "1/2 tsp = 2.5 ml in milliunits");

const pinch = parseLegacyIngredient({ item: "Salt", quantity: "a pinch" });
eq(pinch.parse_status, "needs_review", "a pinch needs review");
eq(pinch.costable, false, "needs review is not costable");
eq(pinch.quantity_milliunits, null, "needs review carries no guessed quantity");

const range = parseLegacyIngredient({ item: "Garlic", quantity: "2-3 cloves" });
eq(range.parse_status, "needs_review", "a range needs review");

const count = parseLegacyIngredient({ item: "Eggs", quantity: "3" });
eq(count.unit_kind, "count", "bare number is a count");
eq(count.quantity_milliunits, 3000, "3 each = 3000 milli");

const can = parseLegacyIngredient({ item: "Tomatoes", quantity: "1 can" });
eq(can.unit_kind, "count", "a can is a count");
eq(can.quantity_milliunits, 1000, "1 can = 1000 milli");

const empty = parseLegacyIngredient({ item: "Herbs", quantity: "" });
eq(empty.parse_status, "needs_review", "no quantity needs review");

const lines = structuredFromLegacy([{ item: "Flour", quantity: "500 g" }, { item: "Salt", quantity: "a pinch" }]);
eq(lines.length, 2, "structuredFromLegacy maps all lines");
eq(lines[1].parse_status, "needs_review", "second line flagged");

const cleaned = cleanIngredientLine({ name: "Flour", unit_kind: "mass", quantity_milliunits: 500000, parse_status: "ready" });
eq(cleaned.normalized_name, "flour", "clean fills normalized name");

let threw = false;
try { cleanIngredientLine({ name: "Flour", unit_kind: "mass", quantity_milliunits: null, parse_status: "ready" }); }
catch { threw = true; }
ok(threw, "a ready line without quantity is rejected");

const legacyRecipe = { ingredients_schema_version: 1, ingredients: [{ item: "Rice", quantity: "200 g" }] };
eq(recipeLines(legacyRecipe)[0].quantity_milliunits, 200000, "recipeLines converts legacy on the fly");
const v2Recipe = { ingredients_schema_version: 2, ingredients: [{ name: "Rice", normalized_name: "rice", unit_kind: "mass", quantity_milliunits: 200000, parse_status: "ready", costable: true }] };
eq(recipeLines(v2Recipe)[0].name, "Rice", "recipeLines passes version 2 through");

console.log(`${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);

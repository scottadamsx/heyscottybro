// Source-boundary regression test for the food estimate contract.
// Bug (2026-10-20): FOOD_TOOL's items schema declared only name/quantity/calories,
// so the AI could never return per-item macros and item rows saved with 0 g
// protein/carbs/fat (meal totals were fine; per-item values were structurally
// impossible). The prompt also had no portion standard, so plated entrees came
// back at diet-portion sizes (a full chicken parmesan at 240 kcal).
// These assertions pin the contract in aiHealth.js so it cannot silently regress.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./aiHealth.js", import.meta.url), "utf8");

test("estimate_meal items schema requires per-item macros", () => {
  const itemsBlock = src.slice(src.indexOf("items: {"), src.indexOf("assumptions:"));
  for (const field of ["protein_g", "carbs_g", "fat_g"]) {
    assert.ok(itemsBlock.includes(`${field}: { type: "number" }`), `items schema is missing ${field}`);
  }
  assert.ok(
    itemsBlock.includes('required: ["name", "calories", "protein_g", "carbs_g", "fat_g"]'),
    "items required list must include the macro fields"
  );
});

test("estimate prompt carries the portion and consistency rules", () => {
  assert.ok(src.includes("a full plate"), "prompt must default to full plate portions");
  assert.ok(src.includes("EVERY item must carry its own protein_g"), "prompt must require per-item macros");
  assert.ok(src.includes("meal totals must equal the sum of the items"), "prompt must require total/item consistency");
});

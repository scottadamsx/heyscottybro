import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateFoodCore,
  normalizeFoodName,
  splitFoodItems,
  cacheRowToItem,
} from "./foodEstimateCore.js";

const PROFILE = "profile-123";

function cacheHarness(rows = {}) {
  const saved = [];
  const lookups = [];
  return {
    saved,
    lookups,
    cache: {
      lookupCache: async (profileId, name) => {
        lookups.push([profileId, name]);
        const key = normalizeFoodName(name);
        return rows[key] || null;
      },
      saveToCache: async (profileId, item) => {
        saved.push([profileId, item]);
        return "cache-id-1";
      },
    },
  };
}

function aiHarness(meal) {
  const calls = [];
  return {
    calls,
    aiFlow: async (text) => {
      calls.push(text);
      return { input: meal, searches: [] };
    },
  };
}

const veggieStrawsRow = {
  name_display: "Veggie Straws",
  name_normalized: "veggie straws",
  calories: 140,
  protein_g: 1,
  carbs_g: 17,
  fat_g: 7,
  quantity_basis: "1 bag (28g)",
  source: "Old Dutch official nutrition",
  source_url: "",
};

test("normalizeFoodName lowercases and strips punctuation", () => {
  assert.equal(normalizeFoodName("  Veggie-Straws! "), "veggie straws");
  assert.equal(normalizeFoodName("Grenade White Oreo Bar"), "grenade white oreo bar");
});

test("splitFoodItems breaks a multi-item description apart", () => {
  assert.deepEqual(
    splitFoodItems("Veggie Straws, Grenade White Oreo Bar and a Coke"),
    ["Veggie Straws", "Grenade White Oreo Bar", "a Coke"],
  );
  assert.deepEqual(splitFoodItems("Veggie Straws"), ["Veggie Straws"]);
  assert.deepEqual(splitFoodItems(""), []);
});

test("repeat estimate of a cached item makes zero AI calls", async () => {
  const { cache, saved } = cacheHarness({ "veggie straws": veggieStrawsRow });
  const { aiFlow, calls } = aiHarness({});
  const out = await estimateFoodCore("Veggie Straws", {
    mealType: "snack",
    profileId: PROFILE,
    aiFlow,
    cache,
  });
  assert.equal(calls.length, 0, "AI must not be called for a cached item");
  assert.equal(saved.length, 0, "nothing new to save");
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].cached, true);
  assert.equal(out.items[0].name, "Veggie Straws");
  assert.equal(out.calories, 140);
  assert.deepEqual(out.searches, []);
});

test("mixed cached + unknown items: one AI call, new item cached", async () => {
  const { cache, saved } = cacheHarness({ "veggie straws": veggieStrawsRow });
  const freshMeal = {
    name: "Grenade White Oreo Bar",
    meal_type: "snack",
    calories: 220,
    protein_g: 20,
    carbs_g: 18,
    fat_g: 8,
    items: [{ name: "Grenade White Oreo Bar", quantity: "1 bar (60g)", calories: 220, protein_g: 20, carbs_g: 18, fat_g: 8 }],
    assumptions: "one 60g bar",
    source: "Grenade official nutrition",
    source_url: "",
  };
  const { aiFlow, calls } = aiHarness(freshMeal);
  const out = await estimateFoodCore("Veggie Straws and Grenade White Oreo Bar", {
    mealType: "snack",
    profileId: PROFILE,
    aiFlow,
    cache,
  });
  assert.equal(calls.length, 1, "exactly one AI call for the unknown item");
  assert.ok(calls[0].toLowerCase().includes("grenade"), "AI only asked about the unknown item");
  assert.ok(!calls[0].toLowerCase().includes("veggie"), "cached item excluded from the AI prompt");
  assert.equal(out.items.length, 2);
  const cached = out.items.find((i) => i.name === "Veggie Straws");
  const fresh = out.items.find((i) => i.name === "Grenade White Oreo Bar");
  assert.equal(cached.cached, true);
  assert.equal(fresh.cached, false);
  assert.equal(saved.length, 1, "the new item was saved to the cache");
  assert.equal(saved[0][1].name, "Grenade White Oreo Bar");
});

test("no profileId skips the cache entirely (old behaviour)", async () => {
  const { cache } = cacheHarness({ "veggie straws": veggieStrawsRow });
  const freshMeal = {
    name: "Veggie Straws",
    meal_type: "snack",
    calories: 140,
    protein_g: 1,
    carbs_g: 17,
    fat_g: 7,
    items: [{ name: "Veggie Straws", quantity: "1 bag", calories: 140 }],
    assumptions: "",
    source: "estimated",
    source_url: "",
  };
  const { aiFlow, calls } = aiHarness(freshMeal);
  const out = await estimateFoodCore("Veggie Straws", { mealType: "snack", aiFlow, cache });
  assert.equal(calls.length, 1, "without a profile the AI flow runs as before");
  assert.equal(out.items[0].cached, false);
});

test("cacheRowToItem flags the item as cached", () => {
  const item = cacheRowToItem(veggieStrawsRow);
  assert.equal(item.cached, true);
  assert.equal(item.calories, 140);
  assert.equal(item.quantity, "1 bag (28g)");
});

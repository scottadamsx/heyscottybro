// ── Grocery price snapshots + ingredient matches (connected-pages.md §2.1) ──
// Imports write a new snapshot; a failed write leaves the previous snapshot
// active. Only a successful import supersedes the older ones.

import { supabase } from "../utils/supabase.js";
import { uid, fail } from "./_base.js";
import { parsePriceDataset, checksumOf } from "../lib/priceImport.js";

export async function importPriceSnapshot({ sourceName, text }) {
  const user_id = await uid();
  const { items, rejected, capturedAt } = parsePriceDataset(text, sourceName);
  if (!items.length) {
    throw new Error(`Nothing importable in that file: all ${rejected.length} rows were rejected.`);
  }
  const checksum = checksumOf(text);
  const notes = rejected.length
    ? `${rejected.length} rows rejected. First reasons: ${rejected.slice(0, 5).map((r) => `row ${r.index + 2}: ${r.reason}`).join("; ")}`
    : null;
  const { data: imp, error } = await supabase.from("grocery_price_imports").insert({
    user_id,
    source_name: sourceName || "price dataset",
    checksum,
    captured_at: `${capturedAt}T00:00:00.000Z`,
    row_count: items.length,
    rejected_count: rejected.length,
    status: "imported",
    notes,
  }).select().single();
  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) {
      throw new Error("This exact dataset was already imported (same checksum).");
    }
    throw fail("groceryPricesApi.importPriceSnapshot", error);
  }
  try {
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400).map((it) => ({ ...it, user_id, import_id: imp.id }));
      const { error: itemError } = await supabase.from("grocery_price_items").insert(chunk);
      if (itemError) throw itemError;
    }
  } catch (e) {
    // Roll the import back so the previous snapshot stays the active one.
    await supabase.from("grocery_price_imports").delete().eq("id", imp.id);
    throw fail("groceryPricesApi.importPriceSnapshot(items)", e);
  }
  await supabase.from("grocery_price_imports")
    .update({ status: "superseded" })
    .eq("user_id", user_id).eq("status", "imported").neq("id", imp.id);
  return { importRow: imp, accepted: items.length, rejected };
}

export async function loadPriceImports() {
  const user_id = await uid();
  const { data, error } = await supabase.from("grocery_price_imports")
    .select("*").eq("user_id", user_id).order("imported_at", { ascending: false });
  if (error) throw fail("groceryPricesApi.loadPriceImports", error);
  return data || [];
}

/** The active snapshot: newest non-superseded import and all of its items. */
export async function loadActivePriceSnapshot() {
  const imports = await loadPriceImports();
  const active = imports.find((i) => i.status === "imported") || null;
  if (!active) return { importRow: null, items: [] };
  const user_id = await uid();
  const items = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("grocery_price_items")
      .select("*").eq("user_id", user_id).eq("import_id", active.id)
      .order("id").range(from, from + PAGE - 1);
    if (error) throw fail("groceryPricesApi.loadActivePriceSnapshot", error);
    items.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { importRow: active, items };
}

// ── Ingredient → product matches ─────────────────────────────────────────────

export async function loadMatches() {
  const user_id = await uid();
  const { data, error } = await supabase.from("ingredient_product_matches")
    .select("*").eq("user_id", user_id).order("normalized_ingredient");
  if (error) throw fail("groceryPricesApi.loadMatches", error);
  return data || [];
}

export async function saveMatch({ normalized_ingredient, store_key, external_product_key, status = "confirmed" }) {
  const user_id = await uid();
  const { data, error } = await supabase.from("ingredient_product_matches")
    .upsert({
      user_id, normalized_ingredient, store_key, external_product_key, status,
    }, { onConflict: "user_id,normalized_ingredient,store_key" })
    .select().single();
  if (error) throw fail("groceryPricesApi.saveMatch", error);
  return data;
}

export async function deleteMatch(id) {
  const { error } = await supabase.from("ingredient_product_matches").delete().eq("id", id);
  if (error) throw fail("groceryPricesApi.deleteMatch", error);
}

import { supabase } from "../utils/supabase";
import { newTransaction } from "./plannerApi";

const BUCKET = "receipts";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

// ── Stores ──────────────────────────────────────────────────────────────────
export async function loadStores() {
  const userId = await uid();
  const { data, error } = await supabase.from("grocery_stores").select("*").eq("user_id", userId).order("name");
  if (error) throw error;
  return data ?? [];
}

/** Find a store by name (case-insensitive) or create it. Returns its id. */
export async function findOrCreateStore(name) {
  const clean = (name || "").trim();
  if (!clean) return null;
  const userId = await uid();
  const { data, error } = await supabase.from("grocery_stores")
    .upsert({ user_id: userId, name: clean }, { onConflict: "user_id,name" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

// ── Receipt images (private 'receipts' bucket: <user_id>/<file>) ──────────────
export async function uploadReceiptImage(file, receiptId) {
  const userId = await uid();
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${receiptId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg", upsert: true,
  });
  if (error) throw error;
  await supabase.from("grocery_receipts").update({ image_path: path }).eq("id", receiptId).eq("user_id", userId);
  return path;
}

export async function receiptImageUrl(path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

// ── Receipts + line items ─────────────────────────────────────────────────────
/**
 * Save a parsed receipt and its line items.
 * receipt: { store_id, purchase_date, subtotal, total }
 * items:   [{ raw_text, quantity, unit_price, total_price }]
 */
export async function saveReceipt(receipt, items) {
  const userId = await uid();
  const { data: r, error: e1 } = await supabase.from("grocery_receipts")
    .insert({ user_id: userId, ...receipt }).select().single();
  if (e1) throw e1;
  const rows = (items || []).filter((it) => (it.raw_text || "").trim()).map((it) => ({
    user_id: userId, receipt_id: r.id,
    raw_text: it.raw_text.trim(),
    quantity: it.quantity ?? 1,
    unit_price: it.unit_price ?? null,
    total_price: it.total_price ?? null,
  }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("grocery_receipt_items").insert(rows);
    if (e2) throw e2;
  }
  return r;
}

export async function loadReceipts() {
  const userId = await uid();
  const { data, error } = await supabase.from("grocery_receipts")
    .select("*, grocery_stores(name), grocery_receipt_items(id)")
    .eq("user_id", userId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    store_name: r.grocery_stores?.name || null,
    item_count: (r.grocery_receipt_items || []).length,
  }));
}

export async function loadReceiptItems(receiptId) {
  const userId = await uid();
  const { data, error } = await supabase.from("grocery_receipt_items")
    .select("*").eq("user_id", userId).eq("receipt_id", receiptId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function deleteReceipt(id) {
  const userId = await uid();
  try {
    const { data } = await supabase.from("grocery_receipts").select("image_path").eq("id", id).single();
    if (data?.image_path) await supabase.storage.from(BUCKET).remove([data.image_path]);
  } catch { /* non-fatal */ }
  const { error } = await supabase.from("grocery_receipts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/** Post a receipt total to the budget as a Groceries expense in the transactions table. */
export async function postReceiptToBudget({ total, purchase_date, storeName }) {
  return newTransaction({
    description: `Groceries: ${storeName || "store"}`,
    amount: Math.abs(Number(total) || 0),
    type: "expense",
    category: "Groceries",
    date: purchase_date,
    notes: "Logged from receipt",
  });
}

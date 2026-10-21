// src/api/binApi.js
// The Bin: holding spaces for text, files, and links Scott drops in from any
// computer so Muse can work them or save them as context (docs/features/bin.md).
// Mirrors documentsApi.js: owner-scoped Supabase calls, files in the same
// private "documents" bucket under <user_id>/bin/<item_id>/<name>.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { getSignedUrl } from "./documentsApi";

const BUCKET = "documents";
export { getSignedUrl };

/** List the owner's bin items, newest first. */
export async function loadBinItems() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("bin_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Add a text or link space. For links, body holds the URL (note after a newline). */
export async function createBinItem({ kind, title, body, isContext = false }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("bin_items")
    .insert({ user_id: userId, kind, title: title?.trim() || "Untitled", body: body ?? null, is_context: isContext })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Upload a file into the bin (storage first, row second, rollback on failure). */
export async function uploadBinFile(file, { title, isContext = false } = {}) {
  const userId = await uid();
  const itemId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${userId}/bin/${itemId}/${safeName}`;

  // The documents bucket's allowed MIME list has no markdown entry; send
  // .md/.txt as text/plain so the upload is accepted.
  const contentType = /\.(md|txt)$/i.test(file.name) ? "text/plain" : (file.type || "application/octet-stream");
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from("bin_items")
    .insert({
      id: itemId,
      user_id: userId,
      kind: "file",
      title: title?.trim() || file.name,
      file_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      is_context: isContext,
    })
    .select()
    .single();
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath]); // rollback
    throw dbError;
  }
  return data;
}

/** Patch a bin item (title, status, is_context, body). */
export async function updateBinItem(id, fields) {
  const patch = {};
  ["title", "status", "is_context", "body"].forEach((k) => { if (fields[k] !== undefined) patch[k] = fields[k]; });
  const { data, error } = await supabase.from("bin_items").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Delete a bin item (its storage file first, when it has one). */
export async function deleteBinItem(item) {
  if (item.file_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.file_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from("bin_items").delete().eq("id", item.id);
  if (error) throw error;
}

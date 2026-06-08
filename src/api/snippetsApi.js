// src/api/snippetsApi.js
// Vault is security-sensitive — no localStorage fallback. If Supabase is
// unreachable we surface an error rather than silently writing secrets to disk.
import { supabase } from "../utils/supabase";

export const VALID_TYPES = ["code", "password", "wifi", "card", "note", "other"];

/** @returns {Promise<string>} current user's UUID */
async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

/** Fetch all snippets for the current user, newest first. */
export async function getSnippets() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("snippets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Insert a new snippet. */
export async function createSnippet({ title, value, type, secret, notes }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("snippets")
    .insert({ user_id: userId, title, value, type, secret, notes: notes ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update an existing snippet (partial — only provided keys are changed). */
export async function updateSnippet(id, fields) {
  const allowed = ["title", "value", "type", "secret", "notes"];
  const patch = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  );
  if (Object.keys(patch).length === 0) throw new Error("No valid fields to update");
  const { data, error } = await supabase
    .from("snippets")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a snippet by id. */
export async function deleteSnippet(id) {
  const { error } = await supabase.from("snippets").delete().eq("id", id);
  if (error) throw error;
}

/** Bulk-insert (one-time localStorage import). Each item: { title, value, type, secret }. */
export async function importSnippets(items) {
  const userId = await uid();
  const rows = items.map(({ title, value, type, secret }) => ({
    user_id: userId,
    title,
    value,
    type: VALID_TYPES.includes(type) ? type : "other",
    secret: Boolean(secret),
  }));
  const { data, error } = await supabase.from("snippets").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

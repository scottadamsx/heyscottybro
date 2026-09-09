import { supabase, getAuthHeaders } from "../utils/supabase";
import { uid } from "./_base";
import { parseJsonResponse } from "../lib/http";


/** Load the whole brain: nodes + links for the current user. */
export async function loadBrain() {
  const userId = await uid();
  const [{ data: nodes, error: e1 }, { data: links, error: e2 }] = await Promise.all([
    supabase.from("brain_nodes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("brain_links").select("source_slug, target_slug").eq("user_id", userId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { nodes: nodes ?? [], links: links ?? [] };
}

export async function createNode({ slug, title, body = "", type = "note", tags = [], source = "" }) {
  const userId = await uid();
  const { data, error } = await supabase.from("brain_nodes")
    .upsert({ user_id: userId, slug, title, body, type, tags, source }, { onConflict: "user_id,slug" })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateNode(id, fields) {
  const { data, error } = await supabase.from("brain_nodes").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteNode(id) {
  const { error } = await supabase.from("brain_nodes").delete().eq("id", id);
  if (error) throw error;
}

/** Connect two nodes by slug (idempotent — the table's unique constraint on
 *  (user_id, source_slug, target_slug) means the upsert won't duplicate). */
export async function linkNodes(sourceSlug, targetSlug) {
  if (!sourceSlug || !targetSlug) throw new Error("source and target slugs are required");
  if (sourceSlug === targetSlug) throw new Error("a node can't link to itself");
  const userId = await uid();
  const { error } = await supabase.from("brain_links")
    .upsert({ user_id: userId, source_slug: sourceSlug, target_slug: targetSlug }, { onConflict: "user_id,source_slug,target_slug" });
  if (error) throw error;
  return { source_slug: sourceSlug, target_slug: targetSlug };
}

/** Node provenance value for everything that came from the markdown vault. */
export const VAULT_SOURCE = "vault";

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/**
 * Sync the brain from the local Obsidian/markdown vault (dev only).
 * Reads /api/brain-vault (a Vite dev endpoint), then replaces this user's
 * VAULT-SOURCED nodes + their outgoing links in Supabase with the parsed
 * result. Nodes written by agents (source = agent id, e.g. "galadriel",
 * "bilbo") or by hand are left alone — the old wholesale delete wiped every
 * daily summary and research note on each sync.
 */
export async function syncFromVault() {
  const res = await fetch("/api/brain-vault", { headers: { ...(await getAuthHeaders()) } });
  const data = await parseJsonResponse(res);
  if (!res.ok || data?.error) throw new Error(data?.message || data?.error || `Vault sync failed (${res.status})`);

  const userId = await uid();
  // The parser stamps `source` with the file's relative path; normalise to the
  // single provenance value so vault rows are identifiable on the next sync.
  const nodes = (data.nodes || []).map((n) => ({ ...n, source: VAULT_SOURCE, user_id: userId }));
  const links = (data.links || []).map((l) => ({ ...l, user_id: userId }));

  // 1. Which rows are currently vault-sourced? Legacy syncs stored the .md path
  //    in `source`, so match those too — this is the one-time migration path.
  const { data: existing, error: e0 } = await supabase.from("brain_nodes")
    .select("slug, source").eq("user_id", userId)
    .or(`source.eq.${VAULT_SOURCE},source.like.*.md`); // PostgREST: * is the LIKE wildcard
  if (e0) throw new Error(`Vault sync: couldn't read existing vault nodes — ${e0.message}`);
  const staleSlugs = (existing || []).map((n) => n.slug);

  // 2. Drop the links the vault parser owns (those leaving a vault node), then
  //    the vault nodes that no longer exist in the vault. Nodes that still exist
  //    are upserted in place so agent links pointing AT them keep resolving.
  const incoming = new Set(nodes.map((n) => n.slug));
  const gone = staleSlugs.filter((s) => !incoming.has(s));
  for (const slugs of chunk(staleSlugs, 200)) {
    const { error } = await supabase.from("brain_links").delete().eq("user_id", userId).in("source_slug", slugs);
    if (error) throw new Error(`Vault sync: couldn't clear old vault links — ${error.message}`);
  }
  for (const slugs of chunk(gone, 200)) {
    const { error } = await supabase.from("brain_nodes").delete().eq("user_id", userId).in("slug", slugs);
    if (error) throw new Error(`Vault sync: couldn't remove deleted vault notes — ${error.message}`);
  }

  // 3. Upsert the vault set (unique on user_id,slug).
  for (const rows of chunk(nodes, 200)) {
    const { error } = await supabase.from("brain_nodes").upsert(rows, { onConflict: "user_id,slug" });
    if (error) throw new Error(`Vault sync: couldn't write vault notes — ${error.message}`);
  }
  // de-dupe defensively against the unique constraint
  const seen = new Set();
  const linkRows = links.filter((l) => { const k = `${l.source_slug}|${l.target_slug}`; if (seen.has(k)) return false; seen.add(k); return true; });
  for (const rows of chunk(linkRows, 500)) {
    const { error } = await supabase.from("brain_links").upsert(rows, { onConflict: "user_id,source_slug,target_slug", ignoreDuplicates: true });
    if (error) throw new Error(`Vault sync: couldn't write vault links — ${error.message}`);
  }
  return { nodes: nodes.length, links: linkRows.length, removed: gone.length, vault: data.vault };
}

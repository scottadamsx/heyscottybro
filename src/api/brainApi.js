import { supabase, getAuthHeaders } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

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

/** Connect two nodes by slug (idempotent — won't duplicate an existing link). */
export async function linkNodes(sourceSlug, targetSlug, agentId = null) {
  if (!sourceSlug || !targetSlug) throw new Error("source and target slugs are required");
  if (sourceSlug === targetSlug) throw new Error("a node can't link to itself");
  const userId = await uid();
  const { error } = await supabase.from("brain_links")
    .upsert({ user_id: userId, source_slug: sourceSlug, target_slug: targetSlug, agent_id: agentId }, { onConflict: "user_id,source_slug,target_slug" });
  if (error) throw error;
  return { source_slug: sourceSlug, target_slug: targetSlug };
}

/**
 * Sync the brain from the local Obsidian/markdown vault (dev only).
 * Reads /api/brain-vault (a Vite dev endpoint), then replaces this user's
 * nodes + links in Supabase with the parsed result.
 */
export async function syncFromVault() {
  const res = await fetch("/api/brain-vault", { headers: { ...(await getAuthHeaders()) } });
  const data = await res.json();
  if (data?.error) throw new Error(data.message || data.error);

  const userId = await uid();
  const nodes = (data.nodes || []).map((n) => ({ ...n, user_id: userId }));
  const links = (data.links || []).map((l) => ({ ...l, user_id: userId }));

  // Replace wholesale so deleted notes drop out of the graph too.
  await supabase.from("brain_links").delete().eq("user_id", userId);
  await supabase.from("brain_nodes").delete().eq("user_id", userId);
  if (nodes.length) {
    const { error } = await supabase.from("brain_nodes").insert(nodes);
    if (error) throw error;
  }
  if (links.length) {
    // de-dupe defensively against the unique constraint
    const seen = new Set();
    const rows = links.filter((l) => { const k = `${l.source_slug}|${l.target_slug}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const { error } = await supabase.from("brain_links").insert(rows);
    if (error) throw error;
  }
  return { nodes: nodes.length, links: links.length, vault: data.vault };
}

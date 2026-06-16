// src/api/docLinksApi.js
// Polymorphic links from any host item (reminder, event, project, initiative,
// agent, research request) to a Brain document, plus per-link read state.
// node_slug is resolved against brain_nodes at read time (no FK), so a vault
// re-sync that recreates nodes never drops a user's links.
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Host item types that can carry linked documents. */
export const ENTITY_TYPES = ["reminder", "event", "project", "initiative", "agent", "research"];

const asId = (v) => String(v);

/** Links for one host item, enriched with the linked node's title + type. */
export async function loadDocLinks(entityType, entityId) {
  const userId = await uid();
  const { data: links, error } = await supabase
    .from("doc_links")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", asId(entityId))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return enrich(userId, links ?? []);
}

/**
 * Batch: links for many host items of the same type. Returns a map
 * { entityId -> [{...link, node_title, node_type, node_missing}] } so a list
 * view can show counts/unread badges in one round-trip.
 */
export async function loadDocLinksFor(entityType, entityIds = []) {
  const ids = [...new Set(entityIds.map(asId))].filter(Boolean);
  if (ids.length === 0) return {};
  const userId = await uid();
  const { data: links, error } = await supabase
    .from("doc_links")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .in("entity_id", ids);
  if (error) throw error;
  const enriched = await enrich(userId, links ?? []);
  const map = {};
  for (const l of enriched) (map[l.entity_id] ||= []).push(l);
  return map;
}

// Join links to their brain nodes (title/type) by slug, in one query.
async function enrich(userId, links) {
  const slugs = [...new Set(links.map((l) => l.node_slug))];
  let nodesBySlug = {};
  if (slugs.length) {
    const { data: nodes } = await supabase
      .from("brain_nodes")
      .select("slug, title, type")
      .eq("user_id", userId)
      .in("slug", slugs);
    for (const n of nodes ?? []) nodesBySlug[n.slug] = n;
  }
  return links.map((l) => ({
    ...l,
    node_title: nodesBySlug[l.node_slug]?.title || l.node_slug,
    node_type: nodesBySlug[l.node_slug]?.type || "note",
    node_missing: !nodesBySlug[l.node_slug],
  }));
}

/** Attach a Brain doc to a host item (idempotent on the unique constraint). */
export async function attachDoc(entityType, entityId, nodeSlug) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("doc_links")
    .upsert(
      { user_id: userId, entity_type: entityType, entity_id: asId(entityId), node_slug: nodeSlug },
      { onConflict: "user_id,entity_type,entity_id,node_slug" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function detachDoc(id) {
  const { error } = await supabase.from("doc_links").delete().eq("id", id);
  if (error) throw error;
}

/** Mark a link read/unread; stamps read_at when marking read. */
export async function setDocRead(id, read) {
  const { data, error } = await supabase
    .from("doc_links")
    .update({ read, read_at: read ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch a single Brain node by slug (to open it in the viewer). */
export async function getNodeBySlug(slug) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("brain_nodes")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Total count of unread linked docs across everything (for a nav badge). */
export async function unreadDocCount() {
  const userId = await uid();
  const { count, error } = await supabase
    .from("doc_links")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
  return count || 0;
}

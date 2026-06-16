// src/api/researchApi.js
// Research requests: a "please research this" item you create, fulfilled by
// attaching deliverable docs (Brain nodes) via doc_links. Each request also
// carries its delivered-doc count + unread count for the list view.
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export const RESEARCH_STATUSES = ["open", "in_progress", "delivered", "archived"];

/** Load requests, each enriched with how many docs are attached / unread. */
export async function loadResearchRequests() {
  const userId = await uid();
  const [{ data: reqs, error }, { data: links }] = await Promise.all([
    supabase.from("research_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("doc_links").select("entity_id, read").eq("user_id", userId).eq("entity_type", "research"),
  ]);
  if (error) throw error;
  const counts = {};
  for (const l of links ?? []) {
    const c = (counts[l.entity_id] ||= { docs: 0, unread: 0 });
    c.docs += 1;
    if (!l.read) c.unread += 1;
  }
  return (reqs ?? []).map((r) => ({
    ...r,
    doc_count: counts[r.id]?.docs || 0,
    unread_count: counts[r.id]?.unread || 0,
  }));
}

export async function newResearchRequest({ title, details = "", assignee = "" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("research_requests")
    .insert({ user_id: userId, title: (title || "").trim(), details, assignee })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateResearchRequest(id, fields) {
  const { data, error } = await supabase
    .from("research_requests")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteResearchRequest(id) {
  const userId = await uid();
  // Remove this request's doc links first, then the request itself.
  await supabase.from("doc_links").delete().eq("user_id", userId).eq("entity_type", "research").eq("entity_id", String(id));
  const { error } = await supabase.from("research_requests").delete().eq("id", id);
  if (error) throw error;
}

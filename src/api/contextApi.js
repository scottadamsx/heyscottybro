// src/api/contextApi.js
// Shared context store — facts worth remembering about Scott & Maria.
// Backed by Supabase (context_entries) as the SINGLE source of truth.
// No localStorage fallback: if the DB is unreachable the error is surfaced,
// never silently masked with stale local data.
import { supabase, getAuthHeaders } from "../utils/supabase";

// Legacy localStorage key — read ONCE by syncLocalToCloud() to migrate the
// old browser-only facts up to the cloud. Never written to anymore.
const LEGACY_KEY = "context_store_v1";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

/** Load context from Supabase. Throws the real error on failure (no fallback). */
export async function loadContext() {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in — cannot load context.");
  const { data, error } = await supabase
    .from("context_entries").select("*").eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, ts: r.ts || Date.parse(r.created_at) || Date.now(), by: r.by, text: r.text, tags: r.tags || [], why: r.why }));
}

export async function addContextEntry({ text, tags = [], by = "manual", why = "saved manually" }) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in — cannot save context.");
  const { data, error } = await supabase
    .from("context_entries")
    .insert({ user_id: userId, text, tags, by, why, ts: Date.now() })
    .select().single();
  if (error) throw error;
  return { id: data.id, ts: data.ts, by: data.by, text: data.text, tags: data.tags || [], why: data.why };
}

export async function deleteContextEntry(id) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in — cannot delete context.");
  const { error } = await supabase.from("context_entries").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/** Replace the entire context store — used by Frodo's reorganize tool (requires user confirmation). */
export async function replaceContext(entries) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in — cannot reorganize context.");
  const del = await supabase.from("context_entries").delete().eq("user_id", userId);
  if (del.error) throw del.error;
  const clean = entries.map((e) => ({ text: e.text, tags: e.tags || [], by: e.by || "frodo", why: e.why || "", ts: e.ts || Date.now() }));
  if (clean.length) {
    const rows = clean.map((e) => ({ user_id: userId, ...e }));
    const { data, error } = await supabase.from("context_entries").insert(rows).select();
    if (error) throw error;
    return (data || []).map((r) => ({ id: r.id, ts: r.ts, by: r.by, text: r.text, tags: r.tags || [], why: r.why }));
  }
  return [];
}

/**
 * One-time migration: push the OLD browser-only facts (legacy localStorage)
 * up to Supabase, de-duped by normalized text against what's already there.
 * This is a recovery action, not an ongoing fallback. Throws on error.
 */
export async function syncLocalToCloud() {
  const userId = await uid();
  if (!userId) throw new Error("Sign in to sync context to the cloud.");
  let legacy = [];
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || []; } catch { legacy = []; }

  const norm = (t) => (t || "").trim().toLowerCase().replace(/\s+/g, " ");
  const { data: cloudRows, error } = await supabase.from("context_entries").select("text").eq("user_id", userId);
  if (error) throw error;
  const cloudKeys = new Set((cloudRows || []).map((r) => norm(r.text)));

  const toPush = legacy.filter((e) => e.text && !cloudKeys.has(norm(e.text)));
  if (toPush.length) {
    const rows = toPush.map((e) => ({ user_id: userId, text: e.text, tags: e.tags || [], by: e.by || "manual", why: e.why || "", ts: e.ts || Date.now() }));
    const { error: insErr } = await supabase.from("context_entries").insert(rows);
    if (insErr) throw insErr;
  }
  return { pushed: toPush.length, alreadyInCloud: cloudKeys.size };
}

/* ── AI refinement ───────────────────────────────
 * Rewrites a raw typed note into a clean, well-tagged fact via the same
 * Claude proxy Frodo uses. Forced tool use guarantees structured JSON. */
const REFINE_TOOL = {
  name: "save_fact",
  description: "Save the cleaned-up context fact",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The fact rewritten clearly in third person — one or two sentences, typos fixed, filler removed, every concrete detail kept (names, dates, amounts)" },
      tags: { type: "array", items: { type: "string" }, description: "Up to 5 short tags, e.g. ['Scott','Health']" },
      why: { type: "string", description: "Short reason this is worth remembering" },
    },
    required: ["text", "tags"],
  },
};

export async function refineContextEntry(raw) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "You clean up notes for a personal memory store about Scott and his partner Maria. Rewrite the note as a clear, concise third-person fact: fix typos, drop filler like 'remember that', and keep every concrete detail. Tag the people involved (Scott, Maria) plus topics.",
      tools: [REFINE_TOOL],
      tool_choice: { type: "tool", name: "save_fact" },
      messages: [{ role: "user", content: raw }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block?.input?.text) throw new Error("No refined fact returned");
  return block.input;
}

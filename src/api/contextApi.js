// src/api/contextApi.js
// Shared context store — facts worth remembering about Scott & Maria.
// Stored in localStorage so it works offline and doesn't need a DB table.
import { getAuthHeaders } from "../utils/supabase";

const KEY = "context_store_v1";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ctx${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getContext() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

export function addContextEntry({ text, tags = [], by = "manual", why = "saved manually" }) {
  const items = getContext();
  const entry = { id: genId(), ts: Date.now(), by, text, tags, why };
  items.push(entry);
  localStorage.setItem(KEY, JSON.stringify(items));
  return entry;
}

export function deleteContextEntry(id) {
  const items = getContext().filter(x => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(items));
}

/** Replace the entire context store — used by Frodo's reorganize tool (requires user confirmation). */
export function replaceContext(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
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

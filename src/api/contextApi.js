// src/api/contextApi.js
// Shared context store — facts worth remembering about Scott & Maria.
// Stored in localStorage so it works offline and doesn't need a DB table.

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

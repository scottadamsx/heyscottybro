/**
 * Tiny service-role Supabase REST helper for serverless functions that run
 * WITHOUT a user session (e.g. the daily Overseer cron). Uses the same
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars as api/_utils.js.
 */
const URL_ = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export function sbConfigured() {
  return !!(URL_ && KEY);
}

const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });

/** SELECT rows. `query` is a raw PostgREST query string, e.g. "user_id=eq.X&select=name,date". */
export async function sbSelect(table, query = "") {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`${table} select ${res.status}: ${await res.text()}`);
  return res.json();
}

/** PATCH rows matching `query` with `fields`. Returns the updated rows. */
export async function sbUpdate(table, query, fields) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`${table} update ${res.status}: ${await res.text()}`);
  return res.json();
}

/** UPSERT rows (merge on `onConflict` columns). Returns the affected rows. */
export async function sbUpsert(table, rows, onConflict) {
  const q = onConflict ? `?on_conflict=${onConflict}` : "";
  const res = await fetch(`${URL_}/rest/v1/${table}${q}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${await res.text()}`);
  return res.json();
}

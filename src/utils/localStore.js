/**
 * localStore — a tiny localStorage-backed stand-in for the Supabase tables.
 * Used as an automatic fallback when Supabase is unreachable (local testing),
 * so the whole admin keeps working offline. Data lives under "localdb:<table>".
 */
const PREFIX = "localdb:";

function read(table) {
  try {
    const v = localStorage.getItem(PREFIX + table);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
function write(table, rows) {
  // Quota errors must not crash the fallback path — it's the thing keeping
  // the app alive when Supabase is unreachable.
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(rows));
  } catch (err) {
    console.warn(`localStore: failed to write "${table}" (storage full or unavailable)`, err);
  }
}
function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const local = {
  list(table) {
    return read(table);
  },
  insert(table, row) {
    const rows = read(table);
    const r = { id: row.id ?? genId(), created_at: new Date().toISOString(), ...row };
    rows.push(r);
    write(table, rows);
    return r;
  },
  update(table, id, patch) {
    write(table, read(table).map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)));
  },
  remove(table, id) {
    write(table, read(table).filter((r) => String(r.id) !== String(id)));
  },
  singleton(table) {
    return read(table)[0] || null;
  },
  setSingleton(table, obj) {
    write(table, [obj]);
  },
};

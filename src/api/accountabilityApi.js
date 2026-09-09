/**
 * Accountability API — one state row per user in Supabase (accountability_state)
 * holding { schema, version, trackers, logs } as a jsonb blob.
 *
 * Concurrency: three surfaces write this blob (Habits page, the Today card and
 * agents). Every write goes through updateAccountability(), which loads fresh,
 * applies a small mutator and saves with an optimistic check on the blob's
 * `version` counter — a stale writer can never overwrite someone else's logs.
 *
 * QF-3: the blob is schema-versioned, load/save failures throw with context,
 * and an unrecognised shape is an error, never coerced to "no trackers".
 */
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { emitDataChange } from "../utils/dataEvents";

export const ACCOUNTABILITY_SCHEMA = 1;
const TABLE = "accountability_state";
const LOCAL_KEY = "accountability"; // write-only mirror, kept for the legacy seed path below
const VERSION_COL = "state->>version";

function empty() {
  return { schema: ACCOUNTABILITY_SCHEMA, version: 0, trackers: [], logs: [] };
}

/**
 * Validate + upgrade a stored blob. Throws on anything that is not the shape
 * this app understands — silently returning [] here is how data "vanished" in
 * the past (the incident behind QF-3).
 */
export function normalize(d) {
  if (d == null) return empty();
  if (typeof d !== "object" || Array.isArray(d)) {
    throw new Error(`Unrecognised accountability state: expected an object, got ${Array.isArray(d) ? "an array" : typeof d}`);
  }
  // Pre-versioned blobs (no `schema`) have the same shape as schema 1; they are
  // upgraded in place on the next write.
  const schema = d.schema ?? 0;
  if (schema !== 0 && schema !== ACCOUNTABILITY_SCHEMA) {
    throw new Error(`Unrecognised accountability schema ${schema} (this app understands schema ${ACCOUNTABILITY_SCHEMA}) — refusing to load so nothing is overwritten`);
  }
  if (!Array.isArray(d.trackers) || !Array.isArray(d.logs)) {
    throw new Error("Unrecognised accountability state: trackers/logs are not arrays — refusing to load so nothing is overwritten");
  }
  return {
    schema: ACCOUNTABILITY_SCHEMA,
    version: Number.isInteger(d.version) && d.version >= 0 ? d.version : 0,
    trackers: d.trackers,
    logs: d.logs,
  };
}

function clone(state) {
  return {
    ...state,
    trackers: state.trackers.map((t) => ({ ...t })),
    logs: state.logs.map((l) => ({ ...l })),
  };
}

function writeLocal(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* mirror only */ }
}
// The mirror is only ever READ to seed a brand-new account that has no row yet.
function readLocalSeed() {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY));
    const s = normalize(v);
    return s.trackers.length || s.logs.length ? s : null;
  } catch { return null; }
}

/** Raw row read: { exists, state, hadVersion } — hadVersion drives the optimistic filter. */
async function loadRow(userId) {
  const { data, error } = await supabase.from(TABLE).select("state").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return { exists: false, state: empty(), hadVersion: false };
  return { exists: true, state: normalize(data.state), hadVersion: Number.isInteger(data.state?.version) };
}

/**
 * Write `next` only if the row is still at `expectedVersion`. Returns the saved
 * state, or null when the row moved underneath us (conflict) or was created by
 * someone else in the meantime.
 */
async function writeVersioned(userId, next, expectedVersion, exists, hadVersion) {
  const state = { ...next, schema: ACCOUNTABILITY_SCHEMA, version: expectedVersion + 1 };
  const updated_at = new Date().toISOString();
  if (!exists) {
    const { error } = await supabase.from(TABLE).insert({ user_id: userId, state, updated_at });
    if (error) {
      if (error.code === "23505") return null; // unique(user_id): someone created the row first
      throw error;
    }
    return state;
  }
  let q = supabase.from(TABLE).update({ state, updated_at }).eq("user_id", userId);
  // Legacy rows have no `version` key at all; `->>` yields NULL for those.
  q = hadVersion ? q.eq(VERSION_COL, String(expectedVersion)) : q.is(VERSION_COL, null);
  const { data, error } = await q.select("user_id");
  if (error) throw error;
  return data && data.length > 0 ? state : null;
}

export async function loadAccountability() {
  try {
    const userId = await uid();
    const row = await loadRow(userId);
    if (row.exists) { writeLocal(row.state); return row.state; }
    // No row yet — seed from a valid local mirror so nothing is lost.
    const seed = readLocalSeed();
    if (seed) return await updateAccountability(() => seed);
    return empty();
  } catch (err) {
    console.error("[accountability] load failed", err);
    throw new Error(`Couldn't load accountability from Supabase: ${err?.message || err}`);
  }
}

/**
 * THE write path. `mutator(draft)` receives a deep copy of the freshest state
 * and returns the next state (or mutates the draft in place and returns
 * nothing). On a version conflict the fresh state is reloaded and the mutator
 * re-applied once; a second conflict throws.
 */
export async function updateAccountability(mutator) {
  let userId;
  try { userId = await uid(); }
  catch (err) { throw new Error(`Couldn't save accountability: ${err?.message || err}`); }

  for (let attempt = 0; attempt < 2; attempt++) {
    let row, next, saved;
    try {
      row = await loadRow(userId);
      const draft = clone(row.state);
      next = normalize(mutator(draft) ?? draft);
      saved = await writeVersioned(userId, next, row.state.version, row.exists, row.hadVersion);
    } catch (err) {
      console.error("[accountability] update failed", err);
      throw new Error(`Couldn't save accountability to Supabase: ${err?.message || err}`);
    }
    if (saved) {
      writeLocal(saved);
      emitDataChange("accountability");
      return saved;
    }
    console.warn(`[accountability] version conflict on attempt ${attempt + 1} — reloading and re-applying`);
  }
  throw new Error("Accountability changed elsewhere while saving (twice in a row). Reload the page and try again — nothing was overwritten.");
}

/**
 * Whole-snapshot save, kept for callers that still load → edit → save
 * (aiTools.log_habit, aiLibrary habits). The snapshot's own `version` (from
 * loadAccountability) is the optimistic check: if the row moved since that
 * load this throws instead of clobbering it. A snapshot without a version
 * cannot be checked and is written last-writer-wins with a loud warning —
 * migrate such callers to updateAccountability().
 */
export async function saveAccountability(data) {
  const next = normalize(data);
  const hasVersion = Number.isInteger(data?.version);
  if (!hasVersion) console.warn("[accountability] unversioned save — caller should use updateAccountability(mutator)");
  let userId;
  try { userId = await uid(); }
  catch (err) { throw new Error(`Couldn't save accountability: ${err?.message || err}`); }

  let saved;
  try {
    const row = await loadRow(userId);
    const expected = hasVersion ? next.version : row.state.version;
    saved = await writeVersioned(userId, next, expected, row.exists, row.hadVersion);
  } catch (err) {
    console.error("[accountability] save failed", err);
    throw new Error(`Couldn't save accountability to Supabase: ${err?.message || err}`);
  }
  if (!saved) {
    throw new Error("Accountability changed elsewhere since it was loaded — your change was NOT saved. Reload and try again.");
  }
  writeLocal(saved);
  emitDataChange("accountability");
  return { ok: true, state: saved };
}

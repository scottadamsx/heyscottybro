/**
 * Accountability API — one state row per user in Supabase (accountability_state)
 * holding { schema, version, trackers, logs, misses } as a jsonb blob.
 *
 * Schema 2 (2026-09-14, DR-014) adds `misses`: [{ id, trackerId, date, at }] —
 * "Missed it" marks for a day a habit won't get done. A miss is never a log:
 * it doesn't count as done and doesn't extend a streak. It moves the habit's
 * next due date on (see habitSchedule.dueHabits). Schema 1/0 blobs upgrade
 * in place with misses: []; an older app build refuses a schema-2 blob rather
 * than dropping the misses on its next save.
 *
 * Concurrency: three surfaces write this blob (Habits page, the Today card and
 * agents). Every write goes through updateAccountability(), which loads fresh,
 * applies a small mutator and saves with an optimistic check on the blob's
 * `version` counter — a stale writer can never overwrite someone else's logs.
 *
 * QF-3: the blob is schema-versioned, load/save failures throw with context,
 * and an unrecognised shape is an error, never coerced to "no trackers".
 */
import { validateHabitSchedule } from "../utils/habitSchedule";
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { emitDataChange } from "../utils/dataEvents";
import { cachedRead } from "./_cache";
import { loadWorkLog, createWorkLog, deleteWorkLog } from "./workLogApi";

export const ACCOUNTABILITY_SCHEMA = 2;
const TABLE = "accountability_state";
const LOCAL_KEY = "accountability"; // write-only mirror, kept for the legacy seed path below
const VERSION_COL = "state->>version";

function empty() {
  return { schema: ACCOUNTABILITY_SCHEMA, version: 0, trackers: [], logs: [], misses: [] };
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
  // Pre-versioned blobs (no `schema`) and schema 1 are schema 2 without
  // `misses`; they are upgraded in place on the next write.
  const schema = d.schema ?? 0;
  if (![0, 1, ACCOUNTABILITY_SCHEMA].includes(schema)) {
    throw new Error(`Unrecognised accountability schema ${schema} (this app understands schema ${ACCOUNTABILITY_SCHEMA}) — refusing to load so nothing is overwritten`);
  }
  if (!Array.isArray(d.trackers) || !Array.isArray(d.logs)) {
    throw new Error("Unrecognised accountability state: trackers/logs are not arrays — refusing to load so nothing is overwritten");
  }
  if (d.misses !== undefined && !Array.isArray(d.misses)) {
    throw new Error("Unrecognised accountability state: misses is not an array — refusing to load so nothing is overwritten");
  }
  for (const tracker of d.trackers) {
    if (tracker.schedule !== undefined) validateHabitSchedule(tracker.schedule);
  }
  return {
    schema: ACCOUNTABILITY_SCHEMA,
    version: Number.isInteger(d.version) && d.version >= 0 ? d.version : 0,
    trackers: d.trackers,
    logs: d.logs,
    misses: d.misses || [],
  };
}

function clone(state) {
  return {
    ...state,
    trackers: state.trackers.map((t) => ({ ...t, ...(t.schedule === undefined ? {} : { schedule: { ...t.schedule } }) })),
    logs: state.logs.map((l) => ({ ...l })),
    misses: (state.misses || []).map((m) => ({ ...m })),
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

/** Shared read (api/_cache.js): dropped by every versioned write, which emits "accountability". */
export function loadAccountability() {
  return cachedRead("loadAccountability", "accountability", loadAccountabilityUncached);
}

async function loadAccountabilityUncached() {
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
    throw new Error(`Couldn't load accountability from Supabase: ${err?.message || err}`, { cause: err });
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
  catch (err) { throw new Error(`Couldn't save accountability: ${err?.message || err}`, { cause: err }); }

  for (let attempt = 0; attempt < 2; attempt++) {
    let row, next, saved;
    try {
      row = await loadRow(userId);
      const draft = clone(row.state);
      next = normalize(mutator(draft) ?? draft);
      saved = await writeVersioned(userId, next, row.state.version, row.exists, row.hadVersion);
    } catch (err) {
      console.error("[accountability] update failed", err);
      throw new Error(`Couldn't save accountability to Supabase: ${err?.message || err}`, { cause: err });
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
  catch (err) { throw new Error(`Couldn't save accountability: ${err?.message || err}`, { cause: err }); }

  let saved;
  try {
    const row = await loadRow(userId);
    const expected = hasVersion ? next.version : row.state.version;
    saved = await writeVersioned(userId, next, expected, row.exists, row.hadVersion);
  } catch (err) {
    console.error("[accountability] save failed", err);
    throw new Error(`Couldn't save accountability to Supabase: ${err?.message || err}`, { cause: err });
  }
  if (!saved) {
    throw new Error("Accountability changed elsewhere since it was loaded — your change was NOT saved. Reload and try again.");
  }
  writeLocal(saved);
  emitDataChange("accountability");
  return { ok: true, state: saved };
}

/**
 * Habits ↔ Work log — a habit marked done that day also shows up in Plan →
 * Work, so "what did I actually do today" isn't split across two pages that
 * never talk to each other. Best-effort and one-way: a failure here never
 * fails the habit log itself, and it never overwrites a work_log row the
 * user edited by hand (deleteLog / the tracker's own edit form don't call
 * this — only the two canonical log/unlog paths below do).
 */
const habitWorkLogTag = (trackerId) => `habit:${trackerId}`;

async function mirrorHabitToWorkLog(tracker, date) {
  try {
    const tag = habitWorkLogTag(tracker.id);
    const rows = await loadWorkLog();
    // Idempotent per (tracker, date): a counter tracker tapped 8x today
    // shouldn't create 8 identical work log rows.
    if (rows.some((r) => r.date === date && r.notes === tag)) return;
    await createWorkLog({ date, task: tracker.name, notes: tag });
  } catch (err) {
    console.error("[accountability] couldn't mirror habit to work log", err);
  }
}

async function unmirrorHabitFromWorkLog(tracker, date) {
  try {
    const tag = habitWorkLogTag(tracker.id);
    const rows = await loadWorkLog();
    await Promise.all(rows.filter((r) => r.date === date && r.notes === tag).map((r) => deleteWorkLog(r.id)));
  } catch (err) {
    console.error("[accountability] couldn't remove habit's work log mirror", err);
  }
}

/**
 * THE canonical "mark this habit done for this day" write — used by the
 * Habits page, the Today card, and log_habit (agents), so the work log
 * mirror can never drift out of sync with one surface forgetting to call it.
 * Check-mode trackers already logged that day are a no-op (call
 * unlogHabitDone to toggle off instead).
 */
export async function logHabitDone(tracker, date) {
  const next = await updateAccountability((d) => {
    // Doing it after all beats "missed it": the same-day miss goes.
    d.misses = d.misses.filter((m) => !(m.trackerId === tracker.id && m.date === date));
    if (tracker.mode === "check" && d.logs.some((l) => l.trackerId === tracker.id && l.date === date)) return;
    d.logs.push({ id: crypto.randomUUID(), trackerId: tracker.id, date, at: Date.now() });
  });
  await mirrorHabitToWorkLog(tracker, date);
  return next;
}

/** Undo every log for one habit/day (a check-mode toggle-off) and its mirror. */
export async function unlogHabitDone(tracker, date) {
  const next = await updateAccountability((d) => {
    d.logs = d.logs.filter((l) => !(l.trackerId === tracker.id && l.date === date));
  });
  await unmirrorHabitFromWorkLog(tracker, date);
  return next;
}

/**
 * "Missed it" — cross a habit out for a day it won't get done. Idempotent per
 * (tracker, day). Refused when the habit is already logged that day (undo the
 * log first) so a day can never read as both done and missed.
 */
export async function logHabitMissed(tracker, date) {
  return updateAccountability((d) => {
    if (d.logs.some((l) => l.trackerId === tracker.id && l.date === date)) {
      throw new Error(`${tracker.name} is already logged for that day — remove the log before marking it missed.`);
    }
    if (d.misses.some((m) => m.trackerId === tracker.id && m.date === date)) return;
    d.misses.push({ id: crypto.randomUUID(), trackerId: tracker.id, date, at: Date.now() });
  });
}

/** Undo "Missed it" for one habit/day. */
export async function unlogHabitMissed(tracker, date) {
  return updateAccountability((d) => {
    d.misses = d.misses.filter((m) => !(m.trackerId === tracker.id && m.date === date));
  });
}

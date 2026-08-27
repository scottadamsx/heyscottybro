/**
 * Accountability API — one state row per user in Supabase (accountability_state),
 * holding { trackers, logs } as a jsonb blob, with a localStorage mirror so it
 * keeps working offline. Same load/save + auto-fallback shape as weedApi.
 */
import { supabase } from "../utils/supabase";
import { uid } from "./_base";

const LOCAL_KEY = "accountability";
const EMPTY = { trackers: [], logs: [] };


function normalize(d) {
  return {
    trackers: Array.isArray(d?.trackers) ? d.trackers : [],
    logs: Array.isArray(d?.logs) ? d.logs : [],
  };
}
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch { return null; }
}
function writeLocal(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

export async function loadAccountability() {
  try {
    const userId = await uid();
    if (!userId) return normalize(readLocal());
    const { data, error } = await supabase
      .from("accountability_state").select("state").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      const s = normalize(data.state);
      writeLocal(s);
      return s;
    }
    // No row yet — seed from any local data so nothing is lost, then return it.
    const local = normalize(readLocal());
    if (local.trackers.length || local.logs.length) { await saveAccountability(local); return local; }
    return { ...EMPTY };
  } catch (err) {
    // QF-3: a real Supabase error must not silently degrade to the local mirror.
    console.error("[accountability] load failed", err);
    throw new Error(`Couldn't load accountability from Supabase: ${err?.message || err}`);
  }
}

export async function saveAccountability(data) {
  const state = normalize(data);
  writeLocal(state); // offline mirror stays current regardless of network
  try {
    const userId = await uid();
    if (!userId) return { ok: true, local: true };
    const { error } = await supabase.from("accountability_state").upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    // The localStorage mirror is already written; the caller decides how to surface this.
    console.error("[accountability] save failed", err);
    throw new Error(`Couldn't save accountability to Supabase: ${err?.message || err}`);
  }
}

/**
 * Wind-down tracker API — one state row per user in Supabase (weed_state); the
 * whole tracker is a single schema-versioned jsonb blob.
 *
 * QF-3: no silent fallback. A Supabase error on load or save THROWS with
 * context; the page decides how to surface it. An unrecognised blob shape is
 * an error too (normalizeWeedState), never a reset to a fresh tracker.
 */
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { freshState, normalizeWeedState } from "../utils/weedCalc";

const TABLE = "weed_state";

export async function loadWeedState() {
  try {
    const userId = await uid();
    const { data, error } = await supabase
      .from(TABLE).select("state").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return freshState(); // no row yet: a genuinely new tracker
    return normalizeWeedState(data.state);
  } catch (err) {
    console.error("[weed] load failed", err);
    throw new Error(`Couldn't load the wind-down tracker from Supabase: ${err?.message || err}`);
  }
}

export async function saveWeedState(state) {
  try {
    const next = normalizeWeedState(state);
    const userId = await uid();
    const { error } = await supabase.from(TABLE).upsert(
      { user_id: userId, state: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return next;
  } catch (err) {
    console.error("[weed] save failed", err);
    throw new Error(`Couldn't save the wind-down tracker to Supabase: ${err?.message || err}`);
  }
}

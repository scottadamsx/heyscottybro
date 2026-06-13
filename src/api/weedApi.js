/**
 * Weed tracker API — one state row per user in Supabase (weed_state), with a
 * localStorage mirror so it keeps working offline. Same load/save +
 * automatic-fallback shape as the other API modules; the whole tracker state
 * is stored as a single jsonb blob, which is plenty for one user and keeps the
 * page logic unchanged.
 */
import { supabase } from "../utils/supabase";
import { STORAGE_KEY, freshState } from "../utils/weedCalc";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

function readLocal() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
function writeLocal(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

// Fill in any missing keys so older/partial state never breaks the views.
function withDefaults(state) {
  const fresh = freshState();
  if (!state) return fresh;
  return {
    ...fresh, ...state,
    scott: { ...fresh.scott, ...(state.scott || {}) },
    maria: { ...fresh.maria, ...(state.maria || {}) },
  };
}

export async function loadWeedState() {
  try {
    const userId = await uid();
    if (!userId) return withDefaults(readLocal());
    const { data, error } = await supabase
      .from("weed_state").select("state").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      const merged = withDefaults(data.state);
      writeLocal(merged);
      return merged;
    }
    // No row yet — seed from any local data so nothing is lost, then return it.
    const local = readLocal();
    if (local) { await saveWeedState(local); return withDefaults(local); }
    return freshState();
  } catch {
    return withDefaults(readLocal());
  }
}

export async function saveWeedState(state) {
  writeLocal(state); // offline mirror stays current regardless of network
  try {
    const userId = await uid();
    if (!userId) return;
    const { error } = await supabase.from("weed_state").upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  } catch { /* offline: localStorage mirror already written above */ }
}

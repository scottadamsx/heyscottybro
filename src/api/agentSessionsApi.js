/**
 * Persist Command Center conversations so they survive a refresh. One row per
 * (user, agent): `display` is the visible thread, `convo` is the Anthropic
 * message history (so the agent keeps its context too). Fails soft — if the
 * table isn't there yet, the Command Center just behaves as before (in-memory).
 */
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/** Returns a map: { [agentId]: { display, convo } }. */
export async function loadAgentSessions() {
  const userId = await uid();
  if (!userId) return {};
  const { data, error } = await supabase
    .from("agent_sessions").select("agent_id, display, convo").eq("user_id", userId);
  if (error) return {};
  const map = {};
  for (const r of data || []) map[r.agent_id] = { display: r.display || [], convo: r.convo || [] };
  return map;
}

export async function saveAgentSession(agentId, { display, convo }) {
  const userId = await uid();
  if (!userId) return;
  try {
    await supabase.from("agent_sessions").upsert(
      { user_id: userId, agent_id: agentId, display, convo, updated_at: new Date().toISOString() },
      { onConflict: "user_id,agent_id" },
    );
  } catch { /* table not migrated yet — stay in-memory */ }
}

export async function clearAgentSession(agentId) {
  const userId = await uid();
  if (!userId) return;
  try { await supabase.from("agent_sessions").delete().eq("user_id", userId).eq("agent_id", agentId); }
  catch { /* noop */ }
}

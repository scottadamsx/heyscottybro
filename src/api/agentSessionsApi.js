/**
 * Persist agent conversations so they survive a refresh. One row per
 * (user, agent_id): `display` is the visible thread, `convo` is the Anthropic
 * message history (so the agent keeps its context too).
 *
 * agent_id keys: the ChatBot Frodo saves under "frodo"; a Command Center agent
 * saves under `${agent.id}:cc` (see ccSessionKey) so the two chats don't
 * overwrite each other's row.
 *
 * supabase-js never throws on a failed query — it returns `{ error }`. Every
 * call here inspects it and surfaces it; silently returning {} was why history
 * "randomly" vanished with nothing in the console (QF-3: no silent fallback).
 */
import { supabase } from "../utils/supabase";
import { uid } from "./_base";

export const ccSessionKey = (agentId) => `${agentId}:cc`;

async function softUid() {
  try { return await uid(); } catch { return null; }
}

/** Returns a map: { [agentId]: { display, convo } }. Throws on a real load error. */
export async function loadAgentSessions() {
  const userId = await softUid();
  if (!userId) return {};
  const { data, error } = await supabase
    .from("agent_sessions").select("agent_id, display, convo").eq("user_id", userId);
  if (error) {
    console.error("[agent_sessions] load failed:", error);
    throw new Error(`Couldn't load chat history: ${error.message || error.code || "unknown error"}`);
  }
  const map = {};
  for (const r of data || []) map[r.agent_id] = { display: r.display || [], convo: r.convo || [] };
  return map;
}

export async function saveAgentSession(agentId, { display, convo }) {
  const userId = await softUid();
  if (!userId) return;
  const { error } = await supabase.from("agent_sessions").upsert(
    { user_id: userId, agent_id: agentId, display, convo, updated_at: new Date().toISOString() },
    { onConflict: "user_id,agent_id" },
  );
  if (error) {
    console.error(`[agent_sessions] save failed for ${agentId}:`, error);
    throw new Error(`Chat history isn't saving (${agentId}): ${error.message || error.code || "unknown error"}`);
  }
}

export async function clearAgentSession(agentId) {
  const userId = await softUid();
  if (!userId) return;
  const { error } = await supabase.from("agent_sessions").delete().eq("user_id", userId).eq("agent_id", agentId);
  if (error) {
    console.error(`[agent_sessions] clear failed for ${agentId}:`, error);
    throw new Error(`Couldn't clear chat history (${agentId}): ${error.message || error.code || "unknown error"}`);
  }
}

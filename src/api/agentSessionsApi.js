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
import { cachedRead, invalidateReads } from "./_cache";
import { createAgentSessionsStore, createOwnerScopedSessionReader } from "./agentSessionsCore";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";

export const ccSessionKey = (agentId) => `${agentId}:cc`;

const sessionStore = createAgentSessionsStore({
  captureOwnerId: captureEstablishedOwnerId,
  getUserId: (expectedOwnerId) => uid(expectedOwnerId),
  verifyOwnerId: (expectedOwnerId) => uid(expectedOwnerId),
  selectRows: async (userId) => supabase
    .from("agent_sessions")
    .select("agent_id, display, convo")
    .eq("user_id", userId),
  upsertRow: async (row) => supabase
    .from("agent_sessions")
    .upsert(row, { onConflict: "user_id,agent_id" }),
  deleteRow: async (userId, agentId) => supabase
    .from("agent_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("agent_id", agentId),
  onError: ({ action, agentId, error }) => {
    console.error(`[agent_sessions] ${action} failed${agentId ? ` for ${agentId}` : ""}:`, error);
  },
  // Drop a pre-existing result immediately, then again after a queued write:
  // a read made while that write waited must not remain cached as current.
  onMutationStart: () => invalidateReads("agent_sessions"),
  onMutationSettled: () => invalidateReads("agent_sessions"),
});

const readSessionsForCurrentOwner = createOwnerScopedSessionReader({
  captureOwner: sessionStore.captureLoadOwner,
  loadForOwner: sessionStore.loadForOwner,
  cacheRead: cachedRead,
});

/** Returns a map: { [agentId]: { display, convo } }. Throws on a real load error. */
/** Shared read: the chat and the agent runtime both ask on the same page load. */
export function loadAgentSessions(expectedOwnerId = null) {
  return expectedOwnerId ? sessionStore.load(expectedOwnerId) : readSessionsForCurrentOwner();
}

export function saveAgentSession(agentId, { display, convo }, expectedOwnerId = null) {
  return sessionStore.save(agentId, { display, convo }, expectedOwnerId);
}

export function clearAgentSession(agentId, expectedOwnerId = null) {
  return sessionStore.clear(agentId, expectedOwnerId);
}

/** List only row identifiers for lifecycle-wide privacy operations. This does
 * not hydrate or normalize message payloads, so one malformed transcript
 * cannot hide other historical rows from an explicitly confirmed clear. */
export async function listAgentSessionIds(expectedOwnerId = captureEstablishedOwnerId()) {
  const ownerId = await uid(expectedOwnerId);
  const { data, error } = await supabase
    .from("agent_sessions")
    .select("agent_id")
    .eq("user_id", ownerId);
  if (error) throw new Error(`Couldn't inventory chat history: ${error.message || error}`);
  if (!Array.isArray(data)) throw new Error("Couldn't inventory chat history: the session store returned an unsupported response.");
  return [...new Set(data.map((row) => row?.agent_id).filter((id) => typeof id === "string" && id))];
}

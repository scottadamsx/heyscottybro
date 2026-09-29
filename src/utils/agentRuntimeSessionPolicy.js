import { closePendingTurnForPersistence } from "./chatSessionPolicy.js";

export function createAgentRuntimeSessionGate() {
  let status = "idle";
  return {
    begin() { status = "loading"; },
    ready() { status = "ready"; },
    fail() { status = "failed"; },
    canMutate() { return status === "ready"; },
    status() { return status; },
  };
}

/** Clear is exclusive per agent, while unrelated agents may keep working. */
export function createAgentRuntimeMutationGate() {
  const clearing = new Set();
  return {
    beginClear(agentId) {
      if (clearing.has(agentId)) return false;
      clearing.add(agentId);
      return true;
    },
    finishClear(agentId) { clearing.delete(agentId); },
    canMutate(agentId) { return !clearing.has(agentId); },
    isClearing(agentId) { return clearing.has(agentId); },
  };
}

export function commandCenterThreadsFromSessions(sessions = {}) {
  const restored = {};
  for (const [key, value] of Object.entries(sessions || {})) {
    if (key.endsWith(":cc")) restored[key.slice(0, -3)] = value;
  }
  return restored;
}

/**
 * Build and publish one exact runtime-thread snapshot before asking persistence
 * to save it. React may defer a state update, so callers must never assign the
 * snapshot from inside a functional updater and then immediately try to save
 * that assignment.
 *
 * `publishThreads` is deliberately passed the complete next map. In React the
 * provider uses it to update both its synchronous ref and rendered state. The
 * persistence call therefore receives the same immutable thread snapshot even
 * when React has not rendered the update yet.
 */
export function commitRuntimeThreadSnapshot({
  currentThreads = {},
  agentId,
  convo,
  displayMessage,
  publishThreads,
  persistThread,
}) {
  const current = currentThreads[agentId] || { convo: [], display: [] };
  const thread = {
    convo: convo === undefined ? (current.convo || []) : convo,
    display: [...(current.display || []), displayMessage],
  };
  const threads = { ...currentThreads, [agentId]: thread };

  publishThreads(threads);

  let persistence = null;
  if (persistThread) {
    try {
      persistence = Promise.resolve(persistThread(agentId, thread));
    } catch (error) {
      persistence = Promise.reject(error);
    }
  }

  return { threads, thread, persistence };
}

export async function persistRuntimeCheckpoint({
  agentId,
  thread,
  history,
  persistThread,
  ownerId,
  note = "turn interrupted before a reply",
  phase = `Accepted ${agentId} turn`,
}) {
  const checkpoint = {
    ...thread,
    convo: closePendingTurnForPersistence(history, note),
  };
  const saved = await persistThread(agentId, checkpoint, ownerId);
  if (saved !== true) {
    throw new Error(`${phase} could not be saved; the turn stopped before continuing.`);
  }
  return checkpoint;
}

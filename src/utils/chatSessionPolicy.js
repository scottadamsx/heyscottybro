import { isValidDisplayHistory, isValidModelHistory } from "./chatMessageShape.js";

export function createSessionHistoryGate() {
  let status = "loading";
  return {
    begin() { status = "loading"; },
    ready() { status = "ready"; },
    fail() { status = "failed"; },
    canUse() { return status === "ready"; },
    needsRetry() { return status === "failed"; },
    status() { return status; },
  };
}

/**
 * Clear is an exclusive conversation mutation. The ref-backed gate changes in
 * the same JavaScript turn (before React can render `clearing`) so a second
 * Clear or Send cannot slip into the await gap.
 */
export function createSessionMutationGate() {
  let clearing = false;
  return {
    beginClear() {
      if (clearing) return false;
      clearing = true;
      return true;
    },
    finishClear() { clearing = false; },
    canMutate() { return !clearing; },
    isClearing() { return clearing; },
  };
}

export const UNOWNED_LEGACY_CHAT_KEY = "frodo_chat_session";

// Clearing deletes the durable row and resets this runtime. Without realtime
// invalidation, another already-open tab may still hold a stale in-memory copy,
// so user-facing copy must not promise immediate erasure from every device.
export const FRODO_CLEAR_CONFIRMATION = "Clear your saved conversation with Frodo and reset this chat session?";
export const FRODO_CLEAR_SUCCESS = "Saved conversation and this chat session cleared.";

export function unownedLegacyChatWarning(storage) {
  try {
    if (storage?.getItem(UNOWNED_LEGACY_CHAT_KEY) == null) return "";
  } catch {
    return "";
  }
  return "An older chat backup without account ownership is quarantined in this browser. It was not opened or imported. Keep browser storage intact and use an explicit recovery process before removing it.";
}

export function ownerBoundLegacyChatKey(ownerId) {
  if (typeof ownerId !== "string" || !ownerId) throw new Error("An authenticated owner is required for legacy chat recovery.");
  return `${UNOWNED_LEGACY_CHAT_KEY}:owner:${encodeURIComponent(ownerId)}`;
}

export function ownerBoundLegacyClearMarkerKey(ownerId) {
  return `${ownerBoundLegacyChatKey(ownerId)}:cleared`;
}

export function suppressAndRemoveOwnerBoundLegacyChat(storage, ownerId) {
  const legacyKey = ownerBoundLegacyChatKey(ownerId);
  const markerKey = ownerBoundLegacyClearMarkerKey(ownerId);
  const errors = [];
  let markerWritten = false;
  let legacyRemoved = false;
  try {
    storage?.setItem(markerKey, "1");
    markerWritten = true;
  } catch (error) {
    errors.push(error);
  }
  // Marker failure must never skip the actual cleanup attempt. Conversely, a
  // successful marker remains in place if removal fails, suppressing the
  // recoverable bytes until an explicit retry can remove both.
  try {
    storage?.removeItem(legacyKey);
    legacyRemoved = true;
  } catch (error) {
    errors.push(error);
  }
  if (legacyRemoved && markerWritten) {
    try {
      storage?.removeItem(markerKey);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    const failure = new Error("Legacy chat cleanup failed; the authoritative empty session remains in effect.");
    failure.causes = errors;
    throw failure;
  }
}

export function removeOwnerBoundLegacyChat(storage, ownerId) {
  storage?.removeItem(ownerBoundLegacyChatKey(ownerId));
}

/**
 * Only an owner-specific key carrying the same owner attribution is eligible
 * for automatic recovery. The historical global key is intentionally never
 * read or removed here: its owner cannot be proven, so importing it would risk
 * showing one account another account's private transcript.
 */
export function readOwnerBoundLegacyChat(storage, ownerId) {
  const key = ownerBoundLegacyChatKey(ownerId);
  try {
    if (storage?.getItem(ownerBoundLegacyClearMarkerKey(ownerId)) != null) return null;
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.ownerId !== ownerId) return null;
    if (!isValidDisplayHistory(saved.displayMsgs, ["user", "assistant"]) || !isValidModelHistory(saved.apiHistory)) return null;
    if (!saved.displayMsgs.length && !saved.apiHistory.length) return null;
    return {
      key,
      displayMsgs: saved.displayMsgs,
      apiHistory: saved.apiHistory,
    };
  } catch {
    // Malformed/inaccessible legacy data remains untouched for explicit recovery.
    return null;
  }
}

export async function verifiedOwnerLegacyFallback(legacy, ownerId, verifyOwner) {
  if (!legacy) return null;
  const verifiedOwnerId = await verifyOwner(ownerId);
  if (verifiedOwnerId !== ownerId) {
    throw new Error("The authenticated owner changed before legacy chat recovery; the fallback was cancelled.");
  }
  return legacy;
}

export function shouldRemoveLegacyChat({ legacyPresent, saveSucceeded }) {
  return Boolean(legacyPresent && saveSucceeded);
}

export function selectDurableOrLegacyChat(durableSession, legacy) {
  if (durableSession !== undefined) {
    return {
      displayMsgs: durableSession?.display || [],
      apiHistory: durableSession?.convo || [],
    };
  }
  return legacy || null;
}

/** A settled turn calls this directly; it never waits for the debounce clock. */
export function flushSessionSnapshot({ save, agentId, display, convo }) {
  return save(agentId, { display, convo });
}

export function requireSuccessfulSessionSave(saved, phase = "chat checkpoint") {
  if (saved !== true) {
    throw new Error(`${phase} could not be saved; the turn was stopped before continuing.`);
  }
  return true;
}

export async function persistSessionPhase({ save, phase, required }) {
  try {
    const saved = await save();
    if (required) return requireSuccessfulSessionSave(saved, phase);
    return saved === true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

export async function saveSessionThenCleanupEvicted({
  save,
  agentId,
  display,
  convo,
  removeEvicted,
  evictedPaths = [],
}) {
  await flushSessionSnapshot({ save, agentId, display, convo });
  if (!evictedPaths.length) return { cleanupError: null };
  try {
    await removeEvicted(evictedPaths);
    return { cleanupError: null };
  } catch (cleanupError) {
    return { cleanupError };
  }
}

export async function clearSessionThenCleanupStaging({ clearSession, clearLegacy = () => {}, clearStaging }) {
  await clearSession();
  let legacyError = null;
  let cleanupError = null;
  try {
    await clearLegacy();
  } catch (error) {
    legacyError = error;
  }
  try {
    await clearStaging();
  } catch (error) {
    cleanupError = error;
  }
  return { cleared: true, legacyError, cleanupError };
}

export function closePendingTurnForPersistence(history, note = "turn interrupted before a reply") {
  const rows = [...(history || [])];
  const last = rows.at(-1);
  const lastText = last?.role === "assistant"
    && Array.isArray(last.content)
    && last.content.length === 1
    && last.content[0]?.type === "text"
    ? String(last.content[0].text || "")
    : "";
  const isPriorClosure = /^\(.*interrupted.*\)$/i.test(lastText);
  if (isPriorClosure) rows.pop();
  else if (last?.role === "assistant" && !last.content?.some?.((block) => block?.type === "tool_use")) return rows;
  return [
    ...rows,
    { role: "assistant", content: [{ type: "text", text: `(${note})` }] },
  ];
}

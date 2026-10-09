import { isValidDisplayHistory, isValidModelHistory } from "./chatMessageShape.js";

export const BANKER_SESSION_VERSION = 1;
export const BANKER_SESSION_TTL_MS = 60 * 60 * 1000;
export const UNOWNED_BANKER_SESSION_KEY = "banker_chat_session";

const emptySession = (warning = "", writable = true) => ({ display: [], history: [], warning, writable });
const isRecord = (value) => value != null && typeof value === "object" && !Array.isArray(value);
const activeTurnsByOwner = new Map();
const clearingOwners = new Set();
const sessionListenersByOwner = new Map();

function publishOwnerBoundBankerSession(ownerId) {
  for (const listener of sessionListenersByOwner.get(ownerId) || []) {
    try {
      listener();
    } catch {
      // A mounted listener must never turn a successful durable write into a
      // reported storage failure. The next subscribe-then-read resynchronizes.
    }
  }
}

export function ownerBoundBankerSessionKey(ownerId) {
  if (typeof ownerId !== "string" || !ownerId) {
    throw new Error("An authenticated owner is required for Banker's conversation.");
  }
  return `${UNOWNED_BANKER_SESSION_KEY}:owner:${encodeURIComponent(ownerId)}`;
}

export function unownedBankerSessionWarning(storage) {
  try {
    if (storage?.getItem(UNOWNED_BANKER_SESSION_KEY) == null) return "";
  } catch {
    return "";
  }
  return "An older Banker chat backup without account ownership is quarantined in this browser. It was not opened or imported.";
}

/**
 * Read only the established owner's versioned browser session. Unsupported or
 * malformed bytes stay untouched for explicit recovery instead of being
 * normalized and overwritten with an empty conversation.
 */
export function readOwnerBoundBankerSession(
  storage,
  ownerId,
  { now = Date.now(), ttlMs = BANKER_SESSION_TTL_MS } = {},
) {
  const key = ownerBoundBankerSessionKey(ownerId);
  let raw;
  try {
    raw = storage?.getItem(key);
  } catch (error) {
    return emptySession(`Banker's saved conversation couldn't be read: ${error.message || error}`, false);
  }
  if (!raw) return emptySession(unownedBankerSessionWarning(storage));

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return emptySession("Banker's saved conversation has an unsupported format and was left untouched. Use Settings > Clear all to explicitly reset it.", false);
  }

  if (!isRecord(saved)
    || saved.version !== BANKER_SESSION_VERSION
    || saved.ownerId !== ownerId
    || !Number.isFinite(saved.savedAt)
    || !isValidDisplayHistory(saved.display, ["user", "banker"])
    || !isValidModelHistory(saved.history)) {
    return emptySession("Banker's saved conversation has an unsupported format and was left untouched. Use Settings > Clear all to explicitly reset it.", false);
  }

  if (now - saved.savedAt > ttlMs) {
    try {
      storage?.removeItem(key);
      return emptySession(unownedBankerSessionWarning(storage));
    } catch (error) {
      return emptySession(`Banker's expired conversation couldn't be removed: ${error.message || error}`, false);
    }
  }

  return {
    display: saved.display,
    history: saved.history,
    warning: unownedBankerSessionWarning(storage),
    writable: true,
  };
}

export function writeOwnerBoundBankerSession(storage, ownerId, { display = [], history = [] }, now = Date.now()) {
  const key = ownerBoundBankerSessionKey(ownerId);
  if (!display.length && !history.length) {
    storage?.removeItem(key);
    publishOwnerBoundBankerSession(ownerId);
    return;
  }
  storage?.setItem(key, JSON.stringify({
    version: BANKER_SESSION_VERSION,
    ownerId,
    savedAt: now,
    display,
    history,
  }));
  publishOwnerBoundBankerSession(ownerId);
}

export function persistOwnerBoundBankerSnapshot(storage, ownerId, snapshot, now = Date.now()) {
  try {
    writeOwnerBoundBankerSession(storage, ownerId, snapshot, now);
    return {
      saved: true,
      writable: true,
      warning: unownedBankerSessionWarning(storage),
    };
  } catch (error) {
    return {
      saved: false,
      writable: false,
      warning: `Banker's conversation isn't saving: ${error.message || error}`,
    };
  }
}

export function subscribeOwnerBoundBankerSession(ownerId, listener) {
  ownerBoundBankerSessionKey(ownerId);
  if (typeof listener !== "function") throw new Error("A Banker session listener is required.");
  const listeners = sessionListenersByOwner.get(ownerId) || new Set();
  listeners.add(listener);
  sessionListenersByOwner.set(ownerId, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) sessionListenersByOwner.delete(ownerId);
  };
}

export function beginOwnerBoundBankerTurn(ownerId) {
  ownerBoundBankerSessionKey(ownerId);
  if (clearingOwners.has(ownerId)) {
    throw new Error("Banker's conversation is being cleared — wait for Clear to finish.");
  }
  if (activeTurnsByOwner.has(ownerId)) {
    throw new Error("Banker is already working in another Money view — wait for him to finish.");
  }
  activeTurnsByOwner.set(ownerId, 1);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeTurnsByOwner.delete(ownerId);
  };
}

export function prepareOwnerBoundBankerClear(ownerId) {
  ownerBoundBankerSessionKey(ownerId);
  if (activeTurnsByOwner.get(ownerId)) {
    throw new Error("Banker is still working — wait for him to finish before clearing chat history.");
  }
  if (clearingOwners.has(ownerId)) {
    throw new Error("Banker's conversation is already being cleared.");
  }
  clearingOwners.add(ownerId);
  return Object.freeze({ ownerId });
}

export function cancelOwnerBoundBankerClear(preparation) {
  if (preparation?.ownerId) clearingOwners.delete(preparation.ownerId);
}

export function clearOwnerBoundBankerSession(storage, ownerId, preparation = null) {
  if (preparation && (preparation.ownerId !== ownerId || !clearingOwners.has(ownerId))) {
    throw new Error("Banker's Clear preparation is invalid or expired.");
  }
  try {
    storage?.removeItem(ownerBoundBankerSessionKey(ownerId));
    publishOwnerBoundBankerSession(ownerId);
  } finally {
    if (preparation) clearingOwners.delete(ownerId);
  }
}

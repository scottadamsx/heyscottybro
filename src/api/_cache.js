// src/api/_cache.js — share identical reads. When two parts of one screen ask for the same
// collection at the same time (the calendar and the task list both load reminders, the chat and
// the agent runtime both load sessions), they get one request instead of two. A finished result is
// reused for a few seconds; ANY write to that collection (emitDataChange) drops it before pages
// reload, so a change is never hidden behind the cache. Each caller gets its own array copy.
import { onBeforeDataChange } from "../utils/dataEvents.js";

const TTL_MS = 4000;
const entries = new Map(); // key -> { collection, promise, pending, at }

onBeforeDataChange((collection) => invalidateReads(collection));

const copy = (v) => (Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...v } : v);

export function cachedRead(key, collection, load, ttlMs = TTL_MS) {
  const hit = entries.get(key);
  if (hit && (hit.pending || Date.now() - hit.at < ttlMs)) return hit.promise.then(copy);
  const entry = { collection, pending: true, at: 0 };
  entry.promise = load().then(
    (value) => { entry.pending = false; entry.at = Date.now(); return value; },
    (err) => { if (entries.get(key) === entry) entries.delete(key); throw err; },
  );
  entries.set(key, entry);
  return entry.promise.then(copy);
}

/** Drop cached reads for a collection (or everything, e.g. on sign-out). */
export function invalidateReads(collection) {
  for (const [key, e] of entries) if (!collection || e.collection === collection) entries.delete(key);
}

/**
 * Tiny in-process pub/sub for data mutations.
 * Pages subscribe to collection names ('reminders', 'events', etc.)
 * and get called whenever any write touches that collection — including
 * writes made by Frodo in the ChatBot while the page is mounted.
 */
const _subs = new Map(); // collection → Set<callback>
const _before = new Set(); // run first on every change (the read cache drops stale entries)

export function emitDataChange(collection) {
  _before.forEach((cb) => { try { cb(collection); } catch { /* noop */ } });
  _subs.get(collection)?.forEach((cb) => { try { cb(); } catch { /* noop */ } });
}

/** Called before any page hears about a change, so a page's reload never reads stale cache. */
export function onBeforeDataChange(cb) {
  _before.add(cb);
  return () => _before.delete(cb);
}

export function onDataChange(collection, cb) {
  if (!_subs.has(collection)) _subs.set(collection, new Set());
  _subs.get(collection).add(cb);
  return () => _subs.get(collection)?.delete(cb);
}

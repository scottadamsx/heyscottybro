/**
 * Tiny in-process pub/sub for data mutations.
 * Pages subscribe to collection names ('reminders', 'events', etc.)
 * and get called whenever any write touches that collection — including
 * writes made by Frodo in the ChatBot while the page is mounted.
 */
const _subs = new Map(); // collection → Set<callback>

export function emitDataChange(collection) {
  _subs.get(collection)?.forEach((cb) => { try { cb(); } catch { /* noop */ } });
}

export function onDataChange(collection, cb) {
  if (!_subs.has(collection)) _subs.set(collection, new Set());
  _subs.get(collection).add(cb);
  return () => _subs.get(collection)?.delete(cb);
}

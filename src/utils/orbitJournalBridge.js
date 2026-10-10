let pendingReview = null;

export function orbitJournalIdForHost(hostJournalId, text) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(String(text || ""))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `hostj_${String(hostJournalId)}_${hash.toString(16).padStart(16, "0")}`.slice(0, 64);
}

/** Hold an in-memory handoff while the host switches into its embedded Orbit space. */
export function queueOrbitJournalReview(payload) {
  if (!payload || !payload.hostJournalId || typeof payload.text !== "string" || !payload.text.trim()) return false;
  pendingReview = { ...payload, orbitJournalId: payload.orbitJournalId || orbitJournalIdForHost(payload.hostJournalId, payload.text), queuedAt: Date.now() };
  if (typeof window !== "undefined") window.__pendingOrbitJournalReview = pendingReview;
  return true;
}

/** Consume only the matching, recent handoff; journal text never goes into a URL or storage. */
export function takeOrbitJournalReview(hostJournalId) {
  if (!pendingReview && typeof window !== "undefined") pendingReview = window.__pendingOrbitJournalReview || null;
  if (!pendingReview) return null;
  if (Date.now() - pendingReview.queuedAt > 120_000) {
    pendingReview = null;
    if (typeof window !== "undefined") delete window.__pendingOrbitJournalReview;
    return null;
  }
  if (String(pendingReview.hostJournalId) !== String(hostJournalId)) return null;
  const result = pendingReview;
  pendingReview = null;
  if (typeof window !== "undefined") delete window.__pendingOrbitJournalReview;
  return result;
}

export function clearOrbitJournalReview() {
  pendingReview = null;
  if (typeof window !== "undefined") delete window.__pendingOrbitJournalReview;
}

/**
 * Shared data-layer base — ONE home for the helpers every api module used to
 * hand-roll (uid() existed in ~10 files with three divergent behaviors).
 *
 * Rules:
 *  - uid() THROWS when signed out. Every module gets the same, predictable
 *    behavior; callers that want a soft check use getUserId().
 *  - genId(prefix) is the one id-minting helper.
 *  - fail(): wraps supabase errors into a readable Error with context.
 */
import { supabase } from "../utils/supabase";

/** Current user id or THROW — the standard for all data modules. */
export async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Current user id or null — for optional/telemetry paths only. */
export async function getUserId() {
  try { return await uid(); } catch { return null; }
}

/** Mint an id, optionally prefixed (e.g. genId("rb") -> "rb-<uuid>"). */
export function genId(prefix = "") {
  const raw = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${raw}` : raw;
}

/** Throw a readable error for a failed supabase call. */
export function fail(where, error) {
  const msg = error?.message || String(error);
  throw new Error(`${where}: ${msg}`);
}

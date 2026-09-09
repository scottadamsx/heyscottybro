export const WEED_SCHEMA = 1;
export const DAY = 86400000;
export const GRAM_PRESETS = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5];
export const TAPER_INTERVAL = 3; // days between cap reductions
export const TAPER_STEP = 0.2;   // grams per reduction
export const TAPER_FLOOR_G = 0.1; // the cap never tapers below this
export const FLOWER_THC_PCT = 30;

export function freshState() {
  return {
    schema: WEED_SCHEMA,
    sharedDailyCapG: 1.5,
    penGramEquiv: 0.1,
    scott: {
      taperEnabled: true,
      taperStart: null,
      logs: [],
    },
  };
}

/**
 * Validate + upgrade a stored blob. Throws on a shape this app does not
 * understand (QF-3) instead of quietly resetting to a fresh tracker.
 * Upgrades: legacy `scott.dailyCapG` → `sharedDailyCapG`; the retired
 * `maria` profile and `activeProfile` switch are dropped.
 */
export function normalizeWeedState(d) {
  if (d == null) return freshState();
  if (typeof d !== "object" || Array.isArray(d)) {
    throw new Error(`Unrecognised wind-down state: expected an object, got ${Array.isArray(d) ? "an array" : typeof d}`);
  }
  const schema = d.schema ?? 0;
  if (schema !== 0 && schema !== WEED_SCHEMA) {
    throw new Error(`Unrecognised wind-down schema ${schema} (this app understands schema ${WEED_SCHEMA}) — refusing to load so nothing is overwritten`);
  }
  if (d.scott != null && (typeof d.scott !== "object" || (d.scott.logs != null && !Array.isArray(d.scott.logs)))) {
    throw new Error("Unrecognised wind-down state: profile logs are not an array — refusing to load so nothing is overwritten");
  }
  const fresh = freshState();
  const scott = d.scott || {};
  return {
    schema: WEED_SCHEMA,
    sharedDailyCapG: Number(d.sharedDailyCapG ?? scott.dailyCapG ?? fresh.sharedDailyCapG),
    penGramEquiv: Number(d.penGramEquiv ?? fresh.penGramEquiv),
    scott: {
      taperEnabled: scott.taperEnabled ?? fresh.scott.taperEnabled,
      taperStart: scott.taperStart ?? null,
      logs: Array.isArray(scott.logs) ? scott.logs : [],
    },
  };
}

export function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function toDateStr(ts) { return new Date(ts).toLocaleDateString("en-CA"); }
export function today() { return toDateStr(Date.now()); }

export function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  const dk = toDateStr(ts);
  if (dk === today()) return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dk === toDateStr(Date.now() - DAY)) return "yesterday";
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function taperDays(taperStart) {
  if (!taperStart) return 0;
  return Math.floor((Date.now() - taperStart) / DAY);
}

export function taperedCapG(capG, profile) {
  if (!profile.taperEnabled || !profile.taperStart) return capG;
  const intervals = Math.floor(taperDays(profile.taperStart) / TAPER_INTERVAL);
  return Math.max(TAPER_FLOOR_G, +(capG - intervals * TAPER_STEP).toFixed(2));
}

/**
 * Days from now until the taper reaches TAPER_FLOOR_G, given the CURRENT
 * tapered cap (so the figure counts down as reductions land — QF-6).
 * null when no taper is running; 0 once the floor is reached.
 */
export function daysToTaperFloor(effectiveCapG, profile) {
  if (!profile.taperEnabled || !profile.taperStart) return null;
  const stepsLeft = Math.max(0, Math.ceil((effectiveCapG - TAPER_FLOOR_G) / TAPER_STEP - 1e-9));
  if (stepsLeft === 0) return 0;
  const untilNext = TAPER_INTERVAL - (taperDays(profile.taperStart) % TAPER_INTERVAL);
  return untilNext + (stepsLeft - 1) * TAPER_INTERVAL;
}

export const STORAGE_KEY = "weed_tracker_v3";
export const DAY = 86400000;
export const GRAM_PRESETS = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5];
export const TAPER_INTERVAL = 3; // days between cap reductions
export const TAPER_STEP = 0.2;   // grams per reduction
export const FLOWER_THC_PCT = 30;

export function freshState() {
  return {
    activeProfile: "scott",
    sharedDailyCapG: 1.5,
    penGramEquiv: 0.1,
    scott: {
      taperEnabled: true,
      taperStart: null,
      logs: [],
    },
    maria: {
      cartridgeMg: 1000,
      mgPerSec: 1.5,
      hitSec: 6,
      daysTarget: 14,
      taperEnabled: true,
      taperStart: null,
      penStart: Date.now(),
      logs: [],
    },
  };
}

export function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d) {
      const fresh = freshState();
      return {
        ...fresh, ...d,
        sharedDailyCapG: d.sharedDailyCapG ?? d.scott?.dailyCapG ?? fresh.sharedDailyCapG,
        penGramEquiv: d.penGramEquiv ?? fresh.penGramEquiv,
        scott: { ...fresh.scott, ...(d.scott || {}) },
        maria: { ...fresh.maria, ...(d.maria || {}) },
      };
    }
  } catch { /* ignore */ }
  return freshState();
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
  return Math.max(0.1, +(capG - intervals * TAPER_STEP).toFixed(2));
}

export function gramsOf(logs, conv) {
  return logs.reduce((a, l) => {
    if (l.grams != null) return a + (Number(l.grams) || 0);
    if (l.type === "hit" || !l.type) return a + conv;
    return a;
  }, 0);
}

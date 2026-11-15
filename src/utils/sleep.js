// Pure sleep math for the Health space (BUG-086). Times are "HH:MM" 24-hour
// strings, exactly what a time input gives and what sleep_logs stores.

const toMinutes = (t) => {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Minutes asleep from bedtime to wake time; a wake time at or before the bedtime means the night crossed midnight. */
export function sleepDurationMinutes(bedTime, wakeTime) {
  const bed = toMinutes(bedTime);
  const wake = toMinutes(wakeTime);
  if (bed === null || wake === null) return null;
  const mins = wake - bed;
  return mins > 0 ? mins : mins + 1440;
}

/** 412 -> "6h 52m"; 45 -> "45m"; 120 -> "2h 0m". */
export function formatSleepDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "22:55" -> "10:55 PM"; "06:23" -> "6:23 AM". */
export function formatClock(time) {
  const mins = toMinutes(time);
  if (mins === null) return "—";
  const h24 = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${m} ${suffix}`;
}

/**
 * Summary for a most-recent-first entry list: last night's entry and the
 * average duration over the last 7 logged nights (fewer when less is logged).
 * Entries carry { date, durationMinutes }.
 */
export function sleepSummary(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const recent = list.slice(0, 7).filter((e) => Number(e?.durationMinutes) > 0);
  const average = recent.length
    ? Math.round(recent.reduce((a, e) => a + Number(e.durationMinutes), 0) / recent.length)
    : null;
  return { lastNight: list[0] || null, recentAverage: average, recentCount: recent.length };
}

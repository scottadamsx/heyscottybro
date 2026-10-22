// ── Connected Pages gap watchers (docs/features/connected-pages.md, Design 4)
//
// Pure gap predicates, fingerprints, and episode decisions. No I/O: the API
// layer (src/api/gapWatchersApi.js) executes the decision computed here.
//
// Invariants enforced here:
//  - the same gap (same fingerprint) never produces two open reminders;
//  - a dismissed reminder suppresses its exact gap, not a different one;
//  - a resolved reminder is never resurrected: a reopened gap is a new
//    episode with a new reminder;
//  - a watcher never invents a gap from missing or failed data — callers
//    only invoke this after a successful source load.

import { addDays } from "./cascades.js";

/** SPEC-GAP 2 default: dinner is the one required slot in version 1. */
export const REQUIRED_MEAL_SLOTS = ["dinner"];

export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function fingerprintOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export function gapFingerprint(gap) {
  const keys = (gap || []).map((g) => `${g.date}:${g.slot}`).sort();
  return fingerprintOf(keys.join("|"));
}

/**
 * The meals gap for one Monday-to-Sunday week: required date+slot pairs with
 * no planned, cooked, or intentionally skipped item. For the current week,
 * days before today are not retroactive gaps (partial-week rule); a future
 * week is evaluated in full; a past week has no gap (its watcher expires).
 */
export function computeMealsGap({ weekStart, items = [], today, requiredSlots = REQUIRED_MEAL_SLOTS }) {
  const dates = weekDates(weekStart);
  const weekEnd = dates[6];
  if (today > weekEnd) return [];
  const from = today > weekStart ? today : weekStart;
  const satisfied = new Set();
  for (const item of items) {
    if (!["planned", "cooked", "intentional_skip"].includes(item.status)) continue;
    satisfied.add(`${item.planned_date}:${item.meal_slot}`);
  }
  const gap = [];
  for (const date of dates) {
    if (date < from) continue;
    for (const slot of requiredSlots) {
      if (!satisfied.has(`${date}:${slot}`)) gap.push({ date, slot });
    }
  }
  return gap;
}

/** The grocery-budget gap: one entry when the week has no budget record. */
export function computeBudgetGap({ weekStart, budgetWeek }) {
  return budgetWeek ? [] : [{ date: weekStart, slot: "budget" }];
}

/**
 * Decide what an evaluation does. Inputs:
 *  watcher: the latest watcher row for the scope (any status) or null
 *  gap / fingerprint: the freshly computed gap
 *  reminderState: 'open' | 'completed' | 'missing' | null (no reminder yet)
 *  scopeEnded: the scope's end date is before today
 * Returns { action } — one of: none, touch, update, create, new-episode,
 * suppress, stay-suppressed, resolve, expire.
 */
export function decideWatcher({ watcher, gap, fingerprint, reminderState, scopeEnded }) {
  const hasGap = (gap || []).length > 0;
  const active = watcher && watcher.status === "active";

  if (scopeEnded) {
    return { action: active ? "expire" : "none" };
  }
  if (!hasGap) {
    return { action: active ? "resolve" : "none" };
  }
  // There is a gap.
  if (!watcher) return { action: "create", episode: 1 };
  if (watcher.status === "resolved" || watcher.status === "expired") {
    return { action: "new-episode", episode: (watcher.episode || 1) + 1 };
  }
  if (watcher.status === "suppressed") {
    return fingerprint === watcher.gap_fingerprint
      ? { action: "stay-suppressed" }
      : { action: "new-episode", episode: (watcher.episode || 1) + 1 };
  }
  // Active episode with an open gap.
  if (reminderState === "completed" || reminderState === "missing") {
    // Scott dismissed or removed the reminder for this episode.
    return fingerprint === watcher.gap_fingerprint
      ? { action: "suppress" }
      : { action: "update" };
  }
  return fingerprint === watcher.gap_fingerprint ? { action: "touch" } : { action: "update" };
}

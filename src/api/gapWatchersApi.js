// ── Connected Pages: gap-watcher execution (docs/features/connected-pages.md)
// Persists watcher state in gap_watchers and drives the one living reminder
// per gap episode, per the pure decisions in src/lib/gapWatchers.js.
// Evaluation happens on relevant page loads and writes (v1 has no scheduler).
import { supabase } from "../utils/supabase";
import { uid, fail } from "./_base";
import { loadReminders, newReminder, updateReminder, completeReminder, deleteReminder } from "./plannerApi";
import { computeMealsGap, computeBudgetGap, gapFingerprint, decideWatcher } from "../lib/gapWatchers";
import { addDays } from "../lib/cascades";
import { formatDisplayDate } from "../utils/dates";
import { toDateStr } from "../utils/plannerUtils";

export async function loadAllWatchers() {
  const userId = await uid();
  const { data, error } = await supabase.from("gap_watchers").select("*").eq("user_id", userId).order("episode", { ascending: false });
  if (error) fail("load gap watchers", error);
  return data ?? [];
}

async function latestWatcher(watcherKey, scopeType, scopeId) {
  const userId = await uid();
  const { data, error } = await supabase.from("gap_watchers")
    .select("*").eq("user_id", userId).eq("watcher_key", watcherKey)
    .eq("scope_type", scopeType).eq("scope_id", scopeId)
    .order("episode", { ascending: false }).limit(1);
  if (error) fail("load gap watcher", error);
  return data?.[0] ?? null;
}

async function insertWatcher(fields) {
  const userId = await uid();
  const { data, error } = await supabase.from("gap_watchers").insert({ user_id: userId, ...fields }).select().single();
  if (error) fail("save gap watcher", error);
  return data;
}

async function patchWatcher(id, fields) {
  const { error } = await supabase.from("gap_watchers").update(fields).eq("id", id);
  if (error) fail("save gap watcher", error);
}

/**
 * Generic watcher evaluation. `makeReminder(gap)` returns the reminder fields
 * (name/date/time/description) for a fresh episode. Returns the decision
 * action taken. Callers must only invoke this after their source data loaded
 * successfully — a failed load must never raise a gap reminder.
 */
export async function evaluateWatcher({ watcherKey, scopeType, scopeId, scopeStart, scopeEnd, gap, makeReminder, today = toDateStr() }) {
  const fingerprint = gapFingerprint(gap);
  const watcher = await latestWatcher(watcherKey, scopeType, scopeId);
  let reminder = null;
  let reminderState = null;
  if (watcher?.reminder_id) {
    const all = await loadReminders();
    reminder = all.find((r) => String(r.id) === String(watcher.reminder_id)) || null;
    reminderState = !reminder ? "missing" : reminder.completed ? "completed" : "open";
  }
  const decision = decideWatcher({
    watcher, gap, fingerprint, reminderState,
    scopeEnded: !!scopeEnd && today > scopeEnd,
  });
  const nowIso = new Date().toISOString();
  const base = {
    watcher_key: watcherKey, scope_type: scopeType, scope_id: scopeId,
    scope_start: scopeStart, scope_end: scopeEnd, gap_fingerprint: fingerprint,
    gap_details: { gap },
  };

  const spawnReminder = async () => {
    const fields = makeReminder(gap);
    return newReminder({
      ...fields,
      recurrence: "none",
      show_on_calendar: true,
      source_type: "watcher",
      source_id: scopeId,
      source_key: watcherKey,
      generator: `gap-watcher:${watcherKey}`,
      generated_hash: fingerprint,
      managed_state: "generated",
    });
  };

  switch (decision.action) {
    case "none":
      return decision;
    case "touch":
      await patchWatcher(watcher.id, { last_evaluated_at: nowIso });
      return decision;
    case "stay-suppressed":
      await patchWatcher(watcher.id, { last_evaluated_at: nowIso });
      return decision;
    case "suppress":
      await patchWatcher(watcher.id, { status: "suppressed", suppressed_at: nowIso, last_evaluated_at: nowIso });
      return decision;
    case "resolve":
      if (reminder && reminderState === "open") await completeReminder(reminder.id);
      await patchWatcher(watcher.id, { status: "resolved", resolved_at: nowIso, last_evaluated_at: nowIso });
      return decision;
    case "expire":
      if (reminder && reminderState === "open") await deleteReminder(reminder.id);
      await patchWatcher(watcher.id, { status: "expired", last_evaluated_at: nowIso });
      return decision;
    case "create":
    case "new-episode": {
      const row = await spawnReminder();
      await insertWatcher({
        ...base, status: "active", episode: decision.episode || 1,
        reminder_id: row?.id ?? null, first_detected_at: nowIso, last_evaluated_at: nowIso,
      });
      return decision;
    }
    case "update": {
      if (reminder && reminderState === "open") {
        const fields = makeReminder(gap);
        await updateReminder(reminder.id, { name: fields.name, date: fields.date, time: fields.time, description: fields.description, generated_hash: fingerprint }, { generated: true });
        await patchWatcher(watcher.id, { ...base, last_evaluated_at: nowIso });
      } else {
        // The dismissed episode's gap changed materially: a fresh reminder
        // under a new episode, rather than editing a closed one.
        const row = await spawnReminder();
        await insertWatcher({
          ...base, status: "active", episode: (watcher.episode || 1) + 1,
          reminder_id: row?.id ?? null, first_detected_at: nowIso, last_evaluated_at: nowIso,
        });
        await patchWatcher(watcher.id, { status: "resolved", resolved_at: nowIso, last_evaluated_at: nowIso });
      }
      return decision;
    }
    default:
      return decision;
  }
}

// ── The two Phase 1 watchers ─────────────────────────────────────────────────

const slotLabel = (slot) => ({ dinner: "Dinner", breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", budget: "" }[slot] || slot);

/** Meals watcher for one Monday-to-Sunday week (scope id = week start). */
export async function evaluateMealsWatcher({ weekStart, items, today = toDateStr() }) {
  const gap = computeMealsGap({ weekStart, items, today });
  const weekEnd = addDays(weekStart, 6);
  return evaluateWatcher({
    watcherKey: "meals-week",
    scopeType: "meal_plan_week",
    scopeId: weekStart,
    scopeStart: weekStart,
    scopeEnd: weekEnd,
    gap,
    today,
    makeReminder: (g) => {
      const sundayCheck = today < weekStart;
      return {
        name: "Meals not yet planned for the week",
        date: sundayCheck ? addDays(weekStart, -1) : today,
        time: sundayCheck ? "18:00" : "09:00",
        description: `Not planned: ${g.map((x) => `${formatDisplayDate(x.date)}${slotLabel(x.slot) ? ` (${slotLabel(x.slot).toLowerCase()})` : ""}`).join(", ")}. Open Meal Plan in Health to fill the week.`,
      };
    },
  });
}

/** Grocery-budget watcher for one week (scope id = week start). */
export async function evaluateBudgetWatcher({ weekStart, budgetWeek, today = toDateStr() }) {
  const gap = computeBudgetGap({ weekStart, budgetWeek });
  const weekEnd = addDays(weekStart, 6);
  return evaluateWatcher({
    watcherKey: "grocery-budget-week",
    scopeType: "grocery_budget_week",
    scopeId: weekStart,
    scopeStart: weekStart,
    scopeEnd: weekEnd,
    gap,
    today,
    makeReminder: () => {
      const sundayCheck = today < weekStart;
      return {
        name: "Grocery budget not set for the week",
        date: sundayCheck ? addDays(weekStart, -1) : today,
        time: sundayCheck ? "18:00" : "09:00",
        description: `No grocery budget is set for the week of ${formatDisplayDate(weekStart)}. Set it in Money (Finance) so Meal Plan can cost against it.`,
      };
    },
  });
}

// ── Connected Pages cascades (docs/features/connected-pages.md, Design 3) ────
//
// Pure desired-task builders + reconciliation planning. No I/O: the API layer
// (src/api/generatedTasksApi.js) executes the plan this module computes, so
// every rule here is unit-tested without a database.
//
// Invariants enforced here:
//  - deterministic source keys: at most one open generated task per role;
//  - a completed generated task is never edited, reopened, or resurrected;
//  - a task Scott detached (manual edit) is never overwritten or deleted;
//  - reconciliation only touches rows carrying the source's provenance.

export const COOK_FALLBACK_MINUTES = 45;
export const NIGHT_BEFORE_PREP_TIME = "20:00";
export const MORNING_PREP_TIME = "08:00";
export const SHOPPING_TIME = "17:00";

/** Stable short hash of the fields a cascade manages on a generated task. */
export function hashManagedFields(task) {
  const parts = [
    task.name || "",
    task.date || "",
    task.time || "",
    task.description || "",
    task.source_type || "",
    task.source_id != null ? String(task.source_id) : "",
    task.source_key || "",
  ];
  let h = 5381;
  const s = parts.join("");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Attach the generated hash to each desired task (returns new objects). */
export function withHashes(tasks) {
  return (tasks || []).map((t) => ({ ...t, generated_hash: hashManagedFields(t) }));
}

// ── Local date/time helpers (dates are local calendar dates, "YYYY-MM-DD") ──

const pad = (n) => String(n).padStart(2, "0");
export const dateStrOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeStrOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateStrOf(dt);
}

/** Shift a date+time ("HH:MM") by minutes, rolling across midnight honestly. */
export function shiftMinutes(dateStr, timeStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = String(timeStr || "00:00").split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0);
  dt.setMinutes(dt.getMinutes() + delta);
  return { date: dateStrOf(dt), time: timeStrOf(dt) };
}

export function formatCents(cents) {
  const v = Math.round(Number(cents) || 0);
  return `$${(v / 100).toFixed(2)}`;
}

// ── Meal task builders ───────────────────────────────────────────────────────

const mealTitle = (item, recipe) => item.custom_title || recipe?.title || "Meal";

/**
 * Cook start for a plan item: eating time minus recipe prep + cook minutes,
 * with the 45-minute fallback when the recipe has no usable times. Returns
 * { date, time } — time is null when the item has no eating time.
 */
export function cookStartFor(item, recipe) {
  if (!item.eat_time) return { date: item.planned_date, time: null };
  const total = (Number(recipe?.prep_minutes) || 0) + (Number(recipe?.cook_minutes) || 0);
  const lead = total > 0 ? total : COOK_FALLBACK_MINUTES;
  return shiftMinutes(item.planned_date, item.eat_time, -lead);
}

/** The recipe's prep profile merged with the plan item's override. */
export function effectivePrep(item, recipe) {
  const fromItem = item.advance_prep_kind && item.advance_prep_kind !== "none"
    ? { kind: item.advance_prep_kind, lead_minutes: item.advance_prep_lead_minutes, note: item.advance_prep_note }
    : null;
  if (fromItem) return fromItem;
  const p = recipe?.prep_profile || {};
  return {
    kind: p.kind || "none",
    lead_minutes: p.lead_minutes ?? null,
    note: p.note || "",
  };
}

export function prepStartFor(item, prep) {
  if (prep.kind === "night_before") return { date: addDays(item.planned_date, -1), time: NIGHT_BEFORE_PREP_TIME };
  if (prep.kind === "morning") return { date: item.planned_date, time: MORNING_PREP_TIME };
  if (prep.kind === "lead_time") {
    if (!item.eat_time) return { date: item.planned_date, time: null };
    return shiftMinutes(item.planned_date, item.eat_time, -(Number(prep.lead_minutes) || 0));
  }
  return null;
}

/**
 * Desired generated tasks for one plan item: a cook task, plus a prep task
 * when the effective prep profile requires one. When prep and cook would be
 * the same work at the same time, the prep note folds into the cook task.
 * Skipped, cancelled, and cooked items desire no tasks.
 */
export function buildMealDesiredTasks(item, recipe) {
  if (!item || !["planned"].includes(item.status)) return [];
  const title = mealTitle(item, recipe);
  const cook = cookStartFor(item, recipe);
  const servings = Number(item.servings) || 1;
  const cookTask = {
    name: `Cook ${title}`,
    date: cook.date,
    time: cook.time,
    description: `${servings} serving${servings === 1 ? "" : "s"}${item.eat_time ? ` · Eating ${item.eat_time}` : ""} · From Meal Plan`,
    recurrence: "none",
    show_on_calendar: true,
    source_type: "meal_plan_item",
    source_id: String(item.id),
    source_key: "cook",
    generator: "meal-plan-cascade",
    managed_state: "generated",
  };
  const tasks = [cookTask];
  const prep = effectivePrep(item, recipe);
  const prepStart = prepStartFor(item, prep);
  if (prepStart) {
    if (prepStart.date === cook.date && prepStart.time === cook.time) {
      if (prep.note) cookTask.description += ` · Prep: ${prep.note}`;
    } else {
      tasks.push({
        name: `Prep ${title}`,
        date: prepStart.date,
        time: prepStart.time,
        description: `${prep.note ? `${prep.note} · ` : ""}From Meal Plan`,
        recurrence: "none",
        show_on_calendar: true,
        source_type: "meal_plan_item",
        source_id: String(item.id),
        source_key: "prep",
        generator: "meal-plan-cascade",
        managed_state: "generated",
      });
    }
  }
  return withHashes(tasks);
}

/**
 * Desired shopping task for a week plan, or null when nothing is planned.
 * summary: { itemCount, pricedCount, purchaseTotalCents, budgetCents|null }
 * now: a Date for the "planned late" rules.
 */
export function buildShoppingDesiredTask(plan, items, summary, now = new Date()) {
  const planned = (items || []).filter((i) => i.status === "planned");
  if (!planned.length) return null;
  const first = planned.slice().sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)))[0];
  const today = dateStrOf(now);
  let due = { date: addDays(first.planned_date, -1), time: SHOPPING_TIME };
  const dueDateTime = new Date(`${due.date}T${due.time}:00`);
  if (dueDateTime < now) {
    if (first.planned_date === today && first.eat_time) {
      const twoBefore = shiftMinutes(first.planned_date, first.eat_time, -120);
      due = twoBefore.date === today && new Date(`${twoBefore.date}T${twoBefore.time}:00`) > now
        ? twoBefore
        : { date: today, time: timeStrOf(now) };
    } else {
      due = { date: today, time: timeStrOf(now) };
    }
  }
  const budgetPart = summary?.budgetCents != null
    ? ` · Budget ${formatCents(summary.budgetCents)}`
    : " · No grocery budget set";
  const task = {
    name: "Shop for the week's meals",
    date: due.date,
    time: due.time,
    description: `${summary?.itemCount ?? 0} items · ${summary?.pricedCount ?? 0} priced · Planned spend ${formatCents(summary?.purchaseTotalCents)}${budgetPart} · From Meal Plan`,
    recurrence: "none",
    show_on_calendar: true,
    source_type: "meal_plan_week",
    source_id: String(plan.id),
    source_key: "shopping",
    generator: "meal-plan-cascade",
    managed_state: "generated",
  };
  return withHashes([task])[0];
}

// ── Reconciliation ───────────────────────────────────────────────────────────

/**
 * Diff desired generated tasks against the source's existing reminder rows.
 * existing: every reminder row carrying this source_type + source_id (open
 * and completed). Returns the execution plan; performs no writes.
 */
export function planReconciliation({ desired = [], existing = [] }) {
  const desiredByKey = new Map(desired.map((t) => [t.source_key, t]));
  const openByKey = new Map();
  const completedKeys = new Set();
  for (const row of existing) {
    if (!row.source_key) continue;
    if (row.completed) completedKeys.add(row.source_key);
    else if (!openByKey.has(row.source_key)) openByKey.set(row.source_key, row);
  }
  const create = [];
  const update = [];
  const retire = [];
  const detached = [];
  const completedConflicts = [];
  const unchanged = [];

  for (const [key, task] of desiredByKey) {
    const open = openByKey.get(key);
    if (open) {
      if (open.managed_state !== "generated") { detached.push(open.id); continue; }
      if (open.generated_hash === task.generated_hash) { unchanged.push(key); continue; }
      update.push({ id: open.id, task });
      continue;
    }
    if (completedKeys.has(key)) { completedConflicts.push(key); continue; }
    create.push(task);
  }
  for (const [key, row] of openByKey) {
    if (desiredByKey.has(key)) continue;
    if (row.managed_state !== "generated") { detached.push(row.id); continue; }
    retire.push(row.id);
  }
  return { create, update, retire, detached, completedConflicts, unchanged };
}

/** Stamp Connected Pages provenance onto event-type auto-task rows. */
export function stampEventTaskProvenance(tasks, eventId) {
  const stamped = (tasks || []).map((t, i) => ({
    ...t,
    source_type: "event",
    source_id: String(eventId),
    source_key: `auto:${i}`,
    generator: "event-type-auto-tasks",
    managed_state: "generated",
  }));
  return withHashes(stamped);
}

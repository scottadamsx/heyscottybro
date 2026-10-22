// ── Connected Pages: generated-task execution (docs/features/connected-pages.md)
// Executes the reconciliation plan computed by src/lib/cascades.js against
// the reminders table through plannerApi. Safe to run repeatedly: generation
// keys are deterministic and the open-task unique index backs the diff.
import { loadReminders, newReminders, updateReminder, deleteReminder } from "./plannerApi";
import { planReconciliation } from "../lib/cascades";

/** Every reminder row (open and completed) carrying one source's provenance. */
export async function loadSourceTasks(sourceType, sourceId) {
  const all = await loadReminders();
  return all.filter((r) => r.source_type === sourceType && String(r.source_id) === String(sourceId));
}

/**
 * Make the source's open generated tasks match `desired` (built by
 * src/lib/cascades.js). Returns a summary; completed and detached tasks are
 * reported, never touched. Throws on a failed write so the caller can mark
 * the source's follow-through pending and offer Retry.
 */
export async function reconcileGeneratedTasks({ sourceType, sourceId, desired }) {
  const existing = await loadSourceTasks(sourceType, sourceId);
  const plan = planReconciliation({ desired, existing });
  const summary = {
    created: 0, updated: 0, retired: 0,
    detached: plan.detached, completedConflicts: plan.completedConflicts, unchanged: plan.unchanged,
  };
  if (plan.create.length) {
    await newReminders(plan.create);
    summary.created = plan.create.length;
  }
  for (const u of plan.update) {
    await updateReminder(u.id, { ...u.task }, { generated: true });
    summary.updated += 1;
  }
  for (const id of plan.retire) {
    await deleteReminder(id);
    summary.retired += 1;
  }
  return summary;
}

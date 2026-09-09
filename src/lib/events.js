/**
 * One place that knows how to create an event and fan out its auto-tasks.
 * Used by the Calendar day sheet and the Project page so the two forms can't
 * drift (QF-5/QF-7: one control, one behaviour).
 */
import { newEvent, newReminders } from "../api/plannerApi";
import { toDateStr } from "../utils/plannerUtils";

/**
 * Task rows for an event: one per auto-task on its event type, dated by the
 * template's day offset. With `followUpTask`, an event with no template tasks
 * gets a single "Follow up:" task on the day instead (off by default — most
 * events are just events).
 */
function eventTaskRows(row, eventTypes, { followUpTask = false } = {}) {
  const et = row.event_type_id ? eventTypes.find((x) => String(x.id) === String(row.event_type_id)) : null;
  const eventDate = new Date(row.date + "T00:00:00");
  const tasks = [];

  if (et?.auto_tasks?.length) {
    const ordered = et.auto_tasks.slice().sort((a, b) => Number(a.offset_days) - Number(b.offset_days));
    for (const task of ordered) {
      const d = new Date(eventDate);
      d.setDate(eventDate.getDate() + Number(task.offset_days));
      tasks.push({
        name: `${task.name} — ${row.title}`,
        date: toDateStr(d),
        recurrence: "none",
        project_id: row.project_id,
        event_id: row.id,
        show_on_calendar: true,
      });
    }
  }

  if (tasks.length === 0 && followUpTask) {
    tasks.push({
      name: `Follow up: ${row.title}`,
      date: row.date,
      recurrence: "none",
      project_id: row.project_id,
      event_id: row.id,
      show_on_calendar: true,
    });
  }

  return tasks;
}

/** Normalise form values into the events row shape. */
export function eventRowFromForm(v) {
  const date = v.date;
  return {
    title: String(v.title || "").trim(),
    description: String(v.description || "").trim(),
    date,
    end_date: v.end_date && v.end_date > date ? v.end_date : null,
    start_time: v.start_time || null,
    end_time: v.end_time || null,
    project_id: v.project_id || null,
    event_type_id: v.event_type_id || null,
  };
}

/**
 * Create the event, then the template tasks for its event type (sorted
 * chronologically: N days before → day of → N days after) in ONE batch insert.
 * Generated tasks carry `event_id` so deleting the event deletes them.
 * Options: `{ followUpTask: true }` adds a "Follow up:" task when the type has
 * no template (default off).
 * Returns the created event row.
 */
export async function createEventWithAutoTasks(values, eventTypes = [], options = {}) {
  const row = eventRowFromForm(values);
  if (!row.title || !row.date) throw new Error("An event needs a title and a date");
  const created = await newEvent(row);
  const tasks = eventTaskRows({ ...row, id: created?.id }, eventTypes, options);
  if (tasks.length) await newReminders(tasks);
  return created;
}

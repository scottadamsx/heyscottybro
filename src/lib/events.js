/**
 * One place that knows how to create an event and fan out its auto-tasks.
 * Used by the Calendar day sheet and the Project page so the two forms can't
 * drift (QF-5/QF-7: one control, one behaviour).
 */
import { newEvent, newReminder } from "../api/plannerApi";
import { toDateStr } from "../utils/plannerUtils";

function eventTaskRows(row, eventTypes) {
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
        show_on_calendar: true,
      });
    }
  }

  // No template selected? still create one concrete follow-up task so the event
  // is visible in task flows (Reminders/Projects/Calendar) as requested.
  if (tasks.length === 0) {
    tasks.push({
      name: `Follow up: ${row.title}`,
      date: row.date,
      recurrence: "none",
      project_id: row.project_id,
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
 * chronologically: N days before → day of → N days after).
 * Returns the created event row.
 */
export async function createEventWithAutoTasks(values, eventTypes = []) {
  const row = eventRowFromForm(values);
  if (!row.title || !row.date) throw new Error("An event needs a title and a date");
  const created = await newEvent(row);
  const tasks = eventTaskRows(row, eventTypes);
  for (const task of tasks) await newReminder(task);
  return created;
}

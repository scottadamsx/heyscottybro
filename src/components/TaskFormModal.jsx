/**
 * New / edit task (a `reminders` row) — the one task form, in a FormModal
 * (DR-019). Used by Plan › Tasks (create + row Edit) and the task detail page.
 *
 * `onSave(fields)` receives the row patch (the shape plannerApi writes) and may
 * throw: the modal then stays open with what was typed and shows the error.
 * `collapsible` hides Date & time / Description behind toggles until they are
 * wanted (the quick-add feel of the Tasks page); the detail page shows all.
 */
import { useState } from "react";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import { FormModal } from "./ui";

export const emptyTaskForm = { name: "", date: "", time: "", description: "", recurrence: "none", project_id: "", recur_until: "", recur_times: "", show_on_calendar: true };

export const taskToForm = (r) => ({
  name: r.name || "",
  date: r.date || "",
  time: r.time ? String(r.time).slice(0, 5) : "",
  description: r.description || "",
  recurrence: r.recurrence || "none",
  project_id: r.project_id || "",
  recur_until: r.recur_until || "",
  recur_times: r.recur_times != null ? String(r.recur_times) : "",
  show_on_calendar: r.show_on_calendar !== false,
});

const fieldsFromForm = (form) => ({
  name: form.name.trim(),
  date: form.date || null,
  time: form.time || null,
  description: form.description || null,
  recurrence: form.recurrence,
  project_id: form.project_id || null,
  recur_until: form.recurrence !== "none" ? (form.recur_until || null) : null,
  recur_times: form.recurrence !== "none" && form.recur_times ? Number(form.recur_times) : null,
  show_on_calendar: form.show_on_calendar,
});

export default function TaskFormModal({ title, initial = emptyTaskForm, projects = [], submitLabel = "Save", collapsible = true, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [showDateTime, setShowDateTime] = useState(!collapsible || Boolean(initial.date || initial.time));
  const [showDescription, setShowDescription] = useState(!collapsible || Boolean(initial.description));

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const repeats = form.recurrence !== "none";
  // A recurring task with no date has no occurrences — nothing to repeat.
  const needsDate = repeats && !form.date;

  const submit = async () => {
    if (!form.name.trim()) throw new Error("Give the task a name.");
    if (needsDate) throw new Error("A repeating task needs a start date."); // submit is disabled; guards Enter
    await onSave(fieldsFromForm(form));
  };

  return (
    <FormModal title={title} submitLabel={submitLabel} onClose={onClose} onSubmit={submit} submitDisabled={needsDate} className="task-form-modal">
      <input
        placeholder="Task name"
        aria-label="Task name"
        value={form.name}
        onChange={(e) => set({ name: e.target.value })}
        data-autofocus
        required
      />

      <div className="form-row">
        <select
          value={form.recurrence}
          aria-label="Repeats"
          onChange={(e) => {
            const recurrence = e.target.value;
            set({ recurrence });
            if (recurrence !== "none") setShowDateTime(true); // a repeat needs a start date
          }}
        >
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <select value={form.project_id} onChange={(e) => set({ project_id: e.target.value })} aria-label="Project">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {(showDateTime || needsDate) && (
        <div className="form-row">
          <DatePicker value={form.date} onChange={(v) => set({ date: v })} placeholder="Due date" />
          <TimePicker value={form.time} onChange={(v) => set({ time: v })} />
        </div>
      )}
      {needsDate && <p className="field-hint" role="status">A repeating task needs a start date — pick the first occurrence.</p>}

      {showDescription && (
        <textarea
          placeholder="Description (optional)"
          aria-label="Description"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
        />
      )}

      {collapsible && (!showDateTime || !showDescription) && (
        <div className="form-meta-row">
          {!showDateTime && (
            <button type="button" className="btn-mini" onClick={() => setShowDateTime(true)}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Date &amp; time
            </button>
          )}
          {!showDescription && (
            <button type="button" className="btn-mini" onClick={() => setShowDescription(true)}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Description
            </button>
          )}
        </div>
      )}

      {repeats && (
        <div className="form-row recur-limit-row">
          <div className="recur-limit-group">
            <span className="field-label">End date (optional)</span>
            <DatePicker
              value={form.recur_until}
              onChange={(v) => set({ recur_until: v, recur_times: "" })}
              placeholder="End date"
            />
          </div>
          <label className="recur-limit-group">
            <span className="field-label">Or after N times</span>
            <input
              type="number"
              min="1"
              value={form.recur_times}
              onChange={(e) => set({ recur_times: e.target.value, recur_until: "" })}
              placeholder="e.g. 4"
            />
          </label>
        </div>
      )}

      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={form.show_on_calendar}
          onChange={(e) => set({ show_on_calendar: e.target.checked })}
        />
        Show on calendar
      </label>
    </FormModal>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loadReminders, loadProjects, updateReminder, completeReminder, deleteReminder } from "../../api/plannerApi";
import DocLinks from "../../components/docs/DocLinks";
import { formatDisplayDate, toDateStr, formatTime12, nextOccurrence } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import TimePicker from "../../components/TimePicker";
import { onDataChange } from "../../utils/dataEvents";
import { useConfirm } from "../../hooks/useConfirm";

const RECUR_LABEL = { none: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

const toForm = (r) => ({
  name: r.name || "",
  date: r.date || "",
  time: r.time || "",
  description: r.description || "",
  recurrence: r.recurrence || "none",
  project_id: r.project_id || "",
  recur_until: r.recur_until || "",
  recur_times: r.recur_times != null ? String(r.recur_times) : "",
  show_on_calendar: r.show_on_calendar !== false,
});

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  const [task, setTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  // "Failed to load" and "not found" are different states: a failed load must
  // never render as "this task may have been deleted" (QF-3).
  const [loadError, setLoadError] = useState(null);

  const todayStr = toDateStr(new Date());

  const load = async () => {
    setLoadError(null);
    const [remRes, projRes] = await Promise.allSettled([loadReminders(), loadProjects()]);
    if (remRes.status === "rejected") {
      console.error("[task] failed to load tasks", remRes.reason);
      setLoadError(remRes.reason?.message || String(remRes.reason));
      setLoading(false);
      return;
    }
    if (projRes.status === "rejected") {
      // The task itself still renders; the project link just can't resolve.
      console.error("[task] failed to load projects", projRes.reason);
      setLoadError(`projects: ${projRes.reason?.message || projRes.reason}`);
    } else {
      setProjects(projRes.value);
    }
    setTask(remRes.value.find((r) => String(r.id) === String(id)) || null);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [id]);
  // Stay in sync if Frodo or another tab edits this reminder.
  useEffect(() => onDataChange("reminders", load), [id]);

  const project = useMemo(
    () => projects.find((p) => String(p.id) === String(task?.project_id)) || null,
    [projects, task]
  );

  const startEdit = () => { setForm(toForm(task)); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setForm(null); };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.recurrence !== "none" && !form.date) return; // submit is disabled; guard Enter-to-submit
    setSaving(true);
    const fields = {
      name: form.name.trim(),
      date: form.date || null,
      time: form.time || null,
      description: form.description || null,
      recurrence: form.recurrence,
      project_id: form.project_id || null,
      recur_until: form.recurrence !== "none" ? (form.recur_until || null) : null,
      recur_times: form.recurrence !== "none" && form.recur_times ? Number(form.recur_times) : null,
      show_on_calendar: form.show_on_calendar,
    };
    // Optimistic update so the view reflects the edit immediately.
    setTask((prev) => ({ ...prev, ...fields }));
    setEditing(false);
    try {
      await updateReminder(id, fields);
    } catch {
      await load();
    } finally {
      setSaving(false);
      setForm(null);
    }
  };

  const handleComplete = async () => {
    const recurring = task.recurrence && task.recurrence !== "none";
    // Recurring: tick off the pending occurrence (which may be a missed one),
    // not "today" — the series then shows its next date.
    const occurrence = recurring ? (nextOccurrence(task, todayStr) || todayStr) : todayStr;
    setTask((prev) => (recurring ? { ...prev, completed_date: occurrence } : { ...prev, completed: true, completed_date: occurrence }));
    try {
      const patch = await completeReminder(id, occurrence);
      setTask((prev) => ({ ...prev, ...patch }));
    } catch (err) {
      setLoadError(`Couldn't complete: ${err?.message || err}`);
      await load();
    }
  };

  const handleReopen = async () => {
    setTask((prev) => ({ ...prev, completed: false, completed_date: null }));
    try { await updateReminder(id, { completed: false, completed_date: null }); } catch { await load(); }
  };

  const handleDelete = async () => {
    if (!(await confirm(`Delete "${task?.name || "this task"}"?`, { title: "Delete task", confirmLabel: "Delete" }))) return;
    try {
      await deleteReminder(id);
      navigate("/admin/planner");
    } catch {
      await load();
    }
  };

  if (loading) {
    return (
      <div className="module-page">
        <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading task…</p>
      </div>
    );
  }

  if (!task && loadError) {
    return (
      <div className="module-page">
        <div className="module-header">
          <h1>Couldn't load task</h1>
          <button className="btn btn-sm" onClick={() => navigate("/admin/planner")}>← Back to tasks</button>
        </div>
        <p className="error-message" role="alert">
          {loadError}
          {" — "}
          <button type="button" className="btn-sm btn-secondary-sm btn" onClick={() => { setLoading(true); load(); }}>Retry</button>
        </p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="module-page">
        <div className="module-header">
          <h1>Task not found</h1>
          <button className="btn btn-sm" onClick={() => navigate("/admin/planner")}>← Back to tasks</button>
        </div>
        <p className="no-entries">No task with this id — it may have been deleted.</p>
      </div>
    );
  }

  const isRecurring = task.recurrence && task.recurrence !== "none";
  const next = nextOccurrence(task, todayStr); // one-time: its date; recurring: pending occurrence
  const overdue = !task.completed && next && next < todayStr;
  const dueToday = !task.completed && next === todayStr;
  const showEndOptions = editing && form && form.recurrence !== "none";
  const editNeedsDate = editing && form && form.recurrence !== "none" && !form.date;

  return (
    <div className="module-page">
      {dialog}
      {loadError && (
        <p className="error-message" role="alert">
          {loadError}
          {" — "}
          <button type="button" className="btn-sm btn-secondary-sm btn" onClick={load}>Retry</button>
        </p>
      )}

      {/* Page header: becomes the window caption in XP; Back sits in it like a toolbar button */}
      <div className="module-header">
        <h1><i className="fa-solid fa-list-check" /> Task</h1>
        <button className="btn btn-sm btn-secondary-sm" onClick={() => navigate(-1)}><i className="fa-solid fa-arrow-left" /> Back</button>
      </div>

      {/* ── Header ── */}
      <div className="task-detail-header" style={{ borderLeftColor: project?.color || "var(--accent)" }}>
        <div style={{ minWidth: 0 }}>
          {project && (
            <Link to={`/admin/planner?tab=projects&id=${project.id}`} className="task-detail-project" style={{ color: project.color }}>
              <span className="task-detail-project-dot" style={{ background: project.color }} />
              {project.name}
            </Link>
          )}
          <h1 className={`task-detail-title ${task.completed ? "is-done" : ""}`}>{task.name}</h1>
          <div className="task-detail-badges">
            {task.completed && <span className="task-badge task-badge--done">Completed</span>}
            {overdue && <span className="task-badge task-badge--overdue">Overdue</span>}
            {dueToday && <span className="task-badge task-badge--today">Today</span>}
            {task.recurrence && task.recurrence !== "none" && (
              <span className="task-badge">{RECUR_LABEL[task.recurrence] || task.recurrence}</span>
            )}
          </div>
        </div>
        {!editing && (
          <div className="task-detail-actions">
            <button className="btn btn-sm" onClick={startEdit}><i className="fa-solid fa-pen" /> Edit</button>
            {task.completed
              ? <button className="btn btn-sm" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={handleReopen}>↩ Reopen</button>
              : <button className="btn btn-sm btn-complete" onClick={handleComplete}>Done</button>}
          </div>
        )}
      </div>

      {/* ── View mode ── */}
      {!editing && (
        <>
          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Details</h3>
            <dl className="task-detail-grid">
              <dt>{isRecurring ? "Next due" : "Due date"}</dt>
              <dd className={overdue ? "task-overdue" : undefined}>
                {!task.date ? "No due date"
                  : isRecurring ? (next ? formatDisplayDate(next) : "Series finished")
                  : formatDisplayDate(task.date)}
                {task.time ? ` · ${formatTime12(task.time)}` : ""}
                {overdue ? " · overdue" : ""}
              </dd>
              {isRecurring && (
                <>
                  <dt>Started</dt>
                  <dd>{formatDisplayDate(task.date)}{task.completed_date ? ` · last done ${formatDisplayDate(task.completed_date)}` : ""}</dd>
                </>
              )}

              <dt>Repeats</dt>
              <dd>
                {RECUR_LABEL[task.recurrence] || "One-time"}
                {task.recur_until ? ` · until ${formatDisplayDate(task.recur_until)}` : ""}
                {task.recur_times ? ` · ${task.recur_times}×` : ""}
              </dd>

              <dt>Project</dt>
              <dd>{project ? project.name : "—"}</dd>

              <dt>On calendar</dt>
              <dd>{task.show_on_calendar === false ? "No" : "Yes"}</dd>

              {task.completed && (
                <>
                  <dt>Completed</dt>
                  <dd>{formatDisplayDate(task.completed_date || task.date) || "—"}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Notes</h3>
            {task.description
              ? <p className="task-detail-notes">{task.description}</p>
              : <p className="no-entries">No description.</p>}
          </div>

          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.5rem" }}><i className="fa-solid fa-paperclip" /> Documents</h3>
            <DocLinks entityType="reminder" entityId={task.id} title="Linked documents" />
          </div>

          <div className="db-card task-detail-danger">
            <div>
              <h3 className="db-card-title">Delete this task</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                This permanently removes the task{task.recurrence !== "none" ? " and all its occurrences" : ""}.
              </p>
            </div>
            <button className="btn-sm btn-delete" onClick={handleDelete}><i className="fa-solid fa-trash" /> Delete</button>
          </div>
        </>
      )}

      {/* ── Edit mode ── */}
      {editing && form && (
        <form className="form-card" onSubmit={saveEdit}>
          <div className="form-panel-head">
            <h3>Edit task</h3>
            <button type="button" className="icon-x" onClick={cancelEdit} aria-label="Cancel"><i className="fa-solid fa-xmark" /></button>
          </div>

          <input
            placeholder="Task name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="form-row">
            <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} placeholder="Due date" />
            <TimePicker value={form.time} onChange={(v) => setForm({ ...form, time: v })} />
          </div>
          {editNeedsDate && <p className="field-hint" role="status">A repeating task needs a start date — pick the first occurrence.</p>}

          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            style={{ resize: "vertical" }}
          />

          {showEndOptions && (
            <div className="form-row recur-limit-row">
              <div className="recur-limit-group">
                <label>End date (optional)</label>
                <DatePicker
                  value={form.recur_until}
                  onChange={(v) => setForm({ ...form, recur_until: v, recur_times: "" })}
                  placeholder="End date"
                />
              </div>
              <div className="recur-limit-group">
                <label>Or after N times</label>
                <input
                  type="number"
                  min="1"
                  value={form.recur_times}
                  onChange={(e) => setForm({ ...form, recur_times: e.target.value, recur_until: "" })}
                  placeholder="e.g. 4"
                />
              </div>
            </div>
          )}

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={form.show_on_calendar}
              onChange={(e) => setForm({ ...form, show_on_calendar: e.target.checked })}
            />
            Show on calendar
          </label>

          <div className="budget-widget-actions">
            <button className="btn" type="submit" disabled={saving || editNeedsDate} title={editNeedsDate ? "Pick a start date for the repeat" : undefined}>{saving ? "Saving…" : "Save changes"}</button>
            <button className="btn" type="button" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

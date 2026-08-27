import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadReminders, newReminder, completeReminder, updateReminder, deleteReminder, loadProjects } from "../../api/plannerApi";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import TimePicker from "../../components/TimePicker";
import { onDataChange } from "../../utils/dataEvents";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";

const emptyForm = { name: "", date: "", time: "", description: "", recurrence: "none", project_id: "", recur_until: "", recur_times: "", show_on_calendar: true };
const toForm = (r) => ({
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

export default function RemindersPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const openTask = (id) => navigate(`/admin/tasks/${id}`);
  const filter = params.get("project") || "all"; // "all" | "none" | project id (driven by the side panel)

  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // reminder id being edited (same form panel, prefilled)
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showDateTime, setShowDateTime] = useState(false);
  // Computed per render (not module-level) so overdue highlighting stays
  // correct if the tab is left open past midnight.
  const todayStr = toDateStr(new Date());

  const load = async () => {
    const [reminders, projs] = await Promise.all([
      loadReminders().catch(() => []),
      loadProjects().catch(() => []),
    ]);
    setList(reminders);
    setProjects(projs);
  };

  useEffect(() => { load(); }, []);

  // Refresh when Frodo creates/updates/deletes reminders from the ChatBot
  useEffect(() => onDataChange("reminders", load), []);

  const showEndOptions = form.recurrence !== "none";

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "none") return list.filter(r => !r.project_id);
    return list.filter(r => String(r.project_id) === String(filter));
  }, [list, filter]);

  const active = useMemo(() => filtered.filter((r) => !r.completed && r.date), [filtered]);
  const noDate = useMemo(() => filtered.filter((r) => !r.completed && !r.date), [filtered]);
  const completed = useMemo(() => filtered.filter((r) => r.completed), [filtered]);

  const handleComplete = async (id) => {
    const completedDate = toDateStr(new Date());
    setList((prev) => prev.map((r) => r.id === id ? { ...r, completed: true, completed_date: completedDate } : r));
    try { await completeReminder(id); } catch { await load(); }
  };

  const handleUncomplete = async (id) => {
    const r = list.find((x) => x.id === id);
    if (!(await confirm(`Mark "${r?.name || "this task"}" as incomplete?`, { title: "Undo completion", confirmLabel: "Undo" }))) return;
    setList((prev) => prev.map((x) => x.id === id ? { ...x, completed: false, completed_date: null } : x));
    try { await updateReminder(id, { completed: false, completed_date: null }); } catch { await load(); }
  };

  const handleDelete = async (id) => {
    const r = list.find((x) => x.id === id);
    if (!(await confirm(`Delete "${r?.name || "this task"}"?`, { title: "Delete task", confirmLabel: "Delete" }))) return;
    setList((prev) => prev.filter((x) => x.id !== id));
    try { await deleteReminder(id); } catch { await load(); }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowDescription(false);
    setShowDateTime(false);
    setEditing(null);
  };
  const closeForm = () => { resetForm(); setShowForm(false); };
  const startEdit = (r) => {
    setForm(toForm(r));
    setShowDateTime(Boolean(r.date || r.time));
    setShowDescription(Boolean(r.description));
    setEditing(r.id);
    setShowForm(true);
  };

  const fieldsFromForm = () => ({
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

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = editing;
    const prev = list.find((x) => x.id === id);
    const fields = fieldsFromForm();
    setSaving(true);
    // Optimistic: apply locally, roll back and surface the real error on failure.
    setList((l) => l.map((x) => x.id === id ? { ...x, ...fields } : x));
    closeForm();
    try {
      await updateReminder(id, fields);
      addToast("Task updated.", "success");
    } catch (err) {
      setList((l) => l.map((x) => x.id === id ? prev : x));
      addToast(`Couldn't save task: ${err?.message || "unknown error"}`, "error");
    } finally { setSaving(false); }
  };

  const addReminder = async (e) => {
    e.preventDefault();
    if (editing) return saveEdit(e);
    if (!form.name) return;
    const tempId = `temp-${Date.now()}`;
    const fields = fieldsFromForm();
    setList((prev) => [...prev, { id: tempId, completed: false, ...fields }]);
    resetForm();
    try {
      const saved = await newReminder(fields);
      if (saved?.id) {
        setList((prev) => prev.map((r) => r.id === tempId ? { completed: false, ...saved } : r));
      } else {
        await load();
      }
    } catch (err) {
      setList((prev) => prev.filter((r) => r.id !== tempId));
      addToast(`Couldn't add task: ${err?.message || "unknown error"}`, "error");
    }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || "";
  const projectColor = (id) => projects.find(p => p.id === id)?.color || "var(--text-muted)";

  const renderTask = (r) => (
    <div className="completed-item" key={r.id}>
      <span
        className="task-row-main"
        role="button"
        tabIndex={0}
        onClick={() => openTask(r.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(r.id); } }}
        style={{ display: "flex", flexDirection: "column", gap: "2px", cursor: "pointer", minWidth: 0 }}
      >
        <strong>{r.name}</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {r.date && <span style={r.date < todayStr ? { color: "var(--danger, var(--red))" } : undefined}>{formatDisplayDate(r.date)}</span>}
          {r.time && <span>· {String(r.time).slice(0, 5)}</span>}
          {r.show_on_calendar === false && <span>· off calendar</span>}
          {r.recurrence !== "none" && <span>· {r.recurrence}</span>}
          {r.recur_until && <span>· until {r.recur_until}</span>}
          {r.recur_times && <span>· {r.recur_times}×</span>}
          {r.project_id && (
            <span style={{ color: projectColor(r.project_id) }}>· {projectName(r.project_id)}</span>
          )}
        </span>
      </span>
      <span className="header-actions">
        <button type="button" className="btn-mini" onClick={() => startEdit(r)} title="Edit task">
          <i className="fa-solid fa-pen" /> Edit
        </button>
        <button type="button" className="btn-sm btn-complete" onClick={() => handleComplete(r.id)}>
          Done
        </button>
        <button type="button" className="btn-sm btn-delete" onClick={() => handleDelete(r.id)}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </span>
    </div>
  );

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Tasks &amp; Reminders</h1>
        <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"}`} /> {showForm ? "Close" : "New Task"}
        </button>
      </div>

      <div className={`tasks-layout ${showForm ? "with-form" : ""}`}>
        {/* Left: create form panel (hidden until "New Task") */}
        {showForm && (
          <aside className="tasks-form-panel">
            <form className="form-card" onSubmit={addReminder}>
              <div className="form-panel-head">
                <h3>{editing ? "Edit task" : "New task"}</h3>
                <button type="button" className="icon-x" onClick={closeForm} aria-label="Close">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <input
                placeholder="Task name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
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

              {showDateTime && (
                <div className="form-row">
                  <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
                  <TimePicker value={form.time} onChange={(v) => setForm({ ...form, time: v })} />
                </div>
              )}

              {showDescription && (
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              )}

              <div className="form-meta-row">
                <button type="button" className="btn-tiny-blue" onClick={() => setShowDateTime((s) => !s)}>
                  <i className={`fa-solid ${showDateTime ? "fa-minus" : "fa-plus"}`} /> Date &amp; time
                </button>
                <button type="button" className="btn-tiny-blue" onClick={() => setShowDescription((s) => !s)}>
                  <i className={`fa-solid ${showDescription ? "fa-minus" : "fa-plus"}`} /> Description
                </button>
              </div>

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

              <div className="form-actions">
                <button className="btn" type="submit" disabled={saving}>{editing ? (saving ? "Saving…" : "Save changes") : "Add Task"}</button>
                {editing && <button className="btn btn-secondary-sm" type="button" onClick={closeForm}>Cancel</button>}
              </div>
            </form>
          </aside>
        )}

        {/* Right: task list */}
        <div className="tasks-list">
          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Active ({active.length})</h3>
            {active.length === 0 && <p className="no-entries">No active tasks. All clear.</p>}
            {active.map(renderTask)}
          </div>

          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>No due date ({noDate.length})</h3>
            {noDate.length === 0 && <p className="no-entries">No undated tasks.</p>}
            {noDate.map(renderTask)}
          </div>

          {completed.length > 0 && (
            <div className="db-card">
              <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Completed ({completed.length})</h3>
              {completed.map((r) => (
                <div className="completed-item" key={r.id} style={{ opacity: 0.6 }}>
                  <span style={{ textDecoration: "line-through" }}>{r.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {formatDisplayDate(r.completed_date || r.date)}
                    </span>
                    <button type="button" className="btn-sm" style={{ opacity: 0.7, fontSize: "0.7rem" }} onClick={() => handleUncomplete(r.id)} title="Undo completion">
                      ↩ Undo
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

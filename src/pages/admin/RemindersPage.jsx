import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadReminders, newReminder, completeReminder, deleteReminder, loadProjects } from "../../api/plannerApi";
import { formatDisplayDate } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import TimePicker from "../../components/TimePicker";

const emptyForm = { name: "", date: "", time: "", description: "", recurrence: "none", project_id: "", recur_until: "", recur_times: "", show_on_calendar: true };

export default function RemindersPage() {
  const [params] = useSearchParams();
  const filter = params.get("project") || "all"; // "all" | "none" | project id (driven by the side panel)

  const [list, setList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showDateTime, setShowDateTime] = useState(false);

  const load = async () => {
    const [reminders, projs] = await Promise.all([
      loadReminders().catch(() => []),
      loadProjects().catch(() => []),
    ]);
    setList(reminders);
    setProjects(projs);
  };

  useEffect(() => { load(); }, []);

  const showEndOptions = form.recurrence !== "none";

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "none") return list.filter(r => !r.project_id);
    return list.filter(r => String(r.project_id) === String(filter));
  }, [list, filter]);

  const active = useMemo(() => filtered.filter((r) => !r.completed), [filtered]);
  const completed = useMemo(() => filtered.filter((r) => r.completed), [filtered]);

  const addReminder = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    await newReminder({
      name: form.name,
      date: form.date || null,
      time: form.time || null,
      description: form.description || null,
      recurrence: form.recurrence,
      project_id: form.project_id || null,
      recur_until: form.recur_until || null,
      recur_times: form.recur_times ? Number(form.recur_times) : null,
      show_on_calendar: form.show_on_calendar,
    });
    setForm(emptyForm);
    setShowDescription(false);
    setShowDateTime(false);
    await load();
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || "";
  const projectColor = (id) => projects.find(p => p.id === id)?.color || "var(--text-muted)";

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Tasks &amp; Reminders</h1>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"}`} /> {showForm ? "Close" : "New Task"}
        </button>
      </div>

      <div className={`tasks-layout ${showForm ? "with-form" : ""}`}>
        {/* Left: create form panel (hidden until "New Task") */}
        {showForm && (
          <aside className="tasks-form-panel">
            <form className="form-card" onSubmit={addReminder}>
              <div className="form-panel-head">
                <h3>New task</h3>
                <button type="button" className="icon-x" onClick={() => setShowForm(false)} aria-label="Close">
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

              <button className="btn" type="submit">Add Task</button>
            </form>
          </aside>
        )}

        {/* Right: task list */}
        <div className="tasks-list">
          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Active ({active.length})</h3>
            {active.length === 0 && <p className="no-entries">No active tasks. All clear! 🎉</p>}
            {active.map((r) => (
              <div className="completed-item" key={r.id}>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <strong>{r.name}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {r.date && <span>{formatDisplayDate(r.date)}</span>}
                    {r.time && <span>· {r.time}</span>}
                    {r.show_on_calendar === false && <span>· off calendar</span>}
                    {r.recurrence !== "none" && <span>· {r.recurrence}</span>}
                    {r.recur_until && <span>· until {r.recur_until}</span>}
                    {r.recur_times && <span>· {r.recur_times}×</span>}
                    {r.project_id && (
                      <span style={{ color: projectColor(r.project_id) }}>· {projectName(r.project_id)}</span>
                    )}
                  </span>
                </span>
                <span>
                  <button type="button" className="btn-sm btn-complete" onClick={() => completeReminder(r.id).then(load)}>
                    ✓ Done
                  </button>
                  <button type="button" className="btn-sm btn-delete" onClick={() => deleteReminder(r.id).then(load)}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>

          {completed.length > 0 && (
            <div className="db-card">
              <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Completed ({completed.length})</h3>
              {completed.map((r) => (
                <div className="completed-item" key={r.id} style={{ opacity: 0.6 }}>
                  <span style={{ textDecoration: "line-through" }}>{r.name}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {formatDisplayDate(r.completed_date || r.date)}
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

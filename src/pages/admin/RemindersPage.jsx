import { useEffect, useMemo, useState } from "react";
import { loadReminders, newReminder, completeReminder, deleteReminder, loadProjects } from "../../api/plannerApi";
import { formatDisplayDate } from "../../utils/plannerUtils";

const emptyForm = { name: "", date: "", recurrence: "none", project_id: "", recur_until: "", recur_times: "" };

export default function RemindersPage() {
  const [list, setList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("all"); // "all" | project id

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
    return list.filter(r => r.project_id === filter);
  }, [list, filter]);

  const active = useMemo(() => filtered.filter((r) => !r.completed), [filtered]);
  const completed = useMemo(() => filtered.filter((r) => r.completed), [filtered]);

  const addReminder = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    await newReminder({
      name: form.name,
      date: form.date,
      recurrence: form.recurrence,
      project_id: form.project_id || null,
      recur_until: form.recur_until || null,
      recur_times: form.recur_times ? Number(form.recur_times) : null,
    });
    setForm(emptyForm);
    await load();
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || "";
  const projectColor = (id) => projects.find(p => p.id === id)?.color || "var(--text-muted)";

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Tasks &amp; Reminders</h1>
      </div>

      {/* Add task form */}
      <form className="form-card" onSubmit={addReminder}>
        <div className="form-row">
          <input
            placeholder="Task name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div className="form-row">
          <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {showEndOptions && (
          <div className="form-row recur-limit-row">
            <div className="recur-limit-group">
              <label>End date (optional)</label>
              <input
                type="date"
                value={form.recur_until}
                onChange={(e) => setForm({ ...form, recur_until: e.target.value, recur_times: "" })}
                placeholder="Repeat until…"
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
        <button className="btn" type="submit">Add Task</button>
      </form>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="project-filter-bar">
          <button
            className={`filter-chip ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >All</button>
          <button
            className={`filter-chip ${filter === "none" ? "active" : ""}`}
            onClick={() => setFilter("none")}
          >Personal</button>
          {projects.map(p => (
            <button
              key={p.id}
              className={`filter-chip ${filter === p.id ? "active" : ""}`}
              style={{ "--chip-color": p.color }}
              onClick={() => setFilter(p.id)}
            >{p.name}</button>
          ))}
        </div>
      )}

      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Active ({active.length})</h3>
        {active.length === 0 && <p className="no-entries">No active tasks. All clear! 🎉</p>}
        {active.map((r) => (
          <div className="completed-item" key={r.id}>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong>{r.name}</strong>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {r.date && <span>{formatDisplayDate(r.date)}</span>}
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
  );
}

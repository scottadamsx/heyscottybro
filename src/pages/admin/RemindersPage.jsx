import { useEffect, useMemo, useState } from "react";
import { loadReminders, newReminder, completeReminder, deleteReminder } from "../../api/plannerApi";
import { formatDisplayDate } from "../../utils/plannerUtils";

const emptyForm = { name: "", date: "", recurrence: "none" };

export default function RemindersPage() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const load = async () => setList(await loadReminders());

  useEffect(() => { load(); }, []);

  const active = useMemo(() => list.filter((r) => !r.completed), [list]);
  const completed = useMemo(() => list.filter((r) => r.completed), [list]);

  const addReminder = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    await newReminder(form);
    setForm(emptyForm);
    await load();
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Tasks &amp; Reminders</h1>
      </div>

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
          <button className="btn" type="submit">Add Task</button>
        </div>
      </form>

      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Active ({active.length})</h3>
        {active.length === 0 && <p className="no-entries">No active tasks. All clear! 🎉</p>}
        {active.map((r) => (
          <div className="completed-item" key={r.id}>
            <span>
              <strong>{r.name}</strong>
              {r.date && <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>— {formatDisplayDate(r.date)}</span>}
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

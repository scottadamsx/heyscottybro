/**
 * Plan > Work — a daily log of what got done, with notes and the project it
 * was for. Rows live in `work_log` (see MIGRATION_2026-08-26-work-log.sql);
 * agents reach them through the "work_log" collection in aiLibrary.
 */
import { useEffect, useMemo, useState } from "react";
import { loadWorkLog, createWorkLog, deleteWorkLog } from "../../api/workLogApi";
import { loadProjects } from "../../api/plannerApi";
import { onDataChange } from "../../utils/dataEvents";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { useToast } from "../../contexts/ToastContext";
import DatePicker from "../../components/DatePicker";

const emptyForm = () => ({ date: toDateStr(new Date()), task: "", notes: "", project_id: "", minutes: "" });

export default function WorkLogPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [r, p] = await Promise.all([loadWorkLog(), loadProjects()]);
      setRows(r); setProjects(p); setError("");
    } catch (e) { setError(e.message || "Couldn't load the work log."); }
  };
  useEffect(() => { load(); const a = onDataChange("work_log", load); const b = onDataChange("projects", load); return () => { a(); b(); }; }, []);

  const projectName = (id) => projects.find((p) => String(p.id) === String(id))?.name;

  const byDay = useMemo(() => {
    const m = new Map();
    for (const r of rows) (m.get(r.date) || m.set(r.date, []).get(r.date)).push(r);
    return [...m.entries()];
  }, [rows]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.task.trim()) return;
    setSaving(true);
    try {
      await createWorkLog(form);
      setForm((f) => ({ ...emptyForm(), date: f.date, project_id: f.project_id }));
      addToast("Logged.", "success");
    } catch (err) { addToast(`Couldn't save: ${err.message}`, "error"); }
    finally { setSaving(false); }
  };

  const remove = async (r) => {
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    try { await deleteWorkLog(r.id); } catch (err) { addToast(`Couldn't delete: ${err.message}`, "error"); load(); }
  };

  const minutesFor = (list) => list.reduce((a, r) => a + (Number(r.minutes) || 0), 0);

  return (
    <div className="module-page">
      <div className="module-header"><h1><i className="fa-solid fa-briefcase" /> Work log</h1></div>
      {error && <p className="error-message">{error}</p>}

      <form className="form-card" onSubmit={submit}>
        <div className="form-row">
          <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} aria-label="Project">
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="0" step="5" placeholder="min" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} aria-label="Minutes" className="worklog-min" />
        </div>
        <div className="form-row">
          <input className="field-grow" placeholder="What did you do?" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} autoFocus required />
        </div>
        <textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Log work"}</button>
      </form>

      {byDay.length === 0 && !error && <p className="no-entries">Nothing logged yet. Add what you worked on today.</p>}

      {byDay.map(([date, list]) => (
        <div className="db-card" key={date}>
          <div className="db-card-header">
            <div className="db-card-title">{formatDisplayDate(date)}</div>
            <span className="db-count">{list.length} {list.length === 1 ? "item" : "items"}{minutesFor(list) ? ` · ${minutesFor(list)} min` : ""}</span>
          </div>
          <div className="db-list">
            {list.map((r) => (
              <div className="db-list-item" key={r.id}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{r.task}</div>
                  <div className="db-list-item-subtitle">
                    {projectName(r.project_id) && <span className="worklog-project">{projectName(r.project_id)}</span>}
                    {r.minutes ? <span> · {r.minutes} min</span> : null}
                    {r.notes && <div className="worklog-notes">{r.notes}</div>}
                  </div>
                </div>
                <button className="icon-x sm" onClick={() => remove(r)} aria-label="Delete entry"><i className="fa-solid fa-xmark" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

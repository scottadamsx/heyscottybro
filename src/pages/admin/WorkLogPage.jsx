/**
 * Plan > Work — a daily log of what got done, with notes and the project it
 * was for. Rows live in `work_log` (see MIGRATION_2026-08-26-work-log.sql);
 * agents reach them through the "work_log" collection in aiLibrary.
 */
import { useEffect, useMemo, useState } from "react";
import { loadWorkLog, createWorkLog, updateWorkLog, deleteWorkLog } from "../../api/workLogApi";
import { loadProjects, newReminder, updateReminder } from "../../api/plannerApi";
import { onDataChange } from "../../utils/dataEvents";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { useToast } from "../../contexts/ToastContext";
import DatePicker from "../../components/DatePicker";
import { FormModal, Field } from "../../components/ui";
import "./plan.css";
import { useConfirm } from "../../hooks/useConfirm";

const emptyForm = () => ({ date: toDateStr(new Date()), task: "", notes: "", project_id: "", minutes: "" });

/** The log-work fields, shared by "Log work" and a row's Edit. */
function WorkLogFields({ form, setForm, projects }) {
  return (
    <>
      <Field label="What did you do?">
        <input value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} data-autofocus required />
      </Field>
      <div className="form-row">
        <div className="uik-field">
          <span className="field-label">Date</span>
          <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </div>
        <Field label="Minutes" className="worklog-min">
          <input type="number" min="0" step="5" placeholder="min" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
        </Field>
      </div>
      <Field label="Project">
        <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </Field>
    </>
  );
}

export default function WorkLogPage() {
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [mirrorToReminders, setMirrorToReminders] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

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

  // Throws on failure: the modal stays open with the error and what was typed.
  const submit = async () => {
    if (!form.task.trim()) throw new Error("Say what you worked on.");
    try {
      await createWorkLog(form);
      if (mirrorToReminders) {
        const linked = await newReminder({
          name: form.task.trim(),
          date: form.date || null,
          description: form.notes?.trim() || null,
          recurrence: "none",
          project_id: form.project_id || null,
          show_on_calendar: true,
        });
        // Work log rows represent finished work, so mirrored reminders are closed.
        if (linked?.id) {
          await updateReminder(linked.id, {
            completed: true,
            completed_date: form.date || toDateStr(new Date()),
          });
        }
      }
      setForm((f) => ({ ...emptyForm(), date: f.date, project_id: f.project_id }));
      addToast("Logged.", "success");
    } catch (err) { throw new Error(`Couldn't save: ${err.message}`, { cause: err }); }
  };

  const remove = async (r) => {
    if (!await confirm(`Delete the work log entry "${r.task || "this entry"}"?`, { title: "Delete entry", confirmLabel: "Delete" })) return;
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    try { await deleteWorkLog(r.id); } catch (err) { addToast(`Couldn't delete: ${err.message}`, "error"); load(); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({ date: r.date, task: r.task || "", notes: r.notes || "", project_id: r.project_id || "", minutes: r.minutes != null ? String(r.minutes) : "" });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };
  const saveEdit = async () => {
    if (!editForm.task.trim()) throw new Error("Say what you worked on.");
    const id = editingId;
    const prev = rows.find((x) => x.id === id);
    const patch = { date: editForm.date, task: editForm.task.trim(), notes: editForm.notes || "", project_id: editForm.project_id || null, minutes: editForm.minutes ? Number(editForm.minutes) : null };
    // Optimistic: apply locally, roll back + surface the real error on failure.
    setRows((list) => list.map((x) => x.id === id ? { ...x, ...patch } : x));
    try {
      await updateWorkLog(id, patch);
      addToast("Updated.", "success");
    } catch (err) {
      setRows((list) => list.map((x) => x.id === id ? prev : x));
      throw new Error(`Couldn't save: ${err.message}`, { cause: err });
    }
  };

  const minutesFor = (list) => list.reduce((a, r) => a + (Number(r.minutes) || 0), 0);

  return (
    <div className="module-page worklog-page">
      {dialog}
      <div className="module-header worklog-head">
        <h1>Work log</h1>
        <button type="button" className="btn btn-primary worklog-log-btn" onClick={() => setShowLog(true)}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Log work
        </button>
      </div>
      {error && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{error}</p>
          <button type="button" className="btn-secondary-sm" onClick={load}>Retry</button>
        </div>
      )}

      {showLog && (
        <FormModal title="Log work" submitLabel="Log work" onClose={() => setShowLog(false)} onSubmit={submit}>
          <WorkLogFields form={form} setForm={setForm} projects={projects} />
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={mirrorToReminders}
              onChange={(e) => setMirrorToReminders(e.target.checked)}
            />
            Also add this to Reminders + Calendar
          </label>
        </FormModal>
      )}

      {editForm && (
        <FormModal title="Edit work log entry" submitLabel="Save changes" onClose={cancelEdit} onSubmit={saveEdit}>
          <WorkLogFields form={editForm} setForm={setEditForm} projects={projects} />
        </FormModal>
      )}

      {byDay.length === 0 && !error && <p className="no-entries">Nothing logged yet. Add what you worked on today.</p>}

      {byDay.map(([date, list]) => (
        <section className="db-card" key={date} aria-label={formatDisplayDate(date)}>
          <div className="db-card-header">
            <h3 className="db-card-title">{formatDisplayDate(date)}</h3>
            <span className="db-count">{list.length} {list.length === 1 ? "item" : "items"}{minutesFor(list) ? ` · ${minutesFor(list)} min` : ""}</span>
          </div>
          <div className="db-list plan-list">
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
                <button type="button" className="btn-mini" onClick={() => startEdit(r)} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                <button type="button" className="icon-x sm" onClick={() => remove(r)} aria-label="Delete entry"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

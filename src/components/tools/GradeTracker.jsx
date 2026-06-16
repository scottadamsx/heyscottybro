import { useEffect, useMemo, useState } from "react";
import { loadGrades, createGrade, updateGrade, deleteGrade, gradeStats } from "../../api/gradesApi";
import { generateCatchUpPlan } from "../../api/aiGrades";
import { newReminder } from "../../api/plannerApi";
import { toDateStr } from "../../utils/plannerUtils";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";

const EMPTY = { course: "", name: "", earned: "", max: "100", weight: "", feedback: "" };
const pct = (e, m) => (e != null && e !== "" && Number(m) > 0 ? Math.round((Number(e) / Number(m)) * 100) : null);
const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

export default function GradeTracker() {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = () => loadGrades().then((r) => { setRows(r); setReady(true); }).catch((e) => { addToast(e.message, "error"); setReady(true); });
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const stats = useMemo(() => gradeStats(rows), [rows]);

  const openNew = () => { setEditId(null); setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit = (g) => {
    setEditId(g.id);
    setForm({ course: g.course || "", name: g.name, earned: g.earned ?? "", max: String(g.max ?? 100), weight: String(g.weight ?? ""), feedback: g.feedback || "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { addToast("Give the assessment a name.", "error"); return; }
    const payload = {
      course: form.course.trim(),
      name: form.name.trim(),
      earned: form.earned === "" ? null : Number(form.earned),
      max: Number(form.max) || 100,
      weight: Number(form.weight) || 0,
      feedback: form.feedback.trim(),
    };
    try {
      if (editId) { await updateGrade(editId, payload); } else { await createGrade(payload); }
      setShowForm(false); setEditId(null); setForm({ ...EMPTY });
      refresh();
    } catch (e) { addToast(e.message, "error"); }
  };

  const remove = async (g) => {
    if (!await confirm(`Delete "${g.name}"?`, { title: "Delete assessment", confirmLabel: "Delete" })) return;
    try { await deleteGrade(g.id); setRows((rs) => rs.filter((x) => x.id !== g.id)); }
    catch (e) { addToast(e.message, "error"); }
  };

  const makePlan = async () => {
    if (rows.length === 0) { addToast("Add some assessments first.", "error"); return; }
    setPlanning(true); setPlan(null);
    try { setPlan(await generateCatchUpPlan(rows)); }
    catch (e) { addToast(e.message, "error"); }
    finally { setPlanning(false); }
  };

  const addPlanToReminders = async () => {
    if (!plan?.action_items?.length) return;
    setAdding(true);
    const today = new Date();
    let made = 0;
    for (const item of plan.action_items) {
      const d = new Date(today); d.setDate(d.getDate() + (Number(item.offset_days) || 0));
      try {
        await newReminder({ name: `📚 ${item.title}`, date: toDateStr(d), description: item.detail || "Catch-up task from your Grade Tracker plan." });
        made++;
      } catch { /* keep going */ }
    }
    setAdding(false);
    addToast(`Added ${made} study task${made === 1 ? "" : "s"} to your reminders.`, "success");
  };

  if (!ready) return <p className="no-entries">Loading grades…</p>;

  return (
    <div className="gt">
      {dialog}

      {/* Headline numbers */}
      <div className="gt-stats">
        <div className="gt-stat"><span className="gt-stat-label">Average so far</span><span className="gt-stat-val">{fmtPct(stats.currentPct)}</span></div>
        <div className="gt-stat"><span className="gt-stat-label">Projected final</span><span className="gt-stat-val">{fmtPct(stats.projectedFinal)}</span></div>
        <div className="gt-stat"><span className="gt-stat-label">Weight graded</span><span className="gt-stat-val">{stats.earnedWeight}% / {stats.totalWeight}%</span></div>
      </div>

      <div className="gt-actions">
        <button className="btn btn-sm" onClick={openNew}><i className="fa-solid fa-plus" /> Add assessment</button>
        <button className="btn btn-sm" onClick={makePlan} disabled={planning}>
          {planning ? <><i className="fa-solid fa-spinner fa-spin" /> Thinking…</> : <><i className="fa-solid fa-wand-magic-sparkles" /> Generate catch-up plan</>}
        </button>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="gt-form">
          <div className="gt-form-row">
            <input placeholder="Course (e.g. CP 2561)" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
            <input placeholder="Assessment (e.g. Test 2)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="gt-form-row">
            <label>Earned<input type="number" step="0.01" placeholder="—" value={form.earned} onChange={(e) => setForm({ ...form, earned: e.target.value })} /></label>
            <label>Out of<input type="number" step="0.01" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></label>
            <label>Weight %<input type="number" step="0.1" placeholder="e.g. 15" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
          </div>
          <textarea placeholder="Instructor feedback (optional — fuels the catch-up plan)" rows={2} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} />
          <div className="gt-form-actions">
            <button className="btn btn-sm btn-primary-sm" onClick={save}>{editId ? "Save" : "Add"}</button>
            <button className="btn btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Assessment list */}
      {rows.length === 0 ? (
        <p className="no-entries">No assessments yet. Add your graded and upcoming work to see your projected final.</p>
      ) : (
        <div className="gt-list">
          {rows.map((g) => {
            const p = pct(g.earned, g.max);
            return (
              <div className="gt-item" key={g.id}>
                <div className="gt-item-main">
                  <div className="gt-item-title">{g.course && <span className="gt-course">{g.course}</span>}{g.name}</div>
                  <div className="gt-item-sub">
                    {g.earned != null ? `${g.earned}/${g.max}` : `— /${g.max}`} · weight {g.weight}%{g.feedback ? " · has feedback" : ""}
                  </div>
                </div>
                <div className={`gt-item-pct ${p != null && p < 60 ? "low" : p != null && p >= 80 ? "high" : ""}`}>{p == null ? "—" : `${p}%`}</div>
                <div className="gt-item-btns">
                  <button className="btn-mini" onClick={() => openEdit(g)}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-mini danger" onClick={() => remove(g)}><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI plan */}
      {plan && (
        <div className="gt-plan">
          <h4><i className="fa-solid fa-wand-magic-sparkles" /> Catch-up plan</h4>
          {plan.summary && <p className="gt-plan-summary">{plan.summary}</p>}
          {plan.weak_areas?.length > 0 && (
            <div className="gt-weak">
              <span className="gt-weak-label">Focus on:</span>
              {plan.weak_areas.map((w, i) => <span key={i} className="gt-weak-chip">{w}</span>)}
            </div>
          )}
          <ol className="gt-plan-items">
            {plan.action_items.map((it, i) => (
              <li key={i}><strong>{it.title}</strong>{it.detail ? <> — {it.detail}</> : null}</li>
            ))}
          </ol>
          {plan.action_items.length > 0 && (
            <button className="btn btn-sm btn-primary-sm" onClick={addPlanToReminders} disabled={adding}>
              {adding ? <><i className="fa-solid fa-spinner fa-spin" /> Adding…</> : <><i className="fa-solid fa-list-check" /> Add {plan.action_items.length} task{plan.action_items.length === 1 ? "" : "s"} to Reminders</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

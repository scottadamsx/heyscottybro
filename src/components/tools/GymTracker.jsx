import { useEffect, useMemo, useState } from "react";
import { loadWorkouts, createWorkout, deleteWorkout, exerciseSummary } from "../../api/workoutsApi";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { useToast } from "../../contexts/ToastContext";
import "./tools.css";
import DatePicker from "../DatePicker";

const EMPTY = () => ({ date: toDateStr(new Date()), exercise: "", weight: "", reps: "", sets: "1", notes: "" });

// Tiny inline sparkline of a numeric series (no chart lib needed).
function Spark({ series }) {
  if (!series || series.length < 2) return <span className="gym-spark-empty">—</span>;
  const vals = series.map((s) => s.weight);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const w = 88, h = 22;
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((s.weight - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="gym-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} className="gym-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function GymTracker() {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(EMPTY());

  const refresh = () => loadWorkouts().then((r) => { setRows(r); setReady(true); }).catch((e) => { addToast(e.message, "error"); setReady(true); });
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const summary = useMemo(() => exerciseSummary(rows), [rows]);
  const recent = rows.slice(0, 12);

  const log = async () => {
    if (!form.exercise.trim()) { addToast("Name the exercise.", "error"); return; }
    try {
      await createWorkout({
        date: form.date || toDateStr(new Date()),
        exercise: form.exercise,
        weight: Number(form.weight) || 0,
        reps: Number(form.reps) || 0,
        sets: Number(form.sets) || 1,
        notes: form.notes.trim(),
      });
      setForm((f) => ({ ...EMPTY(), date: f.date })); // keep the date (logging several exercises same day); clear everything else
      refresh();
    } catch (e) { addToast(e.message, "error"); }
  };

  const remove = async (id) => {
    try { await deleteWorkout(id); setRows((rs) => rs.filter((x) => x.id !== id)); }
    catch (e) { addToast(e.message, "error"); }
  };

  if (!ready) return <p className="no-entries">Loading workouts…</p>;

  return (
    <div className="gym">
      {/* Log form */}
      <section className="db-card gym-form" aria-label="Log a set">
        <div className="db-card-header">
          <h3 className="db-card-title">Log a set</h3>
        </div>
        <div className="gym-form-row">
          <div className="gym-field gym-field-date">
            <span className="gym-field-label">Date</span>
            <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <label className="gym-field gym-grow">Exercise<input placeholder="e.g. Bench Press" value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} onKeyDown={(e) => e.key === "Enter" && log()} /></label>
          <label className="gym-field gym-num">Weight (lb)<input type="number" step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
          <label className="gym-field gym-num">Reps<input type="number" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} /></label>
          <label className="gym-field gym-num">Sets<input type="number" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></label>
          <button type="button" className="btn gym-log-btn" onClick={log}><i className="fa-solid fa-plus" aria-hidden="true" /> Log</button>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-dumbbell empty-state-icon" aria-hidden="true" />
          <p className="empty-state-desc">No workouts logged yet. Log a set above to start tracking PRs and progression.</p>
        </div>
      ) : (
        <div className="gym-layout">
          {/* Per-exercise progress + PRs */}
          <section className="db-card gym-exercises" aria-label="Exercises">
            <div className="db-card-header">
              <h3 className="db-card-title">Exercises</h3>
              <span className="db-count">{summary.length}</span>
            </div>
            <div className="gym-grid">
              {summary.map((s) => (
                <div className="gym-card" key={s.exercise}>
                  <div className="gym-card-head">
                    <span className="gym-card-name">{s.exercise}</span>
                    <span className="gym-card-count">{s.count} log{s.count === 1 ? "" : "s"}</span>
                  </div>
                  <div className="gym-card-pr">
                    <div><span className="gym-k">PR</span><b>{s.pr ? `${s.pr.weight} lb × ${s.pr.reps || 0}` : "—"}</b></div>
                    <div><span className="gym-k">est. 1RM</span><b>{s.est1rm ? `${s.est1rm} lb` : "—"}</b></div>
                  </div>
                  <Spark series={s.series} />
                </div>
              ))}
            </div>
          </section>

          {/* Recent log */}
          <section className="db-card gym-recent" aria-label="Recent">
            <div className="db-card-header">
              <h3 className="db-card-title">Recent</h3>
            </div>
            <div className="gym-log">
              {recent.map((w) => (
                <div className="gym-log-row" key={w.id}>
                  <div className="gym-log-main">
                    <span className="gym-log-ex">{w.exercise}</span>
                    <span className="gym-log-date">{formatDisplayDate(w.date).split(",")[0]}</span>
                  </div>
                  <span className="gym-log-detail">{w.weight} lb · {w.reps}×{w.sets}</span>
                  <button type="button" className="icon-x sm" onClick={() => remove(w.id)} aria-label={`Delete ${w.exercise} log`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

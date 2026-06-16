import { useEffect, useMemo, useState } from "react";
import { loadWorkouts, createWorkout, deleteWorkout, exerciseSummary } from "../../api/workoutsApi";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { useToast } from "../../contexts/ToastContext";

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
    <svg className="gym-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
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
      setForm((f) => ({ ...EMPTY(), date: f.date, exercise: f.exercise })); // keep date+exercise for fast repeat sets
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
      <div className="gym-form">
        <div className="gym-form-row">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="gym-grow" placeholder="Exercise (e.g. Bench Press)" value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} onKeyDown={(e) => e.key === "Enter" && log()} />
        </div>
        <div className="gym-form-row">
          <label>Weight (lb)<input type="number" step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
          <label>Reps<input type="number" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} /></label>
          <label>Sets<input type="number" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></label>
          <button className="btn btn-sm btn-primary-sm" onClick={log}><i className="fa-solid fa-plus" /> Log</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="no-entries">No workouts logged yet. Log a set above to start tracking PRs and progression.</p>
      ) : (
        <>
          {/* Per-exercise progress + PRs */}
          <p className="gym-section">Exercises</p>
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

          {/* Recent log */}
          <p className="gym-section">Recent</p>
          <div className="gym-log">
            {recent.map((w) => (
              <div className="gym-log-row" key={w.id}>
                <span className="gym-log-date">{formatDisplayDate(w.date).split(",")[0]}</span>
                <span className="gym-log-ex">{w.exercise}</span>
                <span className="gym-log-detail">{w.weight} lb · {w.reps}×{w.sets}</span>
                <button className="btn-mini danger" onClick={() => remove(w.id)}><i className="fa-solid fa-xmark" /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormModal, Field } from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { AddExerciseModal, LogSetModal } from "../../components/health/WorkoutModals";
import * as api from "../../api/healthApi";
import { onDataChange } from "../../utils/dataEvents";
import { DEFAULT_TARGET, e1rm, prefillSet, sameExercise, sessionsFor, suggestNext } from "../../utils/overload";
import { loadHint } from "../../utils/plates";
import { formatDisplayDate } from "../../utils/plannerUtils";
import { toDateStr } from "../../utils/dates";
import "./health.css";
import { PageSkeleton } from "../../components/Skeleton";

/**
 * A workout, live or finished (/admin/health/workout/:id). Live: each exercise shows
 * today's suggested weight (progressive overload from your history) and "Log set N"
 * opens a prefilled set modal; logging starts the rest timer. Finished: the summary.
 */
const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};
const fmt = (n) => Math.round(n).toLocaleString();
const setLabel = (s) => `${s.weightLb} × ${s.reps}`;
/** "+47.5 a side" next to a logged barbell set. */
const perSideText = (totalLb, ex) => {
  const side = (Number(totalLb) - (Number(ex.barLb) || 45)) / 2;
  return side > 0 ? `+${Math.round(side * 100) / 100}/side` : "";
};

export default function WorkoutSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [state, setState] = useState({ status: "loading" });
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState(null); // { until, exercise }

  const load = useCallback(async () => {
    try {
      const [session, history] = await Promise.all([api.loadSession(id), api.loadHistory()]);
      setState(session ? { status: "ready", session, history } : { status: "missing" });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  }, [id]);

  useEffect(() => {
    load();
    return onDataChange("health", load);
  }, [load]);

  const live = state.status === "ready" && !state.session.endedAt;
  useEffect(() => {
    if (!live && !rest) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live, rest]);
  useEffect(() => {
    if (rest && now >= rest.until) {
      navigator.vibrate?.([120, 80, 120]);
      setRest(null);
      addToast(`Rest's up — next set of ${rest.exercise}.`, "info");
    }
  }, [now, rest, addToast]);

  const view = useMemo(() => {
    if (state.status !== "ready") return null;
    const { session, history } = state;
    const planned = session.exercises.length ? session.exercises : [];
    const extra = [...new Set(session.sets.map((s) => s.exercise))]
      .filter((name) => !planned.some((p) => sameExercise(p.name, name)))
      .map((name) => ({ ...DEFAULT_TARGET, name, note: "" }));
    const exercises = [...planned, ...extra].map((ex) => {
      const done = session.sets.filter((s) => sameExercise(s.exercise, ex.name)).sort((a, b) => a.setNumber - b.setNumber || String(a.loggedAt).localeCompare(String(b.loggedAt)));
      const suggestion = suggestNext({ history, exercise: ex.name, target: ex, excludeSessionId: session.id });
      const last = sessionsFor(history, ex.name, { excludeSessionId: session.id })[0] || null;
      const prefill = prefillSet({ suggestion, doneThisSession: done, lastSessionSets: last?.sets || [], target: ex });
      const prs = new Set(done.filter((s) => {
        const before = history.filter((h) => sameExercise(h.exercise, ex.name) && h.id !== s.id && String(h.loggedAt) < String(s.loggedAt));
        const score = e1rm(s.weightLb, s.reps);
        return before.length > 0 && score > Math.max(...before.map((h) => e1rm(h.weightLb, h.reps)));
      }).map((s) => s.id));
      return { ex, done, suggestion, last, prefill, prs };
    });
    const volume = session.sets.reduce((a, s) => a + s.weightLb * s.reps, 0);
    const prCount = exercises.reduce((a, x) => a + x.prs.size, 0);
    return { exercises, volume, prCount, knownNames: [...new Set(history.map((h) => h.exercise))].sort() };
  }, [state]);

  if (state.status === "loading") return <PageSkeleton variant="workout" label="Loading workout" actions={2} />;
  if (state.status === "missing") {
    return (
      <div className="combined-page">
        <div className="load-error" role="alert"><p>That workout doesn't exist any more.</p><Link className="btn btn-secondary" to="/admin/health?tab=workouts">Back to workouts</Link></div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="combined-page">
        <div className="load-error" role="alert"><p>{state.error}</p><button type="button" className="btn btn-secondary" onClick={load}>Try again</button></div>
      </div>
    );
  }

  const { session } = state;
  const elapsed = ((session.endedAt ? new Date(session.endedAt).getTime() : now) - new Date(session.startedAt).getTime()) / 1000;

  const logSet = async (item, values) => {
    const set = await api.addSet(session.id, { exercise: item.ex.name, setNumber: item.prefill.setNumber, ...values });
    const before = state.history.filter((h) => sameExercise(h.exercise, item.ex.name));
    const score = e1rm(set.weightLb, set.reps);
    if (before.length && score > Math.max(...before.map((h) => e1rm(h.weightLb, h.reps)))) {
      addToast(`New best on ${item.ex.name}: ${setLabel(set)} (est. max ${score} lb).`, "success");
    }
    if (item.ex.restSec > 0) setRest({ until: Date.now() + item.ex.restSec * 1000, exercise: item.ex.name });
  };

  const discard = async () => {
    const n = session.sets.length;
    if (!(await confirm(`Discard this workout${n ? ` and its ${n} logged set${n === 1 ? "" : "s"}` : ""}? This can't be undone.`, { title: live ? "Discard workout" : "Delete workout", confirmLabel: live ? "Discard" : "Delete" }))) return;
    try {
      await api.deleteSession(session.id);
      navigate("/admin/health?tab=workouts");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  return (
    <div className="combined-page workout-page">
      <div className="workout-head">
        <Link to="/admin/health?tab=workouts" className="workout-back"><i className="fa-solid fa-chevron-left" aria-hidden="true" /> Health</Link>
        <div className="workout-title-row">
          <div>
            <h1 className="combined-page-title">{session.name}</h1>
            <p className="workout-sub">
              {live ? <><span className="live-dot" aria-hidden="true" /> Live · </> : `${formatDisplayDate(toDateStr(new Date(session.startedAt)))} · `}
              <span className="tabular">{clock(elapsed)}</span> · {session.sets.length} sets · {fmt(view.volume)} lb
              {view.prCount > 0 && ` · ${view.prCount} new best${view.prCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="workout-head-actions">
            {live ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setModal({ type: "add" })}><i className="fa-solid fa-plus" aria-hidden="true" /> Add exercise</button>
                <button type="button" className="btn btn-primary" onClick={() => setModal({ type: "finish" })}><i className="fa-solid fa-flag-checkered" aria-hidden="true" /> Finish</button>
              </>
            ) : null}
          </div>
        </div>
        {!live && session.notes && <p className="workout-notes">{session.notes}</p>}
      </div>

      {view.exercises.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><i className="fa-solid fa-dumbbell" /></div>
          <h3 className="empty-state-title">No exercises yet</h3>
          <p className="empty-state-desc">Add your first exercise to start logging sets.</p>
          {live && <button type="button" className="btn btn-primary" onClick={() => setModal({ type: "add" })}>Add exercise</button>}
        </div>
      )}

      <div className="workout-exercises">
        {view.exercises.map((item) => {
          const { ex, done, suggestion, last, prefill, prs } = item;
          const remaining = Math.max(0, ex.sets - done.length);
          return (
            <section key={ex.name} className={`db-card exercise-card${live && remaining === 0 ? " is-done" : ""}`}>
              <div className="exercise-head">
                <div>
                  <h3 className="exercise-name">{ex.name}</h3>
                  <p className="exercise-target">{ex.sets} × {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}{ex.restSec ? ` · rest ${clock(ex.restSec)}` : ""}{ex.note ? ` · ${ex.note}` : ""}</p>
                </div>
                <span className="exercise-count">{done.length}/{ex.sets}</span>
              </div>

              {live && (
                <p className={`exercise-suggest kind-${suggestion.kind}`}>
                  <strong>{suggestion.weightLb == null ? "Pick a weight" : `${suggestion.weightLb} lb × ${suggestion.reps}`}</strong>
                  {loadHint(suggestion.weightLb, ex) && <span className="load-hint">{loadHint(suggestion.weightLb, ex)}</span>}
                  <span>{suggestion.reason}</span>
                </p>
              )}
              {last && <p className="exercise-last">Last time ({formatDisplayDate(toDateStr(new Date(last.startedAt)))}): {last.sets.map(setLabel).join(", ")}</p>}

              {done.length > 0 && (
                <ol className="set-list">
                  {done.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="set-row" onClick={() => setModal({ type: "edit", item, set: s })} aria-label={`Edit set ${s.setNumber} of ${ex.name}`}>
                        <span className="set-num">{s.setNumber}</span>
                        <span className="set-main tabular">{s.weightLb} lb × {s.reps}</span>
                        {ex.barbell && <span className="set-side tabular">{perSideText(s.weightLb, ex)}</span>}
                        {s.rpe != null && <span className="set-rpe">RPE {s.rpe}</span>}
                        {prs.has(s.id) && <span className="health-tag tone-good">New best</span>}
                        <span className="set-e1rm tabular">{e1rm(s.weightLb, s.reps) || "—"}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {live && (
                <button type="button" className={`btn ${remaining > 0 ? "btn-primary" : "btn-secondary"} set-log-btn`} onClick={() => setModal({ type: "log", item })}>
                  <i className="fa-solid fa-plus" aria-hidden="true" /> {remaining > 0 ? `Log set ${prefill.setNumber}` : "Extra set"}
                  {prefill.weightLb != null && <span className="set-log-hint"> · {prefill.weightLb} lb × {prefill.reps}</span>}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="workout-foot">
        <button type="button" className="btn btn-ghost btn-danger-text" onClick={discard}>{live ? "Discard workout" : "Delete workout"}</button>
      </div>

      {rest && (
        <div className="rest-bar" role="status" aria-live="polite">
          <i className="fa-solid fa-hourglass-half" aria-hidden="true" />
          <span>Rest <strong className="tabular">{clock((rest.until - now) / 1000)}</strong> · then {rest.exercise}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRest((r) => r && { ...r, until: r.until + 30000 })}>+30s</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setRest(null)}>Skip</button>
        </div>
      )}

      {modal?.type === "log" && (
        <LogSetModal
          exercise={modal.item.ex.name}
          prefill={modal.item.prefill}
          bar={modal.item.ex}
          reason={modal.item.done.length === 0 ? modal.item.suggestion.reason : null}
          onClose={() => setModal(null)}
          onSave={(values) => logSet(modal.item, values)}
        />
      )}
      {modal?.type === "edit" && (
        <LogSetModal
          exercise={modal.item.ex.name}
          prefill={{ setNumber: modal.set.setNumber, weightLb: modal.set.weightLb, reps: modal.set.reps }}
          bar={modal.item.ex}
          editing={modal.set}
          onClose={() => setModal(null)}
          onSave={(values) => api.updateSet(modal.set.id, { exercise: modal.set.exercise, setNumber: modal.set.setNumber, ...values })}
          onDelete={async () => {
            if (!await confirm(`Delete set ${modal.set.setNumber} of ${modal.item.ex.name}?`, { title: "Delete set", confirmLabel: "Delete" })) return;
            try {
              await api.deleteSet(modal.set.id);
              setModal(null);
            } catch (err) {
              addToast(err.message, "error");
            }
          }}
        />
      )}
      {modal?.type === "add" && (
        <AddExerciseModal
          knownNames={view.knownNames}
          onClose={() => setModal(null)}
          onSave={(ex) => {
            if (view.exercises.some((x) => sameExercise(x.ex.name, ex.name))) throw new Error(`${ex.name} is already in this workout.`);
            return api.updateSessionExercises(session.id, [...session.exercises, ex]);
          }}
        />
      )}
      {modal?.type === "finish" && (
        <FinishModal
          summary={{ sets: session.sets.length, volume: view.volume, prs: view.prCount, minutes: Math.round(elapsed / 60), unfinished: view.exercises.filter((x) => x.done.length < x.ex.sets).map((x) => x.ex.name) }}
          onClose={() => setModal(null)}
          onSave={async (notes) => {
            await api.finishSession(session.id, { notes });
            setRest(null);
            addToast("Workout saved.", "success");
          }}
        />
      )}
      {dialog}
    </div>
  );
}

function FinishModal({ summary, onClose, onSave }) {
  const [notes, setNotes] = useState("");
  return (
    <FormModal title="Finish workout" submitLabel="Finish" onClose={onClose} onSubmit={() => onSave(notes)}>
      <dl className="finish-stats">
        <div><dt>Time</dt><dd>{summary.minutes} min</dd></div>
        <div><dt>Sets</dt><dd>{summary.sets}</dd></div>
        <div><dt>Volume</dt><dd>{fmt(summary.volume)} lb</dd></div>
        <div><dt>New bests</dt><dd>{summary.prs}</dd></div>
      </dl>
      {summary.sets === 0 && <p className="form-error" role="alert">No sets logged yet — finishing saves an empty workout. Discard it instead if you didn't train.</p>}
      {summary.unfinished.length > 0 && summary.sets > 0 && <p className="field-hint">Not all planned sets done: {summary.unfinished.join(", ")}.</p>}
      <Field label="Notes (optional)">
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Anything to change next time?" data-autofocus />
      </Field>
    </FormModal>
  );
}

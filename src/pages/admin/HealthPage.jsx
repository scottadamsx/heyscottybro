import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import EmptyState from "../../components/EmptyState";
import LineChart from "../../components/ui/LineChart";
import { Modal } from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { useHealthData } from "../../components/health/useHealthData";
import { FoodModal, TargetsModal, WeightModal } from "../../components/health/HealthModals";
import { BuildWithAIModal, PlanEditorModal } from "../../components/health/WorkoutModals";
import * as api from "../../api/healthApi";
import { coachTake } from "../../api/aiHealth";
import { buildInsights, dailyCalories, exerciseProgress, weekStart, weeklyVolume } from "../../utils/healthInsights";
import { toDateStr } from "../../utils/dates";
import { addDaysStr, formatDisplayDate } from "../../utils/plannerUtils";
import "./health.css";

/**
 * HEALTH — Achilles inside heyScottyBro (DR-018): food, body weight, workouts built by
 * hand or by AI, live workouts with progressive overload, and insights from the data.
 * Every form is a modal (DR-019).
 */
const TABS = [
  { key: "overview", label: "Overview", icon: "fa-heart-pulse" },
  { key: "workouts", label: "Workouts", icon: "fa-dumbbell" },
  { key: "food", label: "Food", icon: "fa-utensils" },
  { key: "body", label: "Body", icon: "fa-weight-scale" },
];

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const fmtInt = (n) => Math.round(n).toLocaleString();
const shortDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

export default function HealthPage() {
  const data = useHealthData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [modal, setModal] = useState(null);
  const [starting, setStarting] = useState(false);
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });
  const today = toDateStr();
  const close = () => setModal(null);

  const derived = useMemo(() => {
    if (data.status !== "ready") return null;
    const { history, food, weights, profile, sessions } = data;
    const progress = exerciseProgress(history);
    const thisWeek = weekStart(today);
    return {
      progress,
      knownNames: progress.map((p) => p.exercise).sort((a, b) => a.localeCompare(b)),
      insights: buildInsights({ history, foodLogs: food, weights, profile, today }),
      calories14: dailyCalories(food, today, 14),
      caloriesToday: food.filter((f) => f.date === today).reduce((a, f) => a + (Number(f.calories) || 0), 0),
      proteinToday: food.filter((f) => f.date === today).reduce((a, f) => a + (Number(f.protein_g) || 0), 0),
      latestWeight: weights.at(-1) || null,
      weekCount: sessions.filter((s) => s.endedAt && toDateStr(new Date(s.startedAt)) >= thisWeek).length,
      lastSession: sessions.find((s) => s.endedAt) || null,
      volume: weeklyVolume(history, today, 8),
      setsBySession: history.reduce((m, s) => m.set(s.sessionId, [...(m.get(s.sessionId) || []), s]), new Map()),
    };
  }, [data, today]);

  if (data.status === "loading") return <div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>;
  if (data.status === "error") {
    return (
      <div className="combined-page">
        <div className="combined-page-header"><h1 className="combined-page-title">Health</h1></div>
        <div className="load-error" role="alert">
          <p>{data.error}</p>
          <button type="button" className="btn btn-secondary" onClick={data.reload}>Try again</button>
        </div>
      </div>
    );
  }

  const { profile, plans, sessions, weights, food, openSession } = data;

  const run = async (fn, okMessage) => {
    try {
      await fn();
      if (okMessage) addToast(okMessage, "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const startWorkout = async (plan = null) => {
    if (openSession) return navigate(`/admin/health/workout/${openSession.id}`);
    setStarting(true);
    try {
      const s = await api.startSession({ plan });
      navigate(`/admin/health/workout/${s.id}`);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const savePlan = async (plan) => {
    const saved = await api.savePlan(plan);
    addToast(`Saved “${saved.name}”.`, "success");
  };

  const openFood = (initial) => setModal({ type: "food", initial });
  const openWeight = () => setModal({ type: "weight" });
  const openTargets = () => setModal({ type: "targets" });

  const headerAction = openSession ? (
    <button type="button" className="btn btn-primary" onClick={() => navigate(`/admin/health/workout/${openSession.id}`)}>
      <i className="fa-solid fa-stopwatch" aria-hidden="true" /> Resume workout
    </button>
  ) : (
    <button type="button" className="btn btn-primary" onClick={() => setTab("workouts")}>
      <i className="fa-solid fa-dumbbell" aria-hidden="true" /> Start a workout
    </button>
  );

  return (
    <div className="combined-page health-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">Health</h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="health-toolbar">{headerAction}</div>

      {openSession && (
        <button type="button" className="health-live-banner" onClick={() => navigate(`/admin/health/workout/${openSession.id}`)}>
          <span className="live-dot" aria-hidden="true" />
          <span><strong>{openSession.name}</strong> in progress · started {timeOf(openSession.startedAt)}</span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      )}

      {tab === "overview" && (
        <Overview
          d={derived} profile={profile} data={data} today={today}
          onLogFood={() => openFood()} onLogWeight={openWeight} onGoals={openTargets} setTab={setTab}
        />
      )}

      {tab === "workouts" && (
        <div className="health-stack">
          <div className="health-actions">
            <button type="button" className="btn btn-primary" onClick={() => setModal({ type: "ai" })}>
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Build with AI
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setModal({ type: "plan", initial: null })}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> New workout
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => startWorkout(null)} disabled={starting || Boolean(openSession)}>
              <i className="fa-solid fa-play" aria-hidden="true" /> Empty workout
            </button>
          </div>

          <section className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Your workouts</h3></div>
            {plans.length === 0 ? (
              <EmptyState icon="fa-dumbbell" title="No saved workouts yet" description="Build one with AI or by hand, then start it whenever you train." />
            ) : (
              <div className="plan-cards">
                {plans.map((p) => (
                  <article key={p.id} className="plan-card">
                    <div className="plan-card-head">
                      <h4>{p.name}</h4>
                      {p.source === "ai" && <span className="health-tag">AI</span>}
                    </div>
                    <p className="plan-card-list">{p.exercises.map((e) => e.name).join(" · ")}</p>
                    <p className="plan-card-meta">{p.exercises.length} exercises · {p.exercises.reduce((a, e) => a + e.sets, 0)} sets</p>
                    <div className="plan-card-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => startWorkout(p)} disabled={starting || Boolean(openSession)}>
                        <i className="fa-solid fa-play" aria-hidden="true" /> Start
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ type: "plan", initial: p })}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                        if (await confirm(`Remove “${p.name}”? Past workouts keep their sets.`, { title: "Remove workout", confirmLabel: "Remove" })) run(() => api.archivePlan(p.id), "Workout removed.");
                      }}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">History</h3><span className="db-card-count">{sessions.filter((s) => s.endedAt).length}</span></div>
            {sessions.filter((s) => s.endedAt).length === 0 ? (
              <p className="no-entries">Finished workouts show up here.</p>
            ) : (
              <div className="db-list">
                {sessions.filter((s) => s.endedAt).slice(0, 30).map((s) => {
                  const sets = derived.setsBySession.get(s.id) || [];
                  const vol = sets.reduce((a, x) => a + x.weightLb * x.reps, 0);
                  return (
                    <button type="button" key={s.id} className="db-list-item health-row" onClick={() => navigate(`/admin/health/workout/${s.id}`)}>
                      <div className="db-list-item-content">
                        <span className="db-list-item-title">{s.name}</span>
                        <span className="db-list-item-subtitle">{formatDisplayDate(toDateStr(new Date(s.startedAt)))} · {minutesBetween(s.startedAt, s.endedAt)} min · {sets.length} sets</span>
                      </div>
                      <span className="health-row-num">{fmtInt(vol)} lb</span>
                      <i className="fa-solid fa-chevron-right db-list-item-chevron" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Lifts</h3></div>
            {derived.progress.length === 0 ? (
              <p className="no-entries">Log sets to see each lift's progress.</p>
            ) : (
              <div className="db-list">
                {derived.progress.map((p) => (
                  <button type="button" key={p.exercise} className="db-list-item health-row" onClick={() => setModal({ type: "lift", lift: p })}>
                    <div className="db-list-item-content">
                      <span className="db-list-item-title">{p.exercise}</span>
                      <span className="db-list-item-subtitle">{p.sessions} session{p.sessions === 1 ? "" : "s"} · last {shortDay(p.lastDate)} · top {p.points.at(-1).topWeight} lb</span>
                    </div>
                    <span className="health-row-num">{p.best} <small>est. max</small></span>
                    <i className="fa-solid fa-chevron-right db-list-item-chevron" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "food" && (
        <FoodTab
          food={food} profile={profile} today={today} d={derived}
          onLog={(date) => setModal({ type: "food", initial: null, date })}
          onEdit={openFood} onGoals={openTargets}
          onDelete={async (f) => {
            if (await confirm(`Delete “${f.name}”?`, { title: "Delete food", confirmLabel: "Delete" })) run(() => api.deleteFood(f.id), "Deleted.");
          }}
        />
      )}

      {tab === "body" && (
        <div className="health-stack">
          <div className="health-actions">
            <button type="button" className="btn btn-primary" onClick={openWeight}><i className="fa-solid fa-plus" aria-hidden="true" /> Log weight</button>
            <button type="button" className="btn btn-secondary" onClick={openTargets}><i className="fa-solid fa-bullseye" aria-hidden="true" /> Goals</button>
          </div>
          <section className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Weight</h3>
              {profile.goalWeightLb && <span className="db-card-count">Goal {profile.goalWeightLb} lb</span>}
            </div>
            {weights.length >= 2 ? (
              <LineChart
                zeroBased={false}
                ariaLabel="Body weight"
                format={(v) => `${Math.round(v * 10) / 10} lb`}
                data={weights.map((w) => ({ key: w.date, label: shortDay(w.date), title: formatDisplayDate(w.date), value: w.weightLb }))}
              />
            ) : (
              <p className="no-entries">Log at least two weigh-ins to see your trend.</p>
            )}
          </section>
          <section className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Weigh-ins</h3><span className="db-card-count">{weights.length}</span></div>
            {weights.length === 0 ? <p className="no-entries">No weigh-ins yet.</p> : (
              <div className="db-list">
                {[...weights].reverse().map((w, i, arr) => {
                  const prev = arr[i + 1];
                  const delta = prev ? Math.round((w.weightLb - prev.weightLb) * 10) / 10 : null;
                  return (
                    <div key={w.id} className="db-list-item health-row">
                      <div className="db-list-item-content">
                        <span className="db-list-item-title">{w.weightLb} lb</span>
                        <span className="db-list-item-subtitle">{formatDisplayDate(w.date)}{w.note ? ` · ${w.note}` : ""}</span>
                      </div>
                      {delta !== null && <span className={`health-delta ${delta <= 0 ? "is-down" : "is-up"}`}>{delta > 0 ? "+" : ""}{delta} lb</span>}
                      <button type="button" className="icon-btn" aria-label={`Delete weigh-in on ${w.date}`} onClick={async () => {
                        if (await confirm(`Delete the ${w.weightLb} lb weigh-in on ${formatDisplayDate(w.date)}?`, { title: "Delete weigh-in", confirmLabel: "Delete" })) run(() => api.deleteWeight(w.id), "Deleted.");
                      }}><i className="fa-solid fa-trash" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {modal?.type === "food" && (
        <FoodModal initial={modal.initial} defaultDate={modal.date} onClose={close}
          onSave={(f) => (modal.initial ? api.updateFood(modal.initial.id, f) : api.addFood(profile.id, f))} />
      )}
      {modal?.type === "weight" && (
        <WeightModal latestLb={derived.latestWeight?.weightLb} onClose={close} onSave={(w) => api.saveWeight(profile.id, w)} />
      )}
      {modal?.type === "targets" && (
        <TargetsModal profile={profile} onClose={close} onSave={(t) => api.updateTargets(profile.id, t)} />
      )}
      {modal?.type === "plan" && (
        <PlanEditorModal initial={modal.initial} knownNames={derived.knownNames} onClose={close} onSave={savePlan} />
      )}
      {modal?.type === "ai" && (
        <BuildWithAIModal known={derived.progress} profile={profile} onClose={close}
          onDraft={(draft) => setModal({ type: "plan", initial: draft })} />
      )}
      {modal?.type === "lift" && <LiftModal lift={modal.lift} onClose={close} />}
      {dialog}
    </div>
  );
}

function Overview({ d, profile, data, today, onLogFood, onLogWeight, onGoals, setTab }) {
  const [coach, setCoach] = useState({ status: "idle" });
  const target = profile.targetCalories;
  const left = target ? target - d.caloriesToday : null;
  const weightMonthAgo = [...data.weights].reverse().find((w) => w.date <= addDaysStr(today, -28));
  const weightChange = d.latestWeight && weightMonthAgo ? Math.round((d.latestWeight.weightLb - weightMonthAgo.weightLb) * 10) / 10 : null;

  const askCoach = async () => {
    setCoach({ status: "loading" });
    try {
      const out = await coachTake({
        today,
        goal: profile.goal,
        targetCalories: profile.targetCalories,
        goalWeightLb: profile.goalWeightLb,
        insights: d.insights.map(({ title, detail }) => ({ title, detail })),
        weeklyTraining: d.volume,
        lifts: d.progress.slice(0, 10).map((p) => ({ exercise: p.exercise, sessions: p.sessions, bestEst1RM: p.best, last: p.points.at(-1) })),
        caloriesLast14Days: d.calories14,
        weighIns: data.weights.slice(-8),
      });
      setCoach({ status: "ready", ...out });
    } catch (err) {
      setCoach({ status: "error", error: err.message });
    }
  };

  return (
    <div className="health-stack">
      <div className="kpis health-kpis" aria-label="Today">
        <button type="button" className="kpi" onClick={() => setTab("food")}>
          <span className="kpi-head"><span className="kpi-label">Calories today</span></span>
          <span className="kpi-value">{fmtInt(d.caloriesToday)}</span>
          <span className="kpi-sub">{target ? (left >= 0 ? `${fmtInt(left)} left of ${fmtInt(target)}` : `${fmtInt(-left)} over ${fmtInt(target)}`) : "Set a daily target in Goals"}</span>
        </button>
        <button type="button" className="kpi" onClick={() => setTab("body")}>
          <span className="kpi-head"><span className="kpi-label">Weight</span></span>
          <span className="kpi-value">{d.latestWeight ? `${d.latestWeight.weightLb}` : "—"}<small className="kpi-unit">{d.latestWeight ? " lb" : ""}</small></span>
          <span className="kpi-sub">{weightChange === null ? (d.latestWeight ? `on ${shortDay(d.latestWeight.date)}` : "No weigh-ins yet") : `${weightChange > 0 ? "+" : ""}${weightChange} lb in 4 weeks`}</span>
        </button>
        <button type="button" className="kpi" onClick={() => setTab("workouts")}>
          <span className="kpi-head"><span className="kpi-label">Workouts this week</span></span>
          <span className="kpi-value">{d.weekCount}</span>
          <span className="kpi-sub">{d.lastSession ? `last ${shortDay(toDateStr(new Date(d.lastSession.startedAt)))} · ${d.lastSession.name}` : "None yet"}</span>
        </button>
        <button type="button" className="kpi" onClick={() => setTab("food")}>
          <span className="kpi-head"><span className="kpi-label">Protein today</span></span>
          <span className="kpi-value">{fmtInt(d.proteinToday)}<small className="kpi-unit"> g</small></span>
          <span className="kpi-sub">{d.latestWeight ? `aim ~${Math.round(d.latestWeight.weightLb * 0.8)} g` : "from logged food"}</span>
        </button>
      </div>

      <div className="health-actions">
        <button type="button" className="btn btn-secondary" onClick={onLogFood}><i className="fa-solid fa-utensils" aria-hidden="true" /> Log food</button>
        <button type="button" className="btn btn-secondary" onClick={onLogWeight}><i className="fa-solid fa-weight-scale" aria-hidden="true" /> Log weight</button>
        <button type="button" className="btn btn-secondary" onClick={onGoals}><i className="fa-solid fa-bullseye" aria-hidden="true" /> Goals</button>
      </div>

      <section className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Insights</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={askCoach} disabled={coach.status === "loading"}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {coach.status === "loading" ? "Thinking…" : coach.status === "ready" ? "Ask again" : "Coach's take"}
          </button>
        </div>
        {coach.status === "ready" && (
          <div className="coach-take">
            <p>{coach.summary}</p>
            {coach.actions.length > 0 && <ol>{coach.actions.map((a) => <li key={a}>{a}</li>)}</ol>}
          </div>
        )}
        {coach.status === "error" && <p className="form-error" role="alert">{coach.error}</p>}
        <ul className="insights">
          {d.insights.map((i) => (
            <li key={i.id} className={`insight tone-${i.tone}`}>
              <i className={`fa-solid ${i.tone === "good" ? "fa-circle-check" : i.tone === "warn" ? "fa-triangle-exclamation" : "fa-circle-info"}`} aria-hidden="true" />
              <div><strong>{i.title}</strong><p>{i.detail}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="health-grid">
        <section className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Calories · 14 days</h3>{target && <span className="db-card-count">target {fmtInt(target)}</span>}</div>
          {d.calories14.some((c) => c.logged) ? (
            <LineChart ariaLabel="Calories per day" height={160} format={(v) => `${fmtInt(v)}`}
              data={d.calories14.map((c, i) => ({ key: c.date, label: i % 3 === 1 ? shortDay(c.date) : "", title: `${formatDisplayDate(c.date)}${c.logged ? "" : " · nothing logged"}`, value: c.calories }))} />
          ) : <p className="no-entries">Nothing logged in the last two weeks.</p>}
        </section>
        <section className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Training volume · 8 weeks</h3></div>
          {d.volume.some((w) => w.volume > 0) ? (
            <LineChart ariaLabel="Weekly training volume" height={160} format={(v) => `${fmtInt(v)} lb`}
              data={d.volume.map((w, i) => ({ key: w.week, label: i % 2 === 1 ? shortDay(w.week) : "", title: `Week of ${formatDisplayDate(w.week)} · ${w.sessions} workout${w.sessions === 1 ? "" : "s"}`, value: w.volume }))} />
          ) : <p className="no-entries">Finish a workout to see your volume.</p>}
        </section>
      </div>
    </div>
  );
}

function FoodTab({ food, profile, today, d, onLog, onEdit, onDelete, onGoals }) {
  const days = [...new Set(food.map((f) => f.date))].sort().reverse();
  if (!days.includes(today)) days.unshift(today);
  const target = profile.targetCalories;
  const pct = target ? Math.min(100, Math.round((d.caloriesToday / target) * 100)) : 0;
  return (
    <div className="health-stack">
      <div className="health-actions">
        <button type="button" className="btn btn-primary" onClick={() => onLog(today)}><i className="fa-solid fa-plus" aria-hidden="true" /> Log food</button>
        <button type="button" className="btn btn-secondary" onClick={onGoals}><i className="fa-solid fa-bullseye" aria-hidden="true" /> Goals</button>
      </div>
      {target && (
        <div className="meter">
          <div className="meter-head">
            <span className="meter-name">Today</span>
            <span className="meter-nums">{fmtInt(d.caloriesToday)} / {fmtInt(target)} kcal · {fmtInt(d.proteinToday)} g protein</span>
          </div>
          <div className="meter-track"><div className="meter-fill health-meter-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {days.slice(0, 21).map((day) => {
        const items = food.filter((f) => f.date === day);
        const total = items.reduce((a, f) => a + (Number(f.calories) || 0), 0);
        return (
          <section key={day} className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">{day === today ? "Today" : formatDisplayDate(day)}</h3>
              <span className="db-card-count">{fmtInt(total)} kcal</span>
            </div>
            {items.length === 0 ? (
              <p className="no-entries">Nothing logged yet today.</p>
            ) : (
              <div className="db-list">
                {MEAL_ORDER.flatMap((meal) => items.filter((f) => (f.meal_type || "snack") === meal).map((f) => (
                  <div key={f.id} className="db-list-item health-row">
                    <button type="button" className="health-row-main" onClick={() => onEdit(f)}>
                      <span className="db-list-item-title">{f.name}</span>
                      <span className="db-list-item-subtitle">{MEAL_LABEL[meal]} · {fmtInt(f.protein_g || 0)} g protein · {fmtInt(f.carbs_g || 0)} g carbs · {fmtInt(f.fat_g || 0)} g fat{f.source === "ai" ? " · AI estimate" : ""}</span>
                    </button>
                    <span className="health-row-num">{fmtInt(f.calories)}</span>
                    <button type="button" className="icon-btn" aria-label={`Delete ${f.name}`} onClick={() => onDelete(f)}><i className="fa-solid fa-trash" /></button>
                  </div>
                )))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LiftModal({ lift, onClose }) {
  return (
    <Modal title={lift.exercise} width={640} onClose={onClose}>
      <p className="field-hint">Estimated 1-rep max per workout (Epley), from your heaviest sets.</p>
      {lift.points.length >= 2 ? (
        <LineChart zeroBased={false} ariaLabel={`${lift.exercise} progress`} height={180} format={(v) => `${Math.round(v)} lb`}
          data={lift.points.map((p) => ({ key: p.date, label: shortDay(p.date), title: `${formatDisplayDate(p.date)} · top ${p.topWeight} lb`, value: p.best }))} />
      ) : <p className="no-entries">One workout so far — progress shows after the next.</p>}
      <div className="db-list">
        {[...lift.points].reverse().map((p) => (
          <div key={p.date} className="db-list-item health-row">
            <div className="db-list-item-content">
              <span className="db-list-item-title">{formatDisplayDate(p.date)}</span>
              <span className="db-list-item-subtitle">top {p.topWeight} lb · {fmtInt(p.volume)} lb volume</span>
            </div>
            <span className="health-row-num">{p.best}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

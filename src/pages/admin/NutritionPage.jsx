import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadProfiles, loadFoodLogs, deleteFoodLog,
  loadWeightLogs, saveWeight, deleteWeight,
} from "../../api/nutritionApi";
import { generateInsights } from "../../api/aiFood";
import ProfileBar from "../../components/nutrition/ProfileBar";
import MealLogger from "../../components/nutrition/MealLogger";
import { LineChart, CalorieBars, MacroRing } from "../../components/nutrition/Charts";
import DatePicker from "../../components/DatePicker";
import { useToast } from "../../contexts/ToastContext";
import {
  todayStr, addDaysStr, prettyDate, sumMacros, suggestedTarget, tdee,
  toKg, toLb, formatWeight, weightTrendPerWeek, round, MEAL_TYPES,
} from "../../utils/nutrition";

const ACTIVE_KEY = "nutritionActiveProfile";
// v2: default switched to pounds — the bumped key ignores the old stored "kg"
// preference once, while keeping the toggle functional.
const UNIT_KEY = "nutritionUnit_v2";

export default function NutritionPage() {
  const { addToast } = useToast();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "today";

  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null);
  const [unit, setUnit] = useState(() => localStorage.getItem(UNIT_KEY) || "lb");
  const [loading, setLoading] = useState(true);
  // Load failures are their own state (never rendered as "no profiles" /
  // "nothing logged"); `reloadKey` re-runs the effects for Retry.
  const [profilesError, setProfilesError] = useState(null);
  const [dayError, setDayError] = useState(null);
  const [rangeError, setRangeError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);

  const [date, setDate] = useState(todayStr);
  const [dayLogs, setDayLogs] = useState([]);
  const [rangeLogs, setRangeLogs] = useState([]);
  const [weights, setWeights] = useState([]);
  const [showLogger, setShowLogger] = useState(false);
  const [insights, setInsights] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);

  const active = profiles.find((p) => p.id === activeId) || null;

  // initial profile load
  useEffect(() => {
    setLoading(true);
    loadProfiles().then((ps) => {
      setProfiles(ps);
      setProfilesError(null);
      setActiveId((cur) => {
        const valid = ps.some((p) => p.id === cur);
        const next = valid ? cur : (ps[0]?.id || null);
        if (next) localStorage.setItem(ACTIVE_KEY, next);
        return next;
      });
    }).catch((err) => {
      console.error("[nutrition] load profiles failed", err);
      setProfilesError(`Couldn't load nutrition profiles: ${err?.message || err}`);
      addToast(`Couldn't load nutrition profiles: ${err?.message || err}`, "error");
    }).finally(() => setLoading(false));
  }, [reloadKey, addToast]);

  const selectProfile = (id) => { setActiveId(id); localStorage.setItem(ACTIVE_KEY, id); setInsights(""); };
  const toggleUnit = () => setUnit((u) => { const n = u === "kg" ? "lb" : "kg"; localStorage.setItem(UNIT_KEY, n); return n; });

  const onProfilesChanged = (p, isNew) => {
    if (p?._deleted) {
      setProfiles((prev) => {
        const next = prev.filter((x) => x.id !== p.id);
        if (activeId === p.id) selectProfile(next[0]?.id || null);
        return next;
      });
      return;
    }
    setProfiles((prev) => (isNew ? [...prev, p] : prev.map((x) => (x.id === p.id ? p : x))));
    if (isNew) selectProfile(p.id);
  };

  // day logs
  useEffect(() => {
    if (!activeId) { setDayLogs([]); setDayError(null); return; }
    loadFoodLogs(activeId, { from: date, to: date })
      .then((rows) => { setDayLogs(rows); setDayError(null); })
      .catch((err) => {
        console.error("[nutrition] load day logs failed", err);
        setDayError(`Couldn't load meals for ${date}: ${err?.message || err}`);
        addToast(`Couldn't load meals: ${err?.message || err}`, "error");
      });
  }, [activeId, date, reloadKey, addToast]);

  // range logs + weights (for trends/weight)
  useEffect(() => {
    if (!activeId) { setRangeLogs([]); setWeights([]); setRangeError(null); return; }
    const from = addDaysStr(todayStr(), -29);
    Promise.all([loadFoodLogs(activeId, { from, to: todayStr() }), loadWeightLogs(activeId)])
      .then(([logs, ws]) => { setRangeLogs(logs); setWeights(ws); setRangeError(null); })
      .catch((err) => {
        console.error("[nutrition] load trends failed", err);
        setRangeError(`Couldn't load trends and weigh-ins: ${err?.message || err}`);
        addToast(`Couldn't load trends: ${err?.message || err}`, "error");
      });
  }, [activeId, reloadKey, addToast]);

  const setView = (v) => { const n = new URLSearchParams(params); n.set("view", v); setParams(n); };

  const latestWeightKg = weights.length ? Number(weights[weights.length - 1].weight_kg) : (active?.start_weight_kg ?? null);
  const target = active ? suggestedTarget(active, latestWeightKg) : null;
  const dayTotals = useMemo(() => sumMacros(dayLogs), [dayLogs]);

  const removeLog = async (log) => {
    try {
      await deleteFoodLog(log);
      // Only drop the row once the delete has actually succeeded.
      setDayLogs((d) => d.filter((x) => x.id !== log.id));
      setRangeLogs((d) => d.filter((x) => x.id !== log.id));
    } catch (err) {
      console.error("[nutrition] delete food log failed", err);
      addToast(`Couldn't delete "${log.name || "entry"}": ${err?.message || err}`, "error");
    }
  };

  const onLogged = (log) => {
    setShowLogger(false);
    if (log.date === date) setDayLogs((d) => [log, ...d]);
    setRangeLogs((d) => [log, ...d]);
  };

  if (loading) return <div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading…</p></div>;

  if (profilesError) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>Nutrition</h1></div>
        <div className="load-error" role="alert">
          <p className="load-error-msg">{profilesError}</p>
          <button type="button" className="btn btn-sm" onClick={retry}>Retry</button>
        </div>
      </div>
    );
  }

  const ErrorBlock = ({ msg }) => (
    <div className="load-error" role="alert">
      <p className="load-error-msg">{msg}</p>
      <button type="button" className="btn btn-sm" onClick={retry}>Retry</button>
    </div>
  );

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Nutrition</h1>
        {active && (
          <button type="button" className="btn btn-sm" onClick={() => setShowLogger(true)}><i className="fa-solid fa-plus" aria-hidden="true" /> Log meal</button>
        )}
      </div>

      <ProfileBar
        profiles={profiles}
        activeId={activeId}
        onSelect={selectProfile}
        onChanged={onProfilesChanged}
        unit={unit}
        onToggleUnit={toggleUnit}
      />

      {!active && (
        <div className="empty-state">
          <i className="fa-solid fa-apple-whole empty-state-icon" aria-hidden="true" />
          <p className="empty-state-desc">
            Create a profile (the <i className="fa-solid fa-plus" aria-hidden="true" /><span className="visually-hidden">Add profile</span> button above) for you and your partner to start tracking.
          </p>
        </div>
      )}

      {active && (
        <>
          <div className="segmented nut-tabs" role="radiogroup" aria-label="View">
            {[["today", "Today", "fa-bowl-food"], ["trends", "Trends", "fa-chart-line"], ["weight", "Weight", "fa-weight-scale"]].map(([k, l, ic]) => (
              <button key={k} type="button" role="radio" aria-checked={view === k} className={`segmented-opt nut-tab${view === k ? " active" : ""}`} onClick={() => setView(k)}>
                <i className={`fa-solid ${ic}`} aria-hidden="true" /> {l}
              </button>
            ))}
          </div>

          {view === "today" && dayError && <ErrorBlock msg={dayError} />}
          {view === "today" && !dayError && (
            <TodayView
              date={date} setDate={setDate} dayLogs={dayLogs} dayTotals={dayTotals}
              target={target} onRemove={removeLog} onLog={() => setShowLogger(true)}
            />
          )}

          {(view === "trends" || view === "weight") && rangeError && <ErrorBlock msg={rangeError} />}
          {view === "trends" && !rangeError && (
            <TrendsView
              active={active} rangeLogs={rangeLogs} weights={weights} unit={unit} target={target}
              tdeeVal={tdee(active, latestWeightKg)}
              insights={insights} insightBusy={insightBusy}
              onInsights={async () => {
                setInsightBusy(true);
                try {
                  const days = groupCaloriesByDay(rangeLogs);
                  const avg = days.length ? round(days.reduce((a, b) => a + b.value, 0) / days.length) : 0;
                  const txt = await generateInsights({
                    profileName: active.name, goal: active.goal,
                    weights: weights.map((w) => ({ date: w.date, weight_kg: w.weight_kg })),
                    avgCalories: avg, targetCalories: target,
                  });
                  setInsights(txt);
                } catch (e) { setInsights(`Couldn't generate insights: ${e.message}`); }
                finally { setInsightBusy(false); }
              }}
            />
          )}

          {view === "weight" && !rangeError && (
            <WeightView
              active={active} weights={weights} unit={unit}
              onSaved={(w) => setWeights((prev) => {
                const without = prev.filter((x) => x.date !== w.date);
                return [...without, w].sort((a, b) => a.date.localeCompare(b.date));
              })}
              onDeleted={(id) => setWeights((prev) => prev.filter((x) => x.id !== id))}
            />
          )}
        </>
      )}

      {showLogger && active && (
        <MealLogger profileId={active.id} date={date} onClose={() => setShowLogger(false)} onLogged={onLogged} />
      )}
    </div>
  );
}

/* ── Today ──────────────────────────────────────────────── */
function TodayView({ date, setDate, dayLogs, dayTotals, target, onRemove, onLog }) {
  const pct = target ? Math.min(100, Math.round((dayTotals.calories / target) * 100)) : null;
  const remaining = target ? Math.round(target - dayTotals.calories) : null;

  const isToday = date === todayStr();

  return (
    <div className="nut-today">
      <section className="db-card nut-day" aria-label="Day summary">
        <div className="db-card-header">
          <h3 className="db-card-title">{isToday ? "Today" : prettyDate(date)}</h3>
          <div className="nut-daynav">
            {!isToday && <button type="button" className="btn-mini" onClick={() => setDate(todayStr())}>Jump to today</button>}
            <button type="button" className="icon-x" onClick={() => setDate(addDaysStr(date, -1))} aria-label="Previous day"><i className="fa-solid fa-chevron-left" aria-hidden="true" /></button>
            <button type="button" className="icon-x" onClick={() => setDate(addDaysStr(date, 1))} disabled={date >= todayStr()} aria-label="Next day"><i className="fa-solid fa-chevron-right" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="nut-day-summary">
          <div className="nut-day-stats">
            <div className="nut-big-cal">{round(dayTotals.calories)}<span> kcal logged</span></div>
            {target != null ? (
              <>
                {/* width is the only inline value: today's share of the target */}
                <div className="nut-progress"><div className={`nut-progress-fill${remaining < 0 ? " is-over" : ""}`} style={{ width: `${pct}%` }} /></div>
                <div className="nut-target-line">
                  {remaining >= 0
                    ? <><strong>{remaining}</strong> kcal left of {target} target</>
                    : <><strong className="is-over">{Math.abs(remaining)}</strong> kcal over {target} target</>}
                </div>
              </>
            ) : <div className="nut-target-line muted">Set height, weight, age &amp; sex on your profile for a calorie target.</div>}
          </div>
          <MacroRing protein={dayTotals.protein_g} carbs={dayTotals.carbs_g} fat={dayTotals.fat_g} />
        </div>
      </section>

      <section className="db-card nut-meals" aria-label="Meals">
        <div className="db-card-header">
          <h3 className="db-card-title">Meals</h3>
          {/* Always-visible logger beside the list, so logging never depends
              on where the module-header action happens to render. */}
          <button type="button" className="btn-sm btn-secondary-sm nut-log-cta" onClick={onLog}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Log {dayLogs.length === 0 ? "a meal" : "another meal"}
          </button>
        </div>

        {MEAL_TYPES.map((mt) => {
          const logs = dayLogs.filter((l) => l.meal_type === mt.key);
          if (logs.length === 0) return null;
          const cal = round(sumMacros(logs).calories);
          return (
            <div className="nut-meal-group" key={mt.key}>
              <div className="nut-meal-group-head"><span><i className={`fa-solid ${mt.icon}`} aria-hidden="true" /> {mt.label}</span><span>{cal} kcal</span></div>
              {logs.map((l) => (
                <div className="nut-log-row" key={l.id}>
                  <div className="nut-log-info">
                    <span className="nut-log-name">
                      {l.name}
                      {l.quantity > 1 && <em> ×{l.quantity}</em>}
                      {l.source === "photo" && <i className="fa-solid fa-camera nut-src" title="From photo" role="img" aria-label="From photo" />}
                      {l.source === "ai" && <i className="fa-solid fa-wand-magic-sparkles nut-src" title="AI estimate" role="img" aria-label="AI estimate" />}
                      {l.source === "recipe" && <i className="fa-solid fa-book-open nut-src" title="From recipe" role="img" aria-label="From recipe" />}
                    </span>
                    <span className="nut-log-macros">P{round(l.protein_g * l.quantity)} · C{round(l.carbs_g * l.quantity)} · F{round(l.fat_g * l.quantity)}</span>
                  </div>
                  <span className="nut-log-cal">{round(l.calories * l.quantity)}</span>
                  <button type="button" className="icon-x sm" onClick={() => onRemove(l)} aria-label={`Delete ${l.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          );
        })}

        {dayLogs.length === 0 && <p className="no-entries">Nothing logged for this day.</p>}
      </section>
    </div>
  );
}

/* ── Trends ─────────────────────────────────────────────── */
function groupCaloriesByDay(logs) {
  const map = new Map();
  for (const l of logs) {
    const q = Number(l.quantity) || 1;
    map.set(l.date, (map.get(l.date) || 0) + (Number(l.calories) || 0) * q);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ date: d, value: Math.round(v) }));
}

// The last 14 CALENDAR days, unlogged days as 0 — so the average is a true
// daily average, not "average of the days you happened to log".
function last14Days(logs) {
  const byDay = new Map(groupCaloriesByDay(logs).map((d) => [d.date, d.value]));
  const end = todayStr();
  const days = [];
  for (let i = 13; i >= 0; i--) { const ds = addDaysStr(end, -i); days.push({ date: ds, value: byDay.get(ds) || 0 }); }
  return days;
}

function TrendsView({ active, rangeLogs, weights, unit, target, tdeeVal, insights, insightBusy, onInsights }) {
  const days = last14Days(rangeLogs);
  const bars = days.map((d) => ({ label: prettyDate(d.date).split(" ").slice(1).join(" "), value: d.value }));
  const loggedDays = days.filter((d) => d.value > 0).length;
  const avg = round(days.reduce((a, b) => a + b.value, 0) / days.length);

  const weightSeries = weights.map((w) => ({
    date: w.date,
    value: unit === "lb" ? toLb(Number(w.weight_kg)) : Number(w.weight_kg),
  }));
  const goalW = active.goal_weight_kg != null ? (unit === "lb" ? toLb(active.goal_weight_kg) : active.goal_weight_kg) : null;
  const trendWk = weightTrendPerWeek(weights);

  return (
    <div className="nut-trends">
      <section className="db-card nut-card">
        <div className="db-card-header nut-card-head">
          <h3 className="db-card-title">Calories · last 14 days</h3>
          <span className="nut-card-sub">avg {avg} kcal/day over 14 days ({loggedDays} logged){target ? ` · target ${target}` : ""}</span>
        </div>
        <CalorieBars data={bars} target={target} />
      </section>

      <section className="db-card nut-card">
        <div className="db-card-header nut-card-head">
          <h3 className="db-card-title">Weight</h3>
          <span className="nut-card-sub">
            {trendWk != null ? `${trendWk > 0 ? "+" : ""}${(unit === "lb" ? toLb(trendWk) : trendWk).toFixed(2)} ${unit}/wk` : "need 2+ weigh-ins"}
            {tdeeVal ? ` · TDEE ≈ ${tdeeVal}` : ""}
          </span>
        </div>
        <LineChart data={weightSeries} goal={goalW} unit={unit} color={active.color} />
      </section>

      <section className="db-card nut-card">
        <div className="db-card-header nut-card-head">
          <h3 className="db-card-title"><i className="fa-solid fa-lightbulb" aria-hidden="true" /> AI insights</h3>
          <button type="button" className="btn-sm btn-secondary-sm" onClick={onInsights} disabled={insightBusy}>
            {insightBusy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Thinking…</> : "Generate"}
          </button>
        </div>
        {insights
          ? <p className="nut-insights">{insights}</p>
          : <p className="no-entries">Get a friendly read on how your eating and weight are trending.</p>}
      </section>
    </div>
  );
}

/* ── Weight ─────────────────────────────────────────────── */
function WeightView({ active, weights, unit, onSaved, onDeleted }) {
  const { addToast } = useToast();
  const [w, setW] = useState("");
  const [d, setD] = useState(todayStr);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!w) return;
    setBusy(true); setErr(null);
    try {
      const kg = unit === "lb" ? toKg(Number(w)) : Number(w);
      const saved = await saveWeight(active.id, { date: d, weight_kg: kg, note });
      onSaved(saved);
      setW(""); setNote("");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const reversed = [...weights].reverse();
  const goalKg = active.goal_weight_kg;
  const latest = weights.length ? Number(weights[weights.length - 1].weight_kg) : null;

  return (
    <div className="nut-weight">
      <form className="db-card nut-weight-form" onSubmit={submit}>
        <div className="db-card-header">
          <h3 className="db-card-title">Log a weigh-in</h3>
        </div>
        <div className="nut-field-row">
          <label className="nut-qty">Weight ({unit})<input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} required autoFocus /></label>
          <label className="nut-qty nut-qty-date">Date<DatePicker value={d} onChange={(v) => setD(v)} max={todayStr()} /></label>
        </div>
        <input placeholder="Note (optional)" aria-label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="nut-error" role="alert">{err}</p>}
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : "Save weigh-in"}
          </button>
        </div>
      </form>

      <section className="db-card nut-weight-history" aria-label="Weigh-ins">
        <div className="db-card-header">
          <h3 className="db-card-title">Weigh-ins</h3>
          {reversed.length > 0 && <span className="db-count">{reversed.length}</span>}
        </div>
        {latest != null && goalKg != null && (
          <p className="nut-goal-note">
            {formatWeight(latest, unit)} now · goal {formatWeight(goalKg, unit)} ·{" "}
            <strong>{formatWeight(Math.abs(latest - goalKg), unit)}</strong> to go
          </p>
        )}
        <div className="nut-weight-list">
          {reversed.length === 0 && <p className="no-entries">No weigh-ins yet.</p>}
          {reversed.map((row) => (
            <div className="nut-log-row" key={row.id}>
              <div className="nut-log-info">
                <span className="nut-log-name">{formatWeight(Number(row.weight_kg), unit)}</span>
                {row.note && <span className="nut-log-macros">{row.note}</span>}
              </div>
              <span className="nut-log-date">{prettyDate(row.date)}</span>
              <button type="button" className="icon-x sm" onClick={async () => {
                try { await deleteWeight(row.id); onDeleted(row.id); }
                catch (err) { console.error("[nutrition] delete weigh-in failed", err); addToast(`Couldn't delete weigh-in: ${err?.message || err}`, "error"); }
              }} aria-label={`Delete weigh-in from ${prettyDate(row.date)}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

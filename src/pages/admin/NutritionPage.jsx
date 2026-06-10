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
import {
  todayStr, addDaysStr, prettyDate, sumMacros, suggestedTarget, tdee,
  toKg, toLb, formatWeight, weightTrendPerWeek, round, MEAL_TYPES,
} from "../../utils/nutrition";

const ACTIVE_KEY = "nutritionActiveProfile";
// v2: default switched to pounds — the bumped key ignores the old stored "kg"
// preference once, while keeping the toggle functional.
const UNIT_KEY = "nutritionUnit_v2";

export default function NutritionPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "today";

  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null);
  const [unit, setUnit] = useState(() => localStorage.getItem(UNIT_KEY) || "lb");
  const [loading, setLoading] = useState(true);

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
    loadProfiles().then((ps) => {
      setProfiles(ps);
      setActiveId((cur) => {
        const valid = ps.some((p) => p.id === cur);
        const next = valid ? cur : (ps[0]?.id || null);
        if (next) localStorage.setItem(ACTIVE_KEY, next);
        return next;
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
    if (!activeId) { setDayLogs([]); return; }
    loadFoodLogs(activeId, { from: date, to: date }).then(setDayLogs).catch(() => setDayLogs([]));
  }, [activeId, date]);

  // range logs + weights (for trends/weight)
  useEffect(() => {
    if (!activeId) { setRangeLogs([]); setWeights([]); return; }
    const from = addDaysStr(todayStr(), -29);
    loadFoodLogs(activeId, { from, to: todayStr() }).then(setRangeLogs).catch(() => setRangeLogs([]));
    loadWeightLogs(activeId).then(setWeights).catch(() => setWeights([]));
  }, [activeId]);

  const setView = (v) => { const n = new URLSearchParams(params); n.set("view", v); setParams(n); };

  const latestWeightKg = weights.length ? Number(weights[weights.length - 1].weight_kg) : (active?.start_weight_kg ?? null);
  const target = active ? suggestedTarget(active, latestWeightKg) : null;
  const dayTotals = useMemo(() => sumMacros(dayLogs), [dayLogs]);

  const removeLog = async (log) => {
    await deleteFoodLog(log);
    setDayLogs((d) => d.filter((x) => x.id !== log.id));
    setRangeLogs((d) => d.filter((x) => x.id !== log.id));
  };

  const onLogged = (log) => {
    setShowLogger(false);
    if (log.date === date) setDayLogs((d) => [log, ...d]);
    setRangeLogs((d) => [log, ...d]);
  };

  if (loading) return <div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🍎 Nutrition</h1>
        {active && (
          <button className="btn" onClick={() => setShowLogger(true)}><i className="fa-solid fa-plus" /> Log meal</button>
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
        <p className="no-entries" style={{ marginTop: "1rem" }}>
          Create a profile (the <i className="fa-solid fa-plus" /> button above) for you and your partner to start tracking.
        </p>
      )}

      {active && (
        <>
          <div className="nut-tabs">
            {[["today", "Today", "fa-bowl-food"], ["trends", "Trends", "fa-chart-line"], ["weight", "Weight", "fa-weight-scale"]].map(([k, l, ic]) => (
              <button key={k} className={`nut-tab ${view === k ? "active" : ""}`} onClick={() => setView(k)}>
                <i className={`fa-solid ${ic}`} /> {l}
              </button>
            ))}
          </div>

          {view === "today" && (
            <TodayView
              date={date} setDate={setDate} dayLogs={dayLogs} dayTotals={dayTotals}
              target={target} onRemove={removeLog} onLog={() => setShowLogger(true)}
            />
          )}

          {view === "trends" && (
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

          {view === "weight" && (
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

  return (
    <>
      <div className="nut-daynav">
        <button className="btn-tiny-blue" onClick={() => setDate(addDaysStr(date, -1))}><i className="fa-solid fa-chevron-left" /></button>
        <span className="nut-daynav-label">
          {date === todayStr() ? "Today" : prettyDate(date)}
          {date !== todayStr() && <button className="nut-today-jump" onClick={() => setDate(todayStr())}>jump to today</button>}
        </span>
        <button className="btn-tiny-blue" onClick={() => setDate(addDaysStr(date, 1))} disabled={date >= todayStr()}><i className="fa-solid fa-chevron-right" /></button>
      </div>

      <div className="nut-day-summary">
        <MacroRing protein={dayTotals.protein_g} carbs={dayTotals.carbs_g} fat={dayTotals.fat_g} />
        <div className="nut-day-stats">
          <div className="nut-big-cal">{round(dayTotals.calories)}<span> kcal</span></div>
          {target != null ? (
            <>
              <div className="nut-progress"><div className="nut-progress-fill" style={{ width: `${pct}%`, background: remaining < 0 ? "var(--danger,#ef4444)" : undefined }} /></div>
              <div className="nut-target-line">
                {remaining >= 0
                  ? <><strong>{remaining}</strong> kcal left of {target} target</>
                  : <><strong>{Math.abs(remaining)}</strong> kcal over {target} target</>}
              </div>
            </>
          ) : <div className="nut-target-line muted">Set height, weight, age &amp; sex on your profile for a calorie target.</div>}
        </div>
      </div>

      {MEAL_TYPES.map((mt) => {
        const logs = dayLogs.filter((l) => l.meal_type === mt.key);
        if (logs.length === 0) return null;
        const cal = round(sumMacros(logs).calories);
        return (
          <div className="nut-meal-group" key={mt.key}>
            <div className="nut-meal-group-head"><span><i className={`fa-solid ${mt.icon}`} /> {mt.label}</span><span>{cal} kcal</span></div>
            {logs.map((l) => (
              <div className="nut-log-row" key={l.id}>
                <div className="nut-log-info">
                  <span className="nut-log-name">
                    {l.name}
                    {l.quantity > 1 && <em> ×{l.quantity}</em>}
                    {l.source === "photo" && <i className="fa-solid fa-camera nut-src" title="From photo" />}
                    {l.source === "ai" && <i className="fa-solid fa-wand-magic-sparkles nut-src" title="AI estimate" />}
                    {l.source === "recipe" && <i className="fa-solid fa-book-open nut-src" title="From recipe" />}
                  </span>
                  <span className="nut-log-macros">P{round(l.protein_g * l.quantity)} · C{round(l.carbs_g * l.quantity)} · F{round(l.fat_g * l.quantity)}</span>
                </div>
                <span className="nut-log-cal">{round(l.calories * l.quantity)}</span>
                <button className="icon-x sm" onClick={() => onRemove(l)} aria-label="Delete"><i className="fa-solid fa-xmark" /></button>
              </div>
            ))}
          </div>
        );
      })}

      {dayLogs.length === 0 && <p className="no-entries">Nothing logged for this day. <button className="btn-tiny-blue" onClick={onLog}>Log a meal</button></p>}
    </>
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

function TrendsView({ active, rangeLogs, weights, unit, target, tdeeVal, insights, insightBusy, onInsights }) {
  const days = groupCaloriesByDay(rangeLogs).slice(-14);
  const bars = days.map((d) => ({ label: prettyDate(d.date).split(" ").slice(1).join(" "), value: d.value }));
  const avg = days.length ? round(days.reduce((a, b) => a + b.value, 0) / days.length) : 0;

  const weightSeries = weights.map((w) => ({
    date: w.date,
    value: unit === "lb" ? toLb(Number(w.weight_kg)) : Number(w.weight_kg),
  }));
  const goalW = active.goal_weight_kg != null ? (unit === "lb" ? toLb(active.goal_weight_kg) : active.goal_weight_kg) : null;
  const trendWk = weightTrendPerWeek(weights);

  return (
    <>
      <div className="nut-card">
        <div className="nut-card-head"><h3>Calories — last 14 days</h3><span className="nut-card-sub">avg {avg} kcal{target ? ` · target ${target}` : ""}</span></div>
        <CalorieBars data={bars} target={target} />
      </div>

      <div className="nut-card">
        <div className="nut-card-head">
          <h3>Weight</h3>
          <span className="nut-card-sub">
            {trendWk != null ? `${trendWk > 0 ? "+" : ""}${(unit === "lb" ? toLb(trendWk) : trendWk).toFixed(2)} ${unit}/wk` : "need 2+ weigh-ins"}
            {tdeeVal ? ` · TDEE ≈ ${tdeeVal}` : ""}
          </span>
        </div>
        <LineChart data={weightSeries} goal={goalW} unit={unit} color={active.color} />
      </div>

      <div className="nut-card">
        <div className="nut-card-head"><h3><i className="fa-solid fa-lightbulb" /> AI insights</h3>
          <button className="btn-tiny-blue" onClick={onInsights} disabled={insightBusy}>
            {insightBusy ? <><i className="fa-solid fa-spinner fa-spin" /> Thinking…</> : "Generate"}
          </button>
        </div>
        {insights
          ? <p className="nut-insights">{insights}</p>
          : <p className="no-entries">Get a friendly read on how your eating and weight are trending.</p>}
      </div>
    </>
  );
}

/* ── Weight ─────────────────────────────────────────────── */
function WeightView({ active, weights, unit, onSaved, onDeleted }) {
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
    <>
      <form className="form-card" onSubmit={submit} style={{ maxWidth: 520 }}>
        <div className="form-row">
          <label className="nut-qty">Weight ({unit})<input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} required autoFocus /></label>
          <label className="nut-qty">Date<input type="date" value={d} onChange={(e) => setD(e.target.value)} max={todayStr()} /></label>
        </div>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{err}</p>}
        <button className="btn" type="submit" disabled={busy} style={{ width: "fit-content" }}>
          {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : "Save weigh-in"}
        </button>
      </form>

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
            <span className="nut-log-cal" style={{ fontWeight: 400, opacity: 0.7 }}>{prettyDate(row.date)}</span>
            <button className="icon-x sm" onClick={async () => { await deleteWeight(row.id); onDeleted(row.id); }} aria-label="Delete"><i className="fa-solid fa-xmark" /></button>
          </div>
        ))}
      </div>
    </>
  );
}

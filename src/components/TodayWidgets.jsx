import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LineChart from "./ui/LineChart";
import { SkeletonCard, SkeletonList } from "./Skeleton";
import { loadProfile, loadWeights, loadSleep } from "../api/healthApi";
import { formatSleepDuration } from "../utils/sleep";
import { loadAccountability } from "../api/accountabilityApi";
import { onDataChange } from "../utils/dataEvents";
import { formatDisplayDate, toDateStr } from "../utils/plannerUtils";
import { formatDisplayDate as preferredDisplayDate } from "../utils/dates.js";

/**
 * Today-page widgets for body weight and habit consistency.
 * Both read the SAME stores as their full pages: weight comes from
 * healthApi (weight_logs via loadWeights, the Body tab's query) and habits
 * from accountabilityApi (accountability_state, the Habits tab's store).
 * Each refreshes when its store reports a write, like the other Today cards.
 */

const dayLabel = (ds) => preferredDisplayDate(new Date(`${ds}T12:00:00`));
const addDaysStr = (str, n) => { const d = new Date(`${str}T12:00:00`); d.setDate(d.getDate() + n); return toDateStr(d); };
const round1 = (v) => Math.round(v * 10) / 10;

// ── Weight: the Body tab's line chart, with the latest weigh-in as headline ──

export function WeightTodayCard() {
  const [state, setState] = useState({ status: "loading", weights: [], goalWeightLb: null, error: null });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    try {
      const profile = await loadProfile();
      const weights = await loadWeights(profile.id);
      if (mounted.current) setState({ status: "ready", weights, goalWeightLb: profile.goalWeightLb || null, error: null });
    } catch (err) {
      if (mounted.current) setState((s) => ({ ...s, status: "error", error: err?.message || "Couldn't load your weigh-ins." }));
    }
  }, []);
  useEffect(() => { load(); return onDataChange("health", load); }, [load]);

  const { weights, goalWeightLb } = state;
  const latest = weights.at(-1) || null;

  return (
    <>
      <div className="section-head">
        <h2 className="section-title">Weight</h2>
        <span className="section-meta">{goalWeightLb ? `Goal ${goalWeightLb} lb` : "Body weight trend"}</span>
        <Link to="/admin/health?tab=body" className="link-more">Body <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
      </div>
      {state.status === "loading" ? (
        <SkeletonCard lines={3} heading={false} />
      ) : state.status === "error" ? (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{state.error}</p>
          <button type="button" className="btn-sm" onClick={load}>Retry</button>
        </div>
      ) : !latest ? (
        <p className="no-entries">No weigh-ins yet. <Link to="/admin/health?tab=body">Log your first one</Link> and the trend shows up here.</p>
      ) : (
        <>
          <div className="today-weight-headline">
            <span className="today-weight-value">{round1(latest.weightLb)} lb</span>
            <span className="today-weight-date">{formatDisplayDate(latest.date)}</span>
          </div>
          {weights.length >= 2 ? (
            <LineChart
              zeroBased={false}
              ariaLabel="Body weight"
              format={(v) => `${round1(v)} lb`}
              data={weights.map((w) => ({ key: w.date, label: dayLabel(w.date), title: formatDisplayDate(w.date), value: w.weightLb }))}
            />
          ) : (
            <p className="no-entries">Log one more weigh-in to see your trend.</p>
          )}
        </>
      )}
    </>
  );
}

// ── Sleep: last night's duration as headline, last 14 nights as a line ──────

export function SleepTodayCard() {
  const [state, setState] = useState({ status: "loading", entries: [], error: null });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    try {
      const profile = await loadProfile();
      const entries = await loadSleep(profile.id);
      if (mounted.current) setState({ status: "ready", entries, error: null });
    } catch (err) {
      if (mounted.current) setState((s) => ({ ...s, status: "error", error: err?.message || "Couldn't load your sleep log." }));
    }
  }, []);
  useEffect(() => { load(); return onDataChange("health", load); }, [load]);

  const { entries } = state;
  const latest = entries[0] || null;
  const chart = entries.slice(0, 14).filter((e) => Number(e.durationMinutes) > 0).reverse();

  return (
    <>
      <div className="section-head">
        <h2 className="section-title">Sleep</h2>
        <span className="section-meta">Goal 8h a night</span>
        <Link to="/admin/health?tab=sleep" className="link-more">Sleep <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
      </div>
      {state.status === "loading" ? (
        <SkeletonCard lines={3} heading={false} />
      ) : state.status === "error" ? (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{state.error}</p>
          <button type="button" className="btn-sm" onClick={load}>Retry</button>
        </div>
      ) : !latest ? (
        <p className="no-entries">No sleep logged yet. <Link to="/admin/health?tab=sleep">Log last night</Link> and the trend shows up here.</p>
      ) : (
        <>
          <div className="today-weight-headline">
            <span className="today-weight-value">{formatSleepDuration(latest.durationMinutes)}</span>
            <span className="today-weight-date">{formatDisplayDate(latest.date)}</span>
          </div>
          {chart.length >= 2 ? (
            <LineChart
              zeroBased={false}
              ariaLabel="Sleep duration per night"
              format={(v) => formatSleepDuration(v)}
              data={chart.map((e) => ({ key: e.date, label: dayLabel(e.date), title: formatDisplayDate(e.date), value: e.durationMinutes }))}
            />
          ) : (
            <p className="no-entries">Log one more night to see your trend.</p>
          )}
        </>
      )}
    </>
  );
}

// ── Habits: every habit, one block per day for the last 7 days ───────────────

export function HabitWeekCard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", trackers: [], logs: [], misses: [], error: null });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(() => {
    return loadAccountability()
      .then((d) => { if (mounted.current) setState({ status: "ready", trackers: d.trackers || [], logs: d.logs || [], misses: d.misses || [], error: null }); })
      .catch((err) => { if (mounted.current) setState((s) => ({ ...s, status: "error", error: err?.message || "Couldn't load accountability." })); });
  }, []);
  useEffect(() => { load(); return onDataChange("accountability", load); }, [load]);

  const todayStr = toDateStr(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(todayStr, i - 6));
  const doneOn = new Set(state.logs.map((l) => `${l.trackerId}|${l.date}`));
  const missedOn = new Set(state.misses.map((m) => `${m.trackerId}|${m.date}`));
  const dayLetter = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });

  return (
    <>
      <div className="section-head">
        <h2 className="section-title">Habits, last 7 days</h2>
        <span className="section-meta">{dayLabel(days[0])} to {dayLabel(days[6])}</span>
        <Link to="/admin/life?tab=habits" className="link-more">All habits <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
      </div>
      {state.status === "loading" ? (
        <SkeletonList rows={4} label="Loading habits" />
      ) : state.status === "error" ? (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{state.error}</p>
          <button type="button" className="btn-sm" onClick={load}>Retry</button>
        </div>
      ) : state.trackers.length === 0 ? (
        <p className="no-entries">No habits yet. <Link to="/admin/life?tab=habits">Add one</Link> to start tracking.</p>
      ) : (
        <>
          <div className="hw-head" aria-hidden="true">
            <span className="hw-name" />
            <span className="hw-blocks">
              {days.map((ds) => <span key={ds} className="hw-day">{dayLetter(ds)}</span>)}
            </span>
          </div>
          <div className="hw-list">
            {state.trackers.map((t) => {
              const doneCount = days.filter((ds) => doneOn.has(`${t.id}|${ds}`)).length;
              const go = () => navigate(`/admin/life?tab=habits&id=${t.id}`);
              return (
                <div className="hw-row" key={t.id} role="button" tabIndex={0} onClick={go} onKeyDown={(ev) => { if (ev.key === "Enter") go(); }}>
                  <span className="hw-name">
                    <span className="hw-title">{t.name}</span>
                    <span className="hw-count">{doneCount} of 7 days</span>
                  </span>
                  <span className="hw-blocks" role="img" aria-label={`${t.name}: done ${doneCount} of the last 7 days`}>
                    {days.map((ds) => {
                      const done = doneOn.has(`${t.id}|${ds}`);
                      const missed = !done && missedOn.has(`${t.id}|${ds}`);
                      const cls = `hw-block${done ? " is-done" : ""}${missed ? " is-missed" : ""}${ds === todayStr ? " is-today" : ""}`;
                      return <span key={ds} className={cls} title={`${formatDisplayDate(ds)}: ${done ? "done" : missed ? "missed" : "not done"}`} />;
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

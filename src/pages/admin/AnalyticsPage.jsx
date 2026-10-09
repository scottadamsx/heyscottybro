import { formatDisplayDateTime as preferredDisplayDateTime } from "../../utils/dates.js";
import { formatDisplayDate as preferredDisplayDate } from "../../utils/dates.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadAnalyticsData } from "../../api/analyticsApi";
import { StatTile } from "../../components/ui";
import LineChart from "../../components/ui/LineChart";
import { PageSkeleton } from "../../components/Skeleton";
import UsagePage from "./UsagePage";
import {
  ANALYTICS_RANGES,
  activityTrend,
  buildActivityHistory,
  buildAnalyticsSummary,
  inAnalyticsRange,
  localDateKey,
} from "../../utils/analytics";
import "./analytics.css";

const money = (cents) => (Number(cents || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
const duration = (ms) => {
  const minutes = Math.round((Number(ms) || 0) / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const number = (value) => Number(value || 0).toLocaleString();
const percent = (value) => value == null ? "—" : `${Math.round(value * 100)}%`;
const labelEvent = (value) => String(value || "activity").replace(/[._]/g, " ");

function MetricGroup({ title, count, children }) {
  return (
    <section className="db-card analytics-group">
      <div className="db-card-header"><h2 className="db-card-title">{title}</h2>{count != null && <span className="analytics-count" aria-label={`${count} items`}>{count}</span>}</div>
      <div className="analytics-stats">{children}</div>
    </section>
  );
}

export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const range = ANALYTICS_RANGES.some((item) => item.key === params.get("range")) ? params.get("range") : "30d";
  const section = params.get("section") === "activity" ? "activity" : params.get("section") === "ai" ? "ai" : "overview";
  const [state, setState] = useState({ status: "loading", data: {}, errors: {}, limitations: {}, message: "" });
  const [domain, setDomain] = useState("all");
  const [action, setAction] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", message: "" }));
    try {
      const result = await loadAnalyticsData();
      setState({ status: "ready", ...result, message: "" });
    } catch (error) {
      setState({ status: "error", data: {}, errors: {}, limitations: {}, message: error?.message || "Analytics couldn't be loaded." });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => buildAnalyticsSummary(state.data, range), [state.data, range]);
  const allHistory = useMemo(() => buildActivityHistory(state.data), [state.data]);
  const rangedHistory = useMemo(() => allHistory.filter((row) => inAnalyticsRange(row.occurredAt, range)), [allHistory, range]);
  const domains = useMemo(() => [...new Set(rangedHistory.map((row) => row.domain))].sort(), [rangedHistory]);
  const actions = useMemo(() => [...new Set(rangedHistory.map((row) => row.eventType))].sort(), [rangedHistory]);
  const sources = useMemo(() => [...new Set(rangedHistory.map((row) => row.source))].sort(), [rangedHistory]);
  const filteredHistory = useMemo(() => rangedHistory.filter((row) => {
    if (domain !== "all" && row.domain !== domain) return false;
    if (action !== "all" && row.eventType !== action) return false;
    if (source !== "all" && row.source !== source) return false;
    const q = search.trim().toLowerCase();
    return !q || `${row.label} ${row.eventType} ${row.source}`.toLowerCase().includes(q);
  }), [action, domain, rangedHistory, search, source]);
  const trend = useMemo(() => activityTrend(allHistory, range), [allHistory, range]);
  const errorSources = Object.keys(state.errors || {});
  const limitedSources = Object.entries(state.limitations || {});
  const missing = (source) => Boolean(state.errors?.[source]);
  const shown = (source, value, formatter = number) => missing(source) ? "Unavailable" : formatter(value);
  const count = (source, value) => missing(source) ? null : value;

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="module-page analytics-page">
      <div className="module-header analytics-header">
        <div><h1>Analytics</h1><p>Real activity across your personal HQ.</p></div>
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={load} disabled={state.status === "loading"} aria-busy={state.status === "loading" || undefined}>
          <i className={`fa-solid ${state.status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="analytics-controls">
        <div className="segmented" role="tablist" aria-label="Analytics section">
          {[['overview', 'Overview'], ['activity', 'Activity history'], ['ai', 'AI usage']].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={section === key} className={`segmented-opt${section === key ? " active" : ""}`} onClick={() => updateParams({ section: key === "overview" ? "" : key })}>{label}</button>
          ))}
        </div>
        <div className="segmented analytics-ranges" role="group" aria-label="Date range">
          {ANALYTICS_RANGES.map((item) => <button key={item.key} type="button" className={`segmented-opt${range === item.key ? " active" : ""}`} aria-pressed={range === item.key} onClick={() => updateParams({ range: item.key === "30d" ? "" : item.key })}>{item.label}</button>)}
        </div>
      </div>

      {state.status === "loading" && <PageSkeleton variant="money" label="Loading analytics" header={false} page={false} />}
      {state.status === "error" && <div className="load-error" role="alert"><p>{state.message}</p><button type="button" className="btn btn-sm" onClick={load}>Retry</button></div>}
      {state.status === "ready" && errorSources.length > 0 && (
        <div className="analytics-notice" role="status"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Some sections are unavailable: {errorSources.join(", ")}. Available results remain shown.</div>
      )}
      {state.status === "ready" && limitedSources.length > 0 && (
        <div className="analytics-notice" role="status"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Some large sources are partial: {limitedSources.map(([key, value]) => `${key} (${value.loaded} of ${value.total})`).join(", ")}.</div>
      )}

      {state.status === "ready" && section === "overview" && (
        <>
          <div className="analytics-hero-stats">
            <StatTile label="Active days" value={number(summary.overview.activeDays)} />
            <StatTile label="Available activities" value={number(rangedHistory.length)} sub="From truthful stored records" />
            <StatTile label="Page active time" value={shown("pageUsage", summary.overview.pageActiveMs, duration)} sub="Since tracking began" />
            <StatTile label="Tasks completed" value={shown("reminders", summary.tasks.completed)} />
          </div>
          <section className="db-card analytics-trend">
            <div className="db-card-header"><h2 className="db-card-title">Activity trend</h2><span className="analytics-count">{rangedHistory.length}</span></div>
            {rangedHistory.length ? <LineChart data={trend} format={(value) => Math.round(value).toLocaleString()} ariaLabel={`Recorded activities over ${ANALYTICS_RANGES.find((item) => item.key === range)?.label}`} /> : <p className="no-entries">No activity is available in this range.</p>}
          </section>
          <div className="analytics-grid">
            <MetricGroup title="Tasks and reminders" count={count("reminders", summary.tasks.created)}><StatTile label="Created" value={shown("reminders", summary.tasks.created)} /><StatTile label="Completed" value={shown("reminders", summary.tasks.completed)} /><StatTile label="Completion" value={shown("reminders", summary.tasks.completionRate, percent)} /><StatTile label="Overdue now" value={shown("reminders", summary.tasks.overdue)} /></MetricGroup>
            <MetricGroup title="Habits" count={count("accountability", summary.habits.logs + summary.habits.misses)}><StatTile label="Logged" value={shown("accountability", summary.habits.logs)} /><StatTile label="Missed" value={shown("accountability", summary.habits.misses)} /><StatTile label="Handled completion" value={shown("accountability", summary.habits.completionRate, percent)} /></MetricGroup>
            <MetricGroup title="Journal" count={count("journal", summary.journal.entries)}><StatTile label="Entries" value={shown("journal", summary.journal.entries)} /><StatTile label="Active days" value={shown("journal", summary.journal.activeDays)} /></MetricGroup>
            <MetricGroup title="Money"><StatTile label="Income" value={shown("transactions", summary.money.incomeCents, money)} /><StatTile label="Spending" value={shown("transactions", summary.money.expensesCents, money)} /><StatTile label="Net" value={shown("transactions", summary.money.netCents, money)} tone={!missing("transactions") && summary.money.netCents < 0 ? "bad" : "good"} /><StatTile label="Top spending category" value={missing("transactions") ? "Unavailable" : summary.money.topCategory ? `${summary.money.topCategory[0]} · ${money(summary.money.topCategory[1])}` : "—"} /></MetricGroup>
            <MetricGroup title="Workouts" count={count("workouts", summary.workouts.sessions)}><StatTile label="Sessions" value={shown("workouts", summary.workouts.sessions)} /><StatTile label="Duration" value={missing("workouts") ? "Unavailable" : `${number(Math.round(summary.workouts.durationMinutes))}m`} /><StatTile label="Sets" value={shown("sets", summary.workouts.sets)} /><StatTile label="Volume" value={missing("sets") ? "Unavailable" : `${number(Math.round(summary.workouts.volumeLb))} lb`} /><StatTile label="Top exercise" value={missing("sets") ? "Unavailable" : summary.workouts.topExercise?.[0] || "—"} /></MetricGroup>
            <MetricGroup title="Meals" count={count("food", summary.meals.count)}><StatTile label="Meals" value={shown("food", summary.meals.count)} /><StatTile label="Calories" value={shown("food", summary.meals.calories)} /><StatTile label="Protein" value={missing("food") ? "Unavailable" : `${number(summary.meals.protein)} g`} /></MetricGroup>
            <MetricGroup title="Weight" count={count("weights", summary.weight.entries)}><StatTile label="Latest" value={missing("weights") ? "Unavailable" : summary.weight.latest == null ? "—" : `${(summary.weight.latest * 2.2046226218).toFixed(1)} lb`} /><StatTile label="Change" value={missing("weights") ? "Unavailable" : summary.weight.change == null ? "—" : `${summary.weight.change >= 0 ? "+" : ""}${(summary.weight.change * 2.2046226218).toFixed(1)} lb`} /></MetricGroup>
            <MetricGroup title="People" count={count("peopleEvents", summary.people.events)}><StatTile label="Interactions" value={shown("peopleEvents", summary.people.events)} /><StatTile label="People seen" value={shown("peopleEvents", summary.people.uniquePeople)} /><StatTile label="Top interaction" value={missing("peopleEvents") ? "Unavailable" : summary.people.topKind?.[0] || "—"} /><StatTile label="Planned" value={shown("peopleEvents", summary.people.planned)} /></MetricGroup>
            <MetricGroup title="Projects" count={count("projects", summary.projects.created)}><StatTile label="Created" value={shown("projects", summary.projects.created)} /><StatTile label="Current" value={shown("projects", summary.projects.current)} /><StatTile label="Work logged" value={missing("workLogs") ? "Unavailable" : `${number(summary.projects.workMinutes)}m`} /></MetricGroup>
            <MetricGroup title="AI"><StatTile label="Actions" value={shown("agentActions", summary.ai.actions)} /><StatTile label="Errors" value={shown("agentActions", summary.ai.errors)} tone={!missing("agentActions") && summary.ai.errors ? "bad" : "good"} /><StatTile label="Top agent" value={missing("agentActions") ? "Unavailable" : summary.ai.topAgent?.[0] || "—"} /><StatTile label="Top tool" value={missing("agentActions") ? "Unavailable" : summary.ai.topTool?.[0]?.replace(/_/g, " ") || "—"} /><StatTile label="Chat turns" value={shown("activityEvents", summary.ai.chatTurns)} sub="Since tracking began" /></MetricGroup>
            <MetricGroup title="Pages" count={count("pageUsage", summary.pages.visits)}><StatTile label="Visits" value={shown("pageUsage", summary.pages.visits)} sub="Since tracking began" /><StatTile label="Active time" value={shown("pageUsage", summary.pages.activeMs, duration)} sub="Since tracking began" /><StatTile label="Top page" value={missing("pageUsage") ? "Unavailable" : summary.pages.topRoute?.[0]?.replace(/_/g, " ") || "—"} sub="Since tracking began" /><StatTile label="Return visits" value={shown("pageUsage", summary.pages.returnVisits)} sub="Since tracking began" /></MetricGroup>
          </div>
        </>
      )}

      {state.status === "ready" && section === "activity" && (
        <section className="db-card analytics-history" aria-labelledby="activity-history-title">
          <div className="db-card-header"><h2 id="activity-history-title" className="db-card-title">Activity history</h2><span className="analytics-count" aria-label={`${filteredHistory.length} of ${rangedHistory.length} activities`}>{filteredHistory.length === rangedHistory.length ? filteredHistory.length : `${filteredHistory.length} of ${rangedHistory.length}`}</span></div>
          <div className="analytics-history-filters">
            <label>Domain<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All domains</option>{domains.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Action<select value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option>{actions.map((item) => <option key={item} value={item}>{labelEvent(item)}</option>)}</select></label>
            <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search safe labels" /></label>
          </div>
          {filteredHistory.length === 0 ? <p className="no-entries">No matching activity is available in this range.</p> : (
            <div className="analytics-history-list">
              {filteredHistory.map((row, index) => {
                const day = localDateKey(row.occurredAt);
                const showDay = index === 0 || day !== localDateKey(filteredHistory[index - 1].occurredAt);
                const content = <><span className="analytics-history-main"><strong>{row.label}</strong><span>{labelEvent(row.eventType)} · {row.source}</span></span><time dateTime={row.occurredAt}>{row.precision === "date_only" ? preferredDisplayDate(day) : preferredDisplayDateTime(new Date(row.occurredAt))}</time></>;
                return <div key={row.id}>{showDay && <h3 className="analytics-day">{preferredDisplayDate(new Date(`${day}T12:00:00`))}</h3>}{row.link ? <Link className="analytics-history-row" to={row.link}>{content}</Link> : <div className="analytics-history-row is-static">{content}</div>}</div>;
              })}
            </div>
          )}
        </section>
      )}

      {section === "ai" && <UsagePage embedded range={range} />}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAnthropicUsage } from "../../api/anthropicUsage";
import { loadAgentActions } from "../../api/plannerApi";
import { getAgent } from "../../agents/registry";
import { StatTile } from "../../components/ui";
import "./mission.css";
import { PageSkeleton } from "../../components/Skeleton";

const dollars = (cents) => "$" + (Number(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function tokens(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
// Series colours come from the chart tokens (globals.css), so they follow the theme.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const TIER = { /* theme-fixed: user colour (per-agent palette) */
  frodo:   { label: "Frodo",    color: "#22c55e", icon: "fa-ring" },
  sam:     { label: "Sam",      color: "#84cc16", icon: "fa-seedling" },
  gandalf: { label: "Gandalf",  color: "#a78bfa", icon: "fa-hat-wizard" },
  banker:  { label: "Griphook", color: "#f59e0b", icon: "fa-sack-dollar" },
};
// Agents not in the legacy TIER map fall back to the registry (real name,
// colour, icon) instead of showing a raw id.
function agentMeta(id) {
  if (TIER[id]) return TIER[id];
  const a = getAgent(id);
  return a ? { label: a.name, color: a.color, icon: a.icon } : { label: id, color: "var(--text-muted)", icon: "fa-robot" };
}

function digestActivity(actions) {
  const byTier = {}, byTool = {};
  let errors = 0;
  const dayMap = {};
  // last 30 day skeleton
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  actions.forEach((a) => {
    byTier[a.agent_id || "frodo"] = (byTier[a.agent_id || "frodo"] || 0) + 1;
    byTool[a.tool || "?"] = (byTool[a.tool || "?"] || 0) + 1;
    if (a.status === "error" || a.error) errors++;
    const day = (a.created_at || "").slice(0, 10);
    if (day in dayMap) dayMap[day]++;
  });
  const daily = Object.entries(dayMap).map(([date, n]) => ({ date, n }));
  return {
    total: actions.length,
    errors,
    byTier: Object.entries(byTier).sort((a, b) => b[1] - a[1]),
    byTool: Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 8),
    daily,
    maxDay: Math.max(1, ...daily.map((d) => d.n)),
    recent: actions.slice(0, 10),
  };
}

function digestCost(data) {
  if (!data || data.error) return null;
  const costBuckets = data.cost?.data || [], usageBuckets = data.usage?.data || [];
  let totalCents = 0; const byModelCents = {};
  costBuckets.forEach((b) => (b.results || []).forEach((r) => {
    const amt = Number(r.amount) || 0; totalCents += amt;
    const k = r.model || (r.cost_type ? r.cost_type.replace(/_/g, " ") : "other");
    byModelCents[k] = (byModelCents[k] || 0) + amt;
  }));
  let tokTotal = 0;
  usageBuckets.forEach((b) => (b.results || []).forEach((r) => {
    tokTotal += (r.uncached_input_tokens || 0) + (r.cache_read_input_tokens || 0) + (r.output_tokens || 0)
      + (r.cache_creation?.ephemeral_1h_input_tokens || 0) + (r.cache_creation?.ephemeral_5m_input_tokens || 0);
  }));
  return { totalCents, tokTotal, byModelCents: Object.entries(byModelCents).sort((a, b) => b[1] - a[1]) };
}

export default function UsagePage() {
  const [actions, setActions] = useState([]);
  const [cost, setCost] = useState(null);
  const [status, setStatus] = useState("loading");

  const fetchAll = useCallback(async () => {
    setStatus("loading");
    const acts = await loadAgentActions(1000).catch(() => []);
    setActions(acts);
    const usage = await loadAnthropicUsage(30).catch((e) => { console.error("[usage] Anthropic usage load failed:", e); return { error: "load_failed", message: e.message }; });
    setCost(digestCost(usage));
    setStatus("ready");
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const a = useMemo(() => digestActivity(actions), [actions]);

  return (
    <div className="module-page usage-page">
      <div className="module-header">
        <h1>Claude usage</h1>
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={fetchAll} disabled={status === "loading"} aria-busy={status === "loading" || undefined}>
          <i className={`fa-solid ${status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {status === "loading" && <PageSkeleton variant="money" label="Loading usage" header={false} page={false} />}

      {status === "ready" && (
        <>
          {/* In-app AI activity (always available) */}
          <div className="usage-stats">
            <StatTile label="AI actions" value={a.total} />
            <StatTile label="Agents used" value={a.byTier.length} />
            <StatTile label="Errors" value={a.errors} tone={a.errors ? "bad" : "good"} />
          </div>

          <section className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Activity</h3>
              <span className="usage-card-meta">Last 30 days</span>
            </div>
            <div className="usage-bars" role="img" aria-label={`Agent actions per day over the last 30 days, ${a.total} in total`}>
              {a.daily.map((day, i) => (
                <div key={i} className="usage-bar-col" title={`${day.date}: ${day.n}`}>
                  <div className={`usage-bar${day.n ? "" : " is-zero"}`} style={{ height: `${Math.max(2, (day.n / a.maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="usage-axis" aria-hidden="true">
              <span>{a.daily[0]?.date?.slice(5)}</span><span>{a.daily[a.daily.length - 1]?.date?.slice(5)}</span>
            </div>
          </section>

          <div className="usage-pair">
            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">By agent</h3>
              </div>
              <div className="usage-rows">
                {a.byTier.map(([tier, n]) => {
                  const t = agentMeta(tier);
                  const pct = a.total > 0 ? (n / a.total) * 100 : 0;
                  return (
                    <div key={tier} className="usage-row">
                      <div className="usage-row-head">
                        <span className="usage-row-name"><i className={`fa-solid ${t.icon}`} style={{ color: t.color }} aria-hidden="true" />{t.label}</span>
                        <span className="usage-num">{n} <span className="usage-num-sub">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="fin-progress usage-progress"><span style={{ width: `${pct}%`, background: t.color }} /></div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">Top tools</h3>
              </div>
              <div className="db-list">
                {a.byTool.map(([tool, n]) => (
                  <div key={tool} className="usage-tool">
                    <span className="usage-tool-name"><i className="fa-solid fa-wrench" aria-hidden="true" />{tool.replace(/_/g, " ")}</span>
                    <span className="usage-num">{n}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Real $ cost — only when an Admin API key is configured */}
          {cost ? (
            <>
              <div className="usage-stats is-pair">
                <StatTile label="API cost · 30 days" value={dollars(cost.totalCents)} />
                <StatTile label="API tokens · 30 days" value={tokens(cost.tokTotal)} />
              </div>
              <section className="db-card">
                <div className="db-card-header">
                  <h3 className="db-card-title">API cost by model</h3>
                </div>
                <div className="usage-rows">
                  {cost.byModelCents.map(([m, c], i) => {
                    const pct = cost.totalCents > 0 ? (c / cost.totalCents) * 100 : 0;
                    return (
                      <div key={m} className="usage-row">
                        <div className="usage-row-head">
                          <span className="usage-row-name">{m}</span><span className="usage-num">{dollars(c)}</span>
                        </div>
                        <div className="fin-progress usage-progress"><span style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <div className="usage-note">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <p>
                Dollar cost &amp; token totals need an Anthropic <strong>Organization + admin key</strong> (not available on individual accounts, and separate from Max).
                Until then, this shows your app&apos;s AI <strong>activity</strong> — every Frodo/Griphook action. Add <code>ANTHROPIC_ADMIN_KEY</code> later and the cost section appears here automatically.
              </p>
            </div>
          )}

          {a.total > 0 && (
            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">Recent actions</h3>
              </div>
              <div className="usage-recent">
                {a.recent.map((r) => {
                  const t = agentMeta(r.agent_id);
                  return (
                    <div key={r.id} className="usage-recent-row">
                      <span className="usage-recent-agent"><span className="usage-dot" style={{ background: t.color }} aria-hidden="true" />{t.label}</span>
                      <span className="usage-recent-tool">
                        {r.tool}{r.collection ? ` · ${r.collection}` : ""}{r.error ? <span className="usage-err"> · error</span> : ""}
                      </span>
                      <span className="usage-recent-time">{new Date(r.created_at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

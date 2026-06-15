import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAnthropicUsage } from "../../api/anthropicUsage";
import { loadAgentActions } from "../../api/plannerApi";

const dollars = (cents) => "$" + (Number(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function tokens(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
const COLORS = ["#8b5cf6", "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899", "#94a3b8"];
const TIER = {
  frodo:   { label: "Frodo",    color: "#22c55e", icon: "fa-ring" },
  sam:     { label: "Sam",      color: "#84cc16", icon: "fa-seedling" },
  gandalf: { label: "Gandalf",  color: "#a78bfa", icon: "fa-hat-wizard" },
  banker:  { label: "Griphook", color: "#f59e0b", icon: "fa-sack-dollar" },
};

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
    byTier[a.tier || "frodo"] = (byTier[a.tier || "frodo"] || 0) + 1;
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
    const usage = await loadAnthropicUsage(30).catch(() => ({ error: "x" }));
    setCost(digestCost(usage));
    setStatus("ready");
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const a = useMemo(() => digestActivity(actions), [actions]);

  const card = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.6rem", padding: "1.1rem 1.25rem", marginBottom: 14 };
  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 12px", fontWeight: 600 };
  const mono = { fontFamily: "var(--font-mono,monospace)" };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-chart-line" /> Claude usage</h1>
        <button className="btn-primary" onClick={fetchAll} disabled={status === "loading"}>
          <i className={`fa-solid ${status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} /> Refresh
        </button>
      </div>

      {status === "loading" && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>}

      {status === "ready" && (
        <>
          {/* In-app AI activity (always available) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={sh}>AI actions</div>
              <div style={{ ...mono, fontSize: 28, color: "#6366f1", lineHeight: 1 }}>{a.total}</div>
            </div>
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={sh}>Agents used</div>
              <div style={{ ...mono, fontSize: 28, color: "#22c55e", lineHeight: 1 }}>{a.byTier.length}</div>
            </div>
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={sh}>Errors</div>
              <div style={{ ...mono, fontSize: 28, color: a.errors ? "#ef4444" : "#22c55e", lineHeight: 1 }}>{a.errors}</div>
            </div>
          </div>

          <div style={card}>
            <p style={sh}>Activity · last 30 days</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
              {a.daily.map((day, i) => (
                <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }} title={`${day.date}: ${day.n}`}>
                  <div style={{ width: "100%", height: `${Math.max(2, (day.n / a.maxDay) * 100)}%`, background: "#6366f1", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
              <span>{a.daily[0]?.date?.slice(5)}</span><span>{a.daily[a.daily.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>

          <div style={card}>
            <p style={sh}>By agent</p>
            {a.byTier.map(([tier, n]) => {
              const t = TIER[tier] || { label: tier, color: "#94a3b8", icon: "fa-robot" };
              const pct = a.total > 0 ? (n / a.total) * 100 : 0;
              return (
                <div key={tier} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span><i className={`fa-solid ${t.icon}`} style={{ color: t.color, marginRight: 6 }} />{t.label}</span>
                    <span style={{ ...mono, color: "var(--text-muted)" }}>{n} <span style={{ opacity: 0.6 }}>({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: t.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={card}>
            <p style={sh}>Top tools</p>
            {a.byTool.map(([tool, n], i) => (
              <div key={tool} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={mono}><i className="fa-solid fa-wrench" style={{ color: COLORS[i % COLORS.length], fontSize: 10, marginRight: 6 }} />{tool.replace(/_/g, " ")}</span>
                <span style={{ ...mono, color: "var(--text-muted)" }}>{n}</span>
              </div>
            ))}
          </div>

          {/* Real $ cost — only when an Admin API key is configured */}
          {cost ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div style={{ ...card, marginBottom: 0 }}>
                  <div style={sh}>API cost · 30 days</div>
                  <div style={{ ...mono, fontSize: 28, color: "#8b5cf6", lineHeight: 1 }}>{dollars(cost.totalCents)}</div>
                </div>
                <div style={{ ...card, marginBottom: 0 }}>
                  <div style={sh}>API tokens · 30 days</div>
                  <div style={{ ...mono, fontSize: 28, color: "#22c55e", lineHeight: 1 }}>{tokens(cost.tokTotal)}</div>
                </div>
              </div>
              <div style={card}>
                <p style={sh}>API cost by model</p>
                {cost.byModelCents.map(([m, c], i) => {
                  const pct = cost.totalCents > 0 ? (c / cost.totalCents) * 100 : 0;
                  return (
                    <div key={m} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{m}</span><span style={{ ...mono, color: "var(--text-muted)" }}>{dollars(c)}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ ...card, borderColor: "rgba(245,158,11,0.3)" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                <i className="fa-solid fa-circle-info" style={{ color: "#f59e0b", marginRight: 6 }} />
                Dollar cost &amp; token totals need an Anthropic <strong>Organization + admin key</strong> (not available on individual accounts, and separate from Max).
                Until then, this shows your app&apos;s AI <strong>activity</strong> — every Frodo/Griphook action. Add <code>ANTHROPIC_ADMIN_KEY</code> later and the cost section appears here automatically.
              </p>
            </div>
          )}

          {a.total > 0 && (
            <div style={card}>
              <p style={sh}>Recent actions</p>
              {a.recent.map((r) => {
                const t = TIER[r.tier] || { label: r.tier, color: "#94a3b8" };
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "5px 0", borderBottom: "0.5px solid var(--border)" }}>
                    <span style={{ color: t.color, fontWeight: 600, minWidth: 56 }}>{t.label}</span>
                    <span style={{ ...mono, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.tool}{r.collection ? ` · ${r.collection}` : ""}{r.error ? <span style={{ color: "#ef4444" }}> · error</span> : ""}
                    </span>
                    <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

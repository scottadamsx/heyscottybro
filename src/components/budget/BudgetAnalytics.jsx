import { useMemo } from "react";
import { getPeriodHistory, getCategoryTrends, getLastIncome, projectNextPeriod } from "../../utils/budgetAnalytics";
import { formatMoney } from "../../utils/budgetCalc";

// ── Income vs Spending line chart ─────────────────────────
function OverviewChart({ periodHistory }) {
  const active = periodHistory.filter(p => p.income > 0 || p.spending > 0);
  if (active.length < 2) return null;
  const W = 520, H = 170;
  const P = { l: 52, r: 14, t: 22, b: 34 };
  const cw = W - P.l - P.r, ch = H - P.t - P.b;
  const n = active.length;
  const maxVal = Math.max(...active.flatMap(p => [p.income, p.spending]), 1);
  const toX = i => P.l + (n < 2 ? cw / 2 : (i / (n - 1)) * cw);
  const toY = v => P.t + ch - (v / maxVal) * ch;
  const incPts = active.map((p, i) => `${toX(i)},${toY(p.income)}`).join(" ");
  const spnPts = active.map((p, i) => `${toX(i)},${toY(p.spending)}`).join(" ");
  const spnArea = [`${toX(0)},${P.t + ch}`, ...active.map((p, i) => `${toX(i)},${toY(p.spending)}`), `${toX(n - 1)},${P.t + ch}`].join(" ");
  const yTicks = [0, 0.5, 1].map(f => maxVal * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}>
      {yTicks.map(v => (
        <line key={v} x1={P.l} y1={toY(v)} x2={W - P.r} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <polygon points={spnArea} fill="rgba(239,68,68,0.09)" />
      <polyline points={spnPts} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={incPts} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {active.map((p, i) => (
        <g key={i}>
          <line x1={toX(i)} y1={toY(p.income)} x2={toX(i)} y2={toY(p.spending)} stroke={p.net >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"} strokeWidth="2" />
          <circle cx={toX(i)} cy={toY(p.income)} r="4" fill="#22c55e" />
          <circle cx={toX(i)} cy={toY(p.spending)} r="4" fill="#ef4444" />
        </g>
      ))}
      {yTicks.map(v => (
        <text key={v} x={P.l - 5} y={toY(v) + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
          {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`}
        </text>
      ))}
      {active.map((p, i) => (
        <text key={i} x={toX(i)} y={H - 5} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9">{p.label}</text>
      ))}
      <circle cx={P.l + 8} cy={P.t - 7} r="3" fill="#22c55e" />
      <text x={P.l + 14} y={P.t - 3} fill="rgba(255,255,255,0.45)" fontSize="9">Income</text>
      <circle cx={P.l + 68} cy={P.t - 7} r="3" fill="#ef4444" />
      <text x={P.l + 74} y={P.t - 3} fill="rgba(255,255,255,0.45)" fontSize="9">Spending</text>
    </svg>
  );
}

// ── Tiny sparkline per category ───────────────────────────
function Sparkline({ values, trend }) {
  const hasData = values.some(v => v > 0);
  if (!hasData || values.length < 2) return <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>—</span>;
  const W = 64, H = 22;
  const max = Math.max(...values, 1);
  const n = values.length;
  const pts = values.map((v, i) => `${(n < 2 ? W / 2 : (i / (n - 1)) * (W - 6)) + 3},${H - (v / max) * (H - 7) - 3}`).join(" ");
  const color = trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#6b7280";
  const lx = n < 2 ? W / 2 : ((n - 1) / (n - 1)) * (W - 6) + 3;
  const ly = H - (values[n - 1] / max) * (H - 7) - 3;
  return (
    <svg width={W} height={H} style={{ verticalAlign: "middle", display: "inline-block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

function TrendBadge({ trend, pctChange }) {
  const abs = Math.abs(pctChange).toFixed(0);
  if (trend === "up") return <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>↑ {abs}%</span>;
  if (trend === "down") return <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>↓ {abs}%</span>;
  return <span style={{ color: "#6b7280", fontSize: 11 }}>→</span>;
}

// ── Auto-generated insights ───────────────────────────────
function generateInsights(periodHistory, trends, projection, lastIncome) {
  const assumed = lastIncome || projection.income;
  const insights = [];

  // Top category
  const sorted = Object.entries(projection.categories).sort((a, b) => b[1] - a[1]);
  if (sorted.length && projection.spending > 0) {
    const [cat, amt] = sorted[0];
    insights.push({ type: "info", msg: `${cat} is your biggest expense — ${formatMoney(amt)}/period (${Math.round(amt / projection.spending * 100)}% of your spending)` });
  }

  // Fastest rising category
  const rising = trends.filter(t => t.trend === "up" && t.pctChange > 15).sort((a, b) => b.pctChange - a.pctChange);
  if (rising.length) {
    insights.push({ type: "warning", msg: `${rising[0].category} is up ${Math.round(rising[0].pctChange)}% vs last period — that's your fastest-growing expense` });
  }

  // Projected net
  const net = assumed - projection.spending;
  if (net >= 0) {
    insights.push({ type: "success", msg: `At this rate you'll have ~${formatMoney(net)} left over next period` });
  } else {
    insights.push({ type: "danger", msg: `Projected shortfall of ${formatMoney(Math.abs(net))} next period — spending more than you earn` });
  }

  // Deficit streak
  const recent3 = periodHistory.slice(-3).filter(p => p.income > 0 || p.spending > 0);
  const deficits = recent3.filter(p => p.income > 0 && p.spending > p.income).length;
  if (deficits >= 2) insights.push({ type: "danger", msg: `You've overspent your income in ${deficits} of your last ${recent3.length} pay periods` });

  // Savings rate
  if (assumed > 0 && projection.spending > 0) {
    const rate = ((assumed - projection.spending) / assumed) * 100;
    if (rate >= 20) insights.push({ type: "success", msg: `Solid savings rate — you're keeping ~${Math.round(rate)}% of your income. Keep it up.` });
    else if (rate > 0 && rate < 10) insights.push({ type: "warning", msg: `Savings rate is only ~${Math.round(rate)}% — financial advisors recommend 20%+` });
  }

  return insights;
}

const INSIGHT_STYLES = {
  success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)", icon: "✓", c: "#22c55e" },
  warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.22)", icon: "!", c: "#f59e0b" },
  danger:  { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.22)",  icon: "↑", c: "#ef4444" },
  info:    { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.22)", icon: "i", c: "#6366f1" },
};

// ── Main component ────────────────────────────────────────
export default function BudgetAnalytics({ config, transactions, startingBalance = 0 }) {
  const periodHistory = useMemo(() => getPeriodHistory(transactions, config, 6), [transactions, config]);
  const trends        = useMemo(() => getCategoryTrends(periodHistory, config.categories || []), [periodHistory, config.categories]);
  const lastIncome    = useMemo(() => getLastIncome(transactions), [transactions]);
  const projection    = useMemo(() => projectNextPeriod(periodHistory, lastIncome), [periodHistory, lastIncome]);
  const insights      = useMemo(() => generateInsights(periodHistory, trends, projection, lastIncome), [periodHistory, trends, projection, lastIncome]);

  const sh = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: "20px 0 10px", fontWeight: 700 };
  const card = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border)", borderRadius: "0.5rem", padding: "1rem", marginBottom: 12 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 600 };

  if (!transactions.length) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>📊</div>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nothing to show yet</div>
        <div style={{ fontSize: 13, maxWidth: 280, margin: "0 auto" }}>Log a few transactions across two pay periods and your spending habits will appear here automatically.</div>
      </div>
    );
  }

  const assumed = lastIncome || projection.income;
  const projNet = assumed - projection.spending;
  const activePeriods = periodHistory.filter(p => p.income > 0 || p.spending > 0);

  return (
    <div>
      {/* ── Overview chart ── */}
      <p style={sh}>Income vs Spending — Last {Math.max(activePeriods.length, 1)} Pay Period{activePeriods.length !== 1 ? "s" : ""}</p>
      <div style={{ ...card, padding: "0.75rem 0.5rem 0.5rem" }}>
        {activePeriods.length >= 2
          ? <OverviewChart periodHistory={periodHistory} />
          : <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)", fontSize: 13 }}>Log transactions in at least 2 pay periods to see the chart.</div>
        }
        {activePeriods.length > 0 && (
          <div style={{ display: "flex", gap: 12, padding: "0.5rem 0.5rem 0", flexWrap: "wrap" }}>
            {activePeriods.map((p, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <span style={{ color: "var(--text-muted)" }}>{p.label}</span>
                {" · "}
                <span style={{ color: p.net >= 0 ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
                  {p.net >= 0 ? "+" : ""}{formatMoney(p.net)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Next period projection ── */}
      <p style={sh}>Next Period Projection</p>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              Assumed income
              {lastIncome > 0 && <span style={{ color: "#22c55e", marginLeft: 4 }}>← last paycheck</span>}
            </div>
            <div style={{ ...mono, fontSize: 20, color: "#22c55e" }}>{formatMoney(assumed)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Projected spend</div>
            <div style={{ ...mono, fontSize: 20, color: "#ef4444" }}>{formatMoney(projection.spending)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Projected net</div>
            <div style={{ ...mono, fontSize: 20, color: projNet >= 0 ? "#22c55e" : "#ef4444" }}>
              {projNet >= 0 ? "+" : ""}{formatMoney(projNet)}
            </div>
          </div>
        </div>

        {/* Category bars */}
        {Object.entries(projection.categories).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
          const pct = projection.spending > 0 ? (amt / projection.spending) * 100 : 0;
          const trend = trends.find(t => t.category === cat);
          return (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{cat}</span>
                  {trend && <TrendBadge trend={trend.trend} pctChange={trend.pctChange} />}
                </div>
                <span style={{ ...mono, fontSize: 12, color: "var(--text-secondary)" }}>{formatMoney(amt)}</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: trend?.trend === "up" ? "#ef4444" : "#6366f1", borderRadius: 999, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textAlign: "right" }}>{pct.toFixed(0)}% of projected spending</div>
            </div>
          );
        })}
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <>
          <p style={sh}>Insights</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
            {insights.map((ins, i) => {
              const s = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.info;
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: s.bg, border: `1px solid ${s.border}`, borderRadius: "0.375rem", padding: "0.625rem 0.875rem" }}>
                  <span style={{ color: s.c, fontSize: 14, fontWeight: 800, flexShrink: 0, marginTop: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>{ins.msg}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Category trend table ── */}
      {trends.length > 0 && (
        <>
          <p style={sh}>Spending Trends by Category</p>
          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Category", "Last 6 periods", "Last period", "Avg/period", "Trend", "Projected"].map(h => (
                    <th key={h} style={{ padding: "7px 8px", textAlign: ["Last period", "Avg/period", "Projected"].includes(h) ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trends.sort((a, b) => b.avg - a.avg).map(t => (
                  <tr key={t.category} style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <td style={{ padding: "8px 8px", fontWeight: 500 }}>{t.category}</td>
                    <td style={{ padding: "8px 8px" }}><Sparkline values={t.values} trend={t.trend} /></td>
                    <td style={{ padding: "8px 8px", textAlign: "right", ...mono }}>{formatMoney(t.last)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", ...mono, color: "var(--text-muted)" }}>{formatMoney(t.avg)}</td>
                    <td style={{ padding: "8px 8px" }}><TrendBadge trend={t.trend} pctChange={t.pctChange} /></td>
                    <td style={{ padding: "8px 8px", textAlign: "right", ...mono, color: "#6366f1" }}>{formatMoney(t.projected)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 8px", fontWeight: 600, fontSize: 11 }}>Total</td>
                  <td />
                  <td style={{ padding: "8px 8px", textAlign: "right", ...mono, fontWeight: 600 }}>{formatMoney(trends.reduce((s, t) => s + t.last, 0))}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", ...mono, fontWeight: 600, color: "var(--text-muted)" }}>{formatMoney(trends.reduce((s, t) => s + t.avg, 0))}</td>
                  <td />
                  <td style={{ padding: "8px 8px", textAlign: "right", ...mono, fontWeight: 600, color: "#6366f1" }}>{formatMoney(trends.reduce((s, t) => s + t.projected, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
            Projections based on your 3-period average. Trends compare your most recent period to the one before it.
          </div>
        </>
      )}
    </div>
  );
}

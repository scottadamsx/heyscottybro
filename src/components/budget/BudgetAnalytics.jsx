import { useMemo } from "react";
import { getPeriodHistory, getCategoryTrends, getLastIncome, projectNextPeriod } from "../../utils/budgetAnalytics";
import { formatMoney, formatMoneyAbs } from "../../utils/budgetCalc";
import "./budget.css";

// ── Income vs Spending line chart ─────────────────────────
function OverviewChart({ periodHistory }) {
  const active = periodHistory.filter(p => p.income > 0 || p.spending > 0);
  if (active.length < 2) return null;
  const W = 880, H = 220;
  const P = { l: 56, r: 16, t: 16, b: 32 };
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
    <>
      <div className="money-legend" aria-hidden="true"><span><i className="in" />Income</span><span><i className="out" />Spending</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="bud-overview-chart" role="img" aria-label={`Income vs spending over the last ${n} pay periods`}>
        {yTicks.map(v => (
          <line key={v} x1={P.l} y1={toY(v)} x2={W - P.r} y2={toY(v)} className="bud-stroke-grid" strokeWidth="1" />
        ))}
        <polygon points={spnArea} className="bud-area-out" />
        <polyline points={spnPts} fill="none" className="bud-stroke-out" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={incPts} fill="none" className="bud-stroke-in" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {active.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.income)} r="4" className="bud-dot-in" />
            <circle cx={toX(i)} cy={toY(p.spending)} r="4" className="bud-dot-out" />
          </g>
        ))}
        {yTicks.map(v => (
          <text key={v} x={P.l - 8} y={toY(v) + 4} textAnchor="end" className="bud-fill-muted bud-chart-text">
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`}
          </text>
        ))}
        {active.map((p, i) => (
          <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" className="bud-fill-muted bud-chart-text">{p.label}</text>
        ))}
      </svg>
    </>
  );
}

// ── Tiny sparkline per category ───────────────────────────
function Sparkline({ values, trend }) {
  const hasData = values.some(v => v > 0);
  if (!hasData || values.length < 2) return <span className="bud-muted-10">—</span>;
  const W = 64, H = 22;
  const max = Math.max(...values, 1);
  const n = values.length;
  const pts = values.map((v, i) => `${(n < 2 ? W / 2 : (i / (n - 1)) * (W - 6)) + 3},${H - (v / max) * (H - 7) - 3}`).join(" ");
  const tone = trend === "up" ? "up" : trend === "down" ? "down" : "flat";
  const lx = n < 2 ? W / 2 : ((n - 1) / (n - 1)) * (W - 6) + 3;
  const ly = H - (values[n - 1] / max) * (H - 7) - 3;
  return (
    <svg width={W} height={H} className={`bud-spark tone-${tone}`} aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" />
    </svg>
  );
}

function TrendBadge({ trend, pctChange }) {
  const abs = Math.abs(pctChange).toFixed(0);
  if (trend === "up") return <span className="bud-trend-up">↑ {abs}%</span>;
  if (trend === "down") return <span className="bud-trend-down">↓ {abs}%</span>;
  return <span className="bud-trend-flat">→</span>;
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

const INSIGHT_META = {
  success: { cls: "bud-insight-success", icon: <i className="fa-solid fa-check" aria-hidden="true" /> },
  warning: { cls: "bud-insight-warning", icon: "!" },
  danger:  { cls: "bud-insight-danger",  icon: "!" },
  info:    { cls: "bud-insight-info",    icon: "i" },
};

// ── Main component ────────────────────────────────────────
export default function BudgetAnalytics({ config, transactions }) {
  const periodHistory = useMemo(() => getPeriodHistory(transactions, config, 6), [transactions, config]);
  const trends        = useMemo(() => getCategoryTrends(periodHistory, config.categories || []), [periodHistory, config.categories]);
  const lastIncome    = useMemo(() => getLastIncome(transactions), [transactions]);
  const projection    = useMemo(() => projectNextPeriod(periodHistory, lastIncome), [periodHistory, lastIncome]);
  const insights      = useMemo(() => generateInsights(periodHistory, trends, projection, lastIncome), [periodHistory, trends, projection, lastIncome]);

  if (!transactions.length) {
    return (
      <div className="db-card">
        <div className="empty-state">
          <i className="fa-solid fa-chart-column empty-state-icon" aria-hidden="true" />
          <div className="empty-state-title">Nothing to show yet</div>
          <div className="empty-state-desc">Log a few transactions across two pay periods and your spending habits will appear here automatically.</div>
        </div>
      </div>
    );
  }

  const assumed = lastIncome || projection.income;
  const projNet = assumed - projection.spending;
  const activePeriods = periodHistory.filter(p => p.income > 0 || p.spending > 0);
  const projCats = Object.entries(projection.categories).sort((a, b) => b[1] - a[1]);

  return (
    <div className="money money-analytics">
      <h2 className="section-title">Trends</h2>

      {/* ── Overview chart ── */}
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Income vs spending</h3>
          <span className="bud-muted-12">last {Math.max(activePeriods.length, 1)} pay period{activePeriods.length !== 1 ? "s" : ""}</span>
        </div>
        {activePeriods.length >= 2
          ? <OverviewChart periodHistory={periodHistory} />
          : <p className="money-card-note">Log transactions in at least 2 pay periods to see the chart.</p>}
        {activePeriods.length > 0 && (
          <div className="bud-nets">
            {activePeriods.map((p, i) => (
              <span key={i} className="bud-net">
                {p.label} <b className={p.net >= 0 ? "is-pos" : "is-neg"}>{p.net >= 0 ? "+" : "−"}{formatMoneyAbs(p.net)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="money-grid">
        {/* ── Next period projection ── */}
        <div className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Next period</h3><span className="bud-muted-12">projection</span></div>
          <div className="bud-proj">
            <div>
              <div className="bud-proj-label">Assumed income{lastIncome > 0 && <span className="bud-proj-hint"> · last paycheque</span>}</div>
              <div className="bud-proj-value is-pos">{formatMoney(assumed)}</div>
            </div>
            <div>
              <div className="bud-proj-label">Projected spend</div>
              <div className="bud-proj-value">{formatMoney(projection.spending)}</div>
            </div>
            <div>
              <div className="bud-proj-label">Projected net</div>
              <div className={`bud-proj-value ${projNet >= 0 ? "is-pos" : "is-neg"}`}>{projNet >= 0 ? "+" : "−"}{formatMoneyAbs(projNet)}</div>
            </div>
          </div>
          {projCats.map(([cat, amt], i) => {
            const pct = projection.spending > 0 ? (amt / projection.spending) * 100 : 0;
            const trend = trends.find(t => t.category === cat);
            return (
              <div key={cat} className="money-cat">
                <div className="money-meter-head">
                  <span className="money-meter-name">{cat} {trend && <TrendBadge trend={trend.trend} pctChange={trend.pctChange} />}</span>
                  <span className="money-meter-nums">{formatMoney(amt)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="bud-bar-an"><div className="bud-bar-fill-an" style={{ width: `${Math.min(100, pct)}%`, background: `var(--chart-${(i % 5) + 1})` }} /></div>
              </div>
            );
          })}
        </div>

        {/* ── Insights ── */}
        {insights.length > 0 && (
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Insights</h3></div>
            <div className="bud-insights">
              {insights.map((ins, i) => {
                const m = INSIGHT_META[ins.type] || INSIGHT_META.info;
                return (
                  <div key={i} className={`bud-insight ${m.cls}`}>
                    <span className="bud-insight-icon">{m.icon}</span>
                    <span className="bud-insight-msg">{ins.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Category trend table ── */}
      {trends.length > 0 && (
        <div className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">By category over time</h3></div>
          <div className="bud-table-wrap">
            <table className="bud-table bud-table-an">
              <thead>
                <tr>
                  {["Category", "Last 6 periods", "Last period", "Avg / period", "Trend", "Projected"].map(h => (
                    <th key={h} className={["Last period", "Avg / period", "Projected"].includes(h) ? "bud-right" : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trends.sort((a, b) => b.avg - a.avg).map(t => (
                  <tr key={t.category}>
                    <td className="bud-td-strong">{t.category}</td>
                    <td><Sparkline values={t.values} trend={t.trend} /></td>
                    <td className="bud-right bud-mono">{formatMoney(t.last)}</td>
                    <td className="bud-right bud-mono bud-td-muted">{formatMoney(t.avg)}</td>
                    <td><TrendBadge trend={t.trend} pctChange={t.pctChange} /></td>
                    <td className="bud-right bud-mono">{formatMoney(t.projected)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="bud-td-strong">Total</td>
                  <td />
                  <td className="bud-right bud-mono">{formatMoney(trends.reduce((s, t) => s + t.last, 0))}</td>
                  <td className="bud-right bud-mono bud-td-muted">{formatMoney(trends.reduce((s, t) => s + t.avg, 0))}</td>
                  <td />
                  <td className="bud-right bud-mono">{formatMoney(trends.reduce((s, t) => s + t.projected, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="money-card-note bud-table-note">Projections use your 3-period average. Trends compare your latest period with the one before it.</p>
        </div>
      )}
    </div>
  );
}

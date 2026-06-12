import { useMemo, useState } from "react";
import { computePeriodTotals, getPayPeriod, getBillDatesInRange, getIncomeDatesInRange, formatMoney, formatPeriodLabel, parseDate, toDateStr } from "../../utils/budgetCalc";

function MoneyChart({ config, transactions, period }) {
  const W = 600, H = 160, padX = 48, padY = 16;
  const { start, end } = period;

  const days = [];
  let cur = parseDate(start);
  const endDt = parseDate(end);
  while (cur <= endDt) { days.push(toDateStr(cur)); cur.setDate(cur.getDate() + 1); }
  if (days.length === 0) return null;

  let cumIn = 0, cumOut = 0;
  const inData = [], outData = [];
  days.forEach(dStr => {
    let dayIn = 0;
    (config.income || []).forEach(inc => { if (getIncomeDatesInRange(inc, dStr, dStr).length > 0) dayIn += inc.amount; });
    dayIn += transactions.filter(t => t.date === dStr && t.type === "income").reduce((s, t) => s + t.amount, 0);
    cumIn += dayIn; inData.push(cumIn);
    let dayOut = 0;
    (config.recurringBills || []).forEach(bill => { if (getBillDatesInRange(bill, dStr, dStr).length > 0) dayOut += bill.amount; });
    dayOut += transactions.filter(t => t.date === dStr && (t.type === "expense" || t.type === "future")).reduce((s, t) => s + t.amount, 0);
    cumOut += dayOut; outData.push(cumOut);
  });

  const maxVal = Math.max(...inData, ...outData, 1);
  const x = i => padX + (i / Math.max(1, days.length - 1)) * (W - padX - 8);
  const y = v => padY + (1 - v / maxVal) * (H - padY * 2);

  const inPts = inData.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const outPts = outData.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const inArea = `M ${x(0)},${y(inData[0])} ${inData.map((v, i) => `L ${x(i)},${y(v)}`).join(" ")} L ${x(days.length-1)},${H-padY} L ${x(0)},${H-padY} Z`;
  const outArea = `M ${x(0)},${y(outData[0])} ${outData.map((v, i) => `L ${x(i)},${y(v)}`).join(" ")} L ${x(days.length-1)},${H-padY} L ${x(0)},${H-padY} Z`;

  const ticks = [maxVal, maxVal * 0.5, 0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} role="img" aria-label="Money in vs out">
      <defs>
        <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.25"/><stop offset="100%" stopColor="#22c55e" stopOpacity="0"/></linearGradient>
        <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.25"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0"/></linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padX} x2={W-8} y1={y(t)} y2={y(t)} stroke="var(--border,#333)" strokeWidth="0.5"/>
          <text x={4} y={y(t)+4} fontSize="9" fill="var(--text-muted,#666)" textAnchor="start">${Math.round(t).toLocaleString()}</text>
        </g>
      ))}
      <path d={inArea} fill="url(#gin)"/>
      <path d={outArea} fill="url(#gout)"/>
      <polyline points={inPts} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round"/>
      <polyline points={outPts} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round"/>
      <text x={W-8} y={12} fontSize="9" fill="#22c55e" textAnchor="end">In</text>
      <text x={W-8} y={24} fontSize="9" fill="#ef4444" textAnchor="end">Out</text>
    </svg>
  );
}

export default function BudgetDashboard({ config, transactions, startingBalance, paySchedule, periodOffset, setPeriodOffset, onPayBill }) {
  const today = toDateStr();
  const period = useMemo(() => getPayPeriod(today, periodOffset, paySchedule), [today, periodOffset, paySchedule]);
  const { incomeTotal, spent, billsTotal, planned, remaining, periodTx } = useMemo(
    () => computePeriodTotals(transactions, config, period),
    [transactions, config, period]
  );

  const unpaidBills = useMemo(() => {
    const list = [];
    (config.recurringBills || []).forEach(bill => {
      getBillDatesInRange(bill, period.start, period.end).forEach(bd => {
        const already = periodTx.some(t =>
          t.type === "expense" && t.description.toLowerCase().includes(bill.name.toLowerCase()) &&
          Math.abs(t.amount - bill.amount) < 1 && Math.abs((parseDate(t.date) - parseDate(bd)) / 86400000) <= 3
        );
        if (!already) list.push({ ...bill, date: bd });
      });
    });
    return list;
  }, [config.recurringBills, period, periodTx]);

  const catTotals = useMemo(() => {
    const m = {};
    periodTx.filter(t => t.type === "expense").forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const maxCat = catTotals.length > 0 ? catTotals[0][1] : 1;
  const totalSpent = spent || 1;

  const recent = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10), [transactions]);

  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "16px 0 8px", fontWeight: 500 };
  const card = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.5rem", padding: "0.875rem 1.125rem", marginBottom: 8 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 500 };

  const summaryCards = [
    { label: "Income", value: incomeTotal, color: "#22c55e" },
    { label: "Spent", value: spent, color: "#ef4444" },
    { label: "Bills", value: billsTotal, color: "#f59e0b" },
    { label: "Planned", value: planned, color: "#6366f1" },
    { label: "Remaining", value: remaining, color: remaining < 0 ? "#ef4444" : remaining < 100 ? "#f59e0b" : "#22c55e" },
  ];

  return (
    <div>
      {/* Period navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => setPeriodOffset(o => o - 1)} style={{ background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {formatPeriodLabel(period.start, period.end)}
          {periodOffset === 0 ? " (Current)" : periodOffset === 1 ? " (Next)" : periodOffset === -1 ? " (Previous)" : ""}
        </span>
        <button onClick={() => setPeriodOffset(o => o + 1)} style={{ background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>›</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {summaryCards.slice(0, 4).map(c => (
          <div key={c.label} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{c.label}</div>
            <div style={{ ...mono, fontSize: 20, color: c.color, lineHeight: 1 }}>{formatMoney(c.value)}</div>
          </div>
        ))}
      </div>
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Remaining this period</div>
        <div style={{ ...mono, fontSize: 24, color: summaryCards[4].color }}>{formatMoney(remaining)}</div>
      </div>

      {/* Chart */}
      <p style={sh}>Money flow</p>
      <div style={{ ...card, padding: "0.75rem" }}>
        <MoneyChart config={config} transactions={transactions} period={period} />
      </div>

      {/* Unpaid bills */}
      {unpaidBills.length > 0 && <>
        <p style={sh}>Unpaid bills this period</p>
        {unpaidBills.map((b, i) => (
          <div key={i} style={{ ...card, display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Due {b.date}</div>
            </div>
            <span style={{ ...mono, fontSize: 14, marginRight: 12 }}>{formatMoney(b.amount)}</span>
            {b.autoPay
              ? <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", borderRadius: 4, padding: "2px 6px" }}>Auto</span>
              : <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onPayBill(b)}>Pay now</button>}
          </div>
        ))}
      </>}

      {/* Category breakdown */}
      {catTotals.length > 0 && <>
        <p style={sh}>By category</p>
        <div style={card}>
          {catTotals.map(([cat, amt]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                <span>{cat}</span>
                <span style={{ color: "var(--text-muted)" }}>{formatMoney(amt)} ({Math.round(amt/totalSpent*100)}%)</span>
              </div>
              <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(amt/maxCat*100).toFixed(1)}%`, background: "var(--accent,#6366f1)", borderRadius: 4 }}/>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* Recent transactions */}
      <p style={sh}>Recent</p>
      {recent.length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No transactions yet.</p>
        : recent.map(t => (
          <div key={t.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{t.category} · {t.date}</div>
            </div>
            <span style={{ ...mono, fontSize: 13, color: t.type === "income" ? "#22c55e" : t.type === "future" ? "#6366f1" : "#ef4444", flexShrink: 0 }}>
              {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
            </span>
          </div>
        ))
      }
    </div>
  );
}

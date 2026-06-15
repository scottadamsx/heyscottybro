import { useMemo, useState } from "react";
import { computePeriodTotals, computeWeeklyAllowance, getPeriodBills, monthlyCategorySpend, getPayPeriod, getBillDatesInRange, getIncomeDatesInRange, formatMoney, formatPeriodLabel, parseDate, toDateStr } from "../../utils/budgetCalc";

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

export default function BudgetDashboard({ config, transactions, startingBalance, paySchedule, periodOffset, setPeriodOffset, onPayBill, onUnpayBill, onSetCategoryBudget }) {
  const today = toDateStr();
  const period = useMemo(() => getPayPeriod(today, periodOffset, paySchedule), [today, periodOffset, paySchedule]);
  const { incomeTotal, spent, billsTotal, planned, remaining, periodTx } = useMemo(
    () => computePeriodTotals(transactions, config, period),
    [transactions, config, period]
  );

  // Bills display uses the calendar month so that monthly bills (rent, phone)
  // always appear regardless of where the biweekly period boundaries fall.
  const monthPeriod = useMemo(() => {
    const ref = period.end; // use the end date so a period like May 31–Jun 13 shows June
    const y = ref.slice(0, 4), m = ref.slice(5, 7);
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, "0")}` };
  }, [period]);
  const { bills, paidCount } = useMemo(() => getPeriodBills(transactions, config, monthPeriod), [transactions, config, monthPeriod]);
  const weekly = useMemo(() => computeWeeklyAllowance(transactions, config, period), [transactions, config, period]);
  const currentWeek = weekly.weeks.find(w => w.isCurrent) || null;

  const catTotals = useMemo(() => {
    const m = {};
    periodTx.filter(t => t.type === "expense").forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const maxCat = catTotals.length > 0 ? catTotals[0][1] : 1;
  const totalSpent = spent || 1;

  // ── Monthly category budgets (variable envelopes: Groceries, Gas, …) ──
  const monthKey = period.start.slice(0, 7);
  const monthLabel = parseDate(period.start).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthSpend = useMemo(() => monthlyCategorySpend(transactions, monthKey), [transactions, monthKey]);
  const categoryBudgets = config.categoryBudgets || {};
  const budgetedCats = useMemo(
    () => Object.keys(categoryBudgets).filter(c => categoryBudgets[c] > 0).sort((a, b) => a.localeCompare(b)),
    [categoryBudgets]
  );
  const unbudgetedCats = (config.categories || []).filter(c => !budgetedCats.includes(c));
  const [editCat, setEditCat] = useState(null);   // category whose amount is being edited
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addVal, setAddVal] = useState("");

  const startEdit = (cat) => { setEditCat(cat); setEditVal(String(categoryBudgets[cat] || "")); };
  const commitEdit = (cat) => { onSetCategoryBudget?.(cat, parseFloat(editVal)); setEditCat(null); setEditVal(""); };
  const commitAdd = () => {
    const amt = parseFloat(addVal);
    if (addCat && amt > 0) onSetCategoryBudget?.(addCat, amt);
    setAdding(false); setAddCat(""); setAddVal("");
  };

  // Scope Recent to the selected period so the list always agrees with the
  // period's Spent total (otherwise an all-time list looks inconsistent with a
  // this-period number).
  const recent = useMemo(() => [...periodTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10), [periodTx]);

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

      {/* Spendable this week (current week of the pay period) */}
      {currentWeek && (
        <div style={{ ...card, marginBottom: 12, background: "rgba(99,102,241,0.06)", borderColor: "var(--accent,#6366f1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Left to spend this week</div>
            <div style={{ ...mono, fontSize: 24, color: currentWeek.remaining < 0 ? "#ef4444" : currentWeek.remaining < currentWeek.allowance * 0.25 ? "#f59e0b" : "#22c55e" }}>
              {formatMoney(currentWeek.remaining)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {formatMoney(currentWeek.spent)} spent of {formatMoney(currentWeek.allowance)}
            {currentWeek.carryIn ? ` · ${currentWeek.carryIn >= 0 ? "+" : ""}${formatMoney(currentWeek.carryIn)} rolled over` : ""}
          </div>
        </div>
      )}

      {/* Chart */}
      <p style={sh}>Money flow</p>
      <div style={{ ...card, padding: "0.75rem" }}>
        <MoneyChart config={config} transactions={transactions} period={period} />
      </div>

      {/* Weekly allowance breakdown */}
      <p style={sh}>Weekly allowance</p>
      <div style={card}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          {formatMoney(weekly.weeklyBase)} / week · {formatMoney(weekly.spendable)} spendable this period
          <span style={{ display: "block", marginTop: 2 }}>({formatMoney(weekly.incomeForPlanning)} scheduled − {formatMoney(weekly.billsObligation)} bills − {formatMoney(planned)} planned)</span>
        </div>
        {weekly.weeks.map(w => {
          const over = w.remaining < 0;
          const pct = w.allowance > 0 ? Math.min(Math.max(w.spent / w.allowance * 100, 0), 100) : (w.spent > 0 ? 100 : 0);
          const dr = `${parseDate(w.start).getDate()}–${parseDate(w.end).getDate()}`;
          return (
            <div key={w.index} style={{ marginBottom: 12, opacity: w.isPast ? 0.5 : 1, ...(w.isCurrent ? { borderLeft: "2px solid var(--accent,#6366f1)", paddingLeft: 10, marginLeft: -2 } : {}) }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: w.isCurrent ? 600 : 400 }}>
                  Week {w.index}{w.isCurrent ? " · now" : ""} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{dr}</span>
                </span>
                <span style={{ ...mono, color: over ? "#ef4444" : "#22c55e" }}>{formatMoney(w.remaining)} left</span>
              </div>
              <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: over ? "#ef4444" : pct > 75 ? "#f59e0b" : "#22c55e", borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {formatMoney(w.spent)} spent of {formatMoney(w.allowance)}
                {w.carryIn ? ` · ${w.carryIn >= 0 ? "+" : ""}${formatMoney(w.carryIn)} rolled over` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bills — monthly view so bills always appear regardless of pay period window */}
      {bills.length > 0 && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={sh}>Bills · {monthLabel}</p>
          <span style={{ fontSize: 12, color: paidCount === bills.length ? "#22c55e" : "var(--text-muted)" }}>{paidCount} of {bills.length} paid</span>
        </div>
        <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${bills.length ? paidCount / bills.length * 100 : 0}%`, background: "#22c55e", borderRadius: 4 }} />
        </div>
        {bills.map((b, i) => (
          <div key={b.matchedTxId || `${b.billId}-${b.date}-${i}`} style={{ ...card, display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, opacity: b.paid ? 0.6 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{b.recurring ? `Due ${b.date}` : `Paid ${b.date}`}{b.category ? ` · ${b.category}` : ""}</div>
            </div>
            <span style={{ ...mono, fontSize: 14, marginRight: 12, textDecoration: b.paid ? "line-through" : "none", color: b.paid ? "var(--text-muted)" : undefined }}>{formatMoney(b.amount)}</span>
            {b.paid
              ? <button className="btn" style={{ fontSize: 11, padding: "3px 8px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "none" }} onClick={() => onUnpayBill?.(b.matchedTxId)} title="Undo">✓ Paid</button>
              : b.autoPay
                ? <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", borderRadius: 4, padding: "2px 6px" }}>Auto</span>
                : <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onPayBill(b)}>Pay now</button>}
          </div>
        ))}
      </>}

      {/* Monthly category budgets (variable spending envelopes) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={sh}>Monthly budgets</p>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{monthLabel}</span>
      </div>
      <div style={card}>
        {budgetedCats.length === 0 && !adding && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 10px" }}>
            Set a monthly budget on variable categories (Groceries, Gas, Toiletries…) to track them with a progress bar.
          </p>
        )}
        {budgetedCats.map(cat => {
          const budget = categoryBudgets[cat];
          const spentCat = monthSpend[cat] || 0;
          const pct = budget > 0 ? Math.min(spentCat / budget * 100, 100) : 0;
          const over = spentCat > budget;
          const barColor = over ? "#ef4444" : pct > 80 ? "#f59e0b" : "#22c55e";
          const isEditing = editCat === cat;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{cat}</span>
                {isEditing ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>$</span>
                    <input type="number" autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(cat); if (e.key === "Escape") setEditCat(null); }}
                      style={{ width: 80, fontSize: 13, padding: "2px 6px" }} />
                    <button className="btn-sm btn-complete" style={{ fontSize: 11, padding: "3px 7px" }} onClick={() => commitEdit(cat)}>Save</button>
                    <button className="btn-sm btn-delete" style={{ fontSize: 11, padding: "3px 7px" }} onClick={() => { onSetCategoryBudget?.(cat, 0); setEditCat(null); setEditVal(""); }} title="Remove budget">Remove</button>
                  </span>
                ) : (
                  <button onClick={() => startEdit(cat)} title="Edit budget"
                    style={{ background: "none", border: "none", cursor: "pointer", color: over ? "#ef4444" : "var(--text-muted)", fontSize: 12, ...mono }}>
                    {formatMoney(spentCat)} / {formatMoney(budget)} ({Math.round(budget > 0 ? spentCat / budget * 100 : 0)}%) <i className="fa-solid fa-pen" style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }} />
                  </button>
                )}
              </div>
              <div style={{ height: 6, background: "var(--bg-raised,#222)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4 }} />
              </div>
              {over && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{formatMoney(spentCat - budget)} over budget</div>}
            </div>
          );
        })}

        {adding ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
            <select value={addCat} onChange={e => setAddCat(e.target.value)} style={{ fontSize: 13, flex: 1, minWidth: 120 }}>
              <option value="">Category…</option>
              {unbudgetedCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="$ / month" value={addVal} onChange={e => setAddVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
              style={{ width: 100, fontSize: 13, padding: "3px 6px" }} />
            <button className="btn-sm btn-complete" style={{ fontSize: 12, padding: "4px 9px" }} onClick={commitAdd}>Add</button>
            <button className="btn-sm" style={{ fontSize: 12, padding: "4px 9px" }} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          unbudgetedCats.length > 0 && (
            <button className="btn" style={{ fontSize: 12, padding: "4px 10px", marginTop: 2 }} onClick={() => setAdding(true)}>
              <i className="fa-solid fa-plus" style={{ fontSize: 10, marginRight: 4 }} /> Add category budget
            </button>
          )
        )}
      </div>

      {/* Category breakdown */}
      {catTotals.length > 0 && <>
        <p style={sh}>By category · this period</p>
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
      <p style={sh}>Recent this period</p>
      {recent.length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No transactions this period.</p>
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

import { useMemo, useState } from "react";
import { getPeriodBills, getQuantifiableBudgets, savingsPlan, getBillDatesInRange, getIncomeDatesInRange, formatMoney, formatPeriodLabel, parseDate, toDateStr, genId } from "../../utils/budgetCalc";
import { computeBudgetSnapshot } from "./budgetSummary";
import "./budget.css";

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
        <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--green)", stopOpacity: 0.25 }}/><stop offset="100%" style={{ stopColor: "var(--green)", stopOpacity: 0 }}/></linearGradient>
        <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--red)", stopOpacity: 0.25 }}/><stop offset="100%" style={{ stopColor: "var(--red)", stopOpacity: 0 }}/></linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padX} x2={W-8} y1={y(t)} y2={y(t)} className="bud-stroke-grid" strokeWidth="0.5"/>
          <text x={4} y={y(t)+4} fontSize="9" className="bud-fill-muted" textAnchor="start">${Math.round(t).toLocaleString()}</text>
        </g>
      ))}
      <path d={inArea} fill="url(#gin)"/>
      <path d={outArea} fill="url(#gout)"/>
      <polyline points={inPts} fill="none" className="bud-stroke-green" strokeWidth="2" strokeLinejoin="round"/>
      <polyline points={outPts} fill="none" className="bud-stroke-red" strokeWidth="2" strokeLinejoin="round"/>
      <text x={W-8} y={12} fontSize="9" className="bud-fill-green" textAnchor="end">In</text>
      <text x={W-8} y={24} fontSize="9" className="bud-fill-red" textAnchor="end">Out</text>
    </svg>
  );
}

export default function BudgetDashboard({ config, transactions, startingBalance, paySchedule, periodOffset, setPeriodOffset, onPayBill, onUnpayBill, onSetCategoryBudget, onSaveGoals }) {
  const today = toDateStr();

  // Pay-period dashboard: the period runs payday → day before next payday,
  // derived from the income sources in Bills & Income. periodOffset moves whole
  // pay periods. Everything below is scoped to this period so the analytics
  // reflect "this paycheque": the bills due in it + every categorized expense.
  // ONE shared snapshot — the home Dashboard widget derives its budget numbers
  // from this exact same function, so the two screens can never disagree.
  const snap = useMemo(() => computeBudgetSnapshot(config, transactions, today, periodOffset), [config, transactions, today, periodOffset]);
  const { period, incomeTotal, spent, billsTotal, remaining, periodTx, weekly, currentWeek, savingsThisPeriod, afterSavings, billsPaid, billsObligation, saved, spentNonBill } = snap;

  // Savings goals — how much to set aside this paycheque for each goal (the
  // detailed per-goal rows; the period total comes from the snapshot above).
  const goals = useMemo(() => savingsPlan(config, today), [config, today]);

  const { bills } = useMemo(() => getPeriodBills(transactions, config, period), [transactions, config, period]);
  const fixedBills = useMemo(() => bills.filter(b => !b.variable), [bills]);
  const variableBills = useMemo(() => bills.filter(b => b.variable), [bills]);
  const paidCount = fixedBills.filter(b => b.paid).length;

  // billsPaid / billsObligation / saved / spentNonBill now come from the shared
  // snapshot (computeBudgetSnapshot) so the home Dashboard widget shows the same
  // breakdown — see destructure above. weekly/currentWeek also come from snap.
  const catTotals = useMemo(() => {
    const m = {};
    periodTx.filter(t => t.type === "expense").forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const maxCat = catTotals.length > 0 ? catTotals[0][1] : 1;
  const totalSpent = spent || 1;

  // ── Quantifiable category budgets (Groceries, Gas… set via "Add budget") ──
  const periodLabel = formatPeriodLabel(period.start, period.end);
  const quantBudgets = useMemo(() => getQuantifiableBudgets(transactions, config, period), [transactions, config, period]);
  const budgetedCats = quantBudgets.map(q => q.category);
  const unbudgetedCats = (config.categories || []).filter(c => !budgetedCats.includes(c));
  const [editCat, setEditCat] = useState(null);   // category whose amount is being edited
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addVal, setAddVal] = useState("");

  // Savings-goal form state
  const [goalForm, setGoalForm] = useState({ name: "", target: "", targetDate: "", saved: "" });
  const [goalEditId, setGoalEditId] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const resetGoal = () => { setGoalForm({ name: "", target: "", targetDate: "", saved: "" }); setGoalEditId(null); setGoalOpen(false); };
  const saveGoal = () => {
    const target = parseFloat(goalForm.target);
    if (!goalForm.name.trim() || isNaN(target) || target <= 0 || !goalForm.targetDate) return;
    const g = { id: goalEditId || genId(), name: goalForm.name.trim(), target, targetDate: goalForm.targetDate, saved: parseFloat(goalForm.saved) || 0 };
    const list = config.savingsGoals || [];
    onSaveGoals?.(goalEditId ? list.map(x => x.id === goalEditId ? g : x) : [...list, g]);
    resetGoal();
  };
  const editGoal = (g) => { setGoalEditId(g.id); setGoalForm({ name: g.name, target: String(g.target), targetDate: g.targetDate || "", saved: String(g.saved || "") }); setGoalOpen(true); };
  const deleteGoal = (id) => onSaveGoals?.((config.savingsGoals || []).filter(g => g.id !== id));

  const startEdit = (cat) => { setEditCat(cat); setEditVal(String((config.categoryBudgets || {})[cat] || "")); };
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

  // Click-to-drill: which row's transactions are expanded.
  const [openRow, setOpenRow] = useState(null);
  const toggleRow = (key) => setOpenRow(k => (k === key ? null : key));
  const catTx = (cat) => periodTx.filter(t => t.type === "expense" && t.category === cat).sort((a, b) => b.date.localeCompare(a.date));
  // Variable bills track ONLY transactions explicitly tagged to them, so the drill matches.
  const billTx = (billId) => periodTx.filter(t => t.type === "expense" && t.fulfills_recurring_id === billId).sort((a, b) => b.date.localeCompare(a.date));

  // Headline-stat drill-down: clicking a summary card opens a modal listing the
  // exact transactions behind that figure. Sets mirror how budgetSummary derives
  // each number, so the modal always reconciles with the card.
  const [statDrill, setStatDrill] = useState(null); // card label, or null
  const fixedBillTxIds = useMemo(() => new Set(fixedBills.map(b => b.matchedTxId).filter(Boolean)), [fixedBills]);
  const statTx = useMemo(() => ({
    Income: periodTx.filter(t => t.type === "income"),
    "Bills paid": periodTx.filter(t => fixedBillTxIds.has(t.id)),
    Spent: periodTx.filter(t => t.type === "expense" && !fixedBillTxIds.has(t.id) && t.category !== "Savings"),
    Saved: periodTx.filter(t => t.type === "savings" || (t.type === "expense" && t.category === "Savings")),
  }), [periodTx, fixedBillTxIds]);

  // Small transaction list shown when a category / bill row is expanded.
  const TxDrill = ({ txs, empty = "No transactions this pay period." }) => (
    <div className="bud-drill">
      {txs.length === 0
        ? <div className="bud-muted-12">{empty}</div>
        : txs.map(t => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "3px 0" }}>
            <span className="bud-ellipsis" style={{ color: "var(--text-secondary)" }}>{t.description || t.category}</span>
            <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>{t.date} · <span className="bud-mono">{formatMoney(t.amount)}</span></span>
          </div>
        ))}
    </div>
  );

  const summaryCards = [
    { label: "Income", value: incomeTotal, color: "var(--green)" },
    { label: "Bills paid", value: billsPaid, sub: `of ${formatMoney(billsObligation)}`, color: "var(--orange)" },
    { label: "Spent", value: spentNonBill, sub: "non-bill", color: "var(--red)" },
    { label: "Saved", value: saved, color: "var(--accent)" },
    { label: "Remaining", value: remaining, color: remaining < 0 ? "var(--red)" : remaining < 100 ? "var(--orange)" : "var(--green)" },
  ];

  return (
    <div>
      {/* Pay-period navigator */}
      <div className="bud-row" style={{ marginBottom: 4 }}>
        <button onClick={() => setPeriodOffset(o => o - 1)} className="bud-navbtn">‹</button>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {periodLabel}
          {periodOffset === 0 ? " (Current)" : periodOffset === 1 ? " (Next)" : periodOffset === -1 ? " (Previous)" : ""}
        </span>
        <button onClick={() => setPeriodOffset(o => o + 1)} className="bud-navbtn">›</button>
      </div>
      <div className="bud-muted-11" style={{ textAlign: "center", marginBottom: 14 }}>
        {period.fallback ? "No paydays set — showing this calendar month. Add an income source in Bills & Income for true pay-period analytics." : "Pay period · payday → next payday"}
      </div>

      {/* Summary cards */}
      <div className="bud-grid-2">
        {summaryCards.slice(0, 4).map(c => (
          <button key={c.label} type="button" onClick={() => setStatDrill(c.label)}
            title={`View the ${(statTx[c.label] || []).length} transaction(s) behind ${c.label}`}
            className="bud-panel bud-panel-db bud-statbtn">
            <div className="bud-row" style={{ marginBottom: 4 }}>
              <span className="bud-caps-label">{c.label}</span>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 9, color: "var(--text-muted)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span className="bud-mono" style={{ fontSize: 20, color: c.color, lineHeight: 1 }}>{formatMoney(c.value)}</span>
              {c.sub && <span className="bud-muted-11">{c.sub}</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="bud-panel bud-panel-db bud-row" style={{ marginBottom: 12 }}>
        <div className="bud-sec-13">Remaining this period</div>
        <div className="bud-mono" style={{ fontSize: 24, color: summaryCards[4].color }}>{formatMoney(remaining)}</div>
      </div>

      {/* Spendable this week (current week of the pay period) */}
      {currentWeek && (
        <div className="bud-panel bud-panel-db" style={{ marginBottom: 12, background: "var(--accent-bg)", borderColor: "var(--accent)" }}>
          <div className="bud-row-b">
            <div className="bud-sec-13">Left to spend this week</div>
            <div className="bud-mono" style={{ fontSize: 24, color: currentWeek.remaining < 0 ? "var(--red)" : currentWeek.remaining < currentWeek.allowance * 0.25 ? "var(--orange)" : "var(--green)" }}>
              {formatMoney(currentWeek.remaining)}
            </div>
          </div>
          <div className="bud-muted-11" style={{ marginTop: 4 }}>
            {formatMoney(currentWeek.spent)} spent of {formatMoney(currentWeek.allowance)}
            {currentWeek.carryIn ? ` · ${currentWeek.carryIn >= 0 ? "+" : ""}${formatMoney(currentWeek.carryIn)} rolled over` : ""}
          </div>
        </div>
      )}

      {/* Chart */}
      <p className="bud-sh">Money flow</p>
      <div className="bud-panel bud-panel-db" style={{ padding: "0.75rem" }}>
        <MoneyChart config={config} transactions={transactions} period={period} />
      </div>

      {/* Weekly allowance breakdown */}
      <p className="bud-sh">Weekly allowance</p>
      <div className="bud-panel bud-panel-db">
        <div className="bud-muted-12" style={{ marginBottom: 12 }}>
          {formatMoney(weekly.weeklyBase)} / week · {formatMoney(weekly.spendable)} spendable this period
          <span style={{ display: "block", marginTop: 2 }}>({formatMoney(weekly.incomeForPlanning)} scheduled − {formatMoney(weekly.billsObligation)} bills − {formatMoney(weekly.savings)} savings)</span>
        </div>
        {weekly.weeks.map(w => {
          const over = w.remaining < 0;
          const pct = w.allowance > 0 ? Math.min(Math.max(w.spent / w.allowance * 100, 0), 100) : (w.spent > 0 ? 100 : 0);
          const dr = `${parseDate(w.start).getDate()}–${parseDate(w.end).getDate()}`;
          return (
            <div key={w.index} style={{ marginBottom: 12, opacity: w.isPast ? 0.5 : 1, ...(w.isCurrent ? { borderLeft: "2px solid var(--accent)", paddingLeft: 10, marginLeft: -2 } : {}) }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: w.isCurrent ? 600 : 400 }}>
                  Week {w.index}{w.isCurrent ? " · now" : ""} <span className="bud-muted-11">{dr}</span>
                </span>
                <span className="bud-mono" style={{ color: over ? "var(--red)" : "var(--green)" }}>{formatMoney(w.remaining)} left</span>
              </div>
              <div className="bud-bar">
                <div className="bud-bar-fill" style={{ width: `${pct}%`, background: over ? "var(--red)" : pct > 75 ? "var(--orange)" : "var(--green)" }} />
              </div>
              <div className="bud-muted-11" style={{ marginTop: 3 }}>
                {formatMoney(w.spent)} spent of {formatMoney(w.allowance)}
                {w.carryIn ? ` · ${w.carryIn >= 0 ? "+" : ""}${formatMoney(w.carryIn)} rolled over` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bills this pay period — fixed bills (paid/unpaid) + variable bills (progress) */}
      {bills.length > 0 && <>
        <div className="bud-row-b">
          <p className="bud-sh">Bills</p>
          {fixedBills.length > 0 && <span style={{ fontSize: 12, color: paidCount === fixedBills.length ? "var(--green)" : "var(--text-muted)" }}>{paidCount} of {fixedBills.length} paid</span>}
        </div>
        {fixedBills.length > 0 && (
          <div className="bud-bar" style={{ marginBottom: 10 }}>
            <div className="bud-bar-fill" style={{ width: `${fixedBills.length ? paidCount / fixedBills.length * 100 : 0}%`, background: "var(--green)" }} />
          </div>
        )}
        {fixedBills.map((b, i) => {
          const key = `bill:${b.billId}-${b.date}-${i}`;
          const isOpen = openRow === key;
          const payTx = b.matchedTxId ? transactions.find(t => t.id === b.matchedTxId) : null;
          return (
            <div key={key} className="bud-panel bud-panel-db">
              <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => toggleRow(key)}>
                <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bud-ellipsis" style={{ fontSize: 14, fontWeight: 500, opacity: b.paid ? 0.6 : 1 }}>{b.name}</div>
                  <div className="bud-muted-11" style={{ marginTop: 2 }}>Due {b.date}{b.category ? ` · ${b.category}` : ""}</div>
                </div>
                <span className="bud-mono" style={{ fontSize: 14, marginRight: 12, textDecoration: b.paid ? "line-through" : "none", color: b.paid ? "var(--text-muted)" : undefined }}>{formatMoney(b.amount)}</span>
                {b.paid
                  ? <button className="btn bud-btn-xs" style={{ color: "var(--green)", background: "var(--success-bg)", border: "none" }} onClick={(e) => { e.stopPropagation(); onUnpayBill?.(b.matchedTxId); }} title="Undo">✓ Paid</button>
                  : b.autoPay
                    ? <span style={{ fontSize: 11, color: "var(--green)", background: "var(--success-bg)", borderRadius: 4, padding: "2px 6px" }}>Auto</span>
                    : <button className="btn bud-btn-sm" onClick={(e) => { e.stopPropagation(); onPayBill(b); }}>Pay now</button>}
              </div>
              {isOpen && (
                <div className="bud-drill" style={{ fontSize: 12 }}>
                  {b.paid
                    ? <span style={{ color: "var(--green)" }}><i className="fa-solid fa-check" style={{ marginRight: 5 }} />Paid {payTx ? `${payTx.date} · ${formatMoney(payTx.amount)}${payTx.description ? ` · ${payTx.description}` : ""}` : "this period"}</span>
                    : <span style={{ color: "var(--text-muted)" }}>Not paid yet — due {b.date}.</span>}
                </div>
              )}
            </div>
          );
        })}
        {/* Variable bills — progress bars (spend in their category this pay period); click to drill in */}
        {variableBills.map((b) => {
          const pct = b.budget > 0 ? Math.min(b.spent / b.budget * 100, 100) : 0;
          const over = b.spent > b.budget;
          const barColor = over ? "var(--red)" : pct > 80 ? "var(--orange)" : "var(--green)";
          const key = `varbill:${b.billId}`;
          const isOpen = openRow === key;
          return (
            <div key={key} className="bud-panel bud-panel-db">
              <div style={{ cursor: "pointer" }} onClick={() => toggleRow(key)}>
                <div className="bud-row" style={{ marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>
                    <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} />
                    {b.name} <span className="bud-tag" style={{ marginLeft: 4 }}>{b.category}</span>
                  </span>
                  <span className="bud-mono" style={{ fontSize: 12, color: over ? "var(--red)" : "var(--text-muted)" }}>{formatMoney(b.spent)} / {formatMoney(b.budget)} ({Math.round(b.budget > 0 ? b.spent / b.budget * 100 : 0)}%)</span>
                </div>
                <div className="bud-bar">
                  <div className="bud-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                {over && <div className="bud-over-note">{formatMoney(b.spent - b.budget)} over</div>}
              </div>
              {isOpen && <TxDrill txs={billTx(b.billId)} empty="No transactions tagged to this bill yet — tag them via “Pays a bill?” when logging." />}
            </div>
          );
        })}
      </>}

      {/* Quantifiable budgets (Groceries, Gas, Fun… — category budgets + variable bills) */}
      <div className="bud-row-b">
        <p className="bud-sh">Category budgets</p>
        <span className="bud-muted-11">this pay period</span>
      </div>
      <div className="bud-panel bud-panel-db">
        {quantBudgets.length === 0 && !adding && (
          <p className="bud-muted-12" style={{ margin: "2px 0 10px" }}>
            Track variable spending (Groceries, Gas, Fun…) here. Add a budget below, or in Bills &amp; Income tick &ldquo;variable&rdquo; on a bill.
          </p>
        )}
        {quantBudgets.map(({ category: cat, budget, spent: spentCat, fromBill, editable }) => {
          const pct = budget > 0 ? Math.min(spentCat / budget * 100, 100) : 0;
          const over = spentCat > budget;
          const barColor = over ? "var(--red)" : pct > 80 ? "var(--orange)" : "var(--green)";
          const isEditing = editCat === cat;
          const key = `cat:${cat}`;
          const isOpen = openRow === key;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="bud-row" style={{ marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 500, cursor: "pointer" }} onClick={() => toggleRow(key)}>
                  <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} />
                  {cat}
                  {fromBill && <span className="bud-tag" style={{ marginLeft: 6 }}>bill</span>}
                </span>
                {isEditing ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="bud-muted-12">$</span>
                    <input type="number" autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(cat); if (e.key === "Escape") setEditCat(null); }}
                      style={{ width: 80, fontSize: 13, padding: "2px 6px" }} />
                    <button className="btn-sm btn-complete bud-btn-xs2" onClick={() => commitEdit(cat)}>Save</button>
                    <button className="btn-sm btn-delete bud-btn-xs2" onClick={() => { onSetCategoryBudget?.(cat, 0); setEditCat(null); setEditVal(""); }} title="Remove budget">Remove</button>
                  </span>
                ) : editable ? (
                  <button onClick={() => startEdit(cat)} title="Edit budget" className="bud-x bud-mono"
                    style={{ color: over ? "var(--red)" : "var(--text-muted)", fontSize: 12 }}>
                    {formatMoney(spentCat)} / {formatMoney(budget)} ({Math.round(budget > 0 ? spentCat / budget * 100 : 0)}%) <i className="fa-solid fa-pen" style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }} />
                  </button>
                ) : (
                  <span className="bud-mono" style={{ color: over ? "var(--red)" : "var(--text-muted)", fontSize: 12 }}>
                    {formatMoney(spentCat)} / {formatMoney(budget)} ({Math.round(budget > 0 ? spentCat / budget * 100 : 0)}%)
                  </span>
                )}
              </div>
              <div className="bud-bar">
                <div className="bud-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              {over && <div className="bud-over-note">{formatMoney(spentCat - budget)} over budget</div>}
              {isOpen && <TxDrill txs={catTx(cat)} />}
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
            <button className="btn bud-btn-sm" style={{ marginTop: 2 }} onClick={() => setAdding(true)}>
              <i className="fa-solid fa-plus" style={{ fontSize: 10, marginRight: 4 }} /> Add category budget
            </button>
          )
        )}
      </div>

      {/* Savings goals — spread a future purchase across paychecks */}
      <div className="bud-row-b">
        <p className="bud-sh">Savings goals</p>
        {savingsThisPeriod > 0 && <span style={{ fontSize: 11, color: "var(--accent)" }}>set aside {formatMoney(savingsThisPeriod)} this paycheque</span>}
      </div>
      <div className="bud-panel bud-panel-db">
        {goals.length === 0 && !goalOpen && (
          <p className="bud-muted-12" style={{ margin: "2px 0 10px" }}>
            Saving for something? Add a goal with a target amount and date, and I&apos;ll tell you how much to set aside each paycheque.
          </p>
        )}
        {goals.map(g => {
          const pct = g.target > 0 ? Math.min(g.saved / g.target * 100, 100) : 0;
          const barColor = g.done ? "var(--green)" : "var(--accent)";
          return (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div className="bud-row" style={{ marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{g.name} {g.done && <span style={{ color: "var(--green)", fontSize: 11 }}>funded</span>}</span>
                <span className="bud-mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatMoney(g.saved)} / {formatMoney(g.target)}</span>
              </div>
              <div className="bud-bar">
                <div className="bud-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="bud-row" style={{ marginTop: 5 }}>
                <span style={{ fontSize: 11, color: g.done ? "var(--green)" : "var(--accent)" }}>
                  {g.done
                    ? "Goal reached!"
                    : g.periodsLeft > 0
                      ? <><b>{formatMoney(g.perPeriod)}</b> / paycheque · {g.periodsLeft} left · by {g.targetDate}</>
                      : <>Set aside {formatMoney(g.remaining)} — target date {g.targetDate || "not set"} {g.targetDate && g.targetDate < today ? "(past)" : "(no paydays before it)"}</>}
                </span>
                <span className="bud-actions">
                  <button className="btn-sm bud-btn-xs2" onClick={() => editGoal(g)}>Edit</button>
                  <button className="btn-sm btn-delete bud-btn-xs2" onClick={() => deleteGoal(g.id)}>Del</button>
                </span>
              </div>
            </div>
          );
        })}

        {goalOpen ? (
          <div style={{ borderTop: goals.length ? "0.5px solid var(--border-subtle)" : "none", paddingTop: goals.length ? 10 : 0 }}>
            <input placeholder="What for? (e.g. New laptop)" value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} className="bud-inp" style={{ boxSizing: "border-box" }} />
            <div className="bud-hstack" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <input type="number" placeholder="Target $" value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} style={{ flex: 1, minWidth: 90 }} />
              <input type="number" placeholder="Saved so far $" value={goalForm.saved} onChange={e => setGoalForm(f => ({ ...f, saved: e.target.value }))} style={{ flex: 1, minWidth: 90 }} />
            </div>
            <label className="bud-label">Need it by</label>
            <input type="date" value={goalForm.targetDate} onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} className="bud-inp" style={{ boxSizing: "border-box" }} />
            <div className="bud-hstack">
              <button className="btn-sm btn-complete bud-btn-md" onClick={saveGoal}>{goalEditId ? "Save" : "Add goal"}</button>
              <button className="btn-sm bud-btn-md" onClick={resetGoal}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn bud-btn-sm" style={{ marginTop: 2 }} onClick={() => setGoalOpen(true)}>
            <i className="fa-solid fa-plus" style={{ fontSize: 10, marginRight: 4 }} /> Add savings goal
          </button>
        )}
      </div>

      {/* Category breakdown */}
      {catTotals.length > 0 && <>
        <p className="bud-sh">By category · this period</p>
        <div className="bud-panel bud-panel-db">
          {catTotals.map(([cat, amt]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                <span>{cat}</span>
                <span style={{ color: "var(--text-muted)" }}>{formatMoney(amt)} ({Math.round(amt/totalSpent*100)}%)</span>
              </div>
              <div className="bud-bar">
                <div className="bud-bar-fill" style={{ width: `${(amt/maxCat*100).toFixed(1)}%`, background: "var(--accent)" }}/>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* Recent transactions */}
      <p className="bud-sh">Recent this period</p>
      {recent.length === 0
        ? <p className="bud-muted-13">No transactions this period.</p>
        : recent.map(t => (
          <div key={t.id} className="bud-panel bud-panel-db" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bud-ellipsis" style={{ fontSize: 13, fontWeight: 500 }}>{t.description}</div>
              <div className="bud-muted-11" style={{ marginTop: 1 }}>{t.category} · {t.date}</div>
            </div>
            <span className="bud-mono" style={{ fontSize: 13, color: t.type === "income" ? "var(--green)" : t.type === "future" ? "var(--accent)" : t.type === "savings" ? "#14b8a6" : /* theme-fixed: user colour (savings category) */ "var(--red)", flexShrink: 0 }}>
              {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
            </span>
          </div>
        ))
      }

      {/* Stat drill-down modal — the transactions behind a clicked summary card */}
      {statDrill && (() => {
        const txs = [...(statTx[statDrill] || [])].sort((a, b) => b.date.localeCompare(a.date));
        const cardMeta = summaryCards.find(c => c.label === statDrill);
        const total = txs.reduce((s, t) => s + t.amount, 0);
        return (
          <div onClick={() => setStatDrill(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px", zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, width: "min(520px, 100%)", maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <div className="bud-caps-label">{statDrill} · {periodLabel}</div>
                  <div className="bud-mono" style={{ fontSize: 19, color: cardMeta?.color, lineHeight: 1.2, marginTop: 2 }}>
                    {formatMoney(total)} <span className="bud-muted-12">· {txs.length} transaction{txs.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <button onClick={() => setStatDrill(null)} aria-label="Close"
                  className="bud-x" style={{ fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ overflowY: "auto", padding: "6px 16px 16px" }}>
                {txs.length === 0
                  ? <p className="bud-muted-13" style={{ padding: "12px 0" }}>No transactions make up this figure for this pay period.</p>
                  : txs.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "0.5px solid var(--border-subtle)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="bud-ellipsis" style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.description || t.category || "—"}</div>
                        <div className="bud-muted-11" style={{ marginTop: 1 }}>{t.date}{t.category ? ` · ${t.category}` : ""}{(t.is_bill || t.fulfills_recurring_id) ? " · bill" : ""}</div>
                      </div>
                      <span className="bud-mono" style={{ fontSize: 13, color: cardMeta?.color, whiteSpace: "nowrap" }}>{formatMoney(t.amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

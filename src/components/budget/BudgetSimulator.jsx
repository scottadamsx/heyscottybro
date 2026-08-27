import { downloadText } from "../../lib/exporter";
import { useState } from "react";
import { getBillDatesInRange, getIncomeDatesInRange, formatMoney, parseDate, toDateStr, genId, getPayPeriod } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import { getPeriodHistory, getLastIncome, projectNextPeriod } from "../../utils/budgetAnalytics";
import "./budget.css";

function recalcBalances(rows, startBalance) {
  let bal = startBalance;
  return rows.map((r, i) => {
    if (i === 0 && r.description === "Starting Balance") return { ...r, balance: startBalance };
    bal = bal + (r.income || 0) - (r.expense || 0);
    return { ...r, balance: Math.round(bal * 100) / 100 };
  });
}

export default function BudgetSimulator({ config, simulations, setSimulations, transactions = [] }) {
  const { confirm, dialog } = useConfirm();
  const today = toDateStr();
  const sixMonths = (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return toDateStr(d); })();

  const [startBal, setStartBal] = useState("0");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(sixMonths);
  const [rows, setRows] = useState([]);
  const [warning, setWarning] = useState("");
  const [loadSel, setLoadSel] = useState("");
  const [simName, setSimName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const generate = () => {
    let r = [{ id: genId(), date: startDate, description: "Starting Balance", income: 0, expense: 0, isManual: false }];
    (config.income || []).forEach(inc => {
      getIncomeDatesInRange(inc, startDate, endDate).forEach(d => {
        r.push({ id: genId(), date: d, description: `Payday - ${inc.name}`, income: inc.amount, expense: 0, isManual: false });
      });
    });
    (config.recurringBills || []).forEach(bill => {
      getBillDatesInRange(bill, startDate, endDate).forEach(d => {
        r.push({ id: genId(), date: d, description: `Bill - ${bill.name}`, income: 0, expense: bill.amount, isManual: false });
      });
    });
    r.sort((a, b) => a.date.localeCompare(b.date));
    const bal = parseFloat(startBal) || 0;
    const calced = recalcBalances(r, bal);
    setRows(calced);
    const neg = calced.find(row => row.balance < 0);
    setWarning(neg ? `Warning: balance goes negative on ${neg.date}. Consider adjusting your plan.` : "");
  };

  const updateRow = (id, field, value) => {
    setRows(prev => {
      let updated = prev.map(r => {
        if (r.id !== id) return r;
        const v = field === "income" || field === "expense" ? parseFloat(value) || 0 : value;
        return { ...r, [field]: v };
      });
      if (field === "date") updated.sort((a, b) => a.date.localeCompare(b.date));
      const firstRow = updated[0];
      const startBal2 = firstRow?.description === "Starting Balance" ? (firstRow.balance ?? 0) : 0;
      const recalced = recalcBalances(updated, startBal2);
      const neg = recalced.find(r => r.balance < 0);
      setWarning(neg ? `Warning: balance goes negative on ${neg.date}.` : "");
      return recalced;
    });
  };

  const deleteRow = id => {
    setRows(prev => {
      const updated = prev.filter(r => r.id !== id);
      const startBal2 = updated[0]?.description === "Starting Balance" ? (updated[0].balance ?? 0) : 0;
      const recalced = recalcBalances(updated, startBal2);
      const neg = recalced.find(r => r.balance < 0);
      setWarning(neg ? `Warning: balance goes negative on ${neg.date}.` : "");
      return recalced;
    });
  };

  const addRow = () => {
    setRows(prev => {
      const updated = [...prev, { id: genId(), date: today, description: "", income: 0, expense: 0, isManual: true }];
      updated.sort((a, b) => a.date.localeCompare(b.date));
      const startBal2 = updated[0]?.description === "Starting Balance" ? (updated[0].balance ?? 0) : 0;
      return recalcBalances(updated, startBal2);
    });
  };

  const saveSimulation = () => {
    if (!simName.trim()) return;
    const sim = { id: genId(), name: simName.trim(), savedAt: today, startingBalance: parseFloat(startBal) || 0, startDate, endDate, rows };
    setSimulations(p => [sim, ...p]);
    setShowSaveForm(false); setSimName("");
  };

  const loadSimulation = id => {
    const sim = simulations.find(s => s.id === id);
    if (!sim) return;
    setStartBal(String(sim.startingBalance));
    setStartDate(sim.startDate); setEndDate(sim.endDate);
    setRows(sim.rows);
    const neg = sim.rows.find(r => r.balance < 0);
    setWarning(neg ? `Warning: balance goes negative on ${neg.date}.` : "");
    setLoadSel("");
  };

  const deleteSimulation = async id => {
    if (!await confirm("Delete this simulation?", { title: "Delete simulation", confirmLabel: "Delete" })) return;
    setSimulations(p => p.filter(s => s.id !== id));
  };

  const exportCsv = () => {
    let csv = "Date,Description,Income,Expense,Balance\n";
    rows.forEach(r => { csv += `${r.date},"${r.description}",${r.income || 0},${r.expense || 0},${r.balance.toFixed(2)}\n`; });
    downloadText(csv, "budget_projection.csv", "text/csv");
  };

  // Build projection from actual spending habits instead of config bills
  const loadFromHabits = () => {
    const lastInc = getLastIncome(transactions);
    const hist = getPeriodHistory(transactions, config, 3);
    const proj = projectNextPeriod(hist, lastInc);
    if (!lastInc && !hist.some(p => p.spending > 0)) {
      setWarning("Not enough transaction history yet. Log at least one income and a few expenses first.");
      return;
    }
    const bal = parseFloat(startBal) || 0;
    let r = [{ id: genId(), date: startDate, description: "Starting Balance", income: 0, expense: 0, isManual: false }];

    // Generate income dates using pay schedule + last paycheck amount
    const inc = { amount: proj.income || lastInc, frequency: config.paySchedule?.type || "biweekly", nextDate: config.paySchedule?.anchorDate || startDate };
    getIncomeDatesInRange(inc, startDate, endDate).forEach(d => {
      r.push({ id: genId(), date: d, description: `Payday (assumed ${formatMoney(proj.income || lastInc)} — last paycheck)`, income: proj.income || lastInc, expense: 0, isManual: false });
    });

    // Add one projected spending lump per pay period
    let cursor = startDate;
    while (cursor <= endDate) {
      const p = getPayPeriod(cursor, 0, config.paySchedule);
      if (proj.spending > 0) {
        const mid = p.start > startDate ? p.start : startDate;
        r.push({ id: genId(), date: mid, description: `Projected spending (avg of last 3 periods)`, income: 0, expense: proj.spending, isManual: false });
      }
      // advance cursor past this period
      const next = new Date(p.end + "T12:00:00");
      next.setDate(next.getDate() + 1);
      cursor = next.toLocaleDateString("en-CA");
    }

    r.sort((a, b) => a.date.localeCompare(b.date));
    const calced = recalcBalances(r, bal);
    setRows(calced);
    const neg = calced.find(row => row.balance < 0);
    setWarning(neg ? `Warning: balance goes negative on ${neg.date} based on your spending habits.` : "");
  };

  return (
    <div>
      <p className="bud-sh bud-sh-tight">Generate projection</p>
      <div className="bud-grid-3">
        <div>
          <label className="bud-label bud-label-sm">Starting balance</label>
          <input type="number" value={startBal} onChange={e => setStartBal(e.target.value)} placeholder="0" style={{ width: "100%" }} />
        </div>
        <div>
          <label className="bud-label bud-label-sm">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label className="bud-label bud-label-sm">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: "100%" }} />
        </div>
      </div>
      <div className="bud-hstack" style={{ marginBottom: 12 }}>
        <button className="btn bud-flex1" onClick={generate} style={{ background: "var(--accent)", color: "var(--text-on-accent)", border: "none" }}>From bill config</button>
        <button className="btn bud-flex1" onClick={loadFromHabits} style={{ background: transactions.length ? "var(--success-bg)" : "var(--bg-raised)", color: transactions.length ? "var(--green)" : "var(--text-muted)", border: `1px solid ${transactions.length ? "var(--success-bg)" : "var(--border-subtle)"}` }}
          title={transactions.length ? "Uses your last paycheck amount + average spending per period" : "Log some transactions first"}>
          From my habits{transactions.length ? <> <i className="fa-solid fa-check" aria-hidden="true" /></> : null}
        </button>
      </div>

      {/* Saved simulations */}
      {simulations.length > 0 && (
        <div className="bud-hstack" style={{ marginBottom: 12 }}>
          <select value={loadSel} onChange={e => setLoadSel(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
            <option value="">Load saved…</option>
            {simulations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.savedAt})</option>)}
          </select>
          {loadSel && <button className="btn bud-btn-sm" onClick={() => loadSimulation(loadSel)}>Load</button>}
          {loadSel && <button className="btn btn-delete bud-btn-sm" onClick={() => deleteSimulation(loadSel)}>Del</button>}
        </div>
      )}

      {warning && <div style={{ background: "var(--danger-bg)", border: "1px solid var(--red)", borderRadius: "0.375rem", padding: "0.75rem 1rem", marginBottom: 12, fontSize: 13, color: "var(--red)" }}>{warning}</div>}

      {rows.length > 0 && (
        <>
          <div className="bud-hstack" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <button className="btn bud-btn-md" onClick={addRow}>+ Add row</button>
            <button className="btn bud-btn-md" onClick={exportCsv}><i className="fa-solid fa-download"/> CSV</button>
            <button className="btn bud-btn-md" onClick={() => setShowSaveForm(s => !s)}><i className="fa-solid fa-floppy-disk"/> Save</button>
          </div>
          {showSaveForm && (
            <div className="bud-hstack" style={{ marginBottom: 10 }}>
              <input value={simName} onChange={e => setSimName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveSimulation()} placeholder="Simulation name…" style={{ flex: 1, fontSize: 13 }} autoFocus />
              <button className="btn" onClick={saveSimulation} style={{ fontSize: 12, background: "var(--green)", color: "var(--text-on-accent)", border: "none", fontWeight: 600 }}>Save</button>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="bud-table bud-table-sim">
              <thead>
                <tr>
                  {["Date","Description","Income","Expense","Balance",""].map(h => (
                    <th key={h} className={["Income","Expense","Balance"].includes(h) ? "bud-right" : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const negBal = r.balance < 0, lowBal = r.balance < 200;
                  return (
                    <tr key={r.id} style={{ background: negBal ? "var(--danger-bg)" : lowBal ? "var(--warn-bg)" : "transparent" }}>
                      <td>
                        <input type="date" value={r.date} onChange={e => updateRow(r.id, "date", e.target.value)} className="bud-sim-inp" style={{ width: 110 }} />
                      </td>
                      <td>
                        <input type="text" value={r.description} onChange={e => updateRow(r.id, "description", e.target.value)} className="bud-sim-inp" style={{ width: "100%", minWidth: 100 }} />
                      </td>
                      <td className="bud-right">
                        <input type="number" step="0.01" value={r.income || ""} onChange={e => updateRow(r.id, "income", e.target.value)} placeholder="0" className="bud-sim-inp bud-sim-num" style={{ color: "var(--green)" }} />
                      </td>
                      <td className="bud-right">
                        <input type="number" step="0.01" value={r.expense || ""} onChange={e => updateRow(r.id, "expense", e.target.value)} placeholder="0" className="bud-sim-inp bud-sim-num" style={{ color: "var(--red)" }} />
                      </td>
                      <td className="bud-right bud-mono" style={{ fontSize: 12, color: negBal ? "var(--red)" : lowBal ? "var(--orange)" : "var(--green)", whiteSpace: "nowrap" }}>
                        {formatMoney(r.balance)}
                      </td>
                      <td>
                        <button onClick={() => deleteRow(r.id)} className="bud-x" style={{ color: "var(--red)", fontSize: 14, padding: 0 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}

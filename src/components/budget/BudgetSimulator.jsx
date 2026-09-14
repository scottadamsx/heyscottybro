import { downloadText } from "../../lib/exporter";
import { useState } from "react";
import { getBillDatesInRange, getIncomeDatesInRange, formatMoney, parseDate, toDateStr, genId, getPayPeriod } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import { getPeriodHistory, getLastIncome, projectNextPeriod } from "../../utils/budgetAnalytics";
import "./budget.css";
import DatePicker from "../DatePicker";

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
    <div className="money money-tab">
      <div className="section-head"><h2 className="section-title">Generate projection</h2></div>

      <div className="db-card sim-setup">
        <div className="sim-fields">
          <label className="money-field">
            <span className="field-label">Starting balance</span>
            <input type="number" value={startBal} onChange={e => setStartBal(e.target.value)} placeholder="0" />
          </label>
          <div className="money-field">
            <span className="field-label">From</span>
            <DatePicker value={startDate} onChange={(v) => setStartDate(v)} />
          </div>
          <div className="money-field">
            <span className="field-label">To</span>
            <DatePicker value={endDate} onChange={(v) => setEndDate(v)} />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-sm" onClick={generate}>From bill config</button>
          <button type="button" className="btn-sm btn-secondary-sm" onClick={loadFromHabits}
            title={transactions.length ? "Uses your last paycheck amount + average spending per period" : "Log some transactions first"}>
            From my habits{transactions.length ? <> <i className="fa-solid fa-check sim-ready" aria-hidden="true" /></> : null}
          </button>
        </div>

        {/* Saved simulations */}
        {simulations.length > 0 && (
          <div className="bi-inline sim-saved">
            <select value={loadSel} aria-label="Saved simulations" onChange={e => setLoadSel(e.target.value)}>
              <option value="">Load saved…</option>
              {simulations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.savedAt})</option>)}
            </select>
            {loadSel && <button type="button" className="btn-sm btn-secondary-sm" onClick={() => loadSimulation(loadSel)}>Load</button>}
            {loadSel && <button type="button" className="btn-sm btn-delete" onClick={() => deleteSimulation(loadSel)}>Delete</button>}
          </div>
        )}
      </div>

      {warning && <div className="money-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /><span>{warning}</span></div>}

      {rows.length > 0 && (
        <div className="db-card">
          <div className="form-actions sim-toolbar">
            <button type="button" className="btn-sm btn-secondary-sm" onClick={addRow}><i className="fa-solid fa-plus" aria-hidden="true" /> Add row</button>
            <button type="button" className="btn-sm btn-secondary-sm" onClick={exportCsv}><i className="fa-solid fa-download" aria-hidden="true" /> CSV</button>
            <button type="button" className="btn-sm btn-secondary-sm" aria-expanded={showSaveForm} onClick={() => setShowSaveForm(s => !s)}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save</button>
          </div>
          {showSaveForm && (
            <div className="bi-inline sim-save">
              <input value={simName} aria-label="Simulation name" onChange={e => setSimName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveSimulation()} placeholder="Simulation name…" autoFocus />
              <button type="button" className="btn btn-sm" onClick={saveSimulation}>Save</button>
            </div>
          )}
          <div className="bud-table-wrap">
            <table className="bud-table money-table sim-table">
              <thead>
                <tr>
                  {["Date", "Description", "Income", "Expense", "Balance"].map(h => (
                    <th key={h} className={["Income", "Expense", "Balance"].includes(h) ? "bud-right" : undefined}>{h}</th>
                  ))}
                  <th><span className="visually-hidden">Delete</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const negBal = r.balance < 0, lowBal = r.balance < 200;
                  return (
                    <tr key={r.id}>
                      <td className="sim-date">
                        <DatePicker value={r.date} onChange={(v) => updateRow(r.id, "date", v)} />
                      </td>
                      <td>
                        <input type="text" value={r.description} aria-label="Description" onChange={e => updateRow(r.id, "description", e.target.value)} className="bud-sim-inp" />
                      </td>
                      <td className="bud-right">
                        <input type="number" step="0.01" value={r.income || ""} aria-label="Income" onChange={e => updateRow(r.id, "income", e.target.value)} placeholder="0" className="bud-sim-inp bud-sim-num is-in" />
                      </td>
                      <td className="bud-right">
                        <input type="number" step="0.01" value={r.expense || ""} aria-label="Expense" onChange={e => updateRow(r.id, "expense", e.target.value)} placeholder="0" className="bud-sim-inp bud-sim-num" />
                      </td>
                      <td className={`is-amt${negBal ? " is-neg" : lowBal ? " is-low" : ""}`}>
                        {formatMoney(r.balance)}
                      </td>
                      <td className="is-actions">
                        <button type="button" onClick={() => deleteRow(r.id)} className="icon-x sm" aria-label={`Delete row ${r.description || r.date}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

import { useState } from "react";
import { getBillDatesInRange, getIncomeDatesInRange, formatMoney, parseDate, toDateStr, genId, getPayPeriod } from "../../utils/budgetCalc";
import { getPeriodHistory, getLastIncome, projectNextPeriod } from "../../utils/budgetAnalytics";

function recalcBalances(rows, startBalance) {
  let bal = startBalance;
  return rows.map((r, i) => {
    if (i === 0 && r.description === "Starting Balance") return { ...r, balance: startBalance };
    bal = bal + (r.income || 0) - (r.expense || 0);
    return { ...r, balance: Math.round(bal * 100) / 100 };
  });
}

export default function BudgetSimulator({ config, simulations, setSimulations, transactions = [] }) {
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

  const deleteSimulation = id => {
    if (!window.confirm("Delete this simulation?")) return;
    setSimulations(p => p.filter(s => s.id !== id));
  };

  const exportCsv = () => {
    let csv = "Date,Description,Income,Expense,Balance\n";
    rows.forEach(r => { csv += `${r.date},"${r.description}",${r.income || 0},${r.expense || 0},${r.balance.toFixed(2)}\n`; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "budget_projection.csv"; a.click();
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

  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "14px 0 8px", fontWeight: 500 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 500 };

  return (
    <div>
      <p style={sh}>Generate projection</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Starting balance</label>
          <input type="number" value={startBal} onChange={e => setStartBal(e.target.value)} placeholder="0" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: "100%" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={generate} style={{ flex: 1, background: "var(--accent,#6366f1)", color: "#fff", border: "none" }}>From bill config</button>
        <button className="btn" onClick={loadFromHabits} style={{ flex: 1, background: transactions.length ? "rgba(34,197,94,0.15)" : "var(--bg-raised)", color: transactions.length ? "#22c55e" : "var(--text-muted)", border: `1px solid ${transactions.length ? "rgba(34,197,94,0.4)" : "var(--border)"}` }}
          title={transactions.length ? "Uses your last paycheck amount + average spending per period" : "Log some transactions first"}>
          From my habits {transactions.length ? "✓" : ""}
        </button>
      </div>

      {/* Saved simulations */}
      {simulations.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={loadSel} onChange={e => setLoadSel(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
            <option value="">Load saved…</option>
            {simulations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.savedAt})</option>)}
          </select>
          {loadSel && <button className="btn" onClick={() => loadSimulation(loadSel)} style={{ fontSize: 12, padding: "4px 10px" }}>Load</button>}
          {loadSel && <button className="btn btn-delete" onClick={() => deleteSimulation(loadSel)} style={{ fontSize: 12, padding: "4px 10px" }}>Del</button>}
        </div>
      )}

      {warning && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "0.375rem", padding: "0.75rem 1rem", marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{warning}</div>}

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button className="btn" onClick={addRow} style={{ fontSize: 12, padding: "5px 12px" }}>+ Add row</button>
            <button className="btn" onClick={exportCsv} style={{ fontSize: 12, padding: "5px 12px" }}><i className="fa-solid fa-download"/> CSV</button>
            <button className="btn" onClick={() => setShowSaveForm(s => !s)} style={{ fontSize: 12, padding: "5px 12px" }}><i className="fa-solid fa-floppy-disk"/> Save</button>
          </div>
          {showSaveForm && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={simName} onChange={e => setSimName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveSimulation()} placeholder="Simulation name…" style={{ flex: 1, fontSize: 13 }} autoFocus />
              <button className="btn" onClick={saveSimulation} style={{ fontSize: 12, background: "#22c55e", color: "#000", border: "none", fontWeight: 600 }}>Save</button>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date","Description","Income","Expense","Balance",""].map(h => (
                    <th key={h} style={{ padding: "6px 6px", textAlign: ["Income","Expense","Balance"].includes(h) ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const negBal = r.balance < 0, lowBal = r.balance < 200;
                  return (
                    <tr key={r.id} style={{ borderBottom: "0.5px solid var(--border)", background: negBal ? "rgba(239,68,68,0.08)" : lowBal ? "rgba(245,158,11,0.06)" : "transparent" }}>
                      <td style={{ padding: "5px 6px" }}>
                        <input type="date" value={r.date} onChange={e => updateRow(r.id, "date", e.target.value)} style={{ fontSize: 11, padding: "3px 4px", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 4, color: "inherit", width: 110 }} />
                      </td>
                      <td style={{ padding: "5px 6px" }}>
                        <input type="text" value={r.description} onChange={e => updateRow(r.id, "description", e.target.value)} style={{ fontSize: 11, padding: "3px 4px", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 4, color: "inherit", width: "100%", minWidth: 100 }} />
                      </td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>
                        <input type="number" step="0.01" value={r.income || ""} onChange={e => updateRow(r.id, "income", e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "3px 4px", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 4, color: "#22c55e", width: 70, textAlign: "right" }} />
                      </td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>
                        <input type="number" step="0.01" value={r.expense || ""} onChange={e => updateRow(r.id, "expense", e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "3px 4px", background: "transparent", border: "0.5px solid var(--border)", borderRadius: 4, color: "#ef4444", width: 70, textAlign: "right" }} />
                      </td>
                      <td style={{ padding: "5px 6px", textAlign: "right", ...mono, fontSize: 12, color: negBal ? "#ef4444" : lowBal ? "#f59e0b" : "#22c55e", whiteSpace: "nowrap" }}>
                        {formatMoney(r.balance)}
                      </td>
                      <td style={{ padding: "5px 6px" }}>
                        <button onClick={() => deleteRow(r.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

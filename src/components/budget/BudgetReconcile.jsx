import { useMemo, useState } from "react";
import { getIncomePayPeriod, formatMoney, formatPeriodLabel, getIncomeDatesInRange, toDateStr } from "../../utils/budgetCalc";

export default function BudgetReconcile({ config, transactions, setTransactions }) {
  const today = toDateStr();
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i >= -5; i--) {
      const p = getIncomePayPeriod(config, today, i);
      opts.push({ start: p.start, end: p.end, label: formatPeriodLabel(p.start, p.end) + (i === 0 ? " (Current)" : ""), key: `${p.start}|${p.end}` });
    }
    return opts;
  }, [today, config]);

  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key || "");
  const [selectAll, setSelectAll] = useState(false);
  const [checked, setChecked] = useState(new Set());

  const period = useMemo(() => {
    const p = periodOptions.find(o => o.key === periodKey) || periodOptions[0];
    return p ? { start: p.start, end: p.end } : { start: today, end: today };
  }, [periodKey, periodOptions, today]);

  const periodTx = useMemo(() => transactions.filter(t => t.date >= period.start && t.date <= period.end), [transactions, period]);
  const unreconciled = periodTx.filter(t => !t.reconciled);
  const reconciled = periodTx.filter(t => t.reconciled);

  const income = periodTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  let incFromSources = 0;
  (config.income || []).forEach(inc => {
    incFromSources += getIncomeDatesInRange(inc, period.start, period.end).length * inc.amount;
  });
  const totalIncome = income + incFromSources;
  const totalExpenses = periodTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const reconciledTotal = reconciled.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const unreconciledTotal = unreconciled.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const expected = totalIncome - totalExpenses;

  const reconcileOne = id => setTransactions(p => p.map(t => t.id === id ? { ...t, reconciled: true } : t));
  const unreconcileOne = id => setTransactions(p => p.map(t => t.id === id ? { ...t, reconciled: false } : t));
  const reconcileSelected = () => {
    setTransactions(p => p.map(t => checked.has(t.id) ? { ...t, reconciled: true } : t));
    setChecked(new Set()); setSelectAll(false);
  };

  const toggleCheck = id => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = val => { setSelectAll(val); setChecked(val ? new Set(unreconciled.map(t => t.id)) : new Set()); };

  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "14px 0 8px", fontWeight: 500 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 500 };
  const statCard = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 12px", background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)", borderRadius: "0.375rem", marginBottom: 6 };

  return (
    <div>
      <select value={periodKey} onChange={e => { setPeriodKey(e.target.value); setChecked(new Set()); setSelectAll(false); }}
        style={{ width: "100%", marginBottom: 14, fontSize: 13 }}>
        {periodOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      {/* Summary */}
      <p style={sh}>Period summary</p>
      <div style={statCard}><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Expected balance</span><span style={{ ...mono, fontSize: 14, color: "var(--green)" }}>{formatMoney(expected)}</span></div>
      <div style={statCard}><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Reconciled expenses</span><span style={{ ...mono, fontSize: 14 }}>{formatMoney(reconciledTotal)}</span></div>
      <div style={statCard}><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Unreconciled expenses</span><span style={{ ...mono, fontSize: 14, color: "var(--orange)" }}>{formatMoney(unreconciledTotal)}</span></div>

      {/* Unreconciled */}
      <p style={{ ...sh, marginTop: 18 }}>Unreconciled ({unreconciled.length})</p>
      {unreconciled.length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>All clear — everything reconciled! ✓</p>
        : <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selectAll} onChange={e => toggleAll(e.target.checked)} /> Select all
            </label>
            {checked.size > 0 && <button className="btn btn-complete" onClick={reconcileSelected} style={{ fontSize: 12, padding: "4px 10px" }}>Reconcile {checked.size} selected</button>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "6px 8px", width: 32 }}/>
                {["Date","Description","Category","Amount",""].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Amount" ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {unreconciled.map(t => (
                  <tr key={t.id} style={{ borderBottom: "0.5px solid var(--border-subtle)" }}>
                    <td style={{ padding: "7px 8px" }}><input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)} /></td>
                    <td style={{ padding: "7px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                    <td style={{ padding: "7px 8px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                    <td style={{ padding: "7px 8px" }}><span style={{ fontSize: 11, background: "var(--bg-raised)", borderRadius: 4, padding: "2px 6px" }}>{t.category}</span></td>
                    <td style={{ padding: "7px 8px", textAlign: "right", ...mono, color: t.type === "income" ? "var(--green)" : "var(--red)" }}>{t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}</td>
                    <td style={{ padding: "7px 8px" }}><button className="btn-sm btn-complete" onClick={() => reconcileOne(t.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Reconcile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }

      {/* Reconciled */}
      {reconciled.length > 0 && <>
        <p style={{ ...sh, marginTop: 18 }}>Reconciled ({reconciled.length})</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Date","Description","Category","Amount",""].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: h === "Amount" ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {reconciled.map(t => (
                <tr key={t.id} style={{ borderBottom: "0.5px solid var(--border-subtle)", opacity: 0.7 }}>
                  <td style={{ padding: "7px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                  <td style={{ padding: "7px 8px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                  <td style={{ padding: "7px 8px" }}><span style={{ fontSize: 11, background: "var(--bg-raised)", borderRadius: 4, padding: "2px 6px" }}>{t.category}</span></td>
                  <td style={{ padding: "7px 8px", textAlign: "right", ...mono, color: t.type === "income" ? "var(--green)" : "var(--red)" }}>{t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}</td>
                  <td style={{ padding: "7px 8px" }}><button className="btn-sm" onClick={() => unreconcileOne(t.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Un-reconcile</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

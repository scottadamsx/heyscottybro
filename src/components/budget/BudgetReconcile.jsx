import { useMemo, useState } from "react";
import { getIncomePayPeriod, formatMoney, formatPeriodLabel, getIncomeDatesInRange, toDateStr } from "../../utils/budgetCalc";
import "./budget.css";

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

  return (
    <div>
      <select value={periodKey} onChange={e => { setPeriodKey(e.target.value); setChecked(new Set()); setSelectAll(false); }}
        style={{ width: "100%", marginBottom: 14, fontSize: 13 }}>
        {periodOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      {/* Summary */}
      <p className="bud-sh bud-sh-tight">Period summary</p>
      <div className="bud-statrow"><span className="bud-sec-13">Expected balance</span><span className="bud-mono" style={{ fontSize: 14, color: "var(--green)" }}>{formatMoney(expected)}</span></div>
      <div className="bud-statrow"><span className="bud-sec-13">Reconciled expenses</span><span className="bud-mono" style={{ fontSize: 14 }}>{formatMoney(reconciledTotal)}</span></div>
      <div className="bud-statrow"><span className="bud-sec-13">Unreconciled expenses</span><span className="bud-mono" style={{ fontSize: 14, color: "var(--orange)" }}>{formatMoney(unreconciledTotal)}</span></div>

      {/* Unreconciled */}
      <p className="bud-sh bud-sh-tight" style={{ marginTop: 18 }}>Unreconciled ({unreconciled.length})</p>
      {unreconciled.length === 0
        ? <p className="bud-muted-13">All clear — everything reconciled.</p>
        : <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selectAll} onChange={e => toggleAll(e.target.checked)} /> Select all
            </label>
            {checked.size > 0 && <button className="btn btn-complete bud-btn-sm" onClick={reconcileSelected}>Reconcile {checked.size} selected</button>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="bud-table bud-table-rec">
              <thead><tr>
                <th style={{ width: 32 }}/>
                {["Date","Description","Category","Amount",""].map(h => (
                  <th key={h} className={h === "Amount" ? "bud-right" : undefined}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {unreconciled.map(t => (
                  <tr key={t.id}>
                    <td><input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)} /></td>
                    <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                    <td className="bud-ellipsis" style={{ maxWidth: 160 }}>{t.description}</td>
                    <td><span className="bud-pill">{t.category}</span></td>
                    <td className="bud-right bud-mono" style={{ color: t.type === "income" ? "var(--green)" : "var(--red)" }}>{t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}</td>
                    <td><button className="btn-sm btn-complete bud-btn-xs" onClick={() => reconcileOne(t.id)}>Reconcile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }

      {/* Reconciled */}
      {reconciled.length > 0 && <>
        <p className="bud-sh bud-sh-tight" style={{ marginTop: 18 }}>Reconciled ({reconciled.length})</p>
        <div style={{ overflowX: "auto" }}>
          <table className="bud-table bud-table-rec">
            <thead><tr>
              {["Date","Description","Category","Amount",""].map(h => (
                <th key={h} className={h === "Amount" ? "bud-right" : undefined}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {reconciled.map(t => (
                <tr key={t.id} style={{ opacity: 0.7 }}>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                  <td className="bud-ellipsis" style={{ maxWidth: 160 }}>{t.description}</td>
                  <td><span className="bud-pill">{t.category}</span></td>
                  <td className="bud-right bud-mono" style={{ color: t.type === "income" ? "var(--green)" : "var(--red)" }}>{t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}</td>
                  <td><button className="btn-sm bud-btn-xs" onClick={() => unreconcileOne(t.id)}>Un-reconcile</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

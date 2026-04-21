import { useMemo } from "react";
import { formatMoney } from "../../utils/plannerUtils";

export default function BudgetVsActual({ projection, recurringBills }) {
  const rows = useMemo(() => {
    const past = projection.filter(m => m.isPast || m.isCurrent);
    if (!past.length) return { categories: [], unexpectedIncome: 0, unexpectedExpenses: 0 };

    // Aggregate per category across the past+current window
    const byCat = {};
    for (const m of past) {
      for (const b of recurringBills) {
        const active = b.startDate && b.startDate.slice(0, 7) <= m.key && (!b.endDate || b.endDate.slice(0, 7) >= m.key);
        if (!active) continue;
        const cat = b.category || "Other";
        byCat[cat] = byCat[cat] || { budgeted: 0, actual: 0 };
        byCat[cat].budgeted += Math.abs(Number(b.amount || 0));
      }
      for (const tx of m.events) {
        const signed = Number(tx.amount || 0);
        if (signed >= 0) continue; // expenses only
        const cat = tx.category || "Other";
        byCat[cat] = byCat[cat] || { budgeted: 0, actual: 0 };
        byCat[cat].actual += Math.abs(signed);
      }
    }

    let unexpectedIncome = 0, unexpectedExpenses = 0;
    for (const m of past) {
      for (const tx of m.events) {
        const signed = Number(tx.amount || 0);
        if (signed > 0) {
          // Income unexpected if no income source would cover it (we don't track income cats here; simple heuristic)
          const linked = tx.fulfills_income_id;
          if (!linked) unexpectedIncome += signed;
        }
      }
    }

    const categories = Object.entries(byCat).map(([cat, v]) => ({
      category: cat,
      budgeted: v.budgeted,
      actual: v.actual,
      delta: v.budgeted - v.actual, // positive = under budget
      ratio: v.budgeted > 0 ? Math.min(v.actual / v.budgeted, 2) : v.actual > 0 ? 1 : 0,
    })).sort((a, b) => b.budgeted - a.budgeted);

    // Unexpected expenses = categories with no budget
    unexpectedExpenses = categories.filter(c => c.budgeted === 0).reduce((s, c) => s + c.actual, 0);

    return { categories, unexpectedIncome, unexpectedExpenses };
  }, [projection, recurringBills]);

  if (!rows.categories.length) {
    return <p className="bud-muted">No past spending to compare yet.</p>;
  }

  return (
    <div className="bud-bva">
      {rows.categories.map(c => {
        const over = c.actual > c.budgeted && c.budgeted > 0;
        const barColor = over ? "var(--bud-red)" : "var(--bud-green)";
        const widthPct = Math.min(c.ratio * 100, 100);
        return (
          <div className="bud-bva-row" key={c.category}>
            <div className="bud-bva-head">
              <span className="bud-bva-cat">{c.category}</span>
              <span className="bud-bva-nums">
                <strong>{formatMoney(c.actual)}</strong>
                <span className="bud-muted"> / {formatMoney(c.budgeted)}</span>
                <span style={{ color: barColor, marginLeft: "0.5rem" }}>
                  {c.delta >= 0 ? "\u2193" : "\u2191"} {formatMoney(Math.abs(c.delta))}
                </span>
              </span>
            </div>
            <div className="bud-bva-track">
              <div className="bud-bva-fill" style={{ width: `${widthPct}%`, background: barColor }} />
              {c.ratio > 1 && <div className="bud-bva-over" style={{ width: `${Math.min((c.ratio - 1) * 100, 100)}%` }} />}
            </div>
          </div>
        );
      })}
      {(rows.unexpectedIncome > 0 || rows.unexpectedExpenses > 0) && (
        <div className="bud-bva-extras">
          {rows.unexpectedIncome > 0 && (
            <div className="bud-bva-extra">
              <span><i className="fa-solid fa-arrow-up" /> Unexpected income</span>
              <strong style={{ color: "var(--bud-green)" }}>+{formatMoney(rows.unexpectedIncome)}</strong>
            </div>
          )}
          {rows.unexpectedExpenses > 0 && (
            <div className="bud-bva-extra">
              <span><i className="fa-solid fa-arrow-down" /> Unexpected expenses</span>
              <strong style={{ color: "var(--bud-red)" }}>-{formatMoney(rows.unexpectedExpenses)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

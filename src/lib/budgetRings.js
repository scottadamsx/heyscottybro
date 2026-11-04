// The four Money rings Scott asked for on 2026-11-04: Groceries,
// Fun/Entertainment, and Gas are category buckets (money set aside; a
// transaction logged to the category lowers what is left), and Bills is
// the fourth bucket, fed by the period's paid bills against the period's
// bills obligation. Pure builder so the math is testable without the UI.
//
// A category ring always appears, even before a budget amount is set:
// Scott's three rings must be present, not conditional on setup. With no
// amount set, the ring shows what was spent and invites setting one.

export const RING_DEFS = [
  { key: "groceries", label: "Groceries", category: "Groceries" },
  { key: "fun", label: "Fun / Entertainment", category: "Entertainment" },
  { key: "gas", label: "Gas", category: "Gas" },
  { key: "bills", label: "Bills", category: null },
];

function ringMath(set, spent) {
  const s = Math.max(0, Number(set) || 0);
  const sp = Math.max(0, Number(spent) || 0);
  return {
    set: s,
    spent: sp,
    remaining: s - sp,
    // Fraction of the ring filled, 0..1. An unset ring with spending
    // reads full; an unset, unspent ring reads empty.
    pct: s > 0 ? Math.min(sp / s, 1) : (sp > 0 ? 1 : 0),
    over: s > 0 && sp > s,
    hasSet: s > 0,
  };
}

export function buildRings(transactions, config, period, billsPaid = 0, billsObligation = 0) {
  const budgets = (config && config.categoryBudgets) || {};
  const inPeriod = (transactions || []).filter(
    (t) => t && t.type === "expense" && t.date >= period.start && t.date <= period.end
  );
  const spentFor = (category) =>
    inPeriod.filter((t) => t.category === category).reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return RING_DEFS.map((def) => {
    if (def.category === null) {
      return { ...def, ...ringMath(billsObligation, billsPaid), editable: false };
    }
    return { ...def, ...ringMath(budgets[def.category], spentFor(def.category)), editable: true };
  });
}

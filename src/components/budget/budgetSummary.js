// ── Single source of truth for budget data shape + headline numbers ──────────
//
// Both the Budget page (BudgetDashboard) and the home Dashboard widget
// (DashboardPage) read the same two stores — budget_config + the transactions
// table — and must show the SAME numbers. To guarantee that, they:
//   1. normalise the raw API data identically (apiToPage + uiShape), and
//   2. derive every headline figure from ONE function (computeBudgetSnapshot),
//      which itself wraps the canonical pure helpers in budgetCalc.js.
//
// If you need a budget total on a new surface, call computeBudgetSnapshot —
// never re-derive it inline, or the two screens drift apart again.

import {
  toDateStr, parseDate,
  getIncomePayPeriod, computePeriodTotals, computeWeeklyAllowance,
  savingsPerPeriod, getBillDatesInRange, getPeriodBills,
} from "../../utils/budgetCalc";

// Page-shape default config (income/paySchedule/… as the budget UI expects it).
export const DEFAULT_CONFIG = {
  categories: ["Housing", "Groceries", "Transportation", "Utilities", "Entertainment", "Dining Out", "Personal", "Subscriptions", "Health", "Savings", "Other"],
  income: [],
  paySchedule: { type: "biweekly", anchorDate: toDateStr(), customDays: null },
  recurringBills: [],
  categoryBudgets: {},
  savingsGoals: [],
  taxRate: 0.18,
};

// Translate the API config shape (incomeSources, …) → the page shape (income, …).
export function apiToPage(cfg = {}) {
  return {
    categories: cfg.categories ?? DEFAULT_CONFIG.categories,
    income: cfg.incomeSources ?? [],
    recurringBills: cfg.recurringBills ?? [],
    categoryBudgets: cfg.categoryBudgets ?? {},
    savingsGoals: cfg.savingsGoals ?? [],
    paySchedule: cfg.paySchedule ?? DEFAULT_CONFIG.paySchedule,
    taxRate: cfg.taxRate ?? DEFAULT_CONFIG.taxRate,
  };
}

// The transactions table stores SIGNED amounts (expenses negative); the budget
// UI works in positive amount + type. Normalise on read so every consumer sees
// the same shape.
export function uiShape(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Math.abs(Number(row.amount) || 0),
    type: row.type,
    category: row.category,
    date: row.date,
    notes: row.notes ?? "",
    reconciled: row.reconciled ?? false,
    is_bill: row.is_bill ?? false,
    fulfills_recurring_id: row.fulfills_recurring_id ?? null,
    fulfills_income_id: row.fulfills_income_id ?? null,
  };
}

// THE shared calculation. Given normalised config + transactions, returns every
// headline figure both budget surfaces display, all scoped to one pay period.
// transactions must already be uiShape-normalised; config must be apiToPage-shaped.
export function computeBudgetSnapshot(config, transactions, dateStr = toDateStr(), periodOffset = 0) {
  const period = getIncomePayPeriod(config, dateStr, periodOffset);
  const totals = computePeriodTotals(transactions, config, period); // incomeTotal, spent, billsTotal, remaining, periodTx, …
  const weekly = computeWeeklyAllowance(transactions, config, period);
  const currentWeek = weekly.weeks.find((w) => w.isCurrent) || null;
  const savingsThisPeriod = savingsPerPeriod(config, dateStr);
  const afterSavings = totals.remaining - savingsThisPeriod;

  // Card breakdown shared by both surfaces (the Budget page and the home
  // Dashboard widget): split this period's fixed bills into paid vs total
  // obligation, and split logged spend into non-bill vs Savings. Derived here —
  // not inline in a component — so the two screens can never disagree.
  const fixedBills = getPeriodBills(transactions, config, period).filter((b) => !b.variable);
  const billsPaid = fixedBills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0);
  const billsObligation = fixedBills.reduce((s, b) => s + b.amount, 0);
  const fixedBillTxIds = new Set(fixedBills.map((b) => b.matchedTxId).filter(Boolean));
  const saved = totals.periodTx.filter((t) => t.type === "expense" && t.category === "Savings").reduce((s, t) => s + t.amount, 0);
  const spentNonBill = totals.periodTx.filter((t) => t.type === "expense" && !fixedBillTxIds.has(t.id) && t.category !== "Savings").reduce((s, t) => s + t.amount, 0);

  return { period, ...totals, weekly, currentWeek, savingsThisPeriod, afterSavings, billsPaid, billsObligation, saved, spentNonBill };
}

// Forward-looking unpaid/scheduled bills for the home Dashboard's "Upcoming
// bills" list. Uses the SAME scheduling model as the rest of the budget
// (frequency + startDate via getBillDatesInRange) — not a `dueDay` field, which
// bills don't have. `paid` uses the same explicit-link-then-fuzzy match the
// pay-period bill list uses, so a paid bill reads consistently on both screens.
export function getUpcomingBills(config, transactions, dateStr = toDateStr(), limit = 6) {
  const startDt = parseDate(dateStr);
  const start = toDateStr(startDt);
  const end = toDateStr(new Date(startDt.getFullYear(), startDt.getMonth() + 3, startDt.getDate()));
  const rows = [];
  (config.recurringBills || []).forEach((bill) => {
    if (bill.variable) return; // variable bills are spending envelopes, not dated obligations
    getBillDatesInRange(bill, start, end).forEach((due) => {
      const paid = (transactions || []).some((t) =>
        t.type === "expense" && (t.date || "").slice(0, 7) === due.slice(0, 7) && (
          t.fulfills_recurring_id === bill.id ||
          ((t.description || "").toLowerCase().includes((bill.name || "").toLowerCase()) &&
            Math.abs(t.amount - bill.amount) < 1 &&
            Math.abs((parseDate(t.date) - parseDate(due)) / 86400000) <= 3)
        )
      );
      rows.push({ id: bill.id, name: bill.name, amount: bill.amount, category: bill.category, due, paid, autoPay: !!bill.autoPay });
    });
  });
  return rows.sort((a, b) => a.due.localeCompare(b.due)).slice(0, limit);
}

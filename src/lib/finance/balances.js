// ════════════════════════════════════════════════════════════
//  Canonical money model — THE single source of truth.
//  Pure functions over already-fetched rows (integer cents).
//  Mirrors the spec's compute_dashboard(); used everywhere so
//  no template/component ever does its own money math.
//
//  Anchor model (no double counting):
//    current_cash = opening_balance
//                 + received income since anchor
//                 - expenses since anchor
//                 - bills PAID since anchor
//    available    = current_cash + future_income(horizon)
//                 - unpaid_bills(horizon) - reserved_savings
//
//  Refinement vs spec: the savings reserve pool counts RECEIVED
//  income only — you can't set aside money you haven't been paid.
// ════════════════════════════════════════════════════════════

// Format as the LOCAL calendar day. toISOString() reports the UTC day, which
// is off by one in UTC+ timezones (e.g. addDays("2026-06-10", 7) would have
// returned "2026-06-16").
const iso = (d) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sum = (rows, pick) => rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
}

/**
 * @param {object} data  { settings, income, expenses, billInstances, savingsGoals, savingsAllocations }
 * @param {object} [opts] { today, horizonDays }
 */
export function computeDashboard(data, opts = {}) {
  const {
    settings = {},
    income = [],
    expenses = [],
    billInstances = [],
    savingsGoals = [],
    savingsAllocations = [],
  } = data || {};

  const today = iso(opts.today || new Date());
  const anchor = iso(settings.anchor_date || today);
  const horizonDays = opts.horizonDays ?? settings.future_income_horizon_days ?? 30;
  const horizon = addDays(today, horizonDays);
  const opening = Number(settings.opening_balance || 0);

  // ── Money already in the account since the anchor ──
  const receivedIncome = sum(
    income.filter((i) => i.received && iso(i.pay_date) > anchor && iso(i.pay_date) <= today),
    (i) => i.amount,
  );
  const expensesToDate = sum(
    expenses.filter((e) => iso(e.date) > anchor && iso(e.date) <= today),
    (e) => e.amount,
  );
  const billsPaid = sum(
    billInstances.filter((b) => b.paid && b.paid_date && iso(b.paid_date) > anchor && iso(b.paid_date) <= today),
    (b) => b.amount,
  );
  const currentCash = opening + receivedIncome - expensesToDate - billsPaid;

  // ── Forward-looking (within horizon) ──
  const futureIncome = sum(
    income.filter((i) => !i.received && iso(i.pay_date) <= horizon),
    (i) => i.amount,
  );
  const unpaidBills = sum(
    billInstances.filter((b) => !b.paid && iso(b.due_date) <= horizon),
    (b) => b.amount,
  );

  // reserve pool = reserved from RECEIVED income − pool-sourced allocations
  const reservePool =
    sum(income.filter((i) => i.received), (i) => i.savings_reserved) -
    sum(savingsAllocations.filter((a) => a.source === "pool"), (a) => a.amount);
  const inGoals = sum(savingsGoals, (g) => g.current_amount);
  const reservedSavings = Math.max(0, reservePool) + inGoals;

  const availableToSpend = currentCash + futureIncome - unpaidBills - reservedSavings;

  return {
    currentCash,
    futureIncome,
    billsRemaining: unpaidBills,
    reservedSavings,
    reservePool: Math.max(0, reservePool),
    availableToSpend,
    horizon,
    today,
  };
}

/** Bill instance state for badges. */
export function billState(bill, today = iso(new Date())) {
  if (bill.paid) return "paid";
  const due = iso(bill.due_date);
  if (due < today) return "overdue";
  if (due <= addDays(today, 7)) return "due_soon";
  return "upcoming";
}

/**
 * Recent transactions = derived union of received income, expenses, and paid
 * bills (NOT a separate table). Returns newest first, signed cents.
 */
export function recentTransactions(data, limit = 8) {
  const { income = [], expenses = [], billInstances = [] } = data || {};
  const rows = [
    ...income.filter((i) => i.received).map((i) => ({
      id: "inc-" + i.id, date: iso(i.pay_date), label: i.source || "Income",
      kind: "income", amount: Number(i.amount),
    })),
    ...expenses.map((e) => ({
      id: "exp-" + e.id, date: iso(e.date), label: e.description || "Expense",
      kind: "expense", amount: -Number(e.amount),
    })),
    ...billInstances.filter((b) => b.paid).map((b) => ({
      id: "bill-" + b.id, date: iso(b.paid_date || b.due_date), label: b.name,
      kind: "bill", amount: -Number(b.amount),
    })),
  ];
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return limit ? rows.slice(0, limit) : rows;
}

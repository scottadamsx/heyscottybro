// ── Pure budget calculation utilities ─────────────────────────────

export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatMoney(amount) {
  const a = Math.abs(amount).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amount < 0 ? "-$" : "$") + a;
}

export function formatMoneyAbs(amount) {
  return "$" + Math.abs(amount).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getPayPeriod(dateStr, offset = 0, paySchedule) {
  const d = parseDate(dateStr);
  const sched = paySchedule || {};
  const type = sched.type || "biweekly";
  const anchor = parseDate(sched.anchorDate || toDateStr());
  let start, end;

  if (type === "semimonthly") {
    if (d.getDate() < 15) {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth(), 14);
    } else {
      start = new Date(d.getFullYear(), d.getMonth(), 15);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    for (let i = 0; i < Math.abs(offset); i++) {
      if (offset > 0) {
        const next = new Date(end); next.setDate(next.getDate() + 1);
        if (next.getDate() < 15) { start = new Date(next.getFullYear(), next.getMonth(), 1); end = new Date(next.getFullYear(), next.getMonth(), 14); }
        else { start = new Date(next.getFullYear(), next.getMonth(), 15); end = new Date(next.getFullYear(), next.getMonth() + 1, 0); }
      } else {
        const prev = new Date(start); prev.setDate(prev.getDate() - 1);
        if (prev.getDate() < 15) { start = new Date(prev.getFullYear(), prev.getMonth(), 1); end = new Date(prev.getFullYear(), prev.getMonth(), 14); }
        else { start = new Date(prev.getFullYear(), prev.getMonth(), 15); end = new Date(prev.getFullYear(), prev.getMonth() + 1, 0); }
      }
    }
  } else if (type === "monthly") {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    if (offset !== 0) { start = new Date(start.getFullYear(), start.getMonth() + offset, 1); end = new Date(start.getFullYear(), start.getMonth() + 1, 0); }
  } else {
    const interval = type === "weekly" ? 7 : type === "custom" ? (sched.customDays || 14) : 14;
    const daysSince = Math.floor((d - anchor) / 86400000);
    let periodNum = Math.floor(daysSince / interval) + offset;
    start = new Date(anchor); start.setDate(start.getDate() + periodNum * interval);
    end = new Date(start); end.setDate(end.getDate() + interval - 1);
  }
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function formatPeriodLabel(start, end) {
  const s = parseDate(start), e = parseDate(end);
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${mo[s.getMonth()]} ${s.getDate()} – ${mo[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

// The pay period Scott actually lives in: from a payday to the day before the
// next payday, derived from his configured income sources (Bills & Income).
// offset moves whole pay periods (−1 = previous). Falls back to the calendar
// month when there isn't enough income data to find two paydays.
export function getIncomePayPeriod(config, dateStr = toDateStr(), offset = 0) {
  const ref = parseDate(dateStr);
  const p = (n) => String(n).padStart(2, "0");
  // Build a wide window of paydays around the reference date.
  const wStart = toDateStr(new Date(ref.getFullYear(), ref.getMonth() - 4, 1));
  const wEnd = toDateStr(new Date(ref.getFullYear(), ref.getMonth() + 5, 0));
  let paydays = [];
  (config.income || []).forEach((inc) => { paydays.push(...getIncomeDatesInRange(inc, wStart, wEnd)); });
  paydays = [...new Set(paydays)].sort();

  if (paydays.length >= 2) {
    let idx = 0;
    for (let i = 0; i < paydays.length; i++) { if (paydays[i] <= dateStr) idx = i; else break; }
    idx = Math.max(0, Math.min(idx + offset, paydays.length - 2));
    const start = paydays[idx];
    const nextPay = paydays[idx + 1];
    const end = toDateStr(new Date(parseDate(nextPay).getTime() - 86400000)); // day before next payday
    return { start, end, payday: start, nextPayday: nextPay };
  }

  // Fallback: the calendar month (always contains the user's data).
  const d = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { start: `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`, end: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(last)}`, fallback: true };
}

export function getBillDatesInRange(bill, startStr, endStr) {
  const startRange = parseDate(startStr), endRange = parseDate(endStr);
  const dates = [], freq = bill.frequency || "monthly";
  const startDt = parseDate(bill.startDate || toDateStr());
  if (freq === "monthly") {
    let scan = new Date(startDt);
    for (let i = 0; i < 24; i++) {
      if (scan > endRange) break;
      if (scan >= startRange) dates.push(toDateStr(scan));
      const expectedMonth = (startDt.getMonth() + i + 1) % 12;
      scan.setMonth(scan.getMonth() + 1);
      if (scan.getMonth() !== expectedMonth) scan.setDate(0);
    }
  } else if (freq === "weekly") {
    let cur = new Date(startDt);
    while (cur <= endRange) { if (cur >= startRange) dates.push(toDateStr(cur)); cur.setDate(cur.getDate() + 7); }
  } else if (freq === "biweekly") {
    let cur = new Date(startDt);
    while (cur <= endRange) { if (cur >= startRange) dates.push(toDateStr(cur)); cur.setDate(cur.getDate() + 14); }
  } else if (freq === "yearly") {
    let cur = new Date(startDt);
    while (cur <= endRange) {
      if (cur >= startRange) dates.push(toDateStr(cur));
      const em = cur.getMonth(); cur.setFullYear(cur.getFullYear() + 1);
      if (cur.getMonth() !== em) cur.setDate(0);
    }
  }
  return dates;
}

export function getIncomeDatesInRange(inc, startStr, endStr) {
  const start = parseDate(startStr), end = parseDate(endStr);
  const dates = [], freq = inc.frequency || "biweekly";
  // startDate is the canonical anchor (replaces legacy nextDate)
  const anchor = parseDate(inc.startDate || inc.nextDate || toDateStr());
  const interval = freq === "weekly" ? 7 : freq === "monthly" ? 30 : freq === "semimonthly" ? 15 : 14;

  // Active window: income only applies between its own startDate and endDate.
  const activeFrom = inc.startDate ? parseDate(inc.startDate) : null;
  const activeTo   = inc.endDate   ? parseDate(inc.endDate)   : null;

  const inActiveWindow = d =>
    (!activeFrom || d >= activeFrom) && (!activeTo || d <= activeTo);

  if (freq === "semimonthly") {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < 14; i++) {
      const d1 = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const d15 = new Date(cur.getFullYear(), cur.getMonth(), 15);
      if (d1 >= start && d1 <= end && inActiveWindow(d1)) dates.push(toDateStr(d1));
      if (d15 >= start && d15 <= end && inActiveWindow(d15)) dates.push(toDateStr(d15));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (freq === "monthly") {
    const day = anchor.getDate();
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < 14; i++) {
      const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      const d = new Date(cur.getFullYear(), cur.getMonth(), Math.min(day, lastDay));
      if (d >= start && d <= end && inActiveWindow(d)) dates.push(toDateStr(d));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    let cur = new Date(anchor);
    while (cur > start) cur.setDate(cur.getDate() - interval);
    while (cur <= end) {
      if (cur >= start && inActiveWindow(cur)) dates.push(toDateStr(cur));
      cur.setDate(cur.getDate() + interval);
    }
  }
  return dates;
}

export function computePeriodTotals(transactions, config, period) {
  const periodTx = transactions.filter(t => t.date >= period.start && t.date <= period.end);

  // Two income sources: actual logged transactions vs the configured schedule.
  // Never add both — that double-counts when a user logs their paycheque while
  // also having income sources configured. Logged income takes precedence; fall
  // back to scheduled only when no income has been logged for the period.
  const loggedIncome = periodTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  let scheduledIncome = 0;
  (config.income || []).forEach(inc => {
    const dates = getIncomeDatesInRange(inc, period.start, period.end);
    scheduledIncome += dates.length * inc.amount;
  });
  const incomeTotal = loggedIncome > 0 ? loggedIncome : scheduledIncome;

  const spent = periodTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  let billsTotal = 0;
  (config.recurringBills || []).forEach(bill => {
    if (bill.variable) return; // variable bills are tracked as spending, not a fixed obligation
    getBillDatesInRange(bill, period.start, period.end).forEach(bd => {
      const alreadyLogged = periodTx.some(t =>
        t.type === "expense" &&
        t.description.toLowerCase().includes(bill.name.toLowerCase()) &&
        Math.abs(t.amount - bill.amount) < 1 &&
        Math.abs((parseDate(t.date) - parseDate(bd)) / 86400000) <= 3
      );
      if (!alreadyLogged) billsTotal += bill.amount;
    });
  });
  const remaining = incomeTotal - spent - billsTotal;
  return { incomeTotal, scheduledIncome, loggedIncome, spent, billsTotal, remaining, periodTx };
}

// Savings goals: spread a future purchase across the paychecks before its date.
// For each goal, perPeriod = (target − saved) / paychecks remaining until the
// target date — i.e. how much extra to set aside THIS paycheque to hit the goal.
export function savingsPlan(config, dateStr = toDateStr()) {
  const goals = config.savingsGoals || [];
  return goals.map(g => {
    const target = Number(g.target) || 0;
    const saved = Number(g.saved) || 0;
    const remaining = Math.max(0, target - saved);
    let periodsLeft = 0;
    if (g.targetDate && g.targetDate >= dateStr) {
      const dates = [];
      (config.income || []).forEach(inc => dates.push(...getIncomeDatesInRange(inc, dateStr, g.targetDate)));
      periodsLeft = new Set(dates).size;
    }
    const done = remaining <= 0;
    const perPeriod = done ? 0 : (periodsLeft > 0 ? remaining / periodsLeft : remaining);
    return { id: g.id, name: g.name, target, saved, targetDate: g.targetDate, remaining, periodsLeft, perPeriod, done };
  });
}

export function savingsPerPeriod(config, dateStr = toDateStr()) {
  return savingsPlan(config, dateStr).reduce((s, g) => s + g.perPeriod, 0);
}

// Month-to-date spend per category for a given month (YYYY-MM). Used by the
// monthly category budgets (variable envelopes like Groceries / Gas / Toiletries).
export function monthlyCategorySpend(transactions, monthKey) {
  const m = {};
  transactions.forEach(t => {
    if (t.type !== "expense" || !t.date || t.date.slice(0, 7) !== monthKey) return;
    m[t.category] = (m[t.category] || 0) + t.amount;
  });
  return m;
}

// Quantifiable / variable spending envelopes (Groceries, Gas, an allowance like
// "Maria"…): a category gets a monthly budget either from config.categoryBudgets
// OR from a recurring bill flagged `variable`. Returns each one with its budget
// and month-to-date spend so the dashboard can draw a progress bar instead of a
// paid/unpaid badge. `editable` is true only for plain category budgets (the
// dashboard can edit those inline; bill-sourced ones are edited in Bills & Income).
export function getQuantifiableBudgets(transactions, config, period) {
  const cb = config.categoryBudgets || {};
  const spend = {};
  transactions.forEach(t => {
    if (t.type !== "expense" || t.date < period.start || t.date > period.end) return;
    spend[t.category] = (spend[t.category] || 0) + t.amount;
  });
  return Object.keys(cb).filter(c => cb[c] > 0).sort((a, b) => a.localeCompare(b)).map(c => ({
    category: c, budget: cb[c], spent: spend[c] || 0, editable: true,
  }));
}

// Every bill that falls in the period, tagged with whether a transaction covers
// it. A transaction counts as a bill payment if it's explicitly linked
// (fulfills_recurring_id), if it fuzzily matches a recurring bill (legacy), or
// if the user flagged it as a bill (is_bill). Returns the bill rows, how many
// are paid, and the set of transaction ids that are bill payments (so weekly
// spending can exclude them).
export function getPeriodBills(transactions, config, period) {
  const periodTx = transactions.filter(t => t.date >= period.start && t.date <= period.end);
  const used = new Set();
  const scheduled = [];
  const variableRows = [];
  // Transactions explicitly tagged to a variable bill (via the "Pays a bill?"
  // link) — these are the ONLY ones counted toward it, so loosely-categorized
  // "Other" spending never leaks into a specific budget.
  const variableBillIds = new Set((config.recurringBills || []).filter(b => b.variable).map(b => b.id));

  (config.recurringBills || []).forEach(bill => {
    if (bill.variable) {
      // Variable bill: spend = transactions explicitly linked to THIS bill only.
      const spent = periodTx
        .filter(t => t.type === "expense" && t.fulfills_recurring_id === bill.id)
        .reduce((s, t) => s + t.amount, 0);
      variableRows.push({
        billId: bill.id, name: bill.name, amount: bill.amount, budget: bill.amount,
        category: bill.category, variable: true, spent, recurring: true,
        date: period.start, paid: spent >= bill.amount, matchedTxId: null,
      });
      return;
    }
    getBillDatesInRange(bill, period.start, period.end).forEach(bd => {
      // Prefer an explicit link, then fall back to a fuzzy name+amount+date match.
      let match = periodTx.find(t => !used.has(t.id) && t.fulfills_recurring_id === bill.id);
      if (!match) {
        match = periodTx.find(t =>
          !used.has(t.id) &&
          t.type === "expense" &&
          t.description.toLowerCase().includes(bill.name.toLowerCase()) &&
          Math.abs(t.amount - bill.amount) < 1 &&
          Math.abs((parseDate(t.date) - parseDate(bd)) / 86400000) <= 5
        );
      }
      if (match) used.add(match.id);
      scheduled.push({
        billId: bill.id, name: bill.name, amount: bill.amount,
        category: bill.category, autoPay: !!bill.autoPay, date: bd,
        recurring: true, paid: !!match, matchedTxId: match?.id ?? null,
      });
    });
  });

  // One-off is_bill transactions: transactions the user flagged that don't match
  // any scheduled recurring bill. They are excluded from discretionary spending
  // (via billTxIds) but are NOT shown as separate bill rows in the dashboard —
  // that would surface every "Costco run" as a bill line item, which is wrong.
  // One-off is_bill / linked transactions that don't match a scheduled fixed
  // bill. Variable-bill-linked spend is excluded here so it still counts as
  // normal discretionary spending in the weekly allowance.
  const oneOffIds = new Set(
    periodTx
      .filter(t => t.type === "expense" && (t.is_bill || t.fulfills_recurring_id) && !used.has(t.id) && !variableBillIds.has(t.fulfills_recurring_id))
      .map(t => t.id)
  );

  const fixed = [...scheduled].sort((a, b) => a.date.localeCompare(b.date));
  const variable = variableRows.sort((a, b) => a.name.localeCompare(b.name));
  const bills = [...fixed, ...variable];
  const billTxIds = new Set([
    ...fixed.map(b => b.matchedTxId).filter(Boolean),
    ...oneOffIds,
  ]);
  // paidCount / total describe the FIXED bills (the "N of M paid" header);
  // variable bills are progress bars, not paid/unpaid.
  return { bills, fixed, variable, paidCount: fixed.filter(b => b.paid).length, total: fixed.length, billTxIds };
}

// Splits the pay period into 7-day weeks and computes a spending allowance per
// week, rolling unspent money (or overspend) forward. "Spendable" is income
// minus all bills (paid or not) minus planned purchases; discretionary spend is
// every expense that isn't a bill payment.
export function computeWeeklyAllowance(transactions, config, period) {
  const { scheduledIncome, loggedIncome } = computePeriodTotals(transactions, config, period);
  // Weekly allowance is a planning tool: use the scheduled income (what the
  // income sources say you'll have). Fall back to logged income if no sources
  // are configured (e.g. one-time jobs or self-employed irregular income).
  const incomeForPlanning = scheduledIncome > 0 ? scheduledIncome : loggedIncome;
  const { bills, billTxIds } = getPeriodBills(transactions, config, period);
  // Only FIXED bills are a hard obligation; variable spend comes out of the
  // weekly allowance as normal discretionary spending.
  const billsObligation = bills.filter(b => !b.variable).reduce((s, b) => s + b.amount, 0);
  const savings = savingsPerPeriod(config);
  const spendable = incomeForPlanning - billsObligation - savings;

  const start = parseDate(period.start), end = parseDate(period.end);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const numWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const weeklyBase = spendable / numWeeks;
  const today = toDateStr();

  let carry = 0;
  const weeks = [];
  for (let i = 0; i < numWeeks; i++) {
    const ws = new Date(start); ws.setDate(ws.getDate() + i * 7);
    let we = new Date(ws); we.setDate(we.getDate() + 6);
    if (we > end) we = new Date(end);
    const wsStr = toDateStr(ws), weStr = toDateStr(we);
    const spent = transactions
      .filter(t => t.type === "expense" && !billTxIds.has(t.id) && t.date >= wsStr && t.date <= weStr)
      .reduce((s, t) => s + t.amount, 0);
    const allowance = weeklyBase + carry;
    const remaining = allowance - spent;
    weeks.push({
      index: i + 1, start: wsStr, end: weStr,
      base: weeklyBase, carryIn: carry, allowance, spent, remaining,
      isCurrent: today >= wsStr && today <= weStr,
      isPast: weStr < today,
    });
    carry = remaining; // roll leftover (or overspend) into next week
  }
  return { spendable, weeklyBase, numWeeks, billsObligation, incomeForPlanning, savings, weeks };
}

export function genId() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
}

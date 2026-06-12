import { getPayPeriod } from "./budgetCalc";

function periodLabel(start, end) {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sm = s.toLocaleDateString([], { month: "short" });
  const em = e.toLocaleDateString([], { month: "short" });
  return sm === em
    ? `${sm} ${s.getDate()}–${e.getDate()}`
    : `${sm} ${s.getDate()}–${em} ${e.getDate()}`;
}

/** Returns the last `numPeriods` pay periods with income/spending/category breakdowns. */
export function getPeriodHistory(transactions, config, numPeriods = 6) {
  if (!config?.paySchedule) return [];
  const today = new Date().toLocaleDateString("en-CA");
  const result = [];
  for (let i = numPeriods - 1; i >= 0; i--) {
    const p = getPayPeriod(today, -i, config.paySchedule);
    const inPeriod = transactions.filter(t => t.date >= p.start && t.date <= p.end);
    const income = inPeriod.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const spending = inPeriod.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const categories = {};
    inPeriod.filter(t => t.type === "expense").forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    result.push({
      start: p.start,
      end: p.end,
      label: periodLabel(p.start, p.end),
      income: Math.round(income * 100) / 100,
      spending: Math.round(spending * 100) / 100,
      net: Math.round((income - spending) * 100) / 100,
      categories,
      txCount: inPeriod.length,
    });
  }
  return result;
}

/** Returns per-category trend data from period history, filtered to categories with any spend. */
export function getCategoryTrends(periodHistory, allCategories) {
  if (!periodHistory.length) return [];
  return allCategories
    .map(cat => {
      const values = periodHistory.map(p => Math.round((p.categories[cat] || 0) * 100) / 100);
      if (!values.some(v => v > 0)) return null;
      const nonZero = values.filter(v => v > 0);
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      const last = values[values.length - 1];
      const prev = values[values.length - 2] ?? last;
      const pctChange = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      const trend = Math.abs(pctChange) < 8 ? "stable" : pctChange > 0 ? "up" : "down";
      return {
        category: cat,
        values,
        avg: Math.round(avg * 100) / 100,
        last,
        projected: Math.round(avg * 100) / 100,
        trend,
        pctChange: Math.round(pctChange * 10) / 10,
      };
    })
    .filter(Boolean);
}

/** Returns the amount from the most recently logged income transaction. */
export function getLastIncome(transactions) {
  const sorted = [...transactions]
    .filter(t => t.type === "income")
    .sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0]?.amount ?? 0;
}

/**
 * Projects the next period using:
 * - Income: lastIncome (from most recent paycheck) or avg of last 3 periods
 * - Spending: average of last 3 periods per category
 */
export function projectNextPeriod(periodHistory, lastIncome) {
  if (!periodHistory.length) return { income: lastIncome, spending: 0, categories: {}, net: lastIncome };
  const n = Math.min(3, periodHistory.length);
  const recent = periodHistory.slice(-n);
  const periodsWithIncome = recent.filter(p => p.income > 0);
  const avgIncome = periodsWithIncome.length
    ? periodsWithIncome.reduce((s, p) => s + p.income, 0) / periodsWithIncome.length
    : 0;
  const assumedIncome = lastIncome || avgIncome;
  const avgSpending = recent.reduce((s, p) => s + p.spending, 0) / n;
  const categories = {};
  recent.forEach(p => {
    Object.entries(p.categories).forEach(([cat, amt]) => {
      categories[cat] = (categories[cat] || 0) + amt / n;
    });
  });
  Object.keys(categories).forEach(k => { categories[k] = Math.round(categories[k] * 100) / 100; });
  return {
    income: Math.round(assumedIncome * 100) / 100,
    spending: Math.round(avgSpending * 100) / 100,
    categories,
    net: Math.round((assumedIncome - avgSpending) * 100) / 100,
  };
}

/** Returns transactions sorted by date with a running balance applied to each row. */
export function getLedgerRows(transactions, startingBalance = 0) {
  const sorted = [...transactions].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : (a.id || "").localeCompare(b.id || "");
  });
  let balance = startingBalance;
  return sorted.map(t => {
    if (t.type === "income") balance += t.amount;
    else balance -= t.amount;
    return { ...t, runningBalance: Math.round(balance * 100) / 100 };
  });
}

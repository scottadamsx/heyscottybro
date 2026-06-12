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
  const nextDate = parseDate(inc.nextDate || toDateStr());
  const interval = freq === "weekly" ? 7 : freq === "monthly" ? 30 : freq === "semimonthly" ? 15 : 14;

  if (freq === "semimonthly") {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < 14; i++) {
      const d1 = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const d15 = new Date(cur.getFullYear(), cur.getMonth(), 15);
      if (d1 >= start && d1 <= end) dates.push(toDateStr(d1));
      if (d15 >= start && d15 <= end) dates.push(toDateStr(d15));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (freq === "monthly") {
    const day = nextDate.getDate();
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < 14; i++) {
      const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      const d = new Date(cur.getFullYear(), cur.getMonth(), Math.min(day, lastDay));
      if (d >= start && d <= end) dates.push(toDateStr(d));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    let cur = new Date(nextDate);
    while (cur > start) cur.setDate(cur.getDate() - interval);
    while (cur <= end) { if (cur >= start) dates.push(toDateStr(cur)); cur.setDate(cur.getDate() + interval); }
  }
  return dates;
}

export function computePeriodTotals(transactions, config, period) {
  const periodTx = transactions.filter(t => t.date >= period.start && t.date <= period.end);
  let incomeTotal = 0;
  (config.income || []).forEach(inc => {
    const dates = getIncomeDatesInRange(inc, period.start, period.end);
    incomeTotal += dates.length * inc.amount;
  });
  incomeTotal += periodTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const spent = periodTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const planned = periodTx.filter(t => t.type === "future").reduce((s, t) => s + t.amount, 0);
  let billsTotal = 0;
  (config.recurringBills || []).forEach(bill => {
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
  const remaining = incomeTotal - spent - billsTotal - planned;
  return { incomeTotal, spent, billsTotal, planned, remaining, periodTx };
}

export function genId() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
}

// Pure projection engine — no React, no Supabase. Unit-testable in isolation.

export function ym(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function defaultHorizon(start = "2026-04", months = 9) {
  const [sy, sm] = start.split("-").map(Number);
  const out = [];
  for (let i = 0; i < months; i++) {
    const y = sy + Math.floor((sm - 1 + i) / 12);
    const m = ((sm - 1 + i) % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function phaseOf(monthKey) {
  if (monthKey < "2026-05") return "pre";
  if (monthKey <= "2026-08") return "phase1";
  return "phase2";
}

function isActiveInMonth(source, monthKey) {
  if (source.startDate && ym(source.startDate) > monthKey) return false;
  if (source.endDate && ym(source.endDate) < monthKey) return false;
  return true;
}

// Normalize a transaction's amount to a signed number.
// DB convention (new): expense negative, income positive. "future" rows are
// planned spend, so they're negative too. Older rows may be unsigned; we fix them here.
function signedAmount(tx) {
  let n = Number(tx.amount || 0);
  if ((tx.type === "expense" || tx.type === "future") && n > 0) n = -n;
  if (tx.type === "income" && n < 0) n = Math.abs(n);
  return n;
}

// For a given source, check whether any transaction in `monthTxs` fulfills it.
// Returns { fulfilled, implicit, txId } — implicit=true means matched by heuristic, not explicit link.
export function fulfillmentStatus(source, kind, monthTxs) {
  const idField = kind === "income" ? "fulfills_income_id" : "fulfills_recurring_id";

  // 1. Explicit link
  const explicit = monthTxs.find(t => t[idField] && t[idField] === source.id);
  if (explicit) return { fulfilled: true, implicit: false, txId: explicit.id };

  // 2. Implicit heuristic: same category + amount within ±20%
  const sourceAmount = Math.abs(Number(source.amount || 0));
  if (sourceAmount === 0) return { fulfilled: false };

  const match = monthTxs.find(t => {
    const amt = signedAmount(t);
    if (kind === "income" && amt <= 0) return false;
    if (kind === "recurring" && amt >= 0) return false;
    if (source.category && t.category && t.category !== source.category) return false;
    const diff = Math.abs(Math.abs(amt) - sourceAmount) / sourceAmount;
    return diff <= 0.2;
  });
  if (match) return { fulfilled: true, implicit: true, txId: match.id };

  return { fulfilled: false };
}

export function buildProjection({
  transactions = [],
  incomeSources = [],
  recurringBills = [],
  startingBalance = 0,
  horizonMonths,
  today = new Date(),
}) {
  const months = horizonMonths && horizonMonths.length ? horizonMonths : defaultHorizon();
  const todayYM = ym(today);

  // Normalize signs once
  const normalized = transactions.map(t => ({ ...t, _signed: signedAmount(t) }));

  let balance = Number(startingBalance || 0);
  const out = [];

  for (const monthKey of months) {
    const opening = balance;
    const monthTxs = normalized.filter(t => (t.date || "").slice(0, 7) === monthKey);

    const actualIncome = monthTxs
      .filter(t => t._signed > 0 && t.type !== "future")
      .reduce((s, t) => s + t._signed, 0);
    const actualExpenses = monthTxs
      .filter(t => t._signed < 0 && t.type !== "future")
      .reduce((s, t) => s + t._signed, 0); // stays negative
    // Planned ("future") transactions aren't actuals, but they ARE cash flow —
    // they must hit the month's balance or the chart disagrees with the
    // current-balance stat (which includes them once their date passes).
    const plannedNet = monthTxs
      .filter(t => t.type === "future")
      .reduce((s, t) => s + t._signed, 0);

    const isPast = monthKey < todayYM;
    const isCurrent = monthKey === todayYM;
    const isFuture = monthKey > todayYM;

    let projectedIncome = 0;
    let projectedExpenses = 0;
    const unfulfilledIncome = [];
    const unfulfilledBills = [];
    const fulfillments = []; // { source, kind, status }

    // Past months never get projected additions — actuals only.
    if (!isPast) {
      for (const s of incomeSources) {
        if (!isActiveInMonth(s, monthKey)) continue;
        const status = fulfillmentStatus(s, "income", monthTxs);
        fulfillments.push({ source: s, kind: "income", status });
        if (!status.fulfilled) {
          projectedIncome += Number(s.amount || 0);
          unfulfilledIncome.push(s);
        }
      }
      for (const b of recurringBills) {
        if (!isActiveInMonth(b, monthKey)) continue;
        const status = fulfillmentStatus(b, "recurring", monthTxs);
        fulfillments.push({ source: b, kind: "recurring", status });
        if (!status.fulfilled) {
          projectedExpenses += -Math.abs(Number(b.amount || 0));
          unfulfilledBills.push(b);
        }
      }
    } else {
      // Past: still compute fulfillments for retrospective views
      for (const s of incomeSources) {
        if (!isActiveInMonth(s, monthKey)) continue;
        fulfillments.push({ source: s, kind: "income", status: fulfillmentStatus(s, "income", monthTxs) });
      }
      for (const b of recurringBills) {
        if (!isActiveInMonth(b, monthKey)) continue;
        fulfillments.push({ source: b, kind: "recurring", status: fulfillmentStatus(b, "recurring", monthTxs) });
      }
    }

    const income = actualIncome + projectedIncome;
    const expenses = actualExpenses + projectedExpenses;
    const net = income + expenses + plannedNet;
    balance = opening + net;

    out.push({
      key: monthKey,
      label: monthLabel(monthKey),
      phase: phaseOf(monthKey),
      openingBalance: opening,
      actualIncome,
      actualExpenses,
      projectedIncome,
      projectedExpenses,
      plannedNet,
      income,
      expenses,
      net,
      closingBalance: balance,
      isPast,
      isCurrent,
      isFuture,
      events: monthTxs,
      unfulfilledIncome,
      unfulfilledBills,
      fulfillments,
    });
  }

  return out;
}

// "On track / trending X" — compare actual cumulative net against straight-line target.
export function onTrackStatus(projection) {
  if (!projection.length) return { label: "", delta: 0, projectedEnd: 0 };
  const last = projection[projection.length - 1];
  const first = projection[0];
  const target = (first.openingBalance + last.closingBalance) / 2; // midpoint isn't ideal but fine heuristic
  // Find current or last-past month for comparison
  const reference = projection.find(p => p.isCurrent) || [...projection].reverse().find(p => p.isPast) || first;
  const straightLineIndex = projection.indexOf(reference);
  const expectedClose = first.openingBalance + ((last.closingBalance - first.openingBalance) * (straightLineIndex + 1) / projection.length);
  const delta = reference.closingBalance - expectedClose;
  return {
    projectedEnd: last.closingBalance,
    delta,
    reference,
    label: Math.abs(delta) < 100
      ? `On track for ~$${formatK(last.closingBalance)} by ${last.label}`
      : delta > 0
        ? `Trending ~$${formatK(Math.abs(delta))} above plan — ahead of target`
        : `Trending ~$${formatK(Math.abs(delta))} below plan — review ${reference.label}`,
  };
}

function formatK(n) {
  const v = Math.abs(n);
  if (v >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// Generate the prose narrative from projection + seed transactions.
export function narrativeFor(projection) {
  const lines = [];
  for (const m of projection) {
    const parts = [];
    parts.push(`Opens at $${fmt(m.openingBalance)}.`);
    for (const tx of m.events) {
      const signed = signedAmount(tx);
      const sign = signed >= 0 ? "+" : "-";
      parts.push(`${tx.description} (${sign}$${fmt(Math.abs(signed))}).`);
    }
    if (!m.isPast) {
      if (m.projectedIncome > 0) parts.push(`Projected income +$${fmt(m.projectedIncome)}.`);
      if (m.projectedExpenses < 0) parts.push(`Projected bills -$${fmt(Math.abs(m.projectedExpenses))}.`);
    }
    parts.push(`Closes at ${m.closingBalance < 0 ? "-" : ""}$${fmt(Math.abs(m.closingBalance))}.`);
    lines.push(`${m.label}: ${parts.join(" ")}`);
  }
  return lines;
}

function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

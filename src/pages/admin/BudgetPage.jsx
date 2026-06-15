import { useCallback, useEffect, useRef, useState } from "react";
import { toDateStr, genId } from "../../utils/budgetCalc";
import {
  loadBudgetConfig, saveBudgetConfig,
  loadTransactions, newTransaction, updateTransaction, deleteTransaction,
} from "../../api/plannerApi";
import PageTabs from "../../components/PageTabs";
import BudgetDashboard from "../../components/budget/BudgetDashboard";
import BudgetTransactions from "../../components/budget/BudgetTransactions";
import BudgetReconcile from "../../components/budget/BudgetReconcile";
import BudgetBillsIncome from "../../components/budget/BudgetBillsIncome";
import BudgetSimulator from "../../components/budget/BudgetSimulator";
import BudgetAnalytics from "../../components/budget/BudgetAnalytics";
import BudgetBanker from "../../components/budget/BudgetBanker";
// Config/transaction normalisers live in budgetSummary so the home Dashboard
// widget and this page read the data in exactly the same shape.
import { DEFAULT_CONFIG, apiToPage, uiShape } from "../../components/budget/budgetSummary";

// Transactions now live in the standalone `transactions` table (shared with
// Frodo), NOT the config blob — so we persist an empty array here to keep the
// legacy blob clear and prevent the two stores from diverging again.
function pageToApi(config, simulations, startingBalance) {
  return {
    categories: config.categories,
    incomeSources: config.income,
    recurringBills: config.recurringBills,
    categoryBudgets: config.categoryBudgets ?? {},
    savingsGoals: config.savingsGoals ?? [],
    paySchedule: config.paySchedule,
    taxRate: config.taxRate ?? DEFAULT_CONFIG.taxRate,
    startingBalance,
    simulations,
    transactions: [],
  };
}

// Fields that matter when deciding whether a row changed (drives table writes).
const TX_PERSIST_FIELDS = ["description", "amount", "type", "category", "date", "notes", "reconciled", "is_bill", "fulfills_recurring_id", "fulfills_income_id"];
// Columns that may not exist yet on older DBs — omitted on insert and persisted
// individually on update, so a missing column only loses that one flag.
const OPTIONAL_TX_COLS = ["reconciled", "is_bill"];
function txChanged(a, b) {
  return TX_PERSIST_FIELDS.some((f) => (a[f] ?? null) !== (b[f] ?? null));
}

// `key` (not `id`) + `icon` so these feed the shared PageTabs component the
// other portal pages use, keeping the Finance header consistent with them.
const TABS = [
  { key: "dashboard",    label: "Dashboard",      icon: "fa-gauge" },
  { key: "banker",       label: "🧌 Banker" },
  { key: "transactions", label: "Transactions",   icon: "fa-list-ul" },
  { key: "ledger",       label: "Ledger",         icon: "fa-book" },
  { key: "analytics",    label: "Analytics",      icon: "fa-chart-pie" },
  { key: "reconcile",    label: "Reconcile",      icon: "fa-scale-balanced" },
  { key: "bills",        label: "Bills & Income", icon: "fa-file-invoice-dollar" },
  { key: "simulator",    label: "Simulator",      icon: "fa-flask" },
];

export default function BudgetPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(() => sessionStorage.getItem("budgetTab") || "dashboard");
  const [periodOffset, setPeriodOffset] = useState(0);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [transactions, setTxState] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [startingBalance, setStartingBalance] = useState(0);

  // Mirror of transactions for the reconciler (avoids stale closures).
  const txRef = useRef([]);
  useEffect(() => { txRef.current = transactions; }, [transactions]);

  // Load config (single row) + transactions (standalone table) together.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cfg = await loadBudgetConfig().catch(() => null);
      if (cfg && alive) {
        setConfig(apiToPage(cfg));
        setSimulations(cfg.simulations ?? []);
        setStartingBalance(cfg.startingBalance ?? 0);
      }
      let rows = (await loadTransactions().catch(() => [])).map(uiShape);

      // One-time migration: lift any transactions that only ever lived in the
      // old config blob into the table, so nothing the UI saved before is lost.
      const legacy = cfg?.transactions ?? [];
      if (legacy.length) {
        const seen = new Set(rows.map((r) => `${r.date}|${r.description}|${r.amount}`));
        for (const t of legacy) {
          const key = `${t.date}|${t.description}|${Math.abs(Number(t.amount) || 0)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const saved = await newTransaction({
            description: t.description, amount: Math.abs(Number(t.amount) || 0),
            type: t.type, category: t.category, date: t.date, notes: t.notes || "",
          }).catch(() => null);
          if (saved?.id) rows.push(uiShape(saved));
        }
      }
      if (alive) { setTxState(rows); setReady(true); }
    })();
    return () => { alive = false; };
  }, []);

  // Re-pull config + transactions from the server. Used after Griphook (the
  // banker agent) makes ledger changes, so the page reflects them immediately.
  const reload = useCallback(async () => {
    const cfg = await loadBudgetConfig().catch(() => null);
    if (cfg) {
      setConfig(apiToPage(cfg));
      setSimulations(cfg.simulations ?? []);
      setStartingBalance(cfg.startingBalance ?? 0);
    }
    const rows = (await loadTransactions().catch(() => [])).map(uiShape);
    setTxState(rows);
  }, []);

  // Debounced save of config (NOT transactions — those persist immediately to
  // their own table via the reconciler below).
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBudgetConfig(pageToApi(config, simulations, startingBalance)).catch(() => {});
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [ready, config, simulations, startingBalance]);

  // Reconciling setter: children keep calling setTransactions(updater) as
  // before, but every change is diffed against the previous list and the delta
  // is written to the transactions table (insert / update / delete).
  const setTransactions = useCallback((updater) => {
    setTxState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const nextById = new Map(next.map((t) => [t.id, t]));
      const prevById = new Map(prev.map((t) => [t.id, t]));

      // Deletes
      for (const t of prev) if (!nextById.has(t.id)) deleteTransaction(t.id).catch(() => {});

      // Inserts + updates
      for (const t of next) {
        const before = prevById.get(t.id);
        if (!before) {
          // New row carries a client temp id; let the table mint a real UUID,
          // then swap it in. Optional flags are omitted so the insert can't fail
          // on DBs that don't have those columns yet.
          newTransaction({
            description: t.description, amount: t.amount, type: t.type,
            category: t.category, date: t.date, notes: t.notes || "",
            fulfills_recurring_id: t.fulfills_recurring_id ?? null,
            fulfills_income_id: t.fulfills_income_id ?? null,
          }).then((saved) => {
            if (saved?.id) setTxState((cur) => cur.map((x) => (x.id === t.id
              ? { ...uiShape(saved), reconciled: t.reconciled ?? false, is_bill: t.is_bill ?? false }
              : x)));
          }).catch(() => {});
        } else if (txChanged(before, t)) {
          // Persist core fields together; persist optional flags separately so a
          // DB without those columns only loses that flag, not the edit.
          const core = ["description", "amount", "type", "category", "date", "notes", "fulfills_recurring_id", "fulfills_income_id"];
          const coreChanged = core.some((f) => (before[f] ?? null) !== (t[f] ?? null));
          if (coreChanged) {
            const patch = {};
            core.forEach((f) => { patch[f] = t[f]; });
            updateTransaction(t.id, patch).catch(() => {});
          }
          OPTIONAL_TX_COLS.forEach((f) => {
            if ((before[f] ?? false) !== (t[f] ?? false)) {
              updateTransaction(t.id, { [f]: t[f] }).catch(() => {});
            }
          });
        }
      }
      return next;
    });
  }, []);

  const switchTab = id => { setTab(id); sessionStorage.setItem("budgetTab", id); };

  const handlePayBill = bill => {
    const tx = {
      id: genId(), description: `Bill: ${bill.name}`, amount: bill.amount,
      type: "expense", category: bill.category || "Other", date: bill.date || toDateStr(),
      notes: "Logged from dashboard", reconciled: false, is_bill: true,
      fulfills_recurring_id: bill.billId ?? bill.id ?? null,
    };
    setTransactions(p => [tx, ...p]);
  };

  // Undo "paid": delete the auto-created bill transaction, or just unflag/unlink
  // one the user logged themselves.
  const handleUnpayBill = txId => {
    setTransactions(p => {
      const tx = p.find(t => t.id === txId);
      if (tx && tx.notes === "Logged from dashboard" && /^Bill: /.test(tx.description)) {
        return p.filter(t => t.id !== txId);
      }
      return p.map(t => t.id === txId ? { ...t, is_bill: false, fulfills_recurring_id: null } : t);
    });
  };

  // Set (or clear, when amount ≤ 0) a monthly spending budget for a category.
  const handleSetCategoryBudget = (category, amount) => {
    setConfig(c => {
      const next = { ...(c.categoryBudgets || {}) };
      if (!amount || amount <= 0) delete next[category];
      else next[category] = amount;
      return { ...c, categoryBudgets: next };
    });
  };

  const handleSaveGoals = (goals) => setConfig(c => ({ ...c, savingsGoals: goals }));

  const handleFreshStart = () => {
    setTransactions([]);
    setStartingBalance(0);
  };

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-wallet" /> Finance
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={switchTab} />
      </div>

      <div className="combined-embed">
        <div className="module-page">
          {tab === "dashboard" && (
            <BudgetDashboard
              config={config}
              transactions={transactions}
              startingBalance={startingBalance}
              paySchedule={config.paySchedule}
              periodOffset={periodOffset}
              setPeriodOffset={setPeriodOffset}
              onPayBill={handlePayBill}
              onUnpayBill={handleUnpayBill}
              onSetCategoryBudget={handleSetCategoryBudget}
              onSaveGoals={handleSaveGoals}
            />
          )}
          {tab === "banker" && (
            <BudgetBanker onChanged={reload} />
          )}
          {tab === "transactions" && (
            <BudgetTransactions
              config={config}
              transactions={transactions}
              setTransactions={setTransactions}
              startingBalance={startingBalance}
            />
          )}
          {tab === "ledger" && (
            <BudgetTransactions
              config={config}
              transactions={transactions}
              setTransactions={setTransactions}
              startingBalance={startingBalance}
              defaultView="ledger"
            />
          )}
          {tab === "analytics" && (
            <BudgetAnalytics
              config={config}
              transactions={transactions}
              startingBalance={startingBalance}
            />
          )}
          {tab === "reconcile" && (
            <BudgetReconcile
              config={config}
              transactions={transactions}
              setTransactions={setTransactions}
              paySchedule={config.paySchedule}
            />
          )}
          {tab === "bills" && (
            <BudgetBillsIncome
              config={config}
              setConfig={setConfig}
              transactions={transactions}
              setTransactions={setTransactions}
              startingBalance={startingBalance}
              setStartingBalance={setStartingBalance}
              onFreshStart={handleFreshStart}
            />
          )}
          {tab === "simulator" && (
            <BudgetSimulator
              config={config}
              simulations={simulations}
              setSimulations={setSimulations}
              transactions={transactions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

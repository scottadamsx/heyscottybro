import { useEffect, useRef, useState } from "react";
import { toDateStr, genId } from "../../utils/budgetCalc";
import { loadBudgetConfig, saveBudgetConfig } from "../../api/plannerApi";
import BudgetDashboard from "../../components/budget/BudgetDashboard";
import BudgetTransactions from "../../components/budget/BudgetTransactions";
import BudgetReconcile from "../../components/budget/BudgetReconcile";
import BudgetBillsIncome from "../../components/budget/BudgetBillsIncome";
import BudgetSimulator from "../../components/budget/BudgetSimulator";
import BudgetAnalytics from "../../components/budget/BudgetAnalytics";

const DEFAULT_CONFIG = {
  categories: ["Housing","Groceries","Transportation","Utilities","Entertainment","Dining Out","Personal","Subscriptions","Health","Savings","Other"],
  income: [],
  paySchedule: { type: "biweekly", anchorDate: toDateStr(), customDays: null },
  recurringBills: [],
  taxRate: 0.18,
};

// The budget lives as a single row in budget_config (Supabase) with a
// localStorage fallback baked into the API — so it syncs across devices.
// These helpers translate between the page's shape (income, paySchedule)
// and the API's shape (incomeSources, …).
function apiToPage(cfg) {
  return {
    categories: cfg.categories ?? DEFAULT_CONFIG.categories,
    income: cfg.incomeSources ?? [],
    recurringBills: cfg.recurringBills ?? [],
    paySchedule: cfg.paySchedule ?? DEFAULT_CONFIG.paySchedule,
    taxRate: cfg.taxRate ?? DEFAULT_CONFIG.taxRate,
  };
}
function pageToApi(config, transactions, simulations, startingBalance) {
  return {
    categories: config.categories,
    incomeSources: config.income,
    recurringBills: config.recurringBills,
    paySchedule: config.paySchedule,
    taxRate: config.taxRate ?? DEFAULT_CONFIG.taxRate,
    startingBalance,
    simulations,
    transactions,
  };
}

const TABS = [
  { id: "dashboard",    label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "ledger",       label: "Ledger" },
  { id: "analytics",    label: "Analytics" },
  { id: "reconcile",    label: "Reconcile" },
  { id: "bills",        label: "Bills & Income" },
  { id: "simulator",    label: "Simulator" },
];

export default function BudgetPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(() => sessionStorage.getItem("budgetTab") || "dashboard");
  const [periodOffset, setPeriodOffset] = useState(0);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [transactions, setTransactions] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [startingBalance, setStartingBalance] = useState(0);

  // Load the single budget_config row (falls back to localStorage if offline).
  useEffect(() => {
    let alive = true;
    loadBudgetConfig()
      .then((cfg) => {
        if (!alive) return;
        setConfig(apiToPage(cfg));
        setTransactions(cfg.transactions ?? []);
        setSimulations(cfg.simulations ?? []);
        setStartingBalance(cfg.startingBalance ?? 0);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  // Debounced save so rapid edits collapse into one write.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBudgetConfig(pageToApi(config, transactions, simulations, startingBalance)).catch(() => {});
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [ready, config, transactions, simulations, startingBalance]);

  const switchTab = id => { setTab(id); sessionStorage.setItem("budgetTab", id); };

  const handlePayBill = bill => {
    const tx = { id: genId(), description: `Bill: ${bill.name}`, amount: bill.amount, type: "expense", category: bill.category || "Other", date: bill.date || toDateStr(), notes: "Logged from dashboard", reconciled: false };
    setTransactions(p => [tx, ...p]);
  };

  const handleFreshStart = () => {
    setTransactions([]);
    setStartingBalance(0);
  };

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Budget</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--border,#333)", marginBottom: 16, overflowX: "auto", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)} style={{
            padding: "9px 14px", fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? "var(--text-primary,#fff)" : "var(--text-muted,#666)",
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? "var(--accent,#6366f1)" : "transparent"}`,
            cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <BudgetDashboard
          config={config}
          transactions={transactions}
          startingBalance={startingBalance}
          paySchedule={config.paySchedule}
          periodOffset={periodOffset}
          setPeriodOffset={setPeriodOffset}
          onPayBill={handlePayBill}
        />
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
  );
}

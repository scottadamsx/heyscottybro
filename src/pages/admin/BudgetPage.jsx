import { useEffect, useState } from "react";
import { toDateStr, genId } from "../../utils/budgetCalc";
import BudgetDashboard from "../../components/budget/BudgetDashboard";
import BudgetTransactions from "../../components/budget/BudgetTransactions";
import BudgetReconcile from "../../components/budget/BudgetReconcile";
import BudgetBillsIncome from "../../components/budget/BudgetBillsIncome";
import BudgetSimulator from "../../components/budget/BudgetSimulator";

const SKEY = "scotty_budget_v3";

const DEFAULT_CONFIG = {
  categories: ["Housing","Groceries","Transportation","Utilities","Entertainment","Dining Out","Personal","Subscriptions","Health","Savings","Other"],
  income: [
    { id: "txtsquad", name: "TxtSquad", amount: 740, frequency: "biweekly", nextDate: "2026-06-19" },
  ],
  paySchedule: { type: "biweekly", anchorDate: "2026-06-19", customDays: null },
  recurringBills: [
    { id: "rent",        name: "Rent",             amount: 700,   category: "Housing",       frequency: "monthly", startDate: "2026-06-01", autoPay: false },
    { id: "electrical",  name: "Electrical",        amount: 150,   category: "Utilities",     frequency: "monthly", startDate: "2026-06-15", autoPay: false },
    { id: "phone",       name: "Phone",             amount: 156,   category: "Utilities",     frequency: "monthly", startDate: "2026-06-05", autoPay: true },
    { id: "insurance",   name: "Insurance",         amount: 220,   category: "Personal",      frequency: "monthly", startDate: "2026-06-01", autoPay: true },
    { id: "googleone",   name: "Google One",        amount: 35,    category: "Subscriptions", frequency: "monthly", startDate: "2026-06-01", autoPay: true },
    { id: "claude",      name: "Claude Pro",        amount: 32.99, category: "Subscriptions", frequency: "monthly", startDate: "2026-06-07", autoPay: true },
  ],
};

function load() {
  try {
    const raw = localStorage.getItem(SKEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function save(state) {
  try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch { /* noop */ }
}

const TABS = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "reconcile", label: "Reconcile" },
  { id: "bills",     label: "Bills & Income" },
  { id: "simulator", label: "Simulator" },
];

export default function BudgetPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(() => sessionStorage.getItem("budgetTab") || "dashboard");
  const [periodOffset, setPeriodOffset] = useState(0);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [transactions, setTransactions] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [startingBalance, setStartingBalance] = useState(0);

  useEffect(() => {
    const saved = load();
    if (saved) {
      if (saved.config) setConfig(c => ({ ...DEFAULT_CONFIG, ...saved.config, recurringBills: saved.config.recurringBills ?? DEFAULT_CONFIG.recurringBills, income: saved.config.income ?? DEFAULT_CONFIG.income, paySchedule: saved.config.paySchedule ?? DEFAULT_CONFIG.paySchedule }));
      if (saved.transactions) setTransactions(saved.transactions);
      if (saved.simulations) setSimulations(saved.simulations);
      if (saved.startingBalance != null) setStartingBalance(saved.startingBalance);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    save({ config, transactions, simulations, startingBalance });
  }, [ready, config, transactions, simulations, startingBalance]);

  const switchTab = id => { setTab(id); sessionStorage.setItem("budgetTab", id); };

  const handlePayBill = bill => {
    const tx = { id: genId(), description: `Bill: ${bill.name}`, amount: bill.amount, type: "expense", category: bill.category || "Other", date: bill.date || toDateStr(), notes: "Logged from dashboard", reconciled: false };
    setTransactions(p => [tx, ...p]);
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
        />
      )}
      {tab === "simulator" && (
        <BudgetSimulator
          config={config}
          simulations={simulations}
          setSimulations={setSimulations}
        />
      )}
    </div>
  );
}

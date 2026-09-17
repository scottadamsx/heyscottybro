import { ExportKit } from "../../components/ui";
import GroceryPage from "./GroceryPage";
import StatementImport from "../../components/budget/StatementImport";
import { useCallback, useEffect, useRef, useState } from "react";
import { toDateStr, genId } from "../../utils/budgetCalc";
import {
  loadBudgetConfig, saveBudgetConfig,
  loadTransactions, newTransaction, updateTransaction, deleteTransaction,
} from "../../api/plannerApi";
import PageTabs from "../../components/PageTabs";
import { useToast } from "../../contexts/ToastContext";
import BudgetDashboard from "../../components/budget/BudgetDashboard";
import BudgetTransactions from "../../components/budget/BudgetTransactions";
import BudgetReconcile from "../../components/budget/BudgetReconcile";
import BudgetBillsIncome from "../../components/budget/BudgetBillsIncome";
import BudgetSimulator from "../../components/budget/BudgetSimulator";
import BudgetAnalytics from "../../components/budget/BudgetAnalytics";
import BudgetBanker from "../../components/budget/BudgetBanker";
// Config/transaction normalisers live in budgetSummary so the home Dashboard
// widget and this page read the data in exactly the same shape.
import { DEFAULT_CONFIG, apiToPage, uiShape, computeBudgetSnapshot } from "../../components/budget/budgetSummary";

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
  { key: "dashboard",    label: "Overview",       icon: "fa-gauge" },
  { key: "transactions", label: "Transactions",   icon: "fa-list-ul" },
  { key: "bills",        label: "Bills & Income", icon: "fa-file-invoice-dollar" },
  { key: "receipts",     label: "Receipts",       icon: "fa-receipt" },
  { key: "banker",       label: "Banker" },
  { key: "tools",        label: "Tools",          icon: "fa-flask" },
];

export default function BudgetPage() {
  const { addToast } = useToast();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem("budgetTab");
    return TABS.some((t) => t.key === saved) ? saved : "dashboard";
  });
  const [periodOffset, setPeriodOffset] = useState(0);

  // Raw setters are for data that came FROM the server. The wrapped setters
  // below (handed to children) mark the config dirty, which is the only thing
  // that arms the autosave — a load never saves (that is how every bill once
  // got wiped: failed load → defaults → autosave → reconcile deleted the rows).
  const [config, setConfigRaw] = useState(DEFAULT_CONFIG);
  const [transactions, setTxState] = useState([]);
  const [simulations, setSimulationsRaw] = useState([]);
  const [startingBalance, setStartingBalanceRaw] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const dirtyRef = useRef(false);
  const setConfig = useCallback((u) => { dirtyRef.current = true; setConfigRaw(u); }, []);
  const setSimulations = useCallback((u) => { dirtyRef.current = true; setSimulationsRaw(u); }, []);
  const setStartingBalance = useCallback((u) => { dirtyRef.current = true; setStartingBalanceRaw(u); }, []);

  // Mirror of transactions for the reconciler (avoids stale closures).
  const txRef = useRef([]);
  useEffect(() => { txRef.current = transactions; }, [transactions]);

  const applyServerConfig = useCallback((cfg) => {
    dirtyRef.current = false;
    setConfigRaw(apiToPage(cfg));
    setSimulationsRaw(cfg.simulations ?? []);
    setStartingBalanceRaw(cfg.startingBalance ?? 0);
  }, []);

  // Load config (single row) + transactions (standalone table) together.
  // A failed config load is an error state, never a default config.
  const aliveRef = useRef(true);
  // Re-arm on mount: StrictMode (dev) mounts → unmounts → remounts with the
  // same ref, so a cleanup-only effect left this false forever and the page
  // sat on "Loading…".
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  const loadAll = useCallback(async () => {
    setLoadError(null);
    let cfg;
    try {
      cfg = await loadBudgetConfig();
    } catch (err) {
      console.error("[budget] config load failed", err);
      if (aliveRef.current) setLoadError(err?.message || String(err));
      return;
    }
    if (!aliveRef.current) return;
    applyServerConfig(cfg);
    let rows;
    try {
      rows = (await loadTransactions()).map(uiShape);
    } catch (err) {
      console.error("[budget] transactions load failed", err);
      if (aliveRef.current) setLoadError(err?.message || String(err));
      return;
    }

    // One-time migration: lift any transactions that only ever lived in the
    // old config blob into the table, so nothing the UI saved before is lost.
    const legacy = cfg?.transactions ?? [];
    if (legacy.length) {
      const seen = new Set(rows.map((r) => `${r.date}|${r.description}|${r.amount}`));
      for (const t of legacy) {
        const key = `${t.date}|${t.description}|${Math.abs(Number(t.amount) || 0)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          const saved = await newTransaction({
            description: t.description, amount: Math.abs(Number(t.amount) || 0),
            type: t.type, category: t.category, date: t.date, notes: t.notes || "",
          });
          if (saved?.id) rows.push(uiShape(saved));
        } catch (err) {
          addToast(`Couldn't migrate legacy transaction "${t.description}": ${err?.message || err}`, "error");
        }
      }
    }
    if (aliveRef.current) { setTxState(rows); setReady(true); }
  }, [addToast, applyServerConfig]);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Re-pull config + transactions from the server. Used after Griphook (the
  // banker agent) makes ledger changes, so the page reflects them immediately.
  const reload = useCallback(async () => {
    try {
      const cfg = await loadBudgetConfig();
      applyServerConfig(cfg);
      const rows = (await loadTransactions()).map(uiShape);
      setTxState(rows);
    } catch (err) {
      console.error("[budget] reload failed", err);
      addToast(`Couldn't refresh budget: ${err?.message || err}`, "error");
    }
  }, [addToast, applyServerConfig]);

  // Debounced save of config (NOT transactions — those persist immediately to
  // their own table via the reconciler below). Dirty-gated: runs only after a
  // user-initiated change, never on a load. Because every save here follows a
  // real edit, an empty bills/income list is the user's intent (they deleted
  // the last one), so the reconciler is told it may clear the table.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready || !dirtyRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBudgetConfig(pageToApi(config, simulations, startingBalance), { allowEmpty: true }).catch((err) => {
        console.warn("[budget] config save failed", err);
        addToast(`Budget settings didn't save: ${err?.message || err}`, "error");
      });
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [ready, config, simulations, startingBalance, addToast]);

  // Reconciling setter: children keep calling setTransactions(updater) as
  // before, but every change is diffed against the previous list and the delta
  // is written to the transactions table (insert / update / delete).
  const setTransactions = useCallback((updater) => {
    setTxState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const nextById = new Map(next.map((t) => [t.id, t]));
      const prevById = new Map(prev.map((t) => [t.id, t]));

      // Deletes
      for (const t of prev) if (!nextById.has(t.id)) {
        deleteTransaction(t.id).catch((err) => {
          console.warn("[budget] delete failed", err);
          addToast(`Couldn't delete "${t.description}": ${err?.message || err}`, "error");
          // Revert: put the row back if it's still gone.
          setTxState((cur) => (cur.some((x) => x.id === t.id) ? cur : [t, ...cur]));
        });
      }

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
          }).catch((err) => {
            console.warn("[budget] insert failed", err);
            addToast(`Couldn't save "${t.description}": ${err?.message || err}`, "error");
            // Revert: drop the unsaved optimistic row.
            setTxState((cur) => cur.filter((x) => x.id !== t.id));
          });
        } else if (txChanged(before, t)) {
          // Persist core fields together; persist optional flags separately so a
          // DB without those columns only loses that flag, not the edit.
          const core = ["description", "amount", "type", "category", "date", "notes", "fulfills_recurring_id", "fulfills_income_id"];
          const coreChanged = core.some((f) => (before[f] ?? null) !== (t[f] ?? null));
          if (coreChanged) {
            const patch = {};
            core.forEach((f) => { patch[f] = t[f]; });
            updateTransaction(t.id, patch).catch((err) => {
              console.warn("[budget] update failed", err);
              addToast(`Couldn't update "${t.description}": ${err?.message || err}`, "error");
              // Revert core fields to their last-known-saved values.
              setTxState((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...Object.fromEntries(core.map((f) => [f, before[f]])) } : x)));
            });
          }
          OPTIONAL_TX_COLS.forEach((f) => {
            if ((before[f] ?? false) !== (t[f] ?? false)) {
              updateTransaction(t.id, { [f]: t[f] }).catch((err) => {
                console.warn(`[budget] update ${f} failed`, err);
                addToast(`Couldn't update ${f.replace(/_/g, " ")} on "${t.description}": ${err?.message || err}`, "error");
                setTxState((cur) => cur.map((x) => (x.id === t.id ? { ...x, [f]: before[f] ?? false } : x)));
              });
            }
          });
        }
      }
      return next;
    });
  }, [addToast]);

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

  if (loadError) {
    return (
      <div className="combined-page">
        <p className="error-message" role="alert">
          Couldn't load your budget: {loadError}
          {" — "}
          <button type="button" className="btn-sm btn-secondary-sm btn" onClick={loadAll}>Retry</button>
        </p>
        <p className="no-entries">Nothing has been changed. Your bills, income and settings are untouched on the server.</p>
      </div>
    );
  }
  if (!ready) return <div className="module-page"><p className="no-entries">Loading…</p></div>;

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">Money</h1>
        <div className="combined-page-toolbar">
          <PageTabs tabs={TABS} active={tab} onChange={switchTab} />
          <div className="page-actions"><ExportKit exporter={{
            title: "Money report",
            filename: "money-report",
            toMarkdown: () => {
              const snap = computeBudgetSnapshot(apiToPage(config || {}), (transactions || []).map(uiShape));
              const fm = (v) => `$${Number(v || 0).toFixed(2)}`;
              const L = [`# Money report — ${new Date().toDateString()}`, ""];
              L.push(`- **Income this period:** ${fm(snap.incomeTotal)}`);
              L.push(`- **Spent:** ${fm(snap.spent)} · **Bills obligation:** ${fm(snap.billsObligation)} (paid ${fm(snap.billsPaid)})`);
              L.push(`- **Saved:** ${fm(snap.saved)} · **Remaining:** ${fm(snap.remaining)}`, "");
              L.push("## Transactions (this period)", "", "| Date | Description | Type | Category | Amount |", "|---|---|---|---|---|");
              (snap.periodTx || []).forEach((t) => L.push(`| ${t.date} | ${t.description} | ${t.type} | ${t.category || ""} | ${fm(t.amount)} |`));
              return L.join("\n");
            },
            toRows: () => (transactions || []).map(uiShape).map((t) => ({ date: t.date, description: t.description, type: t.type, category: t.category, amount: t.amount })),
          }} /></div>
        </div>
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
          {tab === "dashboard" && (
            <BudgetAnalytics
              config={config}
              transactions={transactions}
              startingBalance={startingBalance}
            />
          )}
          {tab === "banker" && (
            <BudgetBanker onChanged={reload} />
          )}
          {tab === "receipts" && <GroceryPage />}
          {tab === "transactions" && (
            <BudgetTransactions
              config={config}
              transactions={transactions}
              setTransactions={setTransactions}
              startingBalance={startingBalance}
              actions={
                <StatementImport
                  transactions={transactions}
                  setTransactions={setTransactions}
                  categories={config.categories || []}
                  onSetBalance={(b) => setStartingBalance(b)}
                />
              }
            />
          )}
          {tab === "tools" && (
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
              startingBalance={startingBalance}
              setStartingBalance={setStartingBalance}
              onFreshStart={handleFreshStart}
            />
          )}
          {tab === "tools" && (
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

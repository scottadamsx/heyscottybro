/**
 * Planner API — Supabase calls with an automatic localStorage fallback.
 *
 * - Normal mode: talks to Supabase. If a call fails (offline / schema issue),
 *   it falls back to localStorage so the UI keeps working, and flips the
 *   connection status to "disconnected".
 * - Local mode (toggle in the dashboard, or VITE_LOCAL_DATA=1): every call uses
 *   localStorage consistently — handy for offline testing.
 */
import { supabase, getAuthHeaders } from "../utils/supabase";
import { local } from "../utils/localStore";
import { toDateStr } from "../utils/plannerUtils";
import { emitDataChange } from "../utils/dataEvents";

/* ── connection + mode state ─────────────────── */
let _connected = null; // null = unknown, true, false
const _listeners = new Set();

export function getConnectionStatus() { return _connected; }
export function onConnectionChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
function setConnected(v) {
  if (_connected !== v) { _connected = v; _listeners.forEach((f) => { try { f(v); } catch { /* noop */ } }); }
}

export function isLocalMode() {
  if (import.meta.env.VITE_LOCAL_DATA === "1") return true;
  try { return localStorage.getItem("forceLocal") === "1"; } catch { return false; }
}
export function setLocalMode(on) {
  try {
    if (on) localStorage.setItem("forceLocal", "1");
    else localStorage.removeItem("forceLocal");
  } catch { /* noop */ }
}

export async function checkConnection() {
  if (isLocalMode()) { setConnected(false); return false; }
  try {
    const { error } = await supabase.from("reminders").select("id").limit(1);
    if (error) throw error;
    setConnected(true);
    return true;
  } catch {
    setConnected(false);
    return false;
  }
}

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isNetworkError = err instanceof TypeError && /fetch|network|failed/i.test(err.message ?? "");
      if (!isNetworkError || attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 300));
    }
  }
}

/** Run a Supabase op with retry on network errors, falling back to localStorage on persistent failure. */
async function op(remote, localFn) {
  if (isLocalMode()) return localFn();
  try {
    const r = await withRetry(remote);
    setConnected(true);
    return r;
  } catch (err) {
    // Loud, not silent: a fallback means this data is NOT on the server.
    console.warn("[plannerApi] Supabase call failed — falling back to localStorage. This change will NOT persist across devices/refresh-from-server:", err?.message || err);
    setConnected(false);
    return localFn();
  }
}

async function uid() {
  if (isLocalMode()) return "local-user";
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

const byDateAsc = (k = "date") => (a, b) => String(a[k] || "").localeCompare(String(b[k] || ""));

/* ── Reminders ───────────────────────────────── */
export async function loadReminders() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("reminders").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("reminders").slice().sort(byDateAsc()),
  );
}

export async function newReminder({ name, date, time, description, recurrence, project_id, recur_until, recur_times, show_on_calendar, course_id }) {
  const base = {
    name,
    date: date || null,
    recurrence: recurrence || "none",
    completed: false,
    show_on_calendar: show_on_calendar !== false,
  };
  if (project_id) base.project_id = project_id;
  if (course_id) base.course_id = course_id;
  if (recur_until) base.recur_until = recur_until;
  if (recur_times) base.recur_times = Number(recur_times);
  if (time) base.time = time;
  if (description) base.description = description;
  const result = await op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("reminders").insert({ user_id: userId, ...base }).select().single();
      if (error) throw error;
      return data;
    },
    () => local.insert("reminders", { show_on_calendar: base.show_on_calendar !== false, ...base }),
  );
  emitDataChange("reminders");
  return result;
}

export async function completeReminder(id) {
  // Local calendar day — toISOString() would give the UTC day, which is
  // yesterday during AU mornings.
  const completed_date = toDateStr(new Date());
  await op(
    async () => { const { error } = await supabase.from("reminders").update({ completed: true, completed_date }).eq("id", id); if (error) throw error; },
    () => local.update("reminders", id, { completed: true, completed_date }),
  );
  emitDataChange("reminders");
}

export async function updateReminder(id, fields) {
  // Only persist keys that were actually provided (so partial edits don't wipe columns).
  const patch = {};
  ["name", "date", "time", "description", "recurrence", "project_id", "course_id", "recur_until", "recur_times", "show_on_calendar", "completed"].forEach((k) => {
    if (fields[k] !== undefined) patch[k] = fields[k];
  });
  if (patch.recur_times != null) patch.recur_times = Number(patch.recur_times);
  await op(
    async () => { const { error } = await supabase.from("reminders").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("reminders", id, patch),
  );
  emitDataChange("reminders");
}

export async function deleteReminder(id) {
  await op(
    async () => { const { error } = await supabase.from("reminders").delete().eq("id", id); if (error) throw error; },
    () => local.remove("reminders", id),
  );
  emitDataChange("reminders");
}

/* ── Journal ─────────────────────────────────── */
export async function loadJournal() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("journal").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("journal").slice().sort(byDateAsc()),
  );
}

export async function newJournalEntry({ title, entry, date }) {
  return op(
    async () => { const userId = await uid(); const { error } = await supabase.from("journal").insert({ user_id: userId, title, entry, date }); if (error) throw error; },
    () => { local.insert("journal", { title, entry, date }); },
  );
}

export async function updateJournalEntry(id, fields) {
  const patch = {};
  ["title", "entry", "date"].forEach((k) => { if (fields[k] !== undefined) patch[k] = fields[k]; });
  return op(
    async () => { const { error } = await supabase.from("journal").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("journal", id, patch),
  );
}

export async function deleteJournalEntry(id) {
  return op(
    async () => { const { error } = await supabase.from("journal").delete().eq("id", id); if (error) throw error; },
    () => local.remove("journal", id),
  );
}

/* ── Events ──────────────────────────────────── */
export async function loadEvents() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("events").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("events").slice().sort(byDateAsc()),
  );
}

export async function newEvent({ title, description, date, end_date, project_id, event_type_id, recurrence, recur_until, recur_times, start_time, end_time }) {
  const row = { title, description, date };
  if (end_date && end_date > date) row.end_date = end_date;
  if (start_time) row.start_time = start_time;
  if (end_time) row.end_time = end_time;
  if (project_id) row.project_id = project_id;
  if (event_type_id) row.event_type_id = event_type_id;
  // Recurrence keys are only sent when set, so inserts keep working on
  // databases that haven't run the events-recurrence migration yet.
  if (recurrence && recurrence !== "none") row.recurrence = recurrence;
  if (recur_until) row.recur_until = recur_until;
  if (recur_times) row.recur_times = Number(recur_times);
  const result = await op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("events").insert({ user_id: userId, ...row }).select().single(); if (error) throw error; return data; },
    () => local.insert("events", row),
  );
  emitDataChange("events");
  return result;
}

export async function updateEvent(id, fields) {
  // Only persist keys that were actually provided (so partial edits don't wipe columns).
  const patch = {};
  ["title", "date", "description", "project_id", "event_type_id", "recurrence", "recur_until", "recur_times", "start_time", "end_time", "end_date"].forEach((k) => {
    if (fields[k] !== undefined) patch[k] = fields[k];
  });
  if (patch.recur_times != null) patch.recur_times = Number(patch.recur_times);
  await op(
    async () => { const { error } = await supabase.from("events").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("events", id, patch),
  );
  emitDataChange("events");
}

export async function deleteEvent(id) {
  await op(
    async () => { const { error } = await supabase.from("events").delete().eq("id", id); if (error) throw error; },
    () => local.remove("events", id),
  );
  emitDataChange("events");
}

/* ── Budget ──────────────────────────────────── */
// Amounts are stored signed: expenses, planned ("future") spend, and savings
// transfers negative (cash out of spendable), income positive. Deriving the
// sign from type (not the typed value) means edit forms can safely show
// absolute values without flipping signs on save. Savings is negative cash flow
// like an expense, but it's NOT counted as spending (analytics filter on
// type === "expense"), so a savings deposit no longer inflates expenses.
function signTx(tx) {
  const n = Number(tx.amount || 0);
  const signed =
    tx.type === "expense" || tx.type === "future" || tx.type === "savings" ? -Math.abs(n)
    : tx.type === "income" ? Math.abs(n)
    : n;
  return { ...tx, amount: signed };
}

export async function loadTransactions() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("transactions").slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
  );
}

export async function loadTransactionsPaginated(page = 0, pageSize = 50) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return op(
    async () => {
      const userId = await uid();
      const { data, error, count } = await supabase
        .from("transactions").select("*", { count: "exact" })
        .eq("user_id", userId).order("date", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0, page, pageSize };
    },
    () => {
      const all = local.list("transactions").slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      return { rows: all.slice(from, to + 1), total: all.length, page, pageSize };
    },
  );
}

export async function loadJournalPaginated(page = 0, pageSize = 20) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return op(
    async () => {
      const userId = await uid();
      const { data, error, count } = await supabase
        .from("journal").select("*", { count: "exact" })
        .eq("user_id", userId).order("date", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0, page, pageSize };
    },
    () => {
      const all = local.list("journal").slice().sort(byDateAsc());
      return { rows: all.slice(from, to + 1), total: all.length, page, pageSize };
    },
  );
}

export async function newTransaction(tx) {
  const row = signTx(tx);
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("transactions").insert(signTx({ user_id: userId, ...tx })).select().single(); if (error) throw error; return data; },
    () => local.insert("transactions", row),
  );
}

export async function updateTransaction(id, updates) {
  const patch = "type" in updates || "amount" in updates ? signTx(updates) : updates;
  return op(
    async () => { const { error } = await supabase.from("transactions").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("transactions", id, patch),
  );
}

export async function deleteTransaction(id) {
  return op(
    async () => { const { error } = await supabase.from("transactions").delete().eq("id", id); if (error) throw error; },
    () => local.remove("transactions", id),
  );
}

export async function linkTransactionToRecurring(txId, recurringId) {
  return op(
    async () => { const { error } = await supabase.from("transactions").update({ fulfills_recurring_id: recurringId, fulfills_income_id: null }).eq("id", txId); if (error) throw error; },
    () => local.update("transactions", txId, { fulfills_recurring_id: recurringId, fulfills_income_id: null }),
  );
}

export async function linkTransactionToIncome(txId, incomeId) {
  return op(
    async () => { const { error } = await supabase.from("transactions").update({ fulfills_income_id: incomeId, fulfills_recurring_id: null }).eq("id", txId); if (error) throw error; },
    () => local.update("transactions", txId, { fulfills_income_id: incomeId, fulfills_recurring_id: null }),
  );
}

const DEFAULT_CONFIG = {
  categories: ["Food", "Transport", "Bills", "Entertainment", "Housing", "Car", "Subscriptions", "Travel", "Other"],
  incomeSources: [],
  recurringBills: [],
  taxRate: 0.18,
  startingBalance: 0,
  paySchedule: { type: "biweekly", anchorDate: null, customDays: null },
  simulations: [],
  transactions: [],
};

export async function loadBudgetConfig() {
  return op(
    async () => {
      const userId = await uid();
      // Bills & income are real rows now (Phase 5) — the blob keeps only
      // settings-shaped data. Same return shape as always, so nothing
      // downstream (budgetCalc, budgetSummary, the Budget page) changes.
      const [cfgRes, billsRes, incomeRes] = await Promise.all([
        supabase.from("budget_config").select("*").eq("user_id", userId).single(),
        supabase.from("recurring_bills").select("id, data").eq("user_id", userId).order("created_at"),
        supabase.from("income_sources").select("id, data").eq("user_id", userId).order("created_at"),
      ]);
      if (cfgRes.error && cfgRes.error.code !== "PGRST116") throw cfgRes.error;
      if (billsRes.error) throw billsRes.error;
      if (incomeRes.error) throw incomeRes.error;
      const data = cfgRes.data;
      const rowToObj = (r) => ({ ...(r.data || {}), id: r.id });
      return {
        categories: data?.categories ?? DEFAULT_CONFIG.categories,
        incomeSources: (incomeRes.data || []).map(rowToObj),
        recurringBills: (billsRes.data || []).map(rowToObj),
        categoryBudgets: data?.category_budgets ?? {},
        savingsGoals: data?.savings_goals ?? [],
        taxRate: data?.tax_rate != null ? Number(data.tax_rate) : 0.18,
        startingBalance: data?.starting_balance != null ? Number(data.starting_balance) : 0,
        paySchedule: data?.pay_schedule ?? DEFAULT_CONFIG.paySchedule,
        simulations: data?.simulations ?? [],
        transactions: [],
      };
    },
    () => local.singleton("budget_config") || { ...DEFAULT_CONFIG },
  );
}

export async function saveBudgetConfig(config) {
  return op(
    async () => {
      const userId = await uid();
      // 1) Settings live in the (single-row) config — bills/income/transactions
      //    are NOT here anymore, so sections can't clobber each other.
      const { error } = await supabase.from("budget_config").upsert({
        user_id: userId,
        categories: config.categories,
        category_budgets: config.categoryBudgets ?? {},
        savings_goals: config.savingsGoals ?? [],
        tax_rate: config.taxRate ?? 0.18,
        starting_balance: config.startingBalance ?? 0,
        pay_schedule: config.paySchedule ?? DEFAULT_CONFIG.paySchedule,
        simulations: config.simulations ?? [],
      }, { onConflict: "user_id" });
      if (error) throw error;
      // 2) When the caller passes bill/income arrays (the Budget page saves its
      //    whole config state), reconcile them to rows: upsert all, delete gone.
      const reconcile = async (table, list) => {
        if (!Array.isArray(list)) return;
        const rows = list.map((o) => ({
          id: o.id || genId(table === "recurring_bills" ? "rb" : "inc"),
          user_id: userId,
          data: { ...o },
        }));
        if (rows.length) {
          const { error: upErr } = await supabase.from(table).upsert(rows, { onConflict: "id" });
          if (upErr) throw upErr;
        }
        const keep = rows.map((r) => `"${r.id}"`).join(",");
        const del = supabase.from(table).delete().eq("user_id", userId);
        const { error: delErr } = rows.length ? await del.not("id", "in", `(${keep})`) : await del;
        if (delErr) throw delErr;
      };
      await reconcile("recurring_bills", config.recurringBills);
      await reconcile("income_sources", config.incomeSources);
    },
    () => local.setSingleton("budget_config", {
      categories: config.categories,
      incomeSources: config.incomeSources,
      recurringBills: config.recurringBills,
      categoryBudgets: config.categoryBudgets ?? {},
      savingsGoals: config.savingsGoals ?? [],
      taxRate: config.taxRate ?? 0.18,
      startingBalance: config.startingBalance ?? 0,
      paySchedule: config.paySchedule ?? DEFAULT_CONFIG.paySchedule,
      simulations: config.simulations ?? [],
      transactions: [],
    }),
  );
}

function genId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addIncomeSource(source) {
  const row = { id: genId("inc"), frequency: "monthly", ...source };
  await op(
    async () => { const userId = await uid(); const { error } = await supabase.from("income_sources").insert({ id: row.id, user_id: userId, data: row }); if (error) throw error; },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.incomeSources = [...(cfg.incomeSources || []), row]; local.setSingleton("budget_config", cfg); },
  );
  return row;
}
export async function updateIncomeSource(id, updates) {
  await op(
    async () => {
      const { data, error } = await supabase.from("income_sources").select("data").eq("id", id).single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("income_sources").update({ data: { ...data.data, ...updates, id } }).eq("id", id);
      if (e2) throw e2;
    },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.incomeSources = (cfg.incomeSources || []).map((s2) => s2.id === id ? { ...s2, ...updates } : s2); local.setSingleton("budget_config", cfg); },
  );
}
export async function deleteIncomeSource(id) {
  await op(
    async () => { const { error } = await supabase.from("income_sources").delete().eq("id", id); if (error) throw error; },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.incomeSources = (cfg.incomeSources || []).filter((s2) => s2.id !== id); local.setSingleton("budget_config", cfg); },
  );
}
export async function addRecurringBill(bill) {
  const row = { id: genId("rb"), frequency: "monthly", autoPay: false, ...bill };
  await op(
    async () => { const userId = await uid(); const { error } = await supabase.from("recurring_bills").insert({ id: row.id, user_id: userId, data: row }); if (error) throw error; },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.recurringBills = [...(cfg.recurringBills || []), row]; local.setSingleton("budget_config", cfg); },
  );
  return row;
}
export async function updateRecurringBill(id, updates) {
  await op(
    async () => {
      const { data, error } = await supabase.from("recurring_bills").select("data").eq("id", id).single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("recurring_bills").update({ data: { ...data.data, ...updates, id } }).eq("id", id);
      if (e2) throw e2;
    },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.recurringBills = (cfg.recurringBills || []).map((b) => b.id === id ? { ...b, ...updates } : b); local.setSingleton("budget_config", cfg); },
  );
}
export async function deleteRecurringBill(id) {
  await op(
    async () => { const { error } = await supabase.from("recurring_bills").delete().eq("id", id); if (error) throw error; },
    async () => { const cfg = local.singleton("budget_config") || { ...DEFAULT_CONFIG }; cfg.recurringBills = (cfg.recurringBills || []).filter((b) => b.id !== id); local.setSingleton("budget_config", cfg); },
  );
}
export async function addIncome(income) { return addIncomeSource(income); }

/* ── Projects ────────────────────────────────── */
export async function loadProjects() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("projects"),
  );
}

export async function newProject({ name, description, color, parent_id }) {
  const row = { name, description: description || "", color: color || "var(--accent)" };
  if (parent_id) row.parent_id = parent_id;
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("projects").insert({ user_id: userId, ...row }).select().single(); if (error) throw error; return data; },
    () => local.insert("projects", row),
  );
}

export async function updateProject(id, updates) {
  return op(
    async () => { const { error } = await supabase.from("projects").update(updates).eq("id", id); if (error) throw error; },
    () => local.update("projects", id, updates),
  );
}

export async function deleteProject(id) {
  return op(
    async () => { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; },
    () => local.remove("projects", id),
  );
}

/* ── Event Types ─────────────────────────────── */
export async function loadEventTypes() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("event_types").select("*").eq("user_id", userId).order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("event_types"),
  );
}

export async function newEventType({ name, color, auto_tasks }) {
  const row = { name, color: color || "#22d3ee", auto_tasks: auto_tasks || [] };
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("event_types").insert({ user_id: userId, ...row }).select().single(); if (error) throw error; return data; },
    () => local.insert("event_types", row),
  );
}

export async function updateEventType(id, updates) {
  return op(
    async () => { const { error } = await supabase.from("event_types").update(updates).eq("id", id); if (error) throw error; },
    () => local.update("event_types", id, updates),
  );
}

export async function deleteEventType(id) {
  return op(
    async () => { const { error } = await supabase.from("event_types").delete().eq("id", id); if (error) throw error; },
    () => local.remove("event_types", id),
  );
}

/* ── Initiatives ─────────────────────────────── */
export async function loadInitiatives(projectId) {
  return op(
    async () => {
      const userId = await uid();
      let query = supabase.from("initiatives").select("*").eq("user_id", userId);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("initiatives").filter((i) => !projectId || String(i.project_id) === String(projectId)),
  );
}

export async function newInitiative({ project_id, name, description, recurrence }) {
  const row = { project_id: project_id || null, name, description: description || "", recurrence: recurrence || "weekly", active: true };
  return op(
    async () => { const userId = await uid(); const { error } = await supabase.from("initiatives").insert({ user_id: userId, ...row }); if (error) throw error; },
    () => { local.insert("initiatives", row); },
  );
}

export async function updateInitiative(id, fields) {
  const patch = {};
  ["name", "description", "recurrence", "project_id", "active"].forEach((k) => { if (fields[k] !== undefined) patch[k] = fields[k]; });
  return op(
    async () => { const { error } = await supabase.from("initiatives").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("initiatives", id, patch),
  );
}

export async function deleteInitiative(id) {
  return op(
    async () => { const { error } = await supabase.from("initiatives").delete().eq("id", id); if (error) throw error; },
    () => local.remove("initiatives", id),
  );
}

/* ── Auth ────────────────────────────────────── */
export async function login(email, password) {
  if (isLocalMode()) { try { localStorage.setItem("localSession", "1"); } catch { /* noop */ } return { ok: true }; }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { ok: true };
}

// Resolves { ok: true, redirected: false } in local mode — the caller navigates
// with react-router. In Supabase mode the OAuth flow leaves the page, so the
// promise resolving means the redirect is under way.
export async function loginWithGoogle() {
  if (isLocalMode()) { try { localStorage.setItem("localSession", "1"); } catch { /* noop */ } return { ok: true, redirected: false }; }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/admin/dashboard` },
  });
  if (error) throw error;
  return { ok: true, redirected: true };
}

export async function logout() {
  if (isLocalMode()) { try { localStorage.removeItem("localSession"); } catch { /* noop */ } return; }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (isLocalMode()) return { user: { id: "local-user" } };
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/* ── AI Briefing ─────────────────────────────── */
export async function getAIBriefing({ reminders, events, projects, initiatives }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayIso = toDateStr(today); // local day, not UTC

  const todayTasks = reminders.filter((r) => !r.completed && r.date === todayIso).map((r) => `- ${r.name}`).join("\n") || "None";
  const upcomingTasks = reminders.filter((r) => !r.completed && r.date > todayIso).slice(0, 10).map((r) => `- ${r.name} (${r.date})`).join("\n") || "None";
  const upcomingEvents = events.filter((e) => e.date >= todayIso).slice(0, 8).map((e) => `- ${e.title} on ${e.date}${e.description ? `: ${e.description}` : ""}`).join("\n") || "None";
  const projectList = projects.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n") || "None";
  const initiativeList = initiatives.filter((i) => i.active).map((i) => `- ${i.name} (${i.recurrence})`).join("\n") || "None";

  const prompt = `You are a personal assistant for Scott. Today is ${todayStr}.

TASKS DUE TODAY:
${todayTasks}

UPCOMING TASKS:
${upcomingTasks}

UPCOMING EVENTS:
${upcomingEvents}

ACTIVE PROJECTS:
${projectList}

RECURRING INITIATIVES:
${initiativeList}

Write Scott a short, friendly, personalised morning briefing (3-5 sentences). Cover what's on today, anything notable this week, and a brief heads-up on any project needing attention. Be direct and practical — no bullet points, just natural prose.`;

  const response = await fetch("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }
  const result = await response.json();
  return result.content?.[0]?.text ?? "Unable to generate briefing.";
}

export async function loadAgentActions(limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];
  // Column is `agent_id` (Phase 0 renamed it from `tier`). Selecting the old
  // name made PostgREST error, and the `if (error) return []` below turned that
  // into a permanently empty "Frodo's recent actions" card.
  const { data, error } = await supabase
    .from("agent_actions")
    .select("id, agent_id, tool, collection, item_id, args, status, error, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

// Supabase storage usage (DB size + per-table + file buckets), via the
// storage_usage() RPC. Returns { db_bytes, tables[], buckets[], measured_at }
// or null when unavailable (local mode, signed out, or migration not yet run).
export async function loadStorageUsage() {
  if (isLocalMode()) return null;
  const { data, error } = await supabase.rpc("storage_usage");
  if (error) throw error;
  return data;
}

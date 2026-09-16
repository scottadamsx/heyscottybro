/**
 * The Library — one generic, token-lean gateway over every collection in the
 * planner, shared by all agent tiers (Frodo/Sam/Gandalf).
 *
 * Instead of one bespoke tool per table (which bloats the prompt and still
 * dumps whole collections into context), the agent browses like a librarian:
 *   - libraryCatalog()  → the card catalog: collections, fields, allowed ops
 *   - libraryQuery()    → filtered, field-projected, row-capped reads
 *   - libraryCreate / libraryUpdate / libraryDelete → validated writes
 *
 * Every write is checked against a per-collection field whitelist (types,
 * enums, required fields) BEFORE touching the API, so bad tool calls are
 * caught here with a corrective message the model can act on — the first
 * rung of the escalation safety net.
 */
import {
  loadReminders, newReminder, updateReminder, deleteReminder,
  loadEvents, newEvent, updateEvent, deleteEvent,
  loadProjects, newProject, updateProject, deleteProject,
  loadJournal, newJournalEntry, updateJournalEntry, deleteJournalEntry,
  loadInitiatives, newInitiative, updateInitiative, deleteInitiative,
  loadEventTypes, newEventType, updateEventType, deleteEventType,
  loadTransactions, newTransaction, updateTransaction, deleteTransaction,
  loadBudgetConfig,
  addRecurringBill, updateRecurringBill, deleteRecurringBill,
  addIncomeSource, updateIncomeSource, deleteIncomeSource,
} from "./plannerApi";
import { loadMembers, deleteMember } from "./hikerApi";
import { getSnippets, createSnippet, updateSnippet, deleteSnippet } from "./snippetsApi";
import { loadBugs, createBug, updateBug, deleteBug } from "./bugsApi";
import { loadBrain, createNode as createBrainNode, updateNode as updateBrainNode, deleteNode as deleteBrainNode } from "./brainApi";
import { loadCourses, createCourse, updateCourse, deleteCourse } from "./coursesApi";
import { loadWorkLog, createWorkLog, updateWorkLog, deleteWorkLog } from "./workLogApi";
import { loadAccountability, saveAccountability } from "./accountabilityApi";
import { getConnectionStatus, loadAgentActions } from "./plannerApi";
import { loadGrades } from "./gradesApi";
import { loadDocuments } from "./documentsApi";
import { loadReceipts } from "./groceryApi";
import { DEFAULT_CONFIG as UI_BUDGET_DEFAULTS } from "../components/budget/budgetSummary";
import { planReminderRows, normalizeTime } from "../utils/recurrence";
import { toDateStr } from "../utils/plannerUtils";
import { supabase } from "../utils/supabase";
import { uid as authUid } from "./_base";

/**
 * Transaction categories are NOT a constant: the Money space edits them
 * (budget_config.categories) and the UI falls back to budgetSummary's default
 * list. The old hardcoded enum here disagreed with both, so the agent was told
 * "Food" was valid while the UI offered "Groceries". Load at call time.
 */
export async function loadTxCategories() {
  try {
    const cfg = await loadBudgetConfig();
    const cats = Array.isArray(cfg?.categories) ? cfg.categories.filter((c) => typeof c === "string" && c.trim()) : [];
    if (cats.length) return cats;
  } catch (err) {
    console.error("[aiLibrary] couldn't load budget categories, using UI defaults:", err);
  }
  return [...UI_BUDGET_DEFAULTS.categories];
}

const RECUR = ["none", "daily", "weekly", "monthly"];
const SNIPPET_TYPES = ["code", "password", "wifi", "card", "note", "prompt", "other"];

/** Category field shared by transactions + recurring bills: validated against the LIVE list. */
const CATEGORY_FIELD = { type: "enum", dynamic: "categories", required: true, description: "One of Scott's budget categories (live list — see the situation block or query recurring_bills)" };

/* Field spec shorthand: { type, required?, values? (enum), dynamic? (enum resolved at call time), updateOnly?, long? (excluded from default projection) }
 * Collection extras: table? (PostgREST path), maxLimit?, confirmDelete (what a delete destroys), redact(row, opts) (post-read scrub), redactNeeds (columns redact() reads). */
const COLLECTIONS = {
  reminders: {
    table: "reminders",
    description: "Tasks & reminders (recurring supported)",
    dateField: "date",
    searchFields: ["name", "description"],
    defaultFields: ["id", "name", "date", "time", "recurrence", "recur_until", "completed", "project_id"],
    fields: {
      name: { type: "string", required: true },
      date: { type: "date" },
      time: { type: "time", description: "Clock time, HH:MM (24h) or \"8am\" — normalised to HH:MM on save" },
      description: { type: "string", long: true },
      recurrence: { type: "enum", values: RECUR },
      recur_until: { type: "date" },
      recur_times: { type: "number", description: "Occurrence cap PER ROW (a weekly row with recur_times 6 runs 6 weeks)" },
      weekdays: { type: "array", createOnly: true, description: "Weekly schedule on named days, e.g. [\"tue\",\"fri\"] — expands to one weekly row per day" },
      times_per_week: { type: "number", createOnly: true, description: "N times a week with no days named — auto-spaced (2 → Tue+Fri, 3 → Mon/Wed/Fri)" },
      weeks: { type: "number", createOnly: true, description: "How many weeks a weekly schedule runs (sets recur_times on every row)" },
      project_id: { type: "string" },
      course_id: { type: "string", description: "Link to a courses row — makes this a school deadline (shows in School + Plan)" },
      show_on_calendar: { type: "boolean" },
      completed: { type: "boolean", updateOnly: true },
    },
    load: loadReminders, create: createReminderPlanned, update: updateReminder, remove: deleteReminder,
    echoFields: ["id", "name", "date", "time", "recurrence", "recur_until", "recur_times", "project_id"],
  },
  habits: {
    // No `table`: trackers are a jsonb blob inside accountability_state (one
    // row per user), so there is no PostgREST path — reads go through load().
    description: "Habit / accountability trackers (Life › Habits). Each tracker is a habit Scott logs daily (checkbox) or tallies (count). Use log_habit to record a day.",
    searchFields: ["name"],
    defaultFields: ["id", "name", "emoji", "mode", "created"],
    confirmDelete: "Deleting a habit tracker also wipes ALL of its logged history — every day it was ever checked off is gone with it.",
    fields: {
      name: { type: "string", required: true },
      emoji: { type: "string" },
      mode: { type: "enum", values: ["check", "count"], description: "check = once a day, count = tally taps" },
      created: { type: "date", updateOnly: true },
    },
    load: async () => (await loadAccountability()).trackers,
    create: async (data) => {
      const state = await loadAccountability();
      const tracker = { id: crypto.randomUUID(), name: data.name, emoji: data.emoji || "", color: "var(--accent)", mode: data.mode || "check", created: toDateStr(new Date()) };
      await saveAccountability({ ...state, trackers: [...state.trackers, tracker] });
      return tracker;
    },
    update: async (id, data) => {
      const state = await loadAccountability();
      if (!state.trackers.some((t) => t.id === id)) throw new Error(`no habit tracker with id ${id}`);
      await saveAccountability({ ...state, trackers: state.trackers.map((t) => (t.id === id ? { ...t, ...data } : t)) });
    },
    remove: async (id) => {
      const state = await loadAccountability();
      await saveAccountability({ ...state, trackers: state.trackers.filter((t) => t.id !== id), logs: state.logs.filter((l) => l.trackerId !== id), misses: state.misses.filter((m) => m.trackerId !== id) });
    },
    echoFields: ["id", "name", "emoji", "mode"],
  },
  events: {
    table: "events",
    description: "Calendar events (recurring supported; event_type_id auto-creates dependency tasks)",
    dateField: "date",
    searchFields: ["title", "description"],
    defaultFields: ["id", "title", "date", "start_time", "end_time", "recurrence", "recur_until", "project_id", "event_type_id"],
    fields: {
      title: { type: "string", required: true },
      date: { type: "date", required: true },
      end_date: { type: "date", description: "Last day of a multi-day event (inclusive). Omit for a single day." },
      start_time: { type: "time", description: "HH:MM 24h — when it starts. Omit for all-day." },
      end_time: { type: "time", description: "HH:MM 24h — when it ends" },
      description: { type: "string", long: true },
      project_id: { type: "string" },
      event_type_id: { type: "string" },
      recurrence: { type: "enum", values: RECUR },
      recur_until: { type: "date" },
      recur_times: { type: "number" },
    },
    load: loadEvents, create: newEvent, update: updateEvent, remove: deleteEvent,
    echoFields: ["id", "title", "date", "end_date", "start_time", "end_time", "recurrence", "project_id"],
  },
  projects: {
    table: "projects",
    description: "Projects & nested sub-projects (delete cascades to tasks — needs confirm)",
    searchFields: ["name", "description"],
    defaultFields: ["id", "name", "color", "parent_id"],
    confirmDelete: "Deleting a project removes its tasks and sub-projects.",
    fields: {
      name: { type: "string", required: true },
      description: { type: "string", long: true },
      color: { type: "string" },
      parent_id: { type: "string" },
    },
    load: loadProjects, create: newProject, update: updateProject, remove: deleteProject,
  },
  journal: {
    table: "journal",
    description: "Journal entries (entry body is long — request the 'entry' field only when needed)",
    dateField: "date",
    searchFields: ["title", "entry"],
    defaultFields: ["id", "title", "date", "mood"],
    fields: {
      title: { type: "string", required: true },
      entry: { type: "string", required: true, long: true },
      date: { type: "date" },
      mood: { type: "string", description: "Free-text mood word for the day (the Overseer reads it)" },
    },
    load: loadJournal, create: newJournalEntry, update: updateJournalEntry, remove: deleteJournalEntry,
  },
  initiatives: {
    table: "initiatives",
    description: "Recurring commitments attached to projects",
    searchFields: ["name", "description"],
    defaultFields: ["id", "name", "recurrence", "project_id", "active"],
    fields: {
      name: { type: "string", required: true },
      description: { type: "string", long: true },
      recurrence: { type: "enum", values: ["daily", "weekly", "monthly"] },
      project_id: { type: "string" },
      active: { type: "boolean" },
    },
    load: () => loadInitiatives(), create: newInitiative, update: updateInitiative, remove: deleteInitiative,
  },
  event_types: {
    table: "event_types",
    description: "Event templates with auto-task dependencies (offset_days relative to event date)",
    searchFields: ["name"],
    defaultFields: ["id", "name", "color", "auto_tasks"],
    fields: {
      name: { type: "string", required: true },
      color: { type: "string" },
      auto_tasks: { type: "array" },
    },
    load: loadEventTypes, create: newEventType, update: updateEventType, remove: deleteEventType,
  },
  transactions: {
    table: "transactions",
    description: "Money in/out. type: expense | income | future (planned spend) | savings (money moved to savings — a transfer OUT of spendable cash, NOT an expense; use category 'Savings'). Amounts stored signed automatically.",
    dateField: "date",
    searchFields: ["description", "notes", "category"],
    defaultFields: ["id", "description", "amount", "type", "category", "date"],
    fields: {
      description: { type: "string", required: true },
      amount: { type: "number", required: true },
      type: { type: "enum", values: ["expense", "income", "future", "savings"], required: true },
      category: CATEGORY_FIELD,
      date: { type: "date", required: true },
      notes: { type: "string", long: true },
    },
    load: loadTransactions, create: newTransaction, update: updateTransaction, remove: deleteTransaction,
  },
  recurring_bills: {
    description: "Monthly bills/subscriptions (dueDay = day of month)",
    searchFields: ["name", "notes", "category"],
    defaultFields: ["id", "name", "amount", "category", "dueDay"],
    fields: {
      name: { type: "string", required: true },
      amount: { type: "number", required: true },
      category: CATEGORY_FIELD,
      startDate: { type: "date" },
      dueDay: { type: "number" },
      notes: { type: "string", long: true },
    },
    load: async () => (await loadBudgetConfig()).recurringBills || [],
    create: addRecurringBill, update: updateRecurringBill, remove: deleteRecurringBill,
  },
  income_sources: {
    description: "Recurring monthly income",
    searchFields: ["name", "notes"],
    defaultFields: ["id", "name", "amount", "startDate", "endDate"],
    fields: {
      name: { type: "string", required: true },
      amount: { type: "number", required: true },
      startDate: { type: "date" },
      endDate: { type: "date" },
      notes: { type: "string", long: true },
    },
    load: async () => (await loadBudgetConfig()).incomeSources || [],
    create: addIncomeSource, update: updateIncomeSource, remove: deleteIncomeSource,
  },
  hikers: {
    description: "SJHC hike club members (read + delete only; use search, the list is large)",
    searchFields: ["first", "last", "email"],
    defaultFields: ["id", "first", "last", "email", "attendance"],
    fields: {}, // read-only — no create/update
    load: () => loadMembers(""), loadSearch: (q) => loadMembers(q), remove: deleteMember,
  },
  snippets: {
    table: "snippets",
    description: "The Vault — saved passwords, codes, Wi-Fi logins, cards, notes, prompts. type tells you what it is; value is the stored content. For rows with secret: true the value is WITHHELD from query results unless you pass reveal: true — only do that when Scott explicitly asks for the secret itself.",
    searchFields: ["title", "value", "notes"],
    defaultFields: ["id", "title", "type", "secret", "notes"],
    fields: {
      title: { type: "string", required: true },
      value: { type: "string", required: true, long: true },
      type: { type: "enum", values: SNIPPET_TYPES },
      secret: { type: "boolean" },
      notes: { type: "string", long: true },
    },
    // Secrets never leave the Vault by accident: a secret row's value is
    // replaced unless the query says reveal: true (QF-10 in spirit — the
    // agent transcript is persisted, so a leaked value would be stored twice).
    redactNeeds: ["secret"],
    redact: (row, { reveal } = {}) => (row?.secret === true && !reveal && row.value !== undefined
      ? { ...row, value: "[secret — withheld; re-query with reveal: true if Scott asked for it]" }
      : row),
    load: getSnippets, create: createSnippet, update: updateSnippet, remove: deleteSnippet,
  },
  bugs: {
    table: "bugs",
    description: "Bug & feature-request tracker (Tools › Bugs). type 'bug' logs an app issue, type 'feature' logs a feature request. Track status open → resolved. Use export_bugs to download a zip report. Screenshots are added by Scott in the UI.",
    searchFields: ["title", "description", "page"],
    defaultFields: ["id", "title", "type", "page", "priority", "status", "created_at"],
    fields: {
      title: { type: "string", required: true },
      type: { type: "enum", values: ["bug", "feature"] },
      description: { type: "string", long: true },
      steps: { type: "string", long: true },
      page: { type: "string" },
      priority: { type: "enum", values: ["low", "medium", "high", "critical"] },
      status: { type: "enum", values: ["open", "in_progress", "resolved", "closed"], updateOnly: true },
      notes: { type: "string", long: true, updateOnly: true },
    },
    load: loadBugs, create: createBug, update: updateBug, remove: deleteBug,
  },
  work_log: {
    table: "work_log",
    description: "Daily work log (Plan › Work): what Scott did, notes, and the project it was for",
    dateField: "date",
    searchFields: ["task", "notes"],
    defaultFields: ["id", "date", "task", "project_id", "minutes"],
    fields: {
      date: { type: "date", required: true },
      task: { type: "string", required: true },
      notes: { type: "string", long: true },
      project_id: { type: "string" },
      minutes: { type: "number" },
    },
    load: loadWorkLog, create: createWorkLog, update: updateWorkLog, remove: deleteWorkLog,
    echoFields: ["id", "date", "task", "project_id", "minutes"],
  },
  courses: {
    table: "courses",
    description: "School courses (School space). Deadlines are reminders with course_id set; grades live in the Grade Tracker. Use this to answer 'what courses is Scott taking' and to tag school deadlines.",
    searchFields: ["code", "name", "instructor"],
    defaultFields: ["id", "code", "name", "term", "instructor", "target_grade"],
    fields: {
      code: { type: "string", required: true },
      name: { type: "string", required: true },
      term: { type: "string" },
      instructor: { type: "string" },
      target_grade: { type: "number" },
    },
    load: () => loadCourses({ includeArchived: true }), create: createCourse, update: updateCourse, remove: deleteCourse,
  },
  brain: {
    table: "brain_nodes",
    description: "Scott's knowledge graph / second brain (Tools › Brain) — notes synced from his Obsidian + Claude memory vault. Each node is a markdown note; body holds its content. Read to recall context about Scott, his projects, and decisions.",
    searchFields: ["title", "body", "slug"],
    defaultFields: ["id", "slug", "title", "type", "tags"],
    fields: {
      slug: { type: "string", required: true },
      title: { type: "string", required: true },
      body: { type: "string", long: true },
      type: { type: "string" },
      tags: { type: "array" },
      source: { type: "string" },
    },
    load: brainLoadNodes, create: createBrainNode, update: updateBrainNode, remove: deleteBrainNode,
  },

  // ── Read-only shelves (query only) ─────────────────────────────────────────
  // Same registration shape; no create/update/remove, so the catalog lists
  // "query" alone and the write tools refuse them with a clear message.
  grades: {
    table: "grades",
    description: "Grade Tracker assessments (School › Grades) — read-only. earned is null until graded; weight is % of the final mark. course is the course code/name text.",
    searchFields: ["course", "name", "feedback"],
    defaultFields: ["id", "course", "name", "earned", "max", "weight"],
    fields: {
      course: { type: "string" },
      name: { type: "string" },
      earned: { type: "number" },
      max: { type: "number" },
      weight: { type: "number" },
      feedback: { type: "string", long: true },
    },
    load: loadGrades,
  },
  documents: {
    table: "documents",
    description: "Uploaded documents (School › Documents / Vault) — METADATA ONLY, read-only. You can see what exists (name, type, size, tags) but not the file contents.",
    searchFields: ["name", "filename", "description"],
    defaultFields: ["id", "name", "filename", "mime_type", "size_bytes", "tags", "created_at"],
    fields: {
      name: { type: "string" },
      filename: { type: "string" },
      mime_type: { type: "string" },
      size_bytes: { type: "number" },
      description: { type: "string", long: true },
      tags: { type: "array" },
    },
    load: loadDocuments,
  },
  receipts: {
    // No `table`: the loader joins the store name + item count, which the raw
    // grocery_receipts row doesn't carry.
    description: "Grocery receipts (Money › Receipts) — read-only. One row per shop: store_name, purchase_date, total, and how many line items were read.",
    dateField: "purchase_date",
    searchFields: ["store_name"],
    defaultFields: ["id", "purchase_date", "store_name", "subtotal", "total", "item_count"],
    fields: {
      purchase_date: { type: "date" },
      store_name: { type: "string" },
      subtotal: { type: "number" },
      total: { type: "number" },
      item_count: { type: "number" },
    },
    load: loadReceipts,
  },
  agent_actions: {
    table: "agent_actions",
    description: "The agents' own audit trail — read-only, most recent 50 at most. Every write tool call by any agent (tool, collection, item_id, ok/error). Use it to check what you or another agent already did before repeating it.",
    dateField: "created_at",
    maxLimit: 50,
    searchFields: ["tool", "collection", "error"],
    defaultFields: ["id", "agent_id", "tool", "collection", "item_id", "status", "error", "created_at"],
    fields: {
      agent_id: { type: "string" },
      tool: { type: "string" },
      collection: { type: "string" },
      item_id: { type: "string" },
      status: { type: "enum", values: ["ok", "error"] },
      error: { type: "string", long: true },
      args: { type: "string", long: true },
    },
    load: () => loadAgentActions(50),
  },
};

// brain_nodes loader: the library expects an array of rows.
async function brainLoadNodes() {
  const { nodes } = await loadBrain();
  return nodes;
}

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_STR = 280;

const truncate = (v) => (typeof v === "string" && v.length > MAX_STR ? `${v.slice(0, MAX_STR)}…` : v);

function project(row, fields) {
  const out = { id: row.id };
  fields.forEach((f) => { if (f !== "id" && row[f] !== undefined) out[f] = truncate(row[f]); });
  return out;
}

/**
 * Coerce the tool's `data` argument into a plain field→value object.
 * Some tool-call paths wrap the object in a single-element array
 * (e.g. `[{ name: "x" }]`), which made Object.entries() read positional
 * indexes as field names and reject every real field as "unknown". Unwrap
 * that case; reject anything else that isn't a plain object.
 */
function normalizeData(data) {
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) return data[0];
    return null; // a real array isn't a valid record body
  }
  if (data && typeof data === "object") return data;
  return null;
}

/** A real calendar date — "2026-02-31" has the right shape but isn't one. */
export function isRealDate(v) {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Resolve enums that depend on live data (budget categories) once per write. */
async function resolveDynamicEnums(spec) {
  const out = {};
  for (const [k, f] of Object.entries(spec.fields)) {
    if (f.dynamic === "categories") out[k] = await loadTxCategories();
  }
  return out;
}

/** enums: { field: [...] } for dynamic enum fields (from resolveDynamicEnums). */
function validate(spec, data, { partial, enums = {} }) {
  const errors = [];
  const clean = {};
  const allowed = Object.keys(spec.fields);
  const record = normalizeData(data);
  if (record === null) {
    return { errors: [`data must be an object of field values (got ${Array.isArray(data) ? "an array" : typeof data})`], clean };
  }
  for (const [k, v] of Object.entries(record)) {
    const f = spec.fields[k];
    if (!f) { errors.push(`unknown field "${k}" — allowed: ${allowed.join(", ")}`); continue; }
    if (!partial && f.updateOnly) { errors.push(`"${k}" can only be set on update`); continue; }
    if (partial && f.createOnly) { errors.push(`"${k}" can only be set on create — edit date/recurrence directly instead`); continue; }
    if (v == null) { clean[k] = v; continue; }
    if (f.type === "enum") {
      const values = f.dynamic ? (enums[k] || []) : f.values;
      if (!values.includes(v)) errors.push(`${k} must be one of: ${values.join(" | ")}`);
    }
    else if (f.type === "number" && Number.isNaN(Number(v))) errors.push(`${k} must be a number`);
    else if (f.type === "date" && !isRealDate(v)) errors.push(`${k} must be a real calendar date, YYYY-MM-DD (got "${v}")`);
    else if (f.type === "time") {
      // Accept "8am" / "8:30 pm" / "20:30", store HH:MM 24h only.
      const t = normalizeTime(v);
      if (!t) { errors.push(`${k} must be a clock time as HH:MM (24h), e.g. "08:30" or "20:15" (got "${v}")`); continue; }
      clean[k] = t;
      continue;
    }
    else if (f.type === "array" && !Array.isArray(v)) errors.push(`${k} must be an array`);
    else if (f.type === "boolean" && typeof v !== "boolean") errors.push(`${k} must be true or false`);
    clean[k] = v;
  }
  if (!partial) {
    for (const [k, f] of Object.entries(spec.fields)) {
      if (f.required && (clean[k] == null || clean[k] === "")) errors.push(`missing required field "${k}"`);
    }
  }
  return { errors, clean };
}

function getSpec(collection) {
  const spec = COLLECTIONS[collection];
  if (!spec) throw new Error(`unknown collection "${collection}" — one of: ${COLLECTION_NAMES.join(", ")}`);
  return spec;
}

/** Catalog rendering of one field's type: "enum (a|b)", "enum (live budget categories)", "date*", "time". */
const fieldTypeLabel = (f) =>
  `${f.type}${f.required ? "*" : ""}${f.dynamic === "categories" ? " (live budget categories)" : f.values ? ` (${f.values.join("|")})` : ""}`;

/** The card catalog. Counts are optional because they require loading every shelf. */
export async function libraryCatalog({ include_counts = false } = {}) {
  const catalog = {};
  for (const [name, spec] of Object.entries(COLLECTIONS)) {
    catalog[name] = {
      description: spec.description,
      fields: Object.fromEntries(Object.entries(spec.fields).map(([k, f]) => [k, fieldTypeLabel(f)])),
      operations: [
        "query",
        ...(spec.create ? ["create"] : []),
        ...(spec.update ? ["update"] : []),
        ...(spec.remove ? ["delete"] : []),
      ],
    };
    if (include_counts) {
      try { catalog[name].count = (await spec.load()).length; }
      catch (err) { catalog[name].count_error = err.message; }
    }
  }
  return { collections: catalog };
}

/**
 * Server-side query path (Phase 5): for collections that map 1:1 to a table,
 * push where/search/date/order/limit down to PostgREST instead of loading the
 * whole table into the browser and filtering in JS. Falls back to the legacy
 * in-JS path on any error (offline/local mode/odd filters).
 */
async function queryTable(spec, { fields, where, search, date_from, date_to, limit, offset = 0, order_by, direction, mode = "rows", reveal = false }) {
  const userId = await authUid();
  const lim = Math.min(Number(limit) || DEFAULT_LIMIT, spec.maxLimit || MAX_LIMIT);
  const wanted = Array.isArray(fields) && fields.length
    ? ["id", ...fields.filter((f) => f !== "id" && (spec.fields[f] || spec.defaultFields.includes(f)))]
    : spec.defaultFields;
  // Columns the redaction hook needs even when the caller didn't ask for them.
  const selectCols = [...new Set([...wanted, ...(spec.redactNeeds || [])])].join(",");
  const scrub = (r) => (spec.redact ? spec.redact(r, { reveal }) : r);
  const asc = (direction || spec.defaultDirection) !== "desc";

  const apply = (q) => {
    q = q.eq("user_id", userId);
    if (where && typeof where === "object") {
      for (const [k, v] of Object.entries(where)) {
        if (k !== "id" && !spec.fields[k] && !spec.defaultFields.includes(k)) throw new Error(`unknown field "${k}"`);
        q = q.eq(k, v);
      }
    }
    if (search && spec.searchFields?.length) {
      const safe = String(search).replace(/[%,()]/g, " ").trim();
      if (safe) q = q.or(spec.searchFields.map((f) => `${f}.ilike.%${safe}%`).join(","));
    }
    if (spec.dateField && date_from) q = q.gte(spec.dateField, date_from);
    if (spec.dateField && date_to) q = q.lte(spec.dateField, date_to);
    return q;
  };

  if (mode === "count") {
    const { count, error } = await apply(supabase.from(spec.table).select("id", { count: "exact", head: true }));
    if (error) throw error;
    return { collection: spec.__name, count: count ?? 0 };
  }

  if (mode === "summary") {
    const { count, error } = await apply(supabase.from(spec.table).select("id", { count: "exact", head: true }));
    if (error) throw error;
    const { data: sample, error: e2 } = await apply(supabase.from(spec.table).select(selectCols)).limit(5);
    if (e2) throw e2;
    const out = { collection: spec.__name, count: count ?? 0, sample: (sample || []).map((r) => project(scrub(r), wanted)) };
    if (spec.dateField && count > 0) {
      const { data: lo } = await apply(supabase.from(spec.table).select(spec.dateField)).order(spec.dateField, { ascending: true }).limit(1);
      const { data: hi } = await apply(supabase.from(spec.table).select(spec.dateField)).order(spec.dateField, { ascending: false }).limit(1);
      if (lo?.[0]) out.earliest = lo[0][spec.dateField];
      if (hi?.[0]) out.latest = hi[0][spec.dateField];
    }
    return out;
  }

  let q = apply(supabase.from(spec.table).select(selectCols, { count: "exact" }));
  q = q.order(order_by && (spec.fields[order_by] || spec.defaultFields.includes(order_by)) ? order_by : (spec.dateField || "created_at"), { ascending: asc });
  q = q.range(offset, offset + lim - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  const capped = spec.maxLimit && (count ?? 0) > spec.maxLimit;
  return {
    collection: spec.__name,
    total: count ?? (data || []).length,
    returned: (data || []).length,
    ...((count ?? 0) > offset + lim && !capped ? { next_offset: offset + lim } : {}),
    ...(capped ? { note: `this collection serves at most the ${spec.maxLimit} most recent rows` } : {}),
    items: (data || []).map((r) => project(scrub(r), wanted)),
  };
}

export async function libraryQuery({ collection, fields, where, search, date_from, date_to, limit, offset = 0, order_by, direction, mode = "rows", reveal = false }) {
  const spec = getSpec(collection);
  let warning;
  if (spec.table) {
    try {
      return await queryTable({ ...spec, __name: collection }, { fields, where, search, date_from, date_to, limit, offset, order_by, direction, mode, reveal });
    } catch (err) {
      // QF-3: never swallow. Log it, then answer from the in-JS path and SAY
      // that we did — a server-side failure the agent can't see is how "the
      // query worked" turns into a wrong answer.
      console.error(`[aiLibrary] server-side query on "${collection}" failed; answering from a full in-browser load:`, err);
      warning = `server-side query failed (${err?.message || err}); this answer comes from a full in-browser load of ${collection}${getConnectionStatus() === false ? " — Supabase is unreachable, so it may be THIS BROWSER's local copy only" : ""}.`;
    }
  }

  // Hikers can filter server-side on search — cheaper than loading the whole club.
  let rows = search && spec.loadSearch ? await spec.loadSearch(search) : await spec.load();
  if (spec.redact) rows = rows.map((r) => spec.redact(r, { reveal }));
  const withWarning = (out) => (warning ? { ...out, warning } : out);

  if (where && typeof where === "object") {
    for (const [k, v] of Object.entries(where)) {
      if (k !== "id" && !spec.fields[k] && !spec.defaultFields.includes(k)) {
        return { error: `cannot filter on unknown field "${k}"` };
      }
      rows = rows.filter((r) => String(r[k]) === String(v) || r[k] === v);
    }
  }
  if (search && !spec.loadSearch) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => spec.searchFields.some((f) => String(r[f] || "").toLowerCase().includes(q)));
  }
  if (spec.dateField && (date_from || date_to)) {
    rows = rows.filter((r) => {
      const d = r[spec.dateField];
      if (!d) return false;
      return (!date_from || d >= date_from) && (!date_to || d <= date_to);
    });
  }
  if (order_by) {
    const dir = direction === "desc" ? -1 : 1;
    rows = rows.slice().sort((a, b) => String(a[order_by] ?? "").localeCompare(String(b[order_by] ?? "")) * dir);
  }

  if (mode === "count") return withWarning({ collection, count: rows.length });

  if (mode === "summary") {
    const dates = spec.dateField ? rows.map((r) => r[spec.dateField]).filter(Boolean).sort() : [];
    return withWarning({
      collection,
      count: rows.length,
      ...(dates.length ? { earliest: dates[0], latest: dates[dates.length - 1] } : {}),
      sample: rows.slice(0, 5).map((r) => project(r, spec.defaultFields)),
    });
  }

  const lim = Math.min(Number(limit) || DEFAULT_LIMIT, spec.maxLimit || MAX_LIMIT);
  const wanted = Array.isArray(fields) && fields.length
    ? fields.filter((f) => f === "id" || spec.fields[f] || spec.defaultFields.includes(f))
    : spec.defaultFields;
  const page = rows.slice(offset, offset + lim);
  return withWarning({
    collection,
    total: rows.length,
    returned: page.length,
    ...(rows.length > offset + lim ? { next_offset: offset + lim } : {}),
    items: page.map((r) => project(r, wanted)),
  });
}

/**
 * Find one row by id, or null. Table-backed shelves ask PostgREST (scoped to
 * the user); blob/derived shelves scan their loader. Used to verify writes
 * actually had a target — the APIs' update/delete calls return nothing useful
 * when 0 rows match, which is how "updated!" got reported for a bad id.
 */
async function findRow(spec, id) {
  if (spec.table && getConnectionStatus() !== false) {
    try {
      const userId = await authUid();
      const { data, error } = await supabase.from(spec.table).select(selectForEcho(spec)).eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (err) {
      console.error(`[aiLibrary] lookup of ${spec.table}/${id} failed; falling back to a full load:`, err);
    }
  }
  const rows = await spec.load();
  return rows.find((r) => String(r.id) === String(id)) || null;
}

const selectForEcho = (spec) => [...new Set(["id", ...(spec.echoFields || spec.defaultFields || [])])].join(",");

const localOnlyWarning = () => (getConnectionStatus() === false
  ? "Supabase was unreachable — this was saved to THIS BROWSER's local storage only and will not appear on other devices. Tell Scott plainly."
  : undefined);

/** Reminders: derive dates/time/spacing deterministically, then insert one row per planned occurrence. */
async function createReminderPlanned(clean) {
  const now = new Date();
  let plan;
  try {
    plan = planReminderRows(clean, { todayStr: toDateStr(now), nowMinutes: now.getHours() * 60 + now.getMinutes() });
  } catch (e) {
    throw new Error(`reminder not created: ${e.message}`);
  }
  const rows = [];
  for (const r of plan.rows) rows.push(await newReminder(r));
  const first = rows[0] || {};
  return { ...first, _rows: rows, _notes: plan.notes };
}

function echo(spec, row) {
  if (!row || typeof row !== "object") return undefined;
  const keys = spec.echoFields || spec.defaultFields || ["id"];
  const out = {};
  for (const k of keys) if (row[k] != null) out[k] = row[k];
  return out;
}

export async function libraryCreate({ collection, data }) {
  const spec = getSpec(collection);
  if (!spec.create) return { error: `${collection} is read-only` };
  const enums = await resolveDynamicEnums(spec);
  const { errors, clean } = validate(spec, data, { partial: false, enums });
  if (errors.length) return { error: `validation failed: ${errors.join("; ")}` };
  const created = await spec.create(clean);
  const result = { success: true, ...(created?.id ? { id: created.id } : {}) };
  // Echo what was actually stored so the model confirms real values, not what it hoped it sent.
  if (Array.isArray(created?._rows) && created._rows.length > 1) result.created = created._rows.map((r) => echo(spec, r));
  else if (created) result.created = echo(spec, created);
  if (created?._notes?.length) result.notes = created._notes;
  const warning = localOnlyWarning();
  if (warning) result.warning = warning;
  return result;
}

export async function libraryUpdate({ collection, id, data }) {
  const spec = getSpec(collection);
  if (!spec.update) return { error: `${collection} cannot be updated` };
  if (!id) return { error: "id is required — get it from query first" };
  const enums = await resolveDynamicEnums(spec);
  const { errors, clean } = validate(spec, data, { partial: true, enums });
  if (errors.length) return { error: `validation failed: ${errors.join("; ")}` };
  if (!Object.keys(clean).length) return { error: "no fields to update" };
  // Verify the target exists BEFORE writing: the underlying update matches 0
  // rows silently for a wrong id, and this used to report success anyway.
  const before = await findRow(spec, id);
  if (!before) return { error: `no row with id ${id} in ${collection} — query for the real id first` };
  await spec.update(id, clean);
  const after = await findRow(spec, id);
  const result = { success: true, id, updated: Object.keys(clean) };
  if (after) result.now = echo(spec, after);
  else result.warning = `the update ran, but ${collection}/${id} could not be read back afterwards — confirm it in the UI before telling Scott it's done`;
  const warning = localOnlyWarning();
  if (warning) result.warning = result.warning ? `${result.warning}. ${warning}` : warning;
  return result;
}

const DEFAULT_CONFIRM = "Deletes are permanent — there is no undo.";

export async function libraryDelete({ collection, id, confirm }) {
  const spec = getSpec(collection);
  if (!spec.remove) return { error: `${collection} cannot be deleted` };
  if (!id) return { error: "id is required — get it from query first" };
  const target = await findRow(spec, id);
  if (!target) return { error: `no row with id ${id} in ${collection} — nothing was deleted; query for the real id first` };
  // EVERY delete needs confirm: true — the tool result names exactly what
  // would go so the agent can put a real question to Scott, not a vague one.
  if (confirm !== true) {
    return {
      error: `NOT deleted — confirmation required. ${spec.confirmDelete || DEFAULT_CONFIRM} Tell Scott exactly what would be deleted (below), get a clear yes, then retry with confirm: true.`,
      would_delete: { collection, ...echo(spec, target) },
    };
  }
  await spec.remove(id);
  const still = await findRow(spec, id);
  if (still) return { error: `delete ran but ${collection}/${id} is still there — the API reported no error; check the UI and tell Scott it did NOT delete` };
  const result = { success: true, deleted: { collection, ...echo(spec, target) } };
  const warning = localOnlyWarning();
  if (warning) result.warning = warning;
  return result;
}

/** Compact catalog block baked into the system prompt so the model knows the shelves without spending a tool call. */
export function catalogPromptBlock() {
  return Object.entries(COLLECTIONS)
    .map(([name, spec]) => {
      const fields = Object.entries(spec.fields)
        .map(([k, f]) => `${k}${f.required ? "*" : ""}${f.dynamic === "categories" ? "(live budget categories)" : f.values ? `(${f.values.join("|")})` : ""}`)
        .join(", ");
      const ro = !spec.create && !spec.update && !spec.remove ? " [read-only]" : "";
      return `- ${name}${ro}: ${spec.description}${fields ? ` — fields: ${fields}` : ""}`;
    })
    .join("\n");
}

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

export const TX_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Housing", "Car", "Subscriptions", "Travel", "Other"];

const RECUR = ["none", "daily", "weekly", "monthly"];
const SNIPPET_TYPES = ["code", "password", "wifi", "card", "note", "prompt", "other"];

/* Field spec shorthand: { type, required?, values? (enum), updateOnly?, long? (excluded from default projection) } */
const COLLECTIONS = {
  reminders: {
    description: "Tasks & reminders (recurring supported)",
    dateField: "date",
    searchFields: ["name", "description"],
    defaultFields: ["id", "name", "date", "time", "recurrence", "recur_until", "completed", "project_id"],
    fields: {
      name: { type: "string", required: true },
      date: { type: "date" },
      time: { type: "string" },
      description: { type: "string", long: true },
      recurrence: { type: "enum", values: RECUR },
      recur_until: { type: "date" },
      recur_times: { type: "number" },
      project_id: { type: "string" },
      show_on_calendar: { type: "boolean" },
      completed: { type: "boolean", updateOnly: true },
    },
    load: loadReminders, create: newReminder, update: updateReminder, remove: deleteReminder,
  },
  events: {
    description: "Calendar events (recurring supported; event_type_id auto-creates dependency tasks)",
    dateField: "date",
    searchFields: ["title", "description"],
    defaultFields: ["id", "title", "date", "recurrence", "recur_until", "project_id", "event_type_id"],
    fields: {
      title: { type: "string", required: true },
      date: { type: "date", required: true },
      description: { type: "string", long: true },
      project_id: { type: "string" },
      event_type_id: { type: "string" },
      recurrence: { type: "enum", values: RECUR },
      recur_until: { type: "date" },
      recur_times: { type: "number" },
    },
    load: loadEvents, create: newEvent, update: updateEvent, remove: deleteEvent,
  },
  projects: {
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
    description: "Journal entries (entry body is long — request the 'entry' field only when needed)",
    dateField: "date",
    searchFields: ["title", "entry"],
    defaultFields: ["id", "title", "date"],
    fields: {
      title: { type: "string", required: true },
      entry: { type: "string", required: true, long: true },
      date: { type: "date" },
    },
    load: loadJournal, create: newJournalEntry, update: updateJournalEntry, remove: deleteJournalEntry,
  },
  initiatives: {
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
    description: "Money in/out. type: expense | income | future (planned spend). Amounts stored signed automatically.",
    dateField: "date",
    searchFields: ["description", "notes", "category"],
    defaultFields: ["id", "description", "amount", "type", "category", "date"],
    fields: {
      description: { type: "string", required: true },
      amount: { type: "number", required: true },
      type: { type: "enum", values: ["expense", "income", "future"], required: true },
      category: { type: "enum", values: TX_CATEGORIES, required: true },
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
      category: { type: "enum", values: TX_CATEGORIES, required: true },
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
    description: "The Vault — saved passwords, codes, Wi-Fi logins, cards, notes, prompts. 'secret' items are hidden in the UI by default. type tells you what it is; value is the stored secret.",
    searchFields: ["title", "value", "notes"],
    defaultFields: ["id", "title", "type", "secret", "notes"],
    fields: {
      title: { type: "string", required: true },
      value: { type: "string", required: true, long: true },
      type: { type: "enum", values: SNIPPET_TYPES },
      secret: { type: "boolean" },
      notes: { type: "string", long: true },
    },
    load: getSnippets, create: createSnippet, update: updateSnippet, remove: deleteSnippet,
  },
};

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

function validate(spec, data, { partial }) {
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
    if (v == null) { clean[k] = v; continue; }
    if (f.type === "enum" && !f.values.includes(v)) errors.push(`${k} must be one of: ${f.values.join(" | ")}`);
    else if (f.type === "number" && Number.isNaN(Number(v))) errors.push(`${k} must be a number`);
    else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errors.push(`${k} must be YYYY-MM-DD`);
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

/** The card catalog. Counts are optional because they require loading every shelf. */
export async function libraryCatalog({ include_counts = false } = {}) {
  const catalog = {};
  for (const [name, spec] of Object.entries(COLLECTIONS)) {
    catalog[name] = {
      description: spec.description,
      fields: Object.fromEntries(Object.entries(spec.fields).map(([k, f]) => [k, `${f.type}${f.required ? "*" : ""}${f.values ? ` (${f.values.join("|")})` : ""}`])),
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

export async function libraryQuery({ collection, fields, where, search, date_from, date_to, limit, offset = 0, order_by, direction, mode = "rows" }) {
  const spec = getSpec(collection);

  // Hikers can filter server-side on search — cheaper than loading the whole club.
  let rows = search && spec.loadSearch ? await spec.loadSearch(search) : await spec.load();

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

  if (mode === "count") return { collection, count: rows.length };

  if (mode === "summary") {
    const dates = spec.dateField ? rows.map((r) => r[spec.dateField]).filter(Boolean).sort() : [];
    return {
      collection,
      count: rows.length,
      ...(dates.length ? { earliest: dates[0], latest: dates[dates.length - 1] } : {}),
      sample: rows.slice(0, 5).map((r) => project(r, spec.defaultFields)),
    };
  }

  const lim = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const wanted = Array.isArray(fields) && fields.length
    ? fields.filter((f) => f === "id" || spec.fields[f] || spec.defaultFields.includes(f))
    : spec.defaultFields;
  const page = rows.slice(offset, offset + lim);
  return {
    collection,
    total: rows.length,
    returned: page.length,
    ...(rows.length > offset + lim ? { next_offset: offset + lim } : {}),
    items: page.map((r) => project(r, wanted)),
  };
}

export async function libraryCreate({ collection, data }) {
  const spec = getSpec(collection);
  if (!spec.create) return { error: `${collection} is read-only` };
  const { errors, clean } = validate(spec, data, { partial: false });
  if (errors.length) return { error: `validation failed: ${errors.join("; ")}` };
  const created = await spec.create(clean);
  return { success: true, ...(created?.id ? { id: created.id } : {}) };
}

export async function libraryUpdate({ collection, id, data }) {
  const spec = getSpec(collection);
  if (!spec.update) return { error: `${collection} cannot be updated` };
  if (!id) return { error: "id is required — get it from query first" };
  const { errors, clean } = validate(spec, data, { partial: true });
  if (errors.length) return { error: `validation failed: ${errors.join("; ")}` };
  if (!Object.keys(clean).length) return { error: "no fields to update" };
  await spec.update(id, clean);
  return { success: true };
}

export async function libraryDelete({ collection, id, confirm }) {
  const spec = getSpec(collection);
  if (!spec.remove) return { error: `${collection} cannot be deleted` };
  if (!id) return { error: "id is required — get it from query first" };
  if (spec.confirmDelete && !confirm) {
    return { error: `${spec.confirmDelete} Ask Scott to confirm, then retry with confirm: true.` };
  }
  await spec.remove(id);
  return { success: true };
}

/** Compact catalog block baked into the system prompt so the model knows the shelves without spending a tool call. */
export function catalogPromptBlock() {
  return Object.entries(COLLECTIONS)
    .map(([name, spec]) => {
      const fields = Object.entries(spec.fields)
        .map(([k, f]) => `${k}${f.required ? "*" : ""}${f.values ? `(${f.values.join("|")})` : ""}`)
        .join(", ");
      return `- ${name}: ${spec.description}${fields ? ` — fields: ${fields}` : ""}`;
    })
    .join("\n");
}

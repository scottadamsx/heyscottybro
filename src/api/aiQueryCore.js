/**
 * Pure query behavior shared by the Library's remote and local paths.
 *
 * Keeping predicate validation here prevents the local/offline fallback from
 * quietly answering a different question than the normal data path.
 */
import { expandEvents, expandReminders } from "../utils/plannerUtils.js";

const FILTER_OPERATORS = new Set(["in", "gt", "gte", "lt", "lte", "contains"]);

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const equal = (left, right) => String(left) === String(right) || left === right;

function validField(spec, field) {
  return field === "id" || Boolean(spec.fields[field]) || spec.defaultFields.includes(field);
}

function fieldType(spec, field) {
  return spec.fields[field]?.type || "string";
}

function validateOperator(spec, field, operator, operand) {
  if (!FILTER_OPERATORS.has(operator)) return `unsupported operator "${operator}" for "${field}"`;
  const type = fieldType(spec, field);
  if (operator === "in") return Array.isArray(operand) && operand.length ? null : `"${field}.in" must be a non-empty array`;
  if (operator === "contains") return ["string", "array"].includes(type) && typeof operand === "string"
    ? null : `"${field}.contains" requires a string field/term`;
  if (["gt", "gte", "lt", "lte"].includes(operator) && !["number", "date", "time"].includes(type)) {
    return `"${field}.${operator}" is only supported for number, date, or time fields`;
  }
  if (type === "number" && !Number.isFinite(Number(operand))) return `"${field}.${operator}" requires a number`;
  if ((type === "date" || type === "time") && typeof operand !== "string") return `"${field}.${operator}" requires a string`;
  return null;
}

function validateCondition(spec, condition, { allowOr = false } = {}) {
  if (!isPlainObject(condition)) return "where must be an object";
  for (const [field, value] of Object.entries(condition)) {
    if (field === "or") {
      if (!allowOr) return "nested OR conditions are not supported";
      if (!Array.isArray(value) || value.length === 0) return "or must be a non-empty array of conditions";
      for (const alternative of value) {
        const error = validateCondition(spec, alternative);
        if (error) return error;
      }
      continue;
    }
    if (!validField(spec, field)) return `cannot filter on unknown field "${field}"`;
    if (!isPlainObject(value)) continue; // Existing exact-match syntax.
    const ops = Object.entries(value);
    if (!ops.length) return `filter for "${field}" must not be empty`;
    for (const [operator, operand] of ops) {
      const error = validateOperator(spec, field, operator, operand);
      if (error) return error;
    }
  }
  return null;
}

/** Validate the public `where` shape before any data source is called. */
export function validateLibraryWhere(spec, where) {
  if (where == null) return null;
  return validateCondition(spec, where, { allowOr: true });
}

function matchesOperator(value, operator, operand) {
  if (operator === "in") return operand.some((candidate) => equal(value, candidate));
  if (operator === "contains") {
    const term = operand.toLowerCase();
    if (Array.isArray(value)) return value.some((entry) => String(entry ?? "").toLowerCase().includes(term));
    return String(value ?? "").toLowerCase().includes(term);
  }
  const left = typeof value === "number" ? value : String(value ?? "");
  const right = typeof value === "number" ? Number(operand) : String(operand);
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "lt") return left < right;
  return left <= right;
}

function matchesCondition(row, condition) {
  return Object.entries(condition).every(([field, value]) => {
    if (field === "or") return value.some((alternative) => matchesCondition(row, alternative));
    if (!isPlainObject(value)) return equal(row[field], value);
    return Object.entries(value).every(([operator, operand]) => matchesOperator(row[field], operator, operand));
  });
}

/** Apply an already-validated filter with AND semantics plus an optional OR group. */
export function filterLibraryRows(rows, where) {
  if (!where) return rows;
  return rows.filter((row) => matchesCondition(row, where));
}

export function hasOnlyExactWhere(where) {
  return !where || (isPlainObject(where) && Object.entries(where).every(([field, value]) => field !== "or" && !isPlainObject(value)));
}

/**
 * Generate view-only planner occurrences. Generated rows retain their record
 * id for safe follow-up reads/edits and explicitly name their source/date.
 */
export function expandLibraryOccurrences(collection, rows, dateFrom, dateTo) {
  const originals = new Map(rows.map((row) => [String(row.id), row]));
  const expanded = collection === "reminders"
    ? expandReminders(rows, dateFrom, dateTo)
    : expandEvents(rows, dateFrom, dateTo);
  return expanded.map((row) => {
    const source = originals.get(String(row.id));
    return {
      ...row,
      source_id: row.id,
      source_date: source?.date || row.date,
      occurrence_date: row.date,
      is_occurrence: true,
    };
  });
}

export function occurrenceQueryError(collection, expandOccurrences, dateFrom, dateTo) {
  if (!expandOccurrences) return null;
  if (collection !== "reminders" && collection !== "events") return "expand_occurrences is only available for reminders and events";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom || "") || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo || "") || dateFrom > dateTo) {
    return "expand_occurrences requires an inclusive YYYY-MM-DD date_from and date_to range";
  }
  return null;
}

const resultLabel = (item) => String(item.title || item.name || item.task || item.description || item.code || item.store_name || item.slug || item.id || "Untitled");

function globalScore(term, item) {
  const q = term.toLowerCase();
  const label = resultLabel(item).toLowerCase();
  if (label === q) return 3;
  if (label.startsWith(q)) return 2;
  return 1;
}

/**
 * Deterministic, read-only global-search orchestration. Callers provide the
 * allowed shelves and reader so this remains independent of browser auth/API
 * modules and can be regression-tested without a live account.
 */
export async function searchAcrossCollections({ query, collections, limit = 20, availableCollections, queryCollection, maxLimit = 100 } = {}) {
  const term = String(query || "").trim();
  if (!term) return { error: "query is required" };
  const selected = collections == null ? availableCollections : collections;
  if (!Array.isArray(selected) || selected.length === 0) return { error: "collections must be a non-empty array when provided" };
  const unique = [...new Set(selected)];
  for (const collection of unique) {
    if (!availableCollections.includes(collection)) return { error: `"${collection}" is not available to global_search` };
  }
  const eachLimit = Math.min(10, Math.max(1, Number(limit) || 20));
  const settled = await Promise.all(unique.map(async (collection) => {
    try {
      const result = await queryCollection({ collection, search: term, limit: eachLimit });
      if (result?.error) return { collection, error: result.error };
      return { collection, items: result?.items || [] };
    } catch (error) {
      return { collection, error: error?.message || String(error) };
    }
  }));
  const errors = settled.filter((result) => result.error).map(({ collection, error }) => ({ collection, error }));
  const items = settled.flatMap(({ collection, items = [] }) => items.map((item) => ({
    collection,
    id: item.id,
    score: globalScore(term, item),
    label: resultLabel(item),
    item,
  }))).sort((a, b) => b.score - a.score || a.collection.localeCompare(b.collection) || a.label.localeCompare(b.label) || String(a.id).localeCompare(String(b.id)));
  const capped = Math.min(Math.max(1, Number(limit) || 20), maxLimit);
  return {
    query: term,
    total: items.length,
    returned: Math.min(items.length, capped),
    ...(items.length > capped ? { note: `Showing the best ${capped} matches.` } : {}),
    items: items.slice(0, capped),
    ...(errors.length ? { errors } : {}),
  };
}

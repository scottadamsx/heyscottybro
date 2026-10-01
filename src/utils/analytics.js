const DAY = 86400000;
export const ANALYTICS_RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All available", days: null },
];

const pad = (n) => String(n).padStart(2, "0");
export function localDateKey(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function rangeStartKey(rangeKey, now = new Date()) {
  const range = ANALYTICS_RANGES.find((item) => item.key === rangeKey) || ANALYTICS_RANGES[2];
  if (!range.days) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range.days + 1);
  return localDateKey(d.toISOString());
}

export function inAnalyticsRange(value, rangeKey, now = new Date()) {
  const key = localDateKey(value);
  const start = rangeStartKey(rangeKey, now);
  return Boolean(key) && (!start || key >= start) && key <= localDateKey(now.toISOString());
}

const number = (value) => Number(value) || 0;
const sourceRows = (data, key, field, range, now) => (data[key] || []).filter((row) => inAnalyticsRange(row[field], range, now));

export function buildAnalyticsSummary(data, range = "30d", now = new Date()) {
  const reminders = (data.reminders || []).filter((row) => inAnalyticsRange(row.created_at || row.date || row.completed_date, range, now));
  const completed = (data.reminders || []).filter((row) => row.completed && inAnalyticsRange(row.completed_date || row.date || row.created_at, range, now));
  const transactions = sourceRows(data, "transactions", "date", range, now);
  const food = sourceRows(data, "food", "date", range, now);
  const weights = sourceRows(data, "weights", "date", range, now).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const workouts = (data.workouts || []).filter((row) => row.ended_at && inAnalyticsRange(row.ended_at, range, now));
  const sets = sourceRows(data, "sets", "logged_at", range, now);
  const people = (data.peopleEvents || []).map((row) => ({ ...row, event: row.doc || {} })).filter((row) => inAnalyticsRange(row.event.date || row.created_at, range, now));
  const pageUsage = sourceRows(data, "pageUsage", "started_at", range, now);
  const agentActions = sourceRows(data, "agentActions", "created_at", range, now);
  const journals = (data.journal || []).filter((row) => inAnalyticsRange(row.date || row.created_at, range, now));
  const projects = sourceRows(data, "projects", "created_at", range, now);
  const workLogs = sourceRows(data, "workLogs", "date", range, now);
  const habitState = data.accountability?.[0]?.state || {};
  const habitLogs = (habitState.logs || []).filter((row) => inAnalyticsRange(row.date || row.at, range, now));
  const habitMisses = (habitState.misses || []).filter((row) => inAnalyticsRange(row.date || row.at, range, now));
  const expensesCents = transactions.filter((row) => row.type === "expense").reduce((sum, row) => sum + Math.abs(Math.round(number(row.amount) * 100)), 0);
  const incomeCents = transactions.filter((row) => row.type === "income").reduce((sum, row) => sum + Math.round(number(row.amount) * 100), 0);
  const expenseCategories = new Map();
  for (const row of transactions.filter((item) => item.type === "expense")) expenseCategories.set(row.category || "Other", (expenseCategories.get(row.category || "Other") || 0) + Math.abs(Math.round(number(row.amount) * 100)));
  const byAgent = new Map(), byTool = new Map();
  for (const row of agentActions) {
    byAgent.set(row.agent_id || "frodo", (byAgent.get(row.agent_id || "frodo") || 0) + 1);
    byTool.set(row.tool || "unknown", (byTool.get(row.tool || "unknown") || 0) + 1);
  }
  const byRoute = new Map();
  for (const row of pageUsage) byRoute.set(row.route_key || "other", (byRoute.get(row.route_key || "other") || 0) + 1);
  const peopleKinds = new Map();
  for (const row of people) peopleKinds.set(row.event.kind || "Other", (peopleKinds.get(row.event.kind || "Other") || 0) + 1);
  const uniquePeople = new Set(people.flatMap((row) => row.event.people || [])).size;
  const activeDays = new Set([
    ...completed.map((row) => localDateKey(row.completed_date || row.date)),
    ...journals.map((row) => localDateKey(row.date || row.created_at)),
    ...workouts.map((row) => localDateKey(row.ended_at)),
    ...food.map((row) => localDateKey(row.date)),
    ...people.map((row) => localDateKey(row.event.date || row.created_at)),
  ].filter(Boolean)).size;
  return {
    overview: { activeDays, recordedActions: (data.activityEvents || []).filter((row) => inAnalyticsRange(row.occurred_at, range, now)).length, pageActiveMs: pageUsage.reduce((sum, row) => sum + number(row.active_ms), 0) },
    tasks: { created: reminders.length, completed: completed.length, completionRate: reminders.length ? completed.length / reminders.length : null, overdue: (data.reminders || []).filter((row) => !row.completed && row.date && row.date < localDateKey(now)).length },
    habits: { logs: habitLogs.length, misses: habitMisses.length, completionRate: habitLogs.length + habitMisses.length ? habitLogs.length / (habitLogs.length + habitMisses.length) : null },
    journal: { entries: journals.length, activeDays: new Set(journals.map((row) => localDateKey(row.date || row.created_at))).size },
    money: { incomeCents, expensesCents, netCents: incomeCents - expensesCents, topCategory: [...expenseCategories.entries()].sort((a, b) => b[1] - a[1])[0] || null },
    workouts: { sessions: workouts.length, sets: sets.length, volumeLb: sets.reduce((sum, row) => sum + number(row.weight_lb) * number(row.reps), 0), durationMinutes: workouts.reduce((sum, row) => { const ms = new Date(row.ended_at) - new Date(row.started_at); return sum + (Number.isFinite(ms) ? Math.max(0, ms) / 60000 : 0); }, 0), topExercise: [...sets.reduce((map, row) => map.set(row.exercise || "Other", (map.get(row.exercise || "Other") || 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1])[0] || null },
    meals: { count: food.length, calories: food.reduce((sum, row) => sum + number(row.calories), 0), protein: food.reduce((sum, row) => sum + number(row.protein_g), 0) },
    weight: { entries: weights.length, latest: weights.at(-1)?.weight_kg ?? null, change: weights.length > 1 ? number(weights.at(-1).weight_kg) - number(weights[0].weight_kg) : null },
    people: { events: people.length, uniquePeople, topKind: [...peopleKinds.entries()].sort((a, b) => b[1] - a[1])[0] || null, planned: people.filter((row) => row.event.status === "planned").length },
    projects: { created: projects.length, current: (data.projects || []).filter((row) => !row.archived && !["complete", "completed", "done"].includes(String(row.status || "").toLowerCase())).length, workMinutes: workLogs.reduce((sum, row) => sum + number(row.minutes), 0) },
    ai: { actions: agentActions.length, errors: agentActions.filter((row) => row.status === "error" || row.error).length, topAgent: [...byAgent.entries()].sort((a, b) => b[1] - a[1])[0] || null, topTool: [...byTool.entries()].sort((a, b) => b[1] - a[1])[0] || null, chatTurns: (data.activityEvents || []).filter((row) => row.event_type === "chat.turn.sent" && inAnalyticsRange(row.occurred_at, range, now)).length },
    pages: { visits: pageUsage.length, activeMs: pageUsage.reduce((sum, row) => sum + number(row.active_ms), 0), topRoute: [...byRoute.entries()].sort((a, b) => b[1] - a[1])[0] || null, returnVisits: Math.max(0, pageUsage.length - byRoute.size) },
  };
}

const linkFor = (type, id) => {
  if (!id) return null;
  if (type === "task") return `/admin/tasks/${encodeURIComponent(id)}`;
  if (type === "people_event") return `/admin/people/event/${encodeURIComponent(id)}`;
  if (type === "workout") return `/admin/health/workout/${encodeURIComponent(id)}`;
  if (type === "transaction") return "/admin/finance";
  if (type === "journal") return "/admin/life?tab=journal";
  if (type === "meal" || type === "weight") return "/admin/health";
  if (type === "project" || type === "calendar_event") return "/admin/planner";
  return null;
};

export function buildActivityHistory(data) {
  const current = (data.activityEvents || []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    domain: String(row.event_type || "activity").split(".")[0],
    label: row.entity_label || row.entity_type || "Activity",
    occurredAt: row.occurred_at,
    precision: row.metadata?.precision || "exact",
    source: row.source || "app",
    link: String(row.event_type || "").endsWith(".deleted") ? null : linkFor(row.entity_type, row.entity_id),
  }));
  const cutoffs = new Map();
  for (const row of current) {
    const instant = new Date(row.occurredAt).getTime();
    if (!Number.isFinite(instant)) continue;
    cutoffs.set(row.eventType, Math.min(cutoffs.get(row.eventType) ?? Infinity, instant));
  }
  const legacy = [];
  const add = ({ id, eventType, domain, label, at, precision = "exact", type, entityId, source }) => {
    if (!at) return;
    const instant = /^\d{4}-\d{2}-\d{2}$/.test(at) ? new Date(`${at}T00:00:00`).getTime() : new Date(at).getTime();
    if (!Number.isFinite(instant) || instant >= (cutoffs.get(eventType) ?? Infinity)) return;
    legacy.push({ id: `legacy:${source}:${id}:${eventType}`, eventType, domain, label, occurredAt: at, precision, source: `legacy:${source}`, link: linkFor(type, entityId) });
  };
  for (const row of data.reminders || []) {
    add({ id: row.id, eventType: "task.created", domain: "tasks", label: row.name || "Task", at: row.created_at, type: "task", entityId: row.id, source: "reminders" });
    if (row.completed) add({ id: row.id, eventType: "task.completed", domain: "tasks", label: row.name || "Task", at: row.completed_date || row.date, precision: row.completed_date ? "date_only" : "date_only", type: "task", entityId: row.id, source: "reminders" });
  }
  const habitNames = new Map((data.accountability?.[0]?.state?.trackers || []).map((tracker) => [tracker.id, tracker.name || "Habit"]));
  for (const row of data.accountability?.[0]?.state?.logs || []) add({ id: row.id, eventType: "habit.logged", domain: "habits", label: habitNames.get(row.trackerId) || "Habit", at: row.at ? new Date(row.at).toISOString() : row.date, precision: row.at ? "exact" : "date_only", source: "accountability" });
  for (const row of data.accountability?.[0]?.state?.misses || []) add({ id: row.id, eventType: "habit.missed", domain: "habits", label: habitNames.get(row.trackerId) || "Habit", at: row.at ? new Date(row.at).toISOString() : row.date, precision: row.at ? "exact" : "date_only", source: "accountability" });
  for (const row of data.journal || []) add({ id: row.id, eventType: "journal.created", domain: "journal", label: "Journal entry", at: row.created_at || row.date, precision: row.created_at ? "exact" : "date_only", type: "journal", entityId: row.id, source: "journal" });
  for (const row of data.transactions || []) add({ id: row.id, eventType: "transaction.created", domain: "money", label: row.category || row.type || "Transaction", at: row.created_at || row.date, precision: row.created_at ? "exact" : "date_only", type: "transaction", entityId: row.id, source: "transactions" });
  for (const row of data.projects || []) add({ id: row.id, eventType: "project.created", domain: "projects", label: row.name || "Project", at: row.created_at, type: "project", entityId: row.id, source: "projects" });
  for (const row of data.food || []) add({ id: row.id, eventType: "meal.logged", domain: "health", label: row.name || row.meal_type || "Meal", at: row.created_at || row.date, precision: row.created_at ? "exact" : "date_only", type: "meal", entityId: row.id, source: "food_logs" });
  for (const row of data.weights || []) add({ id: row.id, eventType: "weight.logged", domain: "health", label: "Weigh-in", at: row.date, precision: "date_only", type: "weight", entityId: row.id, source: "weight_logs" });
  for (const row of data.workouts || []) if (row.ended_at) add({ id: row.id, eventType: "workout.completed", domain: "health", label: row.name || "Workout", at: row.ended_at, type: "workout", entityId: row.id, source: "workout_sessions" });
  for (const row of data.peopleEvents || []) {
    const event = row.doc || {};
    add({ id: row.id, eventType: "people.event.created", domain: "people", label: event.title || event.kind || "People event", at: event.createdAt || row.created_at || event.date, precision: event.createdAt || row.created_at ? "exact" : "date_only", type: "people_event", entityId: row.id, source: "orbit_events" });
  }
  for (const row of data.agentActions || []) add({ id: row.id, eventType: "ai.action", domain: "ai", label: String(row.tool || "AI action").replace(/_/g, " "), at: row.created_at, source: "agent_actions" });
  return [...current, ...legacy].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)) || String(b.id).localeCompare(String(a.id)));
}

export function activityTrend(events, range = "30d", now = new Date()) {
  const configuredDays = ANALYTICS_RANGES.find((item) => item.key === range)?.days;
  const earliestKey = range === "all"
    ? events.map((event) => localDateKey(event.occurredAt)).filter(Boolean).sort()[0]
    : null;
  const todayKey = localDateKey(now.toISOString());
  const allDays = earliestKey
    ? Math.floor((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${earliestKey}T00:00:00Z`)) / 86400000) + 1
    : 1;
  const days = range === "all" ? Math.max(1, allDays) : (configuredDays || 30);
  const counts = new Map();
  for (const event of events) if (inAnalyticsRange(event.occurredAt, range, now)) counts.set(localDateKey(event.occurredAt), (counts.get(localDateKey(event.occurredAt)) || 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + index + 1);
    const key = localDateKey(date.toISOString());
    return { key, label: index % Math.max(1, Math.ceil(days / 8)) === 0 ? key.slice(5) : "", title: key, value: counts.get(key) || 0 };
  });
}

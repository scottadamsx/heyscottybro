/**
 * Pure product and grounding contracts shared by the UI, Library, and agent
 * prompt. Keeping these facts in one dependency-free module makes product-map
 * regressions testable without booting Supabase or rendering React.
 */

export const LIFE_TABS = Object.freeze([
  Object.freeze({ key: "journal", label: "Journal", icon: "fa-book" }),
  Object.freeze({ key: "habits", label: "Habits", icon: "fa-fire" }),
  Object.freeze({ key: "arcade", label: "Arcade", icon: "fa-gamepad" }),
]);

export const PRODUCT_SPACES = Object.freeze([
  Object.freeze({ label: "Today", route: "/admin/today", description: "morning brief, today's tasks, week" }),
  Object.freeze({ label: "Plan", route: "/admin/planner", description: "calendar, reminders, events and work only; Overview = calendar + tasks side by side; tabs Projects and Work; /admin/reminders is the full task list; /admin/tasks/:id is a task's detail page" }),
  Object.freeze({ label: "Money", route: "/admin/finance", description: "dashboard, transactions, bills & income, categories, receipts" }),
  Object.freeze({ label: "School", route: "/admin/school", description: "courses, grades, documents" }),
  Object.freeze({ label: "Life", route: "/admin/life", tabs: LIFE_TABS }),
  Object.freeze({ label: "Health", route: "/admin/health", description: "tabs Overview, Workouts, Food, Body; live workouts at /admin/health/workout/:id" }),
  Object.freeze({ label: "People", route: "/admin/people", description: "Orbit, Scott's personal CRM: everyone he knows, how he knows them, hangouts, birthdays, follow-ups, gift ideas; Interview me adds and updates people" }),
  Object.freeze({ label: "Mission Control", route: "/admin/mission", description: "Brain knowledge graph and AI inbox" }),
  Object.freeze({ label: "Vault", route: "/admin/vault", description: "snippets, documents, databases/hikers" }),
  Object.freeze({ label: "Settings", route: "/admin/settings", description: "account and app preferences" }),
]);

export const HABITS_COLLECTION_CONTRACT = Object.freeze({
  description: "Habit / accountability trackers (Life › Habits). Each tracker is a habit Scott logs daily (checkbox) or tallies (count). Use log_habit to record a day.",
  searchFields: Object.freeze(["name"]),
  defaultFields: Object.freeze(["id", "name", "emoji", "mode", "created"]),
  fields: Object.freeze({
    name: Object.freeze({ type: "string", required: true }),
    emoji: Object.freeze({ type: "string" }),
    mode: Object.freeze({ type: "enum", values: Object.freeze(["check", "count"]), description: "check = once a day, count = tally taps" }),
    created: Object.freeze({ type: "date", updateOnly: true }),
  }),
});

export const TASK_FACT_GROUNDING_CONTRACT = Object.freeze({
  tool: "query",
  collection: "reminders",
  claims: Object.freeze(["existence", "absence", "date", "time", "completion", "status", "count"]),
});

export const MEMORY_DISCLOSURE_CONTRACT = Object.freeze({
  neverVolunteer: Object.freeze([
    "passwords or credentials",
    "access or recovery codes",
    "physical key or spare-key locations",
    "security-question answers",
    "precise private locations",
    "other facts that enable physical or account access",
    "health, medical, fitness, or body details",
    "financial or account details",
    "relationship or private contact details",
    "identity, legal, or private schedule details",
  ]),
  safeGenericExamples: Object.freeze([
    "ordinary preferences",
    "non-sensitive project context",
    "app navigation facts",
  ]),
});

export function productMapPromptBlock() {
  return PRODUCT_SPACES.map((space) => {
    const description = space.tabs
      ? `tabs ${space.tabs.map((tab, index) => `${tab.label}${index === 0 ? " (first/default)" : ""}`).join(", ")}`
      : space.description;
    return `${space.label} (${space.route} — ${description})`;
  }).join(", ");
}

export function taskFactGroundingPromptBlock() {
  const claims = TASK_FACT_GROUNDING_CONTRACT.claims.join(", ");
  return `TASK FACTS ARE QUERY-GATED: before making any factual claim about a task or reminder's ${claims}, first run a successful ${TASK_FACT_GROUNDING_CONTRACT.tool} on the "${TASK_FACT_GROUNDING_CONTRACT.collection}" collection in THIS turn. Conversation history, memory, and the app map are not evidence that a task exists. If the query fails, do not guess or claim a result; report the lookup failure. If it returns a warning, repeat the warning with the answer.`;
}

export function memoryDisclosurePromptBlock() {
  const secrets = MEMORY_DISCLOSURE_CONTRACT.neverVolunteer.join(", ");
  const safeExamples = MEMORY_DISCLOSURE_CONTRACT.safeGenericExamples.join(", ");
  return `MEMORY PRIVACY: never volunteer ${secrets} in generic recall, summaries, examples, proactive context, or screen-visible demonstrations. "What do you remember?", "give me a fact", and requests for a non-sensitive example are NOT permission to reveal sensitive personal data or a secret. For generic recall, choose a genuinely safe fact such as ${safeExamples}, or say no safe example is available. Reveal sensitive data only when Scott explicitly asks for that exact subject in the current turn; reveal an access-enabling secret only when he asks for that exact secret. Never repeat sensitive data while explaining a refusal.`;
}

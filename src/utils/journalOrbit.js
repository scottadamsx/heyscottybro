const plain = (value) => typeof value === "string";

export function normalizePersonName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Split journal prose into exact person-mention links without interpreting HTML/Markdown. */
export function splitJournalPersonMentions(text, references = []) {
  const source = String(text || "");
  const matches = (Array.isArray(references) ? references : [])
    .filter((item) => item && typeof item.mention === "string" && item.mention.trim() && typeof item.personId === "string")
    .sort((a, b) => b.mention.length - a.mention.length);
  const parts = [];
  let plainStart = 0;
  let index = 0;
  while (index < source.length) {
    const match = matches.find(({ mention }) => {
      const candidate = source.slice(index, index + mention.length);
      if (candidate.toLocaleLowerCase() !== mention.toLocaleLowerCase()) return false;
      const before = index ? String.fromCodePoint(source.codePointAt(index - 1)) : "";
      const afterIndex = index + mention.length;
      const after = afterIndex < source.length ? String.fromCodePoint(source.codePointAt(afterIndex)) : "";
      return (!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after));
    });
    if (!match) { index += String.fromCodePoint(source.codePointAt(index)).length; continue; }
    if (plainStart < index) parts.push({ text: source.slice(plainStart, index) });
    parts.push({ text: source.slice(index, index + match.mention.length), personId: match.personId, name: match.name || match.mention });
    index += match.mention.length;
    plainStart = index;
  }
  if (plainStart < source.length) parts.push({ text: source.slice(plainStart) });
  return parts.length ? parts : [{ text: source }];
}

/** Resolve only a unique exact name/alias or a unique first-name match. */
export function resolveJournalPerson(people, mention) {
  const key = normalizePersonName(mention);
  if (!key) return { status: "unknown", ids: [] };
  const rows = Object.entries(people || {});
  const exact = rows.filter(([, person]) => [person?.name, ...(Array.isArray(person?.aliases) ? person.aliases : [])]
    .some((name) => normalizePersonName(name) === key));
  if (exact.length === 1) return { status: "matched", id: exact[0][0], ids: [exact[0][0]] };
  if (exact.length > 1) return { status: "ambiguous", ids: exact.map(([id]) => id) };
  const first = rows.filter(([, person]) => normalizePersonName(person?.name).split(" ")[0] === key);
  if (first.length === 1) return { status: "matched", id: first[0][0], ids: [first[0][0]] };
  return { status: first.length ? "ambiguous" : "unknown", ids: first.map(([id]) => id) };
}

const ACTIONS = [
  { id: "weight", label: "Log weight", phrases: ["log weight", "record weight", "weigh in", "weigh myself"] },
  { id: "food", label: "Log food", phrases: ["log food", "log a meal", "record food", "track food"] },
  { id: "workout", label: "Log workout", phrases: ["log workout", "record workout", "track workout"] },
  { id: "journal", label: "Write journal entry", phrases: ["write journal", "write a journal entry", "log journal", "journal entry"] },
  { id: "orbit_hangout", label: "Log hangout in Orbit", phrases: ["log hangout", "log a hangout", "log in orbit", "log event in orbit"] },
];

/** Return a direct action only for an explicit phrase from the fixed allow-list. */
export function reminderActionForName(value) {
  const name = normalizePersonName(value);
  if (!name) return null;
  for (const action of ACTIONS) {
    if (action.phrases.some((phrase) => name === phrase || name.startsWith(`${phrase} `))) {
      return { id: action.id, label: action.label };
    }
  }
  return null;
}

export const REMINDER_ACTION_LABELS = Object.freeze({
  weight: "Log weight",
  food: "Log food",
  workout: "Log workout",
  journal: "Write journal entry",
  orbit_hangout: "Log hangout in Orbit",
});

export function reminderActionUrl(action, id, occurrenceDate) {
  const params = new URLSearchParams({ reminderId: String(id), occurrenceDate });
  if (action === "weight") return `/admin/health?tab=body&action=log-weight&${params}`;
  if (action === "food") return `/admin/health?tab=food&action=log-food&${params}`;
  if (action === "workout") return `/admin/health?tab=workouts&action=log-workout&${params}`;
  if (action === "journal") return `/admin/life?tab=journal&new=1&${params}`;
  if (action === "orbit_hangout") return `/admin/people?openLog=1&${params}`;
  return null;
}

export function notifyReminderDestinationSaved(reminderId, occurrenceDate, destination) {
  if (!reminderId || !occurrenceDate) return false;
  window.dispatchEvent(new CustomEvent("app:reminder-destination-saved", { detail: { reminderId, occurrenceDate, destination } }));
  return true;
}

function validYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** The source event, not a generated recurrence, owns its Orbit prompt. */
export function eventNeedsOrbitPrompt(event, now = new Date()) {
  if (!event || event.orbit_log_status !== "pending" || !validYmd(event.date)) return false;
  const endDate = validYmd(event.end_date) && event.end_date >= event.date ? event.end_date : event.date;
  const endTime = typeof event.end_time === "string" && /^([01]\d|2[0-3]):[0-5]\d/.test(event.end_time)
    ? event.end_time.slice(0, 5)
    : null;
  const time = endTime || "23:59";
  const end = new Date(`${endDate}T${time}:59`);
  return !Number.isNaN(end.getTime()) && end < now;
}

export function eventOrbitLogPatch(current, outcome, orbitEventId = null) {
  if (!current || !["logged", "dismissed", "pending"].includes(outcome)) return null;
  if (outcome === "logged" && (!plain(orbitEventId) || !orbitEventId.trim())) return null;
  if (outcome === "dismissed" && current.orbit_log_status !== "pending") return null;
  if (outcome === "pending" && current.orbit_log_status !== "dismissed") return null;
  return {
    orbit_log_status: outcome,
    orbit_event_id: outcome === "logged" ? orbitEventId : null,
  };
}

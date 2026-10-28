// src/api/peopleCore.js — pure document logic for agent writes to the People
// space (Orbit). peopleApi.js does the IO; everything here is testable without
// a session. Shapes mirror what Orbit's own validation accepts
// (orbit/src/lib/validate.js) and what the People UI's Add People form saves.

/** The same summary strings the Library's people reads show (peopleApi). */
export const factText = (facts = []) => facts.map((f) => `${f.k}: ${f.v}`).join("; ");
export const intentText = (intents = []) =>
  intents.filter((i) => !i.done).map((i) => `${i.kind === "gift" ? "gift idea" : "to-do"}: ${i.text}${i.due ? ` (due ${i.due})` : ""}`).join("; ");

/** One Orbit person document flattened into the Library's read-model row. */
export function flattenPersonDoc(id, doc = {}) {
  return {
    id,
    name: doc.name,
    group: doc.group,
    how: doc.how || "",
    birthday: doc.birthday || "",
    notes: doc.notes || "",
    facts: factText(doc.facts),
    open_items: intentText(doc.intents),
  };
}

/** Scalar person fields an agent write may set; facts are handled separately. */
export const PERSON_SCALAR_FIELDS = ["name", "group", "birthday", "how", "notes"];

/**
 * The Library's flattened people fields are a read model. Scalars and facts
 * round-trip safely; intents (shown as open_items) do not — they carry ids,
 * kinds and due dates the summary string cannot reproduce. Refuse them loudly
 * instead of silently dropping or mangling someone's to-dos.
 */
function guardWriteData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("person data must be an object of field values");
  }
  if (data.open_items !== undefined) {
    throw new Error("open_items is a read-only summary — save follow-ups in notes instead; Orbit intents keep their own ids and due dates");
  }
}

/** "Work: Anderson's Butcher; Gym: wants to train together" → [{ k, v }, …]. */
export function parseFactsString(text) {
  if (text == null || text === "") return [];
  if (typeof text !== "string") throw new Error('facts must be text like "label: value; label: value"');
  return text.split(";").map((s) => s.trim()).filter(Boolean).map((segment) => {
    const colon = segment.indexOf(":");
    const k = colon < 0 ? "" : segment.slice(0, colon).trim();
    const v = colon < 0 ? "" : segment.slice(colon + 1).trim();
    if (!k || !v) throw new Error(`fact "${segment}" needs a label and a value, like "Work: Anderson's Butcher"`);
    return { k, v };
  });
}

/** The document the People UI's Add People form saves, built from Library fields. */
export function buildNewPersonDoc(data, nowIso) {
  guardWriteData(data);
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("a new person needs a name");
  return {
    name,
    group: data.group || "other",
    birthday: data.birthday || "",
    how: data.how || "",
    notes: data.notes || "",
    facts: parseFactsString(data.facts),
    intents: [],
    createdAt: nowIso,
  };
}

/**
 * Merge Library fields onto the person's current Orbit document. Only the
 * named scalars change; parsed facts append (Orbit's save de-duplicates exact
 * repeats); intents, createdAt and linked facts are preserved untouched.
 */
export function mergePersonUpdate(doc, data) {
  guardWriteData(data);
  const next = { ...doc };
  for (const k of PERSON_SCALAR_FIELDS) if (data[k] !== undefined) next[k] = data[k];
  if (data.facts !== undefined) next.facts = [...(doc.facts || []), ...parseFactsString(data.facts)];
  return next;
}

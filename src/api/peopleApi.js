// src/api/peopleApi.js — read-only view of the People space (Orbit) for agents.
// Orbit owns these rows; every write goes through Orbit's own API (/api/orbit), which
// validates and de-duplicates. This file only flattens them for the Library.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";

const PAGE = 1000;

async function allDocs(table) {
  const userId = await uid();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("id, doc, updated_at")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

const factText = (facts = []) => facts.map((f) => `${f.k}: ${f.v}`).join("; ");
const intentText = (intents = []) =>
  intents.filter((i) => !i.done).map((i) => `${i.kind === "gift" ? "gift idea" : "to-do"}: ${i.text}${i.due ? ` (due ${i.due})` : ""}`).join("; ");

export async function loadPeople() {
  return (await allDocs("orbit_people")).map(({ id, doc, updated_at }) => ({
    id,
    name: doc.name,
    group: doc.group,
    how: doc.how || "",
    birthday: doc.birthday || "",
    notes: doc.notes || "",
    facts: factText(doc.facts),
    open_items: intentText(doc.intents),
    updated_at,
  }));
}

export async function loadPeopleEvents() {
  const [people, events] = await Promise.all([allDocs("orbit_people"), allDocs("orbit_events")]);
  const names = Object.fromEntries(people.map((p) => [p.id, p.doc.name]));
  return events.map(({ id, doc }) => ({
    id,
    date: doc.date,
    title: doc.title,
    kind: doc.kind,
    status: doc.status || "done",
    people: (doc.people || []).map((p) => names[p] || p).join(", "),
    notes: doc.notes || "",
  }));
}

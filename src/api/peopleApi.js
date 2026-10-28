// src/api/peopleApi.js — the Library's view of the People space (Orbit).
// Orbit owns these rows; reads flatten them for the Library. Writes go
// through Orbit's own API (/api/orbit) with the signed-in session, exactly
// like the People UI, so Orbit's validation and duplicate checks apply to
// agent writes too (DR-034). Agents never write the orbit_people rows
// directly.
import { newId } from "../../orbit/src/lib/ids.js";
import { supabase, getAuthHeaders } from "../utils/supabase";
import { uid } from "./_base";
import { buildNewPersonDoc, flattenPersonDoc, mergePersonUpdate } from "./peopleCore";

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

export async function loadPeople() {
  return (await allDocs("orbit_people")).map(({ id, doc, updated_at }) => ({ ...flattenPersonDoc(id, doc), updated_at }));
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

/** One call to Orbit's API — the People UI's file adapter, same contract. */
async function orbitRequest(method, path, body) {
  let res;
  try {
    res = await fetch(`/api/orbit${path}`, {
      method,
      headers: {
        ...(await getAuthHeaders()),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // The UI's request guard: a stalled call must surface, never hang.
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(`couldn't reach the People data server (${err.message})`, { cause: err });
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.ok === false) {
    throw new Error(out.message || `${method} ${path} failed with status ${res.status}`);
  }
  return out;
}

/** Add a person to Orbit; Orbit's server validates and refuses duplicates. */
export async function createPerson(data) {
  const doc = buildNewPersonDoc(data, new Date().toISOString());
  const id = newId("p");
  const out = await orbitRequest("PUT", `/people/${encodeURIComponent(id)}`, doc);
  return flattenPersonDoc(id, out.value || doc);
}

/** Edit a person in Orbit: merge onto the live document, then save it back. */
export async function updatePerson(id, data) {
  const people = await orbitRequest("GET", "/people");
  const doc = people?.[id];
  if (!doc) throw new Error(`no person with id ${id} in People — query for the real id first`);
  const next = mergePersonUpdate(doc, data);
  const out = await orbitRequest("PUT", `/people/${encodeURIComponent(id)}`, next);
  return flattenPersonDoc(id, out.value || next);
}

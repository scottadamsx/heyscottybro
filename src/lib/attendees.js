/**
 * Event attendees (Connected Pages Phase 2, slice 1; DR-033).
 *
 * A link is only an Orbit person id. Names are never stored on the event;
 * every render resolves ids against the current Orbit people, so a rename
 * in Orbit updates every chip with no event edit. Pure helpers only — the
 * reads and writes live in plannerApi (links) and peopleApi (people).
 */

// Per-person chip colours. These are user-data colours (like project and
// tracker colours), assigned by a stable hash of the person id.
const PALETTE = ["#b3543f", "#7a6c2f", "#3f7a4e", "#2f6f7a", "#445f9e", "#7a4a7e", "#96602f", "#5d6e46"];

export function normalizeAttendeeIds(ids) {
  const seen = new Set();
  const out = [];
  for (const raw of ids || []) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function peopleById(people) {
  const map = {};
  for (const p of people || []) if (p && p.id != null) map[String(p.id)] = p;
  return map;
}

export function personInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function personColor(id) {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** ids -> [{ id, name, initials, color }], skipping ids Orbit no longer has. */
export function resolveAttendees(ids, byId) {
  return normalizeAttendeeIds(ids)
    .map((id) => {
      const person = byId ? byId[id] : null;
      if (!person) return null;
      const name = String(person.name || "").trim() || "Unnamed";
      return { id, name, initials: personInitials(name), color: personColor(id) };
    })
    .filter(Boolean);
}

/** "Rena Adams, Caleb Roberts" — for tooltips and accessible labels. */
export function attendeeNamesLabel(resolved) {
  return (resolved || []).map((a) => a.name).join(", ");
}

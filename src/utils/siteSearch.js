/**
 * Pure matching for the ⌘K site search. Sources are loaded once per palette
 * open (src/api/searchApi.js); every keystroke filters them here, in memory.
 *
 * An item: { id, title, sub?, text?, to, date? }  — `text` is extra searchable
 * words that are never displayed (a description, a journal body…).
 */

export const normalize = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Score an item against the query's words: every word must appear somewhere.
 * Title hits outrank body hits; a title that starts with the query ranks first.
 * Returns 0 for "no match".
 */
export function scoreItem(item, words, phrase) {
  const title = normalize(item.title);
  const hay = `${title} ${normalize(item.sub)} ${normalize(item.text)}`;
  let score = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    score += title.includes(w) ? 10 : 2;
  }
  if (title === phrase) score += 50;
  else if (title.startsWith(phrase)) score += 25;
  else if (title.includes(phrase)) score += 10;
  return score;
}

/**
 * groups: [{ key, label, icon, items }] → the same groups, filtered, ranked and
 * capped, empty ones dropped. `perGroup` keeps a busy source from burying the rest.
 */
export function searchGroups(groups, query, { perGroup = 6 } = {}) {
  const phrase = normalize(query).trim().replace(/\s+/g, " ");
  if (phrase.length < 2) return [];
  const words = phrase.split(" ");
  const out = [];
  for (const g of groups) {
    const hits = [];
    for (const item of g.items || []) {
      const score = scoreItem(item, words, phrase);
      if (score) hits.push({ item, score });
    }
    if (!hits.length) continue;
    hits.sort((a, b) => b.score - a.score || String(b.item.date || "").localeCompare(String(a.item.date || "")));
    out.push({ ...g, total: hits.length, items: hits.slice(0, perGroup).map((h) => h.item) });
  }
  return out;
}

/** Split `text` around the first occurrence of `query` for <mark> highlighting. */
export function highlightParts(text, query) {
  const s = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return [s];
  const i = normalize(s).indexOf(normalize(q));
  if (i < 0 || normalize(s).length !== s.length) return [s];
  return [s.slice(0, i), s.slice(i, i + q.length), s.slice(i + q.length)];
}

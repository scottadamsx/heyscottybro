/**
 * drafts — a local cache for text that hasn't been saved yet (journal entries,
 * entry edits). Every keystroke is written through, so a draft survives
 * clicking another entry, switching tabs, a reload, or a crash. A draft is
 * cleared only when the real save succeeds or the user discards it.
 *
 * QF-3: each record carries a schema version. A record that can't be read
 * (corrupt JSON, unknown version) is logged loudly and moved aside to
 * "<key>:unreadable" — never silently replaced by a blank draft.
 */
const PREFIX = "draft:";
export const DRAFT_SCHEMA = 1;

export const JOURNAL_NEW_DRAFT = "journal:new";
export const journalEditDraft = (id) => `journal:edit:${id}`;

const store = () => globalThis.localStorage;

const isEmpty = (fields) =>
  Object.values(fields || {}).every((v) => typeof v !== "string" || !v.trim());

/** → { fields, savedAt } or null when there is no (readable) draft. */
export function loadDraft(key) {
  let raw;
  try { raw = store().getItem(PREFIX + key); }
  catch (err) { console.error(`[drafts] couldn't read draft "${key}"`, err); return null; }
  if (raw === null) return null;
  try {
    const rec = JSON.parse(raw);
    if (rec?.schema !== DRAFT_SCHEMA || typeof rec.fields !== "object" || !rec.fields) {
      throw new Error(`unsupported draft schema ${rec?.schema}`);
    }
    return { fields: rec.fields, savedAt: rec.savedAt };
  } catch (err) {
    console.error(`[drafts] draft "${key}" is unreadable — moved to "${key}:unreadable"`, err);
    try { store().setItem(`${PREFIX}${key}:unreadable`, raw); store().removeItem(PREFIX + key); } catch { /* keep original in place */ }
    return null;
  }
}

/** Write-through save. An all-blank draft is removed. → true on success. */
export function saveDraft(key, fields) {
  try {
    if (isEmpty(fields)) { store().removeItem(PREFIX + key); return true; }
    store().setItem(PREFIX + key, JSON.stringify({ schema: DRAFT_SCHEMA, savedAt: new Date().toISOString(), fields }));
    return true;
  } catch (err) {
    console.error(`[drafts] couldn't save draft "${key}" (storage full or unavailable)`, err);
    return false;
  }
}

export function clearDraft(key) {
  try { store().removeItem(PREFIX + key); } catch (err) { console.error(`[drafts] couldn't clear draft "${key}"`, err); }
}

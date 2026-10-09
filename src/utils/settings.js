import { useSyncExternalStore } from "react";

// Lightweight, reactive app settings backed by localStorage. Mirrors the
// existing localStorage convention in AdminLayout (e.g. "adminRailCollapsed")
// but adds cross-component reactivity so a toggle on the Settings page
// instantly updates the nav, command palette, etc.

const PREFIX = "setting:";

// Setting keys live here so they can't drift between callers.
export const THEME = "theme";
export const DATE_FORMAT = "dateFormat";
export const HIDDEN_PAGES = "hiddenPages";
export const JOURNAL_CLEANUP = "journalCleanup";
const JOURNAL_CLEANUP_SCHEMA = 1;

const listeners = new Set();

export function getSetting(key, fallback = false) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return fallback;
  return raw === "1";
}

export function setSetting(key, value) {
  localStorage.setItem(PREFIX + key, value ? "1" : "0");
  listeners.forEach((fn) => fn());
}

/** String-valued settings (theme etc.). Stored raw; missing → fallback. */
export function getStringSetting(key, fallback = "") {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : raw;
  } catch { return fallback; }
}
export function setStringSetting(key, value) {
  try { localStorage.setItem(PREFIX + key, String(value)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}
export function useStringSetting(key, fallback = "") {
  return useSyncExternalStore(subscribe, () => getStringSetting(key, fallback), () => fallback);
}

function subscribe(listener) {
  listeners.add(listener);
  // Keep other tabs/windows in sync too.
  const onStorage = (e) => {
    if (!e.key || e.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive boolean setting. Re-renders the caller whenever the value changes. */
export function useSetting(key, fallback = false) {
  return useSyncExternalStore(
    subscribe,
    () => getSetting(key, fallback),
    () => fallback
  );
}

export function getJournalCleanupEnabled() {
  const key = PREFIX + JOURNAL_CLEANUP;
  let raw;
  try { raw = localStorage.getItem(key); }
  catch { return false; }
  if (raw === null) return false;
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== JOURNAL_CLEANUP_SCHEMA || typeof record.enabled !== "boolean") {
      throw new Error(`unsupported journal cleanup setting schema ${record?.schema}`);
    }
    return record.enabled;
  } catch (error) {
    console.error("[settings] journal cleanup setting is unreadable", error);
    try { localStorage.setItem(`${key}:unreadable`, raw); localStorage.removeItem(key); } catch { /* keep original */ }
    return false;
  }
}

export function setJournalCleanupEnabled(enabled) {
  try {
    localStorage.setItem(PREFIX + JOURNAL_CLEANUP, JSON.stringify({ schema: JOURNAL_CLEANUP_SCHEMA, enabled: Boolean(enabled) }));
  } catch (error) {
    console.error("[settings] couldn't save journal cleanup setting", error);
    return false;
  }
  listeners.forEach((fn) => fn());
  return true;
}

export function useJournalCleanupEnabled() {
  return useSyncExternalStore(subscribe, getJournalCleanupEnabled, () => false);
}

/** Hidden pages: a set of nav `to` paths removed from the rail, the mobile
 * menu, and the command palette (data is kept). */
function parseHiddenPages(raw) {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function getHiddenPages() { return parseHiddenPages(getStringSetting(HIDDEN_PAGES, "[]")); }
export function setHiddenPages(list) { setStringSetting(HIDDEN_PAGES, JSON.stringify(list)); }
export function toggleHiddenPage(to, hidden) {
  const cur = getHiddenPages();
  setHiddenPages(hidden ? [...new Set([...cur, to])] : cur.filter((p) => p !== to));
}
export function useHiddenPages() {
  return parseHiddenPages(useStringSetting(HIDDEN_PAGES, "[]"));
}

/**
 * Appearance = <html data-theme="light|dark">. Applied synchronously in
 * main.jsx before React renders (no flash), persisted as setting:theme (see
 * settings.js), and mirrored into <meta name="theme-color"> so the browser
 * chrome follows.
 *
 * Choices (DR-013, 2026-09-14): Light (default), Dark, or Automatic — which
 * follows the OS and re-applies live when the OS switches. A stored id from
 * the retired theme packs (xp, minecraft, …) resolves to Light.
 */
import { getStringSetting, setStringSetting, useStringSetting, THEME } from "./settings";

export const THEMES = [
  { id: "light", label: "Light", icon: "fa-regular fa-sun" },
  { id: "dark", label: "Dark", icon: "fa-regular fa-moon" },
  { id: "auto", label: "Automatic", icon: "fa-solid fa-circle-half-stroke" },
];
export const DEFAULT_THEME = "light";
// Must match --bg-sidebar in globals.css (the browser chrome sits next to it).
const THEME_COLOR = { light: "#F5EEE7", dark: "#1D1A17" };

export function isTheme(id) { return THEMES.some((t) => t.id === id); }

const darkQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

/** The stored choice (light | dark | auto). */
export function getTheme() {
  const v = getStringSetting(THEME, DEFAULT_THEME);
  return isTheme(v) ? v : DEFAULT_THEME;
}

/** What actually paints: auto resolves against the OS. */
export function resolveTheme(id) {
  if (id === "auto") return darkQuery()?.matches ? "dark" : "light";
  return id === "dark" ? "dark" : "light";
}

export function applyTheme(id) {
  const resolved = resolveTheme(isTheme(id) ? id : DEFAULT_THEME);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = THEME_COLOR[resolved];
  let scheme = document.querySelector('meta[name="color-scheme"]');
  if (!scheme) { scheme = document.createElement("meta"); scheme.name = "color-scheme"; document.head.appendChild(scheme); }
  scheme.content = resolved;
  return resolved;
}

/** Automatic mode follows the OS live, not just at load. Call once at boot. */
export function watchSystemTheme() {
  darkQuery()?.addEventListener?.("change", () => { if (getTheme() === "auto") applyTheme("auto"); });
}

export function setTheme(id) {
  const theme = isTheme(id) ? id : DEFAULT_THEME;
  applyTheme(theme);
  setStringSetting(THEME, theme);
}

/** Reactive stored choice. */
export function useTheme() {
  const v = useStringSetting(THEME, DEFAULT_THEME);
  return isTheme(v) ? v : DEFAULT_THEME;
}

/**
 * Theme = <html data-theme="light|dark|xp">. Applied synchronously in main.jsx
 * before React renders (no flash), persisted as setting:theme (see settings.js),
 * and mirrored into <meta name="theme-color"> so the browser chrome follows.
 * Light is the default (Scott's call, 2026-08-25); dark and XP are switchable
 * from Settings › Appearance.
 */
import { getStringSetting, setStringSetting, useStringSetting, THEME } from "./settings";

export const THEMES = [
  { id: "light", label: "Light", hint: "Apple-style paper & hairlines", icon: "fa-regular fa-sun" },
  { id: "dark", label: "Dark", hint: "Apple dark", icon: "fa-regular fa-moon" },
  { id: "xp", label: "Windows XP", hint: "Luna. Bliss. Tahoma.", icon: "fa-brands fa-windows" },
];
export const DEFAULT_THEME = "light";
const THEME_COLOR = { light: "#F5F5F7", dark: "#0E0E10", xp: "#0A5FE5" };

export function isTheme(id) { return THEMES.some((t) => t.id === id); }

export function getTheme() {
  const v = getStringSetting(THEME, DEFAULT_THEME);
  return isTheme(v) ? v : DEFAULT_THEME;
}

export function applyTheme(id) {
  const theme = isTheme(id) ? id : DEFAULT_THEME;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = THEME_COLOR[theme];
  let scheme = document.querySelector('meta[name="color-scheme"]');
  if (!scheme) { scheme = document.createElement("meta"); scheme.name = "color-scheme"; document.head.appendChild(scheme); }
  scheme.content = theme === "dark" ? "dark" : "light";
  return theme;
}

export function setTheme(id) {
  const theme = applyTheme(id);
  setStringSetting(THEME, theme);
}

/** Reactive current theme id. */
export function useTheme() {
  const v = useStringSetting(THEME, DEFAULT_THEME);
  return isTheme(v) ? v : DEFAULT_THEME;
}

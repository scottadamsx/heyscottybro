/**
 * Theme = <html data-theme="...">. Applied synchronously in main.jsx
 * before React renders (no flash), persisted as setting:theme (see settings.js),
 * and mirrored into <meta name="theme-color"> so the browser chrome follows.
 * Light is the default (Scott's call, 2026-08-25); additional theme packs are
 * switchable from Settings › Appearance.
 */
import { getStringSetting, setStringSetting, useStringSetting, THEME } from "./settings";

export const THEMES = [
  { id: "light", label: "Light", hint: "Apple-style paper & hairlines", icon: "fa-regular fa-sun" },
  { id: "dark", label: "Dark", hint: "Apple dark", icon: "fa-regular fa-moon" },
  { id: "xp", label: "Windows XP", hint: "Luna. Bliss. Tahoma.", icon: "fa-brands fa-windows" },
  { id: "apple-retro", label: "Retro Apple", hint: "Classic Platinum-era Macintosh", icon: "fa-brands fa-apple" },
  { id: "ios-retro", label: "Retro iOS", hint: "Skeuomorphic early iPhone feel", icon: "fa-solid fa-mobile-screen" },
  { id: "minecraft", label: "Minecraft", hint: "Pixel grass, stone, and torchlight", icon: "fa-solid fa-cubes" },
  { id: "backyard", label: "My Backyard", hint: "Sky, grass, cedar, and patio tones", icon: "fa-solid fa-tree" },
  { id: "never86", label: "Never86", hint: "Midnight black + warning red mission mode", icon: "fa-solid fa-triangle-exclamation" },
  { id: "arcade", label: "Arcade Neon", hint: "CRT glow and electric candy accents", icon: "fa-solid fa-gamepad" },
];
export const DEFAULT_THEME = "light";
const THEME_COLOR = {
  light: "#F5F5F7",
  dark: "#0E0E10",
  xp: "#0A5FE5",
  "apple-retro": "#D6D2C4",
  "ios-retro": "#88A7D4",
  minecraft: "#5F7F3F",
  backyard: "#A9D3F4",
  never86: "#140D11",
  arcade: "#100822",
};

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

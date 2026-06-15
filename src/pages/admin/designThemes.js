/* ── Theme library ───────────────────────────────────────────────────────────
 * Each theme is a complete set of the CSS custom properties the app reads off
 * :root. The Design page renders live UI inside a container that applies one of
 * these sets as scoped CSS variables, so you can SEE a theme rendered as real
 * components before committing to it.
 *
 * - "trinidad" mirrors the current live :root in src/index.css (the shipping
 *   look). Keep it in sync if you change the global theme.
 * - "neon" is the original heyScottyBro "Dark · Neon" theme, preserved here as
 *   the legacy reference (recovered from the early git history).
 * - The rest are extra presets to show the viewer's range.
 *
 * Fonts fall back gracefully — a theme can name a family that isn't loaded and
 * the stack drops to the system font, so previews never break.
 */

// Brand stripe (Trinidad flag) — identity mark, shared across themes.
const FLAG_STRIPE =
  "linear-gradient(90deg, #CF1124 0 60%, #000000 60% 80%, #FFFFFF 80% 86%, #CF1124 86% 100%)";

const ARCHIVO = '"Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const HANKEN = '"Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';

export const THEMES = [
  {
    id: "trinidad",
    name: "Light · Trinidad",
    tagline: "The current shipping theme",
    badge: "Live",
    scheme: "light",
    swatch: ["#F7F6F4", "#1F62FF", "#CF1124", "#0E0E10"],
    vars: {
      "--bg-base": "#F7F6F4",
      "--bg-surface": "#FFFFFF",
      "--bg-card": "#FFFFFF",
      "--bg-raised": "#F1F0ED",
      "--bg-hover": "#E7E6E3",

      "--border-subtle": "rgba(14,14,16,0.08)",
      "--border-primary": "rgba(14,14,16,0.14)",
      "--border-accent": "rgba(31,98,255,0.4)",
      "--line": "#E7E6E3",

      "--text-primary": "#0E0E10",
      "--text-secondary": "#54545B",
      "--text-muted": "#8A8A90",

      "--red-flag": "#CF1124",
      "--red-flag-deep": "#A50D1D",
      "--pure-black": "#000000",

      "--accent": "#1F62FF",
      "--accent-deep": "#0E3FCC",
      "--accent-light": "#1F62FF",
      "--accent-glow": "transparent",
      "--cyan": "#1F62FF",
      "--cyan-glow": "transparent",
      "--green": "#1f9d4d",
      "--red": "#FF2233",
      "--red-deep": "#D8101F",
      "--orange": "#E07B00",

      "--grad-hero": "transparent",
      "--grad-card": "#FFFFFF",
      "--grad-accent": "linear-gradient(180deg, #1F62FF, #0E3FCC)",
      "--grad-glow": "transparent",
      "--flag-stripe": FLAG_STRIPE,

      "--font-display": ARCHIVO,
      "--font-body": HANKEN,

      "--radius-sm": "10px",
      "--radius-md": "14px",
      "--radius-lg": "20px",
      "--radius-xl": "28px",

      "--shadow-card": "0 18px 40px -22px rgba(14,14,16,0.35), 0 2px 0 #fff inset",
      "--shadow-glow": "none",
    },
  },

  {
    id: "neon",
    name: "Dark · Neon",
    tagline: "The original heyScottyBro look",
    badge: "Legacy",
    scheme: "dark",
    swatch: ["#060610", "#6366f1", "#22d3ee", "#4ade80"],
    vars: {
      "--bg-base": "#060610",
      "--bg-surface": "#0d0d1a",
      "--bg-card": "#111127",
      "--bg-raised": "#1a1a35",
      "--bg-hover": "#1e1e3f",

      "--border-subtle": "rgba(255,255,255,0.06)",
      "--border-primary": "rgba(255,255,255,0.12)",
      "--border-accent": "rgba(99,102,241,0.4)",
      "--line": "rgba(255,255,255,0.08)",

      "--text-primary": "#f0f0ff",
      "--text-secondary": "#a0a0c0",
      "--text-muted": "#60607a",

      "--red-flag": "#CF1124",
      "--red-flag-deep": "#A50D1D",
      "--pure-black": "#000000",

      "--accent": "#6366f1",
      "--accent-deep": "#4f46e5",
      "--accent-light": "#818cf8",
      "--accent-glow": "rgba(99,102,241,0.25)",
      "--cyan": "#22d3ee",
      "--cyan-glow": "rgba(34,211,238,0.2)",
      "--green": "#4ade80",
      "--red": "#f87171",
      "--red-deep": "#ef4444",
      "--orange": "#fb923c",

      "--grad-hero": "linear-gradient(135deg, #060610 0%, #0d0d2b 50%, #060610 100%)",
      "--grad-card": "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(34,211,238,0.04) 100%)",
      "--grad-accent": "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
      "--grad-glow": "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)",
      "--flag-stripe": FLAG_STRIPE,

      "--font-display": '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      "--font-body": '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif',

      "--radius-sm": "8px",
      "--radius-md": "14px",
      "--radius-lg": "20px",
      "--radius-xl": "28px",

      "--shadow-card": "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
      "--shadow-glow": "0 0 40px rgba(99,102,241,0.2)",
    },
  },

  {
    id: "midnight",
    name: "Midnight · Sky",
    tagline: "Clean slate dark with a sky-blue go",
    badge: "Dark",
    scheme: "dark",
    swatch: ["#0b1120", "#38bdf8", "#34d399", "#e2e8f0"],
    vars: {
      "--bg-base": "#0b1120",
      "--bg-surface": "#0f172a",
      "--bg-card": "#111c33",
      "--bg-raised": "#1e293b",
      "--bg-hover": "#273548",

      "--border-subtle": "rgba(148,163,184,0.12)",
      "--border-primary": "rgba(148,163,184,0.22)",
      "--border-accent": "rgba(56,189,248,0.45)",
      "--line": "rgba(148,163,184,0.15)",

      "--text-primary": "#e2e8f0",
      "--text-secondary": "#94a3b8",
      "--text-muted": "#64748b",

      "--red-flag": "#fb7185",
      "--red-flag-deep": "#e11d48",
      "--pure-black": "#020617",

      "--accent": "#38bdf8",
      "--accent-deep": "#0ea5e9",
      "--accent-light": "#7dd3fc",
      "--accent-glow": "rgba(56,189,248,0.22)",
      "--cyan": "#22d3ee",
      "--cyan-glow": "rgba(34,211,238,0.18)",
      "--green": "#34d399",
      "--red": "#fb7185",
      "--red-deep": "#f43f5e",
      "--orange": "#fbbf24",

      "--grad-hero": "linear-gradient(160deg, #0b1120 0%, #0f172a 100%)",
      "--grad-card": "linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.03) 100%)",
      "--grad-accent": "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
      "--grad-glow": "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.12) 0%, transparent 70%)",
      "--flag-stripe": FLAG_STRIPE,

      "--font-display": ARCHIVO,
      "--font-body": HANKEN,

      "--radius-sm": "10px",
      "--radius-md": "14px",
      "--radius-lg": "20px",
      "--radius-xl": "28px",

      "--shadow-card": "0 18px 40px -20px rgba(0,0,0,0.6)",
      "--shadow-glow": "0 0 36px rgba(56,189,248,0.18)",
    },
  },

  {
    id: "sandstone",
    name: "Sandstone · Clay",
    tagline: "Warm paper with a terracotta go",
    badge: "Light",
    scheme: "light",
    swatch: ["#FAF6F0", "#C16626", "#4F8A3D", "#2B2018"],
    vars: {
      "--bg-base": "#FAF6F0",
      "--bg-surface": "#FFFFFF",
      "--bg-card": "#FFFFFF",
      "--bg-raised": "#F3ECE2",
      "--bg-hover": "#EBE1D3",

      "--border-subtle": "rgba(60,40,20,0.08)",
      "--border-primary": "rgba(60,40,20,0.16)",
      "--border-accent": "rgba(193,102,38,0.4)",
      "--line": "#EBE1D3",

      "--text-primary": "#2B2018",
      "--text-secondary": "#6B5A47",
      "--text-muted": "#9C8A74",

      "--red-flag": "#CF1124",
      "--red-flag-deep": "#A50D1D",
      "--pure-black": "#1A130C",

      "--accent": "#C16626",
      "--accent-deep": "#9C4E18",
      "--accent-light": "#E08A4A",
      "--accent-glow": "transparent",
      "--cyan": "#3D8A8A",
      "--cyan-glow": "transparent",
      "--green": "#4F8A3D",
      "--red": "#C0392B",
      "--red-deep": "#962D22",
      "--orange": "#D98324",

      "--grad-hero": "transparent",
      "--grad-card": "#FFFFFF",
      "--grad-accent": "linear-gradient(180deg, #C16626, #9C4E18)",
      "--grad-glow": "transparent",
      "--flag-stripe": FLAG_STRIPE,

      "--font-display": ARCHIVO,
      "--font-body": HANKEN,

      "--radius-sm": "10px",
      "--radius-md": "14px",
      "--radius-lg": "20px",
      "--radius-xl": "28px",

      "--shadow-card": "0 18px 40px -22px rgba(60,40,20,0.3)",
      "--shadow-glow": "none",
    },
  },
];

export const DEFAULT_THEME_ID = "trinidad";

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

/* Turn a theme's vars map into a React style object (CSS custom properties are
 * valid inline style keys), so a wrapper can scope the whole theme to itself. */
export function themeStyle(theme) {
  return { ...theme.vars };
}

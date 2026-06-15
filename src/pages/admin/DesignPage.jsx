import { useMemo, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { THEMES, DEFAULT_THEME_ID, getTheme, themeStyle } from "./designThemes";
import "./design.css";

/* ── The style library ──────────────────────────────────────────────────────
 * Token names + how they're meant to be used. The live VALUES come from the
 * currently-selected theme (see designThemes.js), so swatches, the draft
 * preview, and the exported guide all reflect whichever theme you're viewing. */
const TOKEN_GROUPS = [
  {
    id: "surfaces", name: "Surfaces", icon: "fa-layer-group",
    desc: "The canvas and the cards/inputs that sit on it.",
    tokens: [
      { v: "--bg-base",    label: "Base",    desc: "App background",        kind: "color" },
      { v: "--bg-surface", label: "Surface", desc: "Solid panels",          kind: "color" },
      { v: "--bg-card",    label: "Card",    desc: "Card background",        kind: "color" },
      { v: "--bg-raised",  label: "Raised",  desc: "Inputs / raised tiles",  kind: "color" },
      { v: "--bg-hover",   label: "Hover",   desc: "Hover-state fill",       kind: "color" },
    ],
  },
  {
    id: "text", name: "Text", icon: "fa-font",
    desc: "Foreground ink, from headlines down to hints.",
    tokens: [
      { v: "--text-primary",   label: "Primary",   desc: "Headings & body",   kind: "color" },
      { v: "--text-secondary", label: "Secondary", desc: "Supporting copy",   kind: "color" },
      { v: "--text-muted",     label: "Muted",     desc: "Hints & meta",      kind: "color" },
    ],
  },
  {
    id: "actions", name: "Actions", icon: "fa-bolt",
    desc: "Accent is every \"go\". Red is destructive only.",
    tokens: [
      { v: "--accent",      label: "Accent",      desc: "Primary action",       kind: "color" },
      { v: "--accent-deep", label: "Accent deep", desc: "Hover / pressed",      kind: "color" },
      { v: "--green",       label: "Success",     desc: "Positive / confirmed", kind: "color" },
      { v: "--orange",      label: "Warning",     desc: "Caution",              kind: "color" },
      { v: "--red",         label: "Danger",      desc: "Destructive only",     kind: "color" },
      { v: "--red-deep",    label: "Danger deep", desc: "Destructive hover",    kind: "color" },
    ],
  },
  {
    id: "identity", name: "Brand identity", icon: "fa-flag",
    desc: "Trinidad flag palette — decoration & brand marks only, never actions.",
    tokens: [
      { v: "--red-flag",      label: "Flag red",      desc: "Brand red",        kind: "color" },
      { v: "--red-flag-deep", label: "Flag red deep", desc: "Brand red, deep",  kind: "color" },
      { v: "--pure-black",    label: "Black band",    desc: "Flag black",       kind: "color" },
    ],
  },
  {
    id: "borders", name: "Borders & lines", icon: "fa-border-all",
    desc: "Hairlines that separate without shouting.",
    tokens: [
      { v: "--border-subtle",  label: "Subtle",  desc: "Faint divider",   kind: "color" },
      { v: "--border-primary", label: "Primary", desc: "Standard border", kind: "color" },
      { v: "--border-accent",  label: "Accent",  desc: "Focus-ring tint", kind: "color" },
      { v: "--line",           label: "Line",    desc: "Solid rule",      kind: "color" },
    ],
  },
  {
    id: "gradients", name: "Gradients", icon: "fa-fill-drip",
    desc: "Reserved for primary buttons and the brand stripe.",
    tokens: [
      { v: "--grad-accent", label: "Accent",      desc: "Primary button fill",   kind: "gradient" },
      { v: "--flag-stripe", label: "Flag stripe", desc: "Brand accent stripe",   kind: "gradient" },
    ],
  },
  {
    id: "radius", name: "Corner radius", icon: "fa-vector-square",
    desc: "Pick by component size — small chips → extra-large heroes.",
    tokens: [
      { v: "--radius-sm", label: "Small",   kind: "radius" },
      { v: "--radius-md", label: "Medium",  kind: "radius" },
      { v: "--radius-lg", label: "Large",   kind: "radius" },
      { v: "--radius-xl", label: "X-Large", kind: "radius" },
    ],
  },
  {
    id: "shadow", name: "Elevation", icon: "fa-clone",
    desc: "How far a surface lifts off the page.",
    tokens: [
      { v: "--shadow-card", label: "Card shadow", desc: "Lifts cards off the page", kind: "shadow" },
    ],
  },
  {
    id: "type", name: "Typography", icon: "fa-heading",
    desc: "Two families do all the work.",
    tokens: [
      { v: "--font-display", label: "Display", desc: "Headings & brand", kind: "font" },
      { v: "--font-body",    label: "Body",    desc: "Everything else",  kind: "font" },
    ],
  },
  {
    id: "space", name: "Spacing scale", icon: "fa-ruler-horizontal",
    desc: "Use these instead of ad-hoc rem values for margins, gaps & padding.",
    tokens: [
      { v: "--space-2xs", label: "2xs", kind: "space" },
      { v: "--space-xs",  label: "xs",  kind: "space" },
      { v: "--space-sm",  label: "sm",  kind: "space" },
      { v: "--space-md",  label: "md",  kind: "space" },
      { v: "--space-lg",  label: "lg",  kind: "space" },
      { v: "--space-xl",  label: "xl",  kind: "space" },
      { v: "--space-2xl", label: "2xl", kind: "space" },
    ],
  },
  {
    id: "sizes", name: "Type scale", icon: "fa-text-height",
    desc: "Step sizes for body and headings.",
    tokens: [
      { v: "--text-xs",   label: "xs",   kind: "size" },
      { v: "--text-sm",   label: "sm",   kind: "size" },
      { v: "--text-base", label: "base", kind: "size" },
      { v: "--text-lg",   label: "lg",   kind: "size" },
      { v: "--text-xl",   label: "xl",   kind: "size" },
      { v: "--text-2xl",  label: "2xl",  kind: "size" },
    ],
  },
];

const USAGE_RULES = [
  "Accent (`--accent`) is every primary \"go\" action — buttons, links, focus rings. Use `--accent-deep` for hover/pressed.",
  "Red (`--red`) is destructive ONLY — delete, cancel, irreversible actions. Never use it for a normal button.",
  "Flag red (`--red-flag`) is brand/decoration, never an action colour.",
  "Surfaces stack back-to-front: `--bg-base` behind, `--bg-card` for cards, `--bg-raised` for inputs & tiles.",
  "Text descends in emphasis: `--text-primary` → `--text-secondary` → `--text-muted`.",
  "Round corners with the `--radius-*` scale; lift cards with `--shadow-card`.",
  "Space with the `--space-*` scale and size text with the `--text-*` scale — avoid ad-hoc px/rem.",
  "Headings use `--font-display`; body copy uses `--font-body`.",
];

const ALL_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.v));
const PRESET_KEY = "hsb_design_presets";

const css = (name) => `var(${name})`;

/* Map the user's selection onto component roles for the live draft preview,
 * falling back to the theme default when nothing of that role is picked. */
function draftRoles(selected) {
  const firstOf = (names) => names.find((n) => selected.includes(n));
  return {
    cardBg: firstOf(["--bg-card", "--bg-surface", "--bg-raised", "--bg-base", "--bg-hover"]) || "--bg-card",
    text:   firstOf(["--text-primary", "--text-secondary", "--text-muted"]) || "--text-primary",
    accent: firstOf(["--accent", "--accent-deep", "--green", "--orange", "--cyan", "--red-flag"]) || "--accent",
    danger: firstOf(["--red", "--red-deep"]) || "--red",
    radius: firstOf(["--radius-xl", "--radius-lg", "--radius-md", "--radius-sm"]) || "--radius-md",
    shadow: firstOf(["--shadow-card"]) || "--shadow-card",
    border: firstOf(["--border-primary", "--border-accent", "--border-subtle", "--line"]) || "--border-primary",
    font:   firstOf(["--font-display", "--font-body"]) || "--font-display",
    pad:    firstOf(["--space-2xl", "--space-xl", "--space-lg", "--space-md", "--space-sm", "--space-xs"]) || "--space-lg",
  };
}

function buildGuide({ theme, values, selected, onlySelected }) {
  const lines = [];
  lines.push(`# heyScottyBro — Design System Guide (${theme.name})`);
  lines.push("");
  lines.push(`_Generated ${new Date().toLocaleString()} · ${theme.scheme} theme · ${theme.tagline}._`);
  lines.push("");
  lines.push("Every token below is a CSS custom property defined on `:root`. Reference it as `var(--token)` in CSS or inline styles — never hard-code the raw value, so a future theme change flows everywhere automatically.");
  lines.push("");

  for (const g of TOKEN_GROUPS) {
    const toks = onlySelected ? g.tokens.filter((t) => selected.includes(t.v)) : g.tokens;
    if (!toks.length) continue;
    lines.push(`## ${g.name}`);
    if (g.desc) { lines.push(""); lines.push(g.desc); }
    lines.push("");
    lines.push("| Token | Value | Use |");
    lines.push("| --- | --- | --- |");
    for (const t of toks) {
      lines.push(`| \`var(${t.v})\` | \`${(values[t.v] || "").trim()}\` | ${t.desc || ""} |`);
    }
    lines.push("");
  }

  lines.push("## Usage rules");
  lines.push("");
  for (const r of USAGE_RULES) lines.push(`- ${r}`);
  lines.push("");
  return lines.join("\n");
}

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) || "[]"); }
  catch { return []; }
}

/* ── Per-kind example renderer — uses the literal value from the active theme so
 * swatches reflect the selected theme even outside the themed stage. ───────── */
function TokenExample({ kind, value }) {
  if (kind === "color") return <div className="ds-ex-color" style={{ background: value }} />;
  if (kind === "gradient") return <div className="ds-ex-gradient" style={{ background: value }} />;
  if (kind === "radius") return <div className="ds-ex-radius" style={{ borderRadius: value }} />;
  if (kind === "shadow") return <div className="ds-ex-shadow" style={{ boxShadow: value }} />;
  if (kind === "font") return <div className="ds-ex-font" style={{ fontFamily: value }}>Aa Bb Cc 123</div>;
  if (kind === "space") return <div className="ds-ex-space"><span style={{ width: value }} /></div>;
  if (kind === "size") return <span className="ds-ex-size" style={{ fontSize: value }}>Aa</span>;
  return null;
}

/* ── Themed stage: scopes a whole theme to its subtree as CSS variables, so the
 * real component classes (.btn, .db-card, …) re-theme live inside it. ──────── */
function ThemedStage({ theme, className = "", children }) {
  return (
    <div className={`ds-stage ds-stage--${theme.scheme} ${className}`} style={themeStyle(theme)}>
      {theme.vars["--grad-glow"] && theme.vars["--grad-glow"] !== "transparent" && (
        <div className="ds-stage-glow" style={{ background: css("--grad-glow") }} />
      )}
      <div className="ds-stage-inner">{children}</div>
    </div>
  );
}

/* ── A realistic slice of the app, rendered with real component classes ────── */
function ViewerMock() {
  return (
    <>
      {/* Top bar */}
      <div className="ds-mock-topbar">
        <div className="ds-mock-brand" style={{ fontFamily: css("--font-display") }}>
          heyScottyBro
        </div>
        <div className="ds-mock-stripe" style={{ background: css("--flag-stripe") }} />
        <div className="ds-mock-topbar-right">
          <span className="ds-mock-search">
            <i className="fa-solid fa-magnifying-glass" /> Search…
          </span>
          <button className="btn btn-sm"><i className="fa-solid fa-plus" /> New</button>
          <span className="ds-mock-avatar">SB</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginTop: 0 }}>
        <div className="stat-item"><div className="stat-label">Active Tasks</div><div className="stat-value">12</div></div>
        <div className="stat-item"><div className="stat-label">Projects</div><div className="stat-value">5</div></div>
        <div className="stat-item"><div className="stat-label">This week</div><div className="stat-value">$840</div></div>
      </div>

      {/* Content + form */}
      <div className="ds-mock-cols">
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Today</h3>
            <button className="btn btn-sm btn-secondary-sm"><i className="fa-solid fa-up-right-and-down-left-from-center" /> Week</button>
          </div>
          <div className="db-list" style={{ marginTop: "0.6rem" }}>
            {[
              ["Ship the design library", "Today · 3:00 PM"],
              ["Gym — leg day", "Today · 6:00 PM"],
              ["Reply to Trinidad supplier", "Today"],
            ].map(([t, s]) => (
              <div className="db-list-item" key={t}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{t}</div>
                  <div className="db-list-item-subtitle">{s}</div>
                </div>
                <i className="fa-solid fa-chevron-right" style={{ color: css("--text-muted"), fontSize: "0.7rem" }} />
              </div>
            ))}
          </div>
          <div className="ds-mock-tags">
            <span className="ds-tag" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: css("--accent") }}>Work</span>
            <span className="ds-tag" style={{ background: "color-mix(in srgb, var(--green) 15%, transparent)", color: css("--green") }}>Health</span>
            <span className="ds-tag" style={{ background: "color-mix(in srgb, var(--orange) 18%, transparent)", color: css("--orange") }}>Errand</span>
          </div>
        </div>

        <div className="db-card form-card" style={{ border: `1px solid ${css("--border-subtle")}` }}>
          <h3 className="db-card-title" style={{ marginBottom: "0.6rem" }}>Quick add</h3>
          <input placeholder="Task name" defaultValue="Plan Q3 launch" />
          <select defaultValue="work" style={{ marginTop: "0.5rem" }}>
            <option value="work">Work</option>
            <option value="home">Home</option>
          </select>
          <textarea placeholder="Notes…" rows={2} style={{ marginTop: "0.5rem", resize: "vertical" }} />
          <label className="ds-mock-check">
            <input type="checkbox" defaultChecked /> Show on calendar
          </label>
          <div className="ds-mock-formbtns">
            <button className="btn">Save</button>
            <button className="btn btn-sm btn-secondary-sm">Cancel</button>
          </div>
        </div>
      </div>

      {/* Callouts */}
      <div className="ds-mock-alerts">
        <div className="ds-alert" style={{ background: "color-mix(in srgb, var(--green) 12%, transparent)", borderColor: "color-mix(in srgb, var(--green) 40%, transparent)" }}>
          <i className="fa-solid fa-circle-check" style={{ color: css("--green") }} />
          <span>Saved — your changes are live.</span>
        </div>
        <div className="ds-alert" style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)", borderColor: "color-mix(in srgb, var(--red) 40%, transparent)" }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: css("--red") }} />
          <span>This will permanently delete the project.</span>
          <button className="btn-sm btn-delete" style={{ marginLeft: "auto" }}>Delete</button>
        </div>
      </div>
    </>
  );
}

/* ── Exhaustive component gallery (buttons, inputs, borders, radii, …) ─────── */
function GallerySection({ title, children }) {
  return (
    <div className="ds-gallery-block">
      <div className="ds-gallery-label">{title}</div>
      <div className="ds-gallery-row">{children}</div>
    </div>
  );
}

function ComponentGallery({ values }) {
  const colorTokens = [
    "--accent", "--accent-deep", "--green", "--orange", "--red", "--red-deep",
    "--red-flag", "--cyan",
  ];
  const surfaceTokens = ["--bg-base", "--bg-surface", "--bg-card", "--bg-raised", "--bg-hover"];
  const borderTokens = ["--border-subtle", "--border-primary", "--border-accent", "--line"];
  const radii = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"];

  return (
    <div className="ds-gallery">
      <GallerySection title="Buttons">
        <button className="btn">Primary</button>
        <button className="btn btn-sm">Primary small</button>
        <button className="btn btn-sm btn-secondary-sm">Secondary</button>
        <button className="btn-sm btn-complete">✓ Done</button>
        <button className="btn-sm btn-delete">Delete</button>
        <button className="btn" disabled>Disabled</button>
      </GallerySection>

      <GallerySection title="Mini buttons">
        <button className="btn-mini">Mini</button>
        <button className="btn-mini accent">Accent</button>
        <button className="btn-mini danger">Danger</button>
        <button className="btn-mini muted">Muted</button>
      </GallerySection>

      <GallerySection title="Inputs">
        <div className="form-card ds-gallery-form">
          <input placeholder="Text input" />
          <select defaultValue=""><option value="" disabled>Select…</option><option>Option A</option></select>
          <label className="ds-mock-check"><input type="checkbox" defaultChecked /> Checkbox</label>
        </div>
      </GallerySection>

      <GallerySection title="Surfaces">
        {surfaceTokens.map((t) => (
          <div className="ds-chiptile" key={t}>
            <span className="ds-chiptile-swatch" style={{ background: css(t), border: `1px solid ${css("--border-subtle")}` }} />
            <code>{t}</code>
            <span className="ds-chiptile-val">{values[t]}</span>
          </div>
        ))}
      </GallerySection>

      <GallerySection title="Action & brand colours">
        {colorTokens.map((t) => (
          <div className="ds-chiptile" key={t}>
            <span className="ds-chiptile-swatch" style={{ background: css(t) }} />
            <code>{t}</code>
            <span className="ds-chiptile-val">{values[t]}</span>
          </div>
        ))}
      </GallerySection>

      <GallerySection title="Borders & lines">
        {borderTokens.map((t) => (
          <div className="ds-borderbox" key={t} style={{ border: `2px solid ${css(t)}` }}>
            <code>{t}</code>
          </div>
        ))}
      </GallerySection>

      <GallerySection title="Corner radius">
        {radii.map((t) => (
          <div className="ds-radiusbox" key={t} style={{ borderRadius: css(t), border: `1px solid ${css("--border-primary")}`, background: css("--bg-raised") }}>
            <code>{values[t]}</code>
          </div>
        ))}
      </GallerySection>

      <GallerySection title="Elevation">
        <div className="ds-shadowbox" style={{ boxShadow: css("--shadow-card"), background: css("--bg-card"), borderRadius: css("--radius-md") }}>--shadow-card</div>
        <div className="ds-shadowbox" style={{ boxShadow: css("--shadow-glow"), background: css("--bg-card"), borderRadius: css("--radius-md") }}>--shadow-glow</div>
      </GallerySection>

      <GallerySection title="Typography">
        <div className="ds-type-specimen">
          <div style={{ fontFamily: css("--font-display"), fontSize: "1.9rem", fontWeight: 800, color: css("--text-primary") }}>
            Display — Big Bold Headings
          </div>
          <div style={{ fontFamily: css("--font-body"), color: css("--text-secondary"), marginTop: "0.35rem" }}>
            Body — the quick brown fox jumps over the lazy dog. 0123456789
          </div>
          <div style={{ fontFamily: css("--font-body"), color: css("--text-muted"), fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Muted meta — supporting hints &amp; timestamps
          </div>
        </div>
      </GallerySection>
    </div>
  );
}

/* ── Theme switcher strip ─────────────────────────────────────────────────── */
function ThemeSwitcher({ themeId, setThemeId, appliedId, onApply, onReset }) {
  return (
    <section className="db-card ds-switcher">
      <div className="ds-switcher-head">
        <h3 className="db-card-title"><i className="fa-solid fa-palette" /> Themes</h3>
        <div className="ds-switcher-actions">
          {appliedId
            ? <button className="btn btn-sm ds-btn-ghost" onClick={onReset}><i className="fa-solid fa-rotate-left" /> Reset app theme</button>
            : <button className="btn btn-sm" onClick={onApply}><i className="fa-solid fa-wand-magic-sparkles" /> Preview on whole app</button>}
        </div>
      </div>
      <div className="ds-theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ds-theme-card${t.id === themeId ? " selected" : ""}`}
            onClick={() => setThemeId(t.id)}
            aria-pressed={t.id === themeId}
          >
            <div className="ds-theme-swatches">
              {t.swatch.map((c, i) => <span key={i} style={{ background: c }} />)}
            </div>
            <div className="ds-theme-meta">
              <span className="ds-theme-name">{t.name}</span>
              <span className="ds-theme-tagline">{t.tagline}</span>
            </div>
            <span className={`ds-theme-badge ds-theme-badge--${t.badge.toLowerCase()}`}>{t.badge}</span>
            {appliedId === t.id && <span className="ds-theme-applied"><i className="fa-solid fa-circle-check" /> Applied</span>}
          </button>
        ))}
      </div>
      {appliedId && (
        <p className="ds-switcher-note">
          <i className="fa-solid fa-circle-info" /> Live preview applied to the whole app for this session — refresh or hit reset to restore the shipping theme.
        </p>
      )}
    </section>
  );
}

export default function DesignPage() {
  const { addToast } = useToast();
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [appliedId, setAppliedId] = useState(null); // theme applied to :root (session-only)
  const [tab, setTab] = useState("viewer"); // viewer | components | tokens

  const [selected, setSelected] = useState([]);
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [copied, setCopied] = useState(false);

  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const values = theme.vars; // active-theme token values

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const roles = useMemo(() => draftRoles(selected), [selected]);
  const guide = useMemo(
    () => buildGuide({ theme, values, selected, onlySelected }),
    [theme, values, selected, onlySelected]
  );

  // Apply / reset the selected theme on :root for a live whole-app preview.
  const applyToApp = () => {
    const root = document.documentElement;
    for (const [k, val] of Object.entries(theme.vars)) root.style.setProperty(k, val);
    setAppliedId(theme.id);
    addToast(`Previewing “${theme.name}” across the app — reset to restore.`, "success");
  };
  const resetApp = () => {
    const root = document.documentElement;
    for (const k of Object.keys(theme.vars)) root.style.removeProperty(k);
    // also clear any keys from a previously-applied theme
    for (const t of THEMES) for (const k of Object.keys(t.vars)) root.style.removeProperty(k);
    setAppliedId(null);
    addToast("Restored the shipping theme.", "info");
  };

  const savePresets = (next) => {
    setPresets(next);
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)); } catch { /* storage full */ }
  };

  const saveCurrent = () => {
    const name = presetName.trim();
    if (!name) { addToast("Name your style first.", "warning"); return; }
    if (!selected.length) { addToast("Select some styles to save.", "warning"); return; }
    const preset = { id: Date.now(), name, tokens: [...selected] };
    savePresets([preset, ...presets.filter((p) => p.name !== name)]);
    setPresetName("");
    addToast(`Saved "${name}" to your style library.`, "success");
  };

  const copyGuide = () => {
    const write = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(guide)
      : Promise.reject();
    write
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => addToast("Couldn't copy — select the text and copy manually.", "error"));
  };

  const downloadGuide = () => {
    const blob = new Blob([guide], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heyscottybro-design-${theme.id}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const TABS = [
    { id: "viewer", label: "Theme viewer", icon: "fa-eye" },
    { id: "components", label: "Components", icon: "fa-shapes" },
    { id: "tokens", label: "Tokens", icon: "fa-swatchbook" },
  ];

  return (
    <div className="module-page design-page">
      <div className="module-header">
        <h1>Design</h1>
        <div className="ds-header-actions">
          {tab === "tokens" && selected.length > 0 && (
            <button className="btn btn-sm ds-btn-ghost" onClick={() => setSelected([])}>
              <i className="fa-solid fa-xmark" /> Clear ({selected.length})
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setExportOpen(true)}>
            <i className="fa-solid fa-file-export" /> Export guide
          </button>
        </div>
      </div>

      <p className="ds-intro">
        Your full style library and a live theme viewer. Pick a theme to see it
        <strong> rendered as real UI</strong>, browse every component and token, preview a theme
        across the whole app, then export a design-system guide for yourself or an AI.
      </p>

      <ThemeSwitcher
        themeId={themeId}
        setThemeId={setThemeId}
        appliedId={appliedId}
        onApply={applyToApp}
        onReset={resetApp}
      />

      <div className="ds-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`ds-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fa-solid ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Theme viewer ──────────────────────────────────────── */}
      {tab === "viewer" && (
        <ThemedStage theme={theme}>
          <ViewerMock />
        </ThemedStage>
      )}

      {/* ── Component gallery ─────────────────────────────────── */}
      {tab === "components" && (
        <ThemedStage theme={theme}>
          <ComponentGallery values={values} />
        </ThemedStage>
      )}

      {/* ── Tokens library ────────────────────────────────────── */}
      {tab === "tokens" && (
        <div className="ds-layout">
          <div className="ds-library">
            {TOKEN_GROUPS.map((g) => (
              <section key={g.id} className="db-card ds-group">
                <div className="ds-group-head">
                  <h3 className="db-card-title"><i className={`fa-solid ${g.icon}`} /> {g.name}</h3>
                  {g.desc && <p className="ds-group-desc">{g.desc}</p>}
                </div>
                <div className="ds-grid">
                  {g.tokens.map((t) => {
                    const on = selected.includes(t.v);
                    return (
                      <button
                        key={t.v}
                        type="button"
                        className={`ds-token${on ? " selected" : ""}`}
                        onClick={() => toggle(t.v)}
                        aria-pressed={on}
                        title={on ? "Remove from draft" : "Add to draft"}
                      >
                        <span className="ds-token-check">
                          <i className={`fa-solid ${on ? "fa-circle-check" : "fa-circle-plus"}`} />
                        </span>
                        <div className="ds-token-ex"><TokenExample kind={t.kind} value={values[t.v]} /></div>
                        <div className="ds-token-meta">
                          <span className="ds-token-label">{t.label}</span>
                          <code className="ds-token-name">{t.v}</code>
                          {t.desc && <span className="ds-token-desc">{t.desc}</span>}
                          <code className="ds-token-val">{values[t.v] || "…"}</code>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <aside className="ds-side">
            <section className="db-card ds-draft">
              <h3 className="db-card-title"><i className="fa-solid fa-wand-magic-sparkles" /> Draft workspace</h3>
              <p className="ds-group-desc">A live preview composed from your selected styles ({theme.name}).</p>

              <div
                className="ds-preview"
                style={{
                  background: values[roles.cardBg],
                  color: values[roles.text],
                  borderRadius: values[roles.radius],
                  boxShadow: values[roles.shadow],
                  border: `1px solid ${values[roles.border]}`,
                  padding: values[roles.pad],
                }}
              >
                <div className="ds-preview-title" style={{ fontFamily: values[roles.font] }}>
                  heyScottyBro
                </div>
                <p className="ds-preview-body" style={{ color: values["--text-secondary"] }}>
                  The quick brown fox jumps over the lazy dog. This card reflects the
                  surface, text, radius, shadow and spacing you&apos;ve selected.
                </p>
                <div className="ds-preview-actions">
                  <span className="ds-preview-btn" style={{ background: values[roles.accent], borderRadius: values[roles.radius], color: "#fff" }}>
                    Primary
                  </span>
                  <span className="ds-preview-btn outline" style={{ color: values[roles.danger], borderColor: values[roles.danger], borderRadius: values[roles.radius] }}>
                    Delete
                  </span>
                </div>
              </div>

              <div className="ds-selected-list">
                {selected.length === 0
                  ? <span className="ds-token-desc">No styles selected yet — tap any in the library.</span>
                  : selected.map((name) => (
                      <button key={name} className="ds-chip" onClick={() => toggle(name)} title="Remove">
                        <code>{name}</code> <i className="fa-solid fa-xmark" />
                      </button>
                    ))}
              </div>

              <div className="ds-save-row">
                <input
                  className="ds-save-input"
                  placeholder="Name this style…"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCurrent(); }}
                />
                <button className="btn btn-sm" onClick={saveCurrent}>
                  <i className="fa-solid fa-bookmark" /> Save
                </button>
              </div>
            </section>

            <section className="db-card ds-presets">
              <h3 className="db-card-title"><i className="fa-solid fa-swatchbook" /> Saved styles</h3>
              {presets.length === 0
                ? <p className="ds-group-desc">Saved style combinations show up here.</p>
                : (
                  <div className="ds-preset-list">
                    {presets.map((p) => (
                      <div key={p.id} className="ds-preset">
                        <div className="ds-preset-info">
                          <span className="ds-token-label">{p.name}</span>
                          <span className="ds-token-desc">{p.tokens.length} token{p.tokens.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="ds-preset-actions">
                          <button className="btn-mini" onClick={() => setSelected(p.tokens.filter((t) => ALL_TOKENS.includes(t)))} title="Load into draft">
                            <i className="fa-solid fa-arrow-up-right-from-square" /> Apply
                          </button>
                          <button className="btn-mini danger" onClick={() => savePresets(presets.filter((x) => x.id !== p.id))} title="Delete">
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </section>
          </aside>
        </div>
      )}

      {/* ── Export modal ──────────────────────────────────────── */}
      {exportOpen && (
        <div className="ds-modal-backdrop" onClick={() => setExportOpen(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-head">
              <h3 className="db-card-title"><i className="fa-solid fa-file-lines" /> Design guide — {theme.name}</h3>
              <button className="btn-mini" onClick={() => setExportOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="ds-modal-toolbar">
              <label className="ds-toggle">
                <input
                  type="checkbox"
                  checked={onlySelected}
                  onChange={(e) => setOnlySelected(e.target.checked)}
                  disabled={selected.length === 0}
                />
                Only selected styles{selected.length ? ` (${selected.length})` : ""}
              </label>
              <div className="ds-modal-toolbar-btns">
                <button className="btn btn-sm ds-btn-ghost" onClick={copyGuide}>
                  <i className="fa-solid fa-copy" /> {copied ? "Copied" : "Copy"}
                </button>
                <button className="btn btn-sm" onClick={downloadGuide}>
                  <i className="fa-solid fa-download" /> Download .md
                </button>
              </div>
            </div>
            <textarea className="ds-guide-text" readOnly value={guide} />
          </div>
        </div>
      )}
    </div>
  );
}

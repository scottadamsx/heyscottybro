import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import "./design.css";

/* ── The style library ──────────────────────────────────────────────────────
 * Seeded directly from the CSS custom properties in src/index.css. We list the
 * token names + how they're meant to be used here; the live VALUES (and the
 * swatches/examples) are read straight off :root at runtime via
 * getComputedStyle, so this page always mirrors the real theme. */
const TOKEN_GROUPS = [
  {
    id: "surfaces", name: "Surfaces", icon: "fa-layer-group",
    desc: "The off-white paper canvas and the cards/inputs that sit on it.",
    tokens: [
      { v: "--bg-base",    label: "Base",    desc: "App paper background",     kind: "color" },
      { v: "--bg-surface", label: "Surface", desc: "Solid panels",             kind: "color" },
      { v: "--bg-card",    label: "Card",    desc: "Card background",           kind: "color" },
      { v: "--bg-raised",  label: "Raised",  desc: "Inputs / raised tiles",     kind: "color" },
      { v: "--bg-hover",   label: "Hover",   desc: "Hover-state fill",          kind: "color" },
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
    desc: "Blue is every \"go\". Red is destructive only.",
    tokens: [
      { v: "--accent",      label: "Accent",      desc: "Primary action blue",  kind: "color" },
      { v: "--accent-deep", label: "Accent deep", desc: "Hover / pressed blue", kind: "color" },
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
      { v: "--border-subtle",  label: "Subtle",  desc: "Faint divider",  kind: "color" },
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
      { v: "--shadow-card", label: "Card shadow", desc: "Lifts cards off the paper", kind: "shadow" },
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
  "Blue (`--accent`) is every primary \"go\" action — buttons, links, focus rings. Use `--accent-deep` for hover/pressed.",
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

function buildGuide({ values, selected, onlySelected }) {
  const lines = [];
  lines.push("# heyScottyBro — Design System Guide");
  lines.push("");
  lines.push(`_Generated ${new Date().toLocaleString()} · light theme · Trinidad flag palette._`);
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

/* ── Per-kind example renderer ──────────────────────────────────────────── */
function TokenExample({ kind, name }) {
  if (kind === "color") return <div className="ds-ex-color" style={{ background: css(name) }} />;
  if (kind === "gradient") return <div className="ds-ex-gradient" style={{ background: css(name) }} />;
  if (kind === "radius") return <div className="ds-ex-radius" style={{ borderRadius: css(name) }} />;
  if (kind === "shadow") return <div className="ds-ex-shadow" style={{ boxShadow: css(name) }} />;
  if (kind === "font") return <div className="ds-ex-font" style={{ fontFamily: css(name) }}>Aa Bb Cc 123</div>;
  if (kind === "space") return <div className="ds-ex-space"><span style={{ width: css(name) }} /></div>;
  if (kind === "size") return <span className="ds-ex-size" style={{ fontSize: css(name) }}>Aa</span>;
  return null;
}

export default function DesignPage() {
  const { addToast } = useToast();
  const [values, setValues] = useState({});
  const [selected, setSelected] = useState([]);
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read the live values straight off :root once the stylesheet is applied.
  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const next = {};
    for (const name of ALL_TOKENS) next[name] = root.getPropertyValue(name).trim();
    setValues(next);
  }, []);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const roles = useMemo(() => draftRoles(selected), [selected]);
  const guide = useMemo(
    () => buildGuide({ values, selected, onlySelected }),
    [values, selected, onlySelected]
  );

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
    a.download = `heyscottybro-design-system-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="module-page design-page">
      <div className="module-header">
        <h1>Design</h1>
        <div className="ds-header-actions">
          {selected.length > 0 && (
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
        Every style below is pulled live from the heyScottyBro theme. Browse the library,
        <strong> select</strong> the tokens you're working with to preview them together in the
        draft workspace, save combinations as named styles, then export a complete design-system
        guide for yourself or an AI.
      </p>

      <div className="ds-layout">
        {/* ── Library ───────────────────────────────────────────── */}
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
                      <div className="ds-token-ex"><TokenExample kind={t.kind} name={t.v} /></div>
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

        {/* ── Draft workspace + saved library ───────────────────── */}
        <aside className="ds-side">
          <section className="db-card ds-draft">
            <h3 className="db-card-title"><i className="fa-solid fa-wand-magic-sparkles" /> Draft workspace</h3>
            <p className="ds-group-desc">A live preview composed from your selected styles.</p>

            <div
              className="ds-preview"
              style={{
                background: css(roles.cardBg),
                color: css(roles.text),
                borderRadius: css(roles.radius),
                boxShadow: css(roles.shadow),
                border: `1px solid ${css(roles.border)}`,
                padding: css(roles.pad),
              }}
            >
              <div className="ds-preview-title" style={{ fontFamily: css(roles.font) }}>
                heyScottyBro
              </div>
              <p className="ds-preview-body" style={{ color: css("--text-secondary") }}>
                The quick brown fox jumps over the lazy dog. This card reflects the
                surface, text, radius, shadow and spacing you've selected.
              </p>
              <div className="ds-preview-actions">
                <span className="ds-preview-btn" style={{ background: css(roles.accent), borderRadius: css(roles.radius) }}>
                  Primary
                </span>
                <span className="ds-preview-btn outline" style={{ color: css(roles.danger), borderColor: css(roles.danger), borderRadius: css(roles.radius) }}>
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

      {/* ── Export modal ──────────────────────────────────────── */}
      {exportOpen && (
        <div className="ds-modal-backdrop" onClick={() => setExportOpen(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-head">
              <h3 className="db-card-title"><i className="fa-solid fa-file-lines" /> Design-system guide</h3>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHiddenPages } from "../utils/settings";
import { searchGroups, highlightParts } from "../utils/siteSearch";

const COMMANDS = [
  { label: "Today",           to: "/admin/today",                    icon: "fa-house",            section: "Home" },
  { label: "Plan",            to: "/admin/planner",                  icon: "fa-calendar-check",   section: "Plan" },
  { label: "Work log",        to: "/admin/work",                    icon: "fa-briefcase",        section: "Plan" },
  { label: "Tasks",           to: "/admin/reminders",                icon: "fa-list-check",       section: "Plan" },
  { label: "Calendar",        to: "/admin/planner?tab=overview",     icon: "fa-calendar-days",    section: "Plan" },
  { label: "Projects",        to: "/admin/planner?tab=projects",     icon: "fa-folder-open",      section: "Plan" },
  { label: "Money",           to: "/admin/finance",                  icon: "fa-wallet",           section: "Money" },
  { label: "Transactions",    to: "/admin/finance?tab=transactions", icon: "fa-list-ul",          section: "Money" },
  { label: "Bills & Income",  to: "/admin/finance?tab=bills",        icon: "fa-file-invoice-dollar", section: "Money" },
  { label: "Receipts",        to: "/admin/finance?tab=receipts",     icon: "fa-receipt",          section: "Money" },
  { label: "Banker",          to: "/admin/finance?tab=banker",       icon: "fa-sack-dollar",      section: "Money" },
  { label: "School",          to: "/admin/school",                   icon: "fa-graduation-cap",   section: "School" },
  { label: "Grades",          to: "/admin/school",                   icon: "fa-graduation-cap",   section: "School" },
  { label: "Life",            to: "/admin/life",                     icon: "fa-heart-pulse",      section: "Life" },
  { label: "Journal",         to: "/admin/life?tab=journal",         icon: "fa-book",             section: "Life" },
  { label: "Habits",          to: "/admin/life?tab=habits",          icon: "fa-fire",             section: "Life" },
  { label: "Health",          to: "/admin/health",                   icon: "fa-dumbbell",         section: "Health" },
  { label: "Workouts",        to: "/admin/health?tab=workouts",      icon: "fa-dumbbell",         section: "Health" },
  { label: "Food log",        to: "/admin/health?tab=food",          icon: "fa-utensils",         section: "Health" },
  { label: "Body weight",     to: "/admin/health?tab=body",          icon: "fa-weight-scale",     section: "Health" },
  { label: "People",          to: "/admin/people",                   icon: "fa-user-group",       section: "People" },
  { label: "Arcade",          to: "/admin/life?tab=arcade",          icon: "fa-gamepad",          section: "Life" },
  { label: "Mission Control", to: "/admin/mission",                  icon: "fa-satellite-dish",   section: "Mission" },
  { label: "Agents",          to: "/admin/mission",                  icon: "fa-satellite-dish",   section: "Mission" },
  { label: "Brain",           to: "/admin/mission?tab=brain",        icon: "fa-brain",            section: "Mission" },
  { label: "AI Inbox",        to: "/admin/mission?tab=inbox",        icon: "fa-inbox",            section: "Mission" },
  { label: "Build (Bugs)",    to: "/admin/mission?tab=build",        icon: "fa-bug",              section: "Mission" },
  { label: "Research",        to: "/admin/mission?tab=research",     icon: "fa-magnifying-glass-chart", section: "Mission" },
  { label: "Claude Usage",    to: "/admin/mission?tab=usage",        icon: "fa-chart-line",       section: "Mission" },
  { label: "Vault",           to: "/admin/vault",                    icon: "fa-vault",            section: "Vault" },
  { label: "Secrets",         to: "/admin/vault",                    icon: "fa-key",              section: "Vault" },
  { label: "Documents",       to: "/admin/vault?tab=documents",      icon: "fa-file-lines",       section: "Vault" },
  { label: "Files",           to: "/admin/vault?tab=files",          icon: "fa-database",         section: "Vault" },
  { label: "Hike DB",         to: "/admin/vault?tab=databases",      icon: "fa-person-hiking",    section: "Vault" },
  { label: "Settings",        to: "/admin/settings",                 icon: "fa-gear",             section: "System" },
  { label: "View Site",      to: "/",                              icon: "fa-globe",          section: "Site" },
];

const DEBOUNCE_MS = 200;
const isHidden = (hiddenPages, to) => hiddenPages.some((base) => to === base || to.startsWith(`${base}?`) || to.startsWith(`${base}/`));

function Highlight({ text, query }) {
  const parts = highlightParts(text, query);
  if (parts.length === 1) return text;
  return <>{parts[0]}<mark className="cmdk-mark">{parts[1]}</mark>{parts[2]}</>;
}

/**
 * ⌘K — jump to a page, or find anything you've saved. Content sources load
 * once when the palette opens (src/api/searchApi.js, imported on demand so the
 * shell stays light); typing filters them in memory after a short debounce.
 * A source that fails to load is named, with a Retry — never silently empty.
 */
export default function CommandPalette({ onClose }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cursor, setCursor] = useState(0);
  const [sources, setSources] = useState(null);   // SEARCH_SOURCES once imported
  const [importError, setImportError] = useState(null);
  const [data, setData] = useState({});           // key → { status: "loading"|"ready"|"error", items?, error? }
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const aliveRef = useRef(true);
  const navigate = useNavigate();
  const hiddenPages = useHiddenPages();

  useEffect(() => { inputRef.current?.focus(); }, []);
  // (Re-armed on mount: StrictMode's dev double-mount runs the cleanup once in between.)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  // Typing settles for DEBOUNCE_MS before content is re-filtered.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const loadSource = (src) => {
    setData((d) => ({ ...d, [src.key]: { status: "loading" } }));
    src.load().then(
      (items) => { if (aliveRef.current) setData((d) => ({ ...d, [src.key]: { status: "ready", items } })); },
      (err) => {
        console.error(`[search] couldn't load ${src.label}`, err);
        if (aliveRef.current) setData((d) => ({ ...d, [src.key]: { status: "error", error: err?.message || String(err) } }));
      },
    );
  };

  // Once per open: fetch the source list, then every visible source in parallel.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    import("../api/searchApi")
      .then(({ SEARCH_SOURCES }) => {
        if (!aliveRef.current) return;
        const visible = SEARCH_SOURCES.filter((s) => !isHidden(hiddenPages, s.space));
        setSources(visible);
        visible.forEach(loadSource);
      })
      .catch((err) => {
        console.error("[search] couldn't load the search module", err);
        if (aliveRef.current) setImportError(err?.message || String(err));
      });
  }, []);

  const commands = useMemo(() => COMMANDS.filter((c) => !isHidden(hiddenPages, c.to)), [hiddenPages]);

  const q = query.trim().toLowerCase();
  const pageHits = useMemo(() => {
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)).slice(0, 6);
  }, [q, commands]);

  const contentGroups = useMemo(() => {
    if (!sources) return [];
    const groups = sources
      .filter((s) => data[s.key]?.status === "ready")
      .map((s) => ({ key: s.key, label: s.label, icon: s.icon, items: data[s.key].items }));
    return searchGroups(groups, debounced);
  }, [sources, data, debounced]);

  // One flat, ordered list for the keyboard; groups are just headings over it.
  const groups = useMemo(() => {
    const out = [];
    if (pageHits.length) out.push({ key: "pages", label: q ? "Pages" : "Go to", icon: "fa-compass", items: pageHits.map((c) => ({ id: c.label, title: c.label, sub: null, section: c.section, to: c.to, icon: c.icon })) });
    return out.concat(contentGroups);
  }, [pageHits, contentGroups, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ item, group: g }))), [groups]);

  useEffect(() => { setCursor(0); }, [groups]);

  const loadingSources = sources ? sources.filter((s) => (data[s.key]?.status ?? "loading") === "loading") : null;
  const failedSources = sources ? sources.filter((s) => data[s.key]?.status === "error") : [];
  const searching = q.length >= 2 && (query !== debounced || !sources || loadingSources.length > 0);

  const go = ({ item }) => {
    navigate(item.to);
    // People runs its own router inside a shadow root (PeoplePage); if it's
    // already mounted it only hears popstate, so tell it the URL moved.
    if (item.people) window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Home" && flat.length) { e.preventDefault(); setCursor(0); }
    else if (e.key === "End" && flat.length) { e.preventDefault(); setCursor(flat.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[cursor]) go(flat[cursor]); }
    else if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    listRef.current?.querySelector(`#cmdk-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let index = -1;
  const noContent = q.length >= 2 && !searching && contentGroups.length === 0;

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search everything" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <i className={`fa-solid ${searching ? "fa-spinner fa-spin" : "fa-magnifying-glass"}`} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search tasks, notes, people… or jump to a page"
            aria-label="Search everything"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[cursor] ? `cmdk-${cursor}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>

        <div ref={listRef} id="cmdk-list" role="listbox" aria-label="Results" className="cmdk-list">
          {flat.length === 0 && !searching && <p className="cmdk-empty">No results for “{query.trim()}”</p>}
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`cmdk-g-${g.key}`} className="cmdk-group">
              <p id={`cmdk-g-${g.key}`} className="cmdk-group-title">
                <i className={`fa-solid ${g.icon}`} aria-hidden="true" />
                {g.label}{g.total > g.items.length ? ` · top ${g.items.length} of ${g.total}` : ""}
              </p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={`${g.key}-${item.id}`}
                    id={`cmdk-${i}`}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={i === cursor}
                    className={`cmdk-item${i === cursor ? " is-active" : ""}${item.sub ? " has-sub" : ""}`}
                    onClick={() => go({ item })}
                    onMouseMove={() => { if (i !== cursor) setCursor(i); }}
                  >
                    <i className={`fa-solid ${item.icon || g.icon}`} aria-hidden="true" />
                    <span className="cmdk-label">
                      <span className="cmdk-title">{g.key === "pages" ? item.title : <Highlight text={item.title} query={debounced.trim()} />}</span>
                      {item.sub && <span className="cmdk-sub">{item.sub}</span>}
                    </span>
                    {item.section && <span className="cmdk-section">{item.section}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {noContent && flat.length > 0 && <p className="cmdk-empty">Nothing you&apos;ve saved matches “{query.trim()}”.</p>}
        </div>

        {/* Honest status: what's still loading, and exactly which sources failed. */}
        {importError && (
          <p className="cmdk-status is-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Content search is unavailable: {importError}. Page links still work.
          </p>
        )}
        {q.length >= 2 && loadingSources?.length > 0 && (
          <p className="cmdk-status" role="status">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Still loading {loadingSources.map((s) => s.label).join(", ")}…
          </p>
        )}
        {failedSources.map((s) => (
          <p key={s.key} className="cmdk-status is-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>Couldn&apos;t search {s.label}: {data[s.key].error}</span>
            <button type="button" className="btn-mini" onClick={() => { loadSource(s); inputRef.current?.focus(); }}>Retry</button>
          </p>
        ))}
        <span className="visually-hidden" aria-live="polite">
          {q.length >= 2 && !searching ? `${flat.length} result${flat.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>
    </div>
  );
}

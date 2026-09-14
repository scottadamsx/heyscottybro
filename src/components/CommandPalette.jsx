import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HIDE_SMOKE_TRACKER, useSetting, useHiddenPages } from "../utils/settings";

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
  { label: "Food",            to: "/admin/life?tab=food",            icon: "fa-apple-whole",      section: "Life" },
  { label: "Recipes",         to: "/admin/life?tab=recipes",         icon: "fa-utensils",         section: "Life" },
  { label: "Fitness",         to: "/admin/life?tab=fitness",         icon: "fa-dumbbell",         section: "Life" },
  { label: "Habits",          to: "/admin/life?tab=habits",          icon: "fa-fire",             section: "Life" },
  { label: "Smoke Tracker",   to: "/admin/life?tab=smoke",           icon: "fa-leaf",             section: "Life", smokeOnly: true },
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

export default function CommandPalette({ onClose }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
  const hiddenPages = useHiddenPages();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands = useMemo(
    () => COMMANDS.filter((c) =>
      !(hideSmoke && c.smokeOnly) &&
      !hiddenPages.some((base) => c.to === base || c.to.startsWith(`${base}?`))
    ),
    [hideSmoke, hiddenPages]
  );

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.trim().toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => { setCursor(0); }, [results]);

  const go = (cmd) => {
    navigate(cmd.to);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { if (results[cursor]) go(results[cursor]); }
    else if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search and jump" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Go to…"
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[cursor] ? `cmdk-${cursor}` : undefined}
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>

        <div ref={listRef} id="cmdk-list" role="listbox" className="cmdk-list">
          {results.length === 0 && <p className="cmdk-empty">No results</p>}
          {results.map((cmd, i) => (
            <button
              key={cmd.label}
              id={`cmdk-${i}`}
              role="option"
              aria-selected={i === cursor}
              className={`cmdk-item${i === cursor ? " is-active" : ""}`}
              onClick={() => go(cmd)}
              onMouseEnter={() => setCursor(i)}
            >
              <i className={`fa-solid ${cmd.icon}`} aria-hidden="true" />
              <span className="cmdk-label">{cmd.label}</span>
              <span className="cmdk-section">{cmd.section}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

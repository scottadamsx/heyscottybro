import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HIDE_SMOKE_TRACKER, useSetting } from "../utils/settings";

const COMMANDS = [
  { label: "Today",           to: "/admin/today",                    icon: "fa-house",            section: "Home" },
  { label: "Plan",            to: "/admin/planner",                  icon: "fa-calendar-check",   section: "Plan" },
  { label: "Tasks",           to: "/admin/planner",                  icon: "fa-list-check",       section: "Plan" },
  { label: "Calendar",        to: "/admin/planner",                  icon: "fa-calendar-days",    section: "Plan" },
  { label: "Journal",         to: "/admin/planner?tab=journal",      icon: "fa-book",             section: "Plan" },
  { label: "Projects",        to: "/admin/planner?tab=projects",     icon: "fa-folder-open",      section: "Plan" },
  { label: "Money",           to: "/admin/finance",                  icon: "fa-wallet",           section: "Money" },
  { label: "Transactions",    to: "/admin/finance?tab=transactions", icon: "fa-list-ul",          section: "Money" },
  { label: "Bills & Income",  to: "/admin/finance?tab=bills",        icon: "fa-file-invoice-dollar", section: "Money" },
  { label: "Receipts",        to: "/admin/finance?tab=receipts",     icon: "fa-receipt",          section: "Money" },
  { label: "Banker",          to: "/admin/finance?tab=banker",       icon: "fa-sack-dollar",      section: "Money" },
  { label: "School",          to: "/admin/school",                   icon: "fa-graduation-cap",   section: "School" },
  { label: "Grades",          to: "/admin/school",                   icon: "fa-graduation-cap",   section: "School" },
  { label: "Life",            to: "/admin/life",                     icon: "fa-heart-pulse",      section: "Life" },
  { label: "Food",            to: "/admin/life",                     icon: "fa-apple-whole",      section: "Life" },
  { label: "Recipes",         to: "/admin/life?tab=recipes",         icon: "fa-utensils",         section: "Life" },
  { label: "Fitness",         to: "/admin/life?tab=fitness",         icon: "fa-dumbbell",         section: "Life" },
  { label: "Habits",          to: "/admin/life?tab=habits",          icon: "fa-fire",             section: "Life" },
  { label: "Dates",           to: "/admin/life?tab=dates",           icon: "fa-heart",            section: "Life" },
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
  { label: "Design / Appearance", to: "/admin/design",               icon: "fa-swatchbook",       section: "System" },
  { label: "View Site",      to: "/",                              icon: "fa-globe",          section: "Site" },
];

export default function CommandPalette({ onClose }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands = useMemo(
    () => COMMANDS.filter((c) => !(hideSmoke && c.smokeOnly)),
    [hideSmoke]
  );

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.trim().toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => { setCursor(0); }, [results]);

  const go = (cmd) => { navigate(cmd.to); onClose(); };

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
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-primary)" }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Go to…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "1rem", color: "var(--text-primary)", caretColor: "var(--accent)" }}
          />
          <kbd style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "var(--bg-raised)", border: "1px solid var(--border-primary)", borderRadius: "0.25rem", padding: "0.1rem 0.35rem" }}>Esc</kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: "400px", overflowY: "auto", padding: "0.375rem 0" }}>
          {results.length === 0 && (
            <p style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>No results</p>
          )}
          {results.map((cmd, i) => (
            <button
              key={cmd.to}
              onClick={() => go(cmd)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                width: "100%", padding: "0.6rem 1rem", background: i === cursor ? "var(--bg-raised)" : "none",
                border: "none", cursor: "pointer", textAlign: "left",
                color: "var(--text-primary)", fontSize: "0.875rem",
              }}
            >
              <i className={`fa-solid ${cmd.icon}`} style={{ width: "1rem", textAlign: "center", color: "var(--text-muted)" }} />
              <span style={{ flex: 1 }}>{cmd.label}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cmd.section}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HIDE_SMOKE_TRACKER, useSetting } from "../utils/settings";

const COMMANDS = [
  { label: "Dashboard",      to: "/admin/dashboard",               icon: "fa-house",          section: "Home" },
  { label: "Planner",        to: "/admin/planner",                 icon: "fa-calendar-check", section: "Planner" },
  { label: "Tasks",          to: "/admin/planner",                 icon: "fa-list-check",     section: "Planner" },
  { label: "Calendar",       to: "/admin/planner",                 icon: "fa-calendar-days",  section: "Planner" },
  { label: "Journal",        to: "/admin/planner?tab=journal",     icon: "fa-book",           section: "Planner" },
  { label: "Projects",       to: "/admin/planner?tab=projects",    icon: "fa-folder-open",    section: "Planner" },
  { label: "Finance",        to: "/admin/finance",                 icon: "fa-wallet",         section: "Money" },
  { label: "Health",         to: "/admin/health",                  icon: "fa-heart-pulse",    section: "Health" },
  { label: "Nutrition",      to: "/admin/health",                  icon: "fa-apple-whole",    section: "Health" },
  { label: "Recipes",        to: "/admin/health?tab=recipes",      icon: "fa-utensils",       section: "Health" },
  { label: "Accountability", to: "/admin/health?tab=accountability",icon: "fa-fire",           section: "Health" },
  { label: "Smoke Tracker",  to: "/admin/health?tab=smoke",        icon: "fa-leaf",           section: "Health", smokeOnly: true },
  { label: "Tools",          to: "/admin/tools",                   icon: "fa-wrench",          section: "Tools" },
  { label: "Hike DB",        to: "/admin/tools",                   icon: "fa-person-hiking",  section: "Tools" },
  { label: "Date Night",     to: "/admin/dates",                   icon: "fa-heart",          section: "Personal" },
  { label: "Vault",          to: "/admin/vault",                   icon: "fa-vault",          section: "Vault" },
  { label: "Snippets",       to: "/admin/vault",                   icon: "fa-key",            section: "Vault" },
  { label: "Context",        to: "/admin/vault?tab=context",       icon: "fa-brain",          section: "Vault" },
  { label: "Documents",      to: "/admin/vault?tab=documents",     icon: "fa-file-lines",     section: "Vault" },
  { label: "Settings",       to: "/admin/settings",                icon: "fa-gear",           section: "System" },
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
        style={{ background: "var(--bg-elevated, #1a1a1a)", border: "1px solid var(--border, #333)", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border, #333)" }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: "var(--text-muted, #666)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Go to…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "1rem", color: "var(--text-primary, #fff)", caretColor: "var(--accent, #6366f1)" }}
          />
          <kbd style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "var(--bg-raised, #1e1e1e)", border: "1px solid var(--border, #333)", borderRadius: "0.25rem", padding: "0.1rem 0.35rem" }}>Esc</kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: "400px", overflowY: "auto", padding: "0.375rem 0" }}>
          {results.length === 0 && (
            <p style={{ padding: "0.75rem 1rem", color: "var(--text-muted, #666)", fontSize: "0.875rem", margin: 0 }}>No results</p>
          )}
          {results.map((cmd, i) => (
            <button
              key={cmd.to}
              onClick={() => go(cmd)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                width: "100%", padding: "0.6rem 1rem", background: i === cursor ? "var(--bg-raised, #222)" : "none",
                border: "none", cursor: "pointer", textAlign: "left",
                color: "var(--text-primary, #fff)", fontSize: "0.875rem",
              }}
            >
              <i className={`fa-solid ${cmd.icon}`} style={{ width: "1rem", textAlign: "center", color: "var(--text-muted, #666)" }} />
              <span style={{ flex: 1 }}>{cmd.label}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted, #666)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cmd.section}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

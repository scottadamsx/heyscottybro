import { useEffect, useState } from "react";
import { NavLink, useOutlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { logout } from "../../api/plannerApi";
import ChatBot from "../../components/ChatBot";
import PageTransition from "../../components/motion/PageTransition";
import ErrorBoundary from "../../components/ErrorBoundary";
import CommandPalette from "../../components/CommandPalette";
import { useHiddenPages } from "../../utils/settings";

// The spaces — one nav slot per life question (see MASTERPLAN.md §2.1).
// Exported so Settings can build the "hide this page" list from the same
// source of truth instead of a second, driftable copy.
export const NAV_ITEMS = [
  { to: "/admin/planner",   icon: "fa-calendar-check",  label: "Plan" },
  { to: "/admin/reminders", icon: "fa-bell",            label: "Reminders" },
  { to: "/admin/work",      icon: "fa-briefcase",       label: "Work" },
  { to: "/admin/finance",   icon: "fa-wallet",          label: "Money" },
  { to: "/admin/school",    icon: "fa-graduation-cap",  label: "School" },
  { to: "/admin/life",      icon: "fa-heart-pulse",     label: "Life" },
  { to: "/admin/mission",   icon: "fa-satellite-dish",  label: "Mission Control" },
  { to: "/admin/vault",     icon: "fa-vault",           label: "Vault" },
];

const COLLAPSE_KEY = "adminRailCollapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } };

function NavItem({ to, icon, label, onNavigate }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} title={label} onClick={onNavigate}>
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const hiddenPages = useHiddenPages();
  const navItems = NAV_ITEMS.filter((item) => !hiddenPages.includes(item.to));

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);   // phone/tablet sidebar
  const [chatOpen, setChatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapsed = () => setCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* private mode: per-session only */ }
    return next;
  });

  // Close the drawer whenever the page changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => { await logout(); navigate("/admin/login", { replace: true }); };
  const closeDrawer = () => setDrawerOpen(false);

  const shellClass = ["admin-shell", collapsed && "is-collapsed", drawerOpen && "drawer-open", chatOpen && "chat-open"].filter(Boolean).join(" ");

  return (
    <div className={shellClass}>
      <a className="skip-link" href="#main">Skip to content</a>

      {/* Phone/tablet top bar */}
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
          <i className="fa-solid fa-bars" aria-hidden="true" />
        </button>
        <NavLink to="/admin/today" className="brand" aria-label="heyScottyBro, Today">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brand-word">heyScottyBro</span>
        </NavLink>
        <button type="button" className="icon-btn" onClick={() => setPaletteOpen(true)} aria-label="Search and jump (⌘K)">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        </button>
      </header>
      {drawerOpen && <button type="button" className="drawer-backdrop" onClick={closeDrawer} aria-label="Close menu" />}

      <aside className="sidebar" aria-label="Main">
        <div className="sidebar-head">
          <NavLink to="/admin/today" className="brand" aria-label="heyScottyBro, Today" onClick={closeDrawer}>
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="brand-word">heyScottyBro</span>
          </NavLink>
          <button type="button" className="sidebar-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn drawer-close" onClick={closeDrawer} aria-label="Close menu">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-profile">
          <span className="avatar" aria-hidden="true">SA</span>
          <span className="sidebar-profile-text">
            <span className="sidebar-name">Scott Adams</span>
            <span className="sidebar-role">Personal HQ</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Spaces">
          <NavItem to="/admin/today" icon="fa-house" label="Today" onNavigate={closeDrawer} />
          {navItems.map((item) => <NavItem key={item.to} {...item} onNavigate={closeDrawer} />)}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="nav-item" onClick={() => setPaletteOpen(true)} title="Search and jump">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <span className="nav-label">Search</span>
            <kbd className="nav-kbd">⌘K</kbd>
          </button>
          <NavItem to="/admin/settings" icon="fa-gear" label="Settings" onNavigate={closeDrawer} />
          <a className="nav-item" href="/" target="_blank" rel="noopener" title="View site">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
            <span className="nav-label">View site</span>
          </a>
          <button type="button" className="nav-item nav-item-logout" onClick={handleLogout} title="Log out">
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
            <span className="nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <main className="admin-main" id="main" tabIndex={-1}>
        <ErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      <ChatBot onOpenChange={setChatOpen} />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

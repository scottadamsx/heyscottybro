import { Suspense, useEffect, useState } from "react";
import { NavLink, useOutlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { logout } from "../../api/plannerApi";
import { lazyWithReload as lazy } from "../../utils/lazyWithReload";
import PageTransition from "../../components/motion/PageTransition";
import ErrorBoundary from "../../components/ErrorBoundary";
import CommandPalette from "../../components/CommandPalette";
import DetailPanel from "../../components/DetailPanel";
import StatusPanel from "../../components/StatusPanel";
import { DetailPanelProvider, useDetailPanel } from "../../contexts/DetailPanelContext";
import { useHiddenPages } from "../../utils/settings";
import usePageUsageTracker from "../../hooks/usePageUsageTracker";

// Frodo's panel (and the whole agent stack behind it) loads alongside the page instead of
// holding up the first paint of every admin page.
const ChatBot = lazy(() => import("../../components/ChatBot"));
const SettingsDialog = lazy(() => import("./SettingsDialog.jsx"));

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
  { to: "/admin/health",    icon: "fa-dumbbell",        label: "Health" },
  { to: "/admin/people",    icon: "fa-user-group",      label: "People" },
  { to: "/admin/analytics", icon: "fa-chart-line",      label: "Analytics" },
  { to: "/admin/mission",   icon: "fa-satellite-dish",  label: "Mission Control" },
  { to: "/admin/vault",     icon: "fa-vault",           label: "Vault" },
  { to: "/admin/bin",       icon: "fa-box-open",        label: "Bin" },
];

// Muse shell derivation (docs/features/muse-ui-rewrite.md): a short pinned
// group lives in the rail; every other visible section is one tap away in
// More. The hidden-pages setting filters both lists by route.
const RAIL_PINNED = [
  { to: "/admin/planner",   icon: "fa-calendar-check", label: "Plan" },
  { to: "/admin/reminders", icon: "fa-bell",           label: "Tasks" },
  { to: "/admin/finance",   icon: "fa-wallet",         label: "Money" },
  { to: "/admin/health",    icon: "fa-dumbbell",       label: "Health" },
  { to: "/admin/people",    icon: "fa-user-group",     label: "People" },
];
const MORE_ITEMS = [
  { to: "/admin/work",      icon: "fa-briefcase",       label: "Work log" },
  { to: "/admin/school",    icon: "fa-graduation-cap",  label: "School" },
  { to: "/admin/life",      icon: "fa-heart-pulse",     label: "Life" },
  // Journal is a Life tab, but it is a destination in its own right (the
  // command palette and the /admin/journal redirect treat it as one), so it
  // gets its own labelled row here instead of hiding behind Life's tab bar.
  { to: "/admin/life?tab=journal", icon: "fa-book",     label: "Journal" },
  { to: "/admin/analytics", icon: "fa-chart-line",      label: "Analytics" },
  { to: "/admin/mission",   icon: "fa-satellite-dish",  label: "Mission Control" },
  { to: "/admin/vault",     icon: "fa-vault",           label: "Vault" },
  { to: "/admin/bin",       icon: "fa-box-open",        label: "Bin" },
  { to: "/admin/arcade",    icon: "fa-gamepad",         label: "Arcade" },
];
const TODAY_ITEM = { to: "/admin/today", icon: "fa-house", label: "Today" };

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
  );
}

function NavRow({ item, onNavigate }) {
  const { pathname, search } = useLocation();
  // NavLink's isActive only compares pathnames, so a tab link like Journal
  // (/admin/life?tab=journal) would light up on every Life tab. Compare the
  // search too when the item carries one; plain paths keep prefix matching
  // so subroutes (e.g. a School doc) still light their space.
  const [itemPath, itemSearch] = item.to.split("?");
  const isActive =
    (pathname === itemPath || pathname.startsWith(`${itemPath}/`)) &&
    (!itemSearch || search === `?${itemSearch}`);
  return (
    <NavLink
      to={item.to}
      className={`nav-row${isActive ? " active" : ""}`}
      onClick={onNavigate}
    >
      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function AdminLayoutFrame() {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const hiddenPages = useHiddenPages();
  const { panel, openPanel, closePanel } = useDetailPanel();
  usePageUsageTracker();

  const [moreOpen, setMoreOpen] = useState(false);     // desktop More popover
  const [menuOpen, setMenuOpen] = useState(false);     // rail bottom menu
  const [sheetOpen, setSheetOpen] = useState(false);   // phone More sheet
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);   // the lazy panel has mounted
  const [chatPending, setChatPending] = useState(false); // tapped the chat button before it loaded
  const [chatUnread, setChatUnread] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Same matching the command palette uses: a hidden page also hides its
  // tab links (Journal follows Life), never the other way around.
  const isHidden = (to) => hiddenPages.some((base) => to === base || to.startsWith(`${base}?`) || to.startsWith(`${base}/`));
  const pinned = RAIL_PINNED.filter((item) => !isHidden(item.to));
  const moreItems = MORE_ITEMS.filter((item) => !isHidden(item.to));
  const bottomItems = [TODAY_ITEM, ...pinned.slice(0, 3)];
  const sheetItems = [...pinned.slice(3), ...moreItems];
  const moreActive = sheetItems.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  // Transient shell surfaces close whenever the page changes.
  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
    setSheetOpen(false);
    setSettingsOpen(false);
    closePanel();
  }, [location.pathname, location.search, closePanel]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === "Escape") { setMoreOpen(false); setMenuOpen(false); setSheetOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // One right-edge surface at a time: opening the detail panel closes Frodo's
  // dock, and opening Frodo closes the panel (see onOpenChange below).
  useEffect(() => {
    if (panel && chatOpen) window.dispatchEvent(new Event("hsb:toggle-chat"));
  }, [panel, chatOpen]);

  const handleLogout = async () => { await logout(); navigate("/admin/login", { replace: true }); };
  const openStatus = () => openPanel({ title: "Status", content: <StatusPanel /> });
  const toggleChat = () => (chatLoaded
    ? window.dispatchEvent(new Event("hsb:toggle-chat"))
    : setChatPending(true));

  const shellClass = ["admin-shell", chatOpen && "chat-open", panel && "panel-open"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <a className="skip-link" href="#main">Skip to content</a>

      {/* Phone top bar: brand anchor, Search, Frodo (nav lives in the bottom bar) */}
      <header className="topbar">
        <NavLink to="/admin/today" className="brand" aria-label="heyScottyBro, Today">
          <BrandMark />
          <span className="brand-word">heyScottyBro</span>
        </NavLink>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => setPaletteOpen(true)} aria-label="Search and jump (⌘K)">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
          {/* Frodo lives up here on small screens, so no floating button sits on content */}
          <button type="button" className="icon-btn topbar-chat" onClick={toggleChat}
            aria-label={chatOpen ? "Close assistant" : chatUnread ? "Open assistant — Frodo has a reply for you" : "Open assistant"} aria-pressed={chatOpen}>
            <i className="fa-solid fa-comment-dots" aria-hidden="true" />
            {chatUnread && !chatOpen && <span className="topbar-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Icon rail (desktop) */}
      <div className="rail">
        <NavLink to="/admin/today" className="rail-brand" aria-label="Today, heyScottyBro home" title="Today">
          <BrandMark />
        </NavLink>
        <button type="button" className="rail-avatar" onClick={openStatus} aria-label="Open status panel" title="Status">
          SA
        </button>
        <nav className="rail-nav" aria-label="Primary">
          {pinned.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rail-btn${isActive ? " active" : ""}`}
              aria-label={item.label}
              title={item.label}
            >
              <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
            </NavLink>
          ))}
          <button type="button" className="rail-btn" onClick={() => setPaletteOpen(true)} aria-label="Search" title="Search (⌘K)">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
          <div className="rail-pop-wrap">
            <button
              type="button"
              className={`rail-btn${moreActive ? " active" : ""}`}
              onClick={() => { setMenuOpen(false); setMoreOpen((o) => !o); }}
              aria-label="More sections"
              aria-expanded={moreOpen}
              title="More"
            >
              <i className="fa-solid fa-ellipsis" aria-hidden="true" />
            </button>
            {moreOpen && (
              <div className="more-pop pop-down" role="menu" aria-label="More sections">
                {moreItems.map((item) => <NavRow key={item.to} item={item} />)}
              </div>
            )}
          </div>
        </nav>
        <div className="rail-foot">
          <div className="rail-pop-wrap">
            <button
              type="button"
              className="rail-btn"
              onClick={() => { setMoreOpen(false); setMenuOpen((o) => !o); }}
              aria-label="Menu"
              aria-expanded={menuOpen}
              title="Menu"
            >
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="more-pop pop-up" role="menu" aria-label="Menu">
                <button type="button" className="nav-row" onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}>
                  <i className="fa-solid fa-gear" aria-hidden="true" />
                  <span>Settings</span>
                </button>
                <a className="nav-row" href="/" target="_blank" rel="noopener">
                  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                  <span>View site</span>
                </a>
                <button type="button" className="nav-row nav-row-logout" onClick={handleLogout}>
                  <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {(moreOpen || menuOpen) && (
        <div
          className="pop-scrim"
          aria-hidden="true"
          onClick={() => { setMoreOpen(false); setMenuOpen(false); }}
        />
      )}

      <main className="admin-main" id="main" tabIndex={-1}>
        <ErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      {/* Phone bottom bar + More sheet */}
      <nav className="bottombar" aria-label="Primary">
        {bottomItems.map((item) => (
          <NavLink key={item.to} to={item.to} aria-label={item.label} title={item.label}>
            <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
          </NavLink>
        ))}
        <button
          type="button"
          className={moreActive ? "active" : undefined}
          onClick={() => setSheetOpen(true)}
          aria-label="More sections"
          aria-expanded={sheetOpen}
          title="More"
        >
          <i className="fa-solid fa-ellipsis" aria-hidden="true" />
        </button>
      </nav>
      {sheetOpen && (
        <div className="sheet-wrap">
          <button type="button" className="sheet-backdrop" aria-label="Close menu" onClick={() => setSheetOpen(false)} />
          <div className="more-sheet" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="more-sheet-head">
              <h2>Sections</h2>
              <button type="button" className="icon-x" onClick={() => setSheetOpen(false)} aria-label="Close menu">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <div className="more-sheet-list">
              {sheetItems.map((item) => <NavRow key={item.to} item={item} />)}
              <button type="button" className="nav-row" onClick={() => { setSheetOpen(false); setPaletteOpen(true); }}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <span>Search</span>
              </button>
              <button type="button" className="nav-row" onClick={() => { setSheetOpen(false); setSettingsOpen(true); }}>
                <i className="fa-solid fa-gear" aria-hidden="true" />
                <span>Settings</span>
              </button>
              <a className="nav-row" href="/" target="_blank" rel="noopener">
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                <span>View site</span>
              </a>
              <button type="button" className="nav-row nav-row-logout" onClick={handleLogout}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <ChatBot
          initialOpen={chatPending}
          onOpenChange={(open) => {
            setChatOpen(open);
            setChatLoaded(true);
            if (open) closePanel();
          }}
          onUnreadChange={setChatUnread}
        />
      </Suspense>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      <DetailPanel />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <DetailPanelProvider>
      <AdminLayoutFrame />
    </DetailPanelProvider>
  );
}

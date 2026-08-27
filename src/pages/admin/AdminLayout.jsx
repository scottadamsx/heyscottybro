import { useEffect, useState } from "react";
import { NavLink, useOutlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { logout } from "../../api/plannerApi";
import ChatBot from "../../components/ChatBot";
import PageTransition from "../../components/motion/PageTransition";
import ErrorBoundary from "../../components/ErrorBoundary";
import CommandPalette from "../../components/CommandPalette";
import { useTheme } from "../../utils/theme";
import { DesktopProvider, DesktopArea, Taskbar, useDesktop } from "../../components/xp/Desktop";

/** In desktop mode a rail link opens/focuses a window instead of swapping the page. */
function RailLink({ to, className, title, children, end, onClick, style }) {
  const desk = useDesktop();
  if (!desk || !to.startsWith("/admin")) return <NavLink to={to} className={className} title={title} end={end} onClick={onClick} style={style}>{children}</NavLink>;
  const space = to.replace(/^\/admin\/?/, "").split(/[/?]/)[0];
  const isActive = desk.focused && desk.focused.path.replace(/^\/admin\/?/, "").split(/[/?]/)[0] === space;
  const cls = typeof className === "function" ? className({ isActive }) : className;
  return <button type="button" className={cls} title={title} style={style} onClick={(e) => { desk.openWindow(to); onClick?.(e); }}>{children}</button>;
}

// The Seven Spaces — one nav slot per life question (see MASTERPLAN.md §2.1).
// Reminders sits beside Plan: the dedicated Tasks & Reminders surface, restored
// as its own page after the Phase-2 overhaul had folded it into the redirect.
const NAV_ITEMS = [
  { to: "/admin/planner",   icon: "fa-calendar-check",  label: "Plan" },
  { to: "/admin/reminders", icon: "fa-bell",            label: "Reminders" },
  { to: "/admin/work",      icon: "fa-briefcase",       label: "Work" },
  { to: "/admin/finance",  icon: "fa-wallet",           label: "Money" },
  { to: "/admin/school",   icon: "fa-graduation-cap",   label: "School" },
  { to: "/admin/life",     icon: "fa-heart-pulse",      label: "Life" },
  { to: "/admin/mission",  icon: "fa-satellite-dish",   label: "Mission Control" },
  { to: "/admin/vault",    icon: "fa-vault",            label: "Vault" },
];

export default function AdminLayout() {
  const theme = useTheme();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth > 900);
  useEffect(() => { const f = () => setWide(window.innerWidth > 900); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const desktopMode = theme === "xp" && wide;
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  // Desktop mode: the URL mirrors the focused window so a refresh restores it.
  const syncUrl = (path) => { if (path && location.pathname + location.search !== path) navigate(path, { replace: true }); };

  const [railCollapsed, setRailCollapsed] = useState(
    () => localStorage.getItem("adminRailCollapsed") === "1"
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // NAV_ITEMS is flat; smoke filtering happens inside HealthPage
  const navItems = NAV_ITEMS;

  // Compact density only inside the admin (the public landing keeps its own scale).
  useEffect(() => {
    document.documentElement.setAttribute("data-density", "compact");
    return () => document.documentElement.removeAttribute("data-density");
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hidden = railCollapsed;

  const toggleRail = () => setRailCollapsed((v) => { const n = !v; localStorage.setItem("adminRailCollapsed", n ? "1" : "0"); return n; });
  const showAll    = () => {
    setRailCollapsed(false);
    localStorage.setItem("adminRailCollapsed", "0");
  };

  const handleLogout = async () => { await logout(); navigate("/admin/login", { replace: true }); };

  const railClass  = ({ isActive }) => (isActive ? "admin-rail-link active" : "admin-rail-link");
  const popClass   = ({ isActive }) => (isActive ? "admin-sub-link active" : "admin-sub-link");

  // The contextual sub-sidebar was removed (Phase 0) — sub-hidden is permanent.
  const shellClass = (hidden ? "admin-shell menu-hidden" : "admin-shell sub-hidden") + (desktopMode ? " xp-desktop" : "");

  const shell = (
    <div className={shellClass}>
      {/* Fully-collapsed burger */}
      {hidden && (
        <>
          <button className="admin-rail-reopen" onClick={() => setMenuOpen((o) => !o)} title="Menu" aria-label="Menu">
            <i className="fa-solid fa-bars" />
          </button>
          {menuOpen && (
            <>
              <div className="admin-pop-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="admin-rail-pop">
                <RailLink to="/admin/today" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-house" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Today</div></span>
                </RailLink>
                {navItems.map((item) => (
                  <RailLink key={item.to} to={item.to} className={popClass} onClick={() => setMenuOpen(false)}>
                    <i className={`fa-solid ${item.icon}`} />
                    <span className="admin-sub-link-body"><div className="admin-sub-link-title">{item.label}</div></span>
                  </RailLink>
                ))}
                <RailLink to="/admin/settings" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-gear" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Settings</div></span>
                </RailLink>
                <div className="admin-pop-divider" />
                <button className="admin-sub-link" onClick={() => { showAll(); setMenuOpen(false); }}>
                  <i className="fa-solid fa-table-columns" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Show full menu</div></span>
                </button>
                <NavLink to="/" end className="admin-sub-link" onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-globe" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">View Site</div></span>
                </NavLink>
                <button className="admin-sub-link admin-side-logout" onClick={handleLogout}>
                  <i className="fa-solid fa-right-from-bracket" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Logout</div></span>
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Main nav rail */}
      <aside className="admin-rail">
        <div className="admin-rail-head">
          <NavLink to="/admin/today" className="admin-rail-mark" title="heyScottyBro"><span>S</span></NavLink>
          <span className="admin-rail-word">hey<span>Scotty</span>Bro</span>
        </div>

        <button className="admin-rail-link" onClick={toggleRail} title="Collapse menu">
          <i className="fa-solid fa-angles-right" />
          <span className="admin-rail-label">Collapse menu</span>
        </button>

        {/* Dashboard — always pinned */}
        <RailLink to="/admin/today" className={railClass} title="Today">
          <i className="fa-solid fa-house" />
          <span className="admin-rail-label">Today</span>
        </RailLink>

        {navItems.map((item) => (
          <RailLink key={item.to} to={item.to} className={railClass} title={item.label}>
            <i className={`fa-solid ${item.icon}`} />
            <span className="admin-rail-label">{item.label}</span>
          </RailLink>
        ))}

        <div className="admin-rail-spacer" />
        <RailLink to="/admin/settings" className={railClass} title="Settings">
          <i className="fa-solid fa-gear" />
          <span className="admin-rail-label">Settings</span>
        </RailLink>
        <NavLink to="/" className="admin-rail-link" title="View Site" end>
          <i className="fa-solid fa-globe" />
          <span className="admin-rail-label">View Site</span>
        </NavLink>
        <button className="admin-rail-link admin-rail-logout" onClick={handleLogout} title="Logout">
          <i className="fa-solid fa-right-from-bracket" />
          <span className="admin-rail-label">Logout</span>
        </button>
      </aside>

      <header className="admin-topbar">
        <NavLink to="/admin/today" className="admin-logo">hey<span>Scotty</span>Bro</NavLink>
      </header>

      {desktopMode ? (
        <>
          <DesktopArea />
          <Taskbar />
        </>
      ) : (
        <main className="admin-main">
          <ErrorBoundary>
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition key={location.pathname}>{outlet}</PageTransition>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      )}

      <ChatBot />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      {/* Mobile FAB + sheet */}
      <button className={`admin-mobile-fab${mobileMenuOpen ? " open" : ""}`} onClick={() => setMobileMenuOpen((o) => !o)} aria-label="Menu">
        {mobileMenuOpen ? <i className="fa-solid fa-xmark" /> : <i className="fa-solid fa-bars" />}
      </button>
      {mobileMenuOpen && (
        <>
          <div className="admin-pop-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="admin-mobile-sheet admin-rolodex">
            <div className="admin-sub-label">Menu</div>
            {[
              { to: "/admin/today", icon: "fa-house", label: "Today" },
              ...navItems,
              { to: "/admin/settings", icon: "fa-gear", label: "Settings" },
            ].map((item, i) => (
              <RailLink key={item.to} to={item.to} className={popClass} onClick={() => setMobileMenuOpen(false)} style={{ "--roll": i }}>
                <i className={`fa-solid ${item.icon}`} />
                <span className="admin-sub-link-body"><div className="admin-sub-link-title">{item.label}</div></span>
              </RailLink>
            ))}
            <div className="admin-pop-divider" />
            <NavLink to="/" end className="admin-sub-link" onClick={() => setMobileMenuOpen(false)} style={{ "--roll": navItems.length + 2 }}>
              <i className="fa-solid fa-globe" />
              <span className="admin-sub-link-body"><div className="admin-sub-link-title">View Site</div></span>
            </NavLink>
            <button className="admin-sub-link admin-side-logout" onClick={handleLogout} style={{ "--roll": navItems.length + 3 }}>
              <i className="fa-solid fa-right-from-bracket" />
              <span className="admin-sub-link-body"><div className="admin-sub-link-title">Logout</div></span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (!desktopMode) return shell;
  return (
    <DesktopProvider initialPath={location.pathname + location.search} onFocusPath={syncUrl}>
      {shell}
    </DesktopProvider>
  );
}

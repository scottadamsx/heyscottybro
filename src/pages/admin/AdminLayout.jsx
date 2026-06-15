import { useEffect, useState } from "react";
import { NavLink, useOutlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { logout } from "../../api/plannerApi";
import ChatBot from "../../components/ChatBot";
import AdminSubSidebar from "../../components/AdminSubSidebar";
import PageTransition from "../../components/motion/PageTransition";
import ErrorBoundary from "../../components/ErrorBoundary";
import CommandPalette from "../../components/CommandPalette";

const NAV_ITEMS = [
  { to: "/admin/planner",  icon: "fa-calendar-check", label: "Planner" },
  { to: "/admin/finance",  icon: "fa-wallet",          label: "Money" },
  { to: "/admin/grocery",  icon: "fa-receipt",         label: "Groceries" },
  { to: "/admin/health",   icon: "fa-heart-pulse",     label: "Health" },
  { to: "/admin/tools",    icon: "fa-wrench",           label: "Tools" },
  { to: "/admin/dates",    icon: "fa-heart",            label: "Date Night" },
  { to: "/admin/vault",    icon: "fa-vault",            label: "Vault" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();

  const [railCollapsed, setRailCollapsed] = useState(
    () => localStorage.getItem("adminRailCollapsed") === "1"
  );
  const [subCollapsed, setSubCollapsed] = useState(
    () => localStorage.getItem("adminSubCollapsed") === "1"
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // NAV_ITEMS is flat; smoke filtering happens inside HealthPage
  const navItems = NAV_ITEMS;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hidden = railCollapsed && subCollapsed;

  const toggleRail = () => setRailCollapsed((v) => { const n = !v; localStorage.setItem("adminRailCollapsed", n ? "1" : "0"); return n; });
  const toggleSub  = () => setSubCollapsed((v)  => { const n = !v; localStorage.setItem("adminSubCollapsed",  n ? "1" : "0"); return n; });
  const showAll    = () => {
    setRailCollapsed(false); setSubCollapsed(false);
    localStorage.setItem("adminRailCollapsed", "0");
    localStorage.setItem("adminSubCollapsed", "0");
  };

  const handleLogout = async () => { await logout(); navigate("/admin/login", { replace: true }); };

  const railClass  = ({ isActive }) => (isActive ? "admin-rail-link active" : "admin-rail-link");
  const popClass   = ({ isActive }) => (isActive ? "admin-sub-link active" : "admin-sub-link");

  const shellClass = hidden
    ? "admin-shell menu-hidden"
    : ["admin-shell", railCollapsed ? "rail-icons" : "", subCollapsed ? "sub-hidden" : ""].filter(Boolean).join(" ");

  return (
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
                <NavLink to="/admin/dashboard" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-house" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Dashboard</div></span>
                </NavLink>
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={popClass} onClick={() => setMenuOpen(false)}>
                    <i className={`fa-solid ${item.icon}`} />
                    <span className="admin-sub-link-body"><div className="admin-sub-link-title">{item.label}</div></span>
                  </NavLink>
                ))}
                <NavLink to="/admin/design" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-swatchbook" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Design</div></span>
                </NavLink>
                <NavLink to="/admin/brain" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-brain" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Brain</div></span>
                </NavLink>
                <NavLink to="/admin/command" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-satellite-dish" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Command</div></span>
                </NavLink>
                <NavLink to="/admin/settings" className={popClass} onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-gear" />
                  <span className="admin-sub-link-body"><div className="admin-sub-link-title">Settings</div></span>
                </NavLink>
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

      <aside className="admin-subbar"><AdminSubSidebar /></aside>

      {/* Main nav rail */}
      <aside className="admin-rail">
        <div className="admin-rail-head">
          <NavLink to="/admin/dashboard" className="admin-rail-mark" title="heyScottyBro"><span>S</span></NavLink>
          <span className="admin-rail-word">hey<span>Scotty</span>Bro</span>
        </div>

        <button className="admin-rail-link" onClick={toggleRail} title={railCollapsed ? "Expand menu" : "Collapse menu"}>
          <i className={`fa-solid ${railCollapsed ? "fa-angles-left" : "fa-angles-right"}`} />
          <span className="admin-rail-label">Collapse menu</span>
        </button>
        <button className="admin-rail-link" onClick={toggleSub} title={subCollapsed ? "Show panel" : "Hide panel"}>
          <i className="fa-solid fa-table-columns" />
          <span className="admin-rail-label">{subCollapsed ? "Show panel" : "Hide panel"}</span>
        </button>

        {/* Dashboard — always pinned */}
        <NavLink to="/admin/dashboard" className={railClass} title="Dashboard">
          <i className="fa-solid fa-house" />
          <span className="admin-rail-label">Dashboard</span>
        </NavLink>

        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={railClass} title={item.label}>
            <i className={`fa-solid ${item.icon}`} />
            <span className="admin-rail-label">{item.label}</span>
          </NavLink>
        ))}

        <div className="admin-rail-spacer" />

        <NavLink to="/admin/design" className={railClass} title="Design">
          <i className="fa-solid fa-swatchbook" />
          <span className="admin-rail-label">Design</span>
        </NavLink>
        <NavLink to="/admin/brain" className={railClass} title="Brain">
          <i className="fa-solid fa-brain" />
          <span className="admin-rail-label">Brain</span>
        </NavLink>
        <NavLink to="/admin/command" className={railClass} title="Command Center">
          <i className="fa-solid fa-satellite-dish" />
          <span className="admin-rail-label">Command</span>
        </NavLink>
        <NavLink to="/admin/settings" className={railClass} title="Settings">
          <i className="fa-solid fa-gear" />
          <span className="admin-rail-label">Settings</span>
        </NavLink>
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
        <NavLink to="/admin/dashboard" className="admin-logo">hey<span>Scotty</span>Bro</NavLink>
      </header>

      <main className="admin-main">
        <ErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

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
              { to: "/admin/dashboard", icon: "fa-house", label: "Dashboard" },
              ...navItems,
              { to: "/admin/design", icon: "fa-swatchbook", label: "Design" },
              { to: "/admin/brain", icon: "fa-brain", label: "Brain" },
              { to: "/admin/command", icon: "fa-satellite-dish", label: "Command" },
              { to: "/admin/settings", icon: "fa-gear", label: "Settings" },
            ].map((item, i) => (
              <NavLink key={item.to} to={item.to} className={popClass} onClick={() => setMobileMenuOpen(false)} style={{ "--roll": i }}>
                <i className={`fa-solid ${item.icon}`} />
                <span className="admin-sub-link-body"><div className="admin-sub-link-title">{item.label}</div></span>
              </NavLink>
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
}

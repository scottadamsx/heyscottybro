import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../../api/plannerApi";
import ChatBot from "../../components/ChatBot";
import AdminSubSidebar from "../../components/AdminSubSidebar";

const NAV_ITEMS = [
  { to: "/admin/dashboard", icon: "fa-house", label: "Dashboard" },
  { to: "/admin/reminders", icon: "fa-list-check", label: "Tasks" },
  { to: "/admin/calendar", icon: "fa-calendar-days", label: "Calendar" },
  { to: "/admin/projects", icon: "fa-folder-open", label: "Projects" },
  { to: "/admin/journal", icon: "fa-book", label: "Journal" },
  { to: "/admin/budget", icon: "fa-wallet", label: "Budget" },
  { to: "/admin/hikers", icon: "fa-person-hiking", label: "Hikers" },
  { to: "/admin/dates", icon: "fa-heart", label: "Date Night" },
  { to: "/admin/accountability", icon: "fa-fire", label: "Accountability" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  // Two independent toggles. When BOTH are collapsed → fully hidden (burger).
  const [railCollapsed, setRailCollapsed] = useState(
    () => localStorage.getItem("adminRailCollapsed") === "1"
  );
  const [subCollapsed, setSubCollapsed] = useState(
    () => localStorage.getItem("adminSubCollapsed") === "1"
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const hidden = railCollapsed && subCollapsed;

  const toggleRail = () => {
    setRailCollapsed((v) => {
      const next = !v;
      localStorage.setItem("adminRailCollapsed", next ? "1" : "0");
      return next;
    });
  };
  const toggleSub = () => {
    setSubCollapsed((v) => {
      const next = !v;
      localStorage.setItem("adminSubCollapsed", next ? "1" : "0");
      return next;
    });
  };
  const showAll = () => {
    setRailCollapsed(false);
    setSubCollapsed(false);
    localStorage.setItem("adminRailCollapsed", "0");
    localStorage.setItem("adminSubCollapsed", "0");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  const railClass = ({ isActive }) => (isActive ? "admin-rail-link active" : "admin-rail-link");
  const popClass = ({ isActive }) => (isActive ? "admin-sub-link active" : "admin-sub-link");

  const shellClass = hidden
    ? "admin-shell menu-hidden"
    : ["admin-shell", railCollapsed ? "rail-icons" : "", subCollapsed ? "sub-hidden" : ""]
        .filter(Boolean).join(" ");

  return (
    <div className={shellClass}>
      {/* Fully-collapsed: floating burger that opens a quick switch menu */}
      {hidden && (
        <>
          <button
            className="admin-rail-reopen"
            onClick={() => setMenuOpen((o) => !o)}
            title="Menu"
            aria-label="Menu"
          >
            <i className="fa-solid fa-bars" />
          </button>
          {menuOpen && (
            <>
              <div className="admin-pop-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="admin-rail-pop">
                <div className="admin-sub-label">Go to</div>
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} className={popClass} onClick={() => setMenuOpen(false)}>
                    <i className={`fa-solid ${item.icon}`} />
                    <span className="admin-sub-link-body"><div className="admin-sub-link-title">{item.label}</div></span>
                  </NavLink>
                ))}
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

      {/* Context panel (sub-pages for the active section) */}
      <aside className="admin-subbar">
        <AdminSubSidebar />
      </aside>

      {/* Main nav rail (expands to labels) */}
      <aside className="admin-rail">
        <div className="admin-rail-head">
          <NavLink to="/admin/dashboard" className="admin-rail-mark" title="heyScottyBro">
            <span>S</span>
          </NavLink>
          <span className="admin-rail-word">hey<span>Scotty</span>Bro</span>
        </div>

        <button
          className="admin-rail-link"
          onClick={toggleRail}
          title={railCollapsed ? "Expand menu" : "Collapse menu"}
          aria-label={railCollapsed ? "Expand menu" : "Collapse menu"}
        >
          <i className={`fa-solid ${railCollapsed ? "fa-angles-left" : "fa-angles-right"}`} />
          <span className="admin-rail-label">Collapse menu</span>
        </button>

        <button
          className="admin-rail-link"
          onClick={toggleSub}
          title={subCollapsed ? "Show panel" : "Hide panel"}
          aria-label={subCollapsed ? "Show panel" : "Hide panel"}
        >
          <i className="fa-solid fa-table-columns" />
          <span className="admin-rail-label">{subCollapsed ? "Show panel" : "Hide panel"}</span>
        </button>

        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={railClass} title={item.label}>
            <i className={`fa-solid ${item.icon}`} />
            <span className="admin-rail-label">{item.label}</span>
          </NavLink>
        ))}

        <div className="admin-rail-spacer" />

        <NavLink to="/" className="admin-rail-link" title="View Site" end>
          <i className="fa-solid fa-globe" />
          <span className="admin-rail-label">View Site</span>
        </NavLink>
        <button className="admin-rail-link admin-rail-logout" onClick={handleLogout} title="Logout">
          <i className="fa-solid fa-right-from-bracket" />
          <span className="admin-rail-label">Logout</span>
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="admin-topbar">
        <NavLink to="/admin/dashboard" className="admin-logo">
          hey<span>Scotty</span>Bro
        </NavLink>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>

      <ChatBot />

      {/* Mobile bottom tab bar */}
      <nav className="admin-bottom-nav">
        <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-house" /><span>Home</span>
        </NavLink>
        <NavLink to="/admin/reminders" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-list-check" /><span>Tasks</span>
        </NavLink>
        <NavLink to="/admin/calendar" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-calendar-days" /><span>Calendar</span>
        </NavLink>
        <NavLink to="/admin/projects" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-folder-open" /><span>Projects</span>
        </NavLink>
        <NavLink to="/admin/hikers" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-person-hiking" /><span>Hikers</span>
        </NavLink>
        <NavLink to="/admin/journal" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-book" /><span>Journal</span>
        </NavLink>
      </nav>
    </div>
  );
}

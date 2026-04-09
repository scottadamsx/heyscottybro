import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../../api/plannerApi";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <NavLink to="/admin/dashboard" className="admin-logo">
          hey<span>Scotty</span>Bro <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.85rem" }}>/ Planner</span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="admin-nav admin-nav-desktop">
          <NavLink to="/admin/dashboard"><i className="fa-solid fa-house" /> Dashboard</NavLink>
          <NavLink to="/admin/reminders"><i className="fa-solid fa-list-check" /> Tasks</NavLink>
          <NavLink to="/admin/calendar"><i className="fa-solid fa-calendar-days" /> Calendar</NavLink>
          <NavLink to="/admin/projects"><i className="fa-solid fa-folder-open" /> Projects</NavLink>
          <NavLink to="/admin/journal"><i className="fa-solid fa-book" /> Journal</NavLink>
          <NavLink to="/admin/budget"><i className="fa-solid fa-wallet" /> Budget</NavLink>
          <NavLink to="/" style={{ color: "var(--text-muted)" }}><i className="fa-solid fa-globe" /> Site</NavLink>
          <button className="admin-nav-logout" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" /> Logout
          </button>
        </nav>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="admin-bottom-nav">
        <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-house" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/admin/reminders" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-list-check" />
          <span>Tasks</span>
        </NavLink>
        <NavLink to="/admin/calendar" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-calendar-days" />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/admin/projects" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-folder-open" />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/admin/journal" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-book" />
          <span>Journal</span>
        </NavLink>
        <NavLink to="/admin/budget" className={({ isActive }) => isActive ? "bottom-tab active" : "bottom-tab"}>
          <i className="fa-solid fa-wallet" />
          <span>Budget</span>
        </NavLink>
      </nav>
    </div>
  );
}

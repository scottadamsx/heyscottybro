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

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard">
            <i className="fa-solid fa-house" /> Dashboard
          </NavLink>
          <NavLink to="/admin/reminders">
            <i className="fa-solid fa-list-check" /> Tasks
          </NavLink>
          <NavLink to="/admin/calendar">
            <i className="fa-solid fa-calendar-days" /> Calendar
          </NavLink>
          <NavLink to="/admin/journal">
            <i className="fa-solid fa-book" /> Journal
          </NavLink>
          <NavLink to="/admin/budget">
            <i className="fa-solid fa-wallet" /> Budget
          </NavLink>
          <NavLink to="/" style={{ color: "var(--text-muted)" }}>
            <i className="fa-solid fa-globe" /> Site
          </NavLink>
          <button className="admin-nav-logout" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" /> Logout
          </button>
        </nav>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

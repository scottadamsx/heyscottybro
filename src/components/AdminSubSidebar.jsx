import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { loadProjects, loadJournal, loadEvents, loadReminders } from "../api/plannerApi";
import { loadHikeHistory } from "../api/hikerApi";
import { formatDisplayDate, toDateStr } from "../utils/plannerUtils";

/** Which admin section is active, derived from the URL path. */
function sectionFromPath(pathname) {
  const seg = pathname.split("/")[2] || "dashboard";
  return seg;
}

const BUDGET_SECTIONS = [
  { key: "projection", label: "9-month projection", icon: "fa-chart-line" },
  { key: "add-tx", label: "Log transaction", icon: "fa-plus" },
  { key: "recurring", label: "Recurring bills", icon: "fa-rotate" },
  { key: "income", label: "Income sources", icon: "fa-sack-dollar" },
  { key: "bva", label: "Budget vs actual", icon: "fa-scale-balanced" },
];

const HIKER_VIEWS = [
  { key: "dashboard", label: "Dashboard", icon: "fa-gauge" },
  { key: "members", label: "Members", icon: "fa-users" },
  { key: "history", label: "Hike history", icon: "fa-calendar-days" },
];

const DASHBOARD_LINKS = [
  { to: "/admin/reminders", label: "Tasks", icon: "fa-list-check" },
  { to: "/admin/calendar", label: "Calendar", icon: "fa-calendar-days" },
  { to: "/admin/projects", label: "Projects", icon: "fa-folder-open" },
  { to: "/admin/journal", label: "Journal", icon: "fa-book" },
  { to: "/admin/budget", label: "Budget", icon: "fa-wallet" },
  { to: "/admin/hikers", label: "Hikers", icon: "fa-person-hiking" },
];

const DATE_SECTIONS = [
  { key: "pick", label: "Pick our date", icon: "fa-wand-magic-sparkles" },
  { key: "bucket", label: "Bucket list", icon: "fa-heart" },
  { key: "done", label: "Been there", icon: "fa-check-double" },
];

const TITLES = {
  dashboard: "Dashboard",
  reminders: "Tasks",
  calendar: "Calendar",
  projects: "Projects",
  journal: "Journal",
  budget: "Budget",
  hikers: "Hikers",
  dates: "Date Night",
};

export default function AdminSubSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = sectionFromPath(location.pathname);

  const [projects, setProjects] = useState([]);
  const [journal, setJournal] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [hikes, setHikes] = useState([]);

  // Load only what the active section needs (refreshes when section changes).
  useEffect(() => {
    let alive = true;
    if (section === "projects") loadProjects().then((d) => alive && setProjects(d)).catch(() => {});
    if (section === "journal") loadJournal().then((d) => alive && setJournal(d)).catch(() => {});
    if (section === "calendar") loadEvents().then((d) => alive && setEvents(d)).catch(() => {});
    if (section === "reminders") loadProjects().then((d) => alive && setProjects(d)).catch(() => {});
    if (section === "hikers") loadHikeHistory().then((d) => alive && setHikes(d || [])).catch(() => {});
    return () => { alive = false; };
  }, [section, location.search]);

  const setParam = (obj) => {
    const next = new URLSearchParams(params);
    Object.entries(obj).forEach(([k, v]) => {
      if (v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    setParams(next);
  };

  const title = TITLES[section] || "Command Center";

  let body = null;

  if (section === "projects") {
    const activeId = params.get("id");
    body = (
      <>
        <button className={`admin-sub-link ${!activeId ? "active" : ""}`} onClick={() => setParam({ id: null, new: null })}>
          <i className="fa-solid fa-table-cells-large" />
          <span className="admin-sub-link-body"><div className="admin-sub-link-title">All projects</div></span>
        </button>
        <div className="admin-sub-label">Your projects</div>
        {projects.length === 0 && <div className="admin-sub-empty">No projects yet.</div>}
        {projects.map((p) => (
          <button key={p.id} className={`admin-sub-link ${activeId === String(p.id) ? "active" : ""}`} onClick={() => setParam({ id: p.id, new: null })}>
            <span className="dot" style={{ background: p.color }} />
            <span className="admin-sub-link-body">
              <div className="admin-sub-link-title">{p.name}</div>
              {p.description && <div className="admin-sub-link-meta">{p.description}</div>}
            </span>
          </button>
        ))}
        <button className="admin-sub-add" onClick={() => setParam({ new: "1", id: null })}>
          <i className="fa-solid fa-plus" /> New project
        </button>
      </>
    );
  } else if (section === "journal") {
    const activeId = params.get("id");
    const entries = [...journal].reverse();
    body = (
      <>
        <button className={`admin-sub-link ${!activeId ? "active" : ""}`} onClick={() => setParam({ id: null, new: null })}>
          <i className="fa-solid fa-list" />
          <span className="admin-sub-link-body"><div className="admin-sub-link-title">All entries</div></span>
        </button>
        <div className="admin-sub-label">Entries</div>
        {entries.length === 0 && <div className="admin-sub-empty">No entries yet.</div>}
        {entries.map((e) => (
          <button key={e.id} className={`admin-sub-link ${activeId === String(e.id) ? "active" : ""}`} onClick={() => setParam({ id: e.id, new: null })}>
            <i className="fa-solid fa-bookmark" />
            <span className="admin-sub-link-body">
              <div className="admin-sub-link-title">{e.title}</div>
              <div className="admin-sub-link-meta">{formatDisplayDate(e.date)}</div>
            </span>
          </button>
        ))}
        <button className="admin-sub-add" onClick={() => setParam({ new: "1", id: null })}>
          <i className="fa-solid fa-plus" /> New entry
        </button>
      </>
    );
  } else if (section === "reminders") {
    const f = params.get("project") || "all";
    const chip = (key, label, color) => (
      <button key={key} className={`admin-sub-link ${f === key ? "active" : ""}`} onClick={() => setParam({ project: key === "all" ? null : key })}>
        {color ? <span className="dot" style={{ background: color }} /> : <i className="fa-solid fa-list-check" />}
        <span className="admin-sub-link-body"><div className="admin-sub-link-title">{label}</div></span>
      </button>
    );
    body = (
      <>
        {chip("all", "All tasks")}
        {chip("none", "Personal")}
        <div className="admin-sub-label">By project</div>
        {projects.length === 0 && <div className="admin-sub-empty">No projects.</div>}
        {projects.map((p) => chip(String(p.id), p.name, p.color))}
      </>
    );
  } else if (section === "calendar") {
    const today = toDateStr(new Date());
    const activeDate = params.get("date");
    const upcoming = [...events].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
    body = (
      <>
        <button className={`admin-sub-link ${activeDate === today ? "active" : ""}`} onClick={() => setParam({ date: today })}>
          <i className="fa-solid fa-location-crosshairs" />
          <span className="admin-sub-link-body"><div className="admin-sub-link-title">Jump to today</div></span>
        </button>
        <div className="admin-sub-label">Upcoming events</div>
        {upcoming.length === 0 && <div className="admin-sub-empty">No upcoming events.</div>}
        {upcoming.map((e) => (
          <button key={e.id} className={`admin-sub-link ${activeDate === e.date ? "active" : ""}`} onClick={() => setParam({ date: e.date })}>
            <i className="fa-solid fa-calendar-day" />
            <span className="admin-sub-link-body">
              <div className="admin-sub-link-title">{e.title}</div>
              <div className="admin-sub-link-meta">{formatDisplayDate(e.date)}</div>
            </span>
          </button>
        ))}
      </>
    );
  } else if (section === "budget") {
    const active = params.get("section");
    body = (
      <>
        <div className="admin-sub-label">Jump to</div>
        {BUDGET_SECTIONS.map((s) => (
          <button key={s.key} className={`admin-sub-link ${active === s.key ? "active" : ""}`} onClick={() => setParam({ section: s.key })}>
            <i className={`fa-solid ${s.icon}`} />
            <span className="admin-sub-link-body"><div className="admin-sub-link-title">{s.label}</div></span>
          </button>
        ))}
      </>
    );
  } else if (section === "hikers") {
    const view = params.get("view") || "dashboard";
    const activeHike = params.get("hike");
    body = (
      <>
        {HIKER_VIEWS.map((v) => (
          <button key={v.key} className={`admin-sub-link ${view === v.key && !activeHike ? "active" : ""}`} onClick={() => setParam({ view: v.key, hike: null })}>
            <i className={`fa-solid ${v.icon}`} />
            <span className="admin-sub-link-body"><div className="admin-sub-link-title">{v.label}</div></span>
          </button>
        ))}
        <div className="admin-sub-label">Recent hikes</div>
        {hikes.length === 0 && <div className="admin-sub-empty">No hikes yet.</div>}
        {hikes.slice(0, 20).map((h) => (
          <button key={h.id} className={`admin-sub-link ${activeHike === String(h.id) ? "active" : ""}`} onClick={() => setParam({ hike: h.id, view: null })}>
            <i className="fa-solid fa-mountain-sun" />
            <span className="admin-sub-link-body">
              <div className="admin-sub-link-title">{h.hike_name || h.filename}</div>
              <div className="admin-sub-link-meta">{h.hike_date ? formatDisplayDate(h.hike_date) : ""}{h.total ? ` · ${h.total}` : ""}</div>
            </span>
          </button>
        ))}
      </>
    );
  } else if (section === "dates") {
    const active = params.get("section");
    body = (
      <>
        <div className="admin-sub-label">Go to</div>
        {DATE_SECTIONS.map((s) => (
          <button key={s.key} className={`admin-sub-link ${active === s.key ? "active" : ""}`} onClick={() => setParam({ section: s.key })}>
            <i className={`fa-solid ${s.icon}`} />
            <span className="admin-sub-link-body"><div className="admin-sub-link-title">{s.label}</div></span>
          </button>
        ))}
      </>
    );
  } else {
    // dashboard / fallback
    body = (
      <>
        <div className="admin-sub-label">Go to</div>
        {DASHBOARD_LINKS.map((l) => (
          <button key={l.to} className="admin-sub-link" onClick={() => navigate(l.to)}>
            <i className={`fa-solid ${l.icon}`} />
            <span className="admin-sub-link-body"><div className="admin-sub-link-title">{l.label}</div></span>
          </button>
        ))}
      </>
    );
  }

  return (
    <>
      <div className="admin-subbar-head">
        <div className="admin-subbar-title">{title}</div>
      </div>
      <div className="admin-sub-list">{body}</div>
    </>
  );
}

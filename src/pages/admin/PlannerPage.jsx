import { useState } from "react";
import { ExportKit } from "../../components/ui";
import { loadReminders, loadEvents } from "../../api/plannerApi";
import { expandReminders, getWeekRange, toDateStr } from "../../utils/plannerUtils";
import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import CalendarPage from "./CalendarPage";
import RemindersPage from "./RemindersPage";
import JournalPage from "./JournalPage";
import ProjectsPage from "./ProjectsPage";
import WorkLogPage from "./WorkLogPage";

const TABS = [
  { key: "overview",  label: "Overview",  icon: "fa-calendar-days" },
  { key: "journal",   label: "Journal",   icon: "fa-book" },
  { key: "projects",  label: "Projects",  icon: "fa-folder-open" },
  { key: "work",      label: "Work",      icon: "fa-briefcase" },
];

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [mobilePanel, setMobilePanel] = useState("cal");

  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-calendar-check" /> Plan
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PageTabs tabs={TABS} active={tab} onChange={setTab} />
          <ExportKit exporter={{
            title: "This week",
            filename: "week-agenda",
            toMarkdown: async () => {
              const [reminders, events] = await Promise.all([loadReminders(), loadEvents()]);
              const wr = getWeekRange(new Date());
              const items = expandReminders(reminders.filter((r) => !r.completed), wr.startStr, wr.endStr);
              const L = [`# Week of ${wr.startStr}`, ""];
              for (let i = 0; i < 7; i++) {
                const d = new Date(wr.startStr + "T00:00:00"); d.setDate(d.getDate() + i);
                const ds = toDateStr(d);
                const day = items.filter((r) => r.date === ds);
                const evs = events.filter((e) => e.date === ds);
                L.push(`## ${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`);
                if (!day.length && !evs.length) L.push("_free_");
                evs.forEach((e) => L.push(`- ${e.title}`));
                day.forEach((r) => L.push(`- [ ] ${r.name}${r.time ? ` · ${r.time}` : ""}`));
                L.push("");
              }
              return L.join("\n");
            },
          }} />
        </div>
      </div>

      {tab === "overview" && (
        <div className={`planner-overview show-${mobilePanel}`}>
          {/* Phone: the two panels can't fit side by side, and the old horizontal
              swipe hid the Tasks panel behind two 6px dots ("my reminders are
              gone on mobile"). A visible segmented switch replaces it. */}
          <div className="planner-switch mobile-only" role="tablist" aria-label="Plan panel">
            <button type="button" role="tab" aria-selected={mobilePanel === "cal"} className={mobilePanel === "cal" ? "active" : ""} onClick={() => setMobilePanel("cal")}>
              <i className="fa-regular fa-calendar" /> Calendar
            </button>
            <button type="button" role="tab" aria-selected={mobilePanel === "tasks"} className={mobilePanel === "tasks" ? "active" : ""} onClick={() => setMobilePanel("tasks")}>
              <i className="fa-solid fa-list-check" /> Tasks
            </button>
          </div>
          <div className="planner-panel planner-cal" data-label="Calendar">
            <CalendarPage />
          </div>
          <div className="planner-panel planner-tasks" data-label="Tasks">
            <RemindersPage />
          </div>
        </div>
      )}

      {tab === "journal" && (
        <div className="combined-embed">
          <JournalPage />
        </div>
      )}

      {tab === "projects" && (
        <div className="combined-embed">
          <ProjectsPage />
        </div>
      )}
      {tab === "work" && (
        <div className="combined-embed"><WorkLogPage /></div>
      )}
    </div>
  );
}

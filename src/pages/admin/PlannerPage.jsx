import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import CalendarPage from "./CalendarPage";
import RemindersPage from "./RemindersPage";
import JournalPage from "./JournalPage";
import ProjectsPage from "./ProjectsPage";

const TABS = [
  { key: "overview",  label: "Overview",  icon: "fa-calendar-days" },
  { key: "journal",   label: "Journal",   icon: "fa-book" },
  { key: "projects",  label: "Projects",  icon: "fa-folder-open" },
];

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";

  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-calendar-check" /> Planner
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "overview" && (
        <div className="planner-overview">
          {/* Mobile swipe indicator dots */}
          <div className="planner-swipe-hint mobile-only">
            <span /><span />
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
    </div>
  );
}

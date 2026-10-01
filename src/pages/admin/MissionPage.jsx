import { Navigate, useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import BrainPage from "./BrainPage";
import Inbox from "../../components/tools/Inbox";
import ResearchPage from "./ResearchPage";
import "./mission.css";

/**
 * MISSION CONTROL — retained AI knowledge and review tools.
 * Brain (knowledge + memory) · Inbox (flagged messages) · Research.
 */
const TABS = [
  { key: "brain",    label: "Brain",    icon: "fa-brain" },
  { key: "inbox",    label: "Inbox",    icon: "fa-inbox" },
  { key: "research", label: "Research", icon: "fa-magnifying-glass-chart" },
];

const DEFAULT_TAB = "brain";

export default function MissionPage() {
  const [params, setParams] = useSearchParams();
  if (params.get("tab") === "usage") return <Navigate to="/admin/analytics?section=ai" replace />;
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : DEFAULT_TAB;
  const setTab = (key) => setParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          Mission Control
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "brain"    && <BrainPage />}
        {tab === "inbox"    && <Inbox />}
        {tab === "research" && <ResearchPage />}
      </div>
    </div>
  );
}

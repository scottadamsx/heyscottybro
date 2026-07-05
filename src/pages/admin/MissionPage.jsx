import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import CommandCenterPage from "./CommandCenterPage";
import BrainPage from "./BrainPage";
import Inbox from "../../components/tools/Inbox";
import BugsPage from "./BugsPage";
import ResearchPage from "./ResearchPage";
import UsagePage from "./UsagePage";

/**
 * MISSION CONTROL — everything the AI staff does, in one space.
 * Agents (the command center) · Brain (knowledge + memory) · Inbox (flagged
 * messages) · Build (the bug/feature tracker that drives dev) · Research ·
 * Usage. Answers one question: "what is my AI staff doing?"
 */
const TABS = [
  { key: "agents",   label: "Agents",   icon: "fa-satellite-dish" },
  { key: "brain",    label: "Brain",    icon: "fa-brain" },
  { key: "inbox",    label: "Inbox",    icon: "fa-inbox" },
  { key: "build",    label: "Build",    icon: "fa-bug" },
  { key: "research", label: "Research", icon: "fa-magnifying-glass-chart" },
  { key: "usage",    label: "Usage",    icon: "fa-chart-line" },
];

const DEFAULT_TAB = "agents";

export default function MissionPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : DEFAULT_TAB;
  const setTab = (key) => setParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-satellite-dish" /> Mission Control
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "agents"   && <CommandCenterPage />}
        {tab === "brain"    && <BrainPage />}
        {tab === "inbox"    && <Inbox />}
        {tab === "build"    && <BugsPage />}
        {tab === "research" && <ResearchPage />}
        {tab === "usage"    && <UsagePage />}
      </div>
    </div>
  );
}

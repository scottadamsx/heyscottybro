import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import AiToolsHub from "../../components/tools/AiToolsHub";
import HikerPage from "./HikerPage";
import BugsPage from "./BugsPage";
import StoragePage from "./StoragePage";
import UsagePage from "./UsagePage";
import BrainPage from "./BrainPage";

const TABS = [
  { key: "apps",    label: "Apps",    icon: "fa-wand-magic-sparkles" },
  { key: "bugs",    label: "Bugs",    icon: "fa-bug" },
  { key: "brain",   label: "Brain",   icon: "fa-brain" },
  { key: "storage", label: "Storage", icon: "fa-database" },
  { key: "usage",   label: "Claude usage", icon: "fa-chart-line" },
  { key: "hikers",  label: "Hike DB", icon: "fa-person-hiking" },
];

const DEFAULT_TAB = "apps";

export default function ToolsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : DEFAULT_TAB;
  const setTab = (key) => setParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-wrench" /> Tools
        </h1>
        {TABS.length > 1 && <PageTabs tabs={TABS} active={tab} onChange={setTab} />}
      </div>
      <div className="combined-embed">
        {tab === "apps"    && <AiToolsHub />}
        {tab === "bugs"    && <BugsPage />}
        {tab === "brain"   && <BrainPage />}
        {tab === "storage" && <StoragePage />}
        {tab === "usage"   && <UsagePage />}
        {tab === "hikers"  && <HikerPage />}
      </div>
    </div>
  );
}

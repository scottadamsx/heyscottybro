import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import HikerPage from "./HikerPage";

const TABS = [
  { key: "hikers", label: "Hike DB", icon: "fa-person-hiking" },
];

export default function ToolsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : "hikers";
  const setTab = (key) => setParams(key === "hikers" ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-wrench" /> Tools
        </h1>
        {TABS.length > 1 && <PageTabs tabs={TABS} active={tab} onChange={setTab} />}
      </div>
      <div className="combined-embed">
        {tab === "hikers" && <HikerPage />}
      </div>
    </div>
  );
}

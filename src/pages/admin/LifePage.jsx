import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import JournalPage from "./JournalPage";
import AccountabilityPage from "./AccountabilityPage";
import ArcadePage from "./ArcadePage";
import { LIFE_TABS } from "../../config/assistantContracts";
import "./life.css";

/**
 * LIFE — Journal (moved here from Plan — Plan is calendar/reminders/events/
 * work only), Habits and Arcade. Food, recipes
 * and fitness moved out to Achilles (DR-015); their data stays in Supabase.
 */
export default function LifePage() {
  const [params, setParams] = useSearchParams();

  const defaultTab = LIFE_TABS[0].key;
  const tab = LIFE_TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : defaultTab;
  const setTab = (key) => setParams(key === defaultTab ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">Life</h1>
        <PageTabs tabs={LIFE_TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "journal" && <JournalPage />}
        {tab === "habits"  && <AccountabilityPage />}
        {tab === "arcade"  && <ArcadePage />}
      </div>
    </div>
  );
}

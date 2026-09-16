import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import JournalPage from "./JournalPage";
import AccountabilityPage from "./AccountabilityPage";
import ArcadePage from "./ArcadePage";
import "./life.css";

/**
 * LIFE — Journal (moved here from Plan — Plan is calendar/reminders/events/
 * work only), Habits and Arcade. Food, recipes
 * and fitness moved out to Achilles (DR-015); their data stays in Supabase.
 */
export default function LifePage() {
  const [params, setParams] = useSearchParams();

  const TABS = [
    { key: "journal", label: "Journal", icon: "fa-book" },
    { key: "habits",  label: "Habits",  icon: "fa-fire" },
    { key: "arcade",  label: "Arcade",  icon: "fa-gamepad" },
  ];

  const defaultTab = TABS[0].key;
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : defaultTab;
  const setTab = (key) => setParams(key === defaultTab ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">Life</h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "journal" && <JournalPage />}
        {tab === "habits"  && <AccountabilityPage />}
        {tab === "arcade"  && <ArcadePage />}
      </div>
    </div>
  );
}

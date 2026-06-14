import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import NutritionPage from "./NutritionPage";
import RecipesPage from "./RecipesPage";
import AccountabilityPage from "./AccountabilityPage";
import WeedTrackerPage from "./WeedTrackerPage";
import { HIDE_SMOKE_TRACKER, useSetting } from "../../utils/settings";

export default function HealthPage() {
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
  const [params, setParams] = useSearchParams();

  const TABS = [
    { key: "nutrition",      label: "Nutrition",      icon: "fa-apple-whole" },
    { key: "recipes",        label: "Recipes",        icon: "fa-utensils" },
    { key: "accountability", label: "Accountability", icon: "fa-fire" },
    ...(!hideSmoke ? [{ key: "smoke", label: "Smoke", icon: "fa-leaf" }] : []),
  ];

  const defaultTab = TABS[0].key;
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : defaultTab;
  const setTab = (key) => setParams(key === defaultTab ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-heart-pulse" /> Health
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "nutrition"      && <NutritionPage />}
        {tab === "recipes"        && <RecipesPage />}
        {tab === "accountability" && <AccountabilityPage />}
        {tab === "smoke"          && <WeedTrackerPage />}
      </div>
    </div>
  );
}

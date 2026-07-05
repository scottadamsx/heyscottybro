import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import NutritionPage from "./NutritionPage";
import RecipesPage from "./RecipesPage";
import GymTracker from "../../components/tools/GymTracker";
import AccountabilityPage from "./AccountabilityPage";
import DatePlannerPage from "./DatePlannerPage";
import WeedTrackerPage from "./WeedTrackerPage";
import { HIDE_SMOKE_TRACKER, useSetting } from "../../utils/settings";

/**
 * LIFE — health & happiness in one space: Food (nutrition), Recipes, Fitness
 * (gym log, promoted out of the old Tools junk drawer), Habits, Dates, and the
 * optional Smoke tracker. Answers: "am I healthy and happy?"
 */
export default function LifePage() {
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
  const [params, setParams] = useSearchParams();

  const TABS = [
    { key: "food",    label: "Food",    icon: "fa-apple-whole" },
    { key: "recipes", label: "Recipes", icon: "fa-utensils" },
    { key: "fitness", label: "Fitness", icon: "fa-dumbbell" },
    { key: "habits",  label: "Habits",  icon: "fa-fire" },
    { key: "dates",   label: "Dates",   icon: "fa-heart" },
    ...(!hideSmoke ? [{ key: "smoke", label: "Smoke", icon: "fa-leaf" }] : []),
  ];

  const defaultTab = TABS[0].key;
  const tab = TABS.find((t) => t.key === params.get("tab")) ? params.get("tab") : defaultTab;
  const setTab = (key) => setParams(key === defaultTab ? {} : { tab: key }, { replace: true });

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-heart-pulse" /> Life
        </h1>
        <PageTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="combined-embed">
        {tab === "food"    && <NutritionPage />}
        {tab === "recipes" && <RecipesPage />}
        {tab === "fitness" && <GymTracker />}
        {tab === "habits"  && <AccountabilityPage />}
        {tab === "dates"   && <DatePlannerPage />}
        {tab === "smoke"   && <WeedTrackerPage />}
      </div>
    </div>
  );
}

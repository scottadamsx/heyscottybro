import { Suspense } from "react";
// Stale-chunk-resilient lazy: reloads once when a deploy invalidated the chunk
// hash of an already-open tab, instead of white-screening. Aliased to `lazy` so
// every lazy(() => import(...)) below goes through it unchanged.
import { lazyWithReload as lazy } from "./utils/lazyWithReload.js";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./contexts/ToastContext";
import { AgentRuntimeProvider } from "./contexts/AgentRuntimeContext";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import HomePage from "./pages/HomePage.jsx";
import Never86Page from "./pages/Never86Page.jsx";
import SJHCPage from "./pages/SJHCPage.jsx";
import GamesPage from "./pages/GamesPage.jsx";
import GuideLayout from "./pages/guide/GuideLayout.jsx";
import GuideStart from "./pages/guide/GuideStart.jsx";
import GuideStep from "./pages/guide/GuideStep.jsx";
import GuideSetup from "./pages/guide/GuideSetup.jsx";
import GuideToolkit from "./pages/guide/GuideToolkit.jsx";
import GuideHelp from "./pages/guide/GuideHelp.jsx";
import GameEmbed from "./pages/GameEmbed.jsx";
import TicTacToePage from "./pages/TicTacToePage.jsx";

// Combined portal pages (lazy — each bundles only what their tab needs)
const SharedDocPage      = lazy(() => import("./pages/SharedDocPage.jsx"));
const DashboardPage      = lazy(() => import("./pages/admin/DashboardPage.jsx"));
const PlannerPage        = lazy(() => import("./pages/admin/PlannerPage.jsx"));
const RemindersPage      = lazy(() => import("./pages/admin/RemindersPage.jsx"));
const WorkLogPage        = lazy(() => import("./pages/admin/WorkLogPage.jsx"));
const TaskDetailPage     = lazy(() => import("./pages/admin/TaskDetailPage.jsx"));
const SchoolPage         = lazy(() => import("./pages/admin/SchoolPage.jsx"));
const LifePage           = lazy(() => import("./pages/admin/LifePage.jsx"));
const RecipePage         = lazy(() => import("./pages/admin/RecipePage.jsx"));
const SchoolDocPage      = lazy(() => import("./pages/admin/SchoolDocPage.jsx"));
const ArcadePage         = lazy(() => import("./pages/admin/ArcadePage.jsx"));
const MissionPage        = lazy(() => import("./pages/admin/MissionPage.jsx"));
const BudgetPage         = lazy(() => import("./pages/admin/BudgetPage.jsx"));
const VaultPage          = lazy(() => import("./pages/admin/VaultPage.jsx"));
const SettingsPage       = lazy(() => import("./pages/admin/SettingsPage.jsx"));
const DesignPage         = lazy(() => import("./pages/admin/DesignPage.jsx"));
const BrainReaderPage    = lazy(() => import("./pages/admin/BrainReaderPage.jsx"));

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Each lazy page gets its own ErrorBoundary — navigating away resets it.
const Lazy = (el) => (
  <ErrorBoundary>
    <Suspense fallback={<div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>}>
      {el}
    </Suspense>
  </ErrorBoundary>
);

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/never86" element={<><Navbar /><Never86Page /><Footer /></>} />
        <Route path="/sjhc" element={<><Navbar /><SJHCPage /><Footer /></>} />
        <Route path="/games" element={<><Navbar /><GamesPage /><Footer /></>} />
        <Route path="/guide" element={<><Navbar /><GuideLayout /><Footer /></>}>
          <Route index element={<GuideStart />} />
          <Route path="step/:slug" element={<GuideStep />} />
          <Route path="setup" element={<GuideSetup />} />
          <Route path="toolkit" element={<GuideToolkit />} />
          <Route path="help" element={<GuideHelp />} />
        </Route>
        <Route path="/games/minecraft-trivia" element={<GameEmbed src="/games/minecraft-trivia/index.html" title="Minecraft Trivia" />} />
        <Route path="/games/monopoly-banker"  element={<GameEmbed src="/games/monopoly-banker/index.html" title="Monopoly Banker" />} />
        <Route path="/games/tictactoe" element={<><Navbar /><TicTacToePage /><Footer /></>} />
        <Route path="/doc/:token" element={Lazy(<SharedDocPage />)} />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route path="/admin" element={<ProtectedRoute><AgentRuntimeProvider><AdminLayout /></AgentRuntimeProvider></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/today" replace />} />

          {/* The Seven Spaces */}
          <Route path="today"     element={Lazy(<DashboardPage />)} />
          <Route path="planner"   element={Lazy(<PlannerPage />)} />
          <Route path="reminders" element={Lazy(<RemindersPage />)} />
          <Route path="work"      element={Lazy(<WorkLogPage />)} />
          <Route path="tasks/:id" element={Lazy(<TaskDetailPage />)} />
          <Route path="finance"   element={Lazy(<BudgetPage />)} />
          <Route path="school"    element={Lazy(<SchoolPage />)} />
          <Route path="school/doc/*" element={Lazy(<SchoolDocPage />)} />
          <Route path="life"      element={Lazy(<LifePage />)} />
          <Route path="recipe/:id" element={Lazy(<RecipePage />)} />
          <Route path="arcade"    element={Lazy(<ArcadePage />)} />
          <Route path="mission"   element={Lazy(<MissionPage />)} />
          <Route path="vault"     element={Lazy(<VaultPage />)} />

          {/* Non-nav pages */}
          <Route path="settings"  element={Lazy(<SettingsPage />)} />
          <Route path="design"    element={Lazy(<DesignPage />)} />
          <Route path="read/*"    element={Lazy(<BrainReaderPage />)} />

          {/* Legacy redirects — keeps old bookmarks working */}
          <Route path="dashboard"      element={<Navigate to="/admin/today" replace />} />
          <Route path="health"         element={<Navigate to="/admin/life" replace />} />
          <Route path="tools"          element={<Navigate to="/admin/mission" replace />} />
          <Route path="command"        element={<Navigate to="/admin/mission" replace />} />
          <Route path="brain"          element={<Navigate to="/admin/mission?tab=brain" replace />} />
          <Route path="research"       element={<Navigate to="/admin/mission?tab=research" replace />} />
          <Route path="grocery"        element={<Navigate to="/admin/finance?tab=receipts" replace />} />
          <Route path="dates"          element={<Navigate to="/admin/life" replace />} />
          <Route path="calendar"       element={<Navigate to="/admin/planner" replace />} />
          <Route path="journal"        element={<Navigate to="/admin/planner?tab=journal" replace />} />
          <Route path="projects"       element={<Navigate to="/admin/planner?tab=projects" replace />} />
          <Route path="nutrition"      element={<Navigate to="/admin/life" replace />} />
          <Route path="recipes"        element={<Navigate to="/admin/life?tab=recipes" replace />} />
          <Route path="accountability" element={<Navigate to="/admin/life?tab=habits" replace />} />
          <Route path="smoke"          element={<Navigate to="/admin/life?tab=smoke" replace />} />
          <Route path="hikers"         element={<Navigate to="/admin/vault?tab=databases" replace />} />
          <Route path="snippets"       element={<Navigate to="/admin/vault" replace />} />
          <Route path="context"        element={<Navigate to="/admin/mission?tab=brain" replace />} />
          <Route path="documents"      element={<Navigate to="/admin/vault?tab=documents" replace />} />
          <Route path="budget"         element={<Navigate to="/admin/finance" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./contexts/ToastContext";
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
import OverviewDashboard from "./pages/OverviewDashboard.jsx";

// Combined portal pages (lazy — each bundles only what their tab needs)
const SharedDocPage      = lazy(() => import("./pages/SharedDocPage.jsx"));
const DashboardPage      = lazy(() => import("./pages/admin/DashboardPage.jsx"));
const PlannerPage        = lazy(() => import("./pages/admin/PlannerPage.jsx"));
const TaskDetailPage     = lazy(() => import("./pages/admin/TaskDetailPage.jsx"));
const BudgetPage         = lazy(() => import("./pages/admin/BudgetPage.jsx"));
const HealthPage         = lazy(() => import("./pages/admin/HealthPage.jsx"));
const ToolsPage          = lazy(() => import("./pages/admin/ToolsPage.jsx"));
const DatePlannerPage    = lazy(() => import("./pages/admin/DatePlannerPage.jsx"));
const VaultPage          = lazy(() => import("./pages/admin/VaultPage.jsx"));
const SettingsPage       = lazy(() => import("./pages/admin/SettingsPage.jsx"));
const DesignPage         = lazy(() => import("./pages/admin/DesignPage.jsx"));
const BrainPage          = lazy(() => import("./pages/admin/BrainPage.jsx"));

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
        <Route path="/" element={<><Navbar /><HomePage /><Footer /></>} />
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
        <Route path="/overview" element={<OverviewDashboard />} />
        <Route path="/doc/:token" element={Lazy(<SharedDocPage />)} />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />

          {/* Primary portals */}
          <Route path="dashboard" element={Lazy(<DashboardPage />)} />
          <Route path="planner"   element={Lazy(<PlannerPage />)} />
          <Route path="tasks/:id" element={Lazy(<TaskDetailPage />)} />
          <Route path="finance"   element={Lazy(<BudgetPage />)} />
          <Route path="health"    element={Lazy(<HealthPage />)} />
          <Route path="tools"     element={Lazy(<ToolsPage />)} />
          <Route path="dates"     element={Lazy(<DatePlannerPage />)} />
          <Route path="vault"     element={Lazy(<VaultPage />)} />
          <Route path="settings"  element={Lazy(<SettingsPage />)} />
          <Route path="design"    element={Lazy(<DesignPage />)} />
          <Route path="brain"     element={Lazy(<BrainPage />)} />

          {/* Legacy redirects — keeps old bookmarks working */}
          <Route path="reminders"      element={<Navigate to="/admin/planner" replace />} />
          <Route path="calendar"       element={<Navigate to="/admin/planner" replace />} />
          <Route path="journal"        element={<Navigate to="/admin/planner?tab=journal" replace />} />
          <Route path="projects"       element={<Navigate to="/admin/planner?tab=projects" replace />} />
          <Route path="nutrition"      element={<Navigate to="/admin/health" replace />} />
          <Route path="recipes"        element={<Navigate to="/admin/health?tab=recipes" replace />} />
          <Route path="accountability" element={<Navigate to="/admin/health?tab=accountability" replace />} />
          <Route path="smoke"          element={<Navigate to="/admin/health?tab=smoke" replace />} />
          <Route path="hikers"         element={<Navigate to="/admin/tools" replace />} />
          <Route path="snippets"       element={<Navigate to="/admin/vault" replace />} />
          <Route path="context"        element={<Navigate to="/admin/vault?tab=context" replace />} />
          <Route path="documents"      element={<Navigate to="/admin/vault?tab=documents" replace />} />
          <Route path="budget"         element={<Navigate to="/admin/finance" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

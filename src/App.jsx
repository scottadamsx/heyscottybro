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
import GameEmbed from "./pages/GameEmbed.jsx";
import TicTacToePage from "./pages/TicTacToePage.jsx";
import OverviewDashboard from "./pages/OverviewDashboard.jsx";

// All admin pages are code-split so the public bundle stays lean.
// AdminLayout + AdminLogin are eager (needed before auth resolves).
const SharedDocPage    = lazy(() => import("./pages/SharedDocPage.jsx"));
const DashboardPage    = lazy(() => import("./pages/admin/DashboardPage.jsx"));
const JournalPage      = lazy(() => import("./pages/admin/JournalPage.jsx"));
const RemindersPage    = lazy(() => import("./pages/admin/RemindersPage.jsx"));
const CalendarPage     = lazy(() => import("./pages/admin/CalendarPage.jsx"));
const BudgetPage       = lazy(() => import("./pages/admin/BudgetPage.jsx"));
const ProjectsPage     = lazy(() => import("./pages/admin/ProjectsPage.jsx"));
const HikerPage        = lazy(() => import("./pages/admin/HikerPage.jsx"));
const DatePlannerPage  = lazy(() => import("./pages/admin/DatePlannerPage.jsx"));
const AccountabilityPage = lazy(() => import("./pages/admin/AccountabilityPage.jsx"));
const SnippetsPage     = lazy(() => import("./pages/admin/SnippetsPage.jsx"));
const WeedTrackerPage  = lazy(() => import("./pages/admin/WeedTrackerPage.jsx"));
const ContextPage      = lazy(() => import("./pages/admin/ContextPage.jsx"));
const SettingsPage     = lazy(() => import("./pages/admin/SettingsPage.jsx"));
const DocumentsPage    = lazy(() => import("./pages/admin/DocumentsPage.jsx"));
const NutritionPage    = lazy(() => import("./pages/admin/NutritionPage.jsx"));
const RecipesPage      = lazy(() => import("./pages/admin/RecipesPage.jsx"));

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";

const Lazy = (el) => <Suspense fallback={<div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>}>{el}</Suspense>;

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes with main nav */}
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <HomePage />
              <Footer />
            </>
          }
        />
        <Route
          path="/never86"
          element={
            <>
              <Navbar />
              <Never86Page />
              <Footer />
            </>
          }
        />
        <Route
          path="/sjhc"
          element={
            <>
              <Navbar />
              <SJHCPage />
              <Footer />
            </>
          }
        />
        <Route
          path="/games"
          element={
            <>
              <Navbar />
              <GamesPage />
              <Footer />
            </>
          }
        />
        <Route
          path="/games/minecraft-trivia"
          element={<GameEmbed src="/games/minecraft-trivia/index.html" title="Minecraft Trivia" />}
        />
        <Route
          path="/games/monopoly-banker"
          element={<GameEmbed src="/games/monopoly-banker/index.html" title="Monopoly Banker" />}
        />
        <Route
          path="/games/tictactoe"
          element={
            <>
              <Navbar />
              <TicTacToePage />
              <Footer />
            </>
          }
        />

        {/* Standalone dark dashboard demo */}
        <Route path="/overview" element={<OverviewDashboard />} />

        {/* Public document share — no auth required */}
        <Route path="/doc/:token" element={Lazy(<SharedDocPage />)} />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard"      element={Lazy(<DashboardPage />)} />
          <Route path="journal"        element={Lazy(<JournalPage />)} />
          <Route path="reminders"      element={Lazy(<RemindersPage />)} />
          <Route path="calendar"       element={Lazy(<CalendarPage />)} />
          <Route path="finance"        element={Lazy(<BudgetPage />)} />
          <Route path="budget"         element={<Navigate to="/admin/finance" replace />} />
          <Route path="projects"       element={Lazy(<ProjectsPage />)} />
          <Route path="hikers"         element={Lazy(<HikerPage />)} />
          <Route path="dates"          element={Lazy(<DatePlannerPage />)} />
          <Route path="accountability" element={Lazy(<AccountabilityPage />)} />
          <Route path="snippets"       element={Lazy(<SnippetsPage />)} />
          <Route path="smoke"          element={Lazy(<WeedTrackerPage />)} />
          <Route path="context"        element={Lazy(<ContextPage />)} />
          <Route path="settings"       element={Lazy(<SettingsPage />)} />
          <Route path="documents"      element={Lazy(<DocumentsPage />)} />
          <Route path="nutrition"      element={Lazy(<NutritionPage />)} />
          <Route path="recipes"        element={Lazy(<RecipesPage />)} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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

// Heavier / less-frequently used pages are code-split. DocumentsPage and
// SharedDocPage pull in react-pdf, so lazy-loading keeps it out of the main bundle.
const SharedDocPage = lazy(() => import("./pages/SharedDocPage.jsx"));
const DocumentsPage = lazy(() => import("./pages/admin/DocumentsPage.jsx"));
const NutritionPage = lazy(() => import("./pages/admin/NutritionPage.jsx"));
const RecipesPage = lazy(() => import("./pages/admin/RecipesPage.jsx"));

const Lazy = (el) => <Suspense fallback={<div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>}>{el}</Suspense>;

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import DashboardPage from "./pages/admin/DashboardPage.jsx";
import JournalPage from "./pages/admin/JournalPage.jsx";
import RemindersPage from "./pages/admin/RemindersPage.jsx";
import CalendarPage from "./pages/admin/CalendarPage.jsx";
import BudgetPage from "./pages/admin/BudgetPage.jsx";
import FinanceApp from "./pages/admin/finance/FinanceApp.jsx";
import ProjectsPage from "./pages/admin/ProjectsPage.jsx";
import HikerPage from "./pages/admin/HikerPage.jsx";
import DatePlannerPage from "./pages/admin/DatePlannerPage.jsx";
import AccountabilityPage from "./pages/admin/AccountabilityPage.jsx";
import SnippetsPage from "./pages/admin/SnippetsPage.jsx";
import WeedTrackerPage from "./pages/admin/WeedTrackerPage.jsx";

export default function App() {
  return (
    <>
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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="finance" element={<FinanceApp />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="hikers" element={<HikerPage />} />
          <Route path="dates" element={<DatePlannerPage />} />
          <Route path="accountability" element={<AccountabilityPage />} />
          <Route path="snippets" element={<SnippetsPage />} />
          <Route path="smoke" element={<WeedTrackerPage />} />
          <Route path="documents" element={Lazy(<DocumentsPage />)} />
          <Route path="nutrition" element={Lazy(<NutritionPage />)} />
          <Route path="recipes" element={Lazy(<RecipesPage />)} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

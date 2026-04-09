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

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import DashboardPage from "./pages/admin/DashboardPage.jsx";
import JournalPage from "./pages/admin/JournalPage.jsx";
import RemindersPage from "./pages/admin/RemindersPage.jsx";
import CalendarPage from "./pages/admin/CalendarPage.jsx";
import BudgetPage from "./pages/admin/BudgetPage.jsx";

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

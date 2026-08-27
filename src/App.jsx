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

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import { ADMIN_PAGES, ADMIN_REDIRECTS, Lazy } from "./pages/admin/adminRoutes.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

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
          {ADMIN_PAGES.map((p) => <Route key={p.path} path={p.path} element={Lazy(p.element)} />)}
          {ADMIN_REDIRECTS.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

// Stale-chunk-resilient lazy: reloads once when a deploy invalidated the chunk
// hash of an already-open tab, instead of white-screening. Aliased to `lazy` so
// every lazy(() => import(...)) below goes through it unchanged.
import { lazyWithReload as lazy } from "./utils/lazyWithReload.js";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./contexts/ToastContext";
import { ADMIN_PAGES, ADMIN_REDIRECTS, Lazy } from "./pages/admin/adminRoutes.jsx";

// Every page is its own chunk: a visitor to the public site never downloads the admin (or
// its agents), and the admin never downloads the public pages.
const Navbar        = lazy(() => import("./components/Navbar.jsx"));
const Footer        = lazy(() => import("./components/Footer.jsx"));
const HomePage      = lazy(() => import("./pages/HomePage.jsx"));
const Never86Page   = lazy(() => import("./pages/Never86Page.jsx"));
const SJHCPage      = lazy(() => import("./pages/SJHCPage.jsx"));
const GamesPage     = lazy(() => import("./pages/GamesPage.jsx"));
const GuideLayout   = lazy(() => import("./pages/guide/GuideLayout.jsx"));
const GuideStart    = lazy(() => import("./pages/guide/GuideStart.jsx"));
const GuideStep     = lazy(() => import("./pages/guide/GuideStep.jsx"));
const GuideSetup    = lazy(() => import("./pages/guide/GuideSetup.jsx"));
const GuideToolkit  = lazy(() => import("./pages/guide/GuideToolkit.jsx"));
const GuideHelp     = lazy(() => import("./pages/guide/GuideHelp.jsx"));
const GameEmbed     = lazy(() => import("./pages/GameEmbed.jsx"));
const TicTacToePage = lazy(() => import("./pages/TicTacToePage.jsx"));
const SharedDocPage = lazy(() => import("./pages/SharedDocPage.jsx"));
const AdminLogin    = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminShell    = lazy(() => import("./pages/admin/AdminShell.jsx"));
const MotionScope   = lazy(() => import("./components/motion/MotionScope.jsx"));

/** A public page with the site's nav and footer, loaded as one unit. */
const withChrome = (page) => Lazy(<MotionScope><Navbar />{page}<Footer /></MotionScope>);

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={Lazy(<HomePage />)} />
        <Route path="/never86" element={withChrome(<Never86Page />)} />
        <Route path="/sjhc" element={withChrome(<SJHCPage />)} />
        <Route path="/games" element={withChrome(<GamesPage />)} />
        <Route path="/guide" element={withChrome(<GuideLayout />)}>
          <Route index element={Lazy(<GuideStart />)} />
          <Route path="step/:slug" element={Lazy(<GuideStep />)} />
          <Route path="setup" element={Lazy(<GuideSetup />)} />
          <Route path="toolkit" element={Lazy(<GuideToolkit />)} />
          <Route path="help" element={Lazy(<GuideHelp />)} />
        </Route>
        <Route path="/games/minecraft-trivia" element={Lazy(<GameEmbed src="/games/minecraft-trivia/index.html" title="Minecraft Trivia" />)} />
        <Route path="/games/monopoly-banker"  element={Lazy(<GameEmbed src="/games/monopoly-banker/index.html" title="Monopoly Banker" />)} />
        <Route path="/games/tictactoe" element={withChrome(<TicTacToePage />)} />
        <Route path="/doc/:token" element={Lazy(<SharedDocPage />)} />

        {/* Admin login */}
        <Route path="/admin/login" element={Lazy(<AdminLogin />)} />

        {/* Protected admin routes */}
        <Route path="/admin" element={Lazy(<AdminShell />)}>
          <Route index element={<Navigate to="/admin/today" replace />} />
          {ADMIN_PAGES.map((p) => <Route key={p.path} path={p.path} element={Lazy(p.element)} />)}
          {ADMIN_REDIRECTS.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

/**
 * The admin page table — one list used twice:
 *   - App.jsx renders it as nested <Route>s under /admin (light/dark: one page at a time).
 *   - The XP desktop renders it inside each window's own MemoryRouter, so several
 *     pages can be open at once, each with its own URL state (?tab=, /tasks/:id …).
 */
import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import ErrorBoundary from "../../components/ErrorBoundary";

const DashboardPage   = lazy(() => import("./DashboardPage.jsx"));
const PlannerPage     = lazy(() => import("./PlannerPage.jsx"));
const RemindersPage   = lazy(() => import("./RemindersPage.jsx"));
const WorkLogPage     = lazy(() => import("./WorkLogPage.jsx"));
const TaskDetailPage  = lazy(() => import("./TaskDetailPage.jsx"));
const SchoolPage      = lazy(() => import("./SchoolPage.jsx"));
const LifePage        = lazy(() => import("./LifePage.jsx"));
const RecipePage      = lazy(() => import("./RecipePage.jsx"));
const SchoolDocPage   = lazy(() => import("./SchoolDocPage.jsx"));
const ArcadePage      = lazy(() => import("./ArcadePage.jsx"));
const MissionPage     = lazy(() => import("./MissionPage.jsx"));
const BudgetPage      = lazy(() => import("./BudgetPage.jsx"));
const VaultPage       = lazy(() => import("./VaultPage.jsx"));
const SettingsPage    = lazy(() => import("./SettingsPage.jsx"));
const DesignPage      = lazy(() => import("./DesignPage.jsx"));
const BrainReaderPage = lazy(() => import("./BrainReaderPage.jsx"));

/** Each lazy page gets its own ErrorBoundary — navigating away resets it. */
export const Lazy = (el) => (
  <ErrorBoundary>
    <Suspense fallback={<div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p></div>}>
      {el}
    </Suspense>
  </ErrorBoundary>
);

/** path is relative to /admin. title/icon feed window captions and the taskbar. */
export const ADMIN_PAGES = [
  { path: "today",        title: "Today",           icon: "fa-house",           element: <DashboardPage /> },
  { path: "planner",      title: "Plan",            icon: "fa-calendar-check",  element: <PlannerPage /> },
  { path: "reminders",    title: "Reminders",       icon: "fa-bell",            element: <RemindersPage /> },
  { path: "work",         title: "Work log",        icon: "fa-briefcase",       element: <WorkLogPage /> },
  { path: "tasks/:id",    title: "Task",            icon: "fa-list-check",      element: <TaskDetailPage /> },
  { path: "finance",      title: "Money",           icon: "fa-wallet",          element: <BudgetPage /> },
  { path: "school",       title: "School",          icon: "fa-graduation-cap",  element: <SchoolPage /> },
  { path: "school/doc/*", title: "School document", icon: "fa-file-lines",      element: <SchoolDocPage /> },
  { path: "life",         title: "Life",            icon: "fa-heart-pulse",     element: <LifePage /> },
  { path: "recipe/:id",   title: "Recipe",          icon: "fa-utensils",        element: <RecipePage /> },
  { path: "arcade",       title: "Arcade",          icon: "fa-gamepad",         element: <ArcadePage /> },
  { path: "mission",      title: "Mission Control", icon: "fa-satellite-dish",  element: <MissionPage /> },
  { path: "vault",        title: "Vault",           icon: "fa-vault",           element: <VaultPage /> },
  { path: "settings",     title: "Settings",        icon: "fa-gear",            element: <SettingsPage /> },
  { path: "design",       title: "Design",          icon: "fa-swatchbook",      element: <DesignPage /> },
  { path: "read/*",       title: "Brain",           icon: "fa-brain",           element: <BrainReaderPage /> },
];

/** Legacy paths that redirect (kept out of the window table). */
export const ADMIN_REDIRECTS = [
  ["dashboard", "/admin/today"], ["health", "/admin/life"], ["tools", "/admin/mission"], ["command", "/admin/mission"],
  ["brain", "/admin/mission?tab=brain"], ["research", "/admin/mission?tab=research"], ["grocery", "/admin/finance?tab=receipts"],
  ["dates", "/admin/life"], ["calendar", "/admin/planner"], ["journal", "/admin/planner?tab=journal"], ["projects", "/admin/planner?tab=projects"],
  ["nutrition", "/admin/life"], ["recipes", "/admin/life?tab=recipes"], ["accountability", "/admin/life?tab=habits"], ["smoke", "/admin/life?tab=smoke"],
  ["hikers", "/admin/vault?tab=databases"], ["snippets", "/admin/vault"], ["context", "/admin/mission?tab=brain"], ["documents", "/admin/vault?tab=documents"],
  ["budget", "/admin/finance"],
];

/** Match a /admin/... path to its page entry (for captions/icons). */
export function pageFor(pathname) {
  const rel = pathname.replace(/^\/admin\/?/, "").split("?")[0];
  return ADMIN_PAGES.find((p) => {
    const pat = "^" + p.path.replace(/\*$/, ".*").replace(/:[^/]+/g, "[^/]+") + "$";
    return new RegExp(pat).test(rel);
  }) || null;
}

/** Route table for use inside a window's MemoryRouter (paths are /admin/...). */
export function WindowRoutes() {
  return (
    <Routes>
      {ADMIN_PAGES.map((p) => <Route key={p.path} path={`/admin/${p.path}`} element={Lazy(p.element)} />)}
      {ADMIN_REDIRECTS.map(([from, to]) => <Route key={from} path={`/admin/${from}`} element={<Navigate to={to} replace />} />)}
      <Route path="/admin" element={<Navigate to="/admin/today" replace />} />
      <Route path="*" element={<div className="module-page"><p className="no-entries">Nothing here.</p></div>} />
    </Routes>
  );
}

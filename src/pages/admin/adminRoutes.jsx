/**
 * The admin page table — App.jsx renders it as nested <Route>s under /admin.
 */
import { Suspense } from "react";
import ErrorBoundary from "../../components/ErrorBoundary";
import { PageSkeleton } from "../../components/Skeleton";
import { lazyWithReload } from "../../utils/lazyWithReload";

const DashboardPage   = lazyWithReload(() => import("./DashboardPage.jsx"));
const PlannerPage     = lazyWithReload(() => import("./PlannerPage.jsx"));
const RemindersPage   = lazyWithReload(() => import("./RemindersPage.jsx"));
const WorkLogPage     = lazyWithReload(() => import("./WorkLogPage.jsx"));
const TaskDetailPage  = lazyWithReload(() => import("./TaskDetailPage.jsx"));
const SchoolPage      = lazyWithReload(() => import("./SchoolPage.jsx"));
const LifePage        = lazyWithReload(() => import("./LifePage.jsx"));
const SchoolDocPage   = lazyWithReload(() => import("./SchoolDocPage.jsx"));
const ArcadePage      = lazyWithReload(() => import("./ArcadePage.jsx"));
const PeoplePage      = lazyWithReload(() => import("./PeoplePage.jsx"));
const HealthPage      = lazyWithReload(() => import("./HealthPage.jsx"));
const WorkoutSessionPage = lazyWithReload(() => import("./WorkoutSessionPage.jsx"));
const MissionPage     = lazyWithReload(() => import("./MissionPage.jsx"));
const AnalyticsPage   = lazyWithReload(() => import("./AnalyticsPage.jsx"));
const BudgetPage      = lazyWithReload(() => import("./BudgetPage.jsx"));
const VaultPage       = lazyWithReload(() => import("./VaultPage.jsx"));
const SettingsPage    = lazyWithReload(() => import("./SettingsPage.jsx"));
const BrainReaderPage = lazyWithReload(() => import("./BrainReaderPage.jsx"));

/** Each lazy page gets its own ErrorBoundary — navigating away resets it. */
export const Lazy = (el) => (
  <ErrorBoundary>
    <Suspense fallback={<PageSkeleton label="Loading page" />}>
      {el}
    </Suspense>
  </ErrorBoundary>
);

/** path is relative to /admin. */
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
  { path: "health",       title: "Health",          icon: "fa-dumbbell",        element: <HealthPage /> },
  { path: "health/workout/:id", title: "Workout",   icon: "fa-dumbbell",        element: <WorkoutSessionPage /> },
  { path: "people/*",     title: "People",          icon: "fa-user-group",      element: <PeoplePage /> },
  { path: "arcade",       title: "Arcade",          icon: "fa-gamepad",         element: <ArcadePage /> },
  { path: "mission",      title: "Mission Control", icon: "fa-satellite-dish",  element: <MissionPage /> },
  { path: "analytics",    title: "Analytics",       icon: "fa-chart-line",      element: <AnalyticsPage /> },
  { path: "vault",        title: "Vault",           icon: "fa-vault",           element: <VaultPage /> },
  { path: "settings",     title: "Settings",        icon: "fa-gear",            element: <SettingsPage /> },
  { path: "read/*",       title: "Brain",           icon: "fa-brain",           element: <BrainReaderPage /> },
];

/** Legacy paths that redirect (kept out of the window table). */
export const ADMIN_REDIRECTS = [
  ["dashboard", "/admin/today"], ["tools", "/admin/mission"], ["command", "/admin/mission"],
  ["brain", "/admin/mission?tab=brain"], ["research", "/admin/mission?tab=research"], ["grocery", "/admin/finance?tab=receipts"],
  ["dates", "/admin/planner"], ["calendar", "/admin/planner"], ["journal", "/admin/life?tab=journal"], ["projects", "/admin/planner?tab=projects"],
  ["nutrition", "/admin/health?tab=food"], ["recipes", "/admin/health?tab=food"], ["fitness", "/admin/health?tab=workouts"], ["accountability", "/admin/life?tab=habits"],
  ["hikers", "/admin/vault?tab=databases"], ["snippets", "/admin/vault"], ["context", "/admin/mission?tab=brain"], ["documents", "/admin/vault?tab=documents"],
  ["budget", "/admin/finance"], ["design", "/admin/settings"],
];

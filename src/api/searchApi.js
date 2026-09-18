/**
 * ⌘K full-site search — the sources. Each one reads its collection ONCE per
 * palette open through the collection's own *Api loader and flattens rows to
 * { id, title, sub, text, to, date }; the palette then filters in memory on
 * every keystroke (utils/siteSearch.js). A failing source rejects with its own
 * message so the palette can name it — never an empty group that looks like
 * "no matches".
 *
 * This module is loaded with import() when the palette opens, so none of these
 * API modules weigh on the startup bundle.
 *
 * Secrets: snippets come from listSnippetTitles(), which never selects `value`.
 */
import { loadReminders, loadEvents, loadProjects, loadJournal } from "./plannerApi";
import { loadAccountability } from "./accountabilityApi";
import { loadCourses } from "./coursesApi";
import { listSnippetTitles } from "./snippetsApi";
import { loadDocuments } from "./documentsApi";
import { loadPeople } from "./peopleApi";
import { loadProfile, loadSessions, loadFood } from "./healthApi";
import { formatDisplayDate, formatTime12, toDateStr } from "../utils/plannerUtils";

const shortDate = (ds) => (ds ? formatDisplayDate(ds) : "");
const join = (...parts) => parts.filter(Boolean).join(" · ");
const q = (s) => encodeURIComponent(s ?? "");

const SNIPPET_TYPE = { code: "Code / combo", password: "Password", wifi: "Wi-Fi", card: "Card", note: "Note", prompt: "Prompt", other: "Other" };
const PEOPLE_GROUP = { partner: "Partner", family: "Family", friends: "Friends", sjhc: "SJHC", sjlc: "SJLC", carrick: "Carrick", school: "School", other: "Other" };

/** space: the nav path that owns the source — a hidden page hides its results too. */
export const SEARCH_SOURCES = [
  {
    key: "tasks", label: "Tasks", icon: "fa-list-check", space: "/admin/reminders",
    load: async () => (await loadReminders()).map((r) => ({
      id: r.id, title: r.name || "(untitled task)", date: r.date,
      sub: join(r.completed ? "Done" : null, r.date ? shortDate(r.date) : "No date", r.time ? formatTime12(r.time) : null),
      text: r.description, to: `/admin/tasks/${q(r.id)}`,
    })),
  },
  {
    key: "events", label: "Events", icon: "fa-calendar-day", space: "/admin/planner",
    load: async () => (await loadEvents()).map((e) => ({
      id: e.id, title: e.title || "(untitled event)", date: e.date,
      sub: join(shortDate(e.date), e.start_time ? formatTime12(e.start_time) : "All day"),
      text: e.description, to: `/admin/planner?date=${q(e.date)}`,
    })),
  },
  {
    key: "projects", label: "Projects", icon: "fa-folder-open", space: "/admin/planner",
    load: async () => (await loadProjects()).map((p) => ({
      id: p.id, title: p.name || "(untitled project)", sub: "Project", text: p.description,
      to: `/admin/planner?tab=projects&id=${q(p.id)}`,
    })),
  },
  {
    key: "journal", label: "Journal", icon: "fa-book", space: "/admin/life",
    load: async () => (await loadJournal()).map((j) => ({
      id: j.id, title: j.title || shortDate(j.date), date: j.date,
      sub: shortDate(j.date), text: j.entry, to: `/admin/life?tab=journal&id=${q(j.id)}`,
    })),
  },
  {
    key: "habits", label: "Habits", icon: "fa-fire", space: "/admin/life",
    load: async () => ((await loadAccountability()).trackers || []).map((t) => ({
      id: t.id, title: `${t.emoji ? `${t.emoji} ` : ""}${t.name}`, sub: t.mode === "count" ? "Habit · tally" : "Habit",
      to: `/admin/life?tab=habits&id=${q(t.id)}`,
    })),
  },
  {
    key: "courses", label: "Courses", icon: "fa-graduation-cap", space: "/admin/school",
    load: async () => (await loadCourses()).map((c) => ({
      id: c.id, title: c.name ? `${c.name}` : c.code, sub: join(c.code, c.term, c.instructor),
      to: `/admin/school?course=${q(c.id)}`,
    })),
  },
  {
    key: "snippets", label: "Vault", icon: "fa-key", space: "/admin/vault",
    load: async () => (await listSnippetTitles()).map((s) => ({
      id: s.id, title: s.title || "(untitled)", sub: SNIPPET_TYPE[s.type] || "Snippet",
      to: `/admin/vault?q=${q(s.title)}`,
    })),
  },
  {
    key: "documents", label: "Documents", icon: "fa-file-lines", space: "/admin/vault",
    load: async () => (await loadDocuments()).map((d) => ({
      id: d.id, title: d.name || d.filename || "(untitled document)", sub: d.filename && d.filename !== d.name ? d.filename : "Document",
      text: [d.description, ...(d.tags || [])].filter(Boolean).join(" "),
      to: `/admin/vault?tab=documents&q=${q(d.name || d.filename)}`,
    })),
  },
  {
    key: "people", label: "People", icon: "fa-user-group", space: "/admin/people",
    load: async () => (await loadPeople()).map((p) => ({
      id: p.id, title: p.name || "(no name)", sub: join(PEOPLE_GROUP[p.group], p.how),
      text: [p.notes, p.facts, p.open_items].filter(Boolean).join(" "),
      to: `/admin/people/person/${q(p.id)}`, people: true,
    })),
  },
  {
    key: "workouts", label: "Workouts", icon: "fa-dumbbell", space: "/admin/health",
    load: async () => (await loadSessions()).map((s) => {
      const day = s.startedAt ? toDateStr(new Date(s.startedAt)) : "";
      return {
        id: s.id, title: s.name || "Workout", date: day,
        sub: join(shortDate(day), s.endedAt ? null : "In progress"),
        text: (s.exercises || []).map((x) => x?.name || x?.exercise || "").join(" "),
        to: `/admin/health/workout/${q(s.id)}`,
      };
    }),
  },
  {
    key: "food", label: "Food", icon: "fa-utensils", space: "/admin/health",
    load: async () => {
      const profile = await loadProfile();
      const since = new Date();
      since.setDate(since.getDate() - 180);
      return (await loadFood(profile.id, { from: toDateStr(since) })).map((f) => ({
        id: f.id, title: f.name || "Food", date: f.date,
        sub: join(f.meal_type ? f.meal_type[0].toUpperCase() + f.meal_type.slice(1) : null, shortDate(f.date), f.calories != null ? `${f.calories} kcal` : null),
        text: f.description, to: "/admin/health?tab=food",
      }));
    },
  },
];

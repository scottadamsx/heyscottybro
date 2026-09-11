import { useEffect, useState } from "react";
import { ExportKit, Modal } from "../../components/ui";
import { loadReminders, loadEvents, loadProjects, loadEventTypes, newReminder } from "../../api/plannerApi";
import { expandReminders, getWeekRange, toDateStr, formatTime12 } from "../../utils/plannerUtils";
import { useSearchParams } from "react-router-dom";
import PageTabs from "../../components/PageTabs";
import PageActions from "../../components/PageActions";
import EventForm from "../../components/EventForm";
import DatePicker from "../../components/DatePicker";
import { createEventWithAutoTasks } from "../../lib/events";
import { useToast } from "../../contexts/ToastContext";
import CalendarPage from "./CalendarPage";
import RemindersPage from "./RemindersPage";
import ProjectsPage from "./ProjectsPage";
import WorkLogPage from "./WorkLogPage";

const emptyQuickReminder = { name: "", date: toDateStr(new Date()), recurrence: "none" };

// Journal lives in Life now (Scott: Plan is calendar/reminders/events/work).
const TABS = [
  { key: "overview",  label: "Overview",  icon: "fa-calendar-days" },
  { key: "projects",  label: "Projects",  icon: "fa-folder-open" },
  { key: "work",      label: "Work",      icon: "fa-briefcase" },
];

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [mobilePanel, setMobilePanel] = useState("cal");
  const { addToast } = useToast();

  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  // For the quick "+ New Event" modal's project/type pickers — loaded once,
  // refreshed on reopen so a project added elsewhere shows up.
  const [projects, setProjects] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [quickReminder, setQuickReminder] = useState(emptyQuickReminder);
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    if (!showEventModal) return;
    Promise.all([loadProjects().catch(() => []), loadEventTypes().catch(() => [])])
      .then(([p, et]) => { setProjects(p); setEventTypes(et); });
  }, [showEventModal]);

  const addEvent = async (values) => {
    await createEventWithAutoTasks(values, eventTypes);
    setShowEventModal(false);
    addToast("Event added.", "success");
  };

  const addQuickReminder = async (e) => {
    e.preventDefault();
    if (!quickReminder.name.trim()) return;
    setSavingReminder(true);
    try {
      await newReminder({ name: quickReminder.name.trim(), date: quickReminder.date || null, recurrence: quickReminder.recurrence });
      setQuickReminder(emptyQuickReminder);
      setShowReminderModal(false);
      addToast("Reminder added.", "success");
    } catch (err) {
      addToast(`Couldn't add reminder: ${err?.message || "unknown error"}`, "error");
    } finally {
      setSavingReminder(false);
    }
  };

  // The toolbar's quick actions change with the tab — Overview is the one
  // place adding an event or task isn't already one click away inside the
  // panel below (Projects/Work each keep their own "+ New …" in their own
  // header, right there in the panel).
  const toolbarActions = tab === "overview"
    ? [
      { key: "new-event", label: "New Event", icon: "fa-calendar-plus", onClick: () => setShowEventModal(true) },
      { key: "new-reminder", label: "New Reminder", icon: "fa-bell", tone: "secondary", onClick: () => setShowReminderModal(true) },
    ]
    : [];

  return (
    <div className="combined-page">
      <div className="combined-page-header">
        <h1 className="combined-page-title">
          <i className="fa-solid fa-calendar-check" /> Plan
        </h1>
        <div className="combined-page-toolbar">
          <PageTabs tabs={TABS} active={tab} onChange={setTab} />
          <PageActions actions={toolbarActions} />
          <ExportKit exporter={{
            title: "This week",
            filename: "week-agenda",
            toMarkdown: async () => {
              const [reminders, events] = await Promise.all([loadReminders(), loadEvents()]);
              const wr = getWeekRange(new Date());
              const items = expandReminders(reminders.filter((r) => !r.completed), wr.startStr, wr.endStr);
              const L = [`# Week of ${wr.startStr}`, ""];
              for (let i = 0; i < 7; i++) {
                const d = new Date(wr.startStr + "T00:00:00"); d.setDate(d.getDate() + i);
                const ds = toDateStr(d);
                const day = items.filter((r) => r.date === ds);
                const evs = events.filter((e) => e.date === ds);
                L.push(`## ${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`);
                if (!day.length && !evs.length) L.push("_free_");
                evs.forEach((e) => L.push(`- ${e.title}`));
                day.forEach((r) => L.push(`- [ ] ${r.name}${r.time ? ` · ${formatTime12(r.time)}` : ""}`));
                L.push("");
              }
              return L.join("\n");
            },
          }} />
        </div>
      </div>

      {tab === "overview" && (
        <div className={`planner-overview show-${mobilePanel}`}>
          {/* Phone: the two panels can't fit side by side, and the old horizontal
              swipe hid the Tasks panel behind two 6px dots ("my reminders are
              gone on mobile"). A visible segmented switch replaces it. */}
          <div className="planner-switch mobile-only" role="tablist" aria-label="Plan panel">
            <button type="button" role="tab" aria-selected={mobilePanel === "cal"} className={mobilePanel === "cal" ? "active" : ""} onClick={() => setMobilePanel("cal")}>
              <i className="fa-regular fa-calendar" /> Calendar
            </button>
            <button type="button" role="tab" aria-selected={mobilePanel === "tasks"} className={mobilePanel === "tasks" ? "active" : ""} onClick={() => setMobilePanel("tasks")}>
              <i className="fa-solid fa-list-check" /> Tasks
            </button>
          </div>
          <div className="planner-panel planner-cal" data-label="Calendar">
            <CalendarPage />
          </div>
          <div className="planner-panel planner-tasks" data-label="Tasks">
            <RemindersPage />
          </div>
        </div>
      )}

      {tab === "projects" && (
        <div className="combined-embed">
          <ProjectsPage />
        </div>
      )}
      {tab === "work" && (
        <div className="combined-embed"><WorkLogPage /></div>
      )}

      {showEventModal && (
        <Modal title="New event" onClose={() => setShowEventModal(false)} width={520}>
          <EventForm projects={projects} eventTypes={eventTypes} onSubmit={addEvent} onCancel={() => setShowEventModal(false)} />
        </Modal>
      )}

      {showReminderModal && (
        <Modal title="New reminder" onClose={() => setShowReminderModal(false)} width={420}>
          <form className="form-card" onSubmit={addQuickReminder}>
            <input placeholder="Reminder name" value={quickReminder.name} onChange={(e) => setQuickReminder({ ...quickReminder, name: e.target.value })} required autoFocus />
            <div className="form-row">
              <DatePicker value={quickReminder.date} onChange={(v) => setQuickReminder({ ...quickReminder, date: v })} placeholder="Due date" />
              <select value={quickReminder.recurrence} onChange={(e) => setQuickReminder({ ...quickReminder, recurrence: e.target.value })} aria-label="Recurrence">
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={savingReminder}>{savingReminder ? "Saving…" : "Add reminder"}</button>
              <button className="btn btn-secondary-sm" type="button" onClick={() => setShowReminderModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

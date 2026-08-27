/**
 * The Morning Brief — reinvented (MASTERPLAN §2.4 + "the briefing sucks").
 *
 * Old briefing: press a button, wait for Claude, get a vague paragraph.
 * New brief: DATA FIRST. Everything below is computed instantly from state the
 * Today page already loads — priorities, agenda, money, school, AI-staff pulse —
 * each line linking to its space. The optional AI "read" is 2–3 sentences ON TOP
 * of the numbers, never instead of them. One structure feeds the on-screen card,
 * the ExportKit (print/PDF/email-me), and the 7am cron email.
 *
 * buildBrief(inputs) -> { date, sections: [{key,title,icon,items:[{text,to?,tone?}]}], toMarkdown() }
 */
import { toDateStr, formatMoney, remindersForDay, expandReminders, expandEvents, undatedReminders, formatTime12 } from "../utils/plannerUtils";

const addDaysStr = (str, n) => { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); };
const dayLabel = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function buildBrief({
  reminders = [], events = [], budget = null, upcomingBills = [],
  courses = [], courseStats = {}, deadlines = [],
  agentActions = [], openBugs = null, unreadInbox = null,
}) {
  const todayStr = toDateStr(new Date());
  const active = reminders.filter((r) => !r.completed);

  // ── Priorities: overdue first, then today, then school deadlines ≤3 days ──
  const overdue = active
    .filter((r) => r.date && r.date < todayStr && r.recurrence === "none")
    .sort((a, b) => a.date.localeCompare(b.date));
  const dueToday = remindersForDay(active, todayStr);
  const soonDeadlines = deadlines.filter((r) => {
    const d = Math.ceil((new Date(`${r.date}T12:00:00`) - new Date()) / 86400000);
    return d >= 0 && d <= 3;
  });
  // Undated tasks are real work with no calendar slot. They used to fall out of
  // every date-driven view, so they land here at the bottom of Priorities.
  const anytime = undatedReminders(active);
  const priorities = [
    ...overdue.map((r) => ({ text: `OVERDUE (${r.date}): ${r.name}`, to: `/admin/tasks/${r.id}`, tone: "bad" })),
    ...dueToday.map((r) => ({ text: `Today: ${r.name}${r.time ? ` · ${formatTime12(r.time)}` : ""}`, to: `/admin/tasks/${r.id}` })),
    ...soonDeadlines.map((r) => ({ text: `Deadline ${dayLabel(r.date)}: ${r.name}`, to: "/admin/school", tone: "warn" })),
    ...anytime.map((r) => ({ text: `Anytime: ${r.name}`, to: `/admin/tasks/${r.id}`, tone: "muted" })),
  ];

  // ── Agenda: today's + tomorrow's events ──
  const agenda = expandEvents(events, todayStr, addDaysStr(todayStr, 1))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.start_time || "99").localeCompare(String(b.start_time || "99")))
    .map((e) => {
      const t = e.start_time ? ` · ${formatTime12(e.start_time)}${e.end_time ? ` – ${formatTime12(e.end_time)}` : ""}` : "";
      return { text: `${e.date === todayStr ? "Today" : "Tomorrow"}: ${e.title}${t}`, to: "/admin/planner" };
    });

  // ── Money pulse ──
  const money = [];
  if (budget) {
    const wk = budget.currentWeek;
    if (wk) money.push({ text: `Free to spend this week: ${formatMoney(wk.remaining ?? wk.allowance ?? 0)}`, to: "/admin/finance", tone: (wk.remaining ?? 0) < 0 ? "bad" : "good" });
    if (budget.remaining != null) money.push({ text: `Left this pay period: ${formatMoney(budget.remaining)}`, to: "/admin/finance", tone: budget.remaining < 0 ? "bad" : "default" });
    const nextBill = (upcomingBills || []).find((b) => !b.paid);
    if (nextBill) money.push({ text: `Next bill: ${nextBill.name} ${formatMoney(nextBill.amount)} on ${dayLabel(nextBill.due)}`, to: "/admin/finance?tab=bills" });
  }

  // ── School pulse ──
  const school = [];
  if (courses.length) {
    const avgs = courses.map((c) => courseStats[c.id]?.currentPct).filter((v) => v != null);
    if (avgs.length) {
      const avg = avgs.reduce((s, v) => s + v, 0) / avgs.length;
      school.push({ text: `Semester average: ${avg.toFixed(1)}%`, to: "/admin/school", tone: avg >= 80 ? "good" : avg >= 70 ? "warn" : "bad" });
    }
    deadlines.slice(0, 3).forEach((r) => school.push({ text: `${dayLabel(r.date)}: ${r.name}`, to: "/admin/school" }));
  }

  // ── AI staff pulse ──
  const dayAgo = Date.now() - 86400000;
  const recentActions = agentActions.filter((a) => new Date(a.created_at).getTime() > dayAgo);
  const staff = [];
  if (recentActions.length) staff.push({ text: `${recentActions.length} agent action${recentActions.length === 1 ? "" : "s"} in the last 24h`, to: "/admin/mission" });
  if (openBugs != null && openBugs > 0) staff.push({ text: `${openBugs} open bug${openBugs === 1 ? "" : "s"} / feature request${openBugs === 1 ? "" : "s"}`, to: "/admin/mission?tab=build" });
  if (unreadInbox != null && unreadInbox > 0) staff.push({ text: `${unreadInbox} unread message${unreadInbox === 1 ? "" : "s"} in the AI Inbox`, to: "/admin/mission?tab=inbox", tone: "warn" });

  const sections = [
    { key: "priorities", title: "Priorities", icon: "fa-bolt", items: priorities, empty: "Nothing due — you're clear." },
    { key: "agenda", title: "Agenda", icon: "fa-calendar-day", items: agenda, empty: "No events today or tomorrow." },
    { key: "money", title: "Money", icon: "fa-wallet", items: money, empty: "No budget set up." },
    ...(courses.length ? [{ key: "school", title: "School", icon: "fa-graduation-cap", items: school, empty: "No deadlines on the books." }] : []),
    { key: "staff", title: "Your AI staff", icon: "fa-satellite-dish", items: staff, empty: "All quiet." },
  ];

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const toMarkdown = (aiTake = "") => {
    const L = [`# Morning Brief — ${dateLabel}`, ""];
    if (aiTake) L.push(`> ${aiTake.trim().replace(/\n+/g, " ")}`, "");
    for (const s of sections) {
      L.push(`## ${s.title}`);
      if (s.items.length === 0) L.push(`_${s.empty}_`);
      else s.items.forEach((i) => L.push(`- ${i.text}`));
      L.push("");
    }
    return L.join("\n");
  };

  return { date: dateLabel, sections, counts: { overdue: overdue.length, today: dueToday.length }, toMarkdown };
}

/** The 30-day week list used by the "This week" expander (unchanged helper). */
export function weekOf(reminders, startStr, days = 7) {
  const out = [];
  const items = expandReminders(reminders.filter((r) => !r.completed), startStr, addDaysStr(startStr, days - 1));
  for (let i = 0; i < days; i++) {
    const ds = addDaysStr(startStr, i);
    out.push({ ds, items: items.filter((r) => r.date === ds) });
  }
  return out;
}

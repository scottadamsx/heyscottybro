import { useState, useRef, useEffect } from "react";
import {
  loadReminders, newReminder, updateReminder, completeReminder, deleteReminder,
  loadEvents, newEvent, deleteEvent,
  loadProjects, newProject, updateProject, deleteProject,
  loadJournal, newJournalEntry,
  loadInitiatives, newInitiative,
  loadEventTypes, newEventType, updateEventType,
  loadTransactions, newTransaction, deleteTransaction,
  addRecurringBill, addIncomeSource, loadBudgetConfig, saveBudgetConfig,
} from "../api/plannerApi";
import { loadMembers, deleteMember, clearAllMembers } from "../api/hikerApi";
import { renderMarkdown } from "../utils/markdown";
import { toDateStr } from "../utils/plannerUtils";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Local-timezone "today" (YYYY-MM-DD) — used as a default when a tool needs a date.
const today = () => toDateStr(new Date());

// Build a fresh, LOCAL-timezone date context every time we open a conversation.
// `toISOString()` reports the UTC day, which is already "tomorrow" on US evenings —
// that was causing the agent to schedule reminders one day late.
function buildSystemPrompt() {
  const now = new Date();
  const today = toDateStr(now);
  const weekday = WEEKDAYS[now.getDay()];
  // Concrete map of the next 7 weekday names → dates so the agent never has to
  // do calendar arithmetic itself (a common source of off-by-one errors).
  const upcoming = WEEKDAYS.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
    return `${WEEKDAYS[d.getDay()]} = ${toDateStr(d)}`;
  }).join(", ");

  return `You are Frodo, Scott's loyal personal assistant living inside his planner app (heyScottyBro).

Today is ${weekday}, ${today} (Scott's LOCAL date). The next seven days are: ${upcoming}.

Personality: warm, upbeat, and a touch adventurous — you treat keeping Scott organised like a quest you're happy to be on. Light humour and the occasional cheeky aside are welcome ("consider it done", "one does not simply forget leg day"), but never at the expense of being genuinely useful and concise. Address Scott directly, sign off warmly now and then, and go easy on emojis.

You have FULL read/write access to Scott's data and can make complex, multi-step changes end to end without asking permission for routine work — just do it, then confirm what you did. To make an informed change, first call list_items to read the current data (it returns IDs you need for updates/deletes), then act. When Scott asks for several items at once (e.g. "reminders for Monday, Wednesday and Friday"), create EVERY one in the same turn.

Capabilities: reminders/tasks (add, edit, complete, delete — incl. recurring, due dates, projects), calendar events, projects + nested sub-projects, event types with auto-task dependencies, journal entries, initiatives, transactions, recurring bills, income, balance, and the hiker database.

Formatting: reply in Markdown. Use **bold** for emphasis, bullet lists for steps, and Markdown TABLES whenever you present multiple records to the user (e.g. listing tasks, projects, search results) so they render as a grid. Keep prose short.

DATES — read carefully:
- Always resolve relative dates ("tomorrow", "next Monday", "this Friday") to a YYYY-MM-DD string BEFORE calling any tool, using the local date and weekday map above. Never guess the weekday — use the map.
- "This <weekday>" means the named day in the current week (today or later); "next <weekday>" means the following week. When in doubt, pick the soonest upcoming matching date and state the exact date back to Scott.
- The date you pass is the literal calendar day the task is due — do not add or subtract a day for timezones.

Transaction categories: Food, Transport, Bills, Entertainment, Housing, Car, Subscriptions, Travel, Other. "Fun money" = Entertainment.

Safety: before any destructive BULK action (deleting all hikers, deleting a project with its tasks, etc.) ask one short confirmation question first and wait for a clear yes. Single, easily-reversible changes need no confirmation.`;
}

const TOOLS = [
  {
    name: "list_items",
    description: "Read Scott's current data. Returns records with their IDs (needed for update/delete). Use before making changes.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["reminders", "events", "projects", "journal", "transactions", "initiatives", "event_types"], description: "Which collection to read" },
      },
      required: ["type"],
    },
  },
  {
    name: "add_reminder",
    description: "Add a reminder/task (optionally recurring, with a due date and/or project)",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
        time: { type: "string", description: "HH:MM (optional)" },
        description: { type: "string" },
        recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
        project_id: { type: "string", description: "Attach to a project/sub-project (from list_items projects)" },
        show_on_calendar: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_reminder",
    description: "Edit an existing reminder/task (change its name, date, time, recurrence, project, etc). Get the id from list_items first. Only pass the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        date: { type: "string", description: "Due date YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
        description: { type: "string" },
        recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
        project_id: { type: "string" },
        show_on_calendar: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  { name: "complete_reminder", description: "Mark a reminder/task complete", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "delete_reminder", description: "Delete a reminder/task by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_event",
    description: "Add a calendar event. If an event_type with auto-tasks is given, dependency reminders are auto-created.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string" },
        project_id: { type: "string" },
        event_type_id: { type: "string" },
      },
      required: ["title", "date"],
    },
  },
  { name: "delete_event", description: "Delete a calendar event by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_project",
    description: "Create a project, or a sub-project (e.g. a class) by passing parent_id",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        color: { type: "string", description: "Hex colour like #4f7cff" },
        parent_id: { type: "string", description: "Parent project id to nest under (optional)" },
      },
      required: ["name"],
    },
  },
  { name: "update_project", description: "Rename or recolour a project", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, color: { type: "string" } }, required: ["id"] } },
  { name: "delete_project", description: "Delete a project (and its tasks/sub-projects). Confirm first.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_event_type",
    description: "Create an event type with auto-task dependencies that fire relative to an event's date",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        color: { type: "string" },
        auto_tasks: {
          type: "array",
          description: "Dependency reminders. offset_days negative = before, 0 = day of, positive = after.",
          items: { type: "object", properties: { offset_days: { type: "number" }, name: { type: "string" } }, required: ["offset_days", "name"] },
        },
      },
      required: ["name"],
    },
  },
  { name: "add_journal_entry", description: "Add a journal entry", input_schema: { type: "object", properties: { title: { type: "string" }, entry: { type: "string" }, date: { type: "string" } }, required: ["title", "entry"] } },
  { name: "add_initiative", description: "Add a recurring initiative/commitment to a project", input_schema: { type: "object", properties: { project_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, recurrence: { type: "string", enum: ["daily", "weekly", "monthly"] } }, required: ["name"] } },
  {
    name: "add_transaction",
    description: "Log a financial transaction (expense, income, or future planned spend)",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number", description: "Positive — sign derived from type" },
        type: { type: "string", enum: ["expense", "income", "future"] },
        category: { type: "string" },
        date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["description", "amount", "type", "category", "date"],
    },
  },
  { name: "delete_transaction", description: "Delete a transaction by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "add_income_source", description: "Add a recurring income source", input_schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, startDate: { type: "string" }, endDate: { type: "string" }, notes: { type: "string" } }, required: ["name", "amount"] } },
  { name: "set_balance", description: "Set Scott's current bank balance", input_schema: { type: "object", properties: { balance: { type: "number" } }, required: ["balance"] } },
  { name: "add_recurring_bill", description: "Add a recurring monthly bill or subscription", input_schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, category: { type: "string" }, startDate: { type: "string" }, dueDay: { type: "number" }, notes: { type: "string" } }, required: ["name", "amount", "category"] } },
  { name: "search_hikers", description: "Search hikers by name or email to find IDs", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "delete_hiker", description: "Delete a specific hiker by id", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
  { name: "clear_all_hikers", description: "Delete ALL hikers. Only after explicit confirmation.", input_schema: { type: "object", properties: { confirmed: { type: "boolean" } }, required: ["confirmed"] } },
];

async function executeTool(name, input) {
  try {
    switch (name) {
      case "list_items": {
        const t = input.type;
        if (t === "reminders") return { items: (await loadReminders()).map((r) => ({ id: r.id, name: r.name, date: r.date, time: r.time, recurrence: r.recurrence, completed: r.completed, project_id: r.project_id })) };
        if (t === "events") return { items: (await loadEvents()).map((e) => ({ id: e.id, title: e.title, date: e.date, project_id: e.project_id })) };
        if (t === "projects") return { items: (await loadProjects()).map((p) => ({ id: p.id, name: p.name, color: p.color, parent_id: p.parent_id })) };
        if (t === "journal") return { items: (await loadJournal()).map((j) => ({ id: j.id, title: j.title, date: j.date })) };
        if (t === "transactions") return { items: (await loadTransactions()).slice(0, 40).map((x) => ({ id: x.id, description: x.description, amount: x.amount, category: x.category, date: x.date })) };
        if (t === "initiatives") return { items: (await loadInitiatives()).map((i) => ({ id: i.id, name: i.name, recurrence: i.recurrence, project_id: i.project_id })) };
        if (t === "event_types") return { items: (await loadEventTypes()).map((e) => ({ id: e.id, name: e.name, auto_tasks: e.auto_tasks })) };
        return { error: "unknown type" };
      }
      case "add_reminder":
        await newReminder({ name: input.name, date: input.date || null, time: input.time || null, description: input.description || null, recurrence: input.recurrence || "none", project_id: input.project_id || null, show_on_calendar: input.show_on_calendar });
        return { success: true };
      case "update_reminder": {
        const { id, ...fields } = input;
        await updateReminder(id, fields);
        return { success: true };
      }
      case "complete_reminder": await completeReminder(input.id); return { success: true };
      case "delete_reminder": await deleteReminder(input.id); return { success: true };
      case "add_event":
        await newEvent({ title: input.title, date: input.date, description: input.description || "", project_id: input.project_id || null, event_type_id: input.event_type_id || null });
        return { success: true };
      case "delete_event": await deleteEvent(input.id); return { success: true };
      case "add_project": { const p = await newProject({ name: input.name, description: input.description || "", color: input.color || "#4f7cff", parent_id: input.parent_id || null }); return { success: true, id: p?.id }; }
      case "update_project": { const u = {}; if (input.name != null) u.name = input.name; if (input.description != null) u.description = input.description; if (input.color != null) u.color = input.color; await updateProject(input.id, u); return { success: true }; }
      case "delete_project": await deleteProject(input.id); return { success: true };
      case "add_event_type": { const e = await newEventType({ name: input.name, color: input.color || "#22d3ee", auto_tasks: input.auto_tasks || [] }); return { success: true, id: e?.id }; }
      case "add_journal_entry": await newJournalEntry({ title: input.title, entry: input.entry, date: input.date || today() }); return { success: true };
      case "add_initiative": await newInitiative({ project_id: input.project_id || null, name: input.name, description: input.description || "", recurrence: input.recurrence || "weekly" }); return { success: true };
      case "add_transaction": await newTransaction({ description: input.description, amount: input.amount, type: input.type, category: input.category, date: input.date, notes: input.notes || "" }); return { success: true };
      case "delete_transaction": await deleteTransaction(input.id); return { success: true };
      case "add_income_source": await addIncomeSource({ name: input.name, amount: input.amount, frequency: "monthly", startDate: input.startDate || today(), endDate: input.endDate || null, notes: input.notes || "" }); return { success: true };
      case "set_balance": { const cfg = await loadBudgetConfig(); await saveBudgetConfig({ ...cfg, startingBalance: input.balance }); return { success: true }; }
      case "add_recurring_bill": await addRecurringBill({ name: input.name, amount: input.amount, category: input.category, startDate: input.startDate || today(), dueDay: input.dueDay ?? null, notes: input.notes || "" }); return { success: true };
      case "search_hikers": { const results = await loadMembers(input.query); return { results: results.slice(0, 10).map((m) => ({ id: m.id, name: `${m.first} ${m.last}`, email: m.email || "", attendance: m.attendance })) }; }
      case "delete_hiker": await deleteMember(input.id); return { success: true, deleted: input.name };
      case "clear_all_hikers": if (!input.confirmed) return { error: "confirmed must be true" }; await clearAllMembers(); return { success: true };
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

// Chat history survives page refreshes / closing the panel for up to an hour.
const CHAT_STORE_KEY = "frodo_chat_session";
const CHAT_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadSavedChat() {
  try {
    const raw = localStorage.getItem(CHAT_STORE_KEY);
    if (!raw) return { displayMsgs: [], apiHistory: [] };
    const saved = JSON.parse(raw);
    if (!saved.savedAt || Date.now() - saved.savedAt > CHAT_TTL_MS) {
      localStorage.removeItem(CHAT_STORE_KEY);
      return { displayMsgs: [], apiHistory: [] };
    }
    return { displayMsgs: saved.displayMsgs || [], apiHistory: saved.apiHistory || [] };
  } catch {
    return { displayMsgs: [], apiHistory: [] };
  }
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [displayMsgs, setDisplayMsgs] = useState(() => loadSavedChat().displayMsgs);
  const [apiHistory, setApiHistory] = useState(() => loadSavedChat().apiHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [displayMsgs, loading]);
  useEffect(() => { if (open) textareaRef.current?.focus(); }, [open]);

  // Persist the conversation (with a timestamp for the 1-hour TTL) on every change.
  useEffect(() => {
    try {
      if (displayMsgs.length === 0 && apiHistory.length === 0) {
        localStorage.removeItem(CHAT_STORE_KEY);
      } else {
        localStorage.setItem(CHAT_STORE_KEY, JSON.stringify({ savedAt: Date.now(), displayMsgs, apiHistory }));
      }
    } catch { /* storage full or unavailable — non-fatal */ }
  }, [displayMsgs, apiHistory]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const nextDisplay = [...displayMsgs, { role: "user", text }];
    const nextApi = [...apiHistory, { role: "user", content: text }];
    setDisplayMsgs(nextDisplay);

    try {
      let msgs = nextApi;
      let finalDisplay = nextDisplay;

      while (true) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2048, system: buildSystemPrompt(), tools: TOOLS, messages: msgs }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);

        if (data.stop_reason === "tool_use") {
          const toolBlocks = data.content.filter((b) => b.type === "tool_use");
          const toolResults = [];
          for (const block of toolBlocks) {
            const result = await executeTool(block.name, block.input);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
          }
          msgs = [...msgs, { role: "assistant", content: data.content }, { role: "user", content: toolResults }];
        } else {
          const replyText = data.content?.find((b) => b.type === "text")?.text ?? "Done.";
          finalDisplay = [...finalDisplay, { role: "assistant", text: replyText }];
          setDisplayMsgs(finalDisplay);
          setApiHistory([...msgs, { role: "assistant", content: data.content }]);
          break;
        }
      }
    } catch (err) {
      setDisplayMsgs((prev) => [...prev, { role: "assistant", text: `Something went wrong: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      <button className={`chat-fab ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)} aria-label={open ? "Close assistant" : "Open assistant"}>
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-comment-dots"}`} />
      </button>

      {open && (
        <div className={`chat-panel ${expanded ? "expanded" : ""}`}>
          <div className="chat-panel-header">
            <span><i className="fa-solid fa-ring" /> Frodo</span>
            <div className="chat-header-actions">
              <button type="button" className="btn-mini muted" onClick={() => setExpanded((v) => !v)} title={expanded ? "Shrink" : "Full screen"}>
                <i className={`fa-solid ${expanded ? "fa-compress" : "fa-expand"}`} />
              </button>
              <button type="button" className="btn-mini muted" onClick={() => { setDisplayMsgs([]); setApiHistory([]); }} title="Clear conversation">
                <i className="fa-solid fa-rotate-left" /> Clear
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {displayMsgs.length === 0 && (
              <div className="chat-empty">
                <p>Hi, I'm <strong>Frodo</strong> 🧭 — your planner sidekick. I can read and change anything. Try:</p>
                <ul>
                  <li>"List my projects as a table"</li>
                  <li>"Make a School project with Math, English &amp; Science classes"</li>
                  <li>"Add a Test event type with study reminders 7 and 2 days before"</li>
                  <li>"Complete all my gym tasks from this week"</li>
                </ul>
              </div>
            )}
            {displayMsgs.map((m, i) => (
              m.role === "assistant"
                ? <div key={i} className="chat-msg assistant chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                : <div key={i} className="chat-msg user">{m.text}</div>
            ))}
            {loading && <div className="chat-msg assistant chat-typing"><span /><span /><span /></div>}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea ref={textareaRef} className="chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder="Ask Frodo anything..." rows={1} />
            <button type="button" className="chat-send" onClick={sendMessage} disabled={loading || !input.trim()} aria-label="Send">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

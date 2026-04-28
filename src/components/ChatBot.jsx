import { useState, useRef, useEffect } from "react";
import {
  newReminder,
  newEvent,
  newTransaction,
  addRecurringBill,
  addIncomeSource,
  loadBudgetConfig,
  saveBudgetConfig,
} from "../api/plannerApi";

const TODAY = new Date().toISOString().split("T")[0];

const SYSTEM = `You are a smart personal assistant embedded in Scott's personal planner app (heyScottyBro). Today is ${TODAY}.

You can add reminders, events, transactions, and recurring bills directly to Scott's planner by calling tools. Keep responses short. After performing an action, confirm briefly what you did. If something is ambiguous (like a date), ask one short clarifying question before acting.

Transaction categories: Food, Transport, Bills, Entertainment, Housing, Car, Subscriptions, Travel, Other.
"Fun money" or "entertainment" expenses use category Entertainment.`;

const TOOLS = [
  {
    name: "add_reminder",
    description: "Add a reminder or recurring task to Scott's planner",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The reminder text" },
        date: { type: "string", description: "Due date YYYY-MM-DD. Resolve relative dates like 'tomorrow', 'next Monday' before calling." },
        recurrence: {
          type: "string",
          enum: ["none", "daily", "weekly", "monthly"],
          description: "How often it repeats. Default none.",
        },
      },
      required: ["name", "date"],
    },
  },
  {
    name: "add_event",
    description: "Add a calendar event to Scott's planner",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        description: { type: "string", description: "Optional details about the event" },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "add_transaction",
    description: "Log a financial transaction (expense, income, or future planned spend)",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number", description: "Positive number — sign is derived from type" },
        type: {
          type: "string",
          enum: ["expense", "income", "future"],
          description: "expense = money out, income = money in, future = planned future spend",
        },
        category: {
          type: "string",
          description: "One of: Food, Transport, Bills, Entertainment, Housing, Car, Subscriptions, Travel, Other",
        },
        date: { type: "string", description: "YYYY-MM-DD. Default to today if not specified." },
        notes: { type: "string" },
      },
      required: ["description", "amount", "type", "category", "date"],
    },
  },
  {
    name: "add_income_source",
    description: "Add a recurring income source (salary, contract, freelance) to the budget projection",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number", description: "Monthly net amount after tax" },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        endDate: { type: "string", description: "YYYY-MM-DD or omit if ongoing" },
        notes: { type: "string" },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "set_balance",
    description: "Set Scott's current bank balance (the starting point for budget projections)",
    input_schema: {
      type: "object",
      properties: {
        balance: { type: "number", description: "How much money Scott currently has in his bank account" },
      },
      required: ["balance"],
    },
  },
  {
    name: "add_recurring_bill",
    description: "Add a recurring monthly bill or subscription to the budget",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number", description: "Monthly amount" },
        category: {
          type: "string",
          description: "One of: Food, Transport, Bills, Entertainment, Housing, Car, Subscriptions, Travel, Other",
        },
        startDate: { type: "string", description: "YYYY-MM-DD start date. Default to today." },
        dueDay: {
          type: "number",
          description: "Day of month the bill is due (1–31). Omit for continuous bills like groceries or gas.",
        },
        notes: { type: "string" },
      },
      required: ["name", "amount", "category"],
    },
  },
];

async function executeTool(name, input) {
  try {
    switch (name) {
      case "add_reminder":
        await newReminder({
          name: input.name,
          date: input.date,
          recurrence: input.recurrence || "none",
        });
        return { success: true };

      case "add_event":
        await newEvent({
          title: input.title,
          date: input.date,
          description: input.description || "",
        });
        return { success: true };

      case "add_transaction":
        await newTransaction({
          description: input.description,
          amount: input.amount,
          type: input.type,
          category: input.category,
          date: input.date,
          notes: input.notes || "",
        });
        return { success: true };

      case "add_recurring_bill":
        await addRecurringBill({
          name: input.name,
          amount: input.amount,
          category: input.category,
          startDate: input.startDate || TODAY,
          dueDay: input.dueDay ?? null,
          notes: input.notes || "",
        });
        return { success: true };

      case "add_income_source":
        await addIncomeSource({
          name: input.name,
          amount: input.amount,
          frequency: "monthly",
          startDate: input.startDate || TODAY,
          endDate: input.endDate || null,
          notes: input.notes || "",
        });
        return { success: true };

      case "set_balance": {
        const cfg = await loadBudgetConfig();
        await saveBudgetConfig({ ...cfg, startingBalance: input.balance });
        return { success: true };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [displayMsgs, setDisplayMsgs] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMsgs, loading]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userDisplay = { role: "user", text };
    const userApi = { role: "user", content: text };

    const nextDisplay = [...displayMsgs, userDisplay];
    const nextApi = [...apiHistory, userApi];
    setDisplayMsgs(nextDisplay);

    try {
      let msgs = nextApi;
      let finalDisplay = nextDisplay;

      while (true) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: SYSTEM,
            tools: TOOLS,
            messages: msgs,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || `API error ${res.status}`);
        }

        if (data.stop_reason === "tool_use") {
          const toolBlocks = data.content.filter((b) => b.type === "tool_use");
          const toolResults = [];

          for (const block of toolBlocks) {
            const result = await executeTool(block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }

          msgs = [
            ...msgs,
            { role: "assistant", content: data.content },
            { role: "user", content: toolResults },
          ];
        } else {
          const replyText =
            data.content?.find((b) => b.type === "text")?.text ?? "Done.";
          finalDisplay = [...finalDisplay, { role: "assistant", text: replyText }];
          setDisplayMsgs(finalDisplay);
          setApiHistory([...msgs, { role: "assistant", content: data.content }]);
          break;
        }
      }
    } catch (err) {
      setDisplayMsgs((prev) => [
        ...prev,
        { role: "assistant", text: `Something went wrong: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        className={`chat-fab ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-comment-dots"}`} />
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span><i className="fa-solid fa-wand-magic-sparkles" /> Assistant</span>
            <button
              type="button"
              className="btn-mini muted"
              onClick={() => { setDisplayMsgs([]); setApiHistory([]); }}
              title="Clear conversation"
            >
              <i className="fa-solid fa-rotate-left" /> Clear
            </button>
          </div>

          <div className="chat-messages">
            {displayMsgs.length === 0 && (
              <div className="chat-empty">
                <p>Try asking me to:</p>
                <ul>
                  <li>"Add a reminder to take meds every day"</li>
                  <li>"Log $45 at a restaurant as food today"</li>
                  <li>"Add a hike event on May 10"</li>
                  <li>"Add Netflix $18 recurring bill due on the 5th"</li>
                </ul>
              </div>
            )}
            {displayMsgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant chat-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Add anything to your planner..."
              rows={1}
            />
            <button
              type="button"
              className="chat-send"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

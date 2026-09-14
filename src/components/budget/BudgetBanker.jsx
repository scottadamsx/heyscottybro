import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../../utils/markdown";
import { runBanker, BANKER } from "../../api/banker";
import { getAuthHeaders } from "../../utils/supabase";
import "./budget.css";

const STORE_KEY = "banker_chat_session";
const TTL_MS = 60 * 60 * 1000;
const MAX_INPUT = 4000;

function loadSaved() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return { display: [], history: [] };
    const s = JSON.parse(raw);
    if (!s.savedAt || Date.now() - s.savedAt > TTL_MS) { sessionStorage.removeItem(STORE_KEY); return { display: [], history: [] }; }
    return { display: s.display || [], history: s.history || [] };
  } catch { return { display: [], history: [] }; }
}

const SUGGESTIONS = [
  "Log $84.20 groceries today",
  "Set my Groceries budget to $600/month and Gas to $200",
  "Add my $1,450 rent as a recurring bill due the 1st",
  "How am I tracking on my budgets this month?",
];

export default function BudgetBanker({ onChanged }) {
  const [display, setDisplay] = useState(() => loadSaved().display);
  const [history, setHistory] = useState(() => loadSaved().history);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [display, loading]);
  useEffect(() => {
    try {
      if (display.length === 0 && history.length === 0) sessionStorage.removeItem(STORE_KEY);
      else sessionStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: Date.now(), display, history }));
    } catch { /* non-fatal */ }
  }, [display, history]);

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const nextDisplay = [...display, { role: "user", text }];
    setDisplay(nextDisplay);
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const { text: reply, history: newHistory } = await runBanker({
        messages: [...history, { role: "user", content: text }],
        authHeaders,
        onStatus: setStatus,
      });
      setHistory(newHistory);
      setDisplay([...nextDisplay, { role: "banker", text: reply }]);
      onChanged?.(); // budget data may have changed — let the page refresh
    } catch (e) {
      setDisplay([...nextDisplay, { role: "banker", text: `The vault door jammed: ${e.message}` }]);
    } finally {
      setLoading(false); setStatus("");
    }
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const grow = (e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; };
  const clear = () => { setDisplay([]); setHistory([]); };

  // Bubbles reuse the app chat's own classes (.chat-msg / .chat-md / .chat-send)
  // so Griphook reads exactly like Frodo's panel; only the frame is local.
  return (
    <div className="db-card banker">
      {/* Header */}
      <div className="banker-head">
        <span className="banker-avatar" aria-hidden="true"><i className={`fa-solid ${BANKER.icon}`} /></span>
        <div className="banker-id">
          <span className="banker-name">{BANKER.name}</span>
          <span className="banker-tag">{BANKER.tagline} · guards your gold</span>
        </div>
        {display.length > 0 && (
          <button type="button" className="btn-sm btn-secondary-sm" onClick={clear} title="Clear conversation">
            <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="banker-log" role="log" aria-live="polite" aria-label={`Conversation with ${BANKER.name}`}>
        {display.length === 0 && (
          <div className="banker-empty">
            <p><strong>{BANKER.name}</strong> keeps your ledger. Tell him what to change — he handles the rest. Try:</p>
            <div className="banker-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={loading} className="bud-suggestion">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {display.map((m, i) => (
          m.role === "user"
            ? <div key={i} className="chat-msg user">{m.text}</div>
            : <div key={i} className="chat-msg assistant chat-md">
                <span className="chat-author">{BANKER.name}</span>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
              </div>
        ))}
        {loading && (
          <div className="chat-msg assistant banker-typing" role="status">
            <span className="chat-typing" aria-hidden="true"><span /><span /><span /></span>
            <em className="chat-status">{status || `${BANKER.name} is counting the gold…`}</em>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="banker-input">
        <textarea ref={taRef} value={input} maxLength={MAX_INPUT} onChange={grow} onKeyDown={onKey} rows={1}
          aria-label={`Message ${BANKER.name}`}
          placeholder={`Tell ${BANKER.name} what to do with your money…`} />
        <button type="button" className="chat-send" onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send">
          <i className="fa-solid fa-paper-plane" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

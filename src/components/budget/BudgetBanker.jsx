import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../../utils/markdown";
import { runBanker, BANKER } from "../../api/banker";
import { getAuthHeaders } from "../../utils/supabase";

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

  const bubble = (bg) => ({ background: bg, border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "0.6rem 0.85rem", maxWidth: "85%", fontSize: 14, lineHeight: 1.5 });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "min(70vh, 560px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "0.5px solid var(--border-subtle)", marginBottom: 10 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>{BANKER.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{BANKER.name} <i className={`fa-solid ${BANKER.icon}`} style={{ fontSize: 12, opacity: 0.6, marginLeft: 2 }} /></div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{BANKER.tagline} · guards your gold</div>
        </div>
        {display.length > 0 && (
          <button className="btn-sm" style={{ fontSize: 11, padding: "3px 8px" }} onClick={clear} title="Clear conversation">
            <i className="fa-solid fa-rotate-left" /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {display.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            <p style={{ marginTop: 0 }}>{BANKER.emoji} <strong>{BANKER.name}</strong> keeps your ledger. Tell him what to change — he handles the rest. Try:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={loading}
                  style={{ textAlign: "left", background: "var(--bg-raised)", border: "0.5px solid var(--border-subtle)", borderRadius: 8, padding: "7px 10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {display.map((m, i) => (
          m.role === "user"
            ? <div key={i} style={{ alignSelf: "flex-end", ...bubble("var(--accent)"), color: "#fff" }}>{m.text}</div>
            : <div key={i} className="chat-md" style={{ alignSelf: "flex-start", ...bubble("var(--bg-card)") }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{BANKER.emoji} {BANKER.name}</div>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
              </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", ...bubble("var(--bg-card)"), color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>
            {status || `${BANKER.name} is counting the gold…`}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, borderTop: "0.5px solid var(--border-subtle)", paddingTop: 10 }}>
        <textarea ref={taRef} value={input} maxLength={MAX_INPUT} onChange={grow} onKeyDown={onKey} rows={1}
          placeholder={`Tell ${BANKER.name} what to do with your money…`}
          style={{ flex: 1, resize: "none", fontSize: 14, padding: "8px 10px", maxHeight: 120, lineHeight: 1.4 }} />
        <button className="btn" onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: "8px 12px" }} aria-label="Send">
          <i className="fa-solid fa-paper-plane" />
        </button>
      </div>
    </div>
  );
}

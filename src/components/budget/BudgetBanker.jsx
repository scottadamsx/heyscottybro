import { useCallback, useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../../utils/markdown";
import MarkdownBody from "../MarkdownBody";
import { runBanker, BANKER } from "../../api/banker";
import { getAuthHeaders } from "../../utils/supabase";
import { captureEstablishedOwnerId } from "../../utils/authIdentityBoundary";
import {
  beginOwnerBoundBankerTurn,
  clearOwnerBoundBankerSession,
  persistOwnerBoundBankerSnapshot,
  prepareOwnerBoundBankerClear,
  readOwnerBoundBankerSession,
  subscribeOwnerBoundBankerSession,
  unownedBankerSessionWarning,
} from "../../utils/bankerSessionPolicy";
import { closePendingTurnForPersistence } from "../../utils/chatSessionPolicy";
import "./budget.css";
import { useConfirm } from "../../hooks/useConfirm";

const MAX_INPUT = 4000;

const SUGGESTIONS = [
  "Log $84.20 groceries today",
  "Set my Groceries budget to $600/month and Gas to $200",
  "Add my $1,450 rent as a recurring bill due the 1st",
  "How am I tracking on my budgets this month?",
];

export default function BudgetBanker({ onChanged }) {
  const [ownerId] = useState(captureEstablishedOwnerId);
  const [saved] = useState(() => readOwnerBoundBankerSession(sessionStorage, ownerId));
  const [display, setDisplay] = useState(saved.display);
  const [history, setHistory] = useState(saved.history);
  const [storageWarning, setStorageWarning] = useState(saved.warning);
  const [storageWritable, setStorageWritable] = useState(saved.writable);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const turnInFlightRef = useRef(false);

  const persistSnapshot = useCallback((nextDisplay, nextHistory) => {
    const outcome = persistOwnerBoundBankerSnapshot(
      sessionStorage,
      ownerId,
      { display: nextDisplay, history: nextHistory },
    );
    setStorageWritable(outcome.writable);
    setStorageWarning(outcome.warning);
    return outcome.saved;
  }, [ownerId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [display, loading]);
  useEffect(() => {
    let mounted = true;
    const syncFromOwnerSession = () => {
      if (!mounted || turnInFlightRef.current) return;
      const latest = readOwnerBoundBankerSession(sessionStorage, ownerId);
      setDisplay(latest.display);
      setHistory(latest.history);
      setStorageWarning(latest.warning);
      setStorageWritable(latest.writable);
    };
    // Subscribe before the confirming read so a write between render and this
    // effect cannot leave a remounted Money view on a stale checkpoint.
    const unsubscribe = subscribeOwnerBoundBankerSession(ownerId, syncFromOwnerSession);
    syncFromOwnerSession();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [ownerId]);

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || loading || !storageWritable) return;
    let finishTurn;
    try {
      finishTurn = beginOwnerBoundBankerTurn(ownerId);
    } catch (error) {
      setStorageWarning(error.message || String(error));
      return;
    }
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const nextDisplay = [...display, { role: "user", text }];
    const runHistory = [...history, { role: "user", content: text }];
    let committed = runHistory;
    turnInFlightRef.current = true;
    setDisplay(nextDisplay);
    setLoading(true);
    try {
      const acceptedHistory = closePendingTurnForPersistence(runHistory, "turn interrupted before Griphook replied");
      if (!persistSnapshot(nextDisplay, acceptedHistory)) {
        throw new Error("The accepted message could not be saved, so no ledger work was started.");
      }
      const authHeaders = await getAuthHeaders(ownerId);
      const { text: reply, history: newHistory } = await runBanker({
        messages: runHistory,
        authHeaders,
        ownerId,
        resolveAuthHeaders: getAuthHeaders,
        onStatus: setStatus,
        onCommit: async (checkpointHistory) => {
          committed = checkpointHistory;
          const safeHistory = closePendingTurnForPersistence(checkpointHistory, "turn interrupted during Griphook tool work");
          if (!persistSnapshot(nextDisplay, safeHistory)) {
            throw new Error("Griphook's tool checkpoint could not be saved.");
          }
        },
      });
      const finalDisplay = [...nextDisplay, { role: "banker", text: reply }];
      setHistory(newHistory);
      setDisplay(finalDisplay);
      persistSnapshot(finalDisplay, newHistory);
      onChanged?.(); // budget data may have changed — let the page refresh
    } catch (e) {
      const interruptedHistory = closePendingTurnForPersistence(committed, `turn interrupted: ${e.message}`);
      const errorDisplay = [...nextDisplay, { role: "banker", text: `The vault door jammed: ${e.message}` }];
      setHistory(interruptedHistory);
      setDisplay(errorDisplay);
      persistSnapshot(errorDisplay, interruptedHistory);
    } finally {
      turnInFlightRef.current = false;
      finishTurn();
      setLoading(false); setStatus("");
    }
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const grow = (e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; };
  const { confirm, dialog } = useConfirm();
  const clear = async () => {
    if (loading) return;
    if (!await confirm("Clear the whole conversation with Griphook? It can't be brought back.", { title: "Clear conversation", confirmLabel: "Clear" })) return;
    let preparation;
    try {
      preparation = prepareOwnerBoundBankerClear(ownerId);
      clearOwnerBoundBankerSession(sessionStorage, ownerId, preparation);
      setDisplay([]); setHistory([]);
      setStorageWarning(unownedBankerSessionWarning(sessionStorage));
    } catch (error) {
      setStorageWarning(`Griphook's conversation couldn't be cleared: ${error.message || error}`);
    }
  };

  // Bubbles reuse the app chat's own classes (.chat-msg / .chat-md / .chat-send)
  // so Griphook reads exactly like Frodo's panel; only the frame is local.
  return (
    <div className="db-card banker">
      {dialog}
      {/* Header */}
      <div className="banker-head">
        <span className="banker-avatar" aria-hidden="true"><i className={`fa-solid ${BANKER.icon}`} /></span>
        <div className="banker-id">
          <span className="banker-name">{BANKER.name}</span>
          <span className="banker-tag">{BANKER.tagline} · guards your gold</span>
        </div>
        {display.length > 0 && (
          <button type="button" className="btn-sm btn-secondary-sm" onClick={clear} disabled={loading} title="Clear conversation">
            <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="banker-log" role="log" aria-live="polite" aria-label={`Conversation with ${BANKER.name}`}>
        {storageWarning && <div className="chat-note" role="alert"><i className="fa-solid fa-shield-halved" /> {storageWarning}</div>}
        {display.length === 0 && (
          <div className="banker-empty">
            <p><strong>{BANKER.name}</strong> keeps your ledger. Tell him what to change — he handles the rest. Try:</p>
            <div className="banker-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={loading || !storageWritable} className="bud-suggestion">
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
                <MarkdownBody html={renderMarkdown(m.text)} />
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
          disabled={!storageWritable}
          placeholder={`Tell ${BANKER.name} what to do with your money…`} />
        <button type="button" className="chat-send" onClick={() => send()} disabled={loading || !storageWritable || !input.trim()} aria-label="Send">
          <i className="fa-solid fa-paper-plane" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

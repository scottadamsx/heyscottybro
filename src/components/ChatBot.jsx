import { useState, useRef, useEffect } from "react";
import { renderMarkdown } from "../utils/markdown";
import useAIAgent, { MAX_INPUT_CHARS } from "../hooks/useAIAgent";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { displayMsgs, input, setInput, loading, sendMessage, clearHistory } = useAIAgent();
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [displayMsgs, loading]);
  useEffect(() => { if (open) textareaRef.current?.focus(); }, [open]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleInput = (e) => { setInput(e.target.value); autoGrow(); };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      sendMessage();
    }
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
              <button type="button" className="btn-mini muted" onClick={clearHistory} title="Clear conversation">
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
            <textarea ref={textareaRef} className="chat-input" value={input} maxLength={MAX_INPUT_CHARS}
              onChange={handleInput} onKeyDown={onKey} placeholder="Ask Frodo anything..." rows={1} />
            {input.length > MAX_INPUT_CHARS * 0.85 && (
              <span className="chat-char-count">{input.length}/{MAX_INPUT_CHARS}</span>
            )}
            <button type="button" className="chat-send" onClick={sendMessage} disabled={loading || !input.trim()} aria-label="Send">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

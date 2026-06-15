import { useState, useRef, useEffect } from "react";
import { renderMarkdown } from "../utils/markdown";
import useAIAgent, { MAX_INPUT_CHARS } from "../hooks/useAIAgent";
import { TIERS } from "../api/aiTiers";
import { stageScreenshot } from "../api/bugsApi";
import { setPendingScreenshots } from "../api/pendingScreenshots";
import { useToast } from "../contexts/ToastContext";

const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));

const readDataUrl = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shots, setShots] = useState([]);     // { id, dataUrl, media_type, path, uploading }
  const [dragOver, setDragOver] = useState(false);
  const { displayMsgs, input, setInput, loading, status, sendMessage, clearHistory } = useAIAgent();
  const { addToast } = useToast();
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

  // Stage dropped/pasted images to storage so Frodo's log_bug can claim them.
  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    for (const file of files) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      let dataUrl;
      try { dataUrl = await readDataUrl(file); } catch { continue; }
      setShots((prev) => [...prev, { id, dataUrl, media_type: file.type, path: null, uploading: true }]);
      try {
        const path = await stageScreenshot(file);
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, path, uploading: false } : s)));
      } catch {
        setShots((prev) => prev.filter((s) => s.id !== id));
        addToast("Screenshot upload failed.", "error");
      }
    }
  };

  const onDrop = (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };
  const onPaste = (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };

  const removeShot = (id) => setShots((prev) => prev.filter((s) => s.id !== id));

  const doSend = () => {
    if (loading) return;
    const ready = shots.filter((s) => s.path && !s.uploading);
    setPendingScreenshots(ready.map((s) => s.path));
    const attachments = ready.map((s) => ({ media_type: s.media_type, data: s.dataUrl.split(",")[1] }));
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(attachments);
    setShots([]);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const uploading = shots.some((s) => s.uploading);
  const canSend = !loading && !uploading && (input.trim() || shots.some((s) => s.path));

  return (
    <>
      <button className={`chat-fab ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)} aria-label={open ? "Close assistant" : "Open assistant"}>
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-comment-dots"}`} />
      </button>

      {open && (
        <div className={`chat-panel ${expanded ? "expanded" : ""}`}
          onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
          onDrop={onDrop}>
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
                  <li>Drag a <strong>screenshot</strong> in and say "log this bug"</li>
                  <li>"Fetch example.com and summarise it"</li>
                  <li>"Export my bugs"</li>
                </ul>
              </div>
            )}
            {displayMsgs.map((m, i) => {
              if (m.role === "note") {
                return <div key={i} className="chat-note"><i className="fa-solid fa-arrow-turn-up" /> {m.text}</div>;
              }
              if (m.role === "assistant") {
                const tier = TIER_BY_ID[m.by] || TIER_BY_ID.frodo;
                return (
                  <div key={i} className="chat-msg assistant chat-md">
                    {tier.id !== "frodo" && <span className={`chat-author ${tier.id}`}><i className={`fa-solid ${tier.icon}`} /> {tier.label}</span>}
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                  </div>
                );
              }
              return <div key={i} className="chat-msg user">{m.text}</div>;
            })}
            {loading && (
              <div className="chat-msg assistant chat-typing">
                <span /><span /><span />
                {status && <em className="chat-status">{status}</em>}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Staged screenshot thumbnails */}
          {shots.length > 0 && (
            <div className="chat-shots">
              {shots.map((s) => (
                <div key={s.id} className="chat-shot">
                  <img src={s.dataUrl} alt="screenshot" />
                  {s.uploading && <span className="chat-shot-spin"><i className="fa-solid fa-spinner fa-spin" /></span>}
                  <button type="button" className="chat-shot-x" onClick={() => removeShot(s.id)} aria-label="Remove"><i className="fa-solid fa-xmark" /></button>
                </div>
              ))}
            </div>
          )}

          <div className={`chat-input-row${dragOver ? " drag-over" : ""}`}>
            <textarea ref={textareaRef} className="chat-input" value={input} maxLength={MAX_INPUT_CHARS}
              onChange={handleInput} onKeyDown={onKey} onPaste={onPaste}
              placeholder={dragOver ? "Drop screenshot to attach…" : "Ask Frodo, or drop a screenshot…"} rows={1} />
            {input.length > MAX_INPUT_CHARS * 0.85 && (
              <span className="chat-char-count">{input.length}/{MAX_INPUT_CHARS}</span>
            )}
            <button type="button" className="chat-send" onClick={doSend} disabled={!canSend} aria-label="Send">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

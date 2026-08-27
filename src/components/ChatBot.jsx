import { useState, useRef, useEffect } from "react";
import { renderMarkdown } from "../utils/markdown";
import useAIAgent, { MAX_INPUT_CHARS } from "../hooks/useAIAgent";
import { TIERS } from "../api/aiTiers";
import { stageScreenshot } from "../api/bugsApi";
import { setPendingScreenshots } from "../api/pendingScreenshots";
import { readDataUrl, normaliseImage } from "../utils/image";
import { useToast } from "../contexts/ToastContext";

const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));


export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shots, setShots] = useState([]);     // { id, dataUrl, media_type, path, uploading }
  const [dragOver, setDragOver] = useState(false);
  const { displayMsgs, input, setInput, loading, status, sendMessage, clearHistory, hydrating, saveError } = useAIAgent();
  const { addToast } = useToast();
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
  // A failed upload no longer discards the image: Frodo can still SEE it (the
  // bytes are already in the browser), he just can't permanently attach it to a
  // bug report. Silently dropping the shot is what made him say "I can't see
  // any image" after Scott had clearly attached one.
  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(hei[cf])$/i.test(f.name || ""));
    for (const original of files) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      let dataUrl;
      try { dataUrl = await readDataUrl(original); } catch { addToast("Couldn't read that image.", "error"); continue; }

      // Re-encode to a bucket-legal, vision-friendly JPEG before doing anything
      // else; fall back to the raw file if the browser can't decode it.
      const norm = await normaliseImage(original, dataUrl);
      const file = norm?.file || original;
      const shownUrl = norm?.dataUrl || dataUrl;
      const mediaType = norm?.media_type || original.type || "image/png";

      setShots((prev) => [...prev, { id, dataUrl: shownUrl, media_type: mediaType, path: null, uploading: true, failed: false }]);
      try {
        const path = await stageScreenshot(file);
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, path, uploading: false } : s)));
      } catch (err) {
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, uploading: false, failed: true } : s)));
        addToast(`${err.message || "Screenshot upload failed."} Frodo can still see it, but it won't attach to a bug report.`, "error");
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
  // Mobile has no drag-and-drop and no easy image paste, so the only way to
  // attach a screenshot is a real file input. Reset value after so picking the
  // same file twice still fires onChange.
  const onPickFiles = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeShot = (id) => setShots((prev) => prev.filter((s) => s.id !== id));

  const doSend = () => {
    if (loading || hydrating) return;
    const attached = shots.filter((s) => !s.uploading);
    // Only successfully-staged shots can be claimed by log_bug…
    setPendingScreenshots(attached.filter((s) => s.path).map((s) => s.path));
    // …but EVERY attached image goes to the model, uploaded or not. Previously
    // an upload failure removed the shot entirely, so Frodo was told an
    // attachment existed while receiving no image data at all.
    const attachments = attached.map((s) => ({ media_type: s.media_type, data: s.dataUrl.split(",")[1] }));
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setShots([]);
    sendMessage(attachments);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const uploading = shots.some((s) => s.uploading);
  const canSend = !loading && !hydrating && !uploading && (input.trim() || shots.length > 0);

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
                <p>Hi, I'm <strong>Frodo</strong> — your planner sidekick. I can read and change anything. Try:</p>
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
              // Live session: thumbnails of what was attached. After a reload
              // only the `shots` count survives, so the "N screenshot(s)"
              // text carries the meaning instead.
              return (
                <div key={i} className="chat-msg user">
                  {m.images?.length > 0 && (
                    <div className="chat-shots">
                      {m.images.map((src, j) => (
                        <div key={j} className="chat-shot"><img src={src} alt={`attached screenshot ${j + 1}`} /></div>
                      ))}
                    </div>
                  )}
                  {m.text}
                </div>
              );
            })}
            {hydrating && <div className="chat-note" role="status"><i className="fa-solid fa-spinner fa-spin" /> loading history…</div>}
            {saveError && <div className="chat-note" role="alert"><i className="fa-solid fa-triangle-exclamation" /> Chat history isn't saving: {saveError}</div>}
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
                <div key={s.id} className={`chat-shot${s.failed ? " failed" : ""}`} title={s.failed ? "Upload failed — Frodo can still see this, but it won't attach to a bug report." : undefined}>
                  <img src={s.dataUrl} alt="screenshot" />
                  {s.uploading && <span className="chat-shot-spin"><i className="fa-solid fa-spinner fa-spin" /></span>}
                  {s.failed && <span className="chat-shot-warn"><i className="fa-solid fa-triangle-exclamation" /></span>}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={onPickFiles}
            />
            <button type="button" className="chat-attach" onClick={() => fileInputRef.current?.click()} disabled={loading} aria-label="Attach screenshot" title="Attach screenshot">
              <i className="fa-solid fa-paperclip" />
            </button>
            <button type="button" className="chat-send" onClick={doSend} disabled={!canSend} aria-label="Send">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

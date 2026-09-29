import { useState, useRef, useEffect, useId, useLayoutEffect, useCallback } from "react";
import { renderMarkdown } from "../utils/markdown";
import MarkdownBody from "./MarkdownBody";
import useAIAgent, { MAX_INPUT_CHARS } from "../hooks/useAIAgent";
import { TIERS } from "../api/aiTiers";
import { stageScreenshot } from "../api/bugsApi";
import { readDataUrl, normaliseImage } from "../utils/image";
import {
  canBeginAttachmentSafeClear,
  canSendOriginalImage,
  chatAttachmentDraftAfterClear,
  hasPendingAttachmentWork,
  undecodableImageMessage,
  visionAttachmentsFromShots,
} from "../utils/chatAttachments";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../hooks/useConfirm";
import {
  CHAT_MODAL_MEDIA,
  COARSE_POINTER_MEDIA,
  getChatLogA11y,
  getChatStatusAnnouncement,
  getFocusWrapIndex,
  getInitialChatFocusTarget,
  shouldActivateChatLog,
  scrollChatToBottom,
} from "./chatBotUi";
import { FRODO_CLEAR_CONFIRMATION, FRODO_CLEAR_SUCCESS } from "../utils/chatSessionPolicy";
import { registerFrodoHistoryController } from "../utils/globalChatHistory";

const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useMediaQuery(query) {
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    if (typeof media.addEventListener === "function") media.addEventListener("change", update);
    else media.addListener?.(update);
    return () => {
      if (typeof media.removeEventListener === "function") media.removeEventListener("change", update);
      else media.removeListener?.(update);
    };
  }, [query]);

  return matches;
}

// Docked full-height on the right (>900px, see index.css) instead of a small
// floating popover — `onOpenChange` lets AdminLayout reserve that space from
// the page content instead of Frodo just overlapping it.
export default function ChatBot({ onOpenChange, onUnreadChange, initialOpen = false } = {}) {
  const [open, setOpen] = useState(initialOpen);
  const [expanded, setExpanded] = useState(false);
  const [shots, setShots] = useState([]);     // { id, dataUrl, media_type, path, uploading }
  const [dragOver, setDragOver] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [attachmentWorkCount, setAttachmentWorkCount] = useState(0);
  const [chatLogLive, setChatLogLive] = useState(false);
  const {
    displayMsgs,
    input,
    setInput,
    loading,
    clearing,
    status,
    sendMessage,
    clearHistory,
    hydrating,
    historyReady,
    historyError,
    retryHistoryLoad,
    saveError,
    attachmentError,
    legacyWarning,
  } = useAIAgent();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const panelRef = useRef(null);
  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);
  const wasLoadingRef = useRef(loading);
  const previousOpenRef = useRef(false);
  const scrollStateRef = useRef({ open: false, hydrating: true });
  const stagedPathsRef = useRef(new Set());
  const attachmentWorkRef = useRef(0);
  const clearDialogRef = useRef(false);
  const clearInFlightRef = useRef(false);
  const titleId = useId();
  const isModal = useMediaQuery(CHAT_MODAL_MEDIA);
  const isTouch = useMediaQuery(COARSE_POINTER_MEDIA);
  const chatLogActive = chatLogLive && shouldActivateChatLog({ open, hydrating, historyReady });
  const chatLogA11y = getChatLogA11y({ active: chatLogActive, busy: hydrating || loading });
  const statusAnnouncement = getChatStatusAnnouncement({ loading, status });

  // Opening a hydrated conversation and finishing hydration both jump straight
  // to the newest turn. Later replies follow smoothly inside this scroller;
  // the page itself is never targeted with scrollIntoView.
  useLayoutEffect(() => {
    const previous = scrollStateRef.current;
    scrollStateRef.current = { open, hydrating };
    if (!open || hydrating) return undefined;
    const behavior = !previous.open || previous.hydrating ? "auto" : "smooth";
    const frame = requestAnimationFrame(() => scrollChatToBottom(messagesRef.current, behavior));
    return () => cancelAnimationFrame(frame);
  }, [displayMsgs, hydrating, loading, open]);

  // Keep the transcript quiet while persisted history is inserted. Its live
  // log switches on one frame after an already-rendered, hydrated panel opens,
  // so only subsequent turns are announced instead of replaying old messages.
  useEffect(() => {
    setChatLogLive(false);
    if (!shouldActivateChatLog({ open, hydrating, historyReady })) return undefined;
    const frame = requestAnimationFrame(() => setChatLogLive(true));
    return () => cancelAnimationFrame(frame);
  }, [historyReady, hydrating, open]);

  // Capture the opener before moving focus. Modal/touch openings land on Close
  // so a phone keyboard never appears just because Frodo was opened.
  useEffect(() => {
    if (!open) return undefined;
    if (!returnFocusRef.current && document.activeElement instanceof HTMLElement && !panelRef.current?.contains(document.activeElement)) {
      returnFocusRef.current = document.activeElement;
    }
    const frame = requestAnimationFrame(() => {
      const target = getInitialChatFocusTarget({ modal: isModal, touch: isTouch }) === "close"
        ? closeRef.current
        : textareaRef.current;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isModal, isTouch, open]);

  // Return focus to whichever control opened Frodo once the panel unmounts.
  useEffect(() => {
    if (open) {
      previousOpenRef.current = true;
      return undefined;
    }
    if (!previousOpenRef.current) return undefined;
    previousOpenRef.current = false;
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    const frame = requestAnimationFrame(() => opener?.isConnected && opener.focus?.({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // The ≤900px sheet is modal: keep the document behind it from scrolling.
  useEffect(() => {
    if (!open || !isModal) return undefined;
    const root = document.documentElement;
    const body = document.body;
    const rootAlreadyLocked = root.classList.contains("chat-modal-open");
    const bodyAlreadyLocked = body.classList.contains("chat-modal-open");
    root.classList.add("chat-modal-open");
    body.classList.add("chat-modal-open");
    return () => {
      if (!rootAlreadyLocked) root.classList.remove("chat-modal-open");
      if (!bodyAlreadyLocked) body.classList.remove("chat-modal-open");
    };
  }, [isModal, open]);

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  useEffect(() => { onUnreadChange?.(hasUnread); }, [hasUnread, onUnreadChange]);
  // On phones/tablets the trigger lives in the top bar (AdminLayout), which
  // asks for the panel with this event instead of a floating button.
  useEffect(() => {
    const toggle = () => setOpen((wasOpen) => {
      if (!wasOpen && document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
      return !wasOpen;
    });
    window.addEventListener("hsb:toggle-chat", toggle);
    return () => window.removeEventListener("hsb:toggle-chat", toggle);
  }, []);

  // Closed the panel while Frodo was still working ("exit")? Badge the fab
  // the moment he finishes, instead of the reply just sitting there unseen.
  useEffect(() => {
    if (wasLoadingRef.current && !loading && !open) setHasUnread(true);
    wasLoadingRef.current = loading;
  }, [loading, open]);
  useEffect(() => { if (open) setHasUnread(false); }, [open]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const handleInput = (e) => {
    if (clearing || clearInFlightRef.current) return;
    setInput(e.target.value);
    autoGrow();
  };

  // Stage dropped/pasted images to storage so Frodo's log_bug can claim them.
  // A failed upload no longer discards the image: Frodo can still SEE it (the
  // bytes are already in the browser), he just can't permanently attach it to a
  // bug report. Silently dropping the shot is what made him say "I can't see
  // any image" after Scott had clearly attached one.
  const addFiles = async (fileList) => {
    if (clearing || clearInFlightRef.current) return false;
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(hei[cf])$/i.test(f.name || ""));
    for (const original of files) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      attachmentWorkRef.current += 1;
      setAttachmentWorkCount((count) => count + 1);
      setShots((prev) => [...prev, {
        id,
        dataUrl: null,
        media_type: original.type || "",
        name: original.name || "screenshot",
        size: original.size,
        path: null,
        uploading: true,
        failed: false,
        rejected: false,
      }]);
      try {
        let dataUrl;
        try {
          dataUrl = await readDataUrl(original);
        } catch {
          const message = "Couldn't read that image. Try exporting it as JPEG or PNG.";
          setShots((prev) => prev.map((shot) => (shot.id === id
            ? { ...shot, uploading: false, failed: true, rejected: true, error: message }
            : shot)));
          addToast(message, "error");
          continue;
        }

        // Re-encode to bucket-legal, vision-friendly bytes. A supported raw
        // format may still be sent when browser re-encoding fails; undecodable
        // HEIC/other unsupported bytes remain visible as an actionable error.
        const norm = await normaliseImage(original, dataUrl);
        if (!norm && !canSendOriginalImage(original)) {
          const message = undecodableImageMessage(original);
          setShots((prev) => prev.map((shot) => (shot.id === id
            ? {
                ...shot,
                dataUrl: null,
                uploading: false,
                failed: true,
                rejected: true,
                error: message,
              }
            : shot)));
          addToast(message, "error");
          continue;
        }

        const file = norm?.file || original;
        const shownUrl = norm?.dataUrl || dataUrl;
        const mediaType = norm?.media_type || original.type;
        setShots((prev) => prev.map((shot) => (shot.id === id
          ? { ...shot, dataUrl: shownUrl, media_type: mediaType }
          : shot)));

        try {
          const metadata = await stageScreenshot(file, {
            name: original.name || file.name,
            size: original.size,
          });
          stagedPathsRef.current.add(metadata.path);
          setShots((prev) => prev.map((shot) => (shot.id === id
            ? { ...shot, ...metadata, dataUrl: shownUrl, uploading: false }
            : shot)));
        } catch (err) {
          setShots((prev) => prev.map((shot) => (shot.id === id
            ? { ...shot, uploading: false, failed: true }
            : shot)));
          addToast(`${err.message || "Screenshot upload failed."} Frodo can still see it, but it won't attach to a bug report.`, "error");
        }
      } finally {
        attachmentWorkRef.current -= 1;
        setAttachmentWorkCount((count) => Math.max(0, count - 1));
      }
    }
    return true;
  };

  const onDrop = (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setDragOver(false);
    if (clearing || clearInFlightRef.current) return;
    addFiles(e.dataTransfer.files);
  };
  const onPaste = (e) => {
    if (clearing || clearInFlightRef.current) return;
    const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };
  // Mobile has no drag-and-drop and no easy image paste, so the only way to
  // attach a screenshot is a real file input. Reset value after so picking the
  // same file twice still fires onChange.
  const onPickFiles = (e) => {
    if (!clearing && !clearInFlightRef.current && e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  // Keep staged paths in stagedPathsRef even after a composer thumbnail is
  // removed. Confirmed Clear can then delete those otherwise-orphaned copies.
  const removeShot = (id) => {
    if (clearing || clearInFlightRef.current) return;
    setShots((prev) => prev.filter((s) => s.id !== id));
  };

  const doSend = () => {
    if (loading || clearing || clearInFlightRef.current || hydrating || !historyReady || hasPendingAttachmentWork(shots, attachmentWorkRef.current)) return;
    // Every supported image goes to the model, even when storage staging
    // failed. Evidence paths ride in this turn's attachment metadata, so they
    // cannot leak into another concurrently-running agent conversation.
    const attachments = visionAttachmentsFromShots(shots.filter((shot) => !shot.uploading && !shot.rejected));
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // Unsupported images remain visible until Scott removes them or clears the
    // conversation, preserving the actionable HEIC/JPEG guidance.
    setShots((prev) => prev.filter((shot) => shot.rejected));
    sendMessage(attachments);
  };

  const assertClearReady = useCallback(() => {
    if (clearing || clearDialogRef.current || clearInFlightRef.current) {
      throw new Error("Frodo's conversation is already busy or being cleared.");
    }
    if (loading) throw new Error("Frodo is still working — wait for the reply before clearing the conversation.");
    if (hydrating || !historyReady) throw new Error("Chat history must load successfully before it can be cleared.");
    if (!canBeginAttachmentSafeClear(shots, attachmentWorkRef.current)) {
      throw new Error("Wait for the screenshot to finish preparing, then clear the conversation.");
    }
    return true;
  }, [clearing, historyReady, hydrating, loading, shots]);

  const prepareClear = useCallback(() => {
    assertClearReady();
    clearInFlightRef.current = true;
    return {
      shots,
      stagedPaths: [...stagedPathsRef.current],
    };
  }, [assertClearReady, shots]);

  const cancelPreparedClear = useCallback(() => {
    clearInFlightRef.current = false;
  }, []);

  const executePreparedClear = useCallback(async (preparation) => {
    try {
      const result = await clearHistory(preparation?.stagedPaths || []);
      const reset = chatAttachmentDraftAfterClear(
        result,
        preparation?.shots || [],
        preparation?.stagedPaths || [],
      );
      if (result?.cleared) {
        stagedPathsRef.current = new Set(reset.stagedPaths);
        setShots(reset.shots);
      }
      return result;
    } finally {
      clearInFlightRef.current = false;
    }
  }, [clearHistory]);

  useEffect(() => registerFrodoHistoryController({
    prepare: prepareClear,
    clear: executePreparedClear,
    cancel: cancelPreparedClear,
  }), [cancelPreparedClear, executePreparedClear, prepareClear]);

  const handleClear = async () => {
    try {
      assertClearReady();
    } catch (error) {
      addToast(error.message, "error");
      return;
    }
    clearDialogRef.current = true;
    let approved;
    try {
      approved = await confirm(FRODO_CLEAR_CONFIRMATION, {
        title: "Clear conversation",
        confirmLabel: "Clear",
      });
    } finally {
      clearDialogRef.current = false;
    }
    if (!approved) return;
    let preparation;
    try {
      preparation = prepareClear();
    } catch (error) {
      addToast(error.message, "error");
      return;
    }
    try {
      const result = await executePreparedClear(preparation);
      if (result?.cleanupWarning) addToast(result.cleanupWarning.message, "error");
      else addToast(FRODO_CLEAR_SUCCESS, "success");
    } catch (err) {
      addToast(err.message || "Couldn't clear the conversation.", "error");
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const onPanelKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (!isModal || e.key !== "Tab" || !panelRef.current) return;
    const controls = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
      .filter((node) => node.getClientRects().length > 0);
    const currentIndex = controls.indexOf(document.activeElement);
    const nextIndex = getFocusWrapIndex(currentIndex, controls.length, e.shiftKey);
    if (nextIndex < 0) return;
    e.preventDefault();
    controls[nextIndex].focus({ preventScroll: true });
  };

  const hasSendableShot = visionAttachmentsFromShots(shots.filter((shot) => !shot.uploading && !shot.rejected)).length > 0;
  const canSend = !loading && !clearing && !hydrating && historyReady
    && !hasPendingAttachmentWork(shots, attachmentWorkCount)
    && (input.trim() || hasSendableShot);

  return (
    <>
      {dialog}
      <button className={`chat-fab ${open ? "open" : ""}`} onClick={(e) => {
        if (!open) returnFocusRef.current = e.currentTarget;
        setOpen((v) => !v);
      }} aria-label={open ? "Close assistant" : hasUnread ? "Open assistant — Frodo has a reply for you" : "Open assistant"}>
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-comment-dots"}`} />
        {/* Purely decorative — the state is already in the button's aria-label above. */}
        {hasUnread && !open && <span className="chat-fab-badge" aria-hidden="true" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`chat-panel ${expanded ? "expanded" : ""}`}
          role={isModal ? "dialog" : "region"}
          aria-modal={isModal ? true : undefined}
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          onDragOver={(e) => { if (!clearing && e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
          onDrop={onDrop}>
          <div className="chat-panel-header">
            <span id={titleId}><i className="fa-solid fa-ring" /> Frodo</span>
            <div className="chat-header-actions">
              <button type="button" className="btn-mini muted chat-expand" onClick={() => setExpanded((v) => !v)} title={expanded ? "Shrink" : "Full screen"} aria-label={expanded ? "Exit full screen" : "Open full screen"}>
                <i className={`fa-solid ${expanded ? "fa-compress" : "fa-expand"}`} />
              </button>
              <button type="button" className="btn-mini muted" onClick={handleClear} disabled={clearing || loading || hydrating || !historyReady || attachmentWorkCount > 0} aria-busy={clearing || undefined} title="Clear conversation">
                <i className={`fa-solid ${clearing ? "fa-spinner fa-spin" : "fa-rotate-left"}`} /> {clearing ? "Clearing…" : "Clear"}
              </button>
              <button ref={closeRef} type="button" className="btn-mini muted chat-close" onClick={() => setOpen(false)} title="Close" aria-label="Close assistant">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>

          <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {statusAnnouncement}
          </span>

          <div ref={messagesRef} className="chat-messages" tabIndex={0} aria-label="Conversation with Frodo" {...chatLogA11y}>
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
                    <MarkdownBody html={renderMarkdown(m.text)} />
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
            {historyError && !hydrating && (
              <div className="chat-note" role="alert">
                <i className="fa-solid fa-triangle-exclamation" /> {historyError}{" "}
                <button type="button" className="btn-mini muted" onClick={retryHistoryLoad} disabled={clearing}>Retry</button>
              </div>
            )}
            {legacyWarning && <div className="chat-note" role="alert"><i className="fa-solid fa-shield-halved" /> {legacyWarning}</div>}
            {saveError && <div className="chat-note" role="alert"><i className="fa-solid fa-triangle-exclamation" /> Chat history isn't saving: {saveError}</div>}
            {attachmentError && <div className="chat-note" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {attachmentError}</div>}
            {clearing && <div className="chat-note" role="status"><i className="fa-solid fa-spinner fa-spin" /> clearing conversation…</div>}
            {loading && (
              <div className="chat-msg assistant chat-typing" aria-hidden="true">
                <span /><span /><span />
                {status && <em className="chat-status">{status}</em>}
              </div>
            )}
          </div>

          {/* Staged screenshot thumbnails */}
          {shots.length > 0 && (
            <div className="chat-shots">
              {shots.map((s) => (
                <div key={s.id} className={`chat-shot${s.failed ? " failed" : ""}`} title={s.error || (s.failed ? "Upload failed — Frodo can still see this, but it won't attach to a bug report." : undefined)}>
                  {s.dataUrl
                    ? <img src={s.dataUrl} alt="screenshot" />
                    : <span className="chat-shot-error"><i className="fa-solid fa-file-image" /> JPEG or PNG needed</span>}
                  {s.uploading && <span className="chat-shot-spin"><i className="fa-solid fa-spinner fa-spin" /></span>}
                  {s.failed && <span className="chat-shot-warn"><i className="fa-solid fa-triangle-exclamation" /></span>}
                  <button type="button" className="chat-shot-x" onClick={() => removeShot(s.id)} disabled={clearing} aria-label="Remove"><i className="fa-solid fa-xmark" /></button>
                </div>
              ))}
            </div>
          )}

          <div className={`chat-input-row${dragOver ? " drag-over" : ""}`}>
            <textarea ref={textareaRef} className="chat-input" value={input} maxLength={MAX_INPUT_CHARS}
              onChange={handleInput} onKeyDown={onKey} onPaste={onPaste}
              disabled={clearing || hydrating || !historyReady}
              placeholder={clearing ? "Clearing conversation…" : dragOver ? "Drop screenshot to attach…" : "Ask Frodo, or drop a screenshot…"} rows={1} />
            {input.length > MAX_INPUT_CHARS * 0.85 && (
              <span className="chat-char-count">{input.length}/{MAX_INPUT_CHARS}</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              disabled={clearing}
              onChange={onPickFiles}
            />
            <button type="button" className="chat-attach" onClick={() => fileInputRef.current?.click()} disabled={clearing || loading || hydrating || !historyReady} aria-label="Attach screenshot" title="Attach screenshot">
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

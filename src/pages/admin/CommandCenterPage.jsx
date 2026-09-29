import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, getAgent } from "../../agents/registry";
import { resolveTools, agentConnector, agentProtocol, modelLabel } from "../../agents/agentProfile";
import { loadBrain } from "../../api/brainApi";
import { describeAction, actionTime } from "../../utils/agentActions";
import { renderMarkdown } from "../../utils/markdown";
import MarkdownBody from "../../components/MarkdownBody";
import { copyText } from "../../utils/clipboard";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { useAgentRuntime } from "../../contexts/AgentRuntimeContext";
import { toDateStr } from "../../utils/plannerUtils";
import AulePanel from "./AulePanel";
import DocLinks from "../../components/docs/DocLinks";
import PdfViewer from "../../components/PdfViewer";
import { markdownToPdfBlob } from "../../lib/markdownToPdf";
import { readDataUrl, normaliseImage } from "../../utils/image";
import {
  agentAttachmentIntakePolicy,
  agentAttachmentSnapshot,
  beginAgentAttachmentWork,
  bindAgentAttachmentDraft,
  canBeginAttachmentSafeClear,
  clearAgentAttachments,
  createAgentAttachmentDraft,
  finishAgentAttachmentWork,
  publishAgentAttachment,
  removeAgentAttachment,
} from "../../utils/chatAttachments";
import { genId } from "../../api/_base";
import "./command.css";

const todayStr = () => toDateStr(new Date());

export default function CommandCenterPage() {
  const { addToast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  // The agent runtime lives ABOVE the router (AgentRuntimeProvider), so agents
  // keep running and the Aulë socket stays alive when you leave this page.
  // This page is just a view onto that state.
  const {
    selectedId, setSelectedId, view, setView,
    threads, busy, clearingThreads, statuses, inputs, sessionSaveErrors,
    setInputFor, sendTo, clearThread, retryThreadSave, runOverseer, actions, refreshActions, activate,
    sessionHistoryStatus, sessionHistoryError, sessionHistoryReady, retrySessionHistory,
    aule,
  } = useAgentRuntime();
  // Start the agent runtime (history, activity feed, Aulë socket) the first time this opens.
  useEffect(() => { activate(); }, [activate]);

  const [nodes, setNodes] = useState([]);        // brain nodes, for per-agent documents
  const [viewerDoc, setViewerDoc] = useState(null); // { title, body, slug? } open in the markdown viewer
  const [pdfDoc, setPdfDoc] = useState(null);        // { blob, title, filename } open in the PDF viewer
  const [attachmentDraft, setAttachmentDraft] = useState(() => createAgentAttachmentDraft(selectedId));
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatRef = useRef(null);
  const didMount = useRef(false);
  const attachmentDraftRef = useRef(attachmentDraft);
  const clearDialogRef = useRef(false);
  const clearInFlightRef = useRef(new Set());
  const sendInFlightRef = useRef(new Set());

  // The state tag keeps the old agent's images invisible during the render
  // before this effect runs. The generation also invalidates late image work.
  useEffect(() => {
    const current = attachmentDraftRef.current;
    const next = bindAgentAttachmentDraft(current, selectedId);
    if (next !== current) {
      attachmentDraftRef.current = next;
      setAttachmentDraft(next);
    }
  }, [selectedId]);

  // The agent cards sit above the chat panel, so picking one (especially on a
  // phone) leaves the chat off-screen. Bring it into view when the selection
  // changes — but not on first mount/navigation, so a restored selection
  // doesn't hijack the initial scroll position.
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (selectedId) chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  const selected = selectedId ? getAgent(selectedId) : null;
  // The local Aulë agent keeps a live WebSocket + conversation in the runtime.
  // We mount his panel only when he's selected — the connection is no longer
  // tied to this component, so switching/leaving never tears it down.
  const localAgent = useMemo(() => AGENTS.find((a) => a.kind === "local") || null, []);
  const showAule = !!selected && selected.kind === "local" && view === "work";
  const thread = (selectedId && threads[selectedId]) || { convo: [], display: [] };
  const draft = (selectedId && inputs[selectedId]) || "";
  const selBusy = selectedId ? !!busy[selectedId] : false;
  const selClearing = selectedId ? !!clearingThreads[selectedId] : false;
  const selLocked = selBusy || selClearing;
  const selStatus = (selectedId && statuses[selectedId]) || "";
  const selSaveError = (selectedId && sessionSaveErrors[selectedId]) || "";
  const attachmentSnapshot = agentAttachmentSnapshot(attachmentDraft, selectedId);
  const shots = attachmentSnapshot.shots;
  const attachmentWorkCount = attachmentSnapshot.activeWorkCount;
  const attachmentIntake = agentAttachmentIntakePolicy({
    busy: selBusy,
    clearing: selClearing,
    mutationInFlight: false,
    historyReady: sessionHistoryReady,
  });

  const updateAttachmentDraft = (update) => {
    const current = attachmentDraftRef.current;
    const next = update(current);
    if (next !== current) {
      attachmentDraftRef.current = next;
      setAttachmentDraft(next);
    }
    return next;
  };

  const selectAgent = (agentId) => {
    updateAttachmentDraft((current) => bindAgentAttachmentDraft(current, agentId));
    setSelectedId(agentId);
  };

  // Brain notes power each agent's "Documents" — nodes are attributed by source.
  useEffect(() => { loadBrain().then((b) => setNodes(b.nodes || [])).catch(() => {}); }, []);

  const selectedDocs = useMemo(
    () => (selectedId ? nodes.filter((n) => n.source === selectedId) : []),
    [nodes, selectedId]
  );
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [thread.display, selectedId, selStatus]);

  // Per-agent count of today's actions (agent id is stored in the `tier` column).
  const todayCounts = useMemo(() => {
    const t = todayStr();
    const counts = {};
    for (const a of actions) {
      if (String(a.created_at).slice(0, 10) !== t) continue;
      counts[a.agent_id] = (counts[a.agent_id] || 0) + 1;
    }
    return counts;
  }, [actions]);

  // Render any markdown (an agent reply, or a filed doc) into a real PDF and
  // open it in the PDF viewer — this is how agents "show their work" as a doc.
  const openAsPdf = (title, body, subtitle) => {
    try {
      const blob = markdownToPdfBlob(body || "", {
        title: title || "Agent reply",
        subtitle: subtitle || "",
        footer: `heyscottybro · Command Center · ${new Date().toLocaleString()}`,
      });
      const filename = `${(title || "agent-reply").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "agent-reply"}.pdf`;
      setPdfDoc({ blob, title: title || "Agent reply", filename });
    } catch {
      addToast("Couldn't build that PDF.", "error");
    }
  };

  // Attach images so the (vision-capable) agent can SEE them. We read them to
  // base64 in the browser — no upload needed; they ride along with the message.
  // Same pipeline as Frodo's chat (ChatBot.jsx): HEIC → JPEG, long edge
  // capped, so phone photos don't arrive as 8 MB HEIC the model can't read.
  const isImageFile = (f) => (f.type || "").startsWith("image/") || /\.(hei[cf])$/i.test(f.name || "");
  const addFiles = async (fileList) => {
    const initiatingAgentId = selectedId;
    const intake = agentAttachmentIntakePolicy({
      busy: selBusy,
      clearing: selClearing,
      mutationInFlight: initiatingAgentId
        ? sendInFlightRef.current.has(initiatingAgentId) || clearInFlightRef.current.has(initiatingAgentId)
        : false,
      historyReady: sessionHistoryReady,
    });
    if (!initiatingAgentId || !intake.allowed) {
      if (initiatingAgentId && intake.message) addToast(intake.message, "error");
      return false;
    }
    const all = [...fileList];
    const files = all.filter(isImageFile);
    const rejected = all.length - files.length;
    if (rejected > 0) addToast(`${rejected} file${rejected === 1 ? " isn't" : "s aren't"} an image — only images can be attached.`, "error");
    for (const original of files) {
      const id = genId("attachment");
      const started = beginAgentAttachmentWork(attachmentDraftRef.current, initiatingAgentId);
      if (!started.token) return false;
      attachmentDraftRef.current = started.draft;
      setAttachmentDraft(started.draft);
      try {
        let dataUrl;
        try { dataUrl = await readDataUrl(original); }
        catch (err) { addToast(`Couldn't read ${original.name || "that image"}: ${err?.message || "read failed"}`, "error"); continue; }
        const norm = await normaliseImage(original, dataUrl);
        if (!norm && !(original.type || "").startsWith("image/")) {
          // HEIC outside Safari: the browser can't decode it and the model can't either.
          addToast(`${original.name || "That image"} couldn't be decoded in this browser — export it as JPEG/PNG and try again.`, "error");
          continue;
        }
        updateAttachmentDraft((current) => publishAgentAttachment(current, started.token, {
          id,
          dataUrl: norm?.dataUrl || dataUrl,
          media_type: norm?.media_type || original.type,
        }));
      } finally {
        updateAttachmentDraft((current) => finishAgentAttachmentWork(current, started.token));
      }
    }
    return true;
  };
  const removeShot = (id) => {
    if (!attachmentIntake.allowed) return;
    const token = agentAttachmentSnapshot(attachmentDraftRef.current, selectedId).token;
    updateAttachmentDraft((current) => removeAgentAttachment(current, token, id));
  };
  const onPaste = (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };
  const onDropFiles = (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const doSend = async () => {
    const currentAttachments = agentAttachmentSnapshot(attachmentDraftRef.current, selected?.id);
    if (!selected || selLocked || clearInFlightRef.current.has(selected.id) || currentAttachments.activeWorkCount > 0 || !sessionHistoryReady) return;
    const attachments = currentAttachments.shots.map((s) => ({ media_type: s.media_type, data: s.dataUrl.split(",")[1] }));
    if (!draft.trim() && attachments.length === 0) return;
    sendInFlightRef.current.add(selected.id);
    try {
      const accepted = await sendTo(selected, draft, attachments);
      if (accepted) {
        updateAttachmentDraft((current) => clearAgentAttachments(current, currentAttachments.token));
      }
    } finally {
      sendInFlightRef.current.delete(selected.id);
    }
  };

  // Wipe this agent's thread — state and the stored agent_sessions row. Asks
  // first (it's not undoable), and reports a storage failure instead of
  // pretending the thread is gone.
  const doClearThread = async () => {
    if (!selected || selLocked || clearDialogRef.current || clearInFlightRef.current.has(selected.id) || !sessionHistoryReady) return;
    const initialAttachments = agentAttachmentSnapshot(attachmentDraftRef.current, selected.id);
    if (!canBeginAttachmentSafeClear(initialAttachments.shots, initialAttachments.activeWorkCount)) {
      addToast("Wait for the image to finish preparing, then clear the thread.", "error");
      return;
    }
    clearDialogRef.current = true;
    let ok;
    try {
      ok = await confirm(
        `Clear the whole conversation with ${selected.name}? ${selected.name} will forget everything discussed so far. This can't be undone.`,
        { title: "Clear thread", confirmLabel: "Clear" },
      );
    } finally {
      clearDialogRef.current = false;
    }
    if (!ok) return;
    const confirmedAttachments = agentAttachmentSnapshot(attachmentDraftRef.current, selected.id);
    if (!canBeginAttachmentSafeClear(confirmedAttachments.shots, confirmedAttachments.activeWorkCount)) {
      addToast("Wait for the image to finish preparing, then clear the thread.", "error");
      return;
    }
    clearInFlightRef.current.add(selected.id);
    try {
      await clearThread(selected.id);
      updateAttachmentDraft((current) => clearAgentAttachments(current, confirmedAttachments.token));
      addToast(`Cleared ${selected.name}'s thread.`, "success");
    } catch (e) {
      addToast(e?.message || `Couldn't clear ${selected.name}'s thread.`, "error");
    } finally {
      clearInFlightRef.current.delete(selected.id);
    }
  };

  return (
    <div className="module-page cmd-page">
      <div className="module-header">
        <h1>Command Center</h1>
        <button type="button" className="btn btn-sm" onClick={runOverseer} disabled={!sessionHistoryReady || !!busy.galadriel || !!clearingThreads.galadriel} aria-busy={!!busy.galadriel || !!clearingThreads.galadriel || undefined}>
          <i className={`fa-solid ${busy.galadriel || clearingThreads.galadriel ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} aria-hidden="true" /> Run daily summary
        </button>
      </div>

      <p className="cmd-intro">
        Your agents — each with its own role, model and toolbelt. API agents run on your
        Anthropic key; the Coding agent runs real Claude Code on your Max plan via the local
        agent server. Tap an agent to put it to work; everything they do lands in the feed below
        and in your <a href="/admin/mission?tab=brain">Brain</a>.
      </p>

      {(sessionHistoryStatus === "idle" || sessionHistoryStatus === "loading") && (
        <div className="load-error" role="status">
          <p><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading agent chat history…</p>
        </div>
      )}
      {sessionHistoryStatus === "failed" && (
        <div className="load-error" role="alert">
          <p>Couldn't load agent chat history: {sessionHistoryError}</p>
          <button type="button" className="btn btn-sm" onClick={retrySessionHistory}>Retry</button>
        </div>
      )}

      <div className="cmd-grid">
        {AGENTS.map((a) => {
          const isLocal = a.kind === "local";
          // The local agent (Aulë) reports live state from the runtime; API
          // agents use the per-agent busy map. "offline" only applies to Aulë
          // when he isn't actually connected to the local agent server.
          const offline = isLocal ? aule.status !== "online" : false;
          const isBusy = isLocal ? aule.busy : !!busy[a.id];
          const isClearing = !isLocal && !!clearingThreads[a.id];
          const recent = isLocal ? aule.recent : "";
          const foot = isLocal
            ? (isBusy ? "working…" : recent || (offline ? "off" : "online"))
            : (isClearing ? "clearing…" : isBusy ? "working…" : todayCounts[a.id] ? `${todayCounts[a.id]} today` : "—");
          const state = isBusy || isClearing ? "working" : offline ? "off" : "idle";
          const stateLabel = isClearing ? "Clearing" : state === "working" ? "Working" : state === "off" ? "Offline" : "Idle";
          return (
            <button
              type="button"
              key={a.id}
              className={`cmd-card${selectedId === a.id ? " selected" : ""}${offline ? " offline" : ""}`}
              aria-pressed={selectedId === a.id}
              onClick={() => selectAgent(a.id)}
            >
              <div className="cmd-card-top">
                <span className="cmd-avatar" style={{ background: a.color }} aria-hidden="true">
                  <i className={`fa-solid ${a.icon}`} />
                </span>
                <span className={`cmd-status ${state}`} title={stateLabel}>
                  <span className="visually-hidden">{stateLabel}</span>
                </span>
              </div>
              <div className="cmd-card-name">{a.name}</div>
              <div className="cmd-card-title">{a.title}</div>
              <div className="cmd-card-tagline">{isLocal && recent ? recent : a.tagline}</div>
              <div className="cmd-card-meta">
                <span><i className="fa-solid fa-microchip" aria-hidden="true" /> {modelLabel(a.model)}</span>
                {a.kind !== "local" && <span><i className="fa-solid fa-toolbox" aria-hidden="true" /> {resolveTools(a).length} tools</span>}
              </div>
              <div className="cmd-card-foot">
                <span className={`cmd-badge ${a.kind}`}>{a.kind === "local" ? "Max plan" : "API"}</span>
                <span className="cmd-card-count" title={recent || undefined}>{foot}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="cmd-lower">
        {/* Chat / work panel */}
        <section className={`db-card cmd-chat${selected ? "" : " is-empty"}`} ref={chatRef}>
          {!selected && (
            <div className="empty-state">
              <i className="fa-solid fa-satellite-dish empty-state-icon" aria-hidden="true" />
              <p className="empty-state-desc">Pick an agent above to start working with it — or open its Profile to see its connector, protocol, tools and documents.</p>
            </div>
          )}

          {selected && (
            <>
              <div className="db-card-header cmd-chat-head">
                <span className="cmd-avatar sm" style={{ background: selected.color }} aria-hidden="true"><i className={`fa-solid ${selected.icon}`} /></span>
                <div className="cmd-chat-id">
                  <h3 className="db-card-title">{selected.name}</h3>
                  <div className="cmd-chat-sub">{selected.title} · <span className="cmd-model">{selected.model}</span></div>
                </div>
                {((selected.kind === "api" && thread.display.length > 0) || selBusy || selClearing) && (
                  <div className="cmd-chat-actions">
                    {selected.kind === "api" && thread.display.length > 0 && (
                      <button type="button" className="btn-mini muted" onClick={doClearThread} disabled={selLocked || attachmentWorkCount > 0 || !sessionHistoryReady} aria-busy={selClearing || undefined} title={`Clear the conversation with ${selected.name}`}>
                        <i className={`fa-solid ${selClearing ? "fa-spinner fa-spin" : "fa-rotate-left"}`} aria-hidden="true" /> {selClearing ? "Clearing…" : "Clear thread"}
                      </button>
                    )}
                    {selBusy && <span className="cmd-chip-working"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> working</span>}
                    {selClearing && <span className="cmd-chip-working" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> clearing</span>}
                  </div>
                )}
              </div>

              <div className="segmented cmd-tabs" role="group" aria-label={`${selected.name} view`}>
                <button type="button" className={`segmented-opt${view === "work" ? " active" : ""}`} aria-pressed={view === "work"} onClick={() => setView("work")}>
                  <i className={`fa-solid ${selected.kind === "local" ? "fa-plug" : "fa-comments"}`} aria-hidden="true" /> {selected.kind === "local" ? "Status" : "Work"}
                </button>
                <button type="button" className={`segmented-opt${view === "profile" ? " active" : ""}`} aria-pressed={view === "profile"} onClick={() => setView("profile")}>
                  <i className="fa-solid fa-id-card" aria-hidden="true" /> Profile
                </button>
              </div>

              {view === "profile" && (
                <>
                  <AgentProfile agent={selected} docs={selectedDocs} onOpenDoc={setViewerDoc} />
                  <div className="cmd-deliverables">
                    <h4 className="cmd-deliverables-title"><i className="fa-solid fa-paperclip" aria-hidden="true" /> Deliverables &amp; research</h4>
                    <DocLinks entityType="agent" entityId={selected.id} title="Linked documents" />
                  </div>
                </>
              )}

              {/* Aulë's live panel reads the persistent WebSocket + conversation
                  from the runtime, so it can mount/unmount freely without ever
                  dropping the connection. */}
              {showAule && localAgent && (
                <AulePanel agent={localAgent} onOpenDoc={setViewerDoc} />
              )}

              {view === "work" && selected.kind === "api" && (
                <>
                  {selSaveError && (
                    <div className="cmd-save-warning" role="alert">
                      <span><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> This chat is visible but its latest history did not save: {selSaveError}</span>
                      <button type="button" className="btn-mini" onClick={() => retryThreadSave(selected.id)} disabled={selLocked || !sessionHistoryReady}>Retry save</button>
                    </div>
                  )}
                  <div className="cmd-thread" ref={scrollRef}>
                    {thread.display.length === 0 && (
                      <p className="no-entries">Say hello, or give {selected.name} a task.</p>
                    )}
                    {thread.display.map((m, i) => (
                      <div key={i} className={`cmd-msg ${m.role}`}>
                        {m.role === "assistant" ? (
                          <>
                            <button
                              type="button"
                              className="cmd-msg-expand is-pdf"
                              title="View as PDF"
                              aria-label="View reply as PDF"
                              onClick={() => openAsPdf(`${selected.name} · ${selected.title}`, m.text, selected.tagline)}
                            >
                              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="cmd-msg-expand"
                              title="Open in viewer"
                              aria-label="Open reply in viewer"
                              onClick={() => setViewerDoc({ title: `${selected.name} · ${selected.title}`, body: m.text })}
                            >
                              <i className="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true" />
                            </button>
                            <MarkdownBody className="chat-md" html={renderMarkdown(m.text)} />
                          </>
                        ) : (
                          <>
                            {m.images?.length > 0 && (
                              <div className="cmd-msg-shots">
                                {m.images.map((src, j) => (
                                  <a key={j} href={src} target="_blank" rel="noreferrer">
                                    <img src={src} alt="attachment" />
                                  </a>
                                ))}
                              </div>
                            )}
                            {!m.images?.length && m.shots > 0 && <span className="cmd-msg-meta"><i className="fa-solid fa-paperclip" aria-hidden="true" /> {m.shots} screenshot{m.shots === 1 ? "" : "s"} </span>}
                            {m.text && <span>{m.text}</span>}
                          </>
                        )}
                      </div>
                    ))}
                    {selBusy && selStatus && <div className="cmd-status-line"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> {selStatus}</div>}
                  </div>

                  {shots.length > 0 && (
                    <div className="cmd-shots">
                      {shots.map((s) => (
                        <div key={s.id} className="cmd-shot">
                          <img src={s.dataUrl} alt="attachment" />
                          <button type="button" className="cmd-shot-x" onClick={() => removeShot(s.id)} disabled={!attachmentIntake.allowed} aria-label="Remove image"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form
                    className={`cmd-input-row${dragOver ? " drag-over" : ""}`}
                    onSubmit={(e) => { e.preventDefault(); doSend(); }}
                    onDragOver={(e) => { if (attachmentIntake.allowed && e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
                    onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
                    onDrop={onDropFiles}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      disabled={!attachmentIntake.allowed}
                      onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
                    />
                    <button type="button" className="btn-secondary-sm cmd-icon-btn" onClick={() => fileInputRef.current?.click()} disabled={selLocked || !sessionHistoryReady} title="Attach image" aria-label="Attach image">
                      <i className="fa-solid fa-paperclip" aria-hidden="true" />
                    </button>
                    <input
                      aria-label={`Message ${selected.name}`}
                      placeholder={!sessionHistoryReady ? "Loading chat history…" : selClearing ? `Clearing ${selected.name}'s conversation…` : selBusy ? `${selected.name} is working…` : dragOver ? "Drop image to attach…" : `Message ${selected.name}…`}
                      value={draft}
                      onChange={(e) => setInputFor(selected.id, e.target.value)}
                      onPaste={onPaste}
                      disabled={selLocked || !sessionHistoryReady}
                    />
                    <button className="btn cmd-icon-btn" type="submit" disabled={!sessionHistoryReady || selLocked || attachmentWorkCount > 0 || (!draft.trim() && shots.length === 0)} aria-label="Send">
                      <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </section>

        {/* Activity feed */}
        <section className="db-card cmd-feed">
          <div className="db-card-header">
            <h3 className="db-card-title">Activity</h3>
            <button type="button" className="btn-mini" onClick={refreshActions} title="Refresh" aria-label="Refresh activity"><i className="fa-solid fa-rotate-right" aria-hidden="true" /></button>
          </div>
          {actions.length === 0 && <p className="no-entries">No agent activity yet.</p>}
          <div className="cmd-feed-list">
            {actions.map((a) => {
              const agent = getAgent(a.agent_id);
              const isErr = a.status === "error";
              return (
                <div key={a.id} className="cmd-feed-item">
                  <span className="cmd-feed-dot" style={{ background: agent?.color || "var(--text-muted)" }} aria-hidden="true" />
                  <div className="cmd-feed-body">
                    <div className="cmd-feed-title">{describeAction(a)}</div>
                    <div className="cmd-feed-meta">
                      {agent?.name || a.agent_id} · {actionTime(a.created_at)}
                      {isErr && <> · <span className="cmd-feed-err">failed</span></>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Markdown viewer — agents present their work (filed docs + any reply) */}
      {viewerDoc && (
        <div className="cmd-viewer-backdrop" onClick={() => setViewerDoc(null)}>
          <div className="cmd-viewer" role="dialog" aria-modal="true" aria-label={viewerDoc.title || viewerDoc.slug || "Document"} onClick={(e) => e.stopPropagation()}>
            <div className="cmd-viewer-head">
              <h3 className="db-card-title">{viewerDoc.title || viewerDoc.slug || "Document"}</h3>
              <div className="cmd-viewer-actions">
                <button type="button" className="btn-mini" title="View as PDF" aria-label="View as PDF" onClick={() => { openAsPdf(viewerDoc.title || viewerDoc.slug, viewerDoc.body); setViewerDoc(null); }}>
                  <i className="fa-solid fa-file-pdf" aria-hidden="true" />
                </button>
                <button type="button" className="btn-mini" title="Copy markdown" aria-label="Copy markdown" onClick={() => copyText(viewerDoc.body || "").then(() => addToast("Markdown copied.", "success")).catch((err) => addToast(`Couldn't copy: ${err?.message || err}`, "error"))}>
                  <i className="fa-solid fa-copy" aria-hidden="true" />
                </button>
                {viewerDoc.slug && <a className="btn-mini" href="/admin/mission?tab=brain" title="Open in Brain" aria-label="Open in Brain"><i className="fa-solid fa-diagram-project" aria-hidden="true" /></a>}
                <button type="button" className="btn-mini" onClick={() => setViewerDoc(null)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            </div>
            <MarkdownBody className="cmd-viewer-body chat-md" html={renderMarkdown(viewerDoc.body || "*(empty document)*")} />
          </div>
        </div>
      )}

      {confirmDialog}

      {/* PDF viewer — agents' work rendered as a real, downloadable document */}
      {pdfDoc && (
        <PdfViewer
          blob={pdfDoc.blob}
          title={pdfDoc.title}
          filename={pdfDoc.filename}
          onClose={() => setPdfDoc(null)}
        />
      )}
    </div>
  );
}

/* Read-only inspector: how this agent connects, how it runs, what it can do,
 * and what it has filed into the Brain. */
function AgentProfile({ agent, docs, onOpenDoc }) {
  const conn = agentConnector(agent);
  const protocol = agentProtocol(agent);
  const tools = resolveTools(agent);

  return (
    <div className="cmd-profile">
      <div className="cmd-prof-block">
        <div className="cmd-prof-h"><i className="fa-solid fa-plug" aria-hidden="true" /> Connector</div>
        <div className="cmd-prof-rows">
          <div className="cmd-prof-row"><span>Model</span><b>{conn.modelLabel}</b></div>
          <div className="cmd-prof-row"><span>Transport</span><b>{conn.transport}</b></div>
        </div>
        <p className="cmd-prof-note">{conn.note}</p>
      </div>

      <div className="cmd-prof-block">
        <div className="cmd-prof-h"><i className="fa-solid fa-diagram-project" aria-hidden="true" /> Protocol</div>
        <div className="cmd-prof-rows">
          {protocol.map((f) => (
            <div key={f.label} className="cmd-prof-row"><span>{f.label}</span><b>{f.value}</b></div>
          ))}
        </div>
      </div>

      <div className="cmd-prof-block">
        <div className="cmd-prof-h">
          <i className="fa-solid fa-toolbox" aria-hidden="true" /> Tools <span className="db-count cmd-prof-count">{tools.length}</span>
        </div>
        {tools.length === 0 ? (
          <p className="cmd-prof-note">
            {agent.kind === "local"
              ? "Runs Claude Code — full file-system & shell access on your Mac, not the app toolbelt."
              : "No tools — replies from knowledge only."}
          </p>
        ) : (
          <div className="cmd-tool-list">
            {tools.map((t) => (
              <div key={t.name} className="cmd-tool">
                <code className="cmd-tool-name">{t.name}</code>
                <span className="cmd-tool-desc">{t.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cmd-prof-block">
        <div className="cmd-prof-h">
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> Documents <span className="db-count cmd-prof-count">{docs.length}</span>
        </div>
        {docs.length === 0 ? (
          <p className="cmd-prof-note">Nothing filed into the Brain yet.</p>
        ) : (
          <div className="cmd-doc-list">
            {docs.map((d) => (
              <button key={d.id || d.slug} type="button" className="cmd-doc" title={`Open “${d.title || d.slug}”`} onClick={() => onOpenDoc(d)}>
                <span className="cmd-doc-title"><i className="fa-solid fa-note-sticky" aria-hidden="true" /> {d.title || d.slug}</span>
                <span className="cmd-doc-meta">
                  {(d.type || "note")}{d.updated_at ? ` · ${new Date(d.updated_at).toLocaleDateString()}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

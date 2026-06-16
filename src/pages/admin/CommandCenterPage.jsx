import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, getAgent } from "../../agents/registry";
import { resolveTools, agentConnector, agentProtocol, modelLabel } from "../../agents/agentProfile";
import { loadBrain } from "../../api/brainApi";
import { describeAction, actionTime } from "../../utils/agentActions";
import { renderMarkdown } from "../../utils/markdown";
import { useToast } from "../../contexts/ToastContext";
import { useAgentRuntime } from "../../contexts/AgentRuntimeContext";
import { toDateStr } from "../../utils/plannerUtils";
import AulePanel from "./AulePanel";
import DocLinks from "../../components/docs/DocLinks";
import PdfViewer from "../../components/PdfViewer";
import { markdownToPdfBlob } from "../../lib/markdownToPdf";
import "./command.css";

const todayStr = () => toDateStr(new Date());

export default function CommandCenterPage() {
  const { addToast } = useToast();
  // The agent runtime lives ABOVE the router (AgentRuntimeProvider), so agents
  // keep running and the Aulë socket stays alive when you leave this page.
  // This page is just a view onto that state.
  const {
    selectedId, setSelectedId, view, setView,
    threads, busy, statuses, inputs,
    setInputFor, sendTo, runOverseer, actions, refreshActions,
    aule,
  } = useAgentRuntime();

  const [nodes, setNodes] = useState([]);        // brain nodes, for per-agent documents
  const [viewerDoc, setViewerDoc] = useState(null); // { title, body, slug? } open in the markdown viewer
  const [pdfDoc, setPdfDoc] = useState(null);        // { blob, title, filename } open in the PDF viewer
  const scrollRef = useRef(null);

  const selected = selectedId ? getAgent(selectedId) : null;
  // The local Aulë agent keeps a live WebSocket + conversation in the runtime.
  // We mount his panel only when he's selected — the connection is no longer
  // tied to this component, so switching/leaving never tears it down.
  const localAgent = useMemo(() => AGENTS.find((a) => a.kind === "local") || null, []);
  const showAule = !!selected && selected.kind === "local" && view === "work";
  const thread = (selectedId && threads[selectedId]) || { convo: [], display: [] };
  const draft = (selectedId && inputs[selectedId]) || "";
  const selBusy = selectedId ? !!busy[selectedId] : false;
  const selStatus = (selectedId && statuses[selectedId]) || "";

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
      counts[a.tier] = (counts[a.tier] || 0) + 1;
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

  return (
    <div className="module-page cmd-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-satellite-dish" /> Command Center</h1>
        <button className="btn btn-sm" onClick={runOverseer} disabled={!!busy.galadriel}>
          <i className={`fa-solid ${busy.galadriel ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} /> Run daily summary
        </button>
      </div>

      <p className="cmd-intro">
        Your agents — each with its own role, model and toolbelt. API agents run on your
        Anthropic key; the Coding agent runs real Claude Code on your Max plan via the local
        agent server. Tap an agent to put it to work; everything they do lands in the feed below
        and in your <a href="/admin/brain">Brain</a>.
      </p>

      <div className="cmd-grid">
        {AGENTS.map((a) => {
          const isLocal = a.kind === "local";
          // The local agent (Aulë) reports live state from the runtime; API
          // agents use the per-agent busy map. "offline" only applies to Aulë
          // when he isn't actually connected to the local agent server.
          const offline = isLocal ? aule.status !== "online" : false;
          const isBusy = isLocal ? aule.busy : !!busy[a.id];
          const recent = isLocal ? aule.recent : "";
          const foot = isLocal
            ? (isBusy ? "working…" : recent || (offline ? "off" : "online"))
            : (isBusy ? "working…" : todayCounts[a.id] ? `${todayCounts[a.id]} today` : "—");
          return (
            <button
              key={a.id}
              className={`cmd-card${selectedId === a.id ? " selected" : ""}${offline ? " offline" : ""}`}
              style={{ "--agent": a.color }}
              onClick={() => setSelectedId(a.id)}
            >
              <div className="cmd-card-top">
                <span className="cmd-avatar" style={{ background: a.color }}>
                  <i className={`fa-solid ${a.icon}`} />
                </span>
                <span className={`cmd-status ${isBusy ? "working" : offline ? "off" : "idle"}`} />
              </div>
              <div className="cmd-card-name">{a.name}</div>
              <div className="cmd-card-title">{a.title}</div>
              <div className="cmd-card-tagline">{isLocal && recent ? recent : a.tagline}</div>
              <div className="cmd-card-meta">
                <span><i className="fa-solid fa-microchip" /> {modelLabel(a.model)}</span>
                {a.kind !== "local" && <span><i className="fa-solid fa-toolbox" /> {resolveTools(a).length} tools</span>}
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
        <section className="db-card cmd-chat">
          {!selected && <p className="no-entries">Pick an agent above to start working with it — or open its Profile to see its connector, protocol, tools and documents.</p>}

          {selected && (
            <>
              <div className="cmd-chat-head">
                <span className="cmd-avatar sm" style={{ background: selected.color }}><i className={`fa-solid ${selected.icon}`} /></span>
                <div>
                  <div className="cmd-card-name">{selected.name}</div>
                  <div className="cmd-card-title">{selected.title} · <span className="cmd-model">{selected.model}</span></div>
                </div>
                {selBusy && <span className="cmd-chip-working"><i className="fa-solid fa-spinner fa-spin" /> working</span>}
              </div>

              <div className="cmd-tabs">
                <button type="button" className={`cmd-tab${view === "work" ? " active" : ""}`} onClick={() => setView("work")}>
                  <i className={`fa-solid ${selected.kind === "local" ? "fa-plug" : "fa-comments"}`} /> {selected.kind === "local" ? "Status" : "Work"}
                </button>
                <button type="button" className={`cmd-tab${view === "profile" ? " active" : ""}`} onClick={() => setView("profile")}>
                  <i className="fa-solid fa-id-card" /> Profile
                </button>
              </div>

              {view === "profile" && (
                <>
                  <AgentProfile agent={selected} docs={selectedDocs} onOpenDoc={setViewerDoc} />
                  <div className="cmd-deliverables">
                    <h4 className="cmd-deliverables-title"><i className="fa-solid fa-paperclip" /> Deliverables &amp; research</h4>
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
                              className="cmd-msg-expand"
                              style={{ right: 30 }}
                              title="View as PDF"
                              onClick={() => openAsPdf(`${selected.name} · ${selected.title}`, m.text, selected.tagline)}
                            >
                              <i className="fa-solid fa-file-pdf" />
                            </button>
                            <button
                              type="button"
                              className="cmd-msg-expand"
                              title="Open in viewer"
                              onClick={() => setViewerDoc({ title: `${selected.name} · ${selected.title}`, body: m.text })}
                            >
                              <i className="fa-solid fa-up-right-and-down-left-from-center" />
                            </button>
                            <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                          </>
                        ) : <span>{m.text}</span>}
                      </div>
                    ))}
                    {selBusy && selStatus && <div className="cmd-status-line"><i className="fa-solid fa-spinner fa-spin" /> {selStatus}</div>}
                  </div>

                  <form
                    className="cmd-input-row"
                    onSubmit={(e) => { e.preventDefault(); sendTo(selected, draft); }}
                  >
                    <input
                      placeholder={selBusy ? `${selected.name} is working…` : `Message ${selected.name}…`}
                      value={draft}
                      onChange={(e) => setInputFor(selected.id, e.target.value)}
                      disabled={selBusy}
                    />
                    <button className="btn btn-sm" type="submit" disabled={selBusy || !draft.trim()}>
                      <i className="fa-solid fa-paper-plane" />
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
            <h3 className="db-card-title"><i className="fa-solid fa-wave-square" /> Activity</h3>
            <button className="btn-mini" onClick={refreshActions} title="Refresh"><i className="fa-solid fa-rotate-right" /></button>
          </div>
          {actions.length === 0 && <p className="no-entries">No agent activity yet.</p>}
          <div className="cmd-feed-list">
            {actions.map((a) => {
              const agent = getAgent(a.tier);
              const isErr = a.status === "error";
              return (
                <div key={a.id} className="cmd-feed-item">
                  <span className="cmd-feed-dot" style={{ background: agent?.color || "var(--text-muted)" }} />
                  <div className="cmd-feed-body">
                    <div className="cmd-feed-title" style={isErr ? { color: "var(--red)" } : undefined}>{describeAction(a)}</div>
                    <div className="cmd-feed-meta">{agent?.name || a.tier} · {actionTime(a.created_at)}</div>
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
          <div className="cmd-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-viewer-head">
              <h3 className="db-card-title"><i className="fa-solid fa-file-lines" /> {viewerDoc.title || viewerDoc.slug || "Document"}</h3>
              <div className="cmd-viewer-actions">
                <button className="btn-mini" title="View as PDF" onClick={() => { openAsPdf(viewerDoc.title || viewerDoc.slug, viewerDoc.body); setViewerDoc(null); }}>
                  <i className="fa-solid fa-file-pdf" />
                </button>
                <button className="btn-mini" title="Copy markdown" onClick={() => navigator.clipboard?.writeText(viewerDoc.body || "").then(() => addToast("Copied.", "success")).catch(() => {})}>
                  <i className="fa-solid fa-copy" />
                </button>
                {viewerDoc.slug && <a className="btn-mini" href="/admin/brain" title="Open in Brain"><i className="fa-solid fa-diagram-project" /></a>}
                <button className="btn-mini" onClick={() => setViewerDoc(null)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
              </div>
            </div>
            <div className="cmd-viewer-body chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(viewerDoc.body || "*(empty document)*") }} />
          </div>
        </div>
      )}

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
        <div className="cmd-prof-h"><i className="fa-solid fa-plug" /> Connector</div>
        <div className="cmd-prof-rows">
          <div className="cmd-prof-row"><span>Model</span><b>{conn.modelLabel}</b></div>
          <div className="cmd-prof-row"><span>Transport</span><b>{conn.transport}</b></div>
        </div>
        <p className="cmd-prof-note">{conn.note}</p>
      </div>

      <div className="cmd-prof-block">
        <div className="cmd-prof-h"><i className="fa-solid fa-diagram-project" /> Protocol</div>
        <div className="cmd-prof-rows">
          {protocol.map((f) => (
            <div key={f.label} className="cmd-prof-row"><span>{f.label}</span><b>{f.value}</b></div>
          ))}
        </div>
      </div>

      <div className="cmd-prof-block">
        <div className="cmd-prof-h">
          <i className="fa-solid fa-toolbox" /> Tools <span className="cmd-prof-count">{tools.length}</span>
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
          <i className="fa-solid fa-file-lines" /> Documents <span className="cmd-prof-count">{docs.length}</span>
        </div>
        {docs.length === 0 ? (
          <p className="cmd-prof-note">Nothing filed into the Brain yet.</p>
        ) : (
          <div className="cmd-doc-list">
            {docs.map((d) => (
              <button key={d.id || d.slug} type="button" className="cmd-doc" title={`Open “${d.title || d.slug}”`} onClick={() => onOpenDoc(d)}>
                <span className="cmd-doc-title"><i className="fa-solid fa-note-sticky" /> {d.title || d.slug}</span>
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

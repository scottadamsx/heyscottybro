import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, getAgent } from "../../agents/registry";
import { runAgent } from "../../agents/runAgent";
import { runOverseer } from "../../agents/overseer";
import { resolveTools, agentConnector, agentProtocol, modelLabel } from "../../agents/agentProfile";
import { getAuthHeaders } from "../../utils/supabase";
import { loadAgentActions } from "../../api/plannerApi";
import { loadBrain } from "../../api/brainApi";
import { describeAction, actionTime } from "../../utils/agentActions";
import { renderMarkdown } from "../../utils/markdown";
import { useToast } from "../../contexts/ToastContext";
import { toDateStr } from "../../utils/plannerUtils";
import "./command.css";

const todayStr = () => toDateStr(new Date());

export default function CommandCenterPage() {
  const { addToast } = useToast();
  const [actions, setActions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("work");     // "work" | "profile"
  const [nodes, setNodes] = useState([]);        // brain nodes, for per-agent documents
  // Everything below is keyed BY AGENT ID so each chat is fully independent —
  // its own running state, status line, draft message and thread. One agent
  // working never blocks another, and a draft only shows in its own chat.
  const [threads, setThreads] = useState({}); // id -> { convo:[], display:[] }
  const [busy, setBusy] = useState({});        // id -> true while running
  const [statuses, setStatuses] = useState({}); // id -> live status line
  const [inputs, setInputs] = useState({});     // id -> draft message
  const [viewerDoc, setViewerDoc] = useState(null); // { title, body, slug? } open in the markdown viewer
  const scrollRef = useRef(null);

  const selected = selectedId ? getAgent(selectedId) : null;
  const thread = (selectedId && threads[selectedId]) || { convo: [], display: [] };
  const draft = (selectedId && inputs[selectedId]) || "";
  const selBusy = selectedId ? !!busy[selectedId] : false;
  const selStatus = (selectedId && statuses[selectedId]) || "";

  const refreshActions = () => loadAgentActions(60).then(setActions).catch(() => {});
  useEffect(() => { refreshActions(); }, []);
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

  const pushDisplay = (id, msg) =>
    setThreads((prev) => {
      const cur = prev[id] || { convo: [], display: [] };
      return { ...prev, [id]: { ...cur, display: [...cur.display, msg] } };
    });
  const setBusyFor = (id, v) => setBusy((b) => ({ ...b, [id]: v }));
  const setStatusFor = (id, s) => setStatuses((p) => ({ ...p, [id]: s }));
  const setInputFor = (id, v) => setInputs((p) => ({ ...p, [id]: v }));

  const sendTo = async (agent, text) => {
    if (!text.trim() || busy[agent.id]) return;
    setBusyFor(agent.id, true);
    const cur = threads[agent.id] || { convo: [], display: [] };
    const convo = [...cur.convo, { role: "user", content: text }];
    setThreads((prev) => ({ ...prev, [agent.id]: { convo, display: [...cur.display, { role: "user", text }] } }));
    setInputFor(agent.id, "");
    try {
      const authHeaders = await getAuthHeaders();
      const { text: reply, history } = await runAgent({
        agent, messages: convo, authHeaders,
        onStatus: (s) => setStatusFor(agent.id, s),
      });
      setThreads((prev) => {
        const t = prev[agent.id] || { convo: [], display: [] };
        return { ...prev, [agent.id]: { convo: history, display: [...t.display, { role: "assistant", text: reply }] } };
      });
      refreshActions();
    } catch (e) {
      pushDisplay(agent.id, { role: "error", text: e.message || "Something went wrong." });
    } finally {
      setBusyFor(agent.id, false);
      setStatusFor(agent.id, "");
    }
  };

  const runOverseerNow = async () => {
    const id = "galadriel";
    if (busy[id]) return;
    setSelectedId(id);
    setBusyFor(id, true);
    pushDisplay(id, { role: "user", text: "Run today's summary and file it into the Brain." });
    try {
      const authHeaders = await getAuthHeaders();
      const { text } = await runOverseer({ authHeaders, onStatus: (s) => setStatusFor(id, s) });
      pushDisplay(id, { role: "assistant", text });
      addToast("Galadriel filed today's summary into the Brain.", "success");
      refreshActions();
    } catch (e) {
      pushDisplay(id, { role: "error", text: e.message || "Run failed." });
      addToast("Overseer run failed.", "error");
    } finally {
      setBusyFor(id, false);
      setStatusFor(id, "");
    }
  };

  return (
    <div className="module-page cmd-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-satellite-dish" /> Command Center</h1>
        <button className="btn btn-sm" onClick={runOverseerNow} disabled={!!busy.galadriel}>
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
          const offline = a.kind === "local";
          const isBusy = !!busy[a.id];
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
              <div className="cmd-card-tagline">{a.tagline}</div>
              <div className="cmd-card-meta">
                <span><i className="fa-solid fa-microchip" /> {modelLabel(a.model)}</span>
                {a.kind !== "local" && <span><i className="fa-solid fa-toolbox" /> {resolveTools(a).length} tools</span>}
              </div>
              <div className="cmd-card-foot">
                <span className={`cmd-badge ${a.kind}`}>{a.kind === "local" ? "Max plan" : "API"}</span>
                <span className="cmd-card-count">{isBusy ? "working…" : todayCounts[a.id] ? `${todayCounts[a.id]} today` : "—"}</span>
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

              {view === "profile" && <AgentProfile agent={selected} docs={selectedDocs} onOpenDoc={setViewerDoc} />}

              {view === "work" && selected.kind === "local" && (
                <div className="cmd-local">
                  <p className="cmd-offline-note">
                    <i className="fa-solid fa-plug-circle-xmark" /> The coding agent needs the local agent server (Phase 2).
                    Once it ships: run <code>npm run agents</code> on your Mac, log into Claude Code (Max plan),
                    and {selected.name} will appear online here to write code while you chat.
                  </p>
                </div>
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

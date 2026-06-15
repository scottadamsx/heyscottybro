import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, getAgent } from "../../agents/registry";
import { runAgent } from "../../agents/runAgent";
import { runOverseer } from "../../agents/overseer";
import { getAuthHeaders } from "../../utils/supabase";
import { loadAgentActions } from "../../api/plannerApi";
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
  // Everything below is keyed BY AGENT ID so each chat is fully independent —
  // its own running state, status line, draft message and thread. One agent
  // working never blocks another, and a draft only shows in its own chat.
  const [threads, setThreads] = useState({}); // id -> { convo:[], display:[] }
  const [busy, setBusy] = useState({});        // id -> true while running
  const [statuses, setStatuses] = useState({}); // id -> live status line
  const [inputs, setInputs] = useState({});     // id -> draft message
  const scrollRef = useRef(null);

  const selected = selectedId ? getAgent(selectedId) : null;
  const thread = (selectedId && threads[selectedId]) || { convo: [], display: [] };
  const draft = (selectedId && inputs[selectedId]) || "";
  const selBusy = selectedId ? !!busy[selectedId] : false;
  const selStatus = (selectedId && statuses[selectedId]) || "";

  const refreshActions = () => loadAgentActions(60).then(setActions).catch(() => {});
  useEffect(() => { refreshActions(); }, []);
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
          {!selected && <p className="no-entries">Pick an agent above to start working with it.</p>}

          {selected && selected.kind === "local" && (
            <div className="cmd-local">
              <h3 className="db-card-title"><i className={`fa-solid ${selected.icon}`} /> {selected.name} · {selected.title}</h3>
              <p className="cmd-offline-note">
                <i className="fa-solid fa-plug-circle-xmark" /> The coding agent needs the local agent server (Phase 2).
                Once it ships: run <code>npm run agents</code> on your Mac, log into Claude Code (Max plan),
                and {selected.name} will appear online here to write code while you chat.
              </p>
            </div>
          )}

          {selected && selected.kind === "api" && (
            <>
              <div className="cmd-chat-head">
                <span className="cmd-avatar sm" style={{ background: selected.color }}><i className={`fa-solid ${selected.icon}`} /></span>
                <div>
                  <div className="cmd-card-name">{selected.name}</div>
                  <div className="cmd-card-title">{selected.title} · <span className="cmd-model">{selected.model}</span></div>
                </div>
                {selBusy && <span className="cmd-chip-working"><i className="fa-solid fa-spinner fa-spin" /> working</span>}
              </div>

              <div className="cmd-thread" ref={scrollRef}>
                {thread.display.length === 0 && (
                  <p className="no-entries">Say hello, or give {selected.name} a task.</p>
                )}
                {thread.display.map((m, i) => (
                  <div key={i} className={`cmd-msg ${m.role}`}>
                    {m.role === "assistant"
                      ? <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                      : <span>{m.text}</span>}
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
    </div>
  );
}

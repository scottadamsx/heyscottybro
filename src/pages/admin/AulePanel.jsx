import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../../utils/markdown";
import { useAgentRuntime } from "../../contexts/AgentRuntimeContext";

const repoName = (p) => (p || "").split("/").filter(Boolean).pop();

/**
 * View for the local Aulë agent-server (`npm run agents`). The actual WebSocket
 * connection and conversation live in AgentRuntimeProvider, so they survive
 * navigation — this component only renders that state and forwards actions.
 * Real Claude Code (Max plan) writes code; we stream his messages/tools/results.
 */
export default function AulePanel({ agent, onOpenDoc }) {
  const { aule, auleConnect, auleTurnOn, aulePickRepo, auleSend, auleInterrupt } = useAgentRuntime();
  const { configured, status, repos, cwd, thread, busy, statusLine, starting } = aule;

  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [thread, statusLine]);

  const send = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || status !== "online") return;
    auleSend(text);
    setInput("");
  };

  if (!configured || status === "offline") {
    return (
      <div className="cmd-local">
        <p className="cmd-offline-note">
          <i className="fa-solid fa-plug-circle-xmark" /> {agent.name} is offline.
          {" "}Make sure Claude Code is logged in (Max), and that <code>AULE_TOKEN</code> /
          {" "}<code>VITE_AULE_TOKEN</code> / <code>VITE_AULE_URL</code> are set in <code>.env</code>.
          {" "}Then turn him on below — or run <code>npm run agents</code> yourself.
        </p>
        <div className="aule-actions">
          <button className="btn btn-sm" onClick={auleTurnOn} disabled={starting}>
            <i className={`fa-solid ${starting ? "fa-spinner fa-spin" : "fa-power-off"}`} /> {starting ? "Starting Aulë…" : "Turn on Aulë"}
          </button>
          <button className="btn btn-sm btn-secondary-sm" onClick={auleConnect} disabled={starting}>
            <i className="fa-solid fa-rotate-right" /> Reconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="aule">
      <div className="aule-bar">
        <span className={`aule-dot ${status}`} />
        <span className="aule-state">{status === "online" ? "online" : "connecting…"}</span>
        {repos.length > 0 && (
          <select className="aule-repo" value={cwd} onChange={(e) => aulePickRepo(e.target.value)} disabled={busy}>
            {repos.map((r) => <option key={r} value={r}>{repoName(r)}</option>)}
          </select>
        )}
        {busy && <button className="btn-mini" onClick={auleInterrupt} title="Interrupt"><i className="fa-solid fa-stop" /> Stop</button>}
      </div>

      <div className="cmd-thread" ref={scrollRef}>
        {thread.length === 0 && <p className="no-entries">Tell {agent.name} what to build in <strong>{repoName(cwd) || "your repo"}</strong>.</p>}
        {thread.map((m, i) => {
          if (m.role === "tool") {
            return <div key={i} className="aule-tool"><i className="fa-solid fa-wrench" /> {m.name}{m.input?.command ? `: ${String(m.input.command).slice(0, 80)}` : m.input?.file_path ? `: ${m.input.file_path}` : ""}</div>;
          }
          if (m.role === "result") {
            return (
              <div key={i} className={`cmd-msg ${m.isError ? "error" : "assistant"}`}>
                <button type="button" className="cmd-msg-expand" title="Open in viewer" onClick={() => onOpenDoc?.({ title: `${agent.name} · result`, body: m.text || "" })}><i className="fa-solid fa-up-right-and-down-left-from-center" /></button>
                <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text || "_(done)_") }} />
                {typeof m.cost === "number" && <div className="aule-cost">Max plan · ~${m.cost.toFixed(3)} equivalent</div>}
              </div>
            );
          }
          return (
            <div key={i} className={`cmd-msg ${m.role}`}>
              {m.role === "assistant"
                ? <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                : <span>{m.text}</span>}
            </div>
          );
        })}
        {busy && statusLine && <div className="cmd-status-line"><i className="fa-solid fa-spinner fa-spin" /> {statusLine}</div>}
      </div>

      <form className="cmd-input-row" onSubmit={send}>
        <input
          placeholder={busy ? `${agent.name} is coding…` : `Tell ${agent.name} what to build…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || status !== "online"}
        />
        <button className="btn btn-sm" type="submit" disabled={busy || status !== "online" || !input.trim()}>
          <i className="fa-solid fa-paper-plane" />
        </button>
      </form>
    </div>
  );
}

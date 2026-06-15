import { useCallback, useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../../utils/markdown";

const AULE_URL = import.meta.env.VITE_AULE_URL;
const AULE_TOKEN = import.meta.env.VITE_AULE_TOKEN;
const repoName = (p) => (p || "").split("/").filter(Boolean).pop();

/**
 * Live bridge to the local Aulë agent-server (`npm run agents`). Connects over
 * WebSocket, lets you pick a repo and chat while real Claude Code (Max plan)
 * writes code; streams his messages, tool calls and results.
 */
export default function AulePanel({ agent, onOpenDoc }) {
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const [repos, setRepos] = useState([]);
  const [cwd, setCwd] = useState("");
  const [thread, setThread] = useState([]); // { role, text|name, input?, cost? }
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const cwdRef = useRef("");

  const configured = Boolean(AULE_URL && AULE_TOKEN);

  const push = (m) => setThread((t) => [...t, m]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [thread, statusLine]);

  const connect = useCallback(() => {
    if (!configured) { setStatus("offline"); return; }
    setStatus("connecting");
    let ws;
    try { ws = new WebSocket(`${AULE_URL}?token=${encodeURIComponent(AULE_TOKEN)}`); }
    catch { setStatus("offline"); return; }
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.type) {
        case "ready": {
          setStatus("online");
          setRepos(m.repos || []);
          // Prefer this app's repo if present.
          const pick = (m.repos || []).find((r) => repoName(r) === "heyscottybro") || (m.repos || [])[0] || "";
          if (pick) { setCwd(pick); cwdRef.current = pick; ws.send(JSON.stringify({ type: "start", cwd: pick })); }
          break;
        }
        case "started": setStatusLine(`Working in ${repoName(m.cwd)}`); break;
        case "status": setStatusLine(m.text); break;
        case "turn_start": setBusy(true); break;
        case "turn_end": setBusy(false); setStatusLine(""); break;
        case "assistant": push({ role: "assistant", text: m.text }); break;
        case "tool": push({ role: "tool", name: m.name, input: m.input }); break;
        case "result": push({ role: "result", text: m.text, cost: m.cost, isError: m.isError }); break;
        case "error": push({ role: "error", text: m.text }); setBusy(false); break;
        default: break;
      }
    };
    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");
  }, [configured]);

  useEffect(() => {
    connect();
    return () => { try { wsRef.current?.close(); } catch { /* noop */ } };
  }, [connect]);

  const pickRepo = (p) => {
    setCwd(p); cwdRef.current = p;
    setThread([]);
    wsRef.current?.send(JSON.stringify({ type: "start", cwd: p }));
  };

  const send = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || status !== "online") return;
    push({ role: "user", text });
    setInput("");
    wsRef.current?.send(JSON.stringify({ type: "input", text }));
  };

  if (!configured || status === "offline") {
    return (
      <div className="cmd-local">
        <p className="cmd-offline-note">
          <i className="fa-solid fa-plug-circle-xmark" /> {agent.name} is offline.
          {" "}Run <code>npm run agents</code> on your Mac (logged into Claude Code / Max), set
          {" "}<code>VITE_AULE_URL</code> + <code>VITE_AULE_TOKEN</code> in <code>.env</code>, then reconnect.
        </p>
        {configured && <button className="btn btn-sm" onClick={connect}><i className="fa-solid fa-rotate-right" /> Reconnect</button>}
      </div>
    );
  }

  return (
    <div className="aule">
      <div className="aule-bar">
        <span className={`aule-dot ${status}`} />
        <span className="aule-state">{status === "online" ? "online" : "connecting…"}</span>
        {repos.length > 0 && (
          <select className="aule-repo" value={cwd} onChange={(e) => pickRepo(e.target.value)} disabled={busy}>
            {repos.map((r) => <option key={r} value={r}>{repoName(r)}</option>)}
          </select>
        )}
        {busy && <button className="btn-mini" onClick={() => wsRef.current?.send(JSON.stringify({ type: "interrupt" }))} title="Interrupt"><i className="fa-solid fa-stop" /> Stop</button>}
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

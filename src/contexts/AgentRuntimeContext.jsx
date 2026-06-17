import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { runAgent } from "../agents/runAgent";
import { runOverseer as runOverseerAgent } from "../agents/overseer";
import { getAuthHeaders } from "../utils/supabase";
import { loadAgentActions } from "../api/plannerApi";
import { loadAgentSessions, saveAgentSession } from "../api/agentSessionsApi";
import { useToast } from "./ToastContext";

/**
 * App-level agent runtime. This lives ABOVE the router (mounted once around the
 * /admin area) so agents keep working when you navigate off the Command Center.
 *
 * Previously every agent ran inside CommandCenterPage's component state and the
 * Aulë WebSocket lived in AulePanel's effect — so leaving the page unmounted
 * them, killing the socket and orphaning in-flight API runs. Hoisting the
 * runtime here means a run (or a live Claude Code session) survives navigation;
 * the page is now just a view onto this state.
 */

const AULE_URL = import.meta.env.VITE_AULE_URL;
const AULE_TOKEN = import.meta.env.VITE_AULE_TOKEN;
const repoName = (p) => (p || "").split("/").filter(Boolean).pop();

const AgentRuntimeContext = createContext(null);

export function useAgentRuntime() {
  const ctx = useContext(AgentRuntimeContext);
  if (!ctx) throw new Error("useAgentRuntime must be used inside AgentRuntimeProvider");
  return ctx;
}

export function AgentRuntimeProvider({ children }) {
  const { addToast } = useToast();

  // ---- Shared selection (persists across navigation) ----
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("work"); // "work" | "profile"

  // ---- API agents: everything keyed BY AGENT ID so each chat is independent ----
  const [threads, setThreads] = useState({}); // id -> { convo:[], display:[] }
  const [busy, setBusy] = useState({});        // id -> true while running
  const [statuses, setStatuses] = useState({}); // id -> live status line
  const [inputs, setInputs] = useState({});     // id -> draft message
  const [actions, setActions] = useState([]);   // recent agent_actions feed

  // Refs so the run callbacks can read the latest state without being
  // re-created on every keystroke (and without stale-closure bugs).
  const threadsRef = useRef(threads); threadsRef.current = threads;
  const busyRef = useRef(busy); busyRef.current = busy;

  const refreshActions = useCallback(
    () => loadAgentActions(60).then(setActions).catch(() => {}),
    []
  );
  useEffect(() => { refreshActions(); }, [refreshActions]);
  // Restore saved conversations so they survive a refresh.
  useEffect(() => {
    loadAgentSessions()
      .then((s) => { if (s && Object.keys(s).length) setThreads((prev) => ({ ...s, ...prev })); })
      .catch(() => {});
  }, []);

  const pushDisplay = useCallback((id, msg) =>
    setThreads((prev) => {
      const cur = prev[id] || { convo: [], display: [] };
      return { ...prev, [id]: { ...cur, display: [...cur.display, msg] } };
    }), []);
  const setBusyFor = useCallback((id, v) => setBusy((b) => ({ ...b, [id]: v })), []);
  const setStatusFor = useCallback((id, s) => setStatuses((p) => ({ ...p, [id]: s })), []);
  const setInputFor = useCallback((id, v) => setInputs((p) => ({ ...p, [id]: v })), []);

  // attachments: [{ media_type, data }] — base64 images for vision-capable agents.
  const sendTo = useCallback(async (agent, text, attachments = []) => {
    const trimmed = (text || "").trim();
    if ((!trimmed && attachments.length === 0) || busyRef.current[agent.id]) return;
    setBusyFor(agent.id, true);
    const cur = threadsRef.current[agent.id] || { convo: [], display: [] };
    // With image attachments the user turn becomes a content array (vision),
    // exactly like Frodo's chat (useAIAgent); plain text stays a string.
    const userContent = attachments.length
      ? [
          ...attachments.map((a) => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
          { type: "text", text: trimmed || "Here's an image — take a look." },
        ]
      : trimmed;
    const convo = [...cur.convo, { role: "user", content: userContent }];
    const images = attachments.map((a) => `data:${a.media_type};base64,${a.data}`);
    setThreads((prev) => {
      const t = prev[agent.id] || { convo: [], display: [] };
      return { ...prev, [agent.id]: { convo, display: [...t.display, { role: "user", text: trimmed, images }] } };
    });
    setInputFor(agent.id, "");
    try {
      const authHeaders = await getAuthHeaders();
      const { text: reply, history } = await runAgent({
        agent, messages: convo, authHeaders,
        onStatus: (s) => setStatusFor(agent.id, s),
      });
      let saved;
      setThreads((prev) => {
        const t = prev[agent.id] || { convo: [], display: [] };
        saved = { convo: history, display: [...t.display, { role: "assistant", text: reply }] };
        return { ...prev, [agent.id]: saved };
      });
      if (saved) saveAgentSession(agent.id, saved);
      refreshActions();
    } catch (e) {
      pushDisplay(agent.id, { role: "error", text: e.message || "Something went wrong." });
    } finally {
      setBusyFor(agent.id, false);
      setStatusFor(agent.id, "");
    }
  }, [setBusyFor, setInputFor, setStatusFor, pushDisplay, refreshActions]);

  const runOverseer = useCallback(async () => {
    const id = "galadriel";
    if (busyRef.current[id]) return;
    setSelectedId(id);
    setBusyFor(id, true);
    pushDisplay(id, { role: "user", text: "Run today's summary and file it into the Brain." });
    try {
      const authHeaders = await getAuthHeaders();
      const { text } = await runOverseerAgent({ authHeaders, onStatus: (s) => setStatusFor(id, s) });
      pushDisplay(id, { role: "assistant", text });
      setThreads((prev) => { if (prev[id]) saveAgentSession(id, prev[id]); return prev; });
      addToast("Galadriel filed today's summary into the Brain.", "success");
      refreshActions();
    } catch (e) {
      pushDisplay(id, { role: "error", text: e.message || "Run failed." });
      addToast("Overseer run failed.", "error");
    } finally {
      setBusyFor(id, false);
      setStatusFor(id, "");
    }
  }, [addToast, pushDisplay, setBusyFor, setStatusFor, refreshActions]);

  // ---- Local agent (Aulë): the live Claude Code WebSocket lives HERE now ----
  const auleConfigured = Boolean(AULE_URL && AULE_TOKEN);
  const [auleStatus, setAuleStatus] = useState(auleConfigured ? "connecting" : "offline");
  const [auleRepos, setAuleRepos] = useState([]);
  const [auleCwd, setAuleCwd] = useState("");
  const [auleThread, setAuleThread] = useState([]);
  const [auleBusy, setAuleBusy] = useState(false);
  const [auleStatusLine, setAuleStatusLine] = useState("");
  const [auleStarting, setAuleStarting] = useState(false);
  const wsRef = useRef(null);
  const auleCwdRef = useRef("");

  const aulePush = useCallback((m) => setAuleThread((t) => [...t, m]), []);

  const auleConnect = useCallback(() => {
    if (!auleConfigured) { setAuleStatus("offline"); return; }
    // Don't open a second socket if one is already open/connecting.
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
    setAuleStatus("connecting");
    let ws;
    try { ws = new WebSocket(`${AULE_URL}?token=${encodeURIComponent(AULE_TOKEN)}`); }
    catch { setAuleStatus("offline"); return; }
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.type) {
        case "ready": {
          setAuleStatus("online");
          setAuleRepos(m.repos || []);
          const pick = (m.repos || []).find((r) => repoName(r) === "heyscottybro") || (m.repos || [])[0] || "";
          if (pick) { setAuleCwd(pick); auleCwdRef.current = pick; ws.send(JSON.stringify({ type: "start", cwd: pick })); }
          break;
        }
        case "started": setAuleStatusLine(`Working in ${repoName(m.cwd)}`); break;
        case "status": setAuleStatusLine(m.text); break;
        case "turn_start": setAuleBusy(true); break;
        case "turn_end": setAuleBusy(false); setAuleStatusLine(""); break;
        case "assistant": aulePush({ role: "assistant", text: m.text }); break;
        case "tool": aulePush({ role: "tool", name: m.name, input: m.input }); break;
        case "result": aulePush({ role: "result", text: m.text, cost: m.cost, isError: m.isError }); break;
        case "error": aulePush({ role: "error", text: m.text }); setAuleBusy(false); break;
        default: break;
      }
    };
    ws.onclose = () => setAuleStatus("offline");
    ws.onerror = () => setAuleStatus("offline");
  }, [auleConfigured, aulePush]);

  // Connect once for the life of the admin area; close only when leaving /admin.
  useEffect(() => {
    auleConnect();
    return () => { try { wsRef.current?.close(); } catch { /* noop */ } };
  }, [auleConnect]);

  // Dev-only: ask the Vite server to spawn `npm run agents`, then reconnect.
  const auleTurnOn = useCallback(async () => {
    setAuleStarting(true);
    try {
      const r = await fetch("/api/aule-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      await r.json().catch(() => ({}));
    } catch { /* not in dev / no endpoint */ }
    setTimeout(() => { auleConnect(); setAuleStarting(false); }, 2500);
  }, [auleConnect]);

  const aulePickRepo = useCallback((p) => {
    setAuleCwd(p); auleCwdRef.current = p;
    setAuleThread([]);
    wsRef.current?.send(JSON.stringify({ type: "start", cwd: p }));
  }, []);

  const auleSend = useCallback((text) => {
    const t = (text || "").trim();
    if (!t) return;
    aulePush({ role: "user", text: t });
    wsRef.current?.send(JSON.stringify({ type: "input", text: t }));
  }, [aulePush]);

  const auleInterrupt = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
  }, []);

  // What Aulë's card should show as its "recent" line (computed here so the
  // Command Center card stays live even while his panel isn't on screen).
  const auleRecent = useMemo(() => {
    const last = auleThread[auleThread.length - 1];
    if (auleBusy && auleStatusLine) return auleStatusLine;
    if (!last) return "";
    if (last.role === "tool") return last.name + (last.input?.file_path ? `: ${repoName(last.input.file_path)}` : "");
    if (last.role === "assistant") return (last.text || "").replace(/\s+/g, " ").trim().slice(0, 90);
    if (last.role === "result") return last.isError ? "hit an error" : "finished a task";
    if (last.role === "user") return "you: " + (last.text || "").replace(/\s+/g, " ").trim().slice(0, 70);
    if (last.role === "error") return "hit an error";
    return "";
  }, [auleThread, auleBusy, auleStatusLine]);

  const value = useMemo(() => ({
    // shared selection
    selectedId, setSelectedId, view, setView,
    // API agents
    threads, busy, statuses, inputs,
    setInputFor, sendTo, runOverseer, actions, refreshActions,
    // local agent (Aulë)
    aule: {
      configured: auleConfigured,
      status: auleStatus, repos: auleRepos, cwd: auleCwd, thread: auleThread,
      busy: auleBusy, statusLine: auleStatusLine, starting: auleStarting, recent: auleRecent,
    },
    auleConnect, auleTurnOn, aulePickRepo, auleSend, auleInterrupt,
  }), [
    selectedId, view, threads, busy, statuses, inputs, setInputFor, sendTo, runOverseer,
    actions, refreshActions, auleConfigured, auleStatus, auleRepos, auleCwd, auleThread,
    auleBusy, auleStatusLine, auleStarting, auleRecent, auleConnect, auleTurnOn,
    aulePickRepo, auleSend, auleInterrupt,
  ]);

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

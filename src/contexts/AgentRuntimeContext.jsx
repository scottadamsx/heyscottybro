import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
// The agent code (loop, tools, Library, prompts) is large and only needed once an agent runs,
// so it loads on first use instead of with every admin page.
import { lazyImport } from "../lib/lazyImport";
import { getAuthHeaders } from "../utils/supabase";
import { loadAgentActions } from "../api/plannerApi";
import { loadAgentSessions, saveAgentSession, clearAgentSession, ccSessionKey, listAgentSessionIds } from "../api/agentSessionsApi";
import { useToast } from "./ToastContext";
import {
  commitRuntimeThreadSnapshot,
  commandCenterThreadsFromSessions,
  createAgentRuntimeMutationGate,
  createAgentRuntimeSessionGate,
  persistRuntimeCheckpoint,
} from "../utils/agentRuntimeSessionPolicy";
import { closePendingTurnForPersistence } from "../utils/chatSessionPolicy";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";

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
  const [clearingThreads, setClearingThreads] = useState({}); // id -> true while durable Clear runs
  const [statuses, setStatuses] = useState({}); // id -> live status line
  const [inputs, setInputs] = useState({});     // id -> draft message
  const [sessionSaveErrors, setSessionSaveErrors] = useState({}); // id -> retryable persistence warning
  const [actions, setActions] = useState([]);   // recent agent_actions feed

  // Refs so the run callbacks can read the latest state without being
  // re-created on every keystroke (and without stale-closure bugs).
  const threadsRef = useRef(threads);
  const busyRef = useRef(busy);
  const mutationGateRef = useRef(createAgentRuntimeMutationGate());
  const sessionGateRef = useRef(createAgentRuntimeSessionGate());
  const sessionLoadAttemptRef = useRef(0);

  const refreshActions = useCallback(
    () => loadAgentActions(60).then(setActions).catch(() => {}),
    []
  );
  // Restore saved conversations so they survive a refresh. Command Center
  // rows live under `${id}:cc` so they don't collide with the ChatBot's Frodo.
  // Mutations stay locked until this load succeeds, so restored state can
  // replace the empty runtime wholesale without racing a premature send.
  // Mission Control's agents need their history, the activity feed and the Aulë socket; nothing
  // else does, so they start when the Agents tab first mounts (activate), not on every page.
  const [active, setActive] = useState(false);
  const [sessionHistory, setSessionHistory] = useState({ status: "idle", error: "" });
  const activate = useCallback(() => setActive(true), []);
  useEffect(() => { if (active) refreshActions(); }, [active, refreshActions]);
  const retrySessionHistory = useCallback(async () => {
    const attempt = ++sessionLoadAttemptRef.current;
    sessionGateRef.current.begin();
    threadsRef.current = {};
    setThreads({});
    setSessionHistory({ status: "loading", error: "" });
    try {
      const ownerId = captureEstablishedOwnerId();
      const sessions = await loadAgentSessions(ownerId);
      if (attempt !== sessionLoadAttemptRef.current) return false;
      const restored = commandCenterThreadsFromSessions(sessions);
      threadsRef.current = restored;
      setThreads(restored);
      sessionGateRef.current.ready();
      setSessionHistory({ status: "ready", error: "" });
      return true;
    } catch (error) {
      if (attempt !== sessionLoadAttemptRef.current) return false;
      const message = error?.message || "Agent chat history failed to load.";
      console.error("[AgentRuntime] session load failed:", error);
      sessionGateRef.current.fail();
      setSessionHistory({ status: "failed", error: message });
      addToast(`Couldn't load agent chat history: ${message}`, "error");
      return false;
    }
  }, [addToast]);
  useEffect(() => {
    if (active && sessionHistory.status === "idle") retrySessionHistory();
  }, [active, retrySessionHistory, sessionHistory.status]);
  useEffect(() => () => { sessionLoadAttemptRef.current += 1; }, []);

  // What goes to Supabase: no base64. A screenshot is 1–3 MB of base64 and a
  // handful would blow the row up; the model already saw it, so the stored
  // turn keeps a placeholder. React state keeps the real thing for this session.
  const persistThread = useCallback((id, thread, ownerId = captureEstablishedOwnerId()) => {
    if (!sessionGateRef.current.canMutate()) {
      const message = "Agent history must load successfully before it can be saved.";
      setSessionSaveErrors((current) => ({ ...current, [id]: message }));
      addToast(message, "error");
      return false;
    }
    const convo = (thread.convo || []).map((m) => (Array.isArray(m.content)
      ? { ...m, content: m.content.map((b) => (b.type === "image" ? { type: "text", text: "[screenshot attached earlier]" } : b)) }
      : m));
    const display = (thread.display || []).map((m) => {
      if (!m.images?.length) return m;
      const { images, ...rest } = m;
      return { ...rest, shots: images.length };
    });
    return saveAgentSession(ccSessionKey(id), { convo, display }, ownerId)
      .then(() => {
        setSessionSaveErrors((current) => {
          if (!current[id]) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
        return true;
      })
      .catch((e) => {
        console.error(`[AgentRuntime] session save failed for ${id}:`, e);
        const message = e.message || `Chat history isn't saving for ${id}.`;
        setSessionSaveErrors((current) => ({ ...current, [id]: message }));
        addToast(message, "error");
        return false;
      });
  }, [addToast]);

  const commitThread = useCallback((id, { convo, displayMessage, persist = false, ownerId = null }) => (
    commitRuntimeThreadSnapshot({
      currentThreads: threadsRef.current,
      agentId: id,
      convo,
      displayMessage,
      publishThreads: (nextThreads) => {
        threadsRef.current = nextThreads;
        setThreads(nextThreads);
      },
      persistThread: persist ? ((agentId, thread) => persistThread(agentId, thread, ownerId)) : null,
    })
  ), [persistThread]);

  const setBusyFor = useCallback((id, v) => {
    const next = { ...busyRef.current, [id]: v };
    busyRef.current = next;
    setBusy(next);
  }, []);
  const setClearingFor = useCallback((id, v) => setClearingThreads((current) => ({ ...current, [id]: v })), []);
  const setStatusFor = useCallback((id, s) => setStatuses((p) => ({ ...p, [id]: s })), []);
  const setInputFor = useCallback((id, v) => {
    if (!mutationGateRef.current.canMutate(id)) return false;
    setInputs((p) => ({ ...p, [id]: v }));
    return true;
  }, []);

  // attachments: [{ media_type, data }] — base64 images for vision-capable agents.
  const sendTo = useCallback(async (agent, text, attachments = []) => {
    const trimmed = (text || "").trim();
    if ((!trimmed && attachments.length === 0) || busyRef.current[agent.id]) return false;
    if (!mutationGateRef.current.canMutate(agent.id)) {
      addToast(`${agent.name || agent.id}'s conversation is being cleared.`, "error");
      return false;
    }
    if (!sessionGateRef.current.canMutate()) {
      addToast("Wait for agent chat history to load, then try again.", "error");
      return false;
    }
    const ownerId = captureEstablishedOwnerId();
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
    const accepted = commitThread(agent.id, {
      convo,
      displayMessage: { role: "user", text: trimmed, images },
    });
    setInputFor(agent.id, "");
    // Last fully-completed tool exchange. If the run dies mid-loop AFTER tools
    // ran, this is what we keep so the next turn knows what already changed
    // (mirrors useAIAgent's `committed`).
    let committed = convo;
    try {
      await persistRuntimeCheckpoint({
        agentId: agent.id,
        thread: accepted.thread,
        history: committed,
        persistThread,
        ownerId,
      });
      const authHeaders = await getAuthHeaders(ownerId);
      const { runAgent } = await lazyImport(() => import("../agents/runAgent"), "the agent runner");
      const { text: reply, history } = await runAgent({
        agent, messages: convo, authHeaders, ownerId,
        resolveAuthHeaders: getAuthHeaders,
        onStatus: (s) => setStatusFor(agent.id, s),
        onCommit: async (h, checkpoint) => {
          committed = h;
          await persistRuntimeCheckpoint({
            agentId: agent.id,
            thread: threadsRef.current[agent.id] || accepted.thread,
            history: committed,
            persistThread,
            ownerId,
            note: "turn interrupted during agent tool work",
            phase: checkpoint?.phase || `Completed ${agent.name || agent.id} tool work`,
          });
        },
      });
      const { persistence } = commitThread(agent.id, {
        convo: history,
        displayMessage: { role: "assistant", text: reply },
        persist: true,
        ownerId,
      });
      await persistence;
      refreshActions();
    } catch (e) {
      const msg = e.message || "Something went wrong.";
      // Close with an assistant turn so roles still alternate on the next send.
      const partial = closePendingTurnForPersistence(committed, `turn interrupted: ${msg}`);
      const { persistence } = commitThread(agent.id, {
        convo: partial,
        displayMessage: { role: "error", text: msg },
        persist: true,
        ownerId,
      });
      await persistence;
      if (committed.length > convo.length) refreshActions();
    } finally {
      setBusyFor(agent.id, false);
      setStatusFor(agent.id, "");
    }
    return true;
  }, [addToast, commitThread, persistThread, setBusyFor, setInputFor, setStatusFor, refreshActions]);

  const retryThreadSave = useCallback(async (id) => {
    if (!sessionGateRef.current.canMutate()) return false;
    const thread = threadsRef.current[id];
    if (!thread) return false;
    const saved = await persistThread(id, thread, captureEstablishedOwnerId());
    if (saved) addToast("Agent chat history saved.", "success");
    return saved;
  }, [addToast, persistThread]);

  /** Wipe one agent's thread (state + the agent_sessions row). Throws on a
   *  storage failure so the caller can say so — never a silent no-op. */
  const clearThread = useCallback(async (id) => {
    if (!sessionGateRef.current.canMutate()) throw new Error("Agent chat history must load successfully before it can be cleared.");
    if (busyRef.current[id]) throw new Error(`${id} is still working — wait for it to finish.`);
    if (!mutationGateRef.current.beginClear(id)) throw new Error(`${id}'s conversation is already being cleared.`);
    setClearingFor(id, true);
    const ownerId = captureEstablishedOwnerId();
    try {
      await clearAgentSession(ccSessionKey(id), ownerId);
      const next = { ...threadsRef.current };
      delete next[id];
      threadsRef.current = next;
      setThreads(next);
    } finally {
      mutationGateRef.current.finishClear(id);
      setClearingFor(id, false);
    }
  }, [setClearingFor]);

  const prepareAllThreadClear = useCallback(async (agentIds, expectedOwnerId = captureEstablishedOwnerId()) => {
    const runtimeAgentIds = [...new Set((agentIds || []).filter(Boolean))];
    const busyIds = runtimeAgentIds.filter((id) => busyRef.current[id]);
    if (busyIds.length) throw new Error(`${busyIds.join(", ")} is still working — wait for every agent to finish.`);
    if (sessionHistory.status === "loading") throw new Error("Agent chat history is still loading — wait for it to finish.");

    const locked = [];
    for (const id of runtimeAgentIds) {
      if (!mutationGateRef.current.beginClear(id)) {
        locked.forEach((lockedId) => mutationGateRef.current.finishClear(lockedId));
        throw new Error(`${id}'s conversation is already being cleared.`);
      }
      locked.push(id);
    }
    setClearingThreads((current) => ({
      ...current,
      ...Object.fromEntries(runtimeAgentIds.map((id) => [id, true])),
    }));

    let ownerId;
    try {
      ownerId = expectedOwnerId;
      const storedIds = await listAgentSessionIds(ownerId);
      return {
        ownerId,
        runtimeAgentIds,
        // Frodo's floating chat owns its unsuffixed row and preserves an
        // authoritative empty snapshot to suppress legacy resurrection.
        sessionIds: storedIds.filter((id) => id !== "frodo"),
        previousSessionStatus: sessionHistory.status,
      };
    } catch (error) {
      runtimeAgentIds.forEach((id) => mutationGateRef.current.finishClear(id));
      setClearingThreads((current) => {
        const next = { ...current };
        runtimeAgentIds.forEach((id) => { delete next[id]; });
        return next;
      });
      throw error;
    }
  }, [sessionHistory.status]);

  const clearAllThreads = useCallback(async (preparation) => {
    const {
      ownerId,
      runtimeAgentIds = [],
      sessionIds = [],
      previousSessionStatus,
    } = preparation || {};
    if (!ownerId) throw new Error("The authenticated owner is unavailable for Command Center Clear.");

    try {
      const results = await Promise.allSettled(sessionIds.map((id) => clearAgentSession(id, ownerId)));
      const failures = results.flatMap((result, index) => (
        result.status === "rejected" ? [{ id: sessionIds[index], error: result.reason }] : []
      ));
      const failedIds = new Set(failures.map(({ id }) => id));
      const clearedRuntimeIds = runtimeAgentIds.filter((id) => !failedIds.has(ccSessionKey(id)));

      const nextThreads = { ...threadsRef.current };
      clearedRuntimeIds.forEach((id) => { delete nextThreads[id]; });
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      setInputs((current) => {
        const next = { ...current };
        clearedRuntimeIds.forEach((id) => { delete next[id]; });
        return next;
      });
      setStatuses((current) => {
        const next = { ...current };
        clearedRuntimeIds.forEach((id) => { delete next[id]; });
        return next;
      });
      setSessionSaveErrors((current) => {
        const next = { ...current };
        clearedRuntimeIds.forEach((id) => { delete next[id]; });
        return next;
      });

      if (failures.length) {
        const error = new Error(`Couldn't clear ${failures.length} saved Command Center thread${failures.length === 1 ? "" : "s"}.`);
        error.causes = failures.map(({ error: cause }) => cause);
        error.failedSessionIds = failures.map(({ id }) => id);
        throw error;
      }

      if (active) {
        sessionGateRef.current.ready();
        setSessionHistory({ status: "ready", error: "" });
      } else if (previousSessionStatus === "failed") {
        sessionGateRef.current.fail();
      }
      return { clearedSessionIds: sessionIds };
    } finally {
      runtimeAgentIds.forEach((id) => mutationGateRef.current.finishClear(id));
      setClearingThreads((current) => {
        const next = { ...current };
        runtimeAgentIds.forEach((id) => { delete next[id]; });
        return next;
      });
    }
  }, [active]);

  const runOverseer = useCallback(async () => {
    const id = "galadriel";
    if (!sessionGateRef.current.canMutate()) {
      addToast("Wait for agent chat history to load, then try again.", "error");
      return;
    }
    if (!mutationGateRef.current.canMutate(id)) {
      addToast("Galadriel's conversation is being cleared.", "error");
      return;
    }
    if (busyRef.current[id]) return;
    const ownerId = captureEstablishedOwnerId();
    setSelectedId(id);
    setBusyFor(id, true);
    const requestText = "Run yesterday's summary and file it into the Brain.";
    const requestHistory = [{ role: "user", content: requestText }];
    const accepted = commitThread(id, {
      convo: requestHistory,
      displayMessage: { role: "user", text: requestText },
    });
    let committed = requestHistory;
    try {
      await persistRuntimeCheckpoint({
        agentId: id,
        thread: accepted.thread,
        history: committed,
        persistThread,
        ownerId,
      });
      const authHeaders = await getAuthHeaders(ownerId);
      const { runOverseer: runOverseerAgent } = await lazyImport(() => import("../agents/overseer"), "the overseer");
      const checkpoint = async (history, note, phase = "Overseer durable checkpoint") => {
        committed = history;
        await persistRuntimeCheckpoint({
          agentId: id,
          thread: threadsRef.current[id] || accepted.thread,
          history,
          persistThread,
          ownerId,
          note,
          phase,
        });
      };
      const { text, history } = await runOverseerAgent({
        authHeaders,
        ownerId,
        resolveAuthHeaders: getAuthHeaders,
        onStatus: (s) => setStatusFor(id, s),
        onInput: (history) => checkpoint(history, "Overseer interrupted before a reply"),
        onCommit: (history, details) => checkpoint(
          history,
          "Overseer interrupted during tool work",
          details?.phase,
        ),
      });
      const { persistence } = commitThread(id, {
        convo: history,
        displayMessage: { role: "assistant", text },
        persist: true,
        ownerId,
      });
      const saved = await persistence;
      if (saved === true) addToast("Galadriel filed the daily summary into the Brain.", "success");
      else addToast("Galadriel finished, but her chat history didn't save. Retry the save in her thread.", "error");
      refreshActions();
    } catch (e) {
      const { persistence } = commitThread(id, {
        convo: closePendingTurnForPersistence(committed, `Overseer interrupted: ${e.message || "Run failed."}`),
        displayMessage: { role: "error", text: e.message || "Run failed." },
        persist: true,
        ownerId,
      });
      await persistence;
      addToast("Overseer run failed.", "error");
    } finally {
      setBusyFor(id, false);
      setStatusFor(id, "");
    }
  }, [addToast, commitThread, persistThread, setBusyFor, setStatusFor, refreshActions]);

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

  // Connect once Mission Control has opened; close only when leaving /admin.
  useEffect(() => {
    if (!active) return undefined;
    auleConnect();
    return () => { try { wsRef.current?.close(); } catch { /* noop */ } };
  }, [active, auleConnect]);

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
    threads, busy, clearingThreads, statuses, inputs, sessionSaveErrors,
    setInputFor, sendTo, clearThread, retryThreadSave, prepareAllThreadClear, clearAllThreads, runOverseer, actions, refreshActions, activate,
    sessionHistoryStatus: sessionHistory.status,
    sessionHistoryError: sessionHistory.error,
    sessionHistoryReady: sessionHistory.status === "ready",
    retrySessionHistory,
    // local agent (Aulë)
    aule: {
      configured: auleConfigured,
      status: auleStatus, repos: auleRepos, cwd: auleCwd, thread: auleThread,
      busy: auleBusy, statusLine: auleStatusLine, starting: auleStarting, recent: auleRecent,
    },
    auleConnect, auleTurnOn, aulePickRepo, auleSend, auleInterrupt,
  }), [
    selectedId, view, threads, busy, clearingThreads, statuses, inputs, sessionSaveErrors, setInputFor, sendTo, clearThread, retryThreadSave, prepareAllThreadClear, clearAllThreads, runOverseer,
    actions, refreshActions, activate, sessionHistory.status, sessionHistory.error, retrySessionHistory,
    auleConfigured, auleStatus, auleRepos, auleCwd, auleThread,
    auleBusy, auleStatusLine, auleStarting, auleRecent, auleConnect, auleTurnOn,
    aulePickRepo, auleSend, auleInterrupt,
  ]);

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

import { useState, useEffect, useRef, useCallback } from "react";
import { TOOLS, executeTool } from "../api/aiTools";
import {
  callClaude,
  executeToolBatchWithCheckpoints,
  trimHistory as trimHistoryCore,
  withCacheMarkers,
  ERROR_STREAK_LIMIT,
} from "../agents/loop";
import { TIERS, buildSystemPrompt, escalationToolFor } from "../api/aiTiers";
import { getAuthHeaders } from "../utils/supabase";
import { uid } from "../api/_base";
import { loadAgentSessions, saveAgentSession } from "../api/agentSessionsApi";
import { clearStagedScreenshots, removeStagedScreenshots, screenshotUrl } from "../api/bugsApi";
import {
  chatStagingPathsFromDisplay,
  hydrateDisplayAttachments,
  persistedAttachmentMetadata,
  serializeDisplayMessages,
  stagingPathsEvictedByDisplayLimit,
} from "../utils/chatAttachments";
import {
  clearSessionThenCleanupStaging,
  closePendingTurnForPersistence,
  createSessionHistoryGate,
  createSessionMutationGate,
  ownerBoundLegacyChatKey,
  persistSessionPhase,
  readOwnerBoundLegacyChat,
  saveSessionThenCleanupEvicted,
  selectDurableOrLegacyChat,
  shouldRemoveLegacyChat,
  suppressAndRemoveOwnerBoundLegacyChat,
  unownedLegacyChatWarning,
} from "../utils/chatSessionPolicy";
import { createPendingScreenshotContext, withCheckpointProgress } from "../api/pendingScreenshots";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";

const AGENT_ID = "frodo";

export const MAX_INPUT_CHARS = 4000;
const HISTORY_CHAR_BUDGET = 100000;
// What we PERSIST is smaller than what we send: a long-lived row shouldn't grow
// without bound, and old turns stop earning their keep.
const PERSIST_CHAR_BUDGET = 60000;

/* Catch-nets around each tier (see aiTiers.js for the explicit pass_to_* tools):
 * - transient API failures retry with backoff before counting as a real error
 * - ERROR_STREAK_LIMIT consecutive failed tool calls force a handoff upward
 * - each tier has a tool-turn budget; blowing it forces a handoff (or, at the
 *   top tier, a wrap-up instruction instead of an exception)
 * - history is committed before each tool and after every individual result,
 *   so even when a turn dies mid-batch the next message knows what is confirmed
 *   and which outcome is uncertain */

const trimHistory = (msgs) => trimHistoryCore(msgs, HISTORY_CHAR_BUDGET);

/**
 * Strip base64 image payloads before storing. A single screenshot is ~1–3 MB of
 * base64; persisting a few would blow past Postgres row limits and make every
 * load slow. The model already described the image in its reply, so the stored
 * turn keeps a placeholder that reads correctly in future context.
 */
function stripImages(msgs) {
  return msgs.map((m) => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map((b) =>
        b.type === "image" ? { type: "text", text: "[screenshot Scott attached earlier]" } : b),
    };
  });
}

export default function useAIAgent() {
  const [displayMsgs, setDisplayMsgs] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInputState] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState("");
  // `hydrating` gates sendMessage: sending before the load resolves would build
  // a turn on an empty history and then the save effect would overwrite the
  // stored one (the "Frodo forgot everything" race). `saveError` is surfaced
  // by ChatBot as an inline notice — persistence failures are never silent.
  const [hydrating, setHydrating] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [legacyWarning, setLegacyWarning] = useState("");
  const historyGate = useRef(createSessionHistoryGate());
  const mutationGate = useRef(createSessionMutationGate());
  const legacyPending = useRef(null);
  const activeOwner = useRef(null);
  const loadingRef = useRef(false);
  const loadAttempt = useRef(0);
  const saveTimerRef = useRef(null);
  const skipNextPersist = useRef(false);

  const setInput = useCallback((next) => {
    if (!mutationGate.current.canMutate()) return false;
    setInputState(next);
    return true;
  }, []);

  const retryHistoryLoad = useCallback(async () => {
      if (!mutationGate.current.canMutate()) return false;
      const attempt = ++loadAttempt.current;
      historyGate.current.begin();
      setHydrating(true);
      setHistoryError("");
      setAttachmentError("");
      setLegacyWarning(unownedLegacyChatWarning(localStorage));
      activeOwner.current = null;
      legacyPending.current = null;
      let legacy;
      let mine;
      let restored = null;
      let ownerId = null;
      try {
        ownerId = captureEstablishedOwnerId();
        await uid(ownerId);
        if (attempt !== loadAttempt.current) return false;
        activeOwner.current = ownerId;
        legacy = readOwnerBoundLegacyChat(localStorage, ownerId);
        legacyPending.current = legacy?.key || null;
        const sessions = await loadAgentSessions(ownerId);
        mine = sessions[AGENT_ID];
        // The presence of a durable row is authoritative even when both arrays
        // are empty. Frodo Clear writes that empty snapshot deliberately so a
        // leftover owner-attributed legacy backup can never resurrect itself.
        if (mine) {
          const hydratedDisplay = await hydrateDisplayAttachments(
            mine.display || [],
            (path) => screenshotUrl(path, 3600, ownerId),
          );
          restored = { displayMsgs: hydratedDisplay.display, apiHistory: mine.convo || [] };
          if (hydratedDisplay.errors.length && attempt === loadAttempt.current) {
            setAttachmentError(`${hydratedDisplay.errors.length} saved screenshot preview${hydratedDisplay.errors.length === 1 ? "" : "s"} couldn't be loaded.`);
          }
        }
      } catch (err) {
        console.error("[useAIAgent] history load failed:", err);
        if (attempt !== loadAttempt.current) return false;
        // Fail closed. A local legacy copy is considered only after a
        // successful durable read proves there is no authoritative row.
        // Otherwise a cleared-but-not-yet-cleaned backup could reappear during
        // a transient database failure.
        historyGate.current.fail();
        setHistoryError(err.message || "history load failed");
        setHydrating(false);
        return false;
      }

      if (attempt !== loadAttempt.current) return false;
      // Keep the legacy key until this exact state has completed a successful
      // Supabase save. A successful read is not a completed migration.
      if (!restored) restored = selectDurableOrLegacyChat(mine, legacy);

      if (restored) {
        setDisplayMsgs(restored.displayMsgs);
        setApiHistory(restored.apiHistory);
      } else {
        // A successful empty load is authoritative. Never leave an earlier
        // failed attempt or previous identity's in-memory rows on screen.
        setDisplayMsgs([]);
        setApiHistory([]);
      }
      historyGate.current.ready();
      setHistoryError("");
      setHydrating(false);
      return true;
  }, []);

  useEffect(() => {
    retryHistoryLoad();
    return () => { loadAttempt.current += 1; };
  }, [retryHistoryLoad]);

  const persistSession = useCallback(async (display, history, expectedOwnerId = activeOwner.current) => {
    const ownerId = expectedOwnerId;
    if (!ownerId || activeOwner.current !== ownerId) {
      setSaveError("The authenticated chat owner is unavailable; reload history before saving.");
      return false;
    }
    const displayRows = display || [];
    const snapshot = {
      display: serializeDisplayMessages(displayRows.slice(-200)),
      convo: trimHistoryCore(stripImages(history || []), PERSIST_CHAR_BUDGET),
    };
    const evictedStagingPaths = stagingPathsEvictedByDisplayLimit(displayRows, 200);
    try {
      const { cleanupError } = await saveSessionThenCleanupEvicted({
        save: (agentId, session) => saveAgentSession(agentId, session, ownerId),
        agentId: AGENT_ID,
        ...snapshot,
        removeEvicted: (paths) => removeStagedScreenshots(paths, ownerId),
        evictedPaths: evictedStagingPaths,
      });
      setSaveError("");
      if (shouldRemoveLegacyChat({ legacyPresent: Boolean(legacyPending.current), saveSucceeded: true })) {
        try {
          localStorage.removeItem(legacyPending.current);
          legacyPending.current = null;
        } catch (err) {
          // The remote snapshot is safe, but disclose that the fallback copy
          // could not be retired instead of silently pretending migration is complete.
          setSaveError(`Chat saved, but the legacy backup couldn't be removed: ${err.message || err}`);
        }
      }
      if (cleanupError) {
        console.error("[useAIAgent] evicted attachment cleanup failed:", cleanupError);
        setAttachmentError(`Chat history saved, but old screenshot cleanup failed: ${cleanupError.message || cleanupError}`);
      }
      return true;
    } catch (err) {
      console.error("[useAIAgent] history save failed:", err);
      setSaveError(err.message || "history save failed");
      return false;
    }
  }, []);

  // Persist after every settled change. Debounced so a burst of tool turns
  // writes once, and image-stripped/trimmed so the row stays small.
  useEffect(() => {
    if (!historyGate.current.canUse() || loading || clearing) return undefined;
    if (skipNextPersist.current) {
      // If React ever exposes the two clearing state updates in separate
      // renders, suppress both; consume the guard only once both are empty.
      if (displayMsgs.length === 0 && apiHistory.length === 0) skipNextPersist.current = false;
      return undefined;
    }
    const t = setTimeout(() => {
      saveTimerRef.current = null;
      persistSession(displayMsgs, apiHistory);
    }, 600);
    saveTimerRef.current = t;
    return () => {
      clearTimeout(t);
      if (saveTimerRef.current === t) saveTimerRef.current = null;
    };
  }, [displayMsgs, apiHistory, loading, clearing, persistSession]);

  const sendMessage = async (attachments = []) => {
    const text = input.trim();
    if ((!text && attachments.length === 0)
      || loadingRef.current
      || hydrating
      || !historyGate.current.canUse()
      || !mutationGate.current.canMutate()) return false;
    const turnOwnerId = activeOwner.current;
    if (!turnOwnerId) {
      setSaveError("The authenticated chat owner is unavailable; reload history before sending.");
      return false;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setInputState("");
    loadingRef.current = true;
    setLoading(true);

    const shown = text || (attachments.length ? `${attachments.length} screenshot${attachments.length === 1 ? "" : "s"}` : "");
    // Thumbnails ride on the display row for this session so the photo is
    // visible in the bubble; they're collapsed to a count when persisted.
    const images = attachments.map((a) => `data:${a.media_type};base64,${a.data}`);
    const attachmentMetadata = persistedAttachmentMetadata(attachments);
    let display = [...displayMsgs, {
      role: "user",
      text: shown,
      images: images.length ? images : undefined,
      shots: attachments.length || undefined,
      attachments: attachmentMetadata.length ? attachmentMetadata : undefined,
    }];
    setDisplayMsgs(display);

    // With image attachments, the user turn becomes a content array (vision).
    const userContent = attachments.length
      ? [
          ...attachments.map((a) => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
          { type: "text", text: text || "Here's a screenshot — look at it and tell me what you see, then log it if it's a bug or a feature request." },
        ]
      : text;

    let msgs = trimHistory([...apiHistory, { role: "user", content: userContent }]);
    const toolContext = createPendingScreenshotContext(
      attachments.filter((attachment) => attachment.path).map((attachment) => attachment.path),
      turnOwnerId,
    );
    // Last fully-completed exchange — what we fall back to if the turn dies
    // mid-flight, so already-executed tool side effects stay in history.
    let committed = msgs;

    const pushNote = (note) => {
      display = [...display, { role: "note", text: note }];
      setDisplayMsgs(display);
    };

    let tierIdx = 0;
    let turnsInTier = 0;
    let errorStreak = 0;
    let wrapUpInjected = false;

    // Move one tier up, telling the next model what happened in-band so it
    // continues instead of restarting. `msgs` must end with a tool_results
    // user message — the note rides along as an extra text block.
    const escalate = (reason) => {
      const next = TIERS[tierIdx + 1];
      const last = msgs[msgs.length - 1];
      msgs = [...msgs.slice(0, -1), {
        ...last,
        content: [...last.content, { type: "text", text: `[handoff] ${reason} ${next.label} is taking over — review what was already done above and continue; do not redo completed work.` }],
      }];
      pushNote(`${TIERS[tierIdx].label} passed this to ${next.label} — ${reason}`);
      tierIdx++;
      turnsInTier = 0;
      errorStreak = 0;
    };

    try {
      // A refresh immediately after Send must not erase the user's turn. Store
      // a valid alternating history before any model or tool work begins.
      await persistSessionPhase({
        save: () => persistSession(
          display,
          closePendingTurnForPersistence(msgs, "turn interrupted before Frodo replied"),
          turnOwnerId,
        ),
        phase: "Accepted Frodo turn",
        required: true,
      });
      const authHeaders = await getAuthHeaders(turnOwnerId);

      for (;;) {
        const tier = TIERS[tierIdx];
        setStatus(`${tier.label} is thinking…`);

        const passTool = escalationToolFor(tierIdx);
        const data = await callClaude({
          model: tier.model,
          max_tokens: 4096,
          system: [{ type: "text", text: await buildSystemPrompt(tier), cache_control: { type: "ephemeral" } }],
          tools: passTool ? [...TOOLS, passTool] : TOOLS,
          messages: withCacheMarkers(msgs),
        }, authHeaders, { resolveHeaders: () => getAuthHeaders(turnOwnerId) });

        const toolBlocks = (data.content || []).filter((b) => b.type === "tool_use");

        if (toolBlocks.length > 0) {
          turnsInTier++;
          const passBlock = passTool ? toolBlocks.find((b) => b.name === passTool.name) : null;

          const batch = await executeToolBatchWithCheckpoints({
            baseHistory: msgs,
            assistantContent: data.content,
            toolBlocks,
            phaseLabel: `${tier.label} tool work`,
            checkpoint: async (history, checkpoint) => {
              committed = history;
              await persistSessionPhase({
                save: () => persistSession(
                  display,
                  closePendingTurnForPersistence(history, "turn interrupted during Frodo tool work"),
                  turnOwnerId,
                ),
                phase: checkpoint.phase,
                required: true,
              });
            },
            execute: async (block, checkpointProgress) => {
              if (block === passBlock) {
                return { success: true, note: `Handoff accepted — ${TIERS[tierIdx + 1].label} now has the task.` };
              }
              setStatus(`${tier.label}: ${block.name.replace(/_/g, " ")}…`);
              const result = await executeTool(
                block.name,
                block.input,
                AGENT_ID,
                withCheckpointProgress(toolContext, checkpointProgress),
              );
              errorStreak = result?.error ? errorStreak + 1 : 0;
              return result;
            },
          });
          msgs = batch.history;
          committed = msgs;

          if (passBlock && tierIdx < TIERS.length - 1) {
            escalate(passBlock.input?.reason || "needs more firepower.");
            continue;
          }
          if (errorStreak >= ERROR_STREAK_LIMIT && tierIdx < TIERS.length - 1) {
            escalate(`${ERROR_STREAK_LIMIT} tool calls failed in a row.`);
            continue;
          }
          if (turnsInTier >= tier.maxToolTurns) {
            if (tierIdx < TIERS.length - 1) {
              escalate(`hit the ${tier.maxToolTurns}-step budget without finishing.`);
              continue;
            }
            if (!wrapUpInjected) {
              wrapUpInjected = true;
              const last = msgs[msgs.length - 1];
              msgs = [...msgs.slice(0, -1), {
                ...last,
                content: [...last.content, { type: "text", text: "[system] Tool budget exhausted. Stop calling tools now — summarise honestly what was completed, what wasn't, and what Scott should do next." }],
              }];
              continue;
            }
            throw new Error("Ran out of steps even at the top tier — try breaking the request into smaller pieces.");
          }
          continue;
        }

        // No tool calls — this is the reply.
        let replyText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
        if (data.stop_reason === "max_tokens") {
          replyText += "\n\n*…I ran out of room — say \"continue\" and I'll pick up where I left off.*";
        }
        display = [...display, { role: "assistant", by: tier.id, text: replyText || "Done." }];
        const finalHistory = [...msgs, { role: "assistant", content: data.content }];
        setDisplayMsgs(display);
        setApiHistory(finalHistory);
        // A terminal save failure is already surfaced through saveError. It
        // must not turn a valid model reply into a second, false error turn.
        await persistSessionPhase({
          save: () => persistSession(display, finalHistory, turnOwnerId),
          phase: "Final Frodo reply",
          required: false,
        });
        break;
      }
    } catch (err) {
      // Keep everything that completed, so the next message has true history.
      // Close with an assistant turn so roles still alternate on the next send.
      const interruptedHistory = closePendingTurnForPersistence(committed, `turn interrupted: ${err.message}`);
      setApiHistory(interruptedHistory);
      display = [...display, { role: "assistant", by: TIERS[tierIdx].id, text: `Something went wrong: ${err.message}` }];
      setDisplayMsgs(display);
      // persistSession owns the visible/actionable save warning and always
      // settles to a boolean. Never reject this fire-and-forget UI action a
      // second time if even the error snapshot cannot be stored.
      await persistSessionPhase({
        save: () => persistSession(display, interruptedHistory, turnOwnerId),
        phase: "Frodo error state",
        required: false,
      });
    } finally {
      setStatus("");
      loadingRef.current = false;
      setLoading(false);
    }
    return true;
  };

  const clearHistory = useCallback(async (extraStagingPaths = []) => {
    if (hydrating || !historyGate.current.canUse()) throw new Error("Chat history must load successfully before it can be cleared.");
    if (loadingRef.current) throw new Error("Frodo is still working — wait for the reply before clearing the conversation.");
    if (!activeOwner.current) throw new Error("The authenticated chat owner is unavailable; reload history before clearing.");
    const clearOwnerId = activeOwner.current;
    if (!mutationGate.current.beginClear()) throw new Error("The conversation is already being cleared.");
    setClearing(true);

    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const paths = [...new Set([
        ...chatStagingPathsFromDisplay(displayMsgs),
        ...(extraStagingPaths || []),
      ])];
      const ownerLegacyKey = ownerBoundLegacyChatKey(clearOwnerId);
      let clearResult;
      try {
        clearResult = await clearSessionThenCleanupStaging({
          // Keep an authoritative empty row instead of deleting it. Its
          // presence tells future loads not to import an older local backup.
          clearSession: () => saveAgentSession(AGENT_ID, { display: [], convo: [] }, clearOwnerId),
          clearLegacy: () => suppressAndRemoveOwnerBoundLegacyChat(localStorage, clearOwnerId),
          clearStaging: () => clearStagedScreenshots(paths, clearOwnerId),
        });
      } catch (err) {
        console.error("[useAIAgent] clear failed:", err);
        // The debounce was cancelled before Clear. If the durable deletion
        // fails, immediately re-save the still-visible state so the latest turn
        // cannot disappear merely because Clear was unsuccessful.
        const recovered = await persistSession(displayMsgs, apiHistory);
        const message = recovered
          ? (err.message || "clear failed")
          : `${err.message || "Clear failed"} The visible chat also could not be re-saved.`;
        setSaveError(message);
        throw new Error(message, { cause: err });
      }

      // The empty-state render must not schedule a save that recreates the row.
      // The flag is consumed once; the next real message persists normally.
      skipNextPersist.current = true;
      setDisplayMsgs([]);
      setApiHistory([]);
      setHistoryError("");
      setSaveError("");
      const { legacyError, cleanupError } = clearResult;
      legacyPending.current = legacyError ? ownerLegacyKey : null;
      if (legacyError || cleanupError) {
        const details = [
          legacyError && `legacy backup (${legacyError.message || legacyError})`,
          cleanupError && `staged screenshots (${cleanupError.message || cleanupError})`,
        ].filter(Boolean).join("; ");
        const failure = new Error(`Conversation cleared, but cleanup needs a retry: ${details}.`, { cause: legacyError || cleanupError });
        console.error("[useAIAgent] post-clear cleanup failed:", legacyError || cleanupError);
        setAttachmentError(failure.message);
        return { cleared: true, cleanupWarning: failure };
      }
      setAttachmentError("");
      return { cleared: true, cleanupWarning: null };
    } finally {
      mutationGate.current.finishClear();
      setClearing(false);
    }
  }, [apiHistory, displayMsgs, hydrating, persistSession]);

  const historyReady = historyGate.current.canUse();

  return {
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
  };
}

import { isValidDisplayHistory, isValidModelHistory } from "../utils/chatMessageShape.js";

const errorMessage = (error) => error?.message || error?.code || String(error || "unknown error");

/**
 * Run operations for the same key in call order while allowing different keys
 * to proceed independently. A rejected operation never poisons the queue.
 */
export function createKeyedSerialExecutor() {
  const tails = new Map();

  return function enqueue(key, operation) {
    const previous = tails.get(key) || Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    tail.finally(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return result;
  };
}

/**
 * Resolve auth before consulting the shared read cache, then bind both the
 * cache key and database query to that captured owner. A static cache key can
 * otherwise expose one account's transcript briefly after an in-tab switch.
 */
export function createOwnerScopedSessionReader({
  captureOwner,
  loadForOwner,
  cacheRead,
  cacheKeyPrefix = "loadAgentSessions",
  collection = "agent_sessions",
}) {
  return async function readSessions() {
    const owner = await captureOwner();
    return cacheRead(
      `${cacheKeyPrefix}:${owner}`,
      collection,
      () => loadForOwner(owner),
    );
  };
}

/**
 * Dependency-injected agent-session store. Keeping the persistence rules here
 * lets the Node suite prove auth/error/ordering behavior without a live client.
 */
export function createAgentSessionsStore({
  getUserId,
  captureOwnerId = null,
  verifyOwnerId = null,
  selectRows,
  upsertRow,
  deleteRow,
  now = () => new Date().toISOString(),
  onError = () => {},
  onMutationStart = () => {},
  onMutationSettled = () => {},
  onLoadBarrier = () => {},
}) {
  const enqueue = createKeyedSerialExecutor();
  const ownerCaptureTails = new Map();
  const pendingMutations = new Set();

  const fail = (action, agentId, error) => {
    onError({ action, agentId, error });
    const subject = agentId ? ` (${agentId})` : "";
    const lead = action === "load"
      ? "Couldn't load chat history"
      : action === "save"
        ? "Chat history isn't saving"
        : "Couldn't clear chat history";
    return new Error(`${lead}${subject}: ${errorMessage(error)}`);
  };

  // Start auth lookup synchronously at the public call boundary so a queued
  // operation can never drift into a different account. The short admission
  // chain preserves call order when two auth promises resolve out of order.
  const captureOwner = (agentId, expectedOwnerId = null) => {
    let requested;
    try {
      const capturedOwnerId = expectedOwnerId || captureOwnerId?.() || null;
      requested = Promise.resolve(getUserId(capturedOwnerId)).then((resolvedOwnerId) => {
        if (capturedOwnerId && resolvedOwnerId !== capturedOwnerId) {
          throw new Error("the authenticated owner changed before the operation began");
        }
        return capturedOwnerId || resolvedOwnerId;
      });
    } catch (error) {
      requested = Promise.reject(error);
    }
    const previous = ownerCaptureTails.get(agentId) || Promise.resolve();
    const captured = previous.then(() => requested, () => requested);
    const tail = captured.then(
      () => undefined,
      () => undefined,
    );
    ownerCaptureTails.set(agentId, tail);
    tail.finally(() => {
      if (ownerCaptureTails.get(agentId) === tail) ownerCaptureTails.delete(agentId);
    });
    return captured;
  };

  const verifyCapturedOwner = async (userId) => {
    if (!verifyOwnerId) return userId;
    const verified = await verifyOwnerId(userId);
    if (verified !== userId) throw new Error("the authenticated owner changed before the operation executed");
    return userId;
  };

  const trackMutation = (owner, result, action, agentId) => {
    const completed = result.finally(() => onMutationSettled({ action, agentId }));
    const record = {
      owner,
      // Read barriers need a never-rejecting settlement signal; callers still
      // receive the original rejection through `completed`.
      done: completed.then(() => undefined, () => undefined),
    };
    pendingMutations.add(record);
    record.done.then(() => pendingMutations.delete(record));
    return completed;
  };

  async function waitForOwnerMutations(userId) {
    const earlier = [...pendingMutations];
    const relevant = [];
    for (const mutation of earlier) {
      try {
        if (await mutation.owner === userId) relevant.push(mutation.done);
      } catch {
        // Failed auth admission cannot have written a row.
      }
    }
    onLoadBarrier({ userId, pendingCount: relevant.length });
    await Promise.all(relevant);
  }

  async function captureLoadOwner(expectedOwnerId = null) {
    let userId;
    try {
      const capturedOwnerId = expectedOwnerId || captureOwnerId?.() || null;
      const resolvedOwnerId = await getUserId(capturedOwnerId);
      if (capturedOwnerId && resolvedOwnerId !== capturedOwnerId) {
        throw new Error("the authenticated owner changed before the operation began");
      }
      userId = capturedOwnerId || resolvedOwnerId;
    } catch (error) {
      throw fail("load", null, error);
    }
    return userId;
  }

  async function loadForOwner(userId) {
    // A remounted chat must not hydrate stale database state while a save or
    // clear for this owner is still queued/in flight.
    await waitForOwnerMutations(userId);
    let response;
    try {
      await verifyCapturedOwner(userId);
      response = await selectRows(userId);
    } catch (error) {
      throw fail("load", null, error);
    }
    if (response?.error) throw fail("load", null, response.error);
    if (response?.data != null && !Array.isArray(response.data)) {
      throw fail("load", null, new Error("the session store returned an unsupported response; no data was changed"));
    }

    const sessions = {};
    for (const row of response?.data || []) {
      if (row.display != null && !Array.isArray(row.display)) {
        throw fail("load", row.agent_id, new Error("stored display history has an unsupported format; no data was changed"));
      }
      if (row.convo != null && !Array.isArray(row.convo)) {
        throw fail("load", row.agent_id, new Error("stored model history has an unsupported format; no data was changed"));
      }
      // Frodo persists `note` rows while it hands a turn to a higher tier.
      // They are rendered as status text, not model context, but must survive
      // a reload alongside user, assistant, and error display messages.
      if (Array.isArray(row.display) && !isValidDisplayHistory(row.display, ["user", "assistant", "error", "note"])) {
        throw fail("load", row.agent_id, new Error("stored display history contains an unsupported message; no data was changed"));
      }
      if (Array.isArray(row.convo) && !isValidModelHistory(row.convo)) {
        throw fail("load", row.agent_id, new Error("stored model history contains an unsupported message; no data was changed"));
      }
      sessions[row.agent_id] = {
        display: Array.isArray(row.display) ? row.display : [],
        convo: Array.isArray(row.convo) ? row.convo : [],
      };
    }
    return sessions;
  }

  async function load(expectedOwnerId = null) {
    return loadForOwner(await captureLoadOwner(expectedOwnerId));
  }

  function save(agentId, { display, convo }, expectedOwnerId = null) {
    onMutationStart({ action: "save", agentId });
    const owner = captureOwner(agentId, expectedOwnerId);
    const result = owner.then(
      (userId) => enqueue(`${userId}\u001f${agentId}`, async () => {
        let response;
        try {
          await verifyCapturedOwner(userId);
          response = await upsertRow({
            user_id: userId,
            agent_id: agentId,
            display,
            convo,
            updated_at: now(),
          });
        } catch (error) {
          throw fail("save", agentId, error);
        }
        if (response?.error) throw fail("save", agentId, response.error);
      }),
      (error) => { throw fail("save", agentId, error); },
    );
    return trackMutation(owner, result, "save", agentId);
  }

  function clear(agentId, expectedOwnerId = null) {
    // Clear shares the save queue so an older in-flight save cannot recreate or
    // overwrite a row after its confirmed deletion.
    onMutationStart({ action: "clear", agentId });
    const owner = captureOwner(agentId, expectedOwnerId);
    const result = owner.then(
      (userId) => enqueue(`${userId}\u001f${agentId}`, async () => {
        let response;
        try {
          await verifyCapturedOwner(userId);
          response = await deleteRow(userId, agentId);
        } catch (error) {
          throw fail("clear", agentId, error);
        }
        if (response?.error) throw fail("clear", agentId, response.error);
      }),
      (error) => { throw fail("clear", agentId, error); },
    );
    return trackMutation(owner, result, "clear", agentId);
  }

  return { load, loadForOwner, captureLoadOwner, save, clear };
}

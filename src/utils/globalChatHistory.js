let frodoHistoryController = null;

export const GLOBAL_CHAT_CLEAR_CONFIRMATION = "Clear this account's Frodo, Command Center, and Griphook chats plus Frodo's staged screenshots? Quarantined older backups without account ownership stay untouched for explicit recovery. Aulë's local terminal session and your saved data are untouched.";
export const GLOBAL_CHAT_CLEAR_SUCCESS = "This account's app chat history was cleared. Quarantined unowned backups, if any, were left untouched.";

export function registerFrodoHistoryController(controller) {
  if (!controller?.prepare || !controller?.clear) {
    throw new Error("Frodo's history controller must provide prepare and clear operations.");
  }
  frodoHistoryController = controller;
  return () => {
    if (frodoHistoryController === controller) frodoHistoryController = null;
  };
}

export function prepareMountedFrodoHistoryClear() {
  if (!frodoHistoryController) throw new Error("Frodo's chat is not ready to clear. Reload and try again.");
  return frodoHistoryController.prepare();
}

export function clearMountedFrodoHistory(preparation) {
  if (!frodoHistoryController) throw new Error("Frodo's chat is not ready to clear. Reload and try again.");
  return frodoHistoryController.clear(preparation);
}

/**
 * Coordinate the three independently stored chat surfaces. Every runtime is
 * checked before the first destructive operation so a busy agent
 * cannot turn an intended global clear into a misleading partial success.
 */
export async function clearAllAIChatHistory({
  prepareBankerClear,
  cancelBankerClear,
  prepareCommandCenterClear,
  clearCommandCenter,
  clearBanker,
}) {
  const frodoPreparation = prepareMountedFrodoHistoryClear();
  let bankerPreparation;
  try {
    bankerPreparation = await prepareBankerClear();
  } catch (error) {
    await frodoHistoryController?.cancel?.(frodoPreparation);
    throw error;
  }
  let commandCenterPreparation;
  try {
    commandCenterPreparation = await prepareCommandCenterClear();
  } catch (error) {
    await Promise.allSettled([
      Promise.resolve().then(() => frodoHistoryController?.cancel?.(frodoPreparation)),
      Promise.resolve().then(() => cancelBankerClear(bankerPreparation)),
    ]);
    throw error;
  }

  const operations = [
    ["Frodo", () => clearMountedFrodoHistory(frodoPreparation)],
    ["Command Center", () => clearCommandCenter(commandCenterPreparation)],
    ["Griphook", () => clearBanker(bankerPreparation)],
  ];
  // Convert every callback into a promise before invoking it. This keeps a
  // synchronous storage failure inside the all-settled boundary and ensures
  // the remaining prepared surfaces are still invoked and awaited.
  const settled = await Promise.allSettled(
    operations.map(([, operation]) => Promise.resolve().then(operation)),
  );
  const failures = [];
  const warnings = [];

  settled.forEach((result, index) => {
    const label = operations[index][0];
    if (result.status === "rejected") {
      failures.push({ label, error: result.reason });
      return;
    }
    const warning = result.value?.cleanupWarning;
    if (warning) warnings.push({ label, error: warning });
  });

  return { failures, warnings };
}

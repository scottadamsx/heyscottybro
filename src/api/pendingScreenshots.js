/**
 * Evidence belongs to one live agent turn. Callers carry this context through
 * executeTool so concurrent chats can never consume each other's screenshots.
 */
export function createPendingScreenshotContext(paths = [], ownerId = null) {
  return {
    pendingScreenshots: [...new Set((paths || []).filter(Boolean))],
    ownerId,
  };
}

function requireContext(context) {
  if (!context || !Array.isArray(context.pendingScreenshots)) {
    throw new Error("Screenshot evidence context is missing for this agent turn.");
  }
  return context;
}

export function setPendingScreenshots(context, paths = []) {
  requireContext(context).pendingScreenshots = [...new Set((paths || []).filter(Boolean))];
}

export function takePendingScreenshots(context) {
  const scoped = requireContext(context);
  const paths = scoped.pendingScreenshots;
  scoped.pendingScreenshots = [];
  return paths;
}

/**
 * Tool execution adds a per-action checkpoint callback without cloning the
 * mutable turn context. Screenshot evidence is a one-shot queue, so every
 * tool in the turn must observe and consume the same object.
 */
export function withCheckpointProgress(context, checkpointProgress) {
  const scoped = requireContext(context);
  scoped.checkpointProgress = checkpointProgress;
  return scoped;
}

/**
 * Tiny bridge between the Frodo chat (which stages dropped screenshots to
 * storage) and the log_bug tool (which attaches them to a freshly-created
 * bug). The chat sets the pending paths right before each send; the tool
 * takes-and-clears them, so they never leak into a later, unrelated bug.
 */
let pending = [];

export function setPendingScreenshots(paths = []) { pending = paths; }
export function takePendingScreenshots() { const p = pending; pending = []; return p; }

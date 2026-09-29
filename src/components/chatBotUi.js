export const CHAT_MODAL_MAX_WIDTH = 900;
export const CHAT_MODAL_MEDIA = `(max-width: ${CHAT_MODAL_MAX_WIDTH}px)`;
export const COARSE_POINTER_MEDIA = "(pointer: coarse)";

export function isChatModalViewport(width) {
  return Number.isFinite(width) && width <= CHAT_MODAL_MAX_WIDTH;
}

export function getInitialChatFocusTarget({ modal = false, touch = false } = {}) {
  return modal || touch ? "close" : "composer";
}

export function shouldActivateChatLog({ open = false, hydrating = true, historyReady = false } = {}) {
  return open && !hydrating && historyReady;
}

export function getChatLogA11y({ active = false, busy = false } = {}) {
  return {
    role: "log",
    "aria-live": active ? "polite" : "off",
    "aria-relevant": "additions text",
    "aria-atomic": false,
    "aria-busy": busy || undefined,
  };
}

export function getChatStatusAnnouncement({ loading = false, status = "" } = {}) {
  if (!loading) return "";
  return status ? `Frodo: ${status}` : "Frodo is working.";
}

// Return a destination only when Tab needs to wrap at a dialog boundary.
// -1 means the browser can keep its normal focus order.
export function getFocusWrapIndex(currentIndex, count, backwards = false) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= count) {
    return backwards ? count - 1 : 0;
  }
  if (backwards && currentIndex === 0) return count - 1;
  if (!backwards && currentIndex === count - 1) return 0;
  return -1;
}

// Scroll the message container itself. scrollIntoView is deliberately avoided
// because it can move the page behind Frodo's fixed panel.
export function scrollChatToBottom(scroller, behavior = "auto") {
  if (!scroller) return false;
  const top = scroller.scrollHeight;
  if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top, behavior });
  else scroller.scrollTop = top;
  return true;
}

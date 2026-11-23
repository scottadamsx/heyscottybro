/**
 * Copy text, or throw. Callers show "Copied" only when this resolves — a
 * blocked or missing clipboard is an error the user sees, never a fake success.
 *
 * Tries the async Clipboard API first, then the legacy hidden-textarea +
 * execCommand path, which still works in contexts where the async API is
 * denied (document not focused, in-app/PWA browsers, missing permission).
 * The thrown error is a plain sentence for the user; the raw platform error
 * rides along on `cause` only and must never be rendered.
 */
export async function copyText(text) {
  const value = String(text ?? "");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (err) {
      if (legacyCopy(value)) return;
      throw new Error("The browser blocked the copy", { cause: err });
    }
  }
  if (!legacyCopy(value)) throw new Error("This browser has no clipboard access");
}

function legacyCopy(value) {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  // Off-screen but still rendered and selectable: a display:none or
  // visibility:hidden textarea cannot be selected, so copy would fail.
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.width = "1px";
  ta.style.height = "1px";
  ta.style.opacity = "0";
  const previous = document.activeElement;
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, value.length);
  let ok;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  if (previous && typeof previous.focus === "function") previous.focus();
  return ok;
}

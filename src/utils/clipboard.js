/**
 * Copy text, or throw. Callers show "Copied" only when this resolves — a
 * blocked or missing clipboard is an error the user sees, never a fake success.
 * Falls back to a hidden textarea + execCommand for browsers (or insecure
 * origins) without the async Clipboard API.
 */
export async function copyText(text) {
  const value = String(text ?? "");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (err) {
      if (!legacyCopy(value)) throw new Error(err?.message ? `The browser blocked the clipboard (${err.message})` : "The browser blocked the clipboard", { cause: err });
      return;
    }
  }
  if (!legacyCopy(value)) throw new Error("This browser has no clipboard access — select the text and copy it by hand");
}

function legacyCopy(value) {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.className = "visually-hidden";
  const previous = document.activeElement;
  document.body.appendChild(ta);
  ta.select();
  let ok;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  if (previous && typeof previous.focus === "function") previous.focus();
  return ok;
}

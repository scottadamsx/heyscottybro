import { useEffect, useRef, useState } from "react";
import { copyText } from "../utils/clipboard";

const RESET_MS = 2000;

/**
 * Rendered markdown (from utils/markdown.js) with a Copy button on every code
 * block. The buttons are added after render so the markdown string itself —
 * also used for exports and PDFs — stays plain. One click handler on the
 * wrapper serves them all. Success says "Copied" and is announced; a blocked
 * clipboard says so, on the button and to screen readers.
 *
 *   <MarkdownBody className="chat-md" html={renderMarkdown(text)} />
 */
export default function MarkdownBody({ html, className = "", ...rest }) {
  const ref = useRef(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre").forEach((pre, i) => {
      if (pre.parentElement?.classList.contains("code-block")) return;
      const wrap = document.createElement("div");
      wrap.className = "code-block";
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.dataset.codeCopy = String(i);
      btn.setAttribute("aria-label", "Copy code");
      setLabel(btn, "idle");
      wrap.appendChild(btn);
    });
  }, [html]);

  const say = (msg) => {
    setAnnounce("");
    requestAnimationFrame(() => setAnnounce(msg));
  };

  const onClick = async (e) => {
    const btn = e.target.closest?.("[data-code-copy]");
    if (!btn || !ref.current?.contains(btn)) return;
    const code = btn.parentElement?.querySelector("pre")?.textContent ?? "";
    try {
      await copyText(code.replace(/\n$/, ""));
      setLabel(btn, "copied");
      say("Code copied to clipboard");
    } catch (err) {
      setLabel(btn, "failed");
      say(`Couldn't copy the code: ${err?.message || err}`);
    }
    clearTimeout(btn._reset);
    btn._reset = setTimeout(() => btn.isConnected && setLabel(btn, "idle"), RESET_MS);
  };

  return (
    <>
      {/* Click delegation only: the real <button>s inside get keyboard activation for free. */}
      <div ref={ref} className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} {...rest} />
      <span className="visually-hidden" aria-live="polite">{announce}</span>
    </>
  );
}

function setLabel(btn, state) {
  const text = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy";
  const icon = state === "copied" ? "fa-solid fa-check" : state === "failed" ? "fa-solid fa-triangle-exclamation" : "fa-regular fa-copy";
  btn.classList.toggle("is-copied", state === "copied");
  btn.classList.toggle("is-failed", state === "failed");
  btn.setAttribute("aria-label", state === "idle" ? "Copy code" : text);
  btn.replaceChildren();
  const i = document.createElement("i");
  i.className = icon;
  i.setAttribute("aria-hidden", "true");
  const span = document.createElement("span");
  span.textContent = text;
  btn.append(i, span);
}

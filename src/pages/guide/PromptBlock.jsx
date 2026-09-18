import { useEffect, useRef, useState } from "react";

/* A copy-to-clipboard prompt block in the terminal aesthetic.
   The button's visible text changes ("Copied!") and a polite live region
   announces the result, since a label change alone isn't read out. If the
   clipboard is blocked we say so and select the text for a manual copy —
   never a fake "Copied". */
export default function PromptBlock({ title = "Prompt — paste into your AI", text }) {
  const [state, setState] = useState("idle"); // idle | copied | failed
  const [announce, setAnnounce] = useState("");
  const bodyRef = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (next, message) => {
    setState(next);
    setAnnounce(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setState("idle"); setAnnounce(""); }, next === "failed" ? 4000 : 2000);
  };

  const selectText = () => {
    const el = bodyRef.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      settle("copied", "Prompt copied to clipboard.");
    } catch {
      selectText();
      settle("failed", "Couldn't copy automatically. The prompt is selected — press Ctrl+C or Command+C to copy it.");
    }
  };

  const label = state === "copied" ? "Copied!" : state === "failed" ? "Select & copy" : "Copy";
  const icon = state === "copied" ? "fa-check" : state === "failed" ? "fa-triangle-exclamation" : "fa-copy";
  return (
    <div className="lp-prompt">
      <div className="lp-prompt-head">
        <span className="lp-prompt-title">{title}</span>
        <button type="button" className={`lp-prompt-copy${state === "copied" ? " copied" : ""}`} onClick={copy}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" /> {label}<span className="pub-sr"> prompt</span>
        </button>
      </div>
      <pre className="lp-prompt-body" ref={bodyRef}>{text}</pre>
      <span className="pub-sr" role="status" aria-live="polite">{announce}</span>
      {state === "failed" && <p className="lp-prompt-hint" aria-hidden="true">Couldn&apos;t reach the clipboard — the prompt is selected, press Ctrl/⌘+C.</p>}
    </div>
  );
}

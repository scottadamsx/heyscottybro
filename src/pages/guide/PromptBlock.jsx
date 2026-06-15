import { useState } from "react";

/* A copy-to-clipboard prompt block in the terminal aesthetic. */
export default function PromptBlock({ title = "Prompt — paste into your AI", text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the text is still selectable */ }
  };
  return (
    <div className="lp-prompt">
      <div className="lp-prompt-head">
        <span className="lp-prompt-title">{title}</span>
        <button className={`lp-prompt-copy${copied ? " copied" : ""}`} onClick={copy} aria-label="Copy prompt">
          <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} /> {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="lp-prompt-body">{text}</pre>
    </div>
  );
}

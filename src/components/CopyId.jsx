import { useState } from "react";
import "./CopyId.css";

/**
 * Turn a document's title into the id you reference it by: the actual title with
 * whitespace collapsed to single underscores (e.g. "MOC - Career & Resume" ->
 * "MOC_-_Career_&_Resume"). Human-readable so an agent can map it straight back
 * to the note, unlike the file-path slug. Falls back to the slug if untitled.
 */
export function docId(title, slug = "") {
  const base = String(title || slug || "").trim();
  return base.replace(/\s+/g, "_");
}

/**
 * A click-to-copy chip for a document's id. Lets you grab a Brain note's
 * reference id to use with an agent or in external tools. Shows a brief "Copied"
 * check on success; falls back silently if the clipboard API is unavailable.
 * Self-contained (no toast dependency) so it works on any route.
 */
export default function CopyId({ id, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — leave the id visible to copy by hand */
    }
  };

  return (
    <button
      type="button"
      className={`copy-id${copied ? " is-copied" : ""}${className ? " " + className : ""}`}
      onClick={handleCopy}
      title="Copy this document's id"
      aria-label={copied ? "Copied id" : `Copy id ${id}`}
    >
      <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} />
      <code>{id}</code>
    </button>
  );
}

import { useEffect } from "react";
import { renderMarkdown } from "../../utils/markdown";

/**
 * Lightweight modal that renders a Brain node's markdown body, with an optional
 * read/unread toggle when opened from a doc link. Reused anywhere a linked
 * document needs to "come up" on click (reminders, events, research, agents).
 *
 * Props:
 *   node      { title, body, slug, type } | null  — null shows a not-found state
 *   link      the doc_link row (for read state) | null
 *   busy      disables the read toggle while saving
 *   onToggleRead(link)   — flip read/unread
 *   onClose()
 */
export default function DocViewerModal({ node, link, busy, onToggleRead, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = node?.title || link?.node_title || link?.node_slug || "Document";
  const isRead = !!link?.read;

  return (
    <div className="docv-overlay" onClick={onClose}>
      <div className="docv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="docv-head">
          <h3 className="docv-title"><i className="fa-solid fa-file-lines" /> {title}</h3>
          <div className="docv-actions">
            {link && (
              <button
                className={`btn btn-sm ${isRead ? "btn-secondary-sm" : ""}`}
                onClick={() => onToggleRead?.(link)}
                disabled={busy}
                title={isRead ? "Mark as unread" : "Mark as read"}
              >
                <i className={`fa-solid ${isRead ? "fa-rotate-left" : "fa-check"}`} /> {isRead ? "Unread" : "Mark read"}
              </button>
            )}
            {node?.slug && <a className="btn-mini" href="/admin/brain" title="Open in Brain"><i className="fa-solid fa-diagram-project" /></a>}
            <button className="btn-mini" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>
        {!node && (
          <p className="no-entries" style={{ margin: "0.5rem 0" }}>
            <i className="fa-solid fa-triangle-exclamation" /> This document isn’t in your Brain anymore
            {link?.node_slug ? <> (<code>{link.node_slug}</code>)</> : null}. It may have been renamed or removed.
          </p>
        )}
        {node && (
          <div className="docv-body chat-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(node.body || "*(empty document)*") }} />
        )}
      </div>
    </div>
  );
}

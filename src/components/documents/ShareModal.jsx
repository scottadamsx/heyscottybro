import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { copyText } from "../../utils/clipboard";
import { SkeletonList } from "../Skeleton";
import {
  createShareToken,
  loadDocumentShares,
  revokeShare,
  emailShareLink,
} from "../../api/documentsApi";

export default function ShareModal({ doc, onClose }) {
  const { addToast } = useToast();
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("never");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [announce, setAnnounce] = useState("");
  const { confirm, dialog } = useConfirm();

  const buildShareUrl = (token) => `${window.location.origin}/doc/${token}`;

  useEffect(() => {
    loadDocumentShares(doc.id)
      .then(setShares)
      .catch((err) => { console.warn("[share-modal] load shares failed", err); addToast(`Couldn't load share links: ${err?.message || err}`, "error"); })
      .finally(() => setLoading(false));
  }, [doc.id, addToast]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const expiresInDays = expires === "never" ? null : parseInt(expires, 10);
    try {
      const share = await createShareToken(doc.id, { sharedWithEmail: email || null, expiresInDays });
      setShares((s) => [share, ...s]);
      setEmail("");
    } catch (err) {
      addToast(`Couldn't create a share link: ${err?.message || err}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (share) => {
    setAnnounce("");
    try {
      await copyText(buildShareUrl(share.token));
      setCopiedId(share.id);
      setAnnounce("Share link copied to clipboard");
      setTimeout(() => setCopiedId((c) => (c === share.id ? null : c)), 1500);
    } catch (err) {
      setAnnounce("Couldn't copy the share link");
      addToast(`Couldn't copy the link: ${err?.message || err}`, "error");
    }
  };

  const handleRevoke = async (share) => {
    if (!await confirm(`Revoke this link${share.shared_with_email ? ` for ${share.shared_with_email}` : ""}? Anyone who has it will stop being able to open "${doc.name}".`, { title: "Revoke share link", confirmLabel: "Revoke" })) return;
    setRevokingId(share.id);
    try {
      await revokeShare(share.id);
      setShares((s) => s.filter((sh) => sh.id !== share.id));
      addToast("Share link revoked.", "success");
    } catch (err) {
      addToast(`Couldn't revoke the link: ${err?.message || err}`, "error");
    } finally {
      setRevokingId(null);
    }
  };

  const mailto = (shareUrl) => {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Document: ${doc.name}`)}&body=${encodeURIComponent(`Here's a link to "${doc.name}":\n\n${shareUrl}`)}`;
  };

  const handleEmailShare = async (share) => {
    const shareUrl = buildShareUrl(share.token);
    const recipient = share.shared_with_email || email;
    if (!recipient) { mailto(shareUrl); return; }
    setSendingId(share.id);
    try {
      await emailShareLink({ to: recipient, documentName: doc.name, shareUrl });
      addToast(`Email sent to ${recipient}`, "success");
    } catch {
      // Resend not configured or failed — fall back to the user's mail client.
      mailto(shareUrl);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal share-modal" role="dialog" aria-modal="true" aria-label={`Share ${doc.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">Share — {doc.name}</span>
          <button type="button" className="icon-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <div className="doc-viewer-body share-body">
          <form onSubmit={handleCreate}>
            <div className="form-row share-form-row">
              <input
                className="field-grow"
                type="email"
                aria-label="Recipient email"
                placeholder="Recipient email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select aria-label="Link expiry" value={expires} onChange={(e) => setExpires(e.target.value)}>
                <option value="never">Never expires</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
              <button className="btn" type="submit" disabled={creating} aria-busy={creating || undefined}>
                {creating ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /><span className="visually-hidden">Generating link…</span></> : "Generate link"}
              </button>
            </div>
          </form>

          <div className="doc-share-list">
            {loading && <SkeletonList rows={2} label="Loading share links" />}
            <span className="visually-hidden" aria-live="polite">{announce}</span>
            {!loading && shares.length === 0 && <p className="no-entries">No share links yet.</p>}
            {shares.map((sh) => (
              <div className="doc-share-row" key={sh.id}>
                <div className="doc-share-info">
                  <span className="share-url">
                    {buildShareUrl(sh.token)}
                  </span>
                  {sh.shared_with_email && <span className="doc-share-email">→ {sh.shared_with_email}</span>}
                  <span className="doc-card-meta">
                    {sh.expires_at ? `Expires ${new Date(sh.expires_at).toLocaleDateString()}` : "No expiry"}
                    {" · "}{sh.access_count || 0} view{(sh.access_count || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="doc-share-actions">
                  <button type="button" className={`btn-mini share-btn ${copiedId === sh.id ? "copied" : ""}`} onClick={() => handleCopy(sh)} title="Copy link" aria-label={copiedId === sh.id ? "Link copied" : "Copy link"}>
                    <i className={`fa-solid ${copiedId === sh.id ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-mini share-btn" onClick={() => handleEmailShare(sh)} disabled={sendingId === sh.id} title="Email this link" aria-label="Email this link">
                    <i className={`fa-solid ${sendingId === sh.id ? "fa-spinner fa-spin" : "fa-envelope"}`} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-mini danger share-btn" onClick={() => handleRevoke(sh)} disabled={revokingId === sh.id} aria-busy={revokingId === sh.id || undefined} title="Revoke" aria-label="Revoke link">
                    <i className="fa-solid fa-ban" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {dialog}
      </div>
    </div>
  );
}

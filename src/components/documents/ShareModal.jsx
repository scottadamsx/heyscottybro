import { useEffect, useState } from "react";
import {
  createShareToken,
  loadDocumentShares,
  revokeShare,
  emailShareLink,
} from "../../api/documentsApi";

export default function ShareModal({ doc, onClose }) {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("never");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const buildShareUrl = (token) => `${window.location.origin}/doc/${token}`;

  useEffect(() => {
    loadDocumentShares(doc.id).then(setShares).catch(() => {}).finally(() => setLoading(false));
  }, [doc.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const expiresInDays = expires === "never" ? null : parseInt(expires, 10);
    try {
      const share = await createShareToken(doc.id, { sharedWithEmail: email || null, expiresInDays });
      setShares((s) => [share, ...s]);
      setEmail("");
    } catch {
      /* surfaced by disabled state; keep simple */
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (share) => {
    navigator.clipboard?.writeText(buildShareUrl(share.token));
    setCopiedId(share.id);
    setTimeout(() => setCopiedId((c) => (c === share.id ? null : c)), 1500);
  };

  const handleRevoke = async (shareId) => {
    await revokeShare(shareId);
    setShares((s) => s.filter((sh) => sh.id !== shareId));
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
      alert(`Email sent to ${recipient}`);
    } catch {
      // Resend not configured or failed — fall back to the user's mail client.
      mailto(shareUrl);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">Share — {doc.name}</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="doc-viewer-body" style={{ alignItems: "stretch" }}>
          <form onSubmit={handleCreate}>
            <div className="form-row" style={{ marginBottom: "0.5rem" }}>
              <input
                className="field-grow"
                type="email"
                placeholder="Recipient email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select value={expires} onChange={(e) => setExpires(e.target.value)}>
                <option value="never">Never expires</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
              <button className="btn" type="submit" disabled={creating}>
                {creating ? <i className="fa-solid fa-spinner fa-spin" /> : "Generate link"}
              </button>
            </div>
          </form>

          <div className="doc-share-list">
            {loading && <p className="no-entries">Loading…</p>}
            {!loading && shares.length === 0 && <p className="no-entries">No share links yet.</p>}
            {shares.map((sh) => (
              <div className="doc-share-row" key={sh.id}>
                <div className="doc-share-info">
                  <span className="snip-text" style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>
                    {buildShareUrl(sh.token)}
                  </span>
                  {sh.shared_with_email && <span className="doc-share-email">→ {sh.shared_with_email}</span>}
                  <span className="doc-card-meta">
                    {sh.expires_at ? `Expires ${new Date(sh.expires_at).toLocaleDateString()}` : "No expiry"}
                    {" · "}{sh.access_count || 0} view{(sh.access_count || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="doc-share-actions">
                  <button className={`btn-tiny-blue ${copiedId === sh.id ? "copied" : ""}`} onClick={() => handleCopy(sh)} title="Copy link">
                    <i className={`fa-solid ${copiedId === sh.id ? "fa-check" : "fa-copy"}`} />
                  </button>
                  <button className="btn-tiny-blue" onClick={() => handleEmailShare(sh)} disabled={sendingId === sh.id} title="Email this link">
                    <i className={`fa-solid ${sendingId === sh.id ? "fa-spinner fa-spin" : "fa-envelope"}`} />
                  </button>
                  <button className="btn-tiny-blue danger" onClick={() => handleRevoke(sh.id)} title="Revoke">
                    <i className="fa-solid fa-ban" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

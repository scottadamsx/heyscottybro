import { useState } from "react";
import { getSignedUrl } from "../../api/documentsApi";

const ICON_MAP = {
  "application/pdf": "fa-file-pdf",
  "image/": "fa-file-image",
  "application/msword": "fa-file-word",
  "application/vnd.openxmlformats": "fa-file-word",
  "text/": "fa-file-lines",
};
const getIcon = (mime) => {
  const entry = Object.entries(ICON_MAP).find(([k]) => mime?.startsWith(k));
  return entry ? entry[1] : "fa-file";
};
export const formatBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

export default function DocumentCard({ doc, onView, onShare, onDelete, agentLabel = null }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
    } catch {
      /* ignore — user can retry */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="doc-card">
      <div className="doc-card-icon"><i className={`fa-solid ${getIcon(doc.mime_type)}`} /></div>
      <div className="doc-card-body">
        <div className="doc-card-name">{doc.name}</div>
        {agentLabel && (
          <div className="doc-card-agent" style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.7rem", fontWeight: 600, padding: "0.1rem 0.45rem",
            borderRadius: 999, marginBottom: "0.25rem",
            color: "var(--blue, #3b82f6)", background: "color-mix(in srgb, var(--blue, #3b82f6) 14%, transparent)",
          }}>
            <i className="fa-solid fa-robot" /> {agentLabel}
          </div>
        )}
        <div className="doc-card-meta">
          {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
        </div>
        {doc.description && <div className="doc-card-desc">{doc.description}</div>}
      </div>
      <div className="doc-card-actions">
        <button className="btn-tiny-blue" onClick={() => onView(doc)} title="View">
          <i className="fa-solid fa-eye" />
        </button>
        <button className="btn-tiny-blue" onClick={handleDownload} disabled={downloading} title="Download">
          <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} />
        </button>
        <button className="btn-tiny-blue" onClick={() => onShare(doc)} title="Share">
          <i className="fa-solid fa-share-nodes" />
        </button>
        <button className="btn-tiny-blue danger" onClick={() => onDelete(doc)} title="Delete">
          <i className="fa-solid fa-trash" />
        </button>
      </div>
    </div>
  );
}

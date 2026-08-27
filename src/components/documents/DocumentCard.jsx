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

const tagsToText = (tags) => (Array.isArray(tags) ? tags.filter(Boolean).join(", ") : "");
const textToTags = (text) => text.split(",").map((t) => t.trim()).filter(Boolean);

export default function DocumentCard({ doc, onView, onShare, onDelete, onUpdate = null, agentLabel = null }) {
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [tagText, setTagText] = useState(tagsToText(doc.tags));
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  const startEdit = () => { setName(doc.name); setTagText(tagsToText(doc.tags)); setEditError(null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setEditError(null); };
  const commitEdit = async () => {
    const clean = name.trim();
    if (!clean) { setEditError("Name can't be empty."); return; }
    setSavingEdit(true); setEditError(null);
    try {
      await onUpdate(doc, { name: clean, tags: textToTags(tagText) });
      setEditing(false);
    } catch (e) {
      setEditError(e?.message || "Couldn't save changes.");
    } finally { setSavingEdit(false); }
  };
  const onEditKey = (e) => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") cancelEdit(); };

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
        {editing ? (
          <div className="doc-card-edit" onKeyDown={onEditKey}>
            <label className="visually-hidden" htmlFor={`doc-name-${doc.id}`}>Document name</label>
            <input id={`doc-name-${doc.id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
            <label className="visually-hidden" htmlFor={`doc-tags-${doc.id}`}>Tags, comma separated</label>
            <input id={`doc-tags-${doc.id}`} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Tags (comma separated)" />
            {editError && <div className="doc-card-edit-error" role="alert">{editError}</div>}
            <div className="doc-card-edit-actions">
              <button type="button" className="btn-mini accent" onClick={commitEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save"}</button>
              <button type="button" className="btn-mini muted" onClick={cancelEdit} disabled={savingEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="doc-card-name">{doc.name}</div>
        )}
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
        {!editing && Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <div className="doc-card-tags">{doc.tags.map((t) => <span className="doc-card-tag" key={t}>{t}</span>)}</div>
        )}
      </div>
      <div className="doc-card-actions">
        <button className="btn-tiny-blue" onClick={() => onView(doc)} title="View">
          <i className="fa-solid fa-eye" />
        </button>
        <button className="btn-tiny-blue" onClick={handleDownload} disabled={downloading} title="Download">
          <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} />
        </button>
        {onUpdate && !editing && (
          <button className="btn-tiny-blue" onClick={startEdit} title="Rename / tags" aria-label="Rename or edit tags">
            <i className="fa-solid fa-pen" />
          </button>
        )}
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

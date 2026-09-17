import { useState } from "react";
import { getSignedUrl } from "../../api/documentsApi";
import { FormModal, Field } from "../ui";

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

  const startEdit = () => { setName(doc.name); setTagText(tagsToText(doc.tags)); setEditing(true); };
  // Rename / tags modal: errors propagate from onUpdate and stay in the modal.
  const commitEdit = async () => {
    const clean = name.trim();
    if (!clean) throw new Error("Name can't be empty.");
    try { await onUpdate(doc, { name: clean, tags: textToTags(tagText) }); }
    catch (e) { throw new Error(e?.message || "Couldn't save changes.", { cause: e }); }
  };

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
      <div className="doc-card-icon" aria-hidden="true"><i className={`fa-solid ${getIcon(doc.mime_type)}`} /></div>
      <div className="doc-card-body">
        <div className="doc-card-name">{doc.name}</div>
        {agentLabel && (
          <div className="doc-card-agent">
            <i className="fa-solid fa-robot" aria-hidden="true" /> {agentLabel}
          </div>
        )}
        <div className="doc-card-meta">
          {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
        </div>
        {doc.description && <div className="doc-card-desc">{doc.description}</div>}
        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <div className="doc-card-tags">{doc.tags.map((t) => <span className="doc-card-tag" key={t}>{t}</span>)}</div>
        )}
      </div>
      <div className="doc-card-actions">
        <button type="button" className="btn-mini doc-card-btn" onClick={() => onView(doc)} title="View" aria-label={`View ${doc.name}`}>
          <i className="fa-solid fa-eye" aria-hidden="true" />
        </button>
        <button type="button" className="btn-mini doc-card-btn" onClick={handleDownload} disabled={downloading} title="Download" aria-label={`Download ${doc.name}`}>
          <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} aria-hidden="true" />
        </button>
        {onUpdate && (
          <button type="button" className="btn-mini doc-card-btn" onClick={startEdit} title="Rename / tags" aria-label="Rename or edit tags">
            <i className="fa-solid fa-pen" aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn-mini doc-card-btn" onClick={() => onShare(doc)} title="Share" aria-label={`Share ${doc.name}`}>
          <i className="fa-solid fa-share-nodes" aria-hidden="true" />
        </button>
        <button type="button" className="btn-mini danger doc-card-btn" onClick={() => onDelete(doc)} title="Delete" aria-label={`Delete ${doc.name}`}>
          <i className="fa-solid fa-trash" aria-hidden="true" />
        </button>
      </div>
      {editing && (
        <FormModal title="Rename / tags" submitDisabled={!name.trim()} onClose={() => setEditing(false)} onSubmit={commitEdit}>
          <Field label="Document name">
            <input value={name} onChange={(e) => setName(e.target.value)} required data-autofocus />
          </Field>
          <Field label="Tags" hint="Comma separated.">
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} />
          </Field>
        </FormModal>
      )}
    </div>
  );
}

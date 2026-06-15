import { useEffect, useState } from "react";
import { loadDocuments, deleteDocument } from "../../api/documentsApi";
import DocumentCard from "../../components/documents/DocumentCard";
import DocumentUploader from "../../components/documents/DocumentUploader";
import DocumentViewer from "../../components/documents/DocumentViewer";
import ShareModal from "../../components/documents/ShareModal";

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    loadDocuments()
      .then(setDocs)
      .catch(() => setError("Failed to load documents."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const handleUploaded = (doc) => setDocs((d) => [doc, ...d]);

  const handleDelete = async (doc) => {
    try {
      await deleteDocument(doc);
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      setConfirmDelete(null);
    } catch {
      setError("Failed to delete document.");
    }
  };

  const filtered = docs.filter((d) =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📄 Documents</h1>
        <button className="btn" onClick={() => setShowUploader((s) => !s)}>
          <i className={`fa-solid ${showUploader ? "fa-xmark" : "fa-plus"}`} /> {showUploader ? "Close" : "Upload"}
        </button>
      </div>

      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        <i className="fa-solid fa-lock" /> Private storage. Generate expiring share links to send documents to anyone.
      </p>

      {showUploader && (
        <DocumentUploader onUploaded={handleUploaded} onClose={() => setShowUploader(false)} />
      )}

      <input
        className="hiker-search"
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360, marginBottom: "1rem" }}
      />

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}
      {error && (
        <p className="no-entries" style={{ color: "var(--danger, var(--red))" }}>
          {error} <button className="btn-tiny-blue" onClick={load}>Retry</button>
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="no-entries">No documents yet. Upload one to get started.</p>
      )}

      <div className="doc-grid">
        {filtered.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onView={setViewing}
            onShare={setSharing}
            onDelete={setConfirmDelete}
          />
        ))}
      </div>

      {confirmDelete && (
        <div className="doc-viewer-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="form-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <p>Delete <strong>{confirmDelete.name}</strong>? This also revokes any share links and cannot be undone.</p>
            <div className="form-row">
              <button className="btn danger" onClick={() => handleDelete(confirmDelete)}>Yes, delete</button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
      {sharing && <ShareModal doc={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

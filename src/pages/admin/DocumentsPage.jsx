import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { loadDocuments, deleteDocument, getSignedUrl, updateDocument } from "../../api/documentsApi";
import DocumentCard from "../../components/documents/DocumentCard";
import DocumentUploader from "../../components/documents/DocumentUploader";
import DocumentViewer from "../../components/documents/DocumentViewer";
import ShareModal from "../../components/documents/ShareModal";
import PdfViewer from "../../components/PdfViewer";
import "./mission.css";

// A document counts as "agent work" if it carries an `agent` tag (or `agent:<name>`).
const isAgentDoc = (d) =>
  (d.tags || []).some((t) => typeof t === "string" && t.toLowerCase().startsWith("agent"));
const agentLabel = (d) => {
  const tag = (d.tags || []).find((t) => typeof t === "string" && t.toLowerCase().startsWith("agent:"));
  return tag ? tag.slice(tag.indexOf(":") + 1).trim() : null;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [viewing, setViewing] = useState(null);          // non-PDF (image/other) → DocumentViewer
  const [pdfView, setPdfView] = useState(null);          // { url, doc } → full PdfViewer
  const [sharing, setSharing] = useState(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search); // typing stays instant; filtering catches up
  const [onlyAgent, setOnlyAgent] = useState(false);
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

  const agentCount = useMemo(() => docs.filter(isAgentDoc).length, [docs]);

  const handleUploaded = (doc) => setDocs((d) => [doc, ...d]);

  // PDFs open in the full viewer (paging/zoom/download); everything else uses
  // the lightweight DocumentViewer.
  const handleView = async (doc) => {
    if (doc.mime_type === "application/pdf") {
      try {
        const url = await getSignedUrl(doc.storage_path, 3600);
        setPdfView({ url, doc });
      } catch {
        setError("Failed to open that PDF.");
      }
    } else {
      setViewing(doc);
    }
  };

  const handleDelete = async (doc) => {
    try {
      await deleteDocument(doc);
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      setConfirmDelete(null);
    } catch {
      setError("Failed to delete document.");
    }
  };

  // Inline rename / tags from a card. Errors propagate so the card can show them.
  const handleUpdate = async (doc, fields) => {
    const updated = await updateDocument(doc.id, fields);
    setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, ...updated } : x)));
    return updated;
  };

  const filtered = docs.filter((d) => {
    if (onlyAgent && !isAgentDoc(d)) return false;
    if (!deferredSearch) return true;
    const q = deferredSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q) ||
      (d.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  });

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Documents</h1>
        <button type="button" className="btn btn-sm" onClick={() => setShowUploader(true)}>
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Upload
        </button>
      </div>

      <p className="vault-intro">
        <i className="fa-solid fa-lock" aria-hidden="true" /> Private storage. Agents drop deliverables here (tagged <code>agent</code>) and you review them in the PDF viewer.
      </p>

      {showUploader && (
        <DocumentUploader onUploaded={handleUploaded} onClose={() => setShowUploader(false)} />
      )}

      <div className="vault-toolbar">
        <input
          className="hiker-search vault-search"
          type="search"
          aria-label="Search documents"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="vault-chips" role="group" aria-label="Filter">
          <button
            type="button"
            className={`chip${!onlyAgent ? " active" : ""}`}
            onClick={() => setOnlyAgent(false)}
            aria-pressed={!onlyAgent}
          >
            All <span className="vault-chip-count">{docs.length}</span>
          </button>
          <button
            type="button"
            className={`chip${onlyAgent ? " active" : ""}`}
            onClick={() => setOnlyAgent(true)}
            aria-pressed={onlyAgent}
            title="Show only deliverables your agents produced"
          >
            <i className="fa-solid fa-robot" aria-hidden="true" /> Agent work <span className="vault-chip-count">{agentCount}</span>
          </button>
        </div>
      </div>

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading…</p>}
      {error && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{error}</p>
          <button type="button" className="btn btn-sm" onClick={load}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="no-entries">
          {onlyAgent ? "No agent work yet. Agents publish here by uploading a PDF tagged “agent”." : "No documents yet. Upload one to get started."}
        </p>
      )}

      <div className="doc-grid">
        {filtered.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            agentLabel={isAgentDoc(doc) ? (agentLabel(doc) || "Agent") : null}
            onView={handleView}
            onShare={setSharing}
            onDelete={setConfirmDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {confirmDelete && (
        <div className="doc-viewer-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="doc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="doc-confirm-msg" onClick={(e) => e.stopPropagation()}>
            <p id="doc-confirm-msg" className="doc-confirm-msg">Delete <strong>{confirmDelete.name}</strong>? This also revokes any share links and cannot be undone.</p>
            <div className="doc-confirm-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn danger" onClick={() => handleDelete(confirmDelete)}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
      {pdfView && (
        <PdfViewer
          fileUrl={pdfView.url}
          title={pdfView.doc.name}
          filename={pdfView.doc.filename}
          onClose={() => setPdfView(null)}
        />
      )}
      {sharing && <ShareModal doc={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

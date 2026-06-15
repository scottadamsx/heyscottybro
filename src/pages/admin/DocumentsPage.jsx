import { useEffect, useMemo, useState } from "react";
import { loadDocuments, deleteDocument, getSignedUrl } from "../../api/documentsApi";
import DocumentCard from "../../components/documents/DocumentCard";
import DocumentUploader from "../../components/documents/DocumentUploader";
import DocumentViewer from "../../components/documents/DocumentViewer";
import ShareModal from "../../components/documents/ShareModal";
import PdfViewer from "../../components/PdfViewer";

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

  const filtered = docs.filter((d) => {
    if (onlyAgent && !isAgentDoc(d)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q) ||
      (d.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  });

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📄 Documents</h1>
        <button className="btn" onClick={() => setShowUploader((s) => !s)}>
          <i className={`fa-solid ${showUploader ? "fa-xmark" : "fa-plus"}`} /> {showUploader ? "Close" : "Upload"}
        </button>
      </div>

      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        <i className="fa-solid fa-lock" /> Private storage. Agents drop deliverables here (tagged <code>agent</code>) and you review them in the PDF viewer.
      </p>

      {showUploader && (
        <DocumentUploader onUploaded={handleUploaded} onClose={() => setShowUploader(false)} />
      )}

      <div className="doc-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center", marginBottom: "1rem" }}>
        <input
          className="hiker-search"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360, margin: 0 }}
        />
        <div className="doc-filter-chips" style={{ display: "flex", gap: "0.35rem" }}>
          <button
            type="button"
            className={`btn-tiny-blue${!onlyAgent ? " active" : ""}`}
            onClick={() => setOnlyAgent(false)}
            aria-pressed={!onlyAgent}
          >
            All ({docs.length})
          </button>
          <button
            type="button"
            className={`btn-tiny-blue${onlyAgent ? " active" : ""}`}
            onClick={() => setOnlyAgent(true)}
            aria-pressed={onlyAgent}
            title="Show only deliverables your agents produced"
          >
            <i className="fa-solid fa-robot" /> Agent work ({agentCount})
          </button>
        </div>
      </div>

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}
      {error && (
        <p className="no-entries" style={{ color: "var(--danger, var(--red))" }}>
          {error} <button className="btn-tiny-blue" onClick={load}>Retry</button>
        </p>
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

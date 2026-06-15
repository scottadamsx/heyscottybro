import { useEffect, useState } from "react";
import { getSignedUrl } from "../../api/documentsApi";
import PdfViewer from "../PdfViewer";

// Fetches a signed URL for a stored document, then shows it. PDFs open in the
// shared full-featured PdfViewer (paging/zoom/download); images and other types
// use the lightweight modal below.
export default function DocumentViewer({ doc, onClose }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const signedUrl = await getSignedUrl(doc.storage_path, 3600);
        if (alive) setUrl(signedUrl);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [doc.storage_path]);

  const isPdf = doc.mime_type === "application/pdf";
  const isImage = doc.mime_type?.startsWith("image/");

  // PDFs → the shared viewer (once the signed URL is ready).
  if (isPdf && url && !error) {
    return <PdfViewer fileUrl={url} title={doc.name} filename={doc.filename} onClose={onClose} />;
  }

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">{doc.name}</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {loading && <div className="doc-viewer-body center"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>}
        {error && <div className="doc-viewer-body center" style={{ color: "var(--danger, var(--red))" }}>{error}</div>}

        {!loading && !error && url && (
          <div className="doc-viewer-body">
            {isImage && <img src={url} alt={doc.name} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />}
            {!isImage && (
              <div className="center">
                <i className="fa-solid fa-file-lines" style={{ fontSize: "4rem", opacity: 0.4 }} />
                <p>Preview not available for this file type.</p>
                <a className="btn" href={url} download={doc.filename}>Download to view</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

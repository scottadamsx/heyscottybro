import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getSignedUrl } from "../../api/documentsApi";

// Worker copied to /public during setup (matches the installed pdfjs-dist version).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function DocumentViewer({ doc, onClose }) {
  const [url, setUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
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
            {isPdf && (
              <>
                <Document
                  file={url}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={<div className="center"><i className="fa-solid fa-spinner fa-spin" /></div>}
                  error={<div className="center">Could not render this PDF.</div>}
                >
                  <Page pageNumber={pageNumber} width={Math.min(window.innerWidth - 80, 800)} />
                </Document>
                {numPages > 1 && (
                  <div className="doc-viewer-pager">
                    <button className="btn-tiny-blue" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)}>
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <span>Page {pageNumber} / {numPages}</span>
                    <button className="btn-tiny-blue" disabled={pageNumber >= numPages} onClick={() => setPageNumber((p) => p + 1)}>
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                )}
              </>
            )}
            {isImage && <img src={url} alt={doc.name} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />}
            {!isPdf && !isImage && (
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

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { fetchSharedDoc } from "../api/documentsApi";
import { formatBytes } from "../components/documents/DocumentCard";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function SharedDocPage() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [url, setUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { document, signedUrl } = await fetchSharedDoc(token);
        if (!alive) return;
        setDoc(document);
        setUrl(signedUrl);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  if (loading) return (
    <div className="shared-doc-page">
      <div className="shared-doc-center">
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "2rem" }} />
        <p>Loading document…</p>
      </div>
    </div>
  );

  if (error || !doc) return (
    <div className="shared-doc-page">
      <div className="shared-doc-center">
        <i className="fa-solid fa-link-slash" style={{ fontSize: "3rem", opacity: 0.4 }} />
        <h2>Link unavailable</h2>
        <p>{error || "This share link is invalid, expired, or has been revoked."}</p>
        <a className="btn" href="/">Go to heyScottyBro</a>
      </div>
    </div>
  );

  const isPdf = doc.mime_type === "application/pdf";
  const isImage = doc.mime_type?.startsWith("image/");

  return (
    <div className="shared-doc-page">
      <header className="shared-doc-header">
        <a href="/" className="shared-doc-brand">hey<span>Scotty</span>Bro</a>
        <div className="shared-doc-title">{doc.name}</div>
        <a className="btn" href={url} download={doc.filename}>
          <i className="fa-solid fa-download" /> Download ({formatBytes(doc.size_bytes)})
        </a>
      </header>

      <main className="shared-doc-body">
        {isPdf && (
          <div className="shared-doc-pdf">
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="shared-doc-center"><i className="fa-solid fa-spinner fa-spin" /></div>}
              error={<div className="shared-doc-center">Could not render this PDF. Try downloading it.</div>}
            >
              <Page pageNumber={pageNumber} width={Math.min(window.innerWidth - 40, 860)} />
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
          </div>
        )}
        {isImage && <img src={url} alt={doc.name} style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }} />}
        {!isPdf && !isImage && (
          <div className="shared-doc-center">
            <i className="fa-solid fa-file-lines" style={{ fontSize: "4rem", opacity: 0.4 }} />
            <p>Preview not available for this file type.</p>
            <a className="btn" href={url} download={doc.filename}>Download to open</a>
          </div>
        )}
      </main>
    </div>
  );
}

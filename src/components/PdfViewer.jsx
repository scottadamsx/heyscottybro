import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./PdfViewer.css";

// Worker copied to /public during setup (matches the installed pdfjs-dist version).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.2;

/**
 * A full-featured, reusable PDF viewer modal: paging, zoom, fit-to-width,
 * download, open-in-new-tab and keyboard navigation. Accepts either a `fileUrl`
<<<<<<< Updated upstream
 * (signed/remote URL) or a `blob` (e.g. a PDF an agent just generated).
 *
 * Props:
 *   fileUrl?  string         remote/signed PDF URL
 *   blob?     Blob           in-memory PDF (object URL is managed for you)
 *   title?    string         shown in the toolbar
 *   filename? string         download name (default "document.pdf")
 *   onClose() void           close handler (overlay click / Esc / ✕)
=======
 * (signed/remote URL) or a `blob` (an in-memory PDF; its object URL is managed).
 *
 * Props:
 *   fileUrl?  string   remote/signed PDF URL
 *   blob?     Blob     in-memory PDF
 *   title?    string   shown in the toolbar
 *   filename? string   download name (default "document.pdf")
 *   onClose() void     close handler (overlay click / Esc / ✕)
>>>>>>> Stashed changes
 */
export default function PdfViewer({ fileUrl, blob, title = "Document", filename = "document.pdf", onClose }) {
  // A blob gets its own object URL (revoked on unmount); otherwise use fileUrl.
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  const url = blobUrl || fileUrl || null;

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const stageRef = useRef(null);

  // Track the stage width so pages render crisp and responsive.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages || 1, p + 1));
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)));
  const fit = () => setScale(1);

  // Keyboard: arrows page, +/- zoom, 0 fit, Esc close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-" || e.key === "_") zoomOut();
      else if (e.key === "0") fit();
      else if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  const baseWidth = Math.max(280, Math.min(containerWidth - 24, 1400));
  const renderWidth = Math.round(baseWidth * scale);

  return (
    <div className="pdfv-overlay" onClick={onClose}>
      <div className="pdfv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdfv-toolbar">
          <div className="pdfv-title" title={title}>
            <i className="fa-solid fa-file-pdf" /> <span>{title}</span>
          </div>

          <div className="pdfv-tools">
            <div className="pdfv-group">
              <button className="pdfv-btn" onClick={goPrev} disabled={pageNumber <= 1} title="Previous page (←)">
                <i className="fa-solid fa-chevron-left" />
              </button>
              <span className="pdfv-pageno">{numPages ? `${pageNumber} / ${numPages}` : "—"}</span>
              <button className="pdfv-btn" onClick={goNext} disabled={!numPages || pageNumber >= numPages} title="Next page (→)">
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>

            <div className="pdfv-group">
              <button className="pdfv-btn" onClick={zoomOut} disabled={scale <= MIN_SCALE} title="Zoom out (-)">
                <i className="fa-solid fa-magnifying-glass-minus" />
              </button>
              <button className="pdfv-btn pdfv-zoomlabel" onClick={fit} title="Fit width (0)">{Math.round(scale * 100)}%</button>
              <button className="pdfv-btn" onClick={zoomIn} disabled={scale >= MAX_SCALE} title="Zoom in (+)">
                <i className="fa-solid fa-magnifying-glass-plus" />
              </button>
            </div>

            <div className="pdfv-group">
              {url && (
                <a className="pdfv-btn" href={url} download={filename} title="Download">
                  <i className="fa-solid fa-download" />
                </a>
              )}
              {url && (
                <a className="pdfv-btn" href={url} target="_blank" rel="noreferrer" title="Open in new tab">
                  <i className="fa-solid fa-up-right-from-square" />
                </a>
              )}
              <button className="pdfv-btn pdfv-close" onClick={onClose} title="Close (Esc)" aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
        </div>

        <div className="pdfv-stage" ref={stageRef}>
          {!url && <div className="pdfv-msg">No file to display.</div>}
          {error && <div className="pdfv-msg pdfv-error"><i className="fa-solid fa-triangle-exclamation" /> {error}</div>}
          {url && !error && (
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => { setNumPages(numPages); setError(null); }}
              onLoadError={(e) => setError(e?.message || "Could not load this PDF.")}
              loading={<div className="pdfv-msg"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>}
              error={<div className="pdfv-msg pdfv-error">Could not render this PDF.</div>}
            >
              <Page
                pageNumber={pageNumber}
                width={renderWidth}
                className="pdfv-page"
                renderAnnotationLayer
                renderTextLayer
                loading={<div className="pdfv-msg"><i className="fa-solid fa-spinner fa-spin" /></div>}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}

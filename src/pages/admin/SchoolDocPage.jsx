import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getNodeBySlug } from "../../api/docLinksApi";
import { getDocument, getSignedUrl } from "../../api/documentsApi";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
import { ExportKit } from "../../components/ui";
import MarkdownBody from "../../components/MarkdownBody";
import UpdatedMeta from "../../components/UpdatedMeta";
import { PageSkeleton } from "../../components/Skeleton";
import "./reader.css"; // .reader-tag
import "./schooldoc.css";

/**
 * School document split view: the ACTUAL document (PDF/image, straight from
 * the vault) on the left, the Brain note distilled from it on the right —
 * source and knowledge, side by side. Falls back to the plain reader layout
 * when a note has no stored file.
 */
export default function SchoolDocPage() {
  const params = useParams();
  const slug = params["*"] || "";
  const navigate = useNavigate();
  const [node, setNode] = useState(undefined);
  const [doc, setDoc] = useState(null);
  const [url, setUrl] = useState(null);
  const [loadError, setLoadError] = useState(null); // the note itself couldn't be read
  const [fileError, setFileError] = useState(null); // the note loaded, its original file didn't
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setNode(undefined); setLoadError(null); setFileError(null); setDoc(null); setUrl(null);
    (async () => {
      let n;
      try {
        n = await getNodeBySlug(slug);
      } catch (err) {
        console.error("[school-doc] load failed", err);
        if (alive) setLoadError(`Couldn't load this document: ${err?.message || err}`);
        return;
      }
      if (!alive) return;
      setNode(n || null);
      const tag = (n?.tags || []).find((t) => t.startsWith("doc:"));
      if (!tag) return;
      try {
        const d = await getDocument(tag.slice(4));
        if (!alive) return;
        setDoc(d);
        setUrl(await getSignedUrl(d.storage_path || d.path));
      } catch (err) {
        console.error("[school-doc] file load failed", err);
        if (alive) setFileError(`Couldn't fetch the original file: ${err?.message || err}`);
      }
    })();
    return () => { alive = false; };
  }, [slug, attempt]);

  if (loadError) return (
    <div className="module-page">
      <div className="load-error" role="alert">
        <p className="load-error-msg">{loadError}</p>
        <button type="button" className="btn btn-sm" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      </div>
    </div>
  );
  if (node === undefined) return <PageSkeleton variant="reader" label="Loading document" actions={2} />;
  if (node === null) return (
    <div className="module-page">
      <p className="no-entries">Document not found — it may have been deleted.</p>
      <div><button type="button" className="btn btn-sm" onClick={() => navigate("/admin/school")}>Back to School</button></div>
    </div>
  );

  // The note's summary (the stored source text section is redundant beside the real file)
  const body = String(node.body || "").split("\n---\n")[0];
  const isPdf = doc && /pdf$/i.test(doc.filename || doc.name || "");
  const isImage = doc && /\.(png|jpe?g|gif|webp|heic)$/i.test(doc.filename || "");

  return (
    <div className="module-page schooldoc-page">
      <div className="schooldoc-bar">
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => navigate("/admin/school")}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> School
        </button>
        <div className="schooldoc-bar-actions">
          <ExportKit exporter={{ title: node.title || slug, filename: docId(node.title, slug).toLowerCase(), toMarkdown: () => node.body || "" }} />
          {url && <a className="btn btn-sm btn-secondary-sm" href={url} target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Open original</a>}
        </div>
      </div>

      <div className={`schooldoc-split${doc || fileError ? "" : " single"}`}>
        {(doc || fileError) && (
          <section className="schooldoc-doc">
            <h2 className="schooldoc-pane-title"><i className="fa-solid fa-file-lines" aria-hidden="true" /> The document</h2>
            {url && isPdf && <iframe title={doc?.name} src={url} className="schooldoc-frame" />}
            {url && isImage && <img src={url} alt={doc?.name} className="schooldoc-img" />}
            {url && !isPdf && !isImage && (
              <p className="no-entries">Preview not available — <a href={url} target="_blank" rel="noreferrer">open the original</a>.</p>
            )}
            {!url && !fileError && <p className="no-entries" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Fetching the file…</p>}
            {fileError && <p className="load-error load-error-msg" role="alert">{fileError}</p>}
          </section>
        )}

        <section className="schooldoc-note">
          <h2 className="schooldoc-pane-title"><i className="fa-solid fa-brain" aria-hidden="true" /> What the Brain took from it</h2>
          <h1 className="schooldoc-title">{node.title}</h1>
          <div className="schooldoc-meta">
            {(node.tags || []).filter((t) => !t.startsWith("doc:")).map((t) => <span key={t} className="reader-tag">#{t}</span>)}
            <CopyId id={docId(node.title, node.slug)} />
            <UpdatedMeta at={node.updated_at} always />
          </div>
          <MarkdownBody className="chat-md schooldoc-body" html={renderMarkdown(body)} />
          <p className="schooldoc-foot">
            This note is in your <Link to="/admin/mission?tab=brain">Brain</Link> — Frodo and the agents can reference it.
          </p>
        </section>
      </div>
    </div>
  );
}

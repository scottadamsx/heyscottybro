import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getNodeBySlug } from "../../api/docLinksApi";
import { getDocument, getSignedUrl } from "../../api/documentsApi";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
import { ExportKit } from "../../components/ui";
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const n = await getNodeBySlug(slug);
        if (!alive) return;
        setNode(n || null);
        const tag = (n?.tags || []).find((t) => t.startsWith("doc:"));
        if (tag) {
          const d = await getDocument(tag.slice(4));
          if (!alive) return;
          setDoc(d);
          setUrl(await getSignedUrl(d.storage_path || d.path));
        }
      } catch { if (alive) setNode((cur) => cur ?? null); }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (node === undefined) return <div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading document…</p></div>;
  if (node === null) return (
    <div className="module-page">
      <p className="no-entries">Document not found — it may have been deleted.</p>
      <button className="btn btn-sm" onClick={() => navigate("/admin/school")}>Back to School</button>
    </div>
  );

  // The note's summary (the stored source text section is redundant beside the real file)
  const body = String(node.body || "").split("\n---\n")[0];
  const isPdf = doc && /pdf$/i.test(doc.filename || doc.name || "");
  const isImage = doc && /\.(png|jpe?g|gif|webp|heic)$/i.test(doc.filename || "");

  return (
    <div className="module-page schooldoc-page">
      <div className="schooldoc-bar">
        <button className="btn btn-sm btn-secondary-sm" onClick={() => navigate("/admin/school")}>
          <i className="fa-solid fa-arrow-left" /> School
        </button>
        <div className="schooldoc-bar-actions">
          <ExportKit exporter={{ title: node.title || slug, filename: docId(node.title, slug).toLowerCase(), toMarkdown: () => node.body || "" }} />
          {url && <a className="btn btn-sm btn-secondary-sm" href={url} target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /> Open original</a>}
        </div>
      </div>

      <div className={`schooldoc-split${doc ? "" : " single"}`}>
        {doc && (
          <section className="schooldoc-doc">
            <div className="schooldoc-pane-title"><i className="fa-solid fa-file-lines" /> The document</div>
            {url && isPdf && <iframe title={doc.name} src={url} className="schooldoc-frame" />}
            {url && isImage && <img src={url} alt={doc.name} className="schooldoc-img" />}
            {url && !isPdf && !isImage && (
              <p className="no-entries">Preview not available — <a href={url} target="_blank" rel="noreferrer">open the original</a>.</p>
            )}
            {!url && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Fetching the file…</p>}
          </section>
        )}

        <section className="schooldoc-note">
          <div className="schooldoc-pane-title"><i className="fa-solid fa-brain" /> What the Brain took from it</div>
          <h1 className="schooldoc-title">{node.title}</h1>
          <div className="schooldoc-meta">
            {(node.tags || []).filter((t) => !t.startsWith("doc:")).map((t) => <span key={t} className="reader-tag">#{t}</span>)}
            <CopyId id={docId(node.title, node.slug)} />
          </div>
          <div className="chat-md schooldoc-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
          <p className="schooldoc-foot">
            This note is in your <Link to="/admin/mission?tab=brain">Brain</Link> — Frodo and the agents can reference it.
          </p>
        </section>
      </div>
    </div>
  );
}

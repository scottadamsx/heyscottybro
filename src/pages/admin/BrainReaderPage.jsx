import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getNodeBySlug, setDocRead } from "../../api/docLinksApi";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
import { ExportKit } from "../../components/ui";
import MarkdownBody from "../../components/MarkdownBody";
import UpdatedMeta from "../../components/UpdatedMeta";
import { PageSkeleton } from "../../components/Skeleton";
import "./reader.css";

/**
 * Full-page, phone-friendly reader for a single Brain note. Addressable by slug
 * (the note's "unique id"): /admin/read/<slug>. A reminder (or any host item)
 * links a note via doc_links; opening that link lands here and renders the
 * markdown as a clean article. When opened with ?link=<id>, the originating
 * doc link is marked read.
 */

// Vault notes carry YAML frontmatter and a leading "# Title" we already show in
// the header; wikilinks and blockquote markers read badly raw. Clean them up so
// the body renders as an article, not a source file.
function prepArticle(body = "") {
  let t = String(body).replace(/^\uFEFF/, "");
  t = t.replace(/^---\n[\s\S]*?\n---\n?/, "");            // drop frontmatter block
  t = t.replace(/^\s*#\s+.*(\r?\n)+/, "");                 // drop the leading title line
  t = t.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {       // [[target|label]] -> label
    const [target, label] = inner.split("|");
    return (label || target.split("/").pop() || target).trim();
  });
  t = t.replace(/^>\s?/gm, "");                            // strip blockquote markers
  return t.trim();
}

export default function BrainReaderPage() {
  const params = useParams();
  const slug = params["*"] || "";
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const linkId = search.get("link");

  const [node, setNode] = useState(undefined); // undefined = loading, null = not found
  const [loadError, setLoadError] = useState(null); // a failed read is NOT "not in your Brain"
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setNode(undefined);
    setLoadError(null);
    getNodeBySlug(slug)
      .then((n) => { if (alive) setNode(n || null); })
      .catch((err) => {
        console.error("[brain-reader] load failed", err);
        if (alive) { setLoadError(`Couldn't load this note: ${err?.message || err}`); setNode(false); }
      });
    return () => { alive = false; };
  }, [slug, attempt]);

  // Mark the originating doc link read, once, when arriving from a host item.
  useEffect(() => { if (linkId) setDocRead(linkId, true).catch((err) => console.warn("[brain-reader] mark doc link read failed", err)); }, [linkId]);

  const html = useMemo(
    () => (node ? renderMarkdown(prepArticle(node.body || "_(empty document)_")) : ""),
    [node],
  );

  return (
    <div className="reader-page">
      <div className="reader-bar">
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => navigate(-1)}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back
        </button>
        <div className="reader-bar-actions">
          {node && (
            <ExportKit exporter={{
              title: node.title || node.slug,
              filename: docId(node.title, node.slug).toLowerCase(),
              toMarkdown: () => node.body || "",
            }} />
          )}
          <a className="btn btn-sm btn-secondary-sm" href="/admin/mission?tab=brain" title="Open the Brain graph">
            <i className="fa-solid fa-diagram-project" aria-hidden="true" /> Brain
          </a>
        </div>
      </div>

      {node === undefined && (
        <div className="reader-article reader-loading"><PageSkeleton variant="reader" label="Loading note" header={false} page={false} /></div>
      )}

      {loadError && (
        <div className="reader-article">
          <div className="load-error" role="alert">
            <p className="load-error-msg">{loadError}</p>
            <button type="button" className="btn btn-sm" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
          </div>
        </div>
      )}

      {node === null && (
        <div className="reader-article">
          <h1>Not in your Brain</h1>
          <p className="no-entries">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> No note found for <code>{slug || "(no id)"}</code>. It may have been renamed or removed since it was linked.
          </p>
        </div>
      )}

      {node && (
        <article className="reader-article">
          <header className="reader-head">
            <h1>{node.title || node.slug}</h1>
            <div className="reader-meta">
              {node.type && node.type !== "note" && <span className="reader-pill">{node.type}</span>}
              {(node.tags || []).slice(0, 6).map((t) => <span key={t} className="reader-tag">#{t}</span>)}
              <UpdatedMeta at={node.updated_at} always className="reader-date" />
            </div>
          </header>
          <MarkdownBody className="reader-body chat-md" html={html} />
          <footer className="reader-foot">
            <CopyId id={docId(node.title, node.slug)} />
          </footer>
        </article>
      )}
    </div>
  );
}

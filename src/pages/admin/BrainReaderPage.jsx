import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getNodeBySlug, setDocRead } from "../../api/docLinksApi";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
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
  let t = String(body).replace(/^﻿/, "");
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

  useEffect(() => {
    let alive = true;
    setNode(undefined);
    getNodeBySlug(slug)
      .then((n) => { if (alive) setNode(n || null); })
      .catch(() => { if (alive) setNode(null); });
    return () => { alive = false; };
  }, [slug]);

  // Mark the originating doc link read, once, when arriving from a host item.
  useEffect(() => { if (linkId) setDocRead(linkId, true).catch(() => {}); }, [linkId]);

  const html = useMemo(
    () => (node ? renderMarkdown(prepArticle(node.body || "_(empty document)_")) : ""),
    [node],
  );

  const updated = node?.updated_at ? new Date(node.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <div className="reader-page">
      <div className="reader-bar">
        <button className="btn btn-sm" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => navigate(-1)}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <a className="btn btn-sm btn-secondary-sm" href="/admin/brain" title="Open the Brain graph">
          <i className="fa-solid fa-diagram-project" /> Brain
        </a>
      </div>

      {node === undefined && (
        <p className="no-entries" style={{ marginTop: "2rem" }}><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>
      )}

      {node === null && (
        <div className="reader-article">
          <h1>Not in your Brain</h1>
          <p className="no-entries">
            <i className="fa-solid fa-triangle-exclamation" /> No note found for <code>{slug || "(no id)"}</code>. It may have been renamed or removed since it was linked.
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
              {updated && <span className="reader-date">Updated {updated}</span>}
            </div>
          </header>
          <div className="reader-body chat-md" dangerouslySetInnerHTML={{ __html: html }} />
          <footer className="reader-foot">
            <CopyId id={docId(node.title, node.slug)} />
          </footer>
        </article>
      )}
    </div>
  );
}

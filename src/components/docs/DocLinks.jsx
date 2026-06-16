import { useEffect, useMemo, useRef, useState } from "react";
import { loadDocLinks, attachDoc, detachDoc, setDocRead, getNodeBySlug } from "../../api/docLinksApi";
import { loadBrain } from "../../api/brainApi";
import { useToast } from "../../contexts/ToastContext";
import DocViewerModal from "./DocViewerModal";
import "./doclinks.css";

const TYPE_ICON = {
  note: "fa-note-sticky", memory: "fa-brain", project: "fa-diagram-project",
  deliverable: "fa-file-arrow-down", research: "fa-magnifying-glass",
  doc: "fa-file-lines", reference: "fa-link",
};
const icon = (t) => TYPE_ICON[t] || "fa-file-lines";

/**
 * Reusable "linked documents" panel for any host item.
 *
 * Props:
 *   entityType  reminder | event | project | initiative | agent | research
 *   entityId    host id
 *   title       section heading (default "Linked documents")
 *   compact     start collapsed, showing just a count chip
 *   onChange(summary)  optional — called with { count, unread } after loads/edits
 */
export default function DocLinks({ entityType, entityId, title = "Linked documents", compact = false, onChange }) {
  const { addToast } = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(!compact);
  const [picking, setPicking] = useState(false);
  const [nodes, setNodes] = useState(null); // brain nodes for the picker (lazy)
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null); // { node, link }
  const [busyId, setBusyId] = useState(null);
  const pickRef = useRef(null);

  const summarize = (ls) => onChange?.({ count: ls.length, unread: ls.filter((l) => !l.read).length });

  const refresh = () => {
    setLoading(true);
    loadDocLinks(entityType, entityId)
      .then((ls) => { setLinks(ls); summarize(ls); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (entityId) refresh(); /* eslint-disable-next-line */ }, [entityType, entityId]);

  // Close the picker on outside click.
  useEffect(() => {
    if (!picking) return;
    const onDown = (e) => { if (pickRef.current && !pickRef.current.contains(e.target)) setPicking(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [picking]);

  async function openPicker() {
    setPicking(true);
    setQuery("");
    if (nodes === null) {
      try { const b = await loadBrain(); setNodes(b.nodes || []); }
      catch { setNodes([]); }
    }
  }

  const linkedSlugs = useMemo(() => new Set(links.map((l) => l.node_slug)), [links]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (nodes || [])
      .filter((n) => !linkedSlugs.has(n.slug))
      .filter((n) => !q || n.title?.toLowerCase().includes(q) || n.slug?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [nodes, query, linkedSlugs]);

  async function attach(slug) {
    try {
      await attachDoc(entityType, entityId, slug);
      setPicking(false);
      refresh();
    } catch (e) { addToast(e.message || "Could not attach", "error"); }
  }

  async function open_(link) {
    let node = null;
    try { node = await getNodeBySlug(link.node_slug); } catch { /* show not-found */ }
    setViewer({ node, link });
  }

  async function toggleRead(link) {
    setBusyId(link.id);
    try {
      const updated = await setDocRead(link.id, !link.read);
      setLinks((ls) => { const next = ls.map((l) => (l.id === link.id ? { ...l, ...updated } : l)); summarize(next); return next; });
      setViewer((v) => (v && v.link?.id === link.id ? { ...v, link: { ...v.link, ...updated } } : v));
    } catch (e) { addToast(e.message || "Could not update", "error"); }
    finally { setBusyId(null); }
  }

  async function remove(link) {
    try { await detachDoc(link.id); setLinks((ls) => { const next = ls.filter((l) => l.id !== link.id); summarize(next); return next; }); }
    catch (e) { addToast(e.message || "Could not remove", "error"); }
  }

  const unread = links.filter((l) => !l.read).length;

  return (
    <div className="doclinks">
      <button type="button" className="doclinks-head" onClick={() => setOpen((o) => !o)}>
        <i className={`fa-solid fa-chevron-${open ? "down" : "right"} doclinks-caret`} />
        <i className="fa-solid fa-paperclip" />
        <span>{title}</span>
        <span className="doclinks-count">{links.length}{unread > 0 && <em className="doclinks-unread"> · {unread} unread</em>}</span>
      </button>

      {open && (
        <div className="doclinks-body">
          {loading && <p className="no-entries doclinks-empty"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}
          {!loading && links.length === 0 && <p className="no-entries doclinks-empty">No documents linked yet.</p>}

          {links.map((l) => (
            <div className={`doclinks-row${l.read ? " read" : ""}`} key={l.id}>
              <button type="button" className="doclinks-open" onClick={() => open_(l)} title="Open document">
                <span className={`doclinks-dot${l.read ? " read" : ""}`} title={l.read ? "Read" : "Unread"} />
                <i className={`fa-solid ${icon(l.node_type)}`} />
                <span className="doclinks-name">{l.node_title}</span>
                {l.node_missing && <span className="doclinks-missing">missing</span>}
              </button>
              <button
                type="button"
                className="btn-mini"
                onClick={() => toggleRead(l)}
                disabled={busyId === l.id}
                title={l.read ? "Mark unread" : "Mark read"}
              >
                <i className={`fa-solid ${l.read ? "fa-rotate-left" : "fa-check"}`} />
              </button>
              <button type="button" className="btn-mini" onClick={() => remove(l)} title="Unlink"><i className="fa-solid fa-xmark" /></button>
            </div>
          ))}

          <div className="doclinks-attach" ref={pickRef}>
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => (picking ? setPicking(false) : openPicker())}>
              <i className="fa-solid fa-plus" /> Attach document
            </button>
            {picking && (
              <div className="doclinks-picker">
                <input autoFocus placeholder="Search your Brain…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="doclinks-picker-list">
                  {nodes === null && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading Brain…</p>}
                  {nodes !== null && candidates.length === 0 && <p className="no-entries">No matching documents.</p>}
                  {candidates.map((n) => (
                    <button type="button" key={n.slug} className="doclinks-cand" onClick={() => attach(n.slug)}>
                      <i className={`fa-solid ${icon(n.type)}`} />
                      <span className="doclinks-name">{n.title || n.slug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewer && (
        <DocViewerModal
          node={viewer.node}
          link={viewer.link}
          busy={busyId === viewer.link?.id}
          onToggleRead={toggleRead}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

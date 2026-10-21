import { useEffect, useRef, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { PageSkeleton } from "../../components/Skeleton";
import { FormModal, Field } from "../../components/ui";
import { loadBinItems, createBinItem, uploadBinFile, updateBinItem, deleteBinItem, getSignedUrl } from "../../api/binApi";
import { formatBytes } from "../../components/documents/DocumentCard";
import { formatDisplayDate } from "../../utils/dates.js";
import { nextStatus, nextStatusLabel, statusLabel, kindLabel, excerpt, titleFromText } from "../../utils/binHelpers";
import "./bin.css";

const KIND_ICON = { text: "fa-align-left", file: "fa-file", link: "fa-link" };
const FILE_ACCEPT = ".pdf,.docx,.txt,.md";
const MAX_BYTES = 50 * 1024 * 1024;
const CONTEXT_LABEL = "Context for Muse (save it, do not work it)";

function BinCard({ item, onUpdate, onDelete }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const commitTitle = async () => {
    setEditingTitle(false);
    const clean = title.trim();
    if (!clean || clean === item.title) { setTitle(item.title); return; }
    await onUpdate(item, { title: clean });
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(item.body || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable; the text is visible in the preview */ }
  };

  const openFile = async () => {
    setBusy(true);
    try {
      const url = await getSignedUrl(item.file_path, 60);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.file_name || item.title;
      a.click();
    } catch { /* owner can retry */ } finally { setBusy(false); }
  };

  const linkUrl = (item.body || "").split("\n")[0].trim();

  return (
    <div className="bin-card">
      <div className="bin-card-main">
        <div className="bin-card-head">
          <span className="bin-kind"><i className={`fa-solid ${KIND_ICON[item.kind]}`} aria-hidden="true" /> {kindLabel(item.kind)}</span>
          {item.is_context && <span className="bin-pill bin-pill-context">Context</span>}
          <span className={`bin-pill bin-pill-status bin-status-${item.status}`}>{statusLabel(item.status)}</span>
        </div>

        {editingTitle ? (
          <input
            className="bin-title-input"
            value={title}
            autoFocus
            aria-label="Space title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setTitle(item.title); setEditingTitle(false); } }}
          />
        ) : (
          <button type="button" className="bin-title" onClick={() => { setTitle(item.title); setEditingTitle(true); }} title="Rename">
            {item.title}
          </button>
        )}

        {item.kind === "text" && <p className="bin-preview">{excerpt(item.body, 220) || "Empty text space."}</p>}
        {item.kind === "file" && (
          <p className="bin-preview">{item.file_name}{item.file_size != null ? ` · ${formatBytes(item.file_size)}` : ""}</p>
        )}
        {item.kind === "link" && <p className="bin-preview bin-link-preview">{linkUrl}</p>}

        <div className="bin-meta">{formatDisplayDate(new Date(item.created_at))}</div>
      </div>

      <div className="bin-card-actions">
        {item.kind === "text" && (
          <button type="button" className="btn btn-sm" onClick={copyText}>
            <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copied ? "Copied" : "Copy text"}
          </button>
        )}
        {item.kind === "file" && (
          <button type="button" className="btn btn-sm" onClick={openFile} disabled={busy} aria-busy={busy || undefined}>
            <i className="fa-solid fa-download" aria-hidden="true" /> Download
          </button>
        )}
        {item.kind === "link" && (
          <a className="btn btn-sm" href={linkUrl} target="_blank" rel="noopener noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Open
          </a>
        )}
        <button type="button" className="btn btn-sm" onClick={() => onUpdate(item, { status: nextStatus(item.status) })}>
          {nextStatusLabel(item.status)}
        </button>
        <label className="bin-context-toggle" title={CONTEXT_LABEL}>
          <input
            type="checkbox"
            checked={item.is_context}
            onChange={(e) => onUpdate(item, { is_context: e.target.checked })}
          />
          <span>Context</span>
        </label>
        <button type="button" className="btn-mini danger" onClick={() => onDelete(item)} title="Delete" aria-label={`Delete ${item.title}`}>
          <i className="fa-solid fa-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function AddSpaceModal({ onAdded, onClose }) {
  const [kind, setKind] = useState("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isContext, setIsContext] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f.size > MAX_BYTES) { setFileError("File exceeds the 50 MB limit."); return; }
    setFileError(null);
    setFile(f);
  };

  const canSubmit =
    (kind === "text" && body.trim().length > 0) ||
    (kind === "link" && url.trim().length > 0) ||
    (kind === "file" && !!file);

  // A failed add throws: FormModal keeps the modal open and shows the message.
  const handleSubmit = async () => {
    if (kind === "file") {
      const item = await uploadBinFile(file, { title, isContext });
      onAdded(item);
      return;
    }
    if (kind === "link") {
      const linkBody = note.trim() ? `${url.trim()}\n${note.trim()}` : url.trim();
      const item = await createBinItem({ kind, title: title.trim() || url.trim(), body: linkBody, isContext });
      onAdded(item);
      return;
    }
    const item = await createBinItem({ kind, title: title.trim() || titleFromText(body), body, isContext });
    onAdded(item);
  };

  return (
    <FormModal title="Add a space" submitLabel="Add to Bin" submitDisabled={!canSubmit} onClose={onClose} onSubmit={handleSubmit}>
      <div className="bin-kind-picker" role="group" aria-label="Kind of space">
        {[
          ["text", "fa-align-left", "Paste text"],
          ["file", "fa-file-arrow-up", "Upload document"],
          ["link", "fa-link", "Save link"],
        ].map(([k, icon, label]) => (
          <button
            key={k}
            type="button"
            className={`chip${kind === k ? " active" : ""}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            <i className={`fa-solid ${icon}`} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {kind === "text" && (
        <>
          <Field label="Text">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Paste anything here: notes, an excerpt, a draft." data-autofocus />
          </Field>
          <Field label="Title" hint="Optional. Defaults to the first words of the text.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </>
      )}

      {kind === "file" && (
        <>
          <button type="button" className="doc-dropzone" onClick={() => inputRef.current.click()} data-autofocus>
            <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
            <span>{file ? file.name : "Click to choose a document (PDF, DOCX, TXT, MD)"}</span>
          </button>
          <input ref={inputRef} type="file" accept={FILE_ACCEPT} hidden onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          {fileError && <p className="doc-upload-error" role="alert">{fileError}</p>}
          <Field label="Title" hint="Optional. Defaults to the file name.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </>
      )}

      {kind === "link" && (
        <>
          <Field label="Link">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" inputMode="url" data-autofocus />
          </Field>
          <Field label="Title" hint="Optional. Defaults to the link.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Note" hint="Optional. Why this link matters.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </>
      )}

      <label className="checkbox-inline">
        <input type="checkbox" checked={isContext} onChange={(e) => setIsContext(e.target.checked)} />
        <span>{CONTEXT_LABEL}</span>
      </label>
    </FormModal>
  );
}

export default function BinPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const { confirm, dialog } = useConfirm();

  function load() {
    setLoading(true);
    setError(null);
    loadBinItems()
      .then(setItems)
      .catch((err) => { console.error("[bin] load failed", err); setError(`Couldn't load the Bin: ${err?.message || err}`); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const handleAdded = (item) => setItems((list) => [item, ...list]);

  const handleUpdate = async (item, fields) => {
    try {
      const updated = await updateBinItem(item.id, fields);
      setItems((list) => list.map((x) => (x.id === item.id ? { ...x, ...updated } : x)));
    } catch (err) {
      setError(`Couldn't update "${item.title}": ${err?.message || err}`);
    }
  };

  const handleDelete = async (item) => {
    if (!await confirm(`Delete "${item.title}" from the Bin? This cannot be undone.`, { title: "Delete bin space", confirmLabel: "Delete" })) return;
    try {
      await deleteBinItem(item);
      setItems((list) => list.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(`Couldn't delete "${item.title}": ${err?.message || err}`);
    }
  };

  const newCount = items.filter((i) => i.status === "new").length;

  return (
    <div className="module-page bin-page">
      <div className="module-header">
        <h1>Bin{!loading && !error ? <span className="bin-count">{items.length}</span> : null}</h1>
        <button type="button" className="btn btn-sm" onClick={() => setShowAdd(true)}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add space
        </button>
      </div>

      <p className="vault-intro">
        <i className="fa-solid fa-box-open" aria-hidden="true" /> Your remote clipboard. Drop text, documents, and links here from any computer, and Muse takes each space and turns it into finished work. Mark a space as context and Muse saves it as part of your life context instead of working it.
      </p>

      {showAdd && <AddSpaceModal onAdded={handleAdded} onClose={() => setShowAdd(false)} />}

      {loading && <PageSkeleton variant="cards" label="Loading the Bin" header={false} page={false} />}
      {error && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{error}</p>
          <button type="button" className="btn btn-sm" onClick={load}>Retry</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="no-entries">
          The Bin is empty. Add a space to drop in the first thing: paste a text excerpt from your work computer, upload a document, or save a link. Anything marked New is waiting for Muse to pick it up.
        </p>
      )}
      {!loading && !error && items.length > 0 && (
        <p className="bin-summary">{newCount} of {items.length} waiting to be picked up</p>
      )}

      <div className="doc-grid">
        {items.map((item) => (
          <BinCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}
      </div>

      {dialog}
    </div>
  );
}

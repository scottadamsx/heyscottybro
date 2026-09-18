import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadJournal, newJournalEntry, updateJournalEntry, deleteJournalEntry } from "../../api/plannerApi";
import DatePicker from "../../components/DatePicker";
import { FormModal, Field } from "../../components/ui";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { loadDraft, saveDraft, clearDraft, JOURNAL_NEW_DRAFT, journalEditDraft } from "../../utils/drafts";
import { journalToMarkdown, journalExportFilename } from "../../utils/journalExport";
import { downloadMarkdown } from "../../lib/exporter";
import UpdatedMeta from "../../components/UpdatedMeta";
import { SkeletonRegion, SkeletonRows } from "../../components/Skeleton";

const monthLabel = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
const shortDay = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const savedTime = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const draftFailedMsg = "Couldn't auto-save this draft — browser storage is full or blocked. Save it before closing.";

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  // ?new=1 opens the compose modal (deep-linkable, and keeps other params like tab=journal).
  const composeOpen = params.get("new") === "1";

  const [entries, setEntries] = useState([]);
  // The compose modal is write-through cached (utils/drafts) so closing it,
  // clicking another entry, switching Life tabs or reloading never loses what's been typed.
  const [restoredDraft, setRestoredDraft] = useState(() => loadDraft(JOURNAL_NEW_DRAFT));
  const [compose, setCompose] = useState(() => restoredDraft?.fields ?? {});
  const [draftFailed, setDraftFailed] = useState(false);
  const title = compose.title || "";
  const entry = compose.entry || "";
  const hasDraft = Boolean(title.trim() || entry.trim());
  const updateCompose = (patch) => {
    const next = { ...compose, ...patch };
    setCompose(next);
    setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, next));
  };
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null); // a failed load is NOT "no entries yet"

  const load = async () => {
    try { setEntries(await loadJournal()); setLoadError(null); }
    catch (err) {
      console.error("[journal] load failed", err);
      setLoadError(`Couldn't load journal entries: ${err?.message || err}`);
      addToast(`Couldn't load journal entries: ${err?.message || err}`, "error");
    }
    setReady(true);
  };
  useEffect(() => { load(); }, []);

  const selectedEntry = entries.find((e) => String(e.id) === String(selectedId));

  const handleDelete = async (e) => {
    if (!await confirm(`Delete "${e.title}"? This can't be undone.`, { title: "Delete entry", confirmLabel: "Delete" })) return;
    try {
      await deleteJournalEntry(e.id);
      clearDraft(journalEditDraft(e.id));
      await load();
      const next = new URLSearchParams(params);
      next.delete("id");
      setParams(next);
      addToast("Entry deleted.", "success");
    } catch (err) {
      addToast(`Couldn't delete entry: ${err?.message || "unknown error"}`, "error");
    }
  };

  const todayLong = formatDisplayDate(toDateStr(new Date()));

  const entryFields = (e) => ({ title: e.title || "", entry: e.entry || "", date: e.date || toDateStr(new Date()) });
  // Edits are cached per entry too; closing the edit modal (or leaving the entry)
  // keeps the draft and the Edit button becomes "Resume edits". Only Discard or a
  // successful save clears it.
  const startEdit = (e) => { setEditForm(loadDraft(journalEditDraft(e.id))?.fields ?? entryFields(e)); setEditing(true); };
  const updateEdit = (patch) => {
    const next = { ...editForm, ...patch };
    setEditForm(next);
    setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), next));
  };
  const isEditDirty = () => {
    const orig = entryFields(selectedEntry);
    return ["title", "entry", "date"].some((k) => editForm[k] !== orig[k]);
  };
  const closeEdit = () => { setEditing(false); setEditForm(null); };
  const dismissEdit = () => {
    // Edits that match the saved entry leave nothing to resume.
    if (selectedEntry && editForm && !isEditDirty()) clearDraft(journalEditDraft(selectedEntry.id));
    closeEdit();
  };
  const discardEdit = async () => {
    if (isEditDirty() && !await confirm("Discard your unsaved changes to this entry?", { title: "Discard changes", confirmLabel: "Discard" })) return;
    clearDraft(journalEditDraft(selectedEntry.id));
    closeEdit();
  };
  const discardDraft = async () => {
    if (!await confirm("Discard this draft? The text will be gone for good.", { title: "Discard draft", confirmLabel: "Discard" })) return;
    clearDraft(JOURNAL_NEW_DRAFT);
    setCompose({});
    setDraftFailed(false);
    setRestoredDraft(null);
  };
  const saveEdit = async () => {
    if (!selectedEntry || !editForm.entry.trim()) return false;
    const fields = { title: editForm.title.trim() || formatDisplayDate(editForm.date), entry: editForm.entry.trim(), date: editForm.date };
    const prev = selectedEntry;
    // Optimistic: show the edit immediately; on failure roll back and keep the modal open with the error.
    setEntries((list) => list.map((x) => x.id === prev.id ? { ...x, ...fields, updated_at: new Date().toISOString() } : x));
    try {
      await updateJournalEntry(prev.id, fields);
    } catch (err) {
      setEntries((list) => list.map((x) => x.id === prev.id ? prev : x));
      throw new Error(`Couldn't save entry: ${err?.message || "unknown error"}`, { cause: err });
    }
    clearDraft(journalEditDraft(prev.id));
    closeEdit();
    addToast("Entry updated.", "success");
    load(); // pick up the server's updated_at (set by the journal_updated_at trigger)
    return false; // already closed (closeEdit), without dismissEdit's draft check
  };

  const submit = async () => {
    if (!entry.trim()) return false;
    try {
      await newJournalEntry({ title: title.trim() || todayLong, entry: entry.trim(), date: toDateStr(new Date()) });
    } catch (err) {
      throw new Error(`Couldn't save entry: ${err?.message || "unknown error"}`, { cause: err });
    }
    // Only clear the draft once the save has actually succeeded.
    clearDraft(JOURNAL_NEW_DRAFT);
    setCompose({});
    setDraftFailed(false);
    setRestoredDraft(null);
    await load();
  };

  const hasEditDraft = selectedEntry && !editing && loadDraft(journalEditDraft(selectedEntry.id)) !== null;

  // Sort entries newest first for the list
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const openCompose = () => {
    // Preserve other params (e.g. tab=journal when embedded in Life)
    const next = new URLSearchParams(params);
    next.set("new", "1");
    setParams(next);
  };
  // Closing the compose modal keeps the draft; the header button and the banner offer "Resume".
  const closeCompose = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("new");
      return next;
    });
  };

  const exportAll = () => {
    try {
      downloadMarkdown(journalToMarkdown(entries), journalExportFilename());
      addToast(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`, "success");
    } catch (err) {
      addToast(`Couldn't export journal: ${err?.message || "unknown error"}`, "error");
    }
  };

  const hasMain = Boolean(selectedEntry) || hasDraft;

  return (
    <div className="module-page journal">
      <div className="module-header">
        <h1>Journal</h1>
        <div className="header-actions">
          {ready && !loadError && entries.length > 0 && (
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={exportAll} title="Download every entry as one Markdown file">
              <i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Export .md
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={openCompose}>
            <i className={`fa-solid ${hasDraft ? "fa-pen-to-square" : "fa-plus"}`} aria-hidden="true" /> {hasDraft ? "Resume draft" : "New entry"}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => { setReady(false); load(); }}>Retry</button>
        </div>
      )}

      <div className={`journal-layout${hasMain ? "" : " is-index-only"}`}>
        {hasMain && (
          <div className="journal-main">
            {/* Draft reminder — the unsaved text is never just hidden */}
            {hasDraft && (
              <div className="draft-banner" role="status">
                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                <span className="draft-banner-preview"><strong>Unsaved draft:</strong> {title.trim() || entry.trim()}</span>
                <button type="button" className="btn btn-sm btn-secondary-sm" onClick={openCompose}>Continue writing</button>
              </div>
            )}

            {/* Single entry — read like a page */}
            {selectedEntry && (
              <article className="journal-sheet is-reading">
                <div className="journal-sheet-head">
                  {/* Untitled entries already show the date as their title */}
                  <p className="journal-sheet-date">{selectedEntry.title !== formatDisplayDate(selectedEntry.date) ? formatDisplayDate(selectedEntry.date) : ""}</p>
                  <div className="journal-sheet-actions">
                    <button type="button" className="btn-sm btn-secondary-sm" onClick={() => startEdit(selectedEntry)} title={hasEditDraft ? "You have unsaved edits to this entry" : "Edit entry"}>
                      <i className="fa-solid fa-pen" aria-hidden="true" /> {hasEditDraft ? "Resume edits" : "Edit"}
                    </button>
                    <button type="button" className="btn-delete" onClick={() => handleDelete(selectedEntry)} title="Delete entry">
                      <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
                <h2 className="journal-sheet-title">{selectedEntry.title}</h2>
                <UpdatedMeta at={selectedEntry.updated_at} createdAt={selectedEntry.created_at} className="journal-sheet-updated" />
                <p className="journal-sheet-body">{selectedEntry.entry}</p>
              </article>
            )}
          </div>
        )}

        {/* Entries index — always shown once loaded (a load error is rendered above, never as "no entries") */}
        {(!ready || !loadError) && (
          <aside className="journal-index" aria-label="Journal entries">
            <div className="journal-index-head">
              <h2 className="db-card-title">Entries</h2>
              {ready && <span className="db-count">{sortedEntries.length}<span className="visually-hidden"> {sortedEntries.length === 1 ? "entry" : "entries"}</span></span>}
            </div>
            {!ready ? (
              <SkeletonRegion label="Loading journal entries" inline><SkeletonRows rows={6} actions={false} /></SkeletonRegion>
            ) : sortedEntries.length === 0 ? (
              <p className="no-entries">No journal entries yet. Start writing!</p>
            ) : (
              <div className="journal-list">
                {sortedEntries.map((e, i) => {
                  const month = monthLabel(e.date);
                  const isActive = String(e.id) === String(selectedId);
                  return (
                    <Fragment key={e.id}>
                      {(i === 0 || monthLabel(sortedEntries[i - 1].date) !== month) && <h3 className="journal-month">{month}</h3>}
                      <button
                        type="button"
                        className={`journal-list-item${isActive ? " active" : ""}`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => {
                          // Preserve other params (e.g. tab=journal when embedded in Life)
                          const next = new URLSearchParams(params);
                          next.set("id", String(e.id));
                          next.delete("new");
                          setParams(next);
                          closeEdit(); // any in-progress edit stays cached as a draft
                        }}
                      >
                        <span className="journal-list-top">
                          <span className="journal-list-title">{e.title}</span>
                          <span className="journal-list-date">{shortDay(e.date)}</span>
                        </span>
                        <span className="journal-list-preview">{e.entry.slice(0, 90)}{e.entry.length > 90 ? "…" : ""}</span>
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Compose — every keystroke is cached as a draft; closing keeps it */}
      {composeOpen && (
        <FormModal
          title="New entry"
          width={720}
          className="journal-modal"
          submitLabel="Save entry"
          submitDisabled={!entry.trim()}
          onClose={closeCompose}
          onSubmit={submit}
          extraActions={hasDraft && <button className="btn btn-ghost" type="button" onClick={discardDraft}>Discard draft</button>}
        >
          <p className="journal-sheet-date">{todayLong}</p>
          <Field label="Title">
            <input value={title} onChange={(e) => updateCompose({ title: e.target.value })} placeholder={`Defaults to "${todayLong}"`} />
          </Field>
          <Field label="Entry">
            <textarea
              className="journal-body-field"
              value={entry}
              onChange={(e) => updateCompose({ entry: e.target.value })}
              rows={12}
              placeholder="Write your thoughts..."
              required
              data-autofocus
            />
          </Field>
          {draftFailed ? (
            <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>
          ) : hasDraft ? (
            <p className="draft-status" role="status">
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Draft auto-saved on this device
              {restoredDraft?.savedAt ? ` · restored from ${savedTime(restoredDraft.savedAt)}` : ""}
            </p>
          ) : null}
        </FormModal>
      )}

      {/* Edit — cached per entry; closing keeps the edits for "Resume edits" */}
      {editing && editForm && selectedEntry && (
        <FormModal
          title="Edit entry"
          width={720}
          className="journal-modal"
          submitLabel="Save changes"
          submitDisabled={!editForm.entry.trim()}
          onClose={dismissEdit}
          onSubmit={saveEdit}
          extraActions={<button className="btn btn-ghost" type="button" onClick={discardEdit}>Discard changes</button>}
        >
          <div className="journal-edit-row">
            <Field label="Title" className="journal-edit-title">
              <input value={editForm.title} onChange={(e) => updateEdit({ title: e.target.value })} placeholder="Title" />
            </Field>
            {/* Not a <label>: the picker is a button + portal popover */}
            <div className="uik-field journal-edit-date">
              <span className="field-label">Date</span>
              <DatePicker value={editForm.date} onChange={(v) => updateEdit({ date: v })} placeholder="Date" />
            </div>
          </div>
          <Field label="Entry">
            <textarea className="journal-body-field" value={editForm.entry} onChange={(e) => updateEdit({ entry: e.target.value })} rows={12} required data-autofocus />
          </Field>
          {draftFailed && <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>}
        </FormModal>
      )}
      {dialog}
    </div>
  );
}

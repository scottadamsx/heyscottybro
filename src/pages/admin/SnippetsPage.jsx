import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "react-router-dom";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import EmptyState from "../../components/EmptyState";
import { SkeletonList } from "../../components/Skeleton";
import {
  getSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  importSnippets,
} from "../../api/snippetsApi";
import { FormModal, Field } from "../../components/ui";
import "./mission.css";

const TYPES = [
  { key: "code", label: "Code / Combo", icon: "fa-hashtag", secret: true },
  { key: "password", label: "Password", icon: "fa-key", secret: true },
  { key: "wifi", label: "Wi-Fi", icon: "fa-wifi", secret: true },
  { key: "card", label: "Card", icon: "fa-credit-card", secret: true },
  { key: "note", label: "Note", icon: "fa-note-sticky", secret: false },
  { key: "prompt", label: "Prompt", icon: "fa-robot", secret: false },
  { key: "other", label: "Other", icon: "fa-circle-dot", secret: false },
];
const typeInfo = (k) => TYPES.find((t) => t.key === k) || TYPES[5];
const isUrl = (s) => /^https?:\/\//i.test((s || "").trim());

// Old localStorage type keys → new schema keys (one-time import remap).
const TYPE_MAP = { login: "password", link: "other", location: "other" };

const emptyForm = (type = "code") => ({
  title: "",
  value: "",
  type,
  secret: typeInfo(type).secret,
  notes: "",
});

export default function SnippetsPage() {
  const [params] = useSearchParams();
  const typeFilter = params.get("type") || "all";
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();

  // Data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(() => emptyForm());

  // Edit form
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // UI
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search); // typing stays instant; filtering catches up
  const [revealed, setRevealed] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState(null);

  // One-time import
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSnippets();
      setItems(data);
      checkLocalStorageImport();
    } catch {
      setError("Failed to load vault. Check your connection.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadItems(); }, []);

  function checkLocalStorageImport() {
    try {
      const raw = localStorage.getItem("vaultSnippets");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        setImportCount(parsed.items.length);
      }
    } catch { /* ignore */ }
  }

  // Modal saves: a thrown error stays in the modal with what was typed (DR-019).
  async function handleAdd() {
    if (!addForm.title.trim() || !addForm.value.trim()) return false;
    let created;
    try {
      created = await createSnippet({
        title: addForm.title.trim(),
        value: addForm.value.trim(),
        type: addForm.type,
        secret: addForm.secret,
        notes: addForm.notes.trim() || null,
      });
    } catch (err) {
      throw new Error(`Failed to save snippet: ${err?.message || "unknown error"}`, { cause: err });
    }
    setItems((prev) => [created, ...prev]);
    setAddForm(emptyForm(addForm.type));
    addToast("Snippet saved.", "success");
  }

  function startEdit(item) {
    setEditId(item.id);
    setEditForm({
      title: item.title,
      value: item.value,
      type: item.type,
      secret: item.secret,
      notes: item.notes ?? "",
    });
  }

  async function handleEdit() {
    if (!editForm.title.trim() || !editForm.value.trim()) return false;
    let updated;
    try {
      updated = await updateSnippet(editId, {
        title: editForm.title.trim(),
        value: editForm.value.trim(),
        type: editForm.type,
        secret: editForm.secret,
        notes: editForm.notes.trim() || null,
      });
    } catch (err) {
      throw new Error(`Failed to update snippet: ${err?.message || "unknown error"}`, { cause: err });
    }
    setItems((prev) => prev.map((i) => (i.id === editId ? updated : i)));
    addToast("Snippet updated.", "success");
  }

  async function handleDelete(id) {
    if (!await confirm("Delete this snippet? This cannot be undone.", { title: "Delete snippet", confirmLabel: "Delete" })) return;
    try {
      await deleteSnippet(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setRevealed((prev) => { const n = new Set(prev); n.delete(id); return n; });
      addToast("Snippet deleted.", "success");
    } catch {
      addToast("Failed to delete snippet.", "error");
    }
  }

  const toggleReveal = (id) =>
    setRevealed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copy = (item) => {
    navigator.clipboard?.writeText(item.value).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
    });
  };

  async function handleImport() {
    setImporting(true);
    try {
      const parsed = JSON.parse(localStorage.getItem("vaultSnippets"));
      const toImport = (parsed.items || []).map((i) => ({
        title: i.title,
        value: i.value,
        type: TYPE_MAP[i.type] ?? i.type,
        secret: Boolean(i.secret),
      }));
      const imported = await importSnippets(toImport);
      setItems((prev) => [...imported, ...prev]);
      localStorage.removeItem("vaultSnippets");
      setImportCount(0);
      addToast(`Imported ${imported.length} snippet${imported.length === 1 ? "" : "s"}.`, "success");
    } catch {
      addToast("Import failed. Your local data is untouched.", "error");
    } finally {
      setImporting(false);
    }
  }

  function dismissImport() {
    localStorage.removeItem("vaultSnippets");
    setImportCount(0);
  }

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return items.filter((i) =>
      (typeFilter === "all" || i.type === typeFilter) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.value.toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q))
    );
  }, [items, typeFilter, deferredSearch]);

  const formFields = (form, setForm) => (
    <>
      <div className="vault-form-row">
        <Field label="Label" className="vault-form-grow">
          <input
            placeholder="e.g. Home Wi-Fi"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            data-autofocus
            required
          />
        </Field>
        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value, secret: typeInfo(e.target.value).secret })}
          >
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Value" hint="What to remember / copy.">
        <textarea
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          rows={3}
          required
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label="Notes" hint="Optional — never hidden.">
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={form.secret}
          onChange={(e) => setForm({ ...form, secret: e.target.checked })}
        />
        Hide value by default (secret)
      </label>
    </>
  );
  const formInvalid = (form) => !form.title?.trim() || !form.value?.trim();
  const openAdd = () => { setAddForm((f) => emptyForm(f.type)); setShowAdd(true); };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Vault</h1>
        <button type="button" className="btn btn-sm" onClick={openAdd}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> New snippet
        </button>
      </div>

      <p className="vault-intro">
        <i className="fa-solid fa-lock" aria-hidden="true" /> Behind your admin login, stored encrypted-at-rest in Supabase. Secrets are hidden until you reveal them.
      </p>

      {importCount > 0 && (
        <div className="banner-info">
          <i className="fa-solid fa-box-archive" aria-hidden="true" />
          <span>You have {importCount} snippet{importCount !== 1 ? "s" : ""} saved locally from before.</span>
          <button type="button" className="btn-mini accent" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : "Import to vault"}
          </button>
          <button type="button" className="btn-mini" onClick={dismissImport}>Discard</button>
        </div>
      )}

      {showAdd && (
        <FormModal title="New snippet" onClose={() => setShowAdd(false)} onSubmit={handleAdd} submitDisabled={formInvalid(addForm)}>
          {formFields(addForm, setAddForm)}
        </FormModal>
      )}

      {editId && (
        <FormModal title="Edit snippet" submitLabel="Save changes" onClose={() => setEditId(null)} onSubmit={handleEdit} submitDisabled={formInvalid(editForm)}>
          {formFields(editForm, setEditForm)}
        </FormModal>
      )}

      <input
        className="hiker-search vault-search"
        type="search"
        aria-label="Search the vault"
        placeholder="Search the vault…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <SkeletonList rows={4} />}
      {error && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{error}</p>
          <button type="button" className="btn btn-sm" onClick={loadItems}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon="fa-key" title="Vault is empty" description="Store passwords, codes, Wi-Fi credentials, and more. They're hidden until you reveal them." action={<button type="button" className="btn" onClick={openAdd}>Add first snippet</button>} />
      )}

      <div className="snip-grid">
        {filtered.map((item) => {
          const info = typeInfo(item.type);
          const show = !item.secret || revealed.has(item.id);

          return (
            <div className="snip-card" key={item.id}>
              <div className="snip-head">
                <span className="snip-ic" title={info.label}><i className={`fa-solid ${info.icon}`} aria-hidden="true" /><span className="visually-hidden">{info.label}</span></span>
                <span className="snip-title">{item.title}</span>
                <button type="button" className="icon-x sm" onClick={() => startEdit(item)} aria-label={`Edit ${item.title}`}>
                  <i className="fa-solid fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className="icon-x sm" onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.title}`}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
              <div className={`snip-value${info.secret ? " is-secret" : ""}`}>
                {show
                  ? (isUrl(item.value)
                    ? <a href={item.value} target="_blank" rel="noreferrer" className="snip-link">{item.value}</a>
                    : <span className="snip-text">{item.value}</span>)
                  : <span className="snip-dots" aria-label="Hidden value">••••••••••••</span>}
              </div>
              {item.notes && <div className="snip-notes">{item.notes}</div>}
              <div className="snip-actions">
                {item.secret && (
                  <button type="button" className="btn-mini snip-btn" onClick={() => toggleReveal(item.id)}>
                    <i className={`fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" /> {show ? "Hide" : "Reveal"}
                  </button>
                )}
                <button type="button" className={`btn-mini snip-btn ${copiedId === item.id ? "copied" : ""}`} onClick={() => copy(item)}>
                  <i className={`fa-solid ${copiedId === item.id ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copiedId === item.id ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}

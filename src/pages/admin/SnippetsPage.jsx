import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  importSnippets,
} from "../../api/snippetsApi";

const TYPES = [
  { key: "code", label: "Code / Combo", icon: "fa-hashtag", secret: true },
  { key: "password", label: "Password", icon: "fa-key", secret: true },
  { key: "wifi", label: "Wi-Fi", icon: "fa-wifi", secret: true },
  { key: "card", label: "Card", icon: "fa-credit-card", secret: true },
  { key: "note", label: "Note", icon: "fa-note-sticky", secret: false },
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

  // Data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(() => emptyForm());
  const [addSaving, setAddSaving] = useState(false);

  // Edit form
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // UI
  const [search, setSearch] = useState("");
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

  async function handleAdd(e) {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.value.trim()) return;
    setAddSaving(true);
    setError(null);
    try {
      const created = await createSnippet({
        title: addForm.title.trim(),
        value: addForm.value.trim(),
        type: addForm.type,
        secret: addForm.secret,
        notes: addForm.notes.trim() || null,
      });
      setItems((prev) => [created, ...prev]);
      setAddForm(emptyForm(addForm.type));
      setShowAdd(false);
    } catch {
      setError("Failed to save snippet.");
    } finally {
      setAddSaving(false);
    }
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

  async function handleEdit(e) {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.value.trim()) return;
    setEditSaving(true);
    setError(null);
    try {
      const updated = await updateSnippet(editId, {
        title: editForm.title.trim(),
        value: editForm.value.trim(),
        type: editForm.type,
        secret: editForm.secret,
        notes: editForm.notes.trim() || null,
      });
      setItems((prev) => prev.map((i) => (i.id === editId ? updated : i)));
      setEditId(null);
    } catch {
      setError("Failed to update snippet.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this snippet? This cannot be undone.")) return;
    try {
      await deleteSnippet(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setRevealed((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      setError("Failed to delete snippet.");
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
    } catch {
      setError("Import failed. Your local data is untouched.");
    } finally {
      setImporting(false);
    }
  }

  function dismissImport() {
    localStorage.removeItem("vaultSnippets");
    setImportCount(0);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (typeFilter === "all" || i.type === typeFilter) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.value.toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q))
    );
  }, [items, typeFilter, search]);

  const formFields = (form, setForm) => (
    <>
      <div className="form-row">
        <input
          className="field-grow"
          placeholder="Label (e.g. Home Wi-Fi)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          required
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value, secret: typeInfo(e.target.value).secret })}
        >
          {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <textarea
        placeholder="Value to remember / copy"
        value={form.value}
        onChange={(e) => setForm({ ...form, value: e.target.value })}
        rows={2}
        style={{ resize: "vertical" }}
        required
      />
      <input
        className="field-grow"
        placeholder="Notes (optional — never hidden)"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
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

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🔐 Vault</h1>
        <button
          className="btn"
          onClick={() => { setShowAdd((s) => !s); setAddForm((f) => emptyForm(f.type)); }}
        >
          <i className={`fa-solid ${showAdd ? "fa-xmark" : "fa-plus"}`} /> {showAdd ? "Close" : "New Snippet"}
        </button>
      </div>

      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        <i className="fa-solid fa-lock" /> Behind your admin login, stored encrypted-at-rest in Supabase. Secrets are hidden until you reveal them.
      </p>

      {importCount > 0 && (
        <div className="banner-info">
          <i className="fa-solid fa-box-archive" />
          <span>You have {importCount} snippet{importCount !== 1 ? "s" : ""} saved locally from before.</span>
          <button className="btn-tiny-blue" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : "Import to vault"}
          </button>
          <button className="btn-tiny-blue" onClick={dismissImport}>Discard</button>
        </div>
      )}

      {showAdd && (
        <form className="form-card" onSubmit={handleAdd} style={{ maxWidth: 560 }}>
          {formFields(addForm, setAddForm)}
          <button className="btn" type="submit" style={{ width: "fit-content" }} disabled={addSaving}>
            {addSaving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : "Save"}
          </button>
        </form>
      )}

      <input
        className="hiker-search"
        placeholder="Search the vault…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360 }}
      />

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading vault…</p>}
      {error && (
        <p className="no-entries" style={{ color: "var(--danger, #ef4444)" }}>
          {error} <button className="btn-tiny-blue" onClick={loadItems}>Retry</button>
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="no-entries">Nothing here yet. Add a snippet to get started.</p>
      )}

      <div className="snip-grid">
        {filtered.map((item) => {
          const info = typeInfo(item.type);
          const show = !item.secret || revealed.has(item.id);

          if (editId === item.id) {
            return (
              <form className="snip-card" key={item.id} onSubmit={handleEdit}>
                {formFields(editForm, setEditForm)}
                <div className="snip-actions">
                  <button className="btn-tiny-blue" type="submit" disabled={editSaving}>
                    <i className="fa-solid fa-check" /> {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button className="btn-tiny-blue" type="button" onClick={() => setEditId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div className="snip-card" key={item.id}>
              <div className="snip-head">
                <span className="snip-ic"><i className={`fa-solid ${info.icon}`} /></span>
                <span className="snip-title">{item.title}</span>
                <button className="icon-x sm" onClick={() => startEdit(item)} aria-label="Edit">
                  <i className="fa-solid fa-pen" />
                </button>
                <button className="icon-x sm" onClick={() => handleDelete(item.id)} aria-label="Delete">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="snip-value">
                {show
                  ? (isUrl(item.value)
                    ? <a href={item.value} target="_blank" rel="noreferrer" className="snip-link">{item.value}</a>
                    : <span className="snip-text">{item.value}</span>)
                  : <span className="snip-dots">••••••••••••</span>}
              </div>
              {item.notes && <div className="snip-notes">{item.notes}</div>}
              <div className="snip-actions">
                {item.secret && (
                  <button className="btn-tiny-blue snip-btn" onClick={() => toggleReveal(item.id)}>
                    <i className={`fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`} /> {show ? "Hide" : "Reveal"}
                  </button>
                )}
                <button className={`btn-tiny-blue snip-btn ${copiedId === item.id ? "copied" : ""}`} onClick={() => copy(item)}>
                  <i className={`fa-solid ${copiedId === item.id ? "fa-check" : "fa-copy"}`} /> {copiedId === item.id ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

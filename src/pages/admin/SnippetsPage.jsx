import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const KEY = "vaultSnippets";

const TYPES = [
  { key: "wifi", label: "Wi-Fi", icon: "fa-wifi", secret: true },
  { key: "card", label: "Card", icon: "fa-credit-card", secret: true },
  { key: "login", label: "Login", icon: "fa-user-lock", secret: true },
  { key: "link", label: "Link", icon: "fa-link", secret: false },
  { key: "location", label: "Location", icon: "fa-location-dot", secret: false },
  { key: "note", label: "Note", icon: "fa-note-sticky", secret: false },
];
const typeInfo = (k) => TYPES.find((t) => t.key === k) || TYPES[5];

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(d?.items)) return d; } catch { /* ignore */ }
  return { items: [] };
}
const isUrl = (s) => /^https?:\/\//i.test((s || "").trim());

export default function SnippetsPage() {
  const [params] = useSearchParams();
  const typeFilter = params.get("type") || "all";

  const [data, setData] = useState(load);
  const items = data.items;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", type: "wifi", secret: true });
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);

  const update = (fn) => setData((d) => fn({ items: d.items.map((i) => ({ ...i })) }));

  const addSnippet = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.value.trim()) return;
    update((d) => { d.items.unshift({ id: genId(), title: form.title.trim(), value: form.value.trim(), type: form.type, secret: form.secret, created: Date.now() }); return d; });
    setForm({ title: "", value: "", type: form.type, secret: typeInfo(form.type).secret });
    setShowAdd(false);
  };
  const remove = (id) => update((d) => { d.items = d.items.filter((i) => i.id !== id); return d; });

  const toggleReveal = (id) => setRevealed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const copy = (item) => {
    navigator.clipboard?.writeText(item.value).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (typeFilter === "all" || i.type === typeFilter) &&
      (!q || i.title.toLowerCase().includes(q) || i.value.toLowerCase().includes(q))
    );
  }, [items, typeFilter, search]);

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🔐 Vault</h1>
        <button className="btn" onClick={() => { setShowAdd((s) => !s); setForm((f) => ({ ...f, secret: typeInfo(f.type).secret })); }}>
          <i className={`fa-solid ${showAdd ? "fa-xmark" : "fa-plus"}`} /> {showAdd ? "Close" : "New Snippet"}
        </button>
      </div>

      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        <i className="fa-solid fa-lock" /> Behind your admin login. Secrets are hidden until you reveal them.
      </p>

      {showAdd && (
        <form className="form-card" onSubmit={addSnippet} style={{ maxWidth: 560 }}>
          <div className="form-row">
            <input className="field-grow" placeholder="Label (e.g. Home Wi-Fi)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, secret: typeInfo(e.target.value).secret })}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <textarea placeholder="Value to remember / copy" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} rows={2} style={{ resize: "vertical" }} required />
          <label className="checkbox-inline">
            <input type="checkbox" checked={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.checked })} />
            Hide value by default (secret)
          </label>
          <button className="btn" type="submit" style={{ width: "fit-content" }}>Save</button>
        </form>
      )}

      <input className="hiker-search" placeholder="Search the vault…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />

      {filtered.length === 0 && <p className="no-entries">Nothing here yet. Add a snippet to get started.</p>}

      <div className="snip-grid">
        {filtered.map((item) => {
          const info = typeInfo(item.type);
          const show = !item.secret || revealed.has(item.id);
          return (
            <div className="snip-card" key={item.id}>
              <div className="snip-head">
                <span className="snip-ic"><i className={`fa-solid ${info.icon}`} /></span>
                <span className="snip-title">{item.title}</span>
                <button className="icon-x sm" onClick={() => remove(item.id)} aria-label="Delete"><i className="fa-solid fa-xmark" /></button>
              </div>
              <div className="snip-value">
                {show
                  ? (isUrl(item.value)
                    ? <a href={item.value} target="_blank" rel="noreferrer" className="snip-link">{item.value}</a>
                    : <span className="snip-text">{item.value}</span>)
                  : <span className="snip-dots">••••••••••••</span>}
              </div>
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

import { useMemo, useState, useCallback } from "react";
import { getContext, addContextEntry, deleteContextEntry } from "../../api/contextApi";

const TRIGGERS = ["remember", "don't forget", "dont forget", "note that", "note:", "keep in mind", "fyi", "important", "for the record"];
const FACTWORDS = ["started", "likes", "loves", "hates", "works", "worked", "born", "birthday", "allergic", "allergy", "prefers", "anniversary", "favourite", "favorite", "named", "lives", "grew up", "quit", "wants", "married", "met", "studied", "plays", "eats", "drinks", "takes"];
const TOPICS = {
  gardening: "Gardening", garden: "Gardening", work: "Work", school: "School",
  music: "Music", food: "Food", family: "Family", health: "Health",
  weed: "Cannabis", pen: "Cannabis", smoke: "Cannabis", joint: "Cannabis",
  birthday: "Date", anniversary: "Date", exercise: "Health", gym: "Health",
  diet: "Food", allergy: "Health",
};

function classify(raw) {
  const t = raw.trim();
  if (!t) return { kind: "idle" };
  const lower = t.toLowerCase();
  let why = "", keep = false;
  const hitTrig = TRIGGERS.find(k => lower.startsWith(k) || lower.includes(` ${k} `) || lower.includes(`${k} `));
  if (hitTrig) { keep = true; why = `you said "${hitTrig}"`; }
  if (!keep) {
    const fw = FACTWORDS.find(w => lower.includes(w));
    if (fw) { keep = true; why = `reads like a fact ("${fw}")`; }
  }
  let fact = t.replace(/^(please\s+)?(remember(\s+that)?|note(\s+that)?|don'?t forget(\s+that)?|keep in mind(\s+that)?|fyi[\s,:-]*|important[\s,:-]*|for the record[\s,:-]*)\s*/i, "").trim();
  if (!fact) fact = t;
  fact = fact.charAt(0).toUpperCase() + fact.slice(1);
  const tags = [];
  ["scott", "maria"].forEach(n => {
    if (lower.includes(n)) { const T = n === "scott" ? "Scott" : "Maria"; if (!tags.includes(T)) tags.push(T); }
  });
  (t.match(/(?<!^)(?<![.!?]\s)\b[A-Z][a-z]{2,}\b/g) || []).forEach(c => {
    if (!tags.includes(c) && !["Remember", "Note"].includes(c)) tags.push(c);
  });
  Object.keys(TOPICS).forEach(k => {
    if (lower.includes(k)) { const T = TOPICS[k]; if (!tags.includes(T)) tags.push(T); }
  });
  return { kind: keep ? "keep" : "maybe", why, fact, tags: tags.slice(0, 6) };
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 7 * 86400000) return `${Math.floor(d / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

const BY_COLOR = { scott: "#e8915b", maria: "#b68bd6", frodo: "var(--accent,#4ade80)", manual: "var(--text-muted)" };
const BY_LABEL = { scott: "Scott", maria: "Maria", frodo: "Frodo", manual: "Manual" };

export default function ContextPage() {
  const [items, setItems] = useState(() => [...getContext()].reverse());
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState("all");

  const reload = useCallback(() => setItems([...getContext()].reverse()), []);

  const verdict = useMemo(() => classify(input), [input]);

  const save = () => {
    if (!input.trim()) return;
    const c = classify(input.trim());
    addContextEntry({ text: c.fact || input.trim(), tags: c.tags, by: "manual", why: c.why || "saved manually" });
    setInput("");
    reload();
  };

  const remove = (id) => { deleteContextEntry(id); reload(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (filterBy !== "all" && item.by !== filterBy) return false;
      if (!q) return true;
      return item.text.toLowerCase().includes(q) || (item.tags || []).join(" ").toLowerCase().includes(q);
    });
  }, [items, search, filterBy]);

  const verdictColor = { idle: "var(--text-muted)", keep: "var(--accent,#4ade80)", maybe: "#f59e0b" };
  const bys = [...new Set(items.map(i => i.by))];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🧠 Context</h1>
        <span className="module-header-sub">{items.length} saved fact{items.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Add */}
      <div className="ctx-add-card">
        <div className="ctx-add-title">Add a fact</div>
        <div className="ctx-add-sub">Say "remember that…" to force-save. Otherwise the classifier decides.</div>
        <textarea
          className="ctx-textarea"
          rows={3}
          placeholder={`e.g. "remember that Scott is allergic to shellfish" or "Maria loves sativa strains"`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
        />
        <div className="ctx-verdict" style={{ color: verdictColor[verdict.kind] }}>
          {verdict.kind === "idle" && <span>Start typing…</span>}
          {verdict.kind === "keep" && <><strong>Worth keeping</strong> — {verdict.why}</>}
          {verdict.kind === "maybe" && <><strong>Looks like chatter</strong> — save it anyway if it matters</>}
        </div>
        {verdict.kind !== "idle" && verdict.fact && (
          <div className="ctx-chips">
            <span className="ctx-chip preview">&ldquo;{verdict.fact.slice(0, 60)}{verdict.fact.length > 60 ? "…" : ""}&rdquo;</span>
            {(verdict.tags || []).map(tag => (
              <span key={tag} className={`ctx-chip${["Scott", "Maria"].includes(tag) ? " person" : ""}`}>#{tag}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={save} disabled={verdict.kind === "idle"}>
            {verdict.kind === "keep" ? <><i className="fa-solid fa-brain" /> Save to context</> : <><i className="fa-solid fa-plus" /> Save anyway</>}
          </button>
          {input && <button className="btn" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setInput("")}>Clear</button>}
        </div>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="ctx-filters">
          <input className="ctx-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="ctx-filter-chips">
            <button className={`ctx-filter-btn${filterBy === "all" ? " active" : ""}`} onClick={() => setFilterBy("all")}>All</button>
            {bys.map(b => (
              <button key={b} className={`ctx-filter-btn${filterBy === b ? " active" : ""}`}
                style={filterBy === b ? { borderColor: BY_COLOR[b] || BY_COLOR.manual, color: BY_COLOR[b] || BY_COLOR.manual } : undefined}
                onClick={() => setFilterBy(b)}>
                {BY_LABEL[b] || b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <p className="no-entries">No context saved yet. Add a fact above, or ask Frodo — he'll save things he learns automatically.</p>
      ) : filtered.length === 0 ? (
        <p className="no-entries">Nothing matches.</p>
      ) : (
        <div className="ctx-list">
          {filtered.map(item => (
            <div key={item.id} className="ctx-item">
              <div className="ctx-item-text">{item.text}</div>
              {(item.tags || []).length > 0 && (
                <div className="ctx-chips" style={{ marginTop: "0.4rem" }}>
                  {item.tags.map(tag => (
                    <span key={tag} className={`ctx-chip${["Scott", "Maria"].includes(tag) ? " person" : ""}`}>#{tag}</span>
                  ))}
                </div>
              )}
              <div className="ctx-item-meta">
                <span className="ctx-item-by" style={{ color: BY_COLOR[item.by] || BY_COLOR.manual }}>
                  <span className="ctx-dot" style={{ background: BY_COLOR[item.by] || BY_COLOR.manual }} />
                  {BY_LABEL[item.by] || item.by}
                </span>
                <span className="ctx-item-time">{timeAgo(item.ts)}</span>
                {item.why && item.why !== "saved manually" && (
                  <span className="ctx-item-why">{item.why}</span>
                )}
                <button className="ctx-del-btn" onClick={() => remove(item.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

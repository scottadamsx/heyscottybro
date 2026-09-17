import { useMemo, useState, useCallback, useEffect } from "react";
import { loadContext, addContextEntry, deleteContextEntry, refineContextEntry, syncLocalToCloud } from "../../api/contextApi";
import { supabase } from "../../utils/supabase";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import EmptyState from "../../components/EmptyState";
import { SkeletonList } from "../../components/Skeleton";
import { FormModal, Field } from "../../components/ui";

const TRIGGERS = ["remember", "don't forget", "dont forget", "note that", "note:", "keep in mind", "fyi", "important", "for the record"];
const FACTWORDS = ["started", "likes", "loves", "hates", "works", "worked", "born", "birthday", "allergic", "allergy", "prefers", "anniversary", "favourite", "favorite", "named", "lives", "grew up", "quit", "wants", "married", "met", "studied", "plays", "eats", "drinks", "takes"];
const TOPICS = {
  gardening: "Gardening", garden: "Gardening", work: "Work", school: "School",
  music: "Music", food: "Food", family: "Family", health: "Health",
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
  ["scott"].forEach(n => {
    if (lower.includes(n)) { const T = "Scott"; if (!tags.includes(T)) tags.push(T); }
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

// Who saved a fact → a tone class (.ctx-item-by.by-*, brain.css); the name is always shown too.
const BY_TONE = { scott: "by-scott", frodo: "by-frodo", manual: "by-manual" };
const BY_LABEL = { scott: "Scott", frodo: "Frodo", manual: "Manual" };

export default function ContextPage() {
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    try {
      const data = await loadContext();
      setItems([...data].reverse());
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const verdict = useMemo(() => classify(input), [input]);

  // Runs inside FormModal: a thrown error stays in the modal with the text kept.
  const save = async () => {
    const raw = input.trim();
    if (!raw) return false;
    // Frodo rewrites the note into a clean, tagged fact; if that AI call
    // fails, fall back to the local keyword classifier for the TEXT only —
    // the save itself still goes to Supabase (no local data fallback).
    let fields;
    try {
      const refined = await refineContextEntry(raw);
      fields = { text: refined.text, tags: (refined.tags || []).slice(0, 6), by: "manual", why: refined.why || "rephrased by Frodo" };
    } catch {
      const c = classify(raw);
      fields = { text: c.fact || raw, tags: c.tags, by: "manual", why: c.why || "saved manually" };
    }
    try { await addContextEntry(fields); }
    catch (e) { throw new Error(e?.message || "Failed to save context.", { cause: e }); }
    setInput("");
    await reload();
    addToast("Context saved.", "success");
  };

  const remove = async (item) => {
    const preview = item.text.length > 60 ? item.text.slice(0, 60) + "…" : item.text;
    if (!(await confirm(`Delete this context?\n\n"${preview}"`, { title: "Delete context", confirmLabel: "Delete" }))) return;
    try {
      await deleteContextEntry(item.id);
      await reload();
      addToast("Context deleted.", "success");
    } catch (e) {
      addToast(e?.message || "Failed to delete context.", "error");
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const { pushed } = await syncLocalToCloud();
      addToast(pushed > 0 ? `Synced ${pushed} local fact${pushed !== 1 ? "s" : ""} to the cloud.` : "Already up to date.", "success");
      await reload();
    } catch (e) {
      addToast(e?.message || "Sync failed.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditInstruction("");
  };

  const saveEdit = async (item) => {
    const instruction = editInstruction.trim();
    if (!instruction) return false;
    try {
      const prompt = `Current fact: "${item.text}"\n\nInstruction: ${instruction}\n\nRewrite the fact following the instruction. Keep it concise and third-person.`;
      const refined = await refineContextEntry(prompt);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not signed in.");
      const { error } = await supabase
        .from("context_entries")
        .update({ text: refined.text, tags: (refined.tags || []).slice(0, 6), why: refined.why || "edited by Frodo" })
        .eq("id", item.id)
        .eq("user_id", userId);
      if (error) throw error;
    } catch (e) {
      throw new Error(e?.message || "Failed to update context.", { cause: e });
    }
    setEditInstruction("");
    await reload();
    addToast("Context updated.", "success");
  };
  const editingItem = items.find((i) => i.id === editingId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (filterBy !== "all" && item.by !== filterBy) return false;
      if (!q) return true;
      return item.text.toLowerCase().includes(q) || (item.tags || []).join(" ").toLowerCase().includes(q);
    });
  }, [items, search, filterBy]);

  const bys = [...new Set(items.map(i => i.by))];

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Context</h1>
        <span className="module-header-sub">{items.length} saved fact{items.length !== 1 ? "s" : ""}</span>
        <div className="header-actions ctx-header-actions">
          <button type="button" className="btn btn-sm btn-secondary-sm" onClick={runSync} disabled={syncing}>
            {syncing ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Syncing…</> : <><i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Sync local facts</>}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShowAdd(true)}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Add a fact
          </button>
        </div>
      </div>

      {error && <div className="load-error" role="alert"><p className="load-error-msg">{error}</p></div>}
      {loading && <SkeletonList rows={5} />}

      {/* Add — Cmd/Ctrl+Enter submits from the textarea */}
      {showAdd && (
        <FormModal
          title="Add a fact"
          submitLabel={verdict.kind === "maybe" ? "Save anyway" : "Save to context"}
          submitDisabled={verdict.kind === "idle"}
          onClose={() => setShowAdd(false)}
          onSubmit={save}
        >
          <Field label="Fact" hint="Type it however you like — Frodo rewrites it into a clean fact when you save.">
            <textarea
              rows={4}
              placeholder={`e.g. "remember that Scott is allergic to shellfish"`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              data-autofocus
            />
          </Field>
          <div className={`ctx-verdict is-${verdict.kind}`} aria-live="polite">
            {verdict.kind === "idle" && <span>Start typing…</span>}
            {verdict.kind === "keep" && <><strong>Worth keeping</strong> — {verdict.why}</>}
            {verdict.kind === "maybe" && <><strong>Looks like chatter</strong> — save it anyway if it matters</>}
          </div>
          {verdict.kind !== "idle" && verdict.fact && (
            <div className="ctx-chips">
              <span className="ctx-chip preview">&ldquo;{verdict.fact.slice(0, 60)}{verdict.fact.length > 60 ? "…" : ""}&rdquo;</span>
              {(verdict.tags || []).map(tag => (
                <span key={tag} className={`ctx-chip${tag === "Scott" ? " person" : ""}`}>#{tag}</span>
              ))}
            </div>
          )}
        </FormModal>
      )}

      {/* Edit with Frodo */}
      {editingItem && (
        <FormModal
          title="Edit with Frodo"
          submitLabel="Rewrite"
          submitDisabled={!editInstruction.trim()}
          onClose={() => setEditingId(null)}
          onSubmit={() => saveEdit(editingItem)}
        >
          <p className="ctx-item-text">{editingItem.text}</p>
          <Field label="How should Frodo rewrite this fact?">
            <input
              placeholder={`e.g. "update to say he quit smoking" or "fix the typo"`}
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              data-autofocus
            />
          </Field>
        </FormModal>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="ctx-filters">
          <input className="ctx-search" type="search" aria-label="Search facts" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="ctx-filter-chips" role="group" aria-label="Saved by">
            <button type="button" className={`chip${filterBy === "all" ? " active" : ""}`} aria-pressed={filterBy === "all"} onClick={() => setFilterBy("all")}>All</button>
            {bys.map(b => (
              <button key={b} type="button" className={`chip${filterBy === b ? " active" : ""}`} aria-pressed={filterBy === b}
                onClick={() => setFilterBy(b)}>
                {BY_LABEL[b] || b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {!loading && items.length === 0 ? (
        <EmptyState icon="fa-brain" title="No context yet" description="Use Add a fact, or ask Frodo — he saves things he learns automatically." />
      ) : filtered.length === 0 ? (
        <p className="no-entries">Nothing matches.</p>
      ) : (
        <div className="ctx-list">
          {filtered.map(item => (
            <div key={item.id} className="ctx-item">
              <div className="ctx-item-text">{item.text}</div>
              {(item.tags || []).length > 0 && (
                <div className="ctx-chips">
                  {item.tags.map(tag => (
                    <span key={tag} className={`ctx-chip${tag === "Scott" ? " person" : ""}`}>#{tag}</span>
                  ))}
                </div>
              )}
              <div className="ctx-item-meta">
                <span className={`ctx-item-by ${BY_TONE[item.by] || BY_TONE.manual}`}>
                  <span className="ctx-dot" aria-hidden="true" />
                  {BY_LABEL[item.by] || item.by}
                </span>
                <span className="ctx-item-time">{timeAgo(item.ts)}</span>
                {item.why && item.why !== "saved manually" && (
                  <span className="ctx-item-why">{item.why}</span>
                )}
                <span className="ctx-item-actions">
                  <button type="button" className="icon-x sm" onClick={() => startEdit(item)} title="Edit with Frodo" aria-label="Edit with Frodo"><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                  <button type="button" className="icon-x sm ctx-del" onClick={() => remove(item)} title="Delete" aria-label="Delete fact"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

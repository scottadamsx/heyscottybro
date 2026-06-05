import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";

const KEY = "datePlanner";
const EMOJIS = ["💖", "🍷", "🍿", "🎬", "🥾", "🏖️", "🎨", "🍣", "🎢", "🌃", "🎳", "🕯️", "☕", "🍜", "⛸️", "🎤"];

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.ideas) && Array.isArray(d.completed)) return d;
  } catch { /* ignore */ }
  return { ideas: [], completed: [] };
}

export default function DatePlannerPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState(loadData);
  const { ideas, completed } = data;

  // add-idea form
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("💖");
  const [note, setNote] = useState("");

  // pack opening
  const [opening, setOpening] = useState(false);
  const [flash, setFlash] = useState("");
  const [reveal, setReveal] = useState(null);
  const timerRef = useRef(null);

  // persist
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  // sidebar "Go to" → scroll to a section
  useEffect(() => {
    const s = params.get("section");
    if (!s) return;
    const el = document.getElementById(`dates-${s}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const update = (fn) => setData((d) => fn(structuredCloneSafe(d)));

  const addIdea = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    update((d) => {
      d.ideas.push({ id: genId(), title: title.trim(), emoji, note: note.trim(), created: toDateStr(new Date()) });
      return d;
    });
    setTitle(""); setNote(""); setEmoji("💖");
  };

  const deleteIdea = (id) => update((d) => { d.ideas = d.ideas.filter((i) => i.id !== id); return d; });

  const markDone = (idea, date = toDateStr(new Date())) => {
    update((d) => {
      d.ideas = d.ideas.filter((i) => i.id !== idea.id);
      d.completed.unshift({ ...idea, doneOn: date, memory: "" });
      return d;
    });
  };

  const deleteDone = (id) => update((d) => { d.completed = d.completed.filter((c) => c.id !== id); return d; });
  const setMemory = (id, memory) => update((d) => {
    d.completed = d.completed.map((c) => (c.id === id ? { ...c, memory } : c));
    return d;
  });

  const spin = () => {
    if (ideas.length === 0 || opening) return;
    setReveal(null);
    setOpening(true);
    const start = Date.now();
    const dur = 1700;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFlash(ideas[Math.floor(Math.random() * ideas.length)]?.title || "");
      if (Date.now() - start > dur) {
        clearInterval(timerRef.current);
        const chosen = ideas[Math.floor(Math.random() * ideas.length)];
        setOpening(false);
        setReveal(chosen);
      }
    }, 85);
  };

  const confetti = useMemo(
    () => Array.from({ length: 42 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.6 + Math.random() * 1.4,
      bg: ["#CF1124", "#1F62FF", "#ffffff", "#ff7a8a", "#ffd23f"][i % 5],
      rot: Math.random() * 360,
    })),
    [reveal] // regenerate per reveal
  );

  return (
    <div className="module-page dates-page">
      <div className="module-header">
        <h1>💕 Date Night</h1>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {ideas.length} on the list · {completed.length} done
        </span>
      </div>

      {/* ── Pick-a-date pack opener ── */}
      <div className="db-card dates-pick" id="dates-pick">
        <h3 className="db-card-title">Pick our date</h3>
        {ideas.length === 0 ? (
          <p className="no-entries">Add a few ideas below, then open a pack to pick one ✨</p>
        ) : (
          <div className="pack-stage">
            <button
              type="button"
              className={`date-pack ${opening ? "opening" : ""}`}
              onClick={spin}
              disabled={opening}
            >
              <span className="date-pack-shine" />
              <span className="date-pack-inner">
                {opening ? (
                  <span className="pack-flash">{flash}</span>
                ) : (
                  <>
                    <span className="date-pack-spark">✨</span>
                    <span className="date-pack-label">Open a date pack</span>
                    <span className="date-pack-sub">tap to reveal a surprise</span>
                  </>
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Reveal overlay ── */}
      {reveal && (
        <div className="reveal-overlay" onClick={(e) => { if (e.target.classList.contains("reveal-overlay")) setReveal(null); }}>
          <div className="confetti">
            {confetti.map((c) => (
              <span key={c.id} style={{ left: `${c.left}%`, background: c.bg, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, "--rot": `${c.rot}deg` }} />
            ))}
          </div>
          <div className="reveal-card">
            <div className="reveal-tag">Tonight&apos;s date</div>
            <div className="reveal-emoji">{reveal.emoji || "💖"}</div>
            <div className="reveal-title">{reveal.title}</div>
            {reveal.note && <div className="reveal-note">{reveal.note}</div>}
            <div className="reveal-actions">
              <button className="btn" onClick={() => { markDone(reveal); setReveal(null); }}>
                <i className="fa-solid fa-heart" /> We did it!
              </button>
              <button className="btn-tiny-blue" style={{ height: 38, padding: "0 1rem" }} onClick={spin}>
                <i className="fa-solid fa-rotate" /> Spin again
              </button>
              <button className="icon-x" onClick={() => setReveal(null)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bucket list ── */}
      <div className="db-card" id="dates-bucket">
        <div className="db-card-header">
          <h3 className="db-card-title">Date bucket list</h3>
        </div>

        <form className="add-idea-row" onSubmit={addIdea}>
          <select className="emoji-select" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji">
            {EMOJIS.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
          <input className="field-grow" placeholder="A date idea…" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" type="submit"><i className="fa-solid fa-plus" /> Add</button>
        </form>

        {ideas.length === 0 ? (
          <p className="no-entries">No ideas yet — add your first date above.</p>
        ) : (
          <div className="idea-grid">
            {ideas.map((i) => (
              <div className="idea-card" key={i.id}>
                <div className="idea-emoji">{i.emoji || "💖"}</div>
                <div className="idea-body">
                  <div className="idea-title">{i.title}</div>
                  {i.note && <div className="idea-note">{i.note}</div>}
                </div>
                <div className="idea-actions">
                  <button className="btn-sm btn-complete" onClick={() => markDone(i)} title="We did this">✓</button>
                  <button className="btn-sm btn-delete" onClick={() => deleteIdea(i.id)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Completed ── */}
      <div className="db-card" id="dates-done">
        <div className="db-card-header">
          <h3 className="db-card-title">Been there 💞 ({completed.length})</h3>
        </div>
        {completed.length === 0 ? (
          <p className="no-entries">No dates logged yet. Go make some memories 🥰</p>
        ) : (
          <div className="done-list">
            {completed.map((c) => (
              <div className="done-item" key={c.id}>
                <span className="done-emoji">{c.emoji || "💖"}</span>
                <div className="done-body">
                  <div className="done-title">{c.title}</div>
                  <div className="done-date">{formatDisplayDate(c.doneOn)}</div>
                  <input
                    className="done-memory"
                    placeholder="add a memory…"
                    value={c.memory || ""}
                    onChange={(e) => setMemory(c.id, e.target.value)}
                  />
                </div>
                <button className="btn-sm btn-delete" onClick={() => deleteDone(c.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// shallow-deep clone that's safe without structuredClone in old runtimes
function structuredCloneSafe(obj) {
  return {
    ideas: obj.ideas.map((i) => ({ ...i })),
    completed: obj.completed.map((c) => ({ ...c })),
  };
}

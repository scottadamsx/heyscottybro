import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadJournal, newJournalEntry } from "../../api/plannerApi";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  const isNew = params.get("new") === "1";

  const [entries, setEntries] = useState([]);
  const [title, setTitle] = useState("");
  const [entry, setEntry] = useState("");

  const load = async () => setEntries(await loadJournal());
  useEffect(() => { load(); }, []);

  const todayLong = formatDisplayDate(toDateStr(new Date()));

  const submit = async (e) => {
    e.preventDefault();
    if (!entry.trim()) return;
    await newJournalEntry({ title: title.trim() || todayLong, entry: entry.trim(), date: toDateStr(new Date()) });
    setTitle("");
    setEntry("");
    await load();
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next);
  };

  const selectedEntry = entries.find((e) => String(e.id) === String(selectedId));
  const showForm = isNew || (!selectedId && !selectedEntry);
  const showEntry = selectedEntry && !isNew;

  // Sort entries newest first for the list
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Journal</h1>
        <button className="btn btn-sm" onClick={() => {
          // Preserve other params (e.g. tab=journal when embedded in Planner)
          const next = new URLSearchParams(params);
          next.set("new", "1");
          next.delete("id");
          setParams(next);
        }}>
          <i className="fa-solid fa-plus" /> New Entry
        </button>
      </div>

      {/* Compose form */}
      {showForm && (
        <form className="form-card" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Title (defaults to "${todayLong}")`} />
          <textarea
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            rows={8}
            placeholder="Write your thoughts..."
            style={{ resize: "vertical" }}
            required
            autoFocus
          />
          <button className="btn" type="submit">Save Entry</button>
        </form>
      )}

      {/* Single entry view */}
      {showEntry && (
        <div className="db-card" style={{ marginBottom: "1.5rem" }}>
          <div className="db-card-header">
            <h3 className="db-card-title">{selectedEntry.title}</h3>
            <span className="journal-date">{formatDisplayDate(selectedEntry.date)}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", padding: 0, margin: 0, lineHeight: 1.7, fontSize: "0.92rem" }}>{selectedEntry.entry}</p>
        </div>
      )}

      {/* Entries list — always shown */}
      {sortedEntries.length === 0 ? (
        <p className="no-entries">No journal entries yet. Start writing!</p>
      ) : (
        <div className="journal-list">
          <div className="journal-list-head">
            {sortedEntries.length} {sortedEntries.length === 1 ? "entry" : "entries"}
          </div>
          {sortedEntries.map((e) => (
            <button
              key={e.id}
              className={`journal-list-item${String(e.id) === String(selectedId) ? " active" : ""}`}
              onClick={() => {
                // Preserve other params (e.g. tab=journal when embedded in Planner)
                const next = new URLSearchParams(params);
                next.set("id", String(e.id));
                next.delete("new");
                setParams(next);
              }}
            >
              <div className="journal-list-title">{e.title}</div>
              <div className="journal-list-date">{formatDisplayDate(e.date)}</div>
              <div className="journal-list-preview">{e.entry.slice(0, 90)}{e.entry.length > 90 ? "…" : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadJournal, newJournalEntry } from "../../api/plannerApi";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  const composing = params.get("new") === "1" || !selectedId;

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
    // clear the "new" flag after saving
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next);
  };

  const selectedEntry = entries.find((e) => String(e.id) === String(selectedId));

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Journal</h1>
        {selectedEntry && (
          <button className="btn btn-sm" onClick={() => setParams({ new: "1" })}>
            <i className="fa-solid fa-plus" /> New Entry
          </button>
        )}
      </div>

      {/* Viewing a single entry (chosen from the sidebar) */}
      {selectedEntry && !params.get("new") ? (
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">{selectedEntry.title}</h3>
            <span className="journal-date">{formatDisplayDate(selectedEntry.date)}</span>
          </div>
          <p className="journal-card-body" style={{ whiteSpace: "pre-wrap", padding: 0 }}>{selectedEntry.entry}</p>
        </div>
      ) : (
        <form className="form-card" onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Title (defaults to “${todayLong}”)`} />
          <textarea
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            rows={8}
            placeholder="Write your thoughts..."
            style={{ resize: "vertical" }}
            required
          />
          <button className="btn" type="submit">Save Entry</button>
        </form>
      )}

      {composing && entries.length === 0 && (
        <p className="no-entries">No journal entries yet. Start writing!</p>
      )}
    </div>
  );
}

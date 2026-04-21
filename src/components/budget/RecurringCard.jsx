import { useState } from "react";
import { formatMoney, toDateStr } from "../../utils/plannerUtils";

export default function RecurringCard({ item, kind, categories, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);

  const isIncome = kind === "income";
  const accent = isIncome ? "var(--bud-green)" : "var(--bud-red)";

  const commit = async () => {
    const patch = { ...draft, amount: Number(draft.amount) };
    await onUpdate(item.id, patch);
    setEditing(false);
  };

  const pause = async () => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    await onUpdate(item.id, { endDate: toDateStr(endOfMonth) });
  };

  const nextDue = () => {
    if (item.endDate && item.endDate < toDateStr(new Date())) return "Ended";
    const dueDay = item.dueDay ? Number(item.dueDay) : null;
    if (!dueDay) return "Continuous · no set day";
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (next < now) next = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    return `Next: ${next.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  if (editing) {
    return (
      <div className="bud-card bud-card-edit" style={{ borderTopColor: accent }}>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name" />
        <input type="number" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="Amount" />
        {!isIncome && (
          <select value={draft.category || "Other"} onChange={e => setDraft({ ...draft, category: e.target.value })}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        <div className="form-row">
          <label className="bud-mini-label">Start
            <input type="date" value={draft.startDate || ""} onChange={e => setDraft({ ...draft, startDate: e.target.value })} />
          </label>
          <label className="bud-mini-label">End (optional)
            <input type="date" value={draft.endDate || ""} onChange={e => setDraft({ ...draft, endDate: e.target.value || null })} />
          </label>
          {!isIncome && (
            <label className="bud-mini-label" title="Day of month the bill hits. Leave blank for continuous bills (groceries, gas) that you pay as you go.">
              Due day (1–31)
              <input type="number" min="1" max="31" value={draft.dueDay ?? ""}
                placeholder="e.g. 15"
                onChange={e => setDraft({ ...draft, dueDay: e.target.value ? Number(e.target.value) : null })} />
            </label>
          )}
        </div>
        <textarea value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" rows={2} />
        <div className="bud-card-actions">
          <button type="button" className="btn-mini accent" onClick={commit}><i className="fa-solid fa-check" /> Save</button>
          <button type="button" className="btn-mini muted" onClick={() => { setDraft(item); setEditing(false); }}>Cancel</button>
        </div>
      </div>
    );
  }

  const ended = item.endDate && item.endDate < toDateStr(new Date());

  return (
    <div className="bud-card" style={{ borderTopColor: accent, opacity: ended ? 0.55 : 1 }}>
      <div className="bud-card-head">
        <h4>{item.name}</h4>
        <span className="bud-card-amount" style={{ color: accent }}>
          {isIncome ? "+" : "-"}{formatMoney(item.amount)}<span className="bud-card-unit">/mo</span>
        </span>
      </div>
      <div className="bud-card-meta">
        {!isIncome && <span>{item.category || "Other"}</span>}
        <span>{item.startDate || "—"}{item.endDate ? ` → ${item.endDate}` : ""}</span>
        <span>{nextDue()}</span>
      </div>
      {item.notes && <p className="bud-card-note">{item.notes}</p>}
      <div className="bud-card-actions">
        <button type="button" className="btn-mini" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> Edit</button>
        {!ended && <button type="button" className="btn-mini muted" onClick={pause} title="Set end date to end of this month"><i className="fa-solid fa-pause" /> Pause</button>}
        <button type="button" className="btn-mini danger" onClick={() => { if (confirm(`Delete "${item.name}"?`)) onDelete(item.id); }}><i className="fa-solid fa-trash" /></button>
      </div>
    </div>
  );
}

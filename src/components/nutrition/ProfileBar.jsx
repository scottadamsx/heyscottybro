import { useState } from "react";
import { createProfile, updateProfile, deleteProfile } from "../../api/nutritionApi";
import { toKg, toLb } from "../../utils/nutrition";

const EMOJIS = ["🙂", "💪", "🏃", "🧗", "🥗", "🍳", "👩", "👨", "🐻", "🦊", "🌟", "🔥"];
const COLORS = ["#6366f1", "#22c55e", "#ec4899", "#f59e0b", "#38bdf8", "#a855f7"];
const ACTIVITY = [
  { key: "sedentary", label: "Sedentary (little exercise)" },
  { key: "light", label: "Light (1-3 days/wk)" },
  { key: "moderate", label: "Moderate (3-5 days/wk)" },
  { key: "active", label: "Active (6-7 days/wk)" },
  { key: "very_active", label: "Very active (athlete)" },
];

const blank = () => ({
  name: "", emoji: "🙂", color: "#6366f1", sex: "male", height_cm: "",
  birth_year: "", activity_level: "moderate", goal: "maintain",
  target_calories: "", start_weight_kg: "", goal_weight_kg: "",
});

export default function ProfileBar({ profiles, activeId, onSelect, onChanged, unit, onToggleUnit }) {
  const [editing, setEditing] = useState(null); // profile object, {} for new, or null

  return (
    <>
      <div className="nut-profilebar">
        <div className="nut-profiles">
          {profiles.map((p) => (
            <button
              key={p.id}
              className={`nut-profile-chip ${p.id === activeId ? "active" : ""}`}
              style={p.id === activeId ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` } : undefined}
              onClick={() => onSelect(p.id)}
            >
              <span className="nut-profile-emoji">{p.emoji}</span> {p.name}
            </button>
          ))}
          <button className="nut-profile-chip ghost" onClick={() => setEditing(blank())} title="Add profile">
            <i className="fa-solid fa-plus" />
          </button>
        </div>
        <div className="nut-profilebar-right">
          <button className="btn-tiny-blue" onClick={onToggleUnit} title="Toggle weight unit">{unit.toUpperCase()}</button>
          {activeId && (
            <button
              className="btn-tiny-blue"
              onClick={() => setEditing(profiles.find((p) => p.id === activeId))}
              title="Edit this profile"
            >
              <i className="fa-solid fa-gear" />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <ProfileEditor
          initial={editing}
          unit={unit}
          onClose={() => setEditing(null)}
          onSaved={(p, isNew) => { setEditing(null); onChanged(p, isNew); }}
          onDeleted={(id) => { setEditing(null); onChanged({ id, _deleted: true }); }}
        />
      )}
    </>
  );
}

function ProfileEditor({ initial, unit, onClose, onSaved, onDeleted }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    ...blank(),
    ...initial,
    height_cm: initial.height_cm ?? "",
    birth_year: initial.birth_year ?? "",
    target_calories: initial.target_calories ?? "",
    start_weight_kg: initial.start_weight_kg != null
      ? (unit === "lb" ? toLb(initial.start_weight_kg) : initial.start_weight_kg).toFixed(1) : "",
    goal_weight_kg: initial.goal_weight_kg != null
      ? (unit === "lb" ? toLb(initial.goal_weight_kg) : initial.goal_weight_kg).toFixed(1) : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toKgInput = (v) => (v === "" || v == null ? null : (unit === "lb" ? toKg(Number(v)) : Number(v)));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      sex: form.sex,
      height_cm: form.height_cm === "" ? null : Number(form.height_cm),
      birth_year: form.birth_year === "" ? null : Number(form.birth_year),
      activity_level: form.activity_level,
      goal: form.goal,
      target_calories: form.target_calories === "" ? null : Number(form.target_calories),
      start_weight_kg: toKgInput(form.start_weight_kg),
      goal_weight_kg: toKgInput(form.goal_weight_kg),
    };
    try {
      const saved = isNew ? await createProfile(payload) : await updateProfile(initial.id, payload);
      onSaved(saved, isNew);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete profile "${initial.name}" and ALL its food + weight logs? This cannot be undone.`)) return;
    await deleteProfile(initial.id);
    onDeleted(initial.id);
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">{isNew ? "New profile" : `Edit ${initial.name}`}</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <form className="doc-viewer-body" style={{ alignItems: "stretch", gap: "0.75rem" }} onSubmit={handleSave}>
          <div className="form-row">
            <input className="field-grow" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            <select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="nut-pick-row">
            {EMOJIS.map((em) => (
              <button type="button" key={em} className={`nut-pick ${form.emoji === em ? "on" : ""}`} onClick={() => set("emoji", em)}>{em}</button>
            ))}
          </div>
          <div className="nut-pick-row">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`nut-pick-color ${form.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => set("color", c)} />
            ))}
          </div>

          <div className="form-row">
            <input type="number" placeholder="Height (cm)" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} />
            <input type="number" placeholder="Birth year" value={form.birth_year} onChange={(e) => set("birth_year", e.target.value)} />
          </div>
          <div className="form-row">
            <input type="number" step="0.1" placeholder={`Current weight (${unit})`} value={form.start_weight_kg} onChange={(e) => set("start_weight_kg", e.target.value)} />
            <input type="number" step="0.1" placeholder={`Goal weight (${unit})`} value={form.goal_weight_kg} onChange={(e) => set("goal_weight_kg", e.target.value)} />
          </div>
          <div className="form-row">
            <select value={form.activity_level} onChange={(e) => set("activity_level", e.target.value)}>
              {ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <select value={form.goal} onChange={(e) => set("goal", e.target.value)}>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select>
          </div>
          <input type="number" placeholder="Daily calorie target (optional — auto-calculated if blank)" value={form.target_calories} onChange={(e) => set("target_calories", e.target.value)} />

          {error && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{error}</p>}
          <div className="form-row" style={{ justifyContent: "space-between" }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : (isNew ? "Create profile" : "Save")}
            </button>
            {!isNew && <button type="button" className="btn danger" onClick={handleDelete}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { createProfile, updateProfile, deleteProfile } from "../../api/nutritionApi";
import { toKg, toLb } from "../../utils/nutrition";
import { useConfirm } from "../../hooks/useConfirm";

const COLORS = ["#6366f1", "#22c55e", "#ec4899", "#f59e0b", "#38bdf8", "#a855f7"];
const ACTIVITY = [
  { key: "sedentary", label: "Sedentary (little exercise)" },
  { key: "light", label: "Light (1-3 days/wk)" },
  { key: "moderate", label: "Moderate (3-5 days/wk)" },
  { key: "active", label: "Active (6-7 days/wk)" },
  { key: "very_active", label: "Very active (athlete)" },
];

const blank = () => ({
  name: "", emoji: "", color: "#6366f1", sex: "male", height_cm: "",
  birth_year: "", activity_level: "moderate", goal: "maintain",
  target_calories: "", start_weight_kg: "", goal_weight_kg: "",
});

export default function ProfileBar({ profiles, activeId, onSelect, onChanged, unit, onToggleUnit }) {
  const [editing, setEditing] = useState(null); // profile object, {} for new, or null

  return (
    <>
      <div className="nut-profilebar">
        <div className="nut-profiles" role="group" aria-label="Profiles">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip nut-profile-chip${p.id === activeId ? " active" : ""}`}
              aria-pressed={p.id === activeId}
              onClick={() => onSelect(p.id)}
            >
              {/* the profile's own colour — user data, so it stays dynamic */}
              <span className="nut-profile-dot" style={{ background: p.color }} aria-hidden="true" />
              {p.name}
            </button>
          ))}
          <button type="button" className="chip nut-profile-add" onClick={() => setEditing(blank())} title="Add profile" aria-label="Add profile">
            <i className="fa-solid fa-plus" aria-hidden="true" />
          </button>
        </div>
        <div className="nut-profilebar-right">
          <button type="button" className="btn-mini" onClick={onToggleUnit} title="Toggle weight unit" aria-label={`Weight unit: ${unit}. Switch unit`}>{unit.toUpperCase()}</button>
          {activeId && (
            <button
              type="button"
              className="btn-mini"
              onClick={() => setEditing(profiles.find((p) => p.id === activeId))}
              title="Edit this profile"
              aria-label="Edit this profile"
            >
              <i className="fa-solid fa-gear" aria-hidden="true" />
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
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = useState(() => ({
    ...blank(),
    ...initial,
    height_cm: initial.height_cm ?? "",
    birth_year: initial.birth_year ?? "",
    target_calories: initial.target_calories ?? "",
    start_weight_kg: initial.start_weight_kg != null && initial.start_weight_kg !== ""
      ? (unit === "lb" ? toLb(Number(initial.start_weight_kg)) : Number(initial.start_weight_kg)).toFixed(1) : "",
    goal_weight_kg: initial.goal_weight_kg != null && initial.goal_weight_kg !== ""
      ? (unit === "lb" ? toLb(Number(initial.goal_weight_kg)) : Number(initial.goal_weight_kg)).toFixed(1) : "",
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
    if (!await confirm(`Delete profile "${initial.name}" and ALL its food + weight logs? This cannot be undone.`, { title: "Delete profile", confirmLabel: "Delete" })) return;
    await deleteProfile(initial.id);
    onDeleted(initial.id);
  };

  return (
    <>
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal nut-modal is-sm" role="dialog" aria-modal="true" aria-label={isNew ? "New profile" : `Edit ${initial.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">{isNew ? "New profile" : `Edit ${initial.name}`}</span>
          <button type="button" className="icon-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <form className="doc-viewer-body nut-modal-body" onSubmit={handleSave}>
          <div className="nut-field-row">
            <label className="nut-qty field-grow">Name<input placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <label className="nut-qty is-narrow">Sex<select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select></label>
          </div>

          <div className="nut-pick-row" role="group" aria-label="Profile colour">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`nut-pick-color ${form.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => set("color", c)} aria-label={`Colour ${c}`} aria-pressed={form.color === c} />
            ))}
          </div>

          <div className="nut-field-row">
            <label className="nut-qty">Height (cm)<input type="number" placeholder="Height (cm)" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} /></label>
            <label className="nut-qty">Birth year<input type="number" placeholder="Birth year" value={form.birth_year} onChange={(e) => set("birth_year", e.target.value)} /></label>
          </div>
          <div className="nut-field-row">
            <label className="nut-qty">Current weight ({unit})<input type="number" step="0.1" placeholder={`Current weight (${unit})`} value={form.start_weight_kg} onChange={(e) => set("start_weight_kg", e.target.value)} /></label>
            <label className="nut-qty">Goal weight ({unit})<input type="number" step="0.1" placeholder={`Goal weight (${unit})`} value={form.goal_weight_kg} onChange={(e) => set("goal_weight_kg", e.target.value)} /></label>
          </div>
          <div className="nut-field-row">
            <label className="nut-qty">Activity<select value={form.activity_level} onChange={(e) => set("activity_level", e.target.value)}>
              {ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select></label>
            <label className="nut-qty">Goal<select value={form.goal} onChange={(e) => set("goal", e.target.value)}>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select></label>
          </div>
          <label className="nut-qty">Daily calorie target<input type="number" placeholder="Optional — auto-calculated if blank" value={form.target_calories} onChange={(e) => set("target_calories", e.target.value)} /></label>

          {error && <p className="nut-error" role="alert">{error}</p>}
          <div className="nut-modal-actions is-split">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : (isNew ? "Create profile" : "Save")}
            </button>
            {!isNew && <button type="button" className="btn danger" onClick={handleDelete}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
    {dialog}
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { estimateMealFromText, estimateMealFromImage } from "../../api/aiFood";
import { createFoodLog, uploadMealPhoto } from "../../api/nutritionApi";
import { MEAL_TYPES, round } from "../../utils/nutrition";
import DatePicker from "../DatePicker";

const MODES = [
  { key: "ai", label: "Describe it", icon: "fa-wand-magic-sparkles" },
  { key: "photo", label: "Photo", icon: "fa-camera" },
  { key: "manual", label: "Manual", icon: "fa-pen" },
];

const emptyEntry = (date) => ({
  date,
  meal_type: "lunch",
  name: "",
  description: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  quantity: 1,
  items: [],
});

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function MealLogger({ profileId, date, onClose, onLogged }) {
  const [mode, setMode] = useState("ai");
  const [entry, setEntry] = useState(() => emptyEntry(date));
  const [estimated, setEstimated] = useState(false); // AI/photo produced a result → show form
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState("manual");
  const fileRef = useRef();

  const set = (k, v) => setEntry((e) => ({ ...e, [k]: v }));

  const applyAiResult = (r, src) => {
    setEntry((e) => ({
      ...e,
      name: r.name || e.name,
      meal_type: r.meal_type || e.meal_type,
      calories: round(r.calories),
      protein_g: round(r.protein_g),
      carbs_g: round(r.carbs_g),
      fat_g: round(r.fat_g),
      description: r.assumptions || "",
      items: (r.items || []).map((it) => ({
        name: it.name, quantity: it.quantity || "",
        calories: round(it.calories), protein_g: round(it.protein_g),
        carbs_g: round(it.carbs_g), fat_g: round(it.fat_g),
      })),
    }));
    setSource(src);
    setEstimated(true);
  };

  const runText = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      applyAiResult(await estimateMealFromText(text.trim()), "ai");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  // Revoke object URL when it changes or component unmounts to prevent memory leak
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  const pickPhoto = (f) => {
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const runPhoto = async () => {
    if (!photoFile) return;
    setBusy(true); setError(null);
    try {
      const b64 = await fileToBase64(photoFile);
      const r = await estimateMealFromImage(b64, photoFile.type || "image/jpeg", text.trim());
      applyAiResult(r, "photo");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const startManual = () => { setSource("manual"); setEstimated(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!entry.name.trim()) { setError("Give the meal a name."); return; }
    setBusy(true); setError(null);
    try {
      let image_path = null;
      if (source === "photo" && photoFile) {
        image_path = await uploadMealPhoto(profileId, photoFile);
      }
      const log = await createFoodLog(profileId, { ...entry, source, image_path });
      onLogged(log);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal nut-modal" role="dialog" aria-modal="true" aria-label="Log a meal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">Log a meal</span>
          <button type="button" className="icon-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        {!estimated && (
          <div className="nut-mode-bar">
            <div className="segmented nut-mode-tabs" role="radiogroup" aria-label="How to log">
              {MODES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} className={`segmented-opt nut-mode-tab${mode === m.key ? " active" : ""}`}
                  onClick={() => { setMode(m.key); if (m.key === "manual") startManual(); }}>
                  <i className={`fa-solid ${m.icon}`} aria-hidden="true" /> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="doc-viewer-body nut-modal-body">
          {/* INPUT STAGE */}
          {!estimated && mode === "ai" && (
            <>
              <p className="nut-hint">Describe what you ate — the AI estimates calories &amp; macros. e.g. <em>"two scrambled eggs, toast with butter, and a flat white"</em>.</p>
              <textarea rows={3} placeholder="What did you eat?" aria-label="What did you eat?" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
              <button type="button" className="btn nut-modal-go" onClick={runText} disabled={busy || !text.trim()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Estimating…</> : <><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Estimate</>}
              </button>
            </>
          )}

          {!estimated && mode === "photo" && (
            <>
              <button type="button" className="doc-dropzone nut-dropzone" onClick={() => fileRef.current.click()}>
                {photoPreview
                  ? <img src={photoPreview} alt="Your meal" className="nut-photo-preview" />
                  : <><i className="fa-solid fa-camera" aria-hidden="true" /><span>Tap to take or choose a photo of your meal</span></>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => pickPhoto(e.target.files[0])} />
              <input placeholder="Optional hint (e.g. 'large portion, no sauce')" aria-label="Optional hint" value={text} onChange={(e) => setText(e.target.value)} />
              <button type="button" className="btn nut-modal-go" onClick={runPhoto} disabled={busy || !photoFile}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Analysing…</> : <><i className="fa-solid fa-camera" aria-hidden="true" /> Analyse photo</>}
              </button>
            </>
          )}

          {/* CONFIRM / EDIT STAGE */}
          {estimated && (
            <form onSubmit={save} className="nut-meal-form">
              {source === "photo" && photoPreview && <img src={photoPreview} alt="Your meal" className="nut-photo-preview lg" />}
              {source !== "manual" && (
                <p className="nut-ai-badge"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> AI estimate — tweak anything below before saving.</p>
              )}
              <div className="nut-field-row">
                <input className="field-grow" placeholder="Meal name" aria-label="Meal name" value={entry.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
                <select className="is-narrow" value={entry.meal_type} onChange={(e) => set("meal_type", e.target.value)} aria-label="Meal">
                  {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="nut-macro-grid">
                <label>Calories<input type="number" value={entry.calories} onChange={(e) => set("calories", e.target.value)} required /></label>
                <label>Protein g<input type="number" value={entry.protein_g} onChange={(e) => set("protein_g", e.target.value)} /></label>
                <label>Carbs g<input type="number" value={entry.carbs_g} onChange={(e) => set("carbs_g", e.target.value)} /></label>
                <label>Fat g<input type="number" value={entry.fat_g} onChange={(e) => set("fat_g", e.target.value)} /></label>
              </div>
              <div className="nut-field-row">
                <label className="nut-qty is-narrow">Servings<input type="number" step="0.5" min="0.5" value={entry.quantity} onChange={(e) => set("quantity", e.target.value)} /></label>
                <div className="nut-qty">
                  <span>Date</span>
                  <DatePicker value={entry.date} onChange={(v) => set("date", v)} />
                </div>
              </div>
              {entry.items?.length > 0 && (
                <details className="nut-items">
                  <summary>{entry.items.length} item{entry.items.length !== 1 ? "s" : ""} breakdown</summary>
                  <ul>
                    {entry.items.map((it, i) => (
                      <li key={i}><span>{it.name}{it.quantity ? ` (${it.quantity})` : ""}</span><span>{it.calories} kcal</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {error && <p className="nut-error" role="alert">{error}</p>}
              <div className="nut-modal-actions">
                {source !== "manual" && (
                  <button type="button" className="btn btn-ghost" onClick={() => setEstimated(false)}>Back</button>
                )}
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : "Save to log"}
                </button>
              </div>
            </form>
          )}

          {error && !estimated && <p className="nut-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

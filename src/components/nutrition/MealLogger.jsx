import { useRef, useState } from "react";
import { estimateMealFromText, estimateMealFromImage } from "../../api/aiFood";
import { createFoodLog, uploadMealPhoto } from "../../api/nutritionApi";
import { MEAL_TYPES, round } from "../../utils/nutrition";

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
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title"><i className="fa-solid fa-plus" /> Log a meal</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {!estimated && (
          <div className="nut-mode-tabs">
            {MODES.map((m) => (
              <button key={m.key} className={`nut-mode-tab ${mode === m.key ? "active" : ""}`}
                onClick={() => { setMode(m.key); if (m.key === "manual") startManual(); }}>
                <i className={`fa-solid ${m.icon}`} /> {m.label}
              </button>
            ))}
          </div>
        )}

        <div className="doc-viewer-body" style={{ alignItems: "stretch", gap: "0.75rem" }}>
          {/* INPUT STAGE */}
          {!estimated && mode === "ai" && (
            <>
              <p className="nut-hint">Describe what you ate — the AI estimates calories &amp; macros. e.g. <em>"two scrambled eggs, toast with butter, and a flat white"</em>.</p>
              <textarea rows={3} placeholder="What did you eat?" value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical" }} autoFocus />
              <button className="btn" onClick={runText} disabled={busy || !text.trim()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Estimating…</> : <><i className="fa-solid fa-wand-magic-sparkles" /> Estimate</>}
              </button>
            </>
          )}

          {!estimated && mode === "photo" && (
            <>
              <div className="doc-dropzone" onClick={() => fileRef.current.click()}>
                {photoPreview
                  ? <img src={photoPreview} alt="meal" className="nut-photo-preview" />
                  : <><i className="fa-solid fa-camera" /><span>Tap to take or choose a photo of your meal</span></>}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => pickPhoto(e.target.files[0])} />
              </div>
              <input placeholder="Optional hint (e.g. 'large portion, no sauce')" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn" onClick={runPhoto} disabled={busy || !photoFile}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Analysing…</> : <><i className="fa-solid fa-camera" /> Analyse photo</>}
              </button>
            </>
          )}

          {/* CONFIRM / EDIT STAGE */}
          {estimated && (
            <form onSubmit={save} className="nut-meal-form">
              {source === "photo" && photoPreview && <img src={photoPreview} alt="meal" className="nut-photo-preview lg" />}
              {source !== "manual" && (
                <p className="nut-ai-badge"><i className="fa-solid fa-wand-magic-sparkles" /> AI estimate — tweak anything below before saving.</p>
              )}
              <div className="form-row">
                <input className="field-grow" placeholder="Meal name" value={entry.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
                <select value={entry.meal_type} onChange={(e) => set("meal_type", e.target.value)}>
                  {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="nut-macro-grid">
                <label>Calories<input type="number" value={entry.calories} onChange={(e) => set("calories", e.target.value)} required /></label>
                <label>Protein g<input type="number" value={entry.protein_g} onChange={(e) => set("protein_g", e.target.value)} /></label>
                <label>Carbs g<input type="number" value={entry.carbs_g} onChange={(e) => set("carbs_g", e.target.value)} /></label>
                <label>Fat g<input type="number" value={entry.fat_g} onChange={(e) => set("fat_g", e.target.value)} /></label>
              </div>
              <div className="form-row">
                <label className="nut-qty">Servings<input type="number" step="0.5" min="0.5" value={entry.quantity} onChange={(e) => set("quantity", e.target.value)} /></label>
                <input type="date" value={entry.date} onChange={(e) => set("date", e.target.value)} />
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
              {error && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{error}</p>}
              <div className="form-row">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : "Save to log"}
                </button>
                {source !== "manual" && (
                  <button type="button" className="btn btn-ghost" onClick={() => setEstimated(false)}>Back</button>
                )}
              </div>
            </form>
          )}

          {error && !estimated && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

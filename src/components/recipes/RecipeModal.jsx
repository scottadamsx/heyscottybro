import { useEffect, useState } from "react";
import { loadProfiles, createFoodLog } from "../../api/nutritionApi";
import { MEAL_TYPES, round, todayStr } from "../../utils/nutrition";

export default function RecipeModal({ recipe, onClose, onDeleted }) {
  const [profiles, setProfiles] = useState([]);
  const [logging, setLogging] = useState(false);
  const [profileId, setProfileId] = useState(localStorage.getItem("nutritionActiveProfile") || "");
  const [mealType, setMealType] = useState("dinner");
  const [servingsEaten, setServingsEaten] = useState(1);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadProfiles().then((ps) => {
      setProfiles(ps);
      if (!ps.some((p) => p.id === profileId)) setProfileId(ps[0]?.id || "");
    }).catch(() => {});
  }, []);

  const ing = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  const logIt = async () => {
    if (!profileId) { setErr("Create a nutrition profile first."); return; }
    setBusy(true); setErr(null);
    const q = Number(servingsEaten) || 1;
    try {
      await createFoodLog(profileId, {
        date: todayStr(),
        meal_type: mealType,
        name: recipe.title,
        description: `From recipe · ${q} serving${q !== 1 ? "s" : ""}`,
        calories: round(recipe.calories_per_serving) * q,
        protein_g: round(recipe.protein_g) * q,
        carbs_g: round(recipe.carbs_g) * q,
        fat_g: round(recipe.fat_g) * q,
        quantity: 1,
        source: "recipe",
        recipe_id: recipe.id,
      });
      setDone(true);
      setTimeout(() => { setDone(false); setLogging(false); }, 1400);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">{recipe.title}</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="doc-viewer-body" style={{ alignItems: "stretch", gap: "0.85rem" }}>
          {recipe.description && <p className="nut-recipe-desc">{recipe.description}</p>}

          <div className="nut-recipe-meta">
            <span><i className="fa-solid fa-fire" /> {round(recipe.calories_per_serving)} kcal/serving</span>
            <span><i className="fa-solid fa-drumstick-bite" /> {round(recipe.protein_g)}P · {round(recipe.carbs_g)}C · {round(recipe.fat_g)}F</span>
            <span><i className="fa-solid fa-users" /> {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</span>
            {(recipe.prep_minutes || recipe.cook_minutes) ? <span><i className="fa-solid fa-clock" /> {(recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)} min</span> : null}
          </div>

          {recipe.tags?.length > 0 && (
            <div className="nut-tags">{recipe.tags.map((t) => <span className="nut-tag" key={t}>{t}</span>)}</div>
          )}

          <div className="nut-recipe-cols">
            <div>
              <h4>Ingredients</h4>
              <ul className="nut-ing-list">
                {ing.map((i, idx) => <li key={idx}><strong>{i.quantity}</strong> {i.item}</li>)}
              </ul>
            </div>
            <div>
              <h4>Method</h4>
              <ol className="nut-step-list">
                {steps.map((s, idx) => <li key={idx}>{s}</li>)}
              </ol>
            </div>
          </div>

          {/* Log this */}
          {!logging ? (
            <div className="form-row" style={{ justifyContent: "space-between" }}>
              <button className="btn" onClick={() => setLogging(true)}><i className="fa-solid fa-plus" /> Log this to my day</button>
              {onDeleted && <button className="btn danger" onClick={() => onDeleted(recipe)}>Delete recipe</button>}
            </div>
          ) : done ? (
            <p className="nut-ai-badge"><i className="fa-solid fa-check" /> Logged to today!</p>
          ) : (
            <div className="nut-log-recipe">
              <div className="form-row">
                <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                  {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <label className="nut-qty">Servings<input type="number" step="0.5" min="0.5" value={servingsEaten} onChange={(e) => setServingsEaten(e.target.value)} /></label>
              </div>
              {err && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{err}</p>}
              <div className="form-row">
                <button className="btn" onClick={logIt} disabled={busy}>{busy ? <><i className="fa-solid fa-spinner fa-spin" /> Logging…</> : `Log ${round((recipe.calories_per_serving || 0) * (Number(servingsEaten) || 1))} kcal`}</button>
                <button className="btn btn-ghost" onClick={() => setLogging(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

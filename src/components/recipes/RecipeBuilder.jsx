import { useState } from "react";
import { generateRecipe } from "../../api/aiFood";
import { createRecipe, updateRecipe } from "../../api/recipesApi";
import { round } from "../../utils/nutrition";

const blank = () => ({
  title: "", description: "", servings: 2, prep_minutes: "", cook_minutes: "",
  ingredients: [{ item: "", quantity: "" }], steps: [""],
  calories_per_serving: "", protein_g: "", carbs_g: "", fat_g: "", tags: [],
});

// Prefill from an existing recipe row so the same form edits in place.
const fromInitial = (r) => ({
  ...blank(),
  title: r.title || "", description: r.description || "",
  servings: r.servings ?? 2, prep_minutes: r.prep_minutes ?? "", cook_minutes: r.cook_minutes ?? "",
  ingredients: Array.isArray(r.ingredients) && r.ingredients.length ? r.ingredients.map((i) => ({ item: i.item || "", quantity: i.quantity || "" })) : [{ item: "", quantity: "" }],
  steps: Array.isArray(r.steps) && r.steps.length ? [...r.steps] : [""],
  calories_per_serving: r.calories_per_serving ?? "", protein_g: r.protein_g ?? "", carbs_g: r.carbs_g ?? "", fat_g: r.fat_g ?? "",
  tags: Array.isArray(r.tags) ? r.tags : [],
});

/**
 * New-recipe modal (AI or manual). Pass `initial` (an existing recipe row) to
 * open it prefilled in edit mode; save then goes through updateRecipe.
 */
export default function RecipeBuilder({ onClose, onSaved, initial = null }) {
  const isEdit = Boolean(initial?.id);
  const [tab, setTab] = useState("ai");
  const [prompt, setPrompt] = useState("");
  const [servings, setServings] = useState(2);
  const [constraints, setConstraints] = useState("");
  const [draft, setDraft] = useState(() => (initial ? fromInitial(initial) : null));   // generated/edited recipe object
  const [source, setSource] = useState(initial?.source || "ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const runAi = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await generateRecipe({ prompt: prompt.trim(), servings, constraints: constraints.trim() });
      setDraft({
        title: r.title || prompt, description: r.description || "",
        servings: r.servings || servings, prep_minutes: r.prep_minutes || 0, cook_minutes: r.cook_minutes || 0,
        ingredients: (r.ingredients || []).map((i) => ({ item: i.item, quantity: i.quantity || "" })),
        steps: r.steps || [], calories_per_serving: round(r.calories_per_serving),
        protein_g: round(r.protein_g), carbs_g: round(r.carbs_g), fat_g: round(r.fat_g),
        tags: r.tags || [],
      });
      setSource("ai");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const startManual = () => { setDraft(blank()); setSource("manual"); };

  const save = async () => {
    if (!draft.title?.trim()) { setError("Give the recipe a title."); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        ...draft,
        ingredients: draft.ingredients.filter((i) => i.item.trim()),
        steps: draft.steps.filter((s) => s.trim()),
      };
      const saved = isEdit
        ? await updateRecipe(initial.id, payload)
        : await createRecipe({ ...payload, source });
      onSaved(saved);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const setD = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setIng = (i, k, v) => setDraft((d) => ({ ...d, ingredients: d.ingredients.map((x, j) => j === i ? { ...x, [k]: v } : x) }));
  const setStep = (i, v) => setDraft((d) => ({ ...d, steps: d.steps.map((x, j) => j === i ? v : x) }));

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal nut-modal is-lg" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit recipe" : "New recipe"} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title">{isEdit ? "Edit recipe" : "New recipe"}</span>
          <button type="button" className="icon-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        {!draft && (
          <div className="nut-mode-bar">
            <div className="segmented nut-mode-tabs" role="radiogroup" aria-label="How to add">
              <button type="button" role="radio" aria-checked={tab === "ai"} className={`segmented-opt nut-mode-tab${tab === "ai" ? " active" : ""}`} onClick={() => setTab("ai")}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> AI generate</button>
              <button type="button" role="radio" aria-checked={tab === "manual"} className={`segmented-opt nut-mode-tab${tab === "manual" ? " active" : ""}`} onClick={() => { setTab("manual"); startManual(); }}><i className="fa-solid fa-pen" aria-hidden="true" /> Manual</button>
            </div>
          </div>
        )}

        <div className="doc-viewer-body nut-modal-body">
          {!draft && tab === "ai" && (
            <>
              <p className="nut-hint">Describe a dish or what you have on hand. e.g. <em>"high-protein chicken &amp; rice bowl"</em> or <em>"quick vegetarian dinner with chickpeas"</em>.</p>
              <textarea rows={2} placeholder="What do you want to cook?" aria-label="What do you want to cook?" value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus />
              <div className="nut-field-row">
                <label className="nut-qty is-narrow">Servings<input type="number" min="1" value={servings} onChange={(e) => setServings(Number(e.target.value))} /></label>
                <input className="field-grow" placeholder="Preferences (vegetarian, no nuts, <600 kcal…)" aria-label="Preferences" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
              </div>
              <button type="button" className="btn nut-modal-go" onClick={runAi} disabled={busy || !prompt.trim()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Cooking up a recipe…</> : <><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate</>}
              </button>
              {error && <p className="nut-error" role="alert">{error}</p>}
            </>
          )}

          {draft && (
            <>
              {!isEdit && source === "ai" && <p className="nut-ai-badge"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> AI draft — edit anything, then save.</p>}
              <input className="field-grow" placeholder="Title" aria-label="Title" value={draft.title} onChange={(e) => setD("title", e.target.value)} />
              <textarea rows={2} placeholder="Description" aria-label="Description" value={draft.description} onChange={(e) => setD("description", e.target.value)} />
              <div className="nut-macro-grid five">
                <label>Servings<input type="number" min="1" value={draft.servings} onChange={(e) => setD("servings", Number(e.target.value))} /></label>
                <label>Prep min<input type="number" value={draft.prep_minutes} onChange={(e) => setD("prep_minutes", e.target.value)} /></label>
                <label>Cook min<input type="number" value={draft.cook_minutes} onChange={(e) => setD("cook_minutes", e.target.value)} /></label>
                <label>kcal/serv<input type="number" value={draft.calories_per_serving} onChange={(e) => setD("calories_per_serving", e.target.value)} /></label>
                <label>Protein<input type="number" value={draft.protein_g} onChange={(e) => setD("protein_g", e.target.value)} /></label>
              </div>

              <div className="nut-edit-block">
                <div className="nut-edit-head"><strong>Ingredients</strong>
                  <button type="button" className="btn-mini" onClick={() => setD("ingredients", [...draft.ingredients, { item: "", quantity: "" }])}><i className="fa-solid fa-plus" aria-hidden="true" /><span className="visually-hidden">Add ingredient</span></button>
                </div>
                {draft.ingredients.map((ing, i) => (
                  <div className="nut-edit-row" key={i}>
                    <input className="field-grow" placeholder="Ingredient" aria-label={`Ingredient ${i + 1}`} value={ing.item} onChange={(e) => setIng(i, "item", e.target.value)} />
                    <input className="nut-qty-input" placeholder="Qty" aria-label={`Quantity ${i + 1}`} value={ing.quantity} onChange={(e) => setIng(i, "quantity", e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="nut-edit-block">
                <div className="nut-edit-head"><strong>Steps</strong>
                  <button type="button" className="btn-mini" onClick={() => setD("steps", [...draft.steps, ""])}><i className="fa-solid fa-plus" aria-hidden="true" /><span className="visually-hidden">Add step</span></button>
                </div>
                {draft.steps.map((s, i) => (
                  <div className="nut-edit-row" key={i}>
                    <span className="nut-step-num" aria-hidden="true">{i + 1}</span>
                    <textarea className="field-grow" rows={1} placeholder="Step" aria-label={`Step ${i + 1}`} value={s} onChange={(e) => setStep(i, e.target.value)} />
                  </div>
                ))}
              </div>

              {error && <p className="nut-error" role="alert">{error}</p>}
              <div className="nut-modal-actions">
                {isEdit && <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>}
                {!isEdit && source === "ai" && <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Back</button>}
                <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : isEdit ? "Save changes" : "Save recipe"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

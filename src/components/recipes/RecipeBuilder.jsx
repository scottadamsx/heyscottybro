import { useState } from "react";
import { generateRecipe } from "../../api/aiFood";
import { createRecipe } from "../../api/recipesApi";
import { round } from "../../utils/nutrition";

const blank = () => ({
  title: "", description: "", servings: 2, prep_minutes: "", cook_minutes: "",
  ingredients: [{ item: "", quantity: "" }], steps: [""],
  calories_per_serving: "", protein_g: "", carbs_g: "", fat_g: "", tags: [],
});

export default function RecipeBuilder({ onClose, onSaved }) {
  const [tab, setTab] = useState("ai");
  const [prompt, setPrompt] = useState("");
  const [servings, setServings] = useState(2);
  const [constraints, setConstraints] = useState("");
  const [draft, setDraft] = useState(null);   // generated/edited recipe object
  const [source, setSource] = useState("ai");
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
      const saved = await createRecipe({
        ...draft,
        ingredients: draft.ingredients.filter((i) => i.item.trim()),
        steps: draft.steps.filter((s) => s.trim()),
        source,
      });
      onSaved(saved);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const setD = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setIng = (i, k, v) => setDraft((d) => ({ ...d, ingredients: d.ingredients.map((x, j) => j === i ? { ...x, [k]: v } : x) }));
  const setStep = (i, v) => setDraft((d) => ({ ...d, steps: d.steps.map((x, j) => j === i ? v : x) }));

  return (
    <div className="doc-viewer-overlay" onClick={onClose}>
      <div className="doc-viewer-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="doc-viewer-header">
          <span className="doc-viewer-title"><i className="fa-solid fa-hat-chef" /> New recipe</span>
          <button className="icon-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {!draft && (
          <div className="nut-mode-tabs">
            <button className={`nut-mode-tab ${tab === "ai" ? "active" : ""}`} onClick={() => setTab("ai")}><i className="fa-solid fa-wand-magic-sparkles" /> AI generate</button>
            <button className={`nut-mode-tab ${tab === "manual" ? "active" : ""}`} onClick={() => { setTab("manual"); startManual(); }}><i className="fa-solid fa-pen" /> Manual</button>
          </div>
        )}

        <div className="doc-viewer-body" style={{ alignItems: "stretch", gap: "0.75rem" }}>
          {!draft && tab === "ai" && (
            <>
              <p className="nut-hint">Describe a dish or what you have on hand. e.g. <em>"high-protein chicken &amp; rice bowl"</em> or <em>"quick vegetarian dinner with chickpeas"</em>.</p>
              <textarea rows={2} placeholder="What do you want to cook?" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ resize: "vertical" }} autoFocus />
              <div className="form-row">
                <label className="nut-qty">Servings<input type="number" min="1" value={servings} onChange={(e) => setServings(Number(e.target.value))} /></label>
                <input className="field-grow" placeholder="Preferences (vegetarian, no nuts, <600 kcal…)" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
              </div>
              <button className="btn" onClick={runAi} disabled={busy || !prompt.trim()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Cooking up a recipe…</> : <><i className="fa-solid fa-wand-magic-sparkles" /> Generate</>}
              </button>
              {error && <p className="no-entries" style={{ color: "var(--danger,var(--red))" }}>{error}</p>}
            </>
          )}

          {draft && (
            <>
              {source === "ai" && <p className="nut-ai-badge"><i className="fa-solid fa-wand-magic-sparkles" /> AI draft — edit anything, then save.</p>}
              <input className="field-grow" placeholder="Title" value={draft.title} onChange={(e) => setD("title", e.target.value)} />
              <textarea rows={2} placeholder="Description" value={draft.description} onChange={(e) => setD("description", e.target.value)} style={{ resize: "vertical" }} />
              <div className="nut-macro-grid five">
                <label>Servings<input type="number" min="1" value={draft.servings} onChange={(e) => setD("servings", Number(e.target.value))} /></label>
                <label>Prep min<input type="number" value={draft.prep_minutes} onChange={(e) => setD("prep_minutes", e.target.value)} /></label>
                <label>Cook min<input type="number" value={draft.cook_minutes} onChange={(e) => setD("cook_minutes", e.target.value)} /></label>
                <label>kcal/serv<input type="number" value={draft.calories_per_serving} onChange={(e) => setD("calories_per_serving", e.target.value)} /></label>
                <label>Protein<input type="number" value={draft.protein_g} onChange={(e) => setD("protein_g", e.target.value)} /></label>
              </div>

              <div className="nut-edit-block">
                <div className="nut-edit-head"><strong>Ingredients</strong>
                  <button className="btn-tiny-blue" onClick={() => setD("ingredients", [...draft.ingredients, { item: "", quantity: "" }])}><i className="fa-solid fa-plus" /></button>
                </div>
                {draft.ingredients.map((ing, i) => (
                  <div className="form-row" key={i}>
                    <input className="field-grow" placeholder="Ingredient" value={ing.item} onChange={(e) => setIng(i, "item", e.target.value)} />
                    <input placeholder="Qty" value={ing.quantity} onChange={(e) => setIng(i, "quantity", e.target.value)} style={{ maxWidth: 110 }} />
                  </div>
                ))}
              </div>

              <div className="nut-edit-block">
                <div className="nut-edit-head"><strong>Steps</strong>
                  <button className="btn-tiny-blue" onClick={() => setD("steps", [...draft.steps, ""])}><i className="fa-solid fa-plus" /></button>
                </div>
                {draft.steps.map((s, i) => (
                  <div className="form-row" key={i}>
                    <span className="nut-step-num">{i + 1}</span>
                    <textarea className="field-grow" rows={1} placeholder="Step" value={s} onChange={(e) => setStep(i, e.target.value)} style={{ resize: "vertical" }} />
                  </div>
                ))}
              </div>

              {error && <p className="no-entries" style={{ color: "var(--danger,var(--red))" }}>{error}</p>}
              <div className="form-row">
                <button className="btn" onClick={save} disabled={busy}>{busy ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : "Save recipe"}</button>
                {source === "ai" && <button className="btn btn-ghost" onClick={() => setDraft(null)}>Back</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

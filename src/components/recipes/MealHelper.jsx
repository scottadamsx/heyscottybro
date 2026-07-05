import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../../utils/supabase";
import { generateRecipe } from "../../api/aiFood";
import { createRecipe } from "../../api/recipesApi";
import { useToast } from "../../contexts/ToastContext";
import "./mealhelper.css";

/**
 * Scotty's Meal Helper — "we want supper and don't know what to make."
 * Brain-dump whatever's in the kitchen; it checks the SAVED recipes and says
 * which you can make right now, which you're 1–2 items short of (and what's
 * missing), and if the cupboard beats the cookbook, suggests something new —
 * one tap generates and saves it as a full recipe.
 */
const MATCH_TOOL = {
  name: "match_recipes",
  description: "Match available ingredients against saved recipes and optionally suggest a new dish.",
  input_schema: {
    type: "object",
    properties: {
      can_make: {
        type: "array",
        description: "Recipes fully makeable now (assume pantry staples: salt, pepper, oil, butter, water, common dried spices).",
        items: { type: "object", properties: { id: { type: "string" }, note: { type: "string", description: "Optional 1-liner, e.g. 'use the cheddar instead of mozzarella'" } }, required: ["id"] },
      },
      almost: {
        type: "array",
        description: "Recipes missing only 1-2 real ingredients.",
        items: { type: "object", properties: { id: { type: "string" }, missing: { type: "array", items: { type: "string" } } }, required: ["id", "missing"] },
      },
      suggestion: {
        type: "object",
        description: "A NEW dish idea from the available ingredients — always include one, even when saved recipes match, as an alternative.",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "One appetising sentence." },
          uses: { type: "array", items: { type: "string" }, description: "Which of the available ingredients it uses" },
        },
        required: ["title", "description"],
      },
    },
    required: ["can_make", "almost"],
  },
};

export default function MealHelper({ recipes }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [have, setHave] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const byId = Object.fromEntries(recipes.map((r) => [String(r.id), r]));

  const find = async () => {
    const stock = have.trim();
    if (!stock) { addToast("Tell me what's in the kitchen first.", "error"); return; }
    setBusy(true); setResult(null);
    try {
      const compact = recipes.map((r) => ({
        id: String(r.id), title: r.title,
        ingredients: (r.ingredients || []).map((i) => i.item),
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          system: "You are a practical home cook helping decide what to make for supper. Match generously but honestly: treat close equivalents as matches (ground beef = beef mince, any onion = onion), assume pantry staples (salt, pepper, oil, butter, flour, sugar, water, dried spices), but never wave away a headline ingredient. Always call the match_recipes tool.",
          tools: [MATCH_TOOL],
          tool_choice: { type: "tool", name: "match_recipes" },
          messages: [{ role: "user", content: `INGREDIENTS I HAVE:\n${stock}\n\nMY SAVED RECIPES:\n${JSON.stringify(compact)}` }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
      const block = (data.content || []).find((b) => b.type === "tool_use");
      if (!block) throw new Error("No answer — try again.");
      setResult(block.input);
    } catch (e) { addToast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const makeSuggestion = async () => {
    if (!result?.suggestion) return;
    setSaving(true);
    try {
      const r = await generateRecipe({
        prompt: `${result.suggestion.title} — using what's on hand: ${have.trim()}`,
        servings: 2,
        constraints: "Use only the listed available ingredients plus pantry staples.",
      });
      const saved = await createRecipe({
        ...r,
        ingredients: (r.ingredients || []).filter((i) => i.item?.trim()),
        steps: (r.steps || []).filter((s) => s?.trim()),
        source: "ai",
      });
      addToast("Recipe saved — supper sorted.", "success");
      navigate(`/admin/recipe/${saved.id}`);
    } catch (e) { addToast(e.message, "error"); setSaving(false); }
  };

  return (
    <div className={`mh${open ? " open" : ""}`}>
      <button type="button" className="mh-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="mh-toggle-title"><i className="fa-solid fa-utensils" /> Scotty's Meal Helper</span>
        <span className="mh-toggle-sub">Dump what's in the kitchen → find out what's for supper</span>
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"} mh-chev`} />
      </button>

      {open && (
        <div className="mh-body">
          <textarea
            rows={3}
            value={have}
            onChange={(e) => setHave(e.target.value)}
            placeholder="chicken thighs, half a bag of potatoes, garlic, cheddar, an onion going soft, frozen peas…"
          />
          <button className="btn btn-sm" onClick={find} disabled={busy}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Checking the cookbook…</> : <><i className="fa-solid fa-magnifying-glass" /> What can I make?</>}
          </button>

          {result && (
            <div className="mh-results">
              <div className="mh-group">
                <div className="mh-group-title good"><i className="fa-solid fa-circle-check" /> You can make tonight</div>
                {(result.can_make || []).filter((m) => byId[m.id]).length === 0
                  ? <p className="mh-empty">Nothing in the cookbook fully matches — see the suggestion below.</p>
                  : (result.can_make || []).filter((m) => byId[m.id]).map((m) => (
                    <button key={m.id} type="button" className="mh-hit" onClick={() => navigate(`/admin/recipe/${m.id}`)}>
                      <span className="mh-hit-title">{byId[m.id].title}</span>
                      {m.note && <span className="mh-hit-note">{m.note}</span>}
                      <i className="fa-solid fa-arrow-right" />
                    </button>
                  ))}
              </div>

              {(result.almost || []).filter((m) => byId[m.id]).length > 0 && (
                <div className="mh-group">
                  <div className="mh-group-title warn"><i className="fa-solid fa-basket-shopping" /> One quick shop away</div>
                  {(result.almost || []).filter((m) => byId[m.id]).map((m) => (
                    <button key={m.id} type="button" className="mh-hit" onClick={() => navigate(`/admin/recipe/${m.id}`)}>
                      <span className="mh-hit-title">{byId[m.id].title}</span>
                      <span className="mh-missing">needs {m.missing.join(", ")}</span>
                      <i className="fa-solid fa-arrow-right" />
                    </button>
                  ))}
                </div>
              )}

              {result.suggestion?.title && (
                <div className="mh-group">
                  <div className="mh-group-title accent"><i className="fa-solid fa-wand-magic-sparkles" /> Or, from what you have</div>
                  <div className="mh-suggest">
                    <div className="mh-suggest-title">{result.suggestion.title}</div>
                    <p className="mh-suggest-desc">{result.suggestion.description}</p>
                    {result.suggestion.uses?.length > 0 && (
                      <div className="mh-uses">{result.suggestion.uses.map((u) => <span key={u}>{u}</span>)}</div>
                    )}
                    <button className="btn btn-sm" onClick={makeSuggestion} disabled={saving}>
                      {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Writing the recipe…</> : <><i className="fa-solid fa-plus" /> Generate & save this recipe</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

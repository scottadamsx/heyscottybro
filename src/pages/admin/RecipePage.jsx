import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRecipe, deleteRecipe, updateRecipe } from "../../api/recipesApi";
import { loadProfiles, createFoodLog } from "../../api/nutritionApi";
import { MEAL_TYPES, round, todayStr } from "../../utils/nutrition";
import { getAuthHeaders } from "../../utils/supabase";
import { Card, ExportKit } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import "./recipe.css";

/**
 * Full-page recipe view (replaces the old modal): the whole recipe as a clean
 * cookbook page — meta, ingredients, method, log-to-my-day — plus an "Ask
 * about this recipe" chat scoped to THIS recipe (substitutions, scaling,
 * technique), and ExportKit so a recipe can be printed for the kitchen or
 * emailed to your phone.
 */

function AskRecipe({ recipe }) {
  const [msgs, setMsgs] = useState([]);        // { role, text }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const ask = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const nextMsgs = [...msgs, { role: "user", text: q }];
    setMsgs(nextMsgs);
    setBusy(true);
    try {
      const system =
        "You are a sharp, practical cooking assistant answering questions about ONE specific recipe. " +
        "Be concise and concrete — amounts, times, temperatures. For substitutions give the ratio. " +
        "If scaling, recalculate the ingredient quantities. Only discuss this recipe and cooking.\n\nTHE RECIPE:\n" +
        JSON.stringify({
          title: recipe.title, description: recipe.description, servings: recipe.servings,
          calories_per_serving: recipe.calories_per_serving, protein_g: recipe.protein_g,
          carbs_g: recipe.carbs_g, fat_g: recipe.fat_g,
          ingredients: recipe.ingredients, steps: recipe.steps, tags: recipe.tags,
        });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 900,
          system,
          messages: nextMsgs.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setMsgs((m) => [...m, { role: "assistant", text: text || "…" }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Couldn't answer: ${e.message}` }]);
    } finally { setBusy(false); }
  };

  return (
    <Card title="Ask about this recipe" icon="fa-wand-magic-sparkles" className="recipe-ask">
      {msgs.length === 0 && (
        <div className="recipe-ask-hints">
          {["Can I make this without bacon?", "Scale it to 4 servings", "What can replace chipotle peppers?"].map((h) => (
            <button key={h} type="button" onClick={() => setInput(h)}>{h}</button>
          ))}
        </div>
      )}
      <div className="recipe-ask-thread">
        {msgs.map((m, i) => (
          <div key={i} className={`recipe-ask-msg ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="recipe-ask-msg assistant recipe-ask-typing"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>
      <div className="recipe-ask-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          placeholder="Substitutions, scaling, technique…"
        />
        <button className="btn btn-sm" onClick={ask} disabled={busy || !input.trim()}>
          {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-paper-plane" />}
        </button>
      </div>
    </Card>
  );
}

export default function RecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [recipe, setRecipe] = useState(undefined); // undefined = loading, null = missing
  const [profiles, setProfiles] = useState([]);
  const [logging, setLogging] = useState(false);
  const [profileId, setProfileId] = useState(localStorage.getItem("nutritionActiveProfile") || "");
  const [mealType, setMealType] = useState("dinner");
  const [servingsEaten, setServingsEaten] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRecipe(id).then(setRecipe).catch(() => setRecipe(null));
    loadProfiles().then((ps) => {
      setProfiles(ps);
      setProfileId((cur) => (ps.some((p) => p.id === cur) ? cur : ps[0]?.id || ""));
    }).catch(() => {});
  }, [id]);

  if (recipe === undefined) return <div className="module-page"><p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading recipe…</p></div>;
  if (recipe === null) return (
    <div className="module-page">
      <p className="no-entries">Recipe not found — it may have been deleted.</p>
      <button className="btn btn-sm" onClick={() => navigate("/admin/life?tab=recipes")}>Back to recipes</button>
    </div>
  );

  const ing = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const totalMin = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);

  const toggleFav = async () => {
    const updated = await updateRecipe(recipe.id, { favorite: !recipe.favorite });
    setRecipe(updated);
  };

  const onDelete = async () => {
    if (!await confirm(`Delete "${recipe.title}"?`, { title: "Delete recipe", confirmLabel: "Delete" })) return;
    await deleteRecipe(recipe.id);
    addToast("Recipe deleted.", "success");
    navigate("/admin/life?tab=recipes");
  };

  const logIt = async () => {
    if (!profileId) { addToast("Create a nutrition profile first.", "error"); return; }
    setBusy(true);
    const q = Number(servingsEaten) || 1;
    try {
      await createFoodLog(profileId, {
        date: todayStr(), meal_type: mealType, name: recipe.title,
        description: `From recipe · ${q} serving${q !== 1 ? "s" : ""}`,
        calories: round(recipe.calories_per_serving) * q,
        protein_g: round(recipe.protein_g) * q,
        carbs_g: round(recipe.carbs_g) * q,
        fat_g: round(recipe.fat_g) * q,
        quantity: 1, source: "recipe", recipe_id: recipe.id,
      });
      addToast(`Logged ${round((recipe.calories_per_serving || 0) * q)} kcal to today.`, "success");
      setLogging(false);
    } catch (e) { addToast(e.message, "error"); } finally { setBusy(false); }
  };

  const exporter = {
    title: recipe.title,
    filename: recipe.title,
    toMarkdown: () => {
      const L = [`# ${recipe.title}`, ""];
      if (recipe.description) L.push(recipe.description, "");
      L.push(`**${round(recipe.calories_per_serving)} kcal/serving** · ${round(recipe.protein_g)}P · ${round(recipe.carbs_g)}C · ${round(recipe.fat_g)}F · ${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}${totalMin ? ` · ${totalMin} min` : ""}`, "");
      L.push("## Ingredients", "");
      ing.forEach((i) => L.push(`- **${i.quantity}** ${i.item}`));
      L.push("", "## Method", "");
      steps.forEach((s, i2) => L.push(`${i2 + 1}. ${s}`));
      return L.join("\n");
    },
  };

  return (
    <div className="module-page recipe-page">
      {dialog}
      <div className="recipe-topbar">
        <button className="btn btn-sm btn-secondary-sm" onClick={() => navigate(-1)}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <div className="recipe-topbar-actions">
          <button className="btn btn-sm btn-secondary-sm" onClick={toggleFav} title={recipe.favorite ? "Unfavourite" : "Favourite"}>
            <i className={`fa-${recipe.favorite ? "solid" : "regular"} fa-star`} style={recipe.favorite ? { color: "var(--orange)" } : undefined} />
          </button>
          <ExportKit exporter={exporter} />
          <button className="btn btn-sm btn-secondary-sm recipe-del" onClick={onDelete}><i className="fa-solid fa-trash" /></button>
        </div>
      </div>

      <header className="recipe-head">
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="recipe-desc">{recipe.description}</p>}
        <div className="nut-recipe-meta">
          <span><i className="fa-solid fa-fire" /> {round(recipe.calories_per_serving)} kcal/serving</span>
          <span><i className="fa-solid fa-drumstick-bite" /> {round(recipe.protein_g)}P · {round(recipe.carbs_g)}C · {round(recipe.fat_g)}F</span>
          <span><i className="fa-solid fa-users" /> {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</span>
          {totalMin ? <span><i className="fa-solid fa-clock" /> {totalMin} min</span> : null}
          {recipe.source === "ai" && <span className="nut-ai-pill"><i className="fa-solid fa-wand-magic-sparkles" /> AI</span>}
        </div>
        {recipe.tags?.length > 0 && <div className="nut-tags">{recipe.tags.map((t) => <span className="nut-tag" key={t}>{t}</span>)}</div>}
      </header>

      <div className="nut-recipe-cols recipe-cols">
        <div>
          <h4>Ingredients</h4>
          <ul className="nut-ing-list">
            {ing.map((i2, idx) => <li key={idx}><strong>{i2.quantity}</strong> {i2.item}</li>)}
          </ul>
        </div>
        <div>
          <h4>Method</h4>
          <ol className="nut-step-list">
            {steps.map((s, idx) => <li key={idx}>{s}</li>)}
          </ol>
        </div>
      </div>

      {/* Log to my day */}
      <Card title="Log to my day" icon="fa-plus">
        {!logging ? (
          <button className="btn btn-sm" onClick={() => setLogging(true)}><i className="fa-solid fa-plus" /> Log this to my day</button>
        ) : (
          <div className="recipe-log">
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
            <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <label className="nut-qty">Servings<input type="number" step="0.5" min="0.5" value={servingsEaten} onChange={(e) => setServingsEaten(e.target.value)} /></label>
            <button className="btn btn-sm" onClick={logIt} disabled={busy}>
              {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Logging…</> : `Log ${round((recipe.calories_per_serving || 0) * (Number(servingsEaten) || 1))} kcal`}
            </button>
            <button className="btn btn-sm btn-secondary-sm" onClick={() => setLogging(false)}>Cancel</button>
          </div>
        )}
      </Card>

      <AskRecipe recipe={recipe} />
    </div>
  );
}

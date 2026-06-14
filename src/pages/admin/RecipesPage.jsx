import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadRecipes, deleteRecipe, updateRecipe } from "../../api/recipesApi";
import RecipeBuilder from "../../components/recipes/RecipeBuilder";
import RecipeModal from "../../components/recipes/RecipeModal";
import { round } from "../../utils/nutrition";
import { useConfirm } from "../../hooks/useConfirm";

export default function RecipesPage() {
  const [params] = useSearchParams();
  const filter = params.get("filter") || "all";
  const { confirm, dialog } = useConfirm();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true); setError(null);
    loadRecipes().then(setRecipes).catch(() => setError("Failed to load recipes.")).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const onSaved = (r) => { setRecipes((prev) => [r, ...prev]); setShowBuilder(false); setOpen(r); };

  const onDeleted = async (r) => {
    if (!await confirm(`Delete "${r.title}"?`, { title: "Delete recipe", confirmLabel: "Delete" })) return;
    await deleteRecipe(r.id);
    setRecipes((prev) => prev.filter((x) => x.id !== r.id));
    setOpen(null);
  };

  const toggleFav = async (r, e) => {
    e.stopPropagation();
    const updated = await updateRecipe(r.id, { favorite: !r.favorite });
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) =>
      (filter === "all" || (filter === "favorites" && r.favorite) || (filter === "ai" && r.source === "ai")) &&
      (!q || r.title.toLowerCase().includes(q) || (r.tags || []).some((t) => t.toLowerCase().includes(q)))
    );
  }, [recipes, filter, search]);

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>👨‍🍳 Recipes</h1>
        <button className="btn" onClick={() => setShowBuilder(true)}><i className="fa-solid fa-plus" /> New recipe</button>
      </div>

      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        <i className="fa-solid fa-wand-magic-sparkles" /> Generate recipes with AI or add your own. Tap any recipe to view it and log it to your day.
      </p>

      <input className="hiker-search" placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}
      {error && <p className="no-entries" style={{ color: "var(--danger,#ef4444)" }}>{error} <button className="btn-tiny-blue" onClick={load}>Retry</button></p>}
      {!loading && !error && filtered.length === 0 && <p className="no-entries">No recipes yet. Create one to get started.</p>}

      <div className="nut-recipe-grid">
        {filtered.map((r) => (
          <button className="nut-recipe-card" key={r.id} onClick={() => setOpen(r)}>
            <div className="nut-recipe-card-head">
              <span className="nut-recipe-title">{r.title}</span>
              <i className={`fa-${r.favorite ? "solid" : "regular"} fa-star nut-fav ${r.favorite ? "on" : ""}`} onClick={(e) => toggleFav(r, e)} />
            </div>
            {r.description && <span className="nut-recipe-card-desc">{r.description}</span>}
            <div className="nut-recipe-card-meta">
              <span><i className="fa-solid fa-fire" /> {round(r.calories_per_serving)} kcal</span>
              <span><i className="fa-solid fa-drumstick-bite" /> {round(r.protein_g)}g P</span>
              {r.source === "ai" && <span className="nut-ai-pill"><i className="fa-solid fa-wand-magic-sparkles" /> AI</span>}
            </div>
            {r.tags?.length > 0 && <div className="nut-tags">{r.tags.slice(0, 3).map((t) => <span className="nut-tag" key={t}>{t}</span>)}</div>}
          </button>
        ))}
      </div>

      {showBuilder && <RecipeBuilder onClose={() => setShowBuilder(false)} onSaved={onSaved} />}
      {open && <RecipeModal recipe={open} onClose={() => setOpen(null)} onDeleted={onDeleted} />}
      {dialog}
    </div>
  );
}

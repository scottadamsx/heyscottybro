import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadRecipes, updateRecipe } from "../../api/recipesApi";
import RecipeBuilder from "../../components/recipes/RecipeBuilder";
import MealHelper from "../../components/recipes/MealHelper";
import { round } from "../../utils/nutrition";

export default function RecipesPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const filter = params.get("filter") || "all";

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true); setError(null);
    loadRecipes().then(setRecipes).catch(() => setError("Failed to load recipes.")).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const onSaved = (r) => { setRecipes((prev) => [r, ...prev]); setShowBuilder(false); navigate(`/admin/recipe/${r.id}`); };

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
        <h1>Recipes</h1>
        <button type="button" className="btn btn-sm" onClick={() => setShowBuilder(true)}><i className="fa-solid fa-plus" aria-hidden="true" /> New recipe</button>
      </div>

      <p className="recipes-intro">
        <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate recipes with AI or add your own. Tap any recipe to view it and log it to your day.
      </p>

      <MealHelper recipes={recipes} />

      <input className="recipes-search" placeholder="Search recipes…" aria-label="Search recipes" value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading…</p>}
      {error && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{error}</p>
          <button type="button" className="btn btn-sm" onClick={load}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && <p className="no-entries">No recipes yet. Create one to get started.</p>}

      <div className="nut-recipe-grid">
        {filtered.map((r) => (
          <article className="nut-recipe-card" key={r.id}>
            <div className="nut-recipe-card-head">
              {/* The title button stretches over the whole card (::after), so the card opens on click; the star sits above it. */}
              <button type="button" className="nut-recipe-open" onClick={() => navigate(`/admin/recipe/${r.id}`)}>
                <span className="nut-recipe-title">{r.title}</span>
              </button>
              <button type="button" className={`nut-fav${r.favorite ? " on" : ""}`} onClick={(e) => toggleFav(r, e)} aria-pressed={Boolean(r.favorite)} aria-label={r.favorite ? `Unfavourite ${r.title}` : `Favourite ${r.title}`}>
                <i className={`fa-${r.favorite ? "solid" : "regular"} fa-star`} aria-hidden="true" />
              </button>
            </div>
            {r.description && <span className="nut-recipe-card-desc">{r.description}</span>}
            <div className="nut-recipe-card-meta">
              <span><i className="fa-solid fa-fire" aria-hidden="true" /> {round(r.calories_per_serving)} kcal</span>
              <span><i className="fa-solid fa-drumstick-bite" aria-hidden="true" /> {round(r.protein_g)}g P</span>
              {r.source === "ai" && <span className="uik-badge tone-accent nut-ai-pill"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> AI</span>}
            </div>
            {r.tags?.length > 0 && <div className="nut-tags">{r.tags.slice(0, 3).map((t) => <span className="nut-tag" key={t}>{t}</span>)}</div>}
          </article>
        ))}
      </div>

      {showBuilder && <RecipeBuilder onClose={() => setShowBuilder(false)} onSaved={onSaved} />}
    </div>
  );
}

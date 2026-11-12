# Food log AI — item database caching

## Status
- **Proposed:** 2026-10-18. Scott said **"go"** on 2026-10-18. Implementation authorized (local only; no commit/push/deploy/migration-apply without separate approval).

## Ordered steps
- [x] Read house rules, feature doc approved by Scott ("go" 2026-10-18)
- [x] Write migration SQL (unapplied): MIGRATION_2026-10-18-food-item-cache.sql
- [x] Implement cache helpers + estimateFood changes
- [x] Update FoodModal save flow + cached badge UI
- [x] Write tests (6/6 pass), added to npm test script
- [x] Update WORKLOG.md
- [x] Lint clean, full suite 329/329 pass, production build succeeds
- [ ] Present for commit/push/deploy + migration-apply approval

## Source
- Tracker task "Food log AI improvement — item database caching" (due Oct 5, overdue).
- Task notes (verbatim intent): when the AI searches the web for calories on the food log page, each individual item in the prompt should be broken down separately and saved to a local food database. Next time a known item is entered, the app should pull from the database instead of searching the web again. Current behaviour: items like Veggie Straws, Grenade White Oreo Bar, McSweeneys Pep and Cheddies are grouped into one log entry. Ideally each becomes its own DB record after the first lookup.

## Contract
1. New `food_item_cache` table: one row per distinct food item the AI has ever estimated for this profile. Columns: `id, profile_id, name_normalized (unique per profile), name_display, calories, protein_g, carbs_g, fat_g, quantity_basis, source, source_url, use_count, created_at, updated_at`. Owner-only RLS, same pattern as `food_logs`.
2. `estimateFood()` checks the cache before any web search or AI call:
   - Whole-description exact match → instant return, zero AI cost.
   - Otherwise split the description into candidate items, check each; cached items return instantly.
   - Only unknown items go through the existing AI + web-search flow; each returned item is then saved to the cache.
3. Every item in the AI response is saved to the cache after the first lookup (upsert on `name_normalized`, bump `use_count`).
4. On save, each item becomes its own `food_logs` row (ungrouped), with `source` set to `ai-cache` when it came from the cache or `ai` when freshly estimated. The meal-level totals remain on the form for review before saving.
5. UI: cached items show a "from your food database" badge; no "Estimating..." wait for fully-cached descriptions.

## Out of scope
- Editing or merging cache entries (a wrong cached value is fixed by re-estimating; a "refresh" affordance is future work).
- Sharing cache across profiles.

## Pseudocode
```
estimateFood(description, { mealType }):
    text = normalize(description)
    hit = cacheLookup(profile_id, text)            # whole-description match
    if hit: return mealFromCache(hit)

    candidates = splitItems(text)                   # ["veggie straws", "grenade white oreo bar"]
    cached = []
    unknown = []
    for c in candidates:
        row = cacheLookup(profile_id, c)
        if row: cached.push({...row, cached: true})
        else: unknown.push(c)

    fresh = []
    if unknown not empty:
        aiOut = existing searchThenTool(unknown joined)   # unchanged AI flow
        for item in aiOut.items:
            saveToCache(profile_id, item)            # upsert, use_count + 1
            fresh.push({...item, cached: false})

    items = cached + fresh
    return { name, meal_type, totals: sum(items), items, searches }

onSave(food form):
    for each item in form.items:
        addFood(profile_id, { ..., name: item.name, calories: item.calories,
                              protein_g, carbs_g, fat_g, source: item.cached ? "ai-cache" : "ai" })
    # one food_logs row per item; no grouped single row
```

## Validation
- New test: repeat estimate of a cached item performs zero AI calls (mock searchThenTool, assert not called). PASS (src/api/foodItemCache.test.js).
- New test: multi-item description with one cached + one unknown item → one AI call, two cache rows afterwards. PASS.
- Existing food/aiHealth tests keep passing; lint clean. PASS: full npm test suite 329/329, eslint clean on all touched files, production build succeeds.
- Note: foodEstimateCore.js holds the pure logic (no Vite/Supabase imports) so it runs under plain node:test; aiHealth.js wraps it with the real searchThenTool + supabase cache.

## Open question for Scott
- Whole-description cache match vs per-item only: the contract does both (whole first, then per-item). If he wants per-item only, drop the whole-description lookup.

# Food estimate accuracy

## Request (Scott, 2026-10-20)

Scott's instruction in chat: the calorie guess "must be on point", find a way to fix it, and produce a completion document. Recorded here per AGENTS.md because chat is not a durable source. Trigger: today's logged lunch (conference plate, first meal of the day) was estimated by the app at 927 kcal / 42 g protein; the chicken parmesan alone came back at 240 kcal / 22 g protein, which is a small grilled portion, not the full breaded cutlet in his photo (realistically about 450 kcal / 38 g). The mixed vegetables saved with 0 macros.

## Diagnosis (verified in code, 2026-10-20)

1. **The estimate tool schema cannot return per-item macros.** In `src/api/aiHealth.js`, `FOOD_TOOL.items` declares only `name`, `quantity`, `calories`. The save path (`addFoodItems` in `src/api/healthApi.js`) faithfully persists per-item `protein_g` / `carbs_g` / `fat_g`, but the AI is never able to supply them, so item rows save with 0 macros. The pure core (`foodEstimateCore.js`) and the cache already carry macros end to end; the schema is the single bottleneck. The same gap poisons `food_item_cache`: AI items are cached without macros.
2. **The prompt invites small portions.** It says "estimate from typical portions" with no portion standard, no anchor values, and no consistency rule, so the model defaults to conservative diet-sized portions for plated entrees.

## Contract

- Scope: `FOOD_TOOL` items schema and the estimate system prompt in `src/api/aiHealth.js`, plus one source-boundary regression test.
- Non-goals: no change to the cache flow, save path, or UI; no production data changes (today's log entry and stale cache rows are separate, approval-gated follow-ups below); no dependency changes; no commit, push, or deploy in this step.

## Pseudocode

```
estimateFood(description):
  cache checks (unchanged)
  AI flow with FOOD_TOOL v2:
    items[] = { name, quantity, calories, protein_g, carbs_g, fat_g }  (all required)
    prompt rules:
      - default portion = one standard restaurant/catering serving (a full plate item), not a diet portion
      - estimate macros for EVERY item; 0 only when the food truly has none
      - anchor ranges for common entrees (e.g. chicken parmesan 450-650 kcal, 35-45 g protein)
      - meal totals must equal the sum of the items; a meat serving's protein is rarely under 20 g
  core returns items unchanged (already macro-aware)
  addFoodItems saves per-item macros (already does)
```

## Steps

- [x] Record request and diagnosis (this document)
- [x] Extend `FOOD_TOOL` items schema with required per-item macros
- [x] Add portion, per-item macro, and consistency rules to the estimate prompt
- [x] Add source-boundary regression test for the schema and prompt rules
- [x] Run lint, full test suite, and production build
- [ ] Ship gate: commit, push, deploy require Scott's "go" (repo rule)
- [ ] Follow-up (needs Scott's approval, production data): correct today's chicken parmesan log entry, and re-estimate or clear `food_item_cache` rows saved before this fix (they hold small-portion calories and 0 macros, including today's chicken parmesan at 240 kcal)

## Verification (2026-10-20)

- Focused tests: `foodEstimateSchema.test.js` (2 new) + `foodItemCache.test.js` (6) pass, 8/8.
- `npm run lint`: clean (zero warnings).
- `npm test`: full suite passes (exit 0).
- `npm run build`: production build passes.
- Recorded as BUG-069 in `docs/development/BUGS.md` and in `docs/development/WORKLOG.md`.
- Not verified: a live AI estimate against the new schema/prompt (needs deployment and a real request, both behind the ship gate).

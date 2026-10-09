# Adaptive workout progression

**Status:** Expanded contract approved for local implementation; uncommitted
**Session:** `SAI00000004`
**Requested:** 2026-10-03

## Goal

Scott wants each exercise's suggested working weight to use his actual historical sets and push him forward gradually over time, rather than relying mainly on the last workout. The recommendation must show the history and reasoning behind it, remain conservative, and never prevent a manual choice.

Scott then explicitly required research to ensure the algorithm is backed by science. Every progression, effort, stall, deload, and time-away rule must now be checked against primary research or authoritative position stands. Unsupported numeric thresholds must be removed or labelled as conservative product policy rather than scientific fact before approval.

Scott subsequently expanded the feature to create a durable exercise record whenever an exercise is actually added, expose those records in an **Exercises** list, derive personal records from logged sets, and let him save a performance goal such as Bench Press at a chosen weight and repetition count. Exercise form knowledge is explicitly deferred so Scott can add it later.

The algorithm is deterministic. It does not send workout history to an AI provider. “Adaptive” means that the recommendation reacts to Scott's own completed performance; it does not claim that a complicated formula outperforms consistent progressive training.

## Exercise library, records, and goals

### Durable exercise identity

- Add an owner-scoped exercise library. Each record has a display name, a case- and whitespace-normalized name used for deduplication, and one optional active goal expressed as **weight × reps**.
- Create or reuse the exercise record when Scott saves a workout plan containing it, adds it to a live workout, or logs a set. Merely typing a name and then cancelling must not create a record.
- The set-log path is the final safety net so every exercise with real logged performance appears in the library. Concurrent saves of spelling/case variants must resolve to one owner-scoped record.
- Existing logged exercise names are backfilled into the library by the additive migration when it is eventually approved and applied. The migration source may be implemented locally after this revised contract is approved; applying it to any database remains a separate gate.
- Historical set rows remain the source of truth. The library does not copy or own workout results.

### Exercises interface

- Add **Exercises** as a Health navigation tab with an accurate small `N` count from rendered exercise records.
- The list shows each exercise's name, active goal when present, most recent performance, and concise PR summary. Selecting an exercise opens its detail view with logged history and the progression evidence already required by this feature.
- The detail view lets Scott set, edit, or clear one active performance goal using weight and repetitions. A goal such as **Bench Press — 225 lb × 1** is incomplete until both values are valid positive numbers.
- Form cues, technique notes, links, and AI-generated knowledge are not part of this implementation. The record design must remain extensible so those can be approved and added later.

### Personal records and goal progress

- Calculate records directly from current, non-deleted logged sets so edits and deletions cannot leave stale PR rows behind.
- Show at least the heaviest completed weight and the best estimated one-repetition maximum, with the actual `weight × reps` set that produced each result. Estimated values are clearly labelled estimates.
- A performance goal is achieved only by an actual logged set whose weight is at least the goal weight and whose reps are at least the goal reps. An estimated equivalent set may illustrate progress but must never mark the exact goal achieved.
- Goal progress may compare the best estimated one-repetition maximum with the goal's estimated equivalent, but it must be labelled **Estimated progress** and must not exceed 100%.
- Ties use the newest qualifying logged set for display. Reloads, edits, and deletion recalculate records deterministically.

### Data and safety boundary

- Add an additive owner-scoped `exercise_library` table with row-level security, timestamps, display name, normalized name, nullable goal weight, and nullable goal reps. Enforce one normalized name per owner and require both goal fields together or neither.
- Exercise creation and goal writes use the existing authenticated health API boundary. No production data, migration application, dependency, provider, or AI change is authorized by the contract alone.
- API failure must remain visible and retryable. A failed exercise upsert must not be presented as saved, and a set-log failure must retain the existing recovery behavior.

## Research review

The final design uses these evidence levels:

- **Strongest current foundation:** The 2026 ACSM position stand synthesized 137 systematic reviews covering more than 30,000 participants. It supports progressive resistance training and goal-specific load/volume, while finding that complex periodization and several advanced methods do not consistently improve outcomes for the average healthy adult. The algorithm must therefore stay understandable and avoid complexity for its own sake. [ACSM 2026 position stand](https://pubmed.ncbi.nlm.nih.gov/41843416/)
- **Load progression anchor:** ACSM's progression stand recommends increasing load by 2–10% when the current workload can be performed for one or two repetitions beyond the desired number. The app uses the smallest available step inside that range and adds repetitions instead when the smallest available jump would be too large. [ACSM progression models](https://pubmed.ncbi.nlm.nih.gov/19204579/)
- **Autoregulation:** A systematic review/meta-analysis found autoregulated and standardized load prescription produced similar overall strength improvements, with possible practical value for matching day-to-day performance but no basis for claiming universal superiority. History and effort adjust a conservative recommendation; they do not create a black-box “optimal” weight. [Autoregulation review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/)
- **Effort ratings:** A 118-study review found RPE valid for monitoring resistance-exercise intensity, but with very high between-study heterogeneity. Separate RIR work found accuracy worsens at lighter loads. RPE is therefore a supporting brake on progression only when Scott logs it; missing RPE never blocks progress and one rating never drives a load change alone. [RPE validity review](https://pubmed.ncbi.nlm.nih.gov/35000021/) · [RIR accuracy study](https://pubmed.ncbi.nlm.nih.gov/33337690/)
- **Deloads:** Deloading remains under-researched. Expert consensus defines its purpose but does not establish one optimal prescription, and a randomized one-week training cessation study did not improve adaptations and produced worse lower-body strength gains than continuous training. The app will not schedule automatic percentage deloads from an invented formula. It may recommend one loadable step down after repeated underperformance and explain why. [Deload consensus](https://pubmed.ncbi.nlm.nih.gov/37730925/) · [Deload trial](https://pubmed.ncbi.nlm.nih.gov/38274324/)

No consulted source supports universal 21-day/42-day cutoffs or a fixed automatic 7.5–10% deload for this product. Those initial thresholds are removed. A training gap lowers recommendation confidence and prevents an automatic increase; it does not prescribe a date-only reduction.

## Current behavior

`suggestNext` currently matches the exercise name case-insensitively and uses simple double progression:

- First occurrence: use an optional saved starting weight or leave weight blank.
- Every working set reaches the top of the range: add 5 lb, or 2.5 lb below 20 lb.
- Any set below the minimum: repeat the same weight.
- Three consecutive below-range sessions at the same weight: deload 10%.
- Otherwise: keep the weight and target one more rep.
- Once Scott logs today's first set, that manually chosen weight carries through today's later sets.

This is predictable but does not use the broader trend, optional RPE, time away, completion quality, or confidence. The UI shows only the last session, not the history supporting the recommendation.

## Proposed behavior

### Historical evidence

- Use up to the six most recent completed sessions for the same canonical exercise name; exclude the current live session. Six is an explainability/product window, not a physiological threshold.
- Keep warm-up sets from controlling the recommendation. Derive each session's working load from its heaviest repeated load and compare only the planned number of working sets.
- For each session calculate working weight, completed planned sets, per-set reps, total reps, optional RPE, and days since training. Estimated one-rep max may be displayed as context but does not determine the next load, especially for high-repetition work.
- Show a **History** action on each live exercise. It opens the six-session evidence list with an accurate `N` count and identifies the exact sessions used.
- Keep the existing one-line **Last time** summary and add a plain-language recommendation reason and confidence (`Low`, `Medium`, or `High`).

### Evidence-backed slow progression policy

- **No history:** use an explicit saved starting weight; otherwise ask Scott to choose the first working weight. This includes resolving `BUG-065` so a weight Scott explicitly gives the builder becomes structured starting weight.
- **One usable session:** repeat its working weight and improve reps; confidence is Low.
- **Within the rep range:** hold weight and target one additional total rep, distributed toward the earliest incomplete set without exceeding the range.
- **Ready to increase:** for Scott's deliberately slow progression, require all planned working sets at the top of the range in two consecutive completed sessions. This two-session confirmation is conservative product policy, not a claim of superiority. Increase by the smallest configured loadable step only when it is within ACSM's 2–10% range; otherwise keep the load and reps or ask Scott to choose a smaller available increment. Reset the target to the bottom of the rep range.
- **High effort:** when consistently logged RPE indicates near-maximal effort, hold rather than increase. The exact default brake is RPE above 9, clearly labelled as a conservative app policy; RPE never overrides an explicit manual choice.
- **One poor session:** repeat the weight; do not punish a single off day.
- **Two consecutive poor sessions:** recommend one smallest loadable step lower and target the bottom of the range. This is a conservative recovery response, not an evidence claim that two is a universal threshold.
- **Continued decline:** keep the one-step reduction recommendation and suggest reviewing sleep, recovery, technique, or the rep target; do not automatically prescribe a larger percentage deload.
- **Training gap:** never increase solely from pre-gap success. Repeat the last established load with Low confidence and let Scott lower it manually if needed; no date-only strength-loss assumption is made.
- **Mixed/manual loading:** Scott's manually logged first set controls all later set prefills that day. The next completed workout recalculates from the full saved result.
- **Safety bounds:** never suggest negative weight, never jump more than one loadable step upward at once, never infer equipment increments that are not configured, and never silently merge differently named exercises.

### Loadable steps

- Default cable, machine, and dumbbell rounding remains 2.5 lb, but the app does not increase when that default would exceed 10% of the current working load.
- Barbell totals remain constrained to paired plates and the configured bar weight, normally a 5 lb total step.
- A later separately approved equipment setting may define a machine's real stack increment. Until then, the app states which default it used.

## SPEC-GAP — sub-2% equipment increments

The approved rules simultaneously require one smallest loadable step and require every increase to fall within ACSM's 2–10% range. At heavier weights those conditions conflict: a 5 lb barbell step from 300 lb is about 1.7%. Rejecting that increase would make the algorithm hold forever, while jumping multiple equipment steps would violate the slow one-step rule.

**Recommendation:** Treat 10% as the hard upward safety cap, but allow one smallest configured step below 2%. The ACSM range is progression guidance, not evidence that a smaller available increase is harmful; the smaller step best matches Scott's slow-progression requirement.

Alternatives:

1. **Recommended:** one smallest loadable step whenever it is no more than 10%; explain the actual percentage, including sub-2% increments.
2. Jump by the smallest whole number of equipment steps that reaches 2%, capped at 10%; this can be more aggressive.
3. Never increase below 2%; heavy exercises eventually require manual intervention.

Scott selected option 1 with exact **“go”** on 2026-10-03: use one smallest configured step whenever it is no more than 10%, including sub-2% increases, and explain the actual percentage. Application implementation may resume.

## Plain-language pseudocode

```text
when Scott saves a plan, adds a live exercise, or logs a set:
  normalize the exercise name without changing its display spelling
  create or reuse one owner-scoped exercise record
  never create a record for abandoned typed text

when Scott opens Exercises:
  list the rendered exercise records with an accurate count
  for the selected exercise, read its current logged sets
  derive the heaviest-weight PR and best estimated-strength PR
  show the actual set and date behind each record
  show all logged history and the six-session recommendation evidence

when Scott saves a goal:
  require positive weight and repetitions together
  save one active weight-times-reps goal on the exercise record
  mark it achieved only when a real set meets both thresholds
  label any equivalent-strength comparison as estimated progress

when showing or starting an exercise:
  find completed historical sets whose normalized exercise name exactly matches
  group them into completed sessions, excluding today's live session
  keep the six newest usable sessions

  if there is no usable history:
    recommend the saved explicit starting weight when one exists
    otherwise leave weight empty and ask Scott to choose
    explain that this is the baseline

  for each historical session:
    separate warm-up loads from the repeated working load
    measure planned sets completed, reps in range, total reps, estimated strength, and RPE

  if training resumed after a meaningful gap:
    repeat the last established load with low confidence and do not auto-increase
  else if all planned sets reached the top in two consecutive sessions
          and consistently logged effort was not excessive:
    add one smallest loadable step when it is no more than a 10 percent increase
    allow a smaller-than-2-percent step when that is the smallest available increment
    otherwise hold and explain that the available jump is too large
    restart at the bottom of the rep range after a load increase
  else if top reps were reached at very high effort:
    keep the weight for one more session
  else if performance is inside the range:
    keep the weight and add one total rep
  else if one session fell short:
    repeat the weight
  else if two sessions fell short:
    lower one loadable step
  else if performance keeps declining:
    keep the one-step reduction and recommend reviewing recovery or the target

  show the suggested weight, rep target, confidence, exact reason, and history used
  if Scott manually logs another weight today:
    use Scott's weight for the remaining sets today
```

## Scenario matrix

Automated and rendered coverage must mark each scenario Passed, Failed, or Untested:

- No history with and without an explicit starting weight.
- One session, two sessions, and six-or-more sessions.
- Rep progress within range, complete top-range success, one miss, two misses, three misses, and mixed success.
- RPE absent, moderate, exactly 9, and above 9.
- Warm-up sets plus working sets; changing weight between working sets; extra and missing sets.
- Barbell, machine/dumbbell, tiny weight, rounding boundary, sub-2% smallest step, and 10% maximum increase.
- A recent session and several gap lengths, proving a gap prevents automatic increase without inventing a universal strength-loss date.
- Manual first-set override and later-set prefills.
- Edited/deleted historical sets, reload, duplicate events, current-session exclusion, and concurrent history refresh.
- Name casing, whitespace, a genuinely different exercise, and an explicitly renamed exercise.
- History load error and recovery; no recommendation may masquerade as valid when history is unavailable.
- Accurate History list counts, keyboard/mobile interaction, and reason/confidence accessibility.
- `BUG-065`: an explicit builder weight becomes `startWeightLb` rather than note-only text.
- Library auto-creation from saved plan, live-workout add, and set-log safety net; cancelled typed text creates nothing.
- Case/whitespace deduplication, concurrent creation, owner isolation, invalid names, API failure, and retry.
- Backfill from existing logged sets without duplicate owner/name records.
- Exercise list loaded empty (`0`), loaded complete (`N`), partial/error states, keyboard/mobile interaction, and accessible count.
- Goal create, edit, clear, reload, invalid/missing pair, exact achievement, heavier/lower-rep non-achievement, and retry.
- Heaviest-load and estimated-strength PRs, ties, set edit/delete, reload, and clear labelling of estimates.
- Exercise history refresh after plan save, live add, set logging, editing, and deletion.

## Ordered implementation plan

1. [x] Inspect the current algorithm, tests, live-workout UI, saved set schema, and available history/RPE fields.
2. [x] Record the initial adaptive policy, evidence display, safety bounds, scenario matrix, and pseudocode.
3. [x] Research progression, autoregulation, detraining, and deload evidence; revise unsupported thresholds and cite the final basis.
4. [x] Receive Scott's exact **“go”** or **“I approve.”**
5. [x] Replace the pure recommendation calculation with the approved multi-session analysis while preserving manual override behavior.
6. [x] Add the owner-scoped exercise-library migration source and API, including historical-set backfill; do not apply the migration.
7. [x] Add the Exercises tab, accurate count, exercise detail, derived PRs, exact goal achievement, and goal editing.
8. [x] Connect plan save, live exercise add, and set logging to idempotent library creation.
9. [x] Add the recommendation history/evidence UI without crowding the primary logging action.
10. [x] Resolve `BUG-065` inside the approved structured starting-weight path.
11. [~] Add exhaustive pure, integration, persistence, concurrency, error/recovery, accessibility, desktop, and mobile coverage. Pure behavior, full suite, lint, and build pass. The unapplied migration prevents real backfill/RLS/persistence and rendered Exercises desktop/mobile verification; those remain explicitly untested.
12. [x] Complete the post-task records and present the uncommitted result before any commit or release decision.

## Approval boundary

Scott approved the original research-backed progression contract and resolved its load-step gap with exact **“go”** on 2026-10-03. During implementation he expanded the feature to include a durable Exercises list, derived personal records, and saved performance goals. Scott approved the complete revised contract, pseudocode, data boundary, and expanded scenario matrix with exact **“go”** on 2026-10-03. Local implementation units 5–12 are authorized. Production-data use, migration application, dependency change, live AI call, commit, push, and deployment remain closed until their required approvals.

## Work log

- 2026-10-03: Reviewed the current 2026 ACSM position stand, the prior ACSM load-progression recommendation, systematic evidence on autoregulation and RPE, a specific RIR-accuracy study, deload expert consensus, and a randomized deload trial. The evidence supports progressive, individualized training but does not show that a complicated algorithm or fixed automatic deload schedule is superior. Revised the proposal: two-session confirmation is explicitly conservative product policy; upward jumps must use the smallest configured step within 2–10%; RPE is a supporting brake only; date-only reductions and automatic percentage deloads are removed; the history and reasoning remain visible. No application file or live data changed.
- 2026-10-03: Scott approved the complete research-backed contract, scenario matrix, and pseudocode with exact **“go.”** Local implementation units 5–9 are authorized. Live/provider calls, production-data operations, migrations, dependency changes, commit, push, and deployment remain closed. Next: implement the pure multi-session analysis while preserving all unrelated working-tree changes.
- 2026-10-03: Pre-edit implementation review exposed the load-step `SPEC-GAP`: one 5 lb barbell step becomes less than 2% above 250 lb, so the approved one-step and 2–10% requirements cannot both hold indefinitely. No application file changed. Recommended allowing the single smallest configured step whenever it is at most 10%, even below 2%, because that is the slowest feasible progression. Next: await Scott's exact choice.
- 2026-10-03: Scott resolved the load-step `SPEC-GAP` with exact **“go”** for the recommended option: allow one smallest configured step whenever it is no more than 10%, including sub-2% increases, and show the actual percentage. Next: implement the pure algorithm and exhaustive regressions.
- 2026-10-03: Began the approved pure recommendation utility draft. Before it was tested, Scott expanded the feature: exercises actually added through plans, live workouts, or logged sets must become durable library records; the software must expose an Exercises list with logged history and calculated PRs; and each exercise may hold a weight-times-reps goal such as Bench Press 225 lb × 1. Form knowledge is deferred. Revised the contract, pseudocode, data boundary, and scenario matrix and paused further application edits pending a fresh exact approval.
- 2026-10-03: Scott approved the complete expanded contract, pseudocode, data boundary, and scenario matrix with exact **“go.”** Local implementation of the exercise library, derived PRs, performance goals, adaptive progression, history UI, `BUG-065` repair, tests, and records is authorized. Migration application, production data, dependencies, provider calls, commit, push, and deployment remain closed.
- 2026-10-03: Added the unapplied owner-scoped exercise-library migration source. Database triggers create records transactionally from saved plans, workout snapshots, and set logs; the migration backfills existing names and deduplicates owner/name variants. Added exercise loading and validated paired goal writes plus pure derived-PR/goal-progress calculations. No migration or data change occurred. UI and validation remain.
- 2026-10-03: Added the Exercises Health tab and accurate count, exercise detail with all logged sets, derived heaviest and estimated-strength PRs, exact goal achievement, labelled estimated progress, and paired goal editing/clearing. Live exercise cards now expose the six-session progression evidence and confidence. Finished-only history prevents an open workout from changing its own recommendation. Repaired `BUG-065` by adding structured `startWeightLb` to the forced AI tool contract while forbidding invented weights; a deterministic client check now drops any model weight not explicitly present in Scott's prompt. Focused 30-case behavior coverage, all 320 registered tests, zero-warning lint, and the 3,154-module production build pass; rendered and migration-source validation remain.
- 2026-10-03: Final local UI inspection reached the expected fail-closed schema boundary: because `exercise_library` is intentionally unapplied, Health shows a visible retryable database error rather than an invented empty list. Desktop/mobile exercise rendering, real trigger/backfill/RLS behavior, and goal persistence therefore remain untested pending separate migration approval. Reconciled DR-027, changelog, current-system, active work, bug/work ledgers, and the SAI archive. No migration, production write, live provider call, commit, push, or deployment occurred.
- 2026-10-03: Scott approved applying only the presented exercise-library migration with exact **“go.”** This authorizes creation of the owner-scoped table/policies/functions/triggers and backfill of distinct existing exercise names in the linked database. It does not authorize the journal migration, unrelated schema work, application data edits/deletes, commit, push, deployment, or live AI calls. Next: verify the linked target and pending migration list before applying.
- 2026-10-03: Verified that the configured Health client targets Supabase project `mogoybejtmkoheqvfvuc`. The official CLI is available temporarily but has no saved Supabase access token, and the isolated dashboard requires Scott's sign-in, so the remote migration history could not be inspected and no SQL ran. Paused at authentication rather than using an apply-all path or requesting credentials. Next: Scott signs in, then apply only the approved exercise migration and verify it without synthetic production writes.

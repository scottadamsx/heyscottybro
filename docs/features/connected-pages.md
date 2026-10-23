# Feature: Connected Pages

**Status:** Draft for Scott's approval. Docs and plan only on 2026-10-21. No application code changed, no migration run, and no production data written.
**Owner:** Scott
**Started:** 2026-10-21
**Build Process position:** This document is the **executive plan** (step 2 of Scott's Build Process, `~/workspace/workflows/scott-build-process.md`). The idea arrived as Scott's 2026-10-21 direction in chat. The next step is not code: it is the interactive HTML blueprint (step 3), which Scott must see, understand, and approve before any build. See the closing section, "Next gate: interactive blueprint."

## User problem

heyScottyBro has useful pages, but too many of them behave as separate notebooks:

- Planner events know dates, times, projects, and event types, but not which real Orbit person they are with.
- Orbit knows people, birthdays, facts, open items, and relationship history, but the Planner does not read those values.
- Finance knows income, bills, category budgets, and actual transactions, but it does not know what the week's planned meals will cost.
- Recipes and Food Log data exist, but there is no working Meal Plan surface that turns recipes into a week, costs that week from real grocery prices, and agrees with Finance and the Food Log.
- Planning something in one page does not reliably create the supporting work in another page. Scott has to remember the cook task, the prep task, the shopping task, and the follow-up himself.
- A missing plan can stay invisible. If no meal is planned for part of the week, nothing raises one clear reminder and keeps track of that exact gap until it closes.

Scott's direction on 2026-10-21 was that the pages should use real values, work together as one efficient system, spawn the few supporting things needed to stay on track, and watch for gaps.

## Desired outcome

A value is entered once, in the page that owns it, and every other page reads that real value or a clearly identified calculation made from it.

The first connected system should let Scott:

1. Link real Orbit people to Planner events, see those people and their birthdays in the Planner, open a person's calendar history from Orbit, and open a current pre-hangout brief from an event.
2. Set a grocery budget for a week in Finance, build that week in Meal Plan, cost it from imported St. John's grocery prices, see the planned grocery figure in Finance, and log the cooked meal into the same Food Log used by Health.
3. Save a planned meal and automatically receive its dependent work: a cook task before eating time, an earlier prep task when the meal needs one, and one shopping task for the week.
4. Receive exactly one living reminder for an open planning gap, starting with "Meals not yet planned for the week." The reminder updates as the gap changes, clears itself when the gap closes, respects a day intentionally left empty, and does not duplicate itself.

## Governing rules

### One source of truth

- Orbit owns a person's identity and profile: name, group, relationship, birthday, facts, notes, and open items.
- The host Planner owns calendar commitments in `events`: date, time, recurrence, project, event type, and title.
- Orbit owns relationship history in `orbit_events`: who actually spent time together, the kind of interaction, its status, and per-person updates.
- Finance owns money settings and actual money records: grocery week budgets, bills, income, category budgets, and `transactions`.
- Recipes own dish identity, servings, steps, nutrition, and structured ingredient lines.
- Meal Plan owns the decision to place a meal on a date and slot, its eating time, servings, skip state, and cooked state.
- The imported price snapshot owns product prices as of its capture time. Meal Plan and Finance calculate from it; neither page retypes a price.
- Food Log owns what was actually eaten. A meal becomes cooked history only when a `food_logs` row exists and is linked back to the plan item.
- Tasks and Reminders are one system. The database table is `reminders`; generated work is a reminder row with source provenance, not a second task store.

Pages may show a derived value, a frozen calculation snapshot, or a link to the owner. They may not keep a separately editable copy of the owner's value.

### Cascades

A **cascade** is the app's standard follow-through pattern:

> When a source record is created or changed, calculate the dependent records that should exist, create the missing ones, update the still-open generated ones, and retire the open generated ones that no longer belong. Never rewrite or resurrect a completed generated record.

In the app's existing language, these are **generated tasks with a source reference**. The existing precedent is `src/lib/events.js`: an event type creates dated tasks, each task carries `event_id`, and deleting the event deletes its generated tasks. Connected Pages generalizes that precedent beyond event types.

Every generated task has:

- the source type and source ID;
- a deterministic generation key, such as `meal:{itemId}:cook`;
- the generator name and rule version;
- a source link that opens the owning record;
- a visible generated/source label in Tasks;
- an idempotent reconciliation path that can run again after a retry, reload, or duplicate save without creating a duplicate.

### Gap watchers

A **gap watcher** is the companion pattern:

> Watch a bounded scope for a completeness rule. If the rule fails, raise exactly one living reminder for that scope and gap. Keep updating that reminder as the gap changes. Close it when the rule passes. Do not raise the same gap twice.

A watcher is not a daily nag and it is not a new reminder every time the app loads. It has durable state, a gap fingerprint, and a suppression rule for a reminder Scott dismisses while the same gap remains.

### Human control and identity

- A person link stores an Orbit person ID, never only a typed name.
- A rename in Orbit changes the displayed name everywhere because the ID does not change.
- Natural language may propose a person only when one existing person matches exactly and unambiguously. A genuinely ambiguous name stays unlinked until Scott picks the person in the picker. The feature never creates a person from an event title or description.
- Deterministic cascades run from saved data and explicit rules. They do not use a model to guess attendees, prices, ingredients, or completion.
- New or changed behavior in this document still needs Scott's exact approval under the repository workflow before implementation.

## Current behavior and evidence

### People, Orbit, and Planner today

- `src/pages/admin/PeoplePage.jsx` embeds canonical Orbit in a shadow root at `/admin/people/*`. It configures Orbit to use `/api/orbit`.
- `api/orbit.js` is a thin host for Orbit's own server code. The Vercel function count is already at the documented ceiling, so this feature should fold any host-event read into an existing handler or Library path rather than add a new function.
- `supabase/migrations/2026-09-17-orbit.sql` stores each person and relationship event as a JSON document in `orbit_people` and `orbit_events`. Person IDs are text. A person document contains `name`, `group`, `how`, `birthday`, `notes`, `facts`, and `intents`. An Orbit event document contains a date, title, kind, status, and a `people` array of person IDs.
- `src/api/peopleApi.js` is read-only. `loadPeople()` flattens person documents, including birthday. `loadPeopleEvents()` resolves event people IDs to current names. `src/api/aiLibrary.js` registers both as read-only Library collections and correctly refuses direct people writes outside Orbit.
- `src/api/plannerApi.js` owns host `events`, `reminders`, `transactions`, budget configuration, bills, and income. `loadEvents()`, `newEvent()`, and `updateEvent()` use the host `events` table.
- `src/components/EventForm.jsx` is the shared event form. Its values are title, dates, times, description, project, and event type. It has no people field.
- The live event schema summarized in `docs/rebuild/live-schema.md` has no attendee or person column. The later journal-orbit migration adds only `orbit_log_status` and `orbit_event_id` to host events.
- There is already a narrow post-event bridge: a newly created host event starts with `orbit_log_status = "pending"`; Calendar can open Orbit's logging flow with the host event ID, title, and date; Orbit can save a relationship event with `sourceHostEventId`; the host then marks its event as logged and stores `orbit_event_id`. This proves the pages can cooperate, but it does not link planned attendees, show the person in the Planner, or power a pre-event brief.
- Orbit already derives birthdays inside its own UI. `orbit/src/lib/derive/birthdays.js` supplies `nextBirthday()`, and Orbit's sidebar uses it. The host Planner does not load people or birthdays, so a birthday appears in the Planner only if Scott separately creates a calendar event.
- Orbit person deletion already has a defined internal behavior in `orbit/server/repo.js`: remove the person from Orbit events, delete Orbit events left with nobody, remove that person's per-event updates, and unlink fact references while keeping fact text. Host Planner links need an equally explicit rule instead of inheriting that behavior by accident.
- Orbit is a synchronized read-only copy in this repository. Per `CLAUDE.md` and DR-017, profile UI changes belong in the canonical Orbit repository and are then synchronized. This feature must not edit `orbit/` directly in heyScottyBro.

### Finance, recipes, grocery data, and Food Log today

- Finance is `src/pages/admin/BudgetPage.jsx`, backed mainly by `src/api/plannerApi.js`.
- `transactions` is the actual-money ledger. Amounts are stored as signed dollars at the current boundary. Transaction types are `expense`, `income`, `future`, and `savings`. New Connected Pages money fields should use integer cents internally and convert only where they meet the legacy transaction and budget code.
- `budget_config` holds settings and category budgets. `recurring_bills` and `income_sources` are separate tables whose row payload is JSON in a `data` column.
- `src/components/budget/budgetSummary.js` is the shared headline calculation for the Budget page and home dashboard. A planned grocery figure belongs in that shared path, not as a separate inline calculation in one component.
- Category naming is not fully consistent today: `plannerApi.js` defaults include `Food`, while the Budget page defaults and `postReceiptToBudget()` use `Groceries`. Connected Pages must use the category stored on the Finance grocery week record and must not silently treat the two names as interchangeable.
- `src/api/groceryApi.js` owns grocery stores, receipt headers, and receipt line items. A receipt item has raw text, quantity, unit price, and total price. The live schema also has unused `product_id` and `resolved_grams` fields on receipt items. Saving a receipt does not automatically post it; `postReceiptToBudget()` creates an actual Groceries expense when that action is used.
- Calendar already treats receipt-posted transactions as actual day spend and excludes `future` transactions from spent totals. A Meal Plan estimate must not be inserted as a transaction merely to make it visible, or it will distort actual spend and may be counted twice.
- The live `recipes` table exists. Its meaningful fields include title, servings, prep minutes, cook minutes, steps, per-serving macros, tags, source, and `ingredients` JSON. The documented ingredient shape is only `[{ item, quantity }]`, and quantity is not structured enough for dependable costing.
- `food_logs` already has a nullable `recipe_id`, but `src/api/healthApi.js` does not expose recipe loading or a recipe-to-food-log flow. Its food fields are date, meal type, name, description, calories, macros, quantity, source, and items.
- There is no live Meal Plan table or page. `docs/rebuild/current-system.md` explicitly places `meal_plans` and `meal_plan_items` among designs that are in SQL but not in the live database. The `recipes` route alias currently sends Scott to Health's Food tab, which is a log, not a recipe or meal-planning surface.
- `food_item_cache` is a nutrition cache. It is not a price source and should not acquire prices.
- The external `local_grocery_prices` dataset is being built outside the app. At the time of this inspection, `~/workspace/local_grocery_prices/` existed but contained no importable files yet. This design therefore defines the import contract and required fields rather than assuming a final filename.

### Tasks and generated work today

- Tasks are `reminders` rows. A reminder can already point to a project, course, or host event. `event_id` is the key existing source reference.
- `createEventWithAutoTasks()` in `src/lib/events.js` creates an event, builds task rows from its event type's `auto_tasks`, offsets their dates, and inserts them in one batch.
- `deleteEvent()` in `src/api/plannerApi.js` deletes reminders with that `event_id` before deleting the event.
- Recurring reminders have occurrence semantics in `src/utils/plannerUtils.js`: completion is per occurrence, and a series closes only when no occurrence remains. Cascade reconciliation must respect that model instead of treating every generated row as a simple one-off.
- There is no generic generated-task provenance, generation key, watcher state, or completeness watcher today.

## Scope

### Included

- A shared generated-task provenance and reconciliation mechanism for Tasks.
- A shared gap-watcher state mechanism and the first meals watcher.
- Orbit-to-Planner person links on host events, person names derived live from Orbit IDs, derived birthday occurrences in the Planner, and a pre-hangout brief path.
- A person profile view of linked host calendar events alongside Orbit relationship history, implemented through the canonical Orbit path rather than by editing the synchronized copy here.
- A versioned grocery price import with store, capture date, product identity, package size, package price, and source unit rate.
- Structured recipe ingredient lines and confirmed ingredient-to-product matches.
- A Meal Plan surface, proposed as a Plan tab inside Health at `/admin/health?tab=plan`, because Health already owns recipes and Food Log.
- Finance-owned grocery week budgets and a shared planned-grocery calculation shown by Finance.
- Meal Plan cascades for cook tasks, advance-prep tasks, and one weekly shopping task and list.
- A cooked action that creates and links a Food Log row only after the existing food save succeeds.
- Library registration for the new collections so Frodo reads the same values as the pages, subject to the existing write boundaries.

### Not included

- Merging host `events` and `orbit_events` into one table. They answer different questions: what is scheduled, and what relationship history happened.
- Automatic attendance. A linked planned attendee is not proof that the person attended.
- Creating people from names in titles, descriptions, journals, or natural-language drafts.
- A new Vercel function, a new task store, or a separate watcher reminder store.
- Push notifications or a promise that a watcher runs while the app is closed. Version 1 evaluates on relevant page loads and writes; a background scheduler is a later decision.
- Automatic grocery ordering, payment, or creation of an actual Finance expense from a plan.
- Pantry inventory. Version 1 can mark a shopping item "already have it"; it does not track stock levels or expiry.
- Editing the synchronized `orbit/` copy in this repository.
- Applying the drafted migration, importing production prices, or changing production records during this docs phase.

## Experience contract

- **View first:** Planner events, person summaries, Finance figures, recipes, meal plans, shopping lists, and watcher states open as readable summaries. Forms appear only after an explicit Add, Edit, Plan, Import, or Log action.
- **Forms:** Use the existing `FormModal` pattern. A failed save keeps the entered work and shows the real error.
- **Desktop:** Planner rows show person chips without pushing event times out of view. Meal Plan shows the whole Monday-to-Sunday week, budget state, cost coverage, and shopping summary together. Finance shows target, planned grocery spend, actual grocery spend, and the difference as separate values.
- **Mobile:** The week becomes day sections in date order. Person chips wrap. Cook, prep, shopping, brief, and watcher actions remain reachable without horizontal scrolling. Touch targets meet the app's existing minimums.
- **Dates:** Stored dates remain ISO dates. Displayed dates use the repository rule: full weekday, abbreviated month, ordinal day, and no year in ordinary labels.
- **Counts:** Every settled list card follows the repository count rule: `N` when all loaded rows are shown, `N of M` when filtered or limited, and `0` for a loaded empty list. No count is invented during loading or error.
- **Generated tasks:** Show a short source label such as "From Dinner" or "From Week plan" and an action that opens the source. Colour is never the only signal.
- **Watcher reminders:** Show why the reminder exists and the current gap, not just a generic warning. For meals, the title is exactly "Meals not yet planned for the week" and the description lists the unplanned days.
- **Loading and errors:** A failed connected read says which source failed and keeps the page's own data visible where it is safe to do so. It never replaces a failed load with defaults.
- **Keyboard and screen reader:** Person pickers, brief actions, plan actions, shopping checkboxes, and watcher actions are real controls with labels and visible focus. Status changes are announced through the existing toast or status patterns.

## Design 1: Orbit and Planner

### 1.1 Link real people to a host event

Add a host-owned link table, `event_people`. The host event remains in `events`; the person remains in Orbit.

- `event_people.event_id` identifies the calendar commitment.
- `event_people.person_id` is the Orbit text ID.
- `event_people.role` starts with `attendee`; later roles can be added without changing the identity model.
- A composite foreign key to `orbit_people(user_id, id)` keeps the link owner-scoped and removes the link if Orbit removes the person.
- The link is at the host-event row level. For a recurring host event, version 1 therefore means "this person is linked to the series." Per-occurrence exceptions are an open question, not a hidden behavior.

`EventForm` gains a People field only in edit mode:

1. Load read-only person options through the People API path.
2. Show selected people as removable chips.
3. Save the event through the existing Planner API.
4. Replace that event's links in one owner-scoped operation.
5. Invalidate the `events` and connected-people reads so Planner, Calendar, Today, and Tasks see the same result.

The natural-language event draft may fill the ordinary event fields as it does today. If its description names people, the resolver may preselect only an exact, unique Orbit match and must show the selected person in the form for review. It must not save a link by itself and must not create a person.

### 1.2 Planner reads live Orbit values

Planner and Calendar load three distinct row families and merge them only at render time:

1. host events from `events`;
2. person links from `event_people`, resolved to current Orbit names and profile routes;
3. derived birthday occurrences from Orbit birthdays for the visible date range.

A rename in Orbit therefore appears in the Planner without editing the event. A person with no year on their birthday shows no age. A full birth date can show the age they turn, derived at render time.

Birthday rows are not host events and are not copied into `events`. Clicking one opens `/admin/people/person/<person_id>`. The occurrence calculation must follow Orbit's existing rule, including February 29 birthdays being observed on February 28 in non-leap years. Implementation should reuse the canonical derivation through the Orbit adapter where the boundary allows it; a host utility is acceptable only with tests that match Orbit's behavior.

### 1.3 A person's past and next events

Orbit remains the profile owner, but its profile needs a host-event read adapter:

- **Orbit history:** existing `orbit_events` where the person ID is in `people`, separated into past and planned or done history by Orbit's own status and date.
- **Calendar:** host events linked in `event_people`, expanded for recurrence, with past occurrences and the next future occurrence clearly labelled "Calendar."
- **Next event:** the earliest future occurrence across the two sources, with its source shown.
- **Past events:** reverse chronological, with Calendar and Orbit rows visually distinct.

The host should expose linked calendar events through the existing Orbit API handler or the Library, not a new Vercel function. Canonical Orbit then consumes that read model and is synchronized back into this repository through the established process.

If the host-event adapter is unavailable, the profile shows Orbit history and a clear "Calendar events unavailable" state. It must not present an incomplete list as complete.

### 1.4 Pre-hangout brief

The brief is a generated read model, not a stored profile copy.

For one host event occurrence and one linked person, assemble:

- current name, group, relationship (`how`), and profile notes from Orbit;
- durable facts and open intents from Orbit;
- the person's last Orbit interaction and last linked calendar occurrence;
- the next linked calendar occurrence, which is the event being prepared for;
- unresolved items and the existing Orbit "Ask them" questions derived from saved context;
- the upcoming birthday, if it falls in the brief window.

The event detail offers **Read brief** when a person is linked. Opening the assembled brief records brief state for that event, person, and occurrence: profile update time seen, generated time, and read time. It does not copy the brief text into a new profile field.

An AI-written picture or question set remains an explicit Orbit action, as it is today. Connected Pages does not call a model merely because an event exists.

#### Brief cascade and watcher behavior

Linking a person to a future event creates the eligibility for a brief reminder. The reminder is generated only inside the brief lead window proposed in the open questions.

- Generation key: `event:{eventId}:person:{personId}:brief:{occurrenceDate}`.
- If the brief is unread, one open task says "Read your brief for <current person name>."
- If Orbit's profile `updated_at` advances after the brief was read, the watcher marks the brief stale and updates the same open reminder, or creates a new episode if the earlier reminder was completed.
- Marking the brief read closes the reminder.
- Moving the event regenerates the occurrence key and retires the open reminder for the old occurrence.
- Cancelling or deleting the event retires the open reminder.
- A completed brief reminder is never resurrected for the same unchanged occurrence.

### 1.5 Person deletion, merge, and rename

- **Rename:** no host action is needed. The ID stays the same and every surface reads the new name.
- **Delete:** Orbit's confirmation remains the place where impact is explained. The host link is removed by the composite foreign key cascade. The host calendar event itself remains, because a calendar commitment can still matter after a person record is removed. Open generated brief tasks for that link are retired by reconciliation. Derived birthday rows disappear because the birthday source is gone. This differs deliberately from Orbit's internal rule for solo relationship events.
- **Merge:** Orbit's merge already rewrites Orbit event references from the dropped ID to the kept ID. The canonical merge operation must also expose or perform the equivalent host-link rewrite before the dropped person row disappears. If that coordination is unavailable, implementation must block the Connected Pages release rather than leave dangling host links. A reconciliation report should list any link whose person cannot be resolved and hide it from ordinary display until repaired.

## Design 2: Finance, grocery prices, recipes, and Meal Plan

### 2.1 Import grocery prices as a dated snapshot

Do not make Meal Plan read a loose file from `~/workspace/` at runtime, and do not hand-copy store prices into recipes.

Version 1 uses an explicit **Import price snapshot** action in Finance:

1. Scott selects the dataset file produced by `local_grocery_prices` (CSV or JSON) in a modal.
2. The importer validates the header or object shape, capture date, store identity, product identity, package size, package price, and currency before writing.
3. It writes one `grocery_price_imports` batch and its `grocery_price_items` rows in bounded batches.
4. It records a checksum, source label, row count, rejected row count, and rejection reasons.
5. A failed import does not replace the previous usable snapshot.
6. A newer import supersedes older items for current calculations, but older imports remain available to old cost snapshots.

Required product fields are:

- stable store key and store name;
- stable product key, product name, and product URL or source reference when available;
- brand and category when supplied;
- package label exactly as sourced;
- unit kind: mass, volume, or count;
- package quantity in a base unit (grams, millilitres, or each), stored without floating point quantity error;
- package price in integer cents;
- source price per 100 g, 100 ml, or unit, retained for audit and cross-checking;
- capture date and availability state.

The importer derives the working unit rate from package price and package quantity. If the derived rate and source rate disagree beyond the tolerance set during implementation testing, the row is imported with a warning and is not silently treated as verified.

A scheduled or hosted sync can replace the file action later. It is not required to prove the connection and should not add a Vercel function in version 1.

### 2.2 Make recipe ingredients costable

The `recipes` table remains the recipe owner. Its `ingredients` JSON becomes a versioned structured contract rather than a new recipe-ingredient table.

Version 2 ingredient line:

```text
{
  name: display name,
  normalized_name: matching key,
  quantity_milliunits: integer amount in thousandths of the base unit,
  unit_kind: mass | volume | count,
  display_quantity: original human-readable quantity,
  preparation: optional text,
  optional: boolean,
  costable: boolean,
  parse_status: ready | needs_review
}
```

Rules:

- Mass uses grams as the base unit. Volume uses millilitres. Count uses each.
- Common package and recipe units may be converted only when the conversion is unit math, such as kilograms to grams or litres to millilitres.
- A volume-to-mass conversion needs a known ingredient density. Without one, the line is `needs_review`, not guessed.
- A migration or import pass may propose structured lines from legacy `{ item, quantity }`, but an ambiguous quantity stays uncosted and visible for review.
- After cutover, the recipe editor writes version 2 lines. Legacy JSON is an import source, not a second editable source.
- A recipe also gains a structured preparation profile: whether it needs no advance prep, night-before prep, morning prep, or a lead time in minutes, plus a short prep note. Tags or steps alone are not reliable enough to decide a prep cascade.
- A recipe that is used by a meal plan is archived rather than hard-deleted. Its title and ingredients remain resolvable for history and cost snapshots.

An ingredient-to-product choice is stored once in `ingredient_product_matches`, keyed by owner, normalized ingredient, and store. A match points to the stable store and product keys, not to one import row, so a newer price import does not erase Scott's confirmed choice.

Matching order:

1. confirmed match for the selected store;
2. exact normalized product or alias match, shown as a suggestion;
3. no match.

A suggested match may be used in a clearly labelled provisional calculation only if Scott accepts that setting. A confirmed match is preferred and is reused everywhere.

### 2.3 Finance owns the week's grocery budget

Finance gains one grocery budget record per Monday-to-Sunday week:

- week start;
- amount in integer cents;
- Finance category, defaulting to the existing `Groceries` category used by receipt posting;
- created and updated times.

Meal Plan reads this record live. It does not store its own editable budget amount.

The current worked example is a hard $75 week, stored as 7,500 cents. It is data, not a hard-coded application limit.

If there is no grocery budget week record, Meal Plan shows "Grocery budget not set" and the grocery-budget watcher can raise a gap reminder. It does not silently prorate the monthly Groceries category budget into a weekly figure.

### 2.4 Meal Plan owns the week

Meal Plan has one plan per owner and Monday-to-Sunday week. A plan item has:

- date and meal slot;
- a recipe, or a custom title with structured ingredient lines;
- servings;
- eating time;
- status: planned, intentional skip, cooked, or cancelled;
- an optional override of the recipe's advance-prep profile;
- a link to the Food Log row after it is cooked.

The proposed default required slot is dinner, subject to Scott's decision in the open questions. Breakfast, lunch, dinner, and snack slots can exist in the data model from the start so the watcher does not need a redesign if Scott chooses more than dinner.

An intentional skip is a real plan state for a date and slot. It can carry a short reason such as eating out. It is not the same as an empty cell.

### 2.5 Two costs, named honestly

Meal costing needs two different numbers. They must never be blended.

#### Meal cost

The cost of the food used by one meal:

```text
for each required ingredient line:
  used cost = recipe quantity for the planned servings
              multiplied by the matched product unit rate
meal cost = sum of priced used costs
```

This is useful for comparing meals. It is not the amount Scott must spend at the store if he has to buy whole packages.

#### Planned grocery spend

The cash estimate for the week:

1. Aggregate the required quantity for each ingredient across all planned meals in the week.
2. Subtract only quantities on shopping items Scott marks "already have it."
3. For each matched product, round the remaining quantity up to whole packages.
4. Multiply packages needed by the package price.
5. Sum the purchase lines.

This planned grocery spend is the figure compared with Finance's $75 week budget.

Every calculation reports coverage:

- required ingredient lines;
- priced lines;
- unpriced lines and their names;
- whether the total is complete or partial;
- store and price capture date;
- whether a provisional match was used.

A partial total is displayed as a partial estimate. It is never labelled "will cost" or treated as proof that the week fits the budget.

### 2.6 Cost snapshots keep Finance and Meal Plan in agreement

Prices change. A live preview may change when a new snapshot is imported or a recipe is edited, but Finance and Meal Plan must not show two different "planned" totals for the same finalized week.

When Scott chooses **Mark week ready**:

1. Resolve the plan using one selected store and one current price import.
2. Calculate the shopping list, meal costs, purchase total, and coverage.
3. Store an immutable `meal_plan_cost_snapshots` row with the import ID, store, totals, coverage, line details, and creation time.
4. Meal Plan and Finance both read that snapshot as the week's planned figure.
5. If the recipe, plan, match, store, or price import changes afterward, Meal Plan shows "Plan changed since cost snapshot" and offers **Recost week**. Recosting creates a new snapshot and supersedes the old one; it does not edit history.
6. Reconciliation updates the shopping task and open meal tasks after a successful recost.

Before a week is marked ready, both pages may show the same live preview by calling the same pure cost function with the same inputs. Neither page derives its own version.

### 2.7 Finance shows planned and actual separately

Finance adds a grocery week section to the shared budget snapshot:

- Finance grocery budget for the week;
- planned grocery spend from the latest Meal Plan cost snapshot;
- actual grocery spend from `transactions` in that week and Finance category;
- difference between budget and planned;
- difference between planned and actual after shopping;
- price capture date and cost coverage;
- an action that opens the week in Meal Plan.

The planned amount is not a `transactions` row and is not included in actual spent. The Budget page's pay-period view lists each grocery week that starts in the period and uses those week snapshots for its planned total. It does not prorate a week across two pay periods. The current-week dashboard card uses the current Monday-to-Sunday week.

When a grocery receipt is saved and Scott uses the existing post-to-budget action, the resulting transaction is actual spend and appears automatically in the Finance actual figure. Version 1 may let Scott link that receipt to the week's shopping list for comparison, but it does not guess the link.

### 2.8 Cooked means Food Log agrees

A planned meal is not marked cooked merely because its date passed.

1. Scott chooses **Log as eaten** on the plan item.
2. The existing Food Modal opens in a modal, prefilled from the recipe title, meal slot, date, servings context, and per-serving macros.
3. Scott reviews and saves through the existing Health food path.
4. `healthApi` writes the `food_logs` row with `recipe_id` and the plan item ID.
5. Only after that save succeeds does Meal Plan mark the item cooked and store the returned Food Log ID.
6. If the food save fails, the plan stays planned and the modal keeps the entered values.
7. If the linked Food Log row is later deleted, reconciliation changes the plan item back to planned and raises no duplicate cook task if the meal time is already past; the item shows "Food log removed" until Scott logs it again or cancels it.

## Design 3: Cascade pattern in detail

### 3.1 Generated-task provenance

Extend `reminders` rather than create another task table:

- `source_type`: for example `event`, `meal_plan_item`, `meal_plan_week`, `event_person`, `recurring_bill`, or `watcher`;
- `source_id`: the owning record ID as text, because host IDs are UUIDs and Orbit IDs are text;
- `source_key`: the deterministic role within the source, such as `cook`, `prep`, `shopping`, or `brief:2026-10-30`;
- `generator`: the rule name, such as `meal-plan-cascade` or `gap-watcher:meals`;
- `generated_hash`: a hash of the managed title, date, time, description, and source link inputs;
- `managed_state`: `generated` or `detached`.

Keep `event_id` for existing event-type tasks and set it alongside the generic provenance for those tasks.

A partial unique index on owner, source type, source ID, and source key for open generated tasks prevents duplicates. Completed rows do not block a genuinely new later episode with a new source key.

### 3.2 Reconciliation contract

A cascade function receives a source record and returns the desired generated tasks. Reconciliation then:

1. Loads open tasks with that source type and source ID.
2. Matches them by generation key.
3. Creates missing tasks in one batch where possible.
4. Updates an open generated task when its managed fields changed and its stored hash still matches the last generated value.
5. Deletes an open generated task that is no longer desired.
6. Leaves completed tasks unchanged.
7. Leaves a task that Scott detached unchanged, and reports the source as having a detached dependent.
8. Emits the existing `reminders` data change after success so Tasks, Planner, Calendar, and Today refresh from the same rows.

If Scott edits a generated task's title, date, or time directly, the task becomes `detached` on save. This avoids a later source save silently overwriting Scott's manual schedule. The source page can show that a dependent was detached and offer a deliberate **Reattach generated task** action. This behavior needs Scott's confirmation in the open questions because the older event-type tasks do not yet have a detach concept.

Retries are safe because generation keys are deterministic and creation is protected by the unique open-task index. A partial failure must report which source saved and which cascade failed; it must not claim the whole action succeeded. The source page offers **Retry follow-through** when reconciliation is pending.

### 3.3 Grocery planner cascade, end to end

#### Step 1: Finance sets the constraint

Scott sets the week's grocery budget in Finance. Meal Plan reads it live and shows how much room remains as meals are added.

#### Step 2: Scott plans a meal

Scott places a recipe or custom meal on a date and slot and sets servings and eating time. Saving the plan item immediately reconciles that meal's cascades. There is no separate hidden publish step for task creation.

#### Step 3: Cook task

One cook task is generated for the plan item:

- title: "Cook <meal name>";
- date: the meal date;
- start time: eating time minus recipe prep minutes and cook minutes;
- fallback: eating time minus 45 minutes when the recipe has no usable prep and cook time;
- description: servings, eating time, and a link back to the plan item;
- generation key: `meal:{itemId}:cook`.

If the calculated start falls on the previous calendar day, the task uses that real date and time. It is not silently moved to midnight or to the meal date.

#### Step 4: Advance-prep task

A prep task is generated only when the recipe profile or plan-item override says advance prep is needed:

- night-before prep: previous day at 20:00 by default;
- morning prep: meal date at 08:00 by default;
- lead-time prep: eating time minus the stated prep lead;
- slow-cooker prep: the profile's lead time, rather than the ordinary cook start, when the profile identifies it.

The title is "Prep <meal name>" and the description carries the prep note. If the calculated prep task would be at exactly the same time and do exactly the same work as the cook task, the reconciler combines the prep note into the cook task instead of creating a duplicate.

#### Step 5: One shopping task and list for the week

Meal Plan maintains one shopping list per week plan:

- Ingredients are aggregated across planned meals.
- Quantities, package counts, product matches, and purchase costs come from the cost calculation.
- An item can be marked needed, already have it, or purchased. Those states belong to the shopping list, not the task.
- Regenerating the list preserves the state for the same ingredient and product key when it is still needed.
- If an ingredient disappears, it leaves the active list. A purchased item is not silently returned to needed if a later plan change still requires it; its required quantity updates and the list shows whether more is needed.

One shopping task is generated for the week:

- title: "Shop for the week's meals";
- due date: the day before the first planned meal, at 17:00 by default;
- if the week is planned late and that time has passed, the task is due at the earliest practical time in the plan flow: today, or two hours before the first meal if the first meal is today and that is later than now;
- description: item count, priced item count, planned grocery spend, budget state, and an action to open the shopping list;
- generation key: `meal-week:{planId}:shopping`.

The full shopping list is not copied into the task description. The task links to the list that owns the details.

#### Step 6: Changes cascade

- Dinner moves from 18:00 to 19:00: the open cook task moves by the same calculated offset. A lead-time prep task moves too. A night-before or morning prep task stays on its rule unless its rule depends on eating time.
- Dinner moves to another day: cook and applicable prep tasks move. The shopping task moves only if the first planned meal of the week changed.
- A meal is replaced: open tasks are updated to the new meal and recalculated from its times. The shopping list and cost preview update.
- A meal is marked intentional skip or cancelled: its open cook and prep tasks are removed. The shopping list recalculates. If it was the only meal, the shopping task is removed.
- A meal is deleted: its open generated tasks are removed. Completed generated tasks remain as history.
- A cook or prep task was already completed before a schedule change: it is not reopened, edited, or duplicated. The plan item shows "Cook task was already completed before this change" so Scott can decide whether another action is needed.
- The week budget changes: no meal task time changes. Meal Plan and Finance update the same budget figure, and the shopping task description's budget state updates on the next reconciliation.

### 3.4 Cascade example: Planner event to brief task

This is the Orbit and Planner application of the same pattern:

1. Scott links Sophie to a future movie event.
2. When the event enters the brief lead window, one generated task appears: "Read your brief for Sophie."
3. Opening the task goes to the event's brief, assembled live from Orbit.
4. Reading the brief closes the task.
5. Renaming Sophie updates the open task name from the live Orbit name on reconciliation.
6. Moving or deleting the event retires or moves the task.
7. If the brief task was completed and the event later moves to a new occurrence, the new occurrence has a new generation key and can receive a new task; the completed one is not resurrected.

### 3.5 Cascade example: Finance bill to payment-preparation task

This is a later phase, using data Finance already owns:

1. A fixed recurring bill has a calculated due date from its frequency and start date.
2. Inside a lead window chosen by Scott, one generated task appears for that bill occurrence: "Prepare to pay <bill>."
3. Its generation key includes the bill ID and due date, so a monthly bill gets one task per occurrence and retries cannot duplicate it.
4. Linking an actual transaction to the bill through the existing `fulfills_recurring_id` path closes the task.
5. Changing the bill amount or due date updates the open task. Deleting the bill retires it.
6. A completed task for one occurrence is never edited when the next occurrence is generated.

This example should not be built until Scott decides whether every bill deserves a task or only bills above a threshold or without autopay.

## Design 4: Gap watchers in detail

### 4.1 Watcher state

Add a `gap_watchers` state table. One row tracks one watcher, one scope, and one gap episode:

- watcher key, such as `meals-week`, `grocery-budget-week`, `event-brief`, or `bill-funding`;
- scope type and scope ID;
- scope start and end dates;
- status: active, resolved, suppressed, or expired;
- a fingerprint of the exact gap;
- gap details as JSON, such as unplanned dates and slots;
- the current reminder ID, when one is open;
- episode number;
- first detected, last evaluated, resolved, and suppressed times.

The reminder itself remains a `reminders` row with generated-task provenance. Watcher state explains why it exists and prevents a second one.

### 4.2 Evaluation rhythm and limits

Version 1 evaluates a watcher:

- after a write to its source data;
- when Today, Tasks, Planner, Finance, or Meal Plan loads the relevant scope;
- when Scott opens the affected week or event.

The proposed meals check rhythm is Sunday at 18:00 for the coming week and a same-day check at 09:00. Those are the reminder's target date and time and the evaluation labels. Without a background scheduler, the app cannot guarantee that the row is created at 18:00 while closed. It will be created or updated on the next relevant app load and will carry the intended Sunday or same-day timing honestly. A scheduler and push delivery are a later phase and an open decision.

### 4.3 Meals watcher

**Scope:** one Monday-to-Sunday week and the required meal slots for that week.

**Gap:** a required date and slot that is before the end of the scope, is not intentionally skipped, and has no planned meal item.

**Evaluation:**

1. On the Sunday-evening check for the coming week, evaluate all seven days.
2. On the same-day check, evaluate the current week from today through Sunday. Days already past do not become a new retroactive gap.
3. If there is no gap, resolve the active watcher and complete its reminder.
4. If there is a gap and no open episode exists, create one reminder:
   - title: "Meals not yet planned for the week";
   - description: the unplanned dates and slots in display-date form;
   - action: open the week in Meal Plan.
5. If the same episode is open and the gap changes, update the same reminder's description and due state. Do not create another.
6. If Scott dismisses or completes the reminder while the same gap fingerprint remains, mark the watcher suppressed for that fingerprint. Do not recreate it on the next load.
7. If another required day becomes unplanned, the fingerprint changes. The watcher may create a new episode because the gap Scott dismissed is no longer the same gap.
8. If the week becomes fully planned, resolve and close the reminder. If a meal is later deleted and creates a gap again, start a new episode with a new reminder; do not resurrect the completed one.
9. At the end of the week, an unresolved watcher expires. It does not roll into the next week. The next week has its own scope and watcher state.

**Intentional skip:** In Meal Plan, Scott can mark a date and slot "No meal planned on purpose," with an optional reason. The watcher treats it as complete for that slot. Removing the skip reopens the gap on the next evaluation.

**Partial week:** If Scott starts on Wednesday, the watcher evaluates Wednesday through Sunday for the current week. It does not complain about Monday or Tuesday. The coming-week Sunday check still evaluates the full next week.

### 4.4 Grocery-budget watcher, later phase

- **Scope:** one Monday-to-Sunday week.
- **Gap:** no `grocery_budget_weeks` record by the Sunday check, or no record for the current week at the same-day check.
- **Reminder:** "Grocery budget not set for the week," opening Finance's grocery week budget action.
- **Close:** setting the amount resolves the watcher.
- **No duplicate:** changing the amount updates Finance and Meal Plan; it does not create another reminder.

### 4.5 Brief watcher, later phase with Orbit and Planner

- **Scope:** one linked event occurrence and person.
- **Gap:** the event is inside the brief lead window and there is no read state for the current Orbit profile update time.
- **Reminder:** "Read your brief for <person>."
- **Close:** reading the brief closes it. A later profile update makes the brief stale and can create a new episode.
- **Respecting intent:** if Scott removes the person from the event, the watcher resolves and its open reminder is retired. It does not keep watching a person who is no longer linked.

### 4.6 Bill-funding watcher, later phase

- **Scope:** one fixed bill occurrence in the current pay period.
- **Gap:** no paid transaction linked to the bill and no planned funding transaction linked to that bill occurrence inside the lead window.
- **Reminder:** "Set aside funds for <bill>."
- **Close:** linking a payment or a funding transaction to the bill resolves it.
- **Limit:** Finance currently has generic savings goals, not a bill-specific set-aside record. This watcher must not pretend a generic savings balance proves a particular bill is funded. It stays a later phase until Scott chooses the funding evidence.

## Data model changes

The following SQL is a design draft only. It has not been run.

### Generated-task and watcher foundations

```sql
alter table public.reminders
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists generator text,
  add column if not exists generated_hash text,
  add column if not exists managed_state text not null default 'manual';

alter table public.reminders
  add constraint reminders_managed_state_check
  check (managed_state in ('manual', 'generated', 'detached'));

create unique index if not exists reminders_open_generated_key_uidx
  on public.reminders (user_id, source_type, source_id, source_key)
  where source_type is not null and completed = false;

create table if not exists public.gap_watchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watcher_key text not null,
  scope_type text not null,
  scope_id text not null,
  scope_start date,
  scope_end date,
  status text not null default 'active'
    check (status in ('active', 'resolved', 'suppressed', 'expired')),
  gap_fingerprint text not null,
  gap_details jsonb not null default '{}'::jsonb,
  reminder_id uuid references public.reminders(id) on delete set null,
  episode integer not null default 1,
  first_detected_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now(),
  resolved_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Orbit and Planner links

```sql
create table if not exists public.event_people (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  person_id text not null,
  role text not null default 'attendee',
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, person_id),
  foreign key (user_id, person_id)
    references public.orbit_people(user_id, id) on delete cascade
);

create table if not exists public.event_person_brief_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  person_id text not null,
  occurrence_date date not null,
  profile_updated_at timestamptz,
  generated_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, event_id, person_id, occurrence_date),
  foreign key (user_id, event_id, person_id)
    references public.event_people(user_id, event_id, person_id) on delete cascade
);
```

### Prices, matches, and Finance week budgets

```sql
create table if not exists public.grocery_price_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null,
  source_ref text,
  dataset_version text,
  checksum text not null,
  captured_at timestamptz not null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  rejected_count integer not null default 0,
  status text not null default 'imported'
    check (status in ('imported', 'failed', 'superseded')),
  notes text,
  unique (user_id, checksum)
);

create table if not exists public.grocery_price_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null references public.grocery_price_imports(id) on delete cascade,
  store_key text not null,
  store_name text not null,
  external_product_key text not null,
  product_name text not null,
  normalized_name text not null,
  brand text,
  category text,
  product_url text,
  package_label text,
  unit_kind text not null check (unit_kind in ('mass', 'volume', 'count')),
  package_quantity_milliunits bigint not null check (package_quantity_milliunits > 0),
  package_price_cents integer not null check (package_price_cents >= 0),
  source_price_per_100_cents numeric(12,4),
  availability text,
  created_at timestamptz not null default now(),
  unique (import_id, store_key, external_product_key)
);

create table if not exists public.ingredient_product_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_ingredient text not null,
  store_key text not null,
  external_product_key text not null,
  status text not null default 'confirmed'
    check (status in ('suggested', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_ingredient, store_key)
);

create table if not exists public.grocery_budget_weeks (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  amount_cents integer not null check (amount_cents >= 0),
  finance_category text not null default 'Groceries',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
```

### Recipes, Meal Plan, shopping, and cost snapshots

```sql
alter table public.recipes
  add column if not exists ingredients_schema_version integer not null default 1,
  add column if not exists prep_profile jsonb not null default '{}'::jsonb,
  add column if not exists archived boolean not null default false;

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'completed', 'cancelled')),
  shopping_store_key text,
  shopping_store_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  planned_date date not null,
  meal_slot text not null
    check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes(id) on delete restrict,
  custom_title text,
  custom_ingredients jsonb not null default '[]'::jsonb,
  servings numeric(8,2) not null default 1 check (servings > 0),
  eat_time time,
  status text not null default 'planned'
    check (status in ('planned', 'intentional_skip', 'cooked', 'cancelled')),
  skip_reason text,
  advance_prep_kind text not null default 'none'
    check (advance_prep_kind in ('none', 'night_before', 'morning', 'lead_time')),
  advance_prep_lead_minutes integer,
  advance_prep_note text,
  food_log_id uuid references public.food_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, planned_date, meal_slot),
  check (recipe_id is not null or custom_title is not null or status = 'intentional_skip')
);

alter table public.food_logs
  add column if not exists meal_plan_item_id uuid
  references public.meal_plan_items(id) on delete set null;

create unique index if not exists food_logs_meal_plan_item_uidx
  on public.food_logs (meal_plan_item_id)
  where meal_plan_item_id is not null;

create table if not exists public.meal_plan_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  price_import_id uuid references public.grocery_price_imports(id) on delete set null,
  store_key text,
  store_name text,
  purchase_total_cents integer not null default 0,
  consumed_total_cents integer not null default 0,
  required_line_count integer not null default 0,
  priced_line_count integer not null default 0,
  coverage_status text not null default 'partial'
    check (coverage_status in ('complete', 'partial')),
  details jsonb not null default '{}'::jsonb,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null unique references public.meal_plans(id) on delete cascade,
  store_key text,
  store_name text,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plan_shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shopping_list_id uuid not null references public.meal_plan_shopping_lists(id) on delete cascade,
  ingredient_key text not null,
  display_name text not null,
  unit_kind text not null check (unit_kind in ('mass', 'volume', 'count')),
  required_quantity_milliunits bigint not null default 0,
  store_key text,
  external_product_key text,
  packages_needed integer,
  package_price_cents integer,
  purchase_cost_cents integer,
  state text not null default 'needed'
    check (state in ('needed', 'already_have', 'purchased', 'unpriced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shopping_list_id, ingredient_key, store_key, external_product_key)
);
```

All new owner-scoped tables need row-level security with the existing owner-only rule and the explicit authenticated and service-role grants this project now requires. The implementation checklist includes writing those policy and grant blocks in the actual migration, with names following the neighboring migrations. No policy should expose another user's people, prices, plans, or tasks.

### Representation rules

- New grocery and budget amounts are integer cents.
- Legacy Finance values remain signed dollars until they cross an existing Finance boundary. Conversion happens in one adapter, never independently in components.
- Quantities use integer milliunits in storage and calculation. Display conversion happens at the edge.
- Cost line calculations use integer arithmetic and round only the displayed or snapshot total, not every intermediate rate.
- Dates are local calendar dates. Times remain real time values, not display strings.
- A cost snapshot is an immutable calculation record. It is not an editable copy of a price, recipe, or budget.

## API and page changes

### Shared foundations

- `src/api/plannerApi.js`: persist the new reminder provenance fields; keep `event_id` compatibility; expose generated-task reads by source.
- New `src/api/generatedTasksApi.js`: build, create, update, retire, and detach generated tasks through the existing reminder functions where possible.
- New `src/lib/cascades.js`: pure desired-task builders and hash comparison for meal, event brief, bill, and watcher rules, with focused tests.
- New `src/api/gapWatchersApi.js`: load and save watcher state and its linked reminder.
- New `src/lib/gapWatchers.js`: pure gap predicates, fingerprints, and episode decisions, with focused tests.
- `src/api/aiLibrary.js`: register the new collections and generated provenance fields so agents read the same source-linked records. People remain read-only there.

### Orbit and Planner

- `src/api/peopleApi.js`: add read-only single-person and person-option loaders using the existing `orbit_people` flattening. Do not add people writes.
- New `src/api/peopleLinksApi.js`: owner-scoped `event_people` and brief-state reads and writes.
- `src/components/EventForm.jsx`: add the People picker and return selected person IDs with the existing event values.
- `src/lib/events.js`: after event creation, save people links and reconcile event cascades. On edit, replace links through the same path.
- `src/pages/admin/PlannerPage.jsx` and `src/pages/admin/CalendarPage.jsx`: load links and people, render live names, merge birthday occurrences, show the brief action, and pass proposed Orbit attendees to the existing post-event Orbit logging flow for review.
- `src/pages/admin/ProjectsPage.jsx`: use the same shared event form and link path for project events.
- New `src/utils/birthdays.js`: host occurrence calculation only if the canonical Orbit derivation cannot be consumed cleanly; tests must match Orbit's February 29 and no-year behavior.
- New `src/lib/preHangoutBrief.js`: pure brief assembly from a person, their Orbit events, linked host occurrences, and brief state.
- `src/pages/admin/PeoplePage.jsx`: only host configuration changes that are already supported by canonical Orbit. The profile's Calendar section itself is canonical Orbit work, followed by the established synchronization process. Do not edit `orbit/` in this repository.
- `api/orbit.js`: fold any required host-event read into the existing Orbit handler if canonical Orbit needs it. Do not add a Vercel function.

### Finance, prices, recipes, and Meal Plan

- New `src/api/groceryPricesApi.js`: validate and import snapshots, list imports and items, resolve stable product keys to the newest import, and save ingredient matches.
- New `src/api/recipesApi.js`: load recipes with structured ingredient state, save version 2 ingredient lines and prep profiles, and archive recipes.
- New `src/api/mealPlanApi.js`: load and save week plans and items, grocery week budgets, shopping lists, cost snapshots, and cooked links.
- New `src/lib/recipeIngredients.js`: parse and validate legacy ingredient lines, convert supported units, and identify lines needing review.
- New `src/lib/mealPlanCost.js`: pure meal-cost, shopping aggregation, package rounding, coverage, and snapshot detail calculations.
- `src/pages/admin/HealthPage.jsx`: add the Plan tab and mount the Meal Plan panel. Keep Food as the actual log.
- New `src/components/health/MealPlanPanel.jsx`: week summary, day sections, recipe and custom meal actions, cost coverage, shopping list, intentional skip, and Log as eaten actions. All forms use `FormModal`.
- `src/pages/admin/BudgetPage.jsx`: add the Finance grocery week budget action, price snapshot import action, and planned-versus-actual grocery section.
- `src/components/budget/budgetSummary.js`: accept the shared Meal Plan week result and include planned grocery figures without treating them as transactions.
- `src/components/budget/WeeklyTracker.jsx`: show Finance target, planned grocery spend, actual grocery spend, and coverage for the selected week.
- `src/api/groceryApi.js`: optionally link a saved receipt to a shopping list when Scott selects it. Receipt posting to actual Finance remains explicit.
- `src/api/healthApi.js`: include `recipe_id` and `meal_plan_item_id` in food reads and writes, while preserving the current per-item food behavior.
- `src/components/health/HealthModals.jsx`: allow the Food Modal to receive a plan-item prefill and return the saved food row ID to the caller.

## Pseudocode

The following pseudocode follows `docs/development/PSEUDOCODE_STANDARD.md`. It is the design contract to approve before implementation.

### A. Reconcile generated tasks

```text
Trigger:
  A source record is created, updated, cancelled, or deleted, or Scott chooses
  Retry follow-through on a source that reports a pending cascade.

Inputs:
  The saved source record, its owner, the generator rule, and the current time.

Preparation and rules:
  Build the complete desired task list from the source.
  Give every desired task a deterministic source key.
  Load open tasks for the same source type and source ID.
  Match desired and existing tasks by source key.

User-visible states:
  Show no blocking dialog for a successful cascade.
  Show the source as saved with a retryable follow-through error if the source
  saved but reconciliation failed.

Actions:
  Create missing open tasks.
  Update an open generated task whose managed hash is unchanged by Scott.
  Delete an open generated task that is no longer desired.
  Leave completed tasks untouched.
  Leave detached tasks untouched and report the detached dependent.

Errors:
  A duplicate creation caused by a concurrent save returns the existing open
  task for that source key.
  A failed task write never rolls back the already-saved source silently; the
  source shows the pending cascade and Retry follow-through.

Outputs:
  Reminder rows with source provenance, plus a reminders data-change event.

Invariants:
  At most one open generated task exists for one source role.
  A completed generated task is never edited, reopened, or resurrected.
  A manual task with no source provenance is never touched.
```

### B. Link people to an event and read them in the Planner

```text
Trigger:
  Scott creates or edits an event in EventForm.

Inputs:
  Existing event values and selected Orbit person IDs from the People picker.

Preparation and rules:
  Load people read-only from orbit_people and display current names.
  Natural language may preselect only an exact unique person match for review.
  No name creates a person.

Actions:
  Save the host event through plannerApi.
  Replace event_people rows for that event with the selected IDs.
  Invalidate event and people-link reads.

Planner rendering:
  Load host events, event_people, and people for the visible range.
  Resolve each link to the current Orbit name at render time.
  Derive birthday occurrences from Orbit birthdays and merge them by date.
  Label birthday rows as birthdays and link them to the Orbit profile.

Errors:
  If link saving fails after the event saves, keep the event, show the exact
  link error, and offer retry from the event.
  If a linked person no longer resolves, hide the stale chip and surface a
  data-integrity state rather than showing a guessed name.

Outputs:
  One host event, zero or more ID-based people links, and no copied name field.

Mobile and accessibility:
  The picker is inside the existing event modal, supports search and clear
  labels, and keeps selected people visible as removable chips.

Tests:
  Exact and ambiguous name resolution, rename reflection, recurring series
  links, birthday range derivation, link failure retry, and person deletion.
```

### C. Build a person profile's event history and brief

```text
Trigger:
  Scott opens a person profile or chooses Read brief on a linked event.

Inputs:
  Orbit person ID, Orbit events, host event_people links, host events, and
  brief state for the selected occurrence.

Preparation and rules:
  Keep Orbit history and host Calendar history labelled by source.
  Expand recurring host events only for the requested range or next/past view.
  Assemble the brief only from saved Orbit facts, notes, intents, questions,
  and event history.

Actions:
  Show past events in reverse chronological order.
  Show the next event from the earliest future occurrence across both sources.
  For a brief, record generated time and the Orbit profile update time seen.
  When Scott opens the brief, record read time and close its generated task.

Errors:
  If host events cannot load, show Orbit history with a clear unavailable
  state for Calendar events.
  If the person has no saved context, show an honest empty brief rather than
  inventing talking points.

Outputs:
  A current profile history and brief read state. No profile text is copied.

Invariants:
  Planned attendance is never rewritten as actual attendance.
  A profile update after a brief read makes that brief stale.
```

### D. Import a grocery price snapshot

```text
Trigger:
  Scott chooses Import price snapshot in Finance and selects a dataset file.

Inputs:
  CSV or JSON rows, the dataset capture time, and source metadata.

Preparation and rules:
  Validate required fields, store and product keys, unit kind, package
  quantity, integer-cent package price, and capture date.
  Normalize names for matching without changing the displayed product name.
  Derive the working unit rate from package price and quantity.
  Compare the derived rate with the source per-100 rate when supplied.

User-visible states:
  Show rows read, rows accepted, rows rejected, and rejection reasons before
  the final import action.
  Show the active capture date wherever a price is used.

Actions:
  Write one import batch and its items.
  Mark prior current imports as superseded only after the new batch succeeds.
  Register the import and item collections in the Library.

Errors:
  A malformed file writes nothing.
  A partially valid file imports only accepted rows and reports coverage as
  partial.
  A failed database write leaves the previous snapshot active.

Outputs:
  A dated, owner-scoped price snapshot that Meal Plan can resolve by stable
  store and product keys.

Invariants:
  No price is hand-typed into a recipe, plan, or Finance total.
  A price without a capture date is not accepted as current data.
```

### E. Cost a recipe and a week

```text
Trigger:
  Scott opens Meal Plan, changes a plan item, changes a match or store, or
  chooses Mark week ready or Recost week.

Inputs:
  Recipes with structured ingredients, planned servings, the selected store,
  ingredient matches, and one price import.

Preparation and rules:
  Scale each recipe line by planned servings divided by recipe servings.
  Resolve each line to a stable product for the selected store.
  Calculate meal consumption cost from unit rates.
  Aggregate required quantities across the week before package rounding.
  Exclude a shopping quantity only when its shopping item is already have it.
  Round purchase quantities up to whole packages.

User-visible states:
  Show meal cost, planned grocery spend, budget difference, priced line count,
  required line count, unpriced lines, store, and price capture date.
  Label a total partial when any required line is unpriced or needs review.

Actions:
  In draft, return a live preview from the shared pure cost function.
  On Mark week ready, save an immutable cost snapshot.
  On Recost week, save a new snapshot and supersede the old one.

Errors:
  A missing product does not become zero cost; it becomes an unpriced line.
  A density-dependent quantity is not converted by guesswork.
  A product sold by count cannot price a mass or volume line unless the recipe
  line is also count-based or a reviewed conversion exists.

Outputs:
  A shopping list, per-meal consumption costs, a weekly purchase estimate,
  and a snapshot both Meal Plan and Finance can read.

Invariants:
  Finance and Meal Plan never calculate different planned totals from the
  same snapshot.
  Planned grocery spend is never inserted as an actual transaction.
```

### F. Plan a meal and run its cascade

```text
Trigger:
  Scott saves, moves, replaces, skips, cancels, or deletes a meal plan item.

Inputs:
  The saved item, its recipe prep and cook times, advance-prep profile,
  servings, date, meal slot, and eating time.

Preparation and rules:
  Calculate the cook start from eating time minus prep and cook minutes.
  Use a 45-minute fallback only when no usable recipe times exist.
  Calculate a prep task only from an explicit prep profile or item override.
  Recalculate the week shopping list from all planned items.

Actions:
  Reconcile one cook task for the item.
  Reconcile one prep task when required, or fold its note into the cook task
  when they would duplicate the same work at the same time.
  Reconcile the one shopping list and shopping task for the week.
  Update Finance and Meal Plan reads through the shared cost calculation.

Change behavior:
  Move an open task when its source time changes.
  Remove open meal tasks when the item is skipped, cancelled, or deleted.
  Preserve the shopping item state when the same ingredient and product remain.
  Leave a completed task unchanged and flag the source if a later schedule
  change makes that completed work questionable.

Errors:
  If task reconciliation fails, keep the meal saved, show follow-through as
  pending, and offer Retry follow-through.
  If a calculated shopping due time is already past, show the task as due now
  rather than silently choosing an unrelated future date.

Outputs:
  Meal plan item, current shopping list, and zero or more generated tasks.

Invariants:
  One meal has at most one open cook task and one open prep task.
  One week has at most one open shopping task.
  A completed task is never resurrected.
```

### G. Log a planned meal as eaten

```text
Trigger:
  Scott chooses Log as eaten on a planned meal item.

Inputs:
  Plan item, recipe, date, meal slot, and servings context.

Actions:
  Open the existing Food Modal with recipe values prefilled.
  Save through healthApi only after Scott reviews the food values.
  Write recipe_id and meal_plan_item_id on the food_logs row.
  Mark the plan item cooked only after the food save returns success.
  Reconcile any still-open cook task through the normal task completion path.

Errors:
  Closing or cancelling the modal leaves the item planned.
  A failed food save leaves the item planned and preserves the modal values.
  Deleting the linked food row later returns the item to planned with a
  visible Food log removed state.

Outputs:
  One linked Food Log row and one cooked plan item.

Invariants:
  Passing time alone never marks a meal cooked.
  Plan and Food Log cannot disagree about whether the linked log exists.
```

### H. Evaluate a gap watcher

```text
Trigger:
  A source write, a relevant page load, or an explicit watcher evaluation for
  a bounded scope.

Inputs:
  Watcher definition, scope dates, source records, existing watcher state,
  and the current date and time.

Preparation and rules:
  Calculate the exact gap set from the owning records.
  Treat an intentional skip as satisfying the meals rule.
  Hash the sorted gap set into a fingerprint.
  Ignore dates before the evaluated part of a partial current week.

Actions:
  If there is no gap, resolve an active watcher and complete its reminder.
  If there is a gap and no active episode, create one watcher state row and
  one generated reminder.
  If the active gap fingerprint is unchanged, update last evaluated time only.
  If the gap changed while the reminder is open, update the same reminder and
  watcher details.
  If Scott dismissed the reminder for the same fingerprint, keep the watcher
  suppressed and create nothing.
  If the gap closes and later reopens, create a new episode and a new reminder.
  If the scope ends with a gap, expire the watcher and close its reminder.

Errors:
  A failed source load does not create a gap reminder. It reports that the
  watcher could not be evaluated.
  A duplicate evaluation returns the existing active watcher and reminder.

Outputs:
  At most one open watcher reminder per watcher and scope episode.

Invariants:
  The same gap never produces two open reminders.
  A resolved reminder is not resurrected for a later gap.
  A watcher never invents a gap from missing or failed data.
```

## Phasing recommendation

### Phase 0: Shared foundations

- Add generated-task provenance and reconciliation.
- Add watcher state and the pure watcher decision functions.
- Register the new source collections in the Library.
- Move the existing event-type auto-task path onto the shared contract without changing its visible behavior.

This phase is small, but it prevents Meal Plan, briefs, bills, and watchers from each inventing a different duplicate-prone mechanism.

### Phase 1: Finance and Meal Plan first

Build this before Orbit and Planner for three evidence-based reasons:

1. The price dataset and Scott's hard $75 week are immediate. Delaying the connection until the Orbit work is done would leave the grocery plan dependent on hand-checked prices again.
2. Finance, recipes, grocery receipts, Food Log, and Tasks are all host-owned. This phase does not need a canonical Orbit release or synchronization.
3. It proves both new patterns in one useful flow: cascades create cook, prep, and shopping work; the meals watcher protects the same week from gaps.

Subphases:

- **1A:** Price import, recipe ingredient structure, product matches, and cost functions.
- **1B:** Finance grocery week budget, Meal Plan week, shared cost preview and snapshot, and Finance planned-versus-actual display.
- **1C:** Shopping list, cook and prep cascades, meals watcher, and grocery-budget watcher.
- **1D:** Log as eaten and Food Log agreement.

### Phase 2: Orbit and Planner

- Add `event_people` and brief state.
- Add the EventForm People picker and live Planner rendering.
- Add derived birthdays to Planner and Calendar.
- Add the canonical Orbit profile Calendar read model and synchronize it.
- Add the brief view, brief cascade, and brief watcher.

This phase is second because it crosses the canonical Orbit boundary and needs identity, merge, recurrence, and profile-history decisions to be tested carefully.

### Phase 3: Later cascades and watchers

- Bill occurrence preparation tasks, if Scott wants them.
- Bill-funding watcher, after Scott chooses what counts as funded.
- Receipt-to-shopping-list comparison and planned-versus-actual ingredient learning.
- Background watcher scheduling and notifications, if Scott chooses that infrastructure.

## Edge cases

### People and events

- **Person deleted with host events attached:** host links are removed; host events remain; open brief tasks are retired; derived birthdays disappear.
- **Person deleted with Orbit events attached:** Orbit's existing behavior remains: shared Orbit events lose that person and their updates; solo Orbit events are removed; fact links elsewhere are unlinked.
- **Person renamed:** all Planner chips, brief tasks, and profile headings read the new name from the same ID.
- **Person merged:** host links must be rewritten to the kept ID in coordination with Orbit's merge. Duplicate links collapse.
- **Ambiguous natural-language name:** no link is saved. The form asks Scott to pick the exact person.
- **Unknown name:** no person is created and no link is saved.
- **Recurring event:** version 1 links the person to the whole series. Moving one occurrence is not supported as a separate linked occurrence.
- **Event moved after brief read:** the old occurrence brief does not satisfy the new occurrence. A new brief state and, inside the lead window, a new task are created.
- **Event title sounds like a hangout but has no linked person:** no brief is generated and no attendance is inferred.
- **Past event logging:** proposed attendees from the host event are shown for review in Orbit. Saving actual Orbit history remains explicit.

### Prices, recipes, and money

- **Price data missing:** Meal Plan can hold meals, but cost coverage is zero and Finance shows no planned total as if it were known.
- **Price data stale:** the capture date and age are shown. The plan can still calculate, but the total is labelled with that date. The stale threshold needs Scott's decision.
- **Partial prices:** priced and required counts are shown. The known subtotal is not called a complete total.
- **Package size missing:** the product cannot produce a dependable purchase estimate. The line is unpriced for planned grocery spend.
- **Volume-to-mass conversion:** no price is calculated until a density or reviewed conversion exists.
- **Recipe edited after snapshot:** the finalized Finance figure remains the snapshot figure. Meal Plan shows that the plan changed and offers Recost week.
- **Price import replaced after snapshot:** the snapshot continues to point to its original import and line details. Current previews use the newer import.
- **Ingredient already at home:** purchase cost is excluded for the marked quantity; meal consumption cost remains visible.
- **Multiple meals use one package:** purchase rounding happens after weekly aggregation, not per meal.
- **Actual receipt differs:** Finance keeps planned and actual separate. A receipt does not rewrite the plan snapshot.
- **Category mismatch:** the Finance grocery week record stores the category used for actuals. The feature does not silently merge `Food` and `Groceries` histories.

### Cascades

- **Source edited:** open generated tasks update from the new source values.
- **Source deleted:** open generated tasks are removed, except where a source-specific rule says to unlink and retain history. Meal and event cascades use removal for open tasks.
- **Spawned task completed:** it remains completed and unchanged. A later source change flags the source instead of resurrecting it.
- **Spawned task manually edited:** it becomes detached and is no longer overwritten or deleted by the source.
- **Concurrent saves:** deterministic keys and the open-task unique index return one task, not duplicates.
- **Cascade failure after source save:** the source remains saved, shows follow-through pending, and can retry without saving the source again.
- **Shopping list regeneration:** needed and purchased states survive for the same ingredient and product; quantities and package counts update.
- **First meal is today:** the shopping task is not moved to an unrelated future date. It is due now or at the calculated pre-meal time and can honestly appear overdue.

### Watchers

- **Gap fires once:** repeated loads with the same gap update evaluation time only.
- **Gap grows:** the same open reminder updates its listed days.
- **Gap shrinks:** the same open reminder updates. It closes only when no required gap remains.
- **Scott dismisses the reminder:** the same fingerprint is suppressed. A materially different gap can start a new episode.
- **Meal deleted after the watcher closed:** a new episode and new reminder are created; the old completed reminder is not reopened.
- **Intentional skip:** the watcher treats the slot as satisfied. Removing the skip creates a gap on the next evaluation.
- **Partial current week:** past days in the current week do not become retroactive gaps.
- **No plan exists:** all remaining required days in scope are the gap.
- **Source load fails:** no reminder is created from uncertainty.
- **Week ends:** an unresolved watcher expires rather than rolling into the next week.

## End-to-end scenario matrix

Status for every row is **untested** in this docs phase. Implementation must record passed, failed, or untested with evidence and must distinguish scripted-provider UI tests from real-database verification.

| ID | Class | Scenario | Expected result |
|---|---|---|---|
| CP-01 | Normal | Link one person to a one-off event | Planner shows the current Orbit name and profile link; no name is copied to the event |
| CP-02 | Normal | Rename the linked person in Orbit | Planner, Calendar, and open brief task show the new name without editing the event |
| CP-03 | Alternate | Open a person profile | Past and next rows combine labelled Orbit history and linked Calendar events |
| CP-04 | Ambiguous | Draft an event naming two people with the same name | No link is preselected as certain; Scott picks the exact person or leaves it unlinked |
| CP-05 | Boundary | Show a February 29 birthday in a non-leap year | Planner derives February 28, matching Orbit |
| CP-06 | Error | Event saves but link write fails | Event remains, exact link error appears, retry saves only the links |
| CP-07 | Persistence | Delete a person linked to a host event | Link and brief task are removed; host event remains; birthday row disappears |
| CP-08 | Concurrency | Save the same linked event twice at once | One event and one set of links result |
| CP-09 | Normal | Import a complete dated price snapshot | Items resolve by stable store and product key; capture date is visible |
| CP-10 | Error | Import a malformed price file | Nothing replaces the active snapshot; validation errors are specific |
| CP-11 | Boundary | Cost a partial-price recipe | Total is labelled partial and lists every unpriced required line |
| CP-12 | Normal | Plan the same ingredient in three meals | Purchase packages are rounded once after weekly aggregation |
| CP-13 | Normal | Set a $75 Finance grocery week and mark the plan ready | Meal Plan and Finance show the same planned grocery spend and snapshot |
| CP-14 | Alternate | Save a grocery receipt and post it to Finance | Actual spend changes; planned snapshot does not change |
| CP-15 | Persistence | Replace a price import after a snapshot | Old snapshot keeps its import and totals; new preview uses the new import |
| CP-16 | Error | Log as eaten but food save fails | Plan remains planned; no cooked state or task completion is claimed |
| CP-17 | Normal | Plan dinner for 18:00 with 15 minutes prep and 45 minutes cook | One cook task is created for 17:00 |
| CP-18 | Alternate | Plan a meal needing night-before prep | One prep task is created for the previous day at the approved default time |
| CP-19 | Cascade change | Move dinner from 18:00 to 19:00 | Open cook and lead-time prep tasks move; completed tasks do not |
| CP-20 | Cascade delete | Delete a planned meal | Its open cook and prep tasks are removed; the shopping list recalculates |
| CP-21 | Cascade duplicate | Save the same meal repeatedly and retry a failed cascade | Exactly one open cook task, one open prep task if required, and one weekly shopping task exist |
| CP-22 | Cascade completed | Complete a cook task, then move the meal | Completed task stays completed; plan flags the schedule conflict and creates no duplicate |
| CP-23 | Cascade detach | Edit a generated task's time directly | Task becomes detached; later meal changes do not overwrite it |
| CP-24 | Watcher normal | Leave two required days unplanned at the Sunday check | One reminder titled "Meals not yet planned for the week" lists both days |
| CP-25 | Watcher silent | Plan or intentionally skip every required day | No meals watcher reminder is created |
| CP-26 | Watcher update | Start with three unplanned days, then plan one | Same open reminder updates to two days; no second reminder appears |
| CP-27 | Watcher self-clear | Plan the last unplanned day | Watcher resolves and its reminder closes |
| CP-28 | Watcher reopen | Delete a planned meal after the watcher resolved | A new episode and new reminder appear; the old completed reminder stays completed |
| CP-29 | Watcher suppression | Dismiss the reminder, then reload with the same unplanned days | No duplicate reminder appears for the same fingerprint |
| CP-30 | Watcher partial week | Start planning on Wednesday | Watcher evaluates Wednesday through Sunday only for the current week |
| CP-31 | Watcher skip | Mark Friday as no meal planned on purpose | Friday is not listed as a gap; removing the skip makes it a gap |
| CP-32 | Watcher error | Meal Plan source load fails | No gap reminder is created and the evaluation error is visible |
| CP-33 | Watcher budget | Reach the Sunday check with no Finance grocery budget for next week | One grocery-budget watcher reminder appears and closes when the amount is set |
| CP-34 | Brief watcher | Link a person to an event inside the brief lead window | One brief reminder appears; reading the current brief closes it |
| CP-35 | Brief stale | Read a brief, then update the person's Orbit profile | The brief is marked stale and a new brief episode can be raised |
| CP-36 | Bill cascade | Create a fixed bill occurrence inside the approved lead window | At most one preparation task exists for that bill and due date |
| CP-37 | Undo | Remove a person link from an event | Open brief work is retired; the event and its other people remain |
| CP-38 | Reload | Reload after every connected write | Links, costs, snapshots, tasks, and watcher state return from the database, not local defaults |

## Acceptance criteria

- [ ] A Planner event can be linked to zero or more real Orbit people by ID, and every linked display name is read from Orbit at render time.
- [ ] A birthday stored only in Orbit appears as a derived Planner occurrence in the visible range and opens the correct Orbit profile.
- [ ] A person profile separates Orbit history from linked Calendar events and shows past events plus the next event without presenting either source as the other.
- [ ] A pre-hangout brief is assembled from current Orbit context and linked event data; reading it is recorded per occurrence.
- [ ] A dated grocery price snapshot can be imported without replacing the prior snapshot on failure.
- [ ] Recipe ingredient lines can be marked ready or needs review, and no ambiguous line is silently priced.
- [ ] Finance and Meal Plan show the same planned grocery spend for the same cost snapshot.
- [ ] Planned grocery spend is never counted as actual Finance spend.
- [ ] A partial cost is labelled partial with priced and required line counts.
- [ ] Saving a planned meal reconciles its cook task, prep task when required, and the week's shopping task and list.
- [ ] Editing, moving, skipping, cancelling, or deleting a source updates or retires its open generated tasks without duplicates or orphans.
- [ ] A completed generated task is never edited, reopened, or resurrected by reconciliation.
- [ ] The meals watcher creates one living reminder for a gap, updates it as the gap changes, closes it when the week is complete, respects intentional skips, and creates a new episode only for a reopened or materially changed gap.
- [ ] Log as eaten creates a linked Food Log row only after a successful food save.
- [ ] All new money calculations use integer cents at the Connected Pages boundary.
- [ ] Desktop and mobile flows pass the scenario matrix with evidence, and real-database verification is reported separately from scripted tests.

## Open questions for Scott

These are product decisions, not implementation details. The recommendations are the defaults used in the pseudocode, but implementation should not proceed on the blocked items until Scott answers or gives the repository's exact approval for the document as a whole.

### SPEC-GAP 1: Cascade authority

- **Decision:** Are deterministic generated tasks created automatically when a source is saved, or proposed for one-tap confirmation?
- **Options:** automatic after save | proposal queue with one-tap confirm
- **Recommendation:** automatic after save, because Scott's rule is that planning should spawn the supporting work. Show the source, allow detach or delete, and make every cascade idempotent.
- **Blocked work:** all cascade phases.

### SPEC-GAP 2: Meal slots and watcher timing

- **Decision:** Which meal slots are required, and when should the meals watcher aim to surface?
- **Options:** dinner only, Sunday 18:00 plus same-day 09:00 | breakfast, lunch, and dinner, Sunday 18:00 plus same-day 09:00 | a configurable slot set per week
- **Recommendation:** dinner only for version 1, with Sunday 18:00 and same-day 09:00 as target times. Add other slots only if Scott actually plans them.
- **Blocked work:** meals watcher predicate and default plan layout.

### SPEC-GAP 3: Cook, prep, and shopping defaults

- **Decision:** Are the proposed defaults right: recipe prep plus cook time, 45-minute fallback, night-before prep at 20:00, morning prep at 08:00, and shopping the day before the first meal at 17:00?
- **Options:** use the proposed defaults | Scott supplies different defaults
- **Recommendation:** use recipe prep plus cook time first and the 45-minute fallback only when the recipe lacks usable times.
- **Blocked work:** meal cascade timing.

### SPEC-GAP 4: Generated-task editing

- **Decision:** If Scott edits a generated task's title, date, or time, should it detach from its source, or should the source continue to manage it?
- **Options:** detach on manual schedule edit | source keeps overwriting generated fields
- **Recommendation:** detach. It prevents a later meal or event save from silently undoing Scott's manual decision.
- **Blocked work:** shared cascade contract.

### SPEC-GAP 5: Store and match policy

- **Decision:** Does a week use one selected store for its shopping list, or the cheapest matched product per ingredient across stores? Can provisional unconfirmed matches be used?
- **Options:** one selected store and confirmed matches | one selected store with clearly labelled provisional matches | cheapest per ingredient across stores
- **Recommendation:** one selected store and confirmed matches for the finalized snapshot. A multi-store cheapest list may look cheaper but creates more than one shopping trip and weakens the one-list model.
- **Blocked work:** cost snapshot and shopping list.

### SPEC-GAP 6: Finance planned figure

- **Decision:** Should planned grocery spend remain a derived Finance figure, or should Mark week ready also create a linked `future` transaction?
- **Options:** derived figure only | derived figure plus an explicit linked future transaction
- **Recommendation:** derived figure only in version 1. It stays separate from actuals and avoids a second money record that must be reconciled.
- **Blocked work:** Finance display contract.

### SPEC-GAP 7: Brief lead and read state

- **Decision:** How far before an event should the brief task appear, and what counts as read?
- **Options:** 24 hours, opening the assembled brief counts as read | 48 hours, opening the assembled brief counts as read | task appears with the event and only an explicit Mark brief read closes it
- **Recommendation:** 24 hours, and opening the assembled brief counts as read. A later Orbit profile update marks it stale.
- **Blocked work:** Orbit and Planner phase.

### SPEC-GAP 8: Recurring people links

- **Decision:** Is a person link on the whole recurring series enough for version 1, or must Scott be able to change people for one occurrence?
- **Options:** series-level link only | occurrence-level exceptions in version 1
- **Recommendation:** series-level only. The host recurrence model expands one row and has no occurrence record to own an exception.
- **Blocked work:** recurring event design.

### SPEC-GAP 9: Price freshness and budget category

- **Decision:** After how many days is a price snapshot stale, and should the grocery week category remain `Groceries` even where older Finance defaults used `Food`?
- **Options:** warn after 7 days | warn after 14 days | no automatic stale warning, always show capture date
- **Recommendation:** warn after 14 days, always show the capture date, and store the actual category on the grocery week record rather than renaming history.
- **Blocked work:** price import warnings and Finance actual matching.

### SPEC-GAP 10: Bill cascades and funding evidence

- **Decision:** Which bills should spawn preparation tasks, and what counts as funded for the later bill watcher?
- **Options:** every fixed bill | bills without autopay only | bills above a Scott-set amount; funding evidence to be chosen with the task rule
- **Recommendation:** defer both bill patterns until the grocery and brief flows prove the shared mechanisms. Then start with fixed bills without autopay.
- **Blocked work:** Phase 3 only.

## Ordered implementation checklist

### Docs and approval

- [x] Inspect People, Orbit, Planner, Finance, recipes, grocery receipts, Food Log, Tasks, migrations, and feature records.
- [x] Record Scott's Connected Pages, cascade, and gap-watcher direction in this feature document.
- [x] Draft the data model and migration SQL without running it.
- [x] Write pseudocode for person links, briefs, price import, meal costing, cascades, cooked logging, and watchers.
- [ ] Scott answers the SPEC-GAP decisions or approves the document with its recommendations.
- [ ] Interactive HTML blueprint built from this plan and walked through with Scott (see "Next gate: interactive blueprint"). No build before this gate passes.
- [ ] Scott gives the repository's exact implementation approval for a named phase.

### Phase 0: Shared foundations

- [ ] Add generated-task provenance and watcher-state migration source.
- [ ] Implement and test deterministic generated-task reconciliation.
- [ ] Implement and test pure gap-watcher decisions and fingerprints.
- [ ] Register source-linked collections in the Library.
- [ ] Move event-type auto-tasks onto the shared contract without visible regression.

### Phase 1: Finance and Meal Plan

- [ ] Add price import, price item, match, grocery week budget, Meal Plan, shopping, and cost snapshot migration source.
- [ ] Build the price importer and its validation evidence.
- [ ] Structure recipe ingredients and prep profiles; surface needs-review lines.
- [ ] Build the shared meal-cost and package-rounding engine with tests.
- [ ] Build the Meal Plan Plan tab and Finance grocery week section.
- [ ] Add cost snapshots and the Finance planned-versus-actual display.
- [ ] Add shopping list generation and state preservation.
- [ ] Add cook, prep, and shopping cascades.
- [ ] Add the meals watcher and grocery-budget watcher.
- [ ] Add Log as eaten and Food Log reconciliation.
- [ ] Run the Phase 1 scenario matrix on scripted data and a real database, reported separately.

### Phase 2: Orbit and Planner

- [x] Add `event_people` migration source (slice 1, 2026-10-23, see the slice record at the end of this document). Brief-state migration source still pending.
- [x] Build read-only person options and the EventForm People picker (slice 1, 2026-10-23).
- [ ] Render linked people and derived birthdays in Planner and Calendar. (Linked people rendered in slice 1, 2026-10-23; derived birthdays still pending.)
- [ ] Build the host-event read adapter through an existing handler or Library path.
- [ ] Implement the canonical Orbit profile Calendar section and synchronize it.
- [ ] Build the pre-hangout brief and its read state.
- [ ] Add brief cascade and watcher behavior.
- [ ] Coordinate Orbit person merge with host-link rewriting.
- [ ] Run the Phase 2 scenario matrix, including rename, merge, deletion, ambiguity, and recurrence.

### Phase 3: Later patterns

- [ ] Decide and build bill preparation cascades.
- [ ] Decide funding evidence and build the bill-funding watcher.
- [ ] Add receipt-to-shopping-list comparison.
- [ ] Decide whether background scheduling or notifications are worth their infrastructure.

### Closure for each implementation phase

- [ ] Update this feature record with final behavior, changed files, decisions, and evidence.
- [ ] Complete `docs/development/POST_TASK_CHECKLIST.md`.
- [ ] Update `docs/development/ACTIVE_WORK.md` and `docs/development/WORKLOG.md` in the implementation phase, when no concurrent-writing restriction applies.
- [ ] Record bugs in `docs/development/BUGS.md` and user-visible changes in `CHANGELOG.md` when applicable.
- [ ] Present the diff and validation evidence before any commit, push, migration, or deployment approval.

## Next gate: interactive blueprint

Per Scott's Build Process, this executive plan does not go straight to code. The next deliverable is ONE interactive HTML blueprint file, built from this plan, that Scott clicks through and reads before approving any build. It is not built in this docs phase; it comes back to Scott first.

The blueprint must show, at minimum:

1. **The page-connection flows, end to end, as clickable screens:**
   - Orbit to Planner: pick a real person in the event form, see the person chip on the event, see a derived birthday row in the Planner, and open the Orbit profile from both.
   - Person profile: Orbit history and linked Calendar events side by side, clearly labelled by source, with the next event called out.
   - Pre-hangout brief: from an event with a linked person, open the assembled brief and see the brief task appear, go stale on a profile update, and close on read.
   - Finance to Meal Plan: set the week's grocery budget in Finance (the $75 worked example), import a price snapshot, build the week in Meal Plan, and see the same planned figure appear in Finance next to actual spend, never blended with it.
2. **The meal-planner cascade, animated step by step:** saving one planned meal spawns its cook task (eating time minus recipe prep and cook time, 45-minute fallback shown), its prep task when the recipe needs advance prep, and the one weekly shopping task and list. Then show the edits cascading: dinner moved 18:00 to 19:00 moves the open tasks, a deleted meal retires its open tasks, and a completed task is never resurrected or duplicated.
3. **The gap watcher, live in the mock:** a week with unplanned days raises exactly one reminder titled "Meals not yet planned for the week" listing the unplanned days; planning or intentionally skipping the last gap clears it; deleting a meal reopens it as a new episode.
4. **The look of the key screens**, in the app's real type and layout rules (DM Sans, view first, forms only on an explicit action): the Planner event with person chips, the Meal Plan week with budget and cost coverage, the Finance grocery week section, the shopping list, a generated task with its source label, and the watcher reminder. Desktop and mobile arrangements both shown.
5. **The pseudocode hotspots, in plain language next to the screens they govern:** generated-task reconciliation (create missing, update open, retire stale, never touch completed), the two cost calculations (meal cost versus package-rounded planned grocery spend, with partial coverage labelled), watcher evaluation and fingerprint suppression, and Log as eaten (Food Log row first, plan marked cooked only on success).

**Gate rule:** no project generation, migration, or production write happens until Scott has seen the blueprint, understands it, and approves. His repo approvals ("go", "I approve") apply at this gate. Decisions in the SPEC-GAP list should be settled by or at the blueprint walkthrough, since several of them (cascade authority, watcher timing, defaults) are easiest to judge on screen.

**Completion document:** Scott's standing request for a completion record for this work is satisfied by the Build Process job report step: after the build round, a one-page job report (how it went, where the project is, where it needs improvement) is delivered and filed in heyscottybro Documents. No separate completion PDF is produced for this docs phase.

## Implementation record for this docs phase

- **Files changed:** `docs/features/connected-pages.md` only.
- **Application code changed:** none.
- **Migrations:** drafted in this document only; none created as a migration file and none run.
- **Production data:** none read through a live service and none written.
- **ACTIVE_WORK.md and WORKLOG.md:** not edited in this phase because another agent is concurrently writing the Brain Dump feature record and may touch those files. Adding Connected Pages to both is a follow-up for the implementation or coordination phase.
- **Existing working tree:** preserved. At inspection, the branch was `main` tracking `origin/main`, with pre-existing modifications to `AGENTS.md`, `src/components/TaskFormModal.jsx`, `src/pages/HomePage.jsx`, and `src/pages/admin/TaskDetailPage.jsx`, plus untracked `docs/features/task-priority-field.md` and `supabase/migrations/2026-10-18-task-priority.sql`. None of those files was changed by this docs phase.

## Validation

- **Automated:** Not run. This phase changes documentation only.
- **Code and schema inspection:** Completed against the files and records named in the current-behavior section.
- **Desktop visual check:** Not applicable to a feature design document and not run.
- **Mobile visual check:** Not applicable to a feature design document and not run.
- **Known limitations:** The external grocery dataset was not yet populated when inspected, so the importer contract must be rechecked against its final CSV or JSON shape before Phase 1 implementation. Orbit profile work spans the canonical Orbit repository, which was not changed or synchronized in this phase.

## Implementation record: Phase 0 + Phase 1 build (2026-10-22)

Built under Scott's 2026-10-22 "go on all items", using the SPEC-GAP recommended defaults. Commits on main: `357f95f` (Phase 0), `ce0f019` (Phase 1A/1B data layer), `a722a36` (Phase 1 UI + 1C/1D). Records commit follows.

**Phase 0, shipped:** `supabase/migrations/2026-10-22-connected-pages-foundations.sql` (reminders provenance columns + partial unique index on open generated tasks; `gap_watchers` with owner RLS and grants); `src/lib/cascades.js` (cook/prep/shopping desired-task builders, hashing, reconciliation diff); `src/lib/gapWatchers.js` (gap predicates, fingerprints, episode decisions); `src/api/generatedTasksApi.js` and `src/api/gapWatchersApi.js`; plannerApi carries provenance with the established missing-column fallbacks, and a manual edit of a generated task's title, date, or time detaches it (SPEC-GAP 4); event-type auto-tasks are stamped with the shared provenance (visible behavior unchanged). Library: reminders expose priority + provenance; gap_watchers registered read-only.

**Phase 1A, shipped:** price snapshot import (`src/lib/priceImport.js`: dataset CSV/JSON, capture date required, with-tax prices, per-row rejection reasons; `src/api/groceryPricesApi.js`: insert with rollback on failure, supersede only after success, confirmed ingredient matches). Structured recipe ingredients (`src/lib/recipeIngredients.js`: version 2 lines, unit-math-only legacy conversion, ambiguous lines become needs_review and are never priced; `src/api/recipesApi.js`).

**Phase 1B, shipped:** `src/api/mealPlanApi.js` (week plans/items, grocery week budgets, shopping sync preserving already-have/purchased states, Mark-week-ready snapshots superseding in place); `src/lib/mealPlanCost.js` (consumption cost vs whole-package planned spend, packages rounded once after weekly aggregation, partial coverage named); a Meal Plan tab in Health (`src/components/mealplan/MealPlanPanel.jsx`) and the Finance Grocery week card (`GroceryWeekCard.jsx`), both reading through the shared `useWeekCost` hook so the planned figure is identical on both surfaces.

**Phase 1C, shipped:** item saves, moves, skips, cancels, and deletes reconcile cook/prep tasks and the weekly shopping task through `mealPlanFollowThrough.js`; partial failure shows a Follow-through pending state with Retry. The meals watcher and grocery-budget watcher evaluate on Meal Plan and Finance loads and writes (v1 trigger model).

**Phase 1D, shipped:** Log as eaten opens the Food modal prefilled from the plan item (recipe title, slot, planned date, servings, per-serving macros scaled); the food row saves first with `recipe_id` + `meal_plan_item_id` (`healthApi.addFoodReturning`), and only then is the item marked cooked and its open cook task completed through the normal path. Deleting a linked food entry returns the item to planned.

**Migrations: APPLIED (verified 2026-10-23).** The "not applied" note that stood here was stale: a Supabase dashboard state check on 2026-10-23 found `reminders.priority`, the foundations tables (`gap_watchers`), and the Phase 1 tables (`meal_plans`) already present, and `2026-10-21-bin-items.sql` and `events.location` likewise. The same session applied the two files that were genuinely missing (`2026-10-03-exercise-library.sql`, `2026-10-23-event-people.sql`). Real-database verification of the scenario matrix is still outstanding; scripted results below are library-level.

**Scenario matrix, scripted results (library tests):** CP-11 pass (mealPlanCost: partial meal counts only priced lines, names the unpriced line); CP-12 pass (three meals aggregate before package rounding); CP-17 pass (cook at 17:00 for an 18:00 dinner with 15 prep + 45 cook); CP-18 pass (night-before prep at 20:00); CP-21 partial (reconciliation create/update/retire is idempotent at the diff level; the no-duplicates guarantee also rests on the partial unique index, database pending); CP-22 pass (a desired key existing only as completed is a conflict, never recreated); CP-23 pass (diff leaves detached rows alone; detach-on-edit wired in plannerApi); CP-24, CP-25, CP-28, CP-29, CP-30, CP-31, CP-33 pass (gapWatchers predicate + decision tests). CP-09/CP-10 partial (parser enforces capture date and reports per-row rejections; the import write path is database pending). CP-13, CP-14, CP-15, CP-16, CP-19, CP-20, CP-26, CP-27, CP-32, CP-38: implemented in code, untested against a real database. CP-01 to CP-08 and CP-34 to CP-37 belong to Phase 2/3 and were not built in this round.

**Decisions recorded during the build:** (1) A meal item's `advance_prep_kind` of `none` means "no override", so a recipe's prep profile cannot be cancelled per item in v1. (2) Watcher expiry retires (deletes) its open reminder rather than completing it, because Scott never acted on it. (3) "Food log removed" has no dedicated field; a deleted linked food entry returns the item to planned, and the removal itself is visible in the Food Log. (4) `docs/rebuild/live-schema.md` shows a pre-existing `reminders.priority` text column (default `none`, no check constraint); if that reflects production, the priority migration's `ADD COLUMN IF NOT EXISTS` will no-op and existing rows may carry `none`, which the form and badges ignore. Verify when applying.

**Validation:** `npm run lint` clean; `npm test` exit 0 (333-test main suite plus standalone suites: cascades 17, gapWatchers 12, recipeIngredients 24, priceImport 23, mealPlanCost 17, all passing); `npm run build` pass (pre-existing large-chunk advisory only). Signed-in rendered behavior is not verified (auth-gated from the build environment); live verification is by served-asset inspection after the push.

## Phase 2, slice 1: event people and event location (2026-10-23)

**Directive.** On 2026-10-23 Scott said: "I need calendar to allow for putting people in my orbit as attendees for an event, so a little indicator shows who's at an event", then: "put this in to heyscottybro, make the migrations yourself and add anything else that you've noticed is interfering with productivity". This is the approval for this slice and for applying its migration. It follows a same-day failure that motivates it: the 2026-10-24 Rena Adams event could not carry an attendee or a location because neither field exists.

**Scope.** (1) `event_people` link table and `events.location`, migration `supabase/migrations/2026-10-23-event-people.sql`. (2) EventForm People picker and Location field. (3) Attendee indicator (initial circles, full names on the day sheet) in Calendar (day sheet, upcoming list) and the Plan day list. (4) BUG-074 sidebar fix under the same instruction (the plan was presented 2026-10-22): the desktop rail expands to labelled navigation on hover or focus, a pin toggle locks it open. (5) Applying the already-approved but still-pending migrations when the dashboard session confirms they are missing (task priority, Bin, Connected Pages foundations and Phase 1, exercise library), because degraded surfaces are the other standing productivity interference.

**Non-goals for this slice.** Brief state, brief view/cascade/watcher, derived birthdays, the Orbit profile Calendar read model, person merge rewriting, and person-deletion cleanup of links beyond render tolerance. Those stay in Phase 2 as planned and need their own decisions.

**Contract.**
- A link is (event id, Orbit person id). Names are never copied onto the event or the link; every render resolves the id to the person's current Orbit name (CP-01, CP-02).
- The picker only ever links real Orbit people Scott explicitly taps. Search text never creates a person or a link (CP-04).
- Saving an event with the People field present replaces that event's link set. Editing an event through a path that does not supply people leaves links untouched.
- If the link write fails because `event_people` is not migrated yet, the event still saves, the failure logs loudly, and the user is told people were not attached. Any other link failure names the people step in its error (CP-06).
- Deleting an event deletes its links (foreign-key cascade). A link whose person no longer exists in Orbit is skipped at render.
- Location is one free-text field on the event, shown on the day sheet when set. Insert and update strip it and retry when the column is missing, the established pattern from `orbit_log_status`.

**Pseudocode.**

People picker (EventForm):
1. On mount, load Orbit people (id, name, group) through `peopleApi.loadPeople`. Seed the selection from `initial.attendees` (ids the parent loaded from `loadEventPeople`).
2. Selected people render as chips with remove buttons. A search input filters unselected people by name; results are buttons; activating one adds its id to the selection (a set, so no duplicates).
3. If the people load fails, show "People couldn't load" in place of the search; keep any seeded ids in the form values so a save cannot wipe existing links.
4. Submit values gain `attendees` (array of ids) and `location` (trimmed string, empty becomes null downstream).

Persistence (plannerApi):
1. `newEvent` inserts the event row (location included only when set; strip-and-retry on a missing location column), then replaces the event's links when `attendees` is an array.
2. `updateEvent` whitelists `location`; when `fields.attendees` is present it replaces links after the row update; when absent it never touches links.
3. `loadEventPeople` returns a map of event id to person ids, cached with the events tag so any event write refreshes it.
4. `deleteEvent` relies on the cascade; the local fallback removes cached links for the event.

Indicator (Calendar day sheet, Calendar upcoming list, Plan day list):
1. Resolve the event's person ids against the loaded people map; skip unknown ids.
2. Compact rows show up to three initial circles in per-person colours plus a "+N" circle; the accessible name and tooltip list every attendee's current name.
3. The day sheet shows name chips and, when set, a location line under the title.

Sidebar (BUG-074):
1. At widths above 900px the rail is 68px at rest. On hover or focus-within it widens to 232px over the content, revealing a text label beside every icon.
2. A pin toggle in the rail foot locks the expanded state; the shell's `--rail-w` becomes 232px so content shifts instead of being covered. The choice persists in localStorage.
3. At 900px and below nothing changes: the rail stays hidden and the phone bars remain the navigation.

**Tests.** `src/lib/attendees.test.js` (registered in the `npm test` chain) covers id normalization, resolution against a people map (a rename shows the new name without touching the link), unknown-id skipping, initials, and overflow counting. Lint, the full suite, and the production build must pass. Live verification is separate: apply the migration, tag Rena Adams on the 2026-10-24 event, and confirm the indicator renders signed-in.

**Implementation record (2026-10-23).** Built as recorded above with three refinements. (1) Link failures never throw after the event has saved: `saveEventPeople` returns a warning the caller toasts, naming the people step (CP-06's intent, without stranding a duplicate-prone form retry). (2) The picker is safe on every edit surface, not just seeded ones: EventForm loads an edited event's links itself when the caller did not supply them, and only sends `attendees` once the selection is seeded, loaded, or touched, so an uninvolved edit cannot wipe links. (3) The Plan surface renders its calendar through CalendarPage, so the indicator ships in the day sheet and upcoming list there; PlannerPage's own addition is surfacing the people warning on create. Migration `2026-10-23-event-people.sql` applied 2026-10-23 (dashboard state check: `event_people` present afterward; `events.location` was already present). BUG-074 shipped in the same change (see `docs/development/BUGS.md`).

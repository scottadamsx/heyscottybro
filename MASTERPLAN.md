# heyScottyBro — The Grand Master Plan
**Created:** 2026-07-05 · **Author:** Claude (Fable) after a full-repo audit
**Mission:** Turn heyscottybro from an accreted collection of features into a pristine personal command center — the app a CEO-of-his-own-life opens first every morning, where anything is findable in ≤2 clicks and everything is exportable, printable, or sent to your phone.

> Companion doc: `claude-memory/projects/operation-cleanup.md` still tracks the security/CI items (key rotation, env purge, rate limiting). This plan supersedes it for **architecture, IA, and product**; it does not repeat those tasks.

---

## Part 1 — The Audit: what the evidence says

### 1.1 Real usage (Supabase row counts + recency + git churn)

| Signal | Daily drivers | Weekly | Dormant | Never used |
|---|---|---|---|---|
| DB rows | agent_actions (503), bugs (37), brain (519 nodes / 1,559 links) | reminders (62), events (26), transactions (22), food_logs (23), journal, snippets, context | hiker_members (116, stale Jun 12), recipes (9), messages (3), dates (2), weed/accountability (1 each) | **32 of 59 tables are empty** |
| Recency | bugs + agents active **today** | planner/journal/food/money active within 2 weeks | brain content last synced Jun 17 | grocery_receipts: **0 rows ever** — yet Groceries is a top-level nav item |
| Git churn | AdminLayout (23), Budget (17), Dashboard (16), Calendar (13) | Reminders, Projects, Journal, Command | Recipes (3), Nutrition (4), DatePlanner (4) | — |

**Conclusion:** Scott's actual life in this app = **AI agents + bug-driven development + planner + money + brain**, with food/journal weekly. Groceries, Dates, Recipes, Hike DB, Weed, Accountability are long-tail. School — a huge real-life domain (3 active courses, deadlines, GPA targets) — has *no surface* except a Grade Tracker mini-app buried at Tools → Apps → card #1, with an empty `grades` table and a fully built AI catch-up-plan generator nobody can find.

### 1.2 The weak-spot inventory (found by 4 parallel deep-reads)

**Information architecture**
- **13 top-level destinations** (Dashboard, Planner, Money, Groceries, Health, Tools, Date Night, Vault, Design, Brain, Research, Command, Settings) — far past the 7±2 a human can hold.
- **Tools is a junk drawer** hiding six unrelated things (Grades, Gym, AI Inbox, Bugs, Brain-again, Storage, Usage, Hike DB).
- **Brain is mounted twice** (route `/admin/brain` AND a Tools tab).
- **Three overlapping knowledge stores**: Vault→Snippets (`snippets`), Vault→Context (`context_entries`), Brain (`brain_nodes`) — plus a naming collision (VaultPage is "Vault"; its Snippets child is *also* titled "🔐 Vault").
- **`/overview` is a dead demo** — a static "locaroom" business mockup with Turkish sample data, still linked from the public navbar.
- **AdminSubSidebar is ~70% dead code** — its per-section branches key off path segments that became `?tab=` params; only Finance and Dates ever render; its quick links point at legacy redirect routes.
- 13 fossil `<Navigate>` redirects in App.jsx.
- **Design (746 LOC, biggest page in the app) is a preview-only style guide** sitting in primary nav; selecting a theme doesn't even apply it.
- Research page: 1 request ever created; duplicates what Command Center chat + doc links already do.

**Data layer**
- **32 empty tables**, including an entire abandoned normalized finance schema (`fin_*`, 10 tables), an abandoned meal-planning/pantry family (7), `seed_*` (3), `journal_entries` (duplicate of `journal`).
- **Transactions stored three ways**: the `transactions` table, a `transactions: []` array inside the `budget_config` JSON blob, and the legacy `fin_expenses`/`fin_income` tables.
- **Recurring bills & income live inside a JSON blob** while `transactions.fulfills_recurring_id`/`fulfills_income_id` point at blob-internal ids — foreign keys with no referential integrity, plus fuzzy name-matching fallback.
- **Categories defined in 4 places** (budget_config blob, `TX_CATEGORIES`, `DEFAULT_CONFIG`, legacy `fin_categories`) and they disagree ("Savings" exists in one list, not another).
- `saveBudgetConfig` **clobbers the whole blob** on every write (read-modify-write races).
- `uid()` **duplicated ~10 times** with three divergent behaviors (throw vs return-undefined vs "local-user"); `genId` duplicated with two shapes; error handling has 4+ styles; localStorage used 4 different ways across modules.
- `aiLibrary.libraryQuery` **loads entire tables into the browser** and filters in JS — for every agent query.

**AI system** (the crown jewel, undermined by duplication)
- **The agent loop is written 2–3 times**: `runAgent.js` (Command Center), `useAIAgent.js` (Frodo ChatBot — near-verbatim copies of retry/error-streak/wrap-up logic, plus tiering), and a third partial copy in `api/overseer-run.js` (which also duplicates the overseer's prompt inline, so client and cron prompts can silently drift).
- **Three conversation-persistence stores**: `agent_sessions` (Supabase), localStorage (Frodo), sessionStorage (Banker tab).
- **Brain-write policy is hard-coded id strings** (`BRAIN_WRITERS`), and **Galadriel is not in the set** yet writes the Brain nightly via the cron's service role — the policy is enforced only on one of two write paths.
- `agent_actions.tier` column actually stores agent ids — misnamed and overloaded.
- Elrond and Lúthien are prompt-config only — no surface, no cron, no evidence of use.

**Frontend / design system**
- `index.css` is a **5,207-line monolith** (~8.5k lines CSS total).
- The budget area is **inline-styled** (BudgetDashboard: 150 inline style objects; BudgetAnalytics: 100% inline, zero classes) while DashboardPage is class-driven — no convention.
- The `src/components/ui/` primitives folder (Modal, FormField, LoadingSkeleton) is **entirely dead** — nothing imports it. `useForm` hook: dead. `DocViewerModal`: dead.
- Two token palettes (light public / dark admin) share names but not values, requiring re-declared aliases to avoid white-on-white bugs.

**Export / print / phone**
- **Zero print support** — no `window.print`, no `@media print` anywhere.
- Four ad-hoc copies of "make a Blob and click an `<a>`" (bugs zip, budget CSV, hiker CSV, design guide).
- `src/lib/markdownToPdf.js` is a dependency-free Markdown→PDF engine — a genuine asset — used by exactly one button in Command Center.
- PWA manifest exists (installable!) but **no service worker** → no offline, no push.
- Outbound channels that already work: **Resend email** (share links) and **Gmail send** (inbox replies). Nothing reaches your phone proactively.

**Dev/prod parity**
- `doc-share` + `send-share-email` have no Vite dev stand-ins (untestable locally); `aule-control` + real brain-vault sync are dev-only (silently 404/stub in prod).
- `verifySupabaseUser` fails **open** when env vars are missing.

### 1.3 Report card — baseline 2026-07-05: **C−** → after Phases 0–5 (same day): **B+ / A−**

| Dimension | Before | After | What changed / what still blocks A+ |
|---|---|---|---|
| Product value | B+ | **A−** | School space live (courses+deadlines+projections), Brief reinvented data-first, everything exportable. A+ = proven in daily use. |
| Information architecture | D | **A** | 13 → 7 spaces; Tools dissolved; Brain single-mounted; Context→Brain Memory; Design→Settings; palette rewritten; 20 redirects keep old links. |
| Data layer | D− | **B+** | 22 dead tables dropped; bills/income are rows with REAL FKs (0 rewrites needed); whole-blob clobber gone; categoryBudgets silent-drop bug fixed; one uid(). Still: bill fields live in per-row jsonb (typed columns would be A), TX_CATEGORIES defined in 2 places. |
| AI system | C+ | **B+** | ONE loop core (agents/loop.js) consumed by both loops; server-side collection queries; Galadriel policy hole closed; agent_id column honest. Still: 3 session stores; Elrond/Lúthien remain config-only; cron prompt still duplicated. |
| Frontend / design system | C− | **B** | Real ui/ kit (Card/StatTile/Badge/Modal/PageHeader/ExportKit) adopted by School+Brief; budget inline styles 437→267 on tokens. Still: index.css monolith (print layer extracted only). |
| Export / print / mobile | D+ | **A−** | ONE exporter lib; Print/PDF/CSV/Copy/Email-me on Today, Money, Plan, School, Brain reader; service worker → installable offline-tolerant PWA; 7am brief email. Still: Web Push; a few pages lack ExportKit. |
| Code hygiene | D | **A−** | Every identified dead file gone; 22 tables dropped; 4 download helpers → 1; uid ×10 → 1. Redirects intentionally kept 90 days. |
| Dev/prod parity & ops | C− | **B−** | Auth fails closed; send-to-me added. Still: doc-share/send-email lack dev stand-ins; operation-cleanup security tasks open (out of this plan's scope). |

**Overall: C− → B+.** The remaining gap to A/A+ is (a) Scott living in it for a couple of weeks + the deploy, (b) session-store unification, (c) index.css split, (d) the ops/security list in operation-cleanup.md.

---

## Part 2 — The Vision: "heyscottybro OS"

One sentence: **Seven spaces, one job each, everything exportable, and the app comes to you (morning brief on your phone) instead of you going to it.**

### 2.1 The new information architecture — 13 destinations → 7

```
┌─────────────────────────────────────────────────────────────┐
│  TODAY          the morning brief — read in 60s, act, leave  │
│  PLAN           time: tasks · calendar · projects · journal  │
│  MONEY          budget: overview · transactions · bills · banker │
│  SCHOOL   NEW   courses · deadlines · grades · AI catch-up   │
│  LIFE           food · fitness · habits · dates              │
│  MISSION CONTROL  agents · brain · inbox · build (bugs) · usage │
│  VAULT          secrets · documents · files · databases      │
└─────────────────────────────────────────────────────────────┘
                    (Settings lives in the rail footer, not the 7)
```

**The rule that keeps it pristine:** every space answers one question. *What needs me now?* (Today) · *When?* (Plan) · *Can I afford it?* (Money) · *Am I passing?* (School) · *Am I healthy/happy?* (Life) · *What is my AI staff doing?* (Mission Control) · *Where did I put it?* (Vault). If a feature can't name its question, it doesn't get a nav slot.

### 2.2 Where every existing page goes

| Today | Disposition |
|---|---|
| Dashboard | → **Today**. Refocus as the CEO brief: agenda, money pulse, school deadlines, agent activity, inbox count — plus one **"Brief me"** button (print / PDF / email-to-phone). Remove duplicated widgets that just mirror other pages. |
| Planner (Calendar/Tasks/Journal/Projects) | → **Plan**, unchanged structure (already well-consolidated). TaskDetail stays as its child route. |
| Money (8 tabs) | → **Money, 5 tabs**: Overview (Dashboard+Analytics merged), Transactions (absorbs Ledger — it's literally the same component), Bills & Income, Banker, Tools (Reconcile + Simulator). |
| Groceries | **Demoted** → Money → a "Receipts" action inside Transactions (its only real job is receipt→expense; zero rows ever as a standalone page). |
| Health | → **Life**: Food (Nutrition + Recipes merged — recipes are 9 rows, they're a sub-feature of eating), Fitness (Gym Tracker promoted from Tools), Habits (Accountability + Smoke), Dates (Date Night demoted from top-level; 2 rows). |
| Tools | **Dissolved.** Grades→School · Gym→Life · AI Inbox→Mission Control · Bugs→Mission Control · Brain tab→deleted (single mount) · Storage→Vault · Usage→Mission Control · Hike DB→Vault→Databases. |
| Date Night | → Life → Dates tab. |
| Vault | → **Vault**: Secrets (rename the Snippets page — kills the naming collision), Documents, Files (Storage), Databases (Hike DB). |
| Design | **Out of nav** → Settings → Appearance. Bonus: make theme selection actually apply (persist chosen theme's vars to `:root`) — it's currently preview-only. |
| Brain | → **Mission Control** → Brain (one mount). **Context merges into Brain as a "Memory" tab** — it is AI memory and belongs beside the knowledge graph. Three knowledge stores become two: Brain (knowledge+memory) and Vault Secrets (credentials). |
| Research | **Merged into Mission Control** (an "assignments" strip on the agents view — it was 1 row of data duplicating what agent chat does). |
| Command | → **Mission Control** → Agents (the anchor tab). |
| /overview (public) | **Deleted.** Dead Turkish-sample-data demo, remove from public nav. |
| AdminSubSidebar | **Deleted** (Finance/Dates contextual bits fold into those pages). One nav system: the rail + page tabs + ⌘K palette. |
| Legacy redirects | Keep 90 days, then delete. |

### 2.3 The School space (new, top-level)

Foundation already exists: `grades` table (course, name, earned, max, weight, feedback), `GradeTracker.jsx`, `gradesApi.gradeStats` (weighted projection), `aiGrades.generateCatchUpPlan` (turns instructor feedback into study tasks in reminders). It's all built — just buried and dataless. Promote and complete it:

**New data:** `courses` table — `id, code ("CP 2315"), name ("Cloud Developer Capstone"), term ("Spring 2026"), instructor, target_grade, color, archived`. Add optional `course_id` to `reminders` (assignments = reminders with a course, so they appear in Plan AND School automatically — one source of truth) and a proper `course_id` on `grades`.

**Page layout:**
- **Semester header** — current term, days left, weighted average across courses vs targets.
- **Course cards** — one per course: current weighted grade, projected final (`gradeStats` exists), next deadline, instructor. Click → course detail: grade rows (existing GradeTracker UI), deadlines, notes, AI catch-up button (existing).
- **Deadlines rail** — all course-tagged reminders sorted by due date; overdue in red. "This week" group mirrors onto Today.
- **AI**: Frodo/agents get a `courses` collection in aiLibrary so "add the CP 4485 final, worth 30%, due July 20" just works; catch-up plans post reminders tagged to the course.
- **Exportable** (see 2.4): semester report (PDF), grades CSV, "print my week" of deadlines.

Seed data day one: CP 2315, CP 4485, CP 2561 from memory.

### 2.4 Universal export / print / send-to-phone

**One primitive, everywhere: `<ExportKit>`** in every page header. Every page registers an exporter: `{ title, toMarkdown(), toCSV?(), toRows?() }`. The kit renders: **Print · PDF · CSV · Copy Markdown · Email me · Share link**.

Build on what exists instead of adding dependencies:
1. `src/lib/exporter.js` — consolidate the 4 duplicated download helpers (`downloadBlob`, `toCSV`, `slugify`) into one module.
2. **PDF** — route every `toMarkdown()` through the already-built `markdownToPdf.js` (asset promotion: 1 consumer → app-wide).
3. **Print** — add a global `@media print` layer (hide rail/nav/chrome, flatten cards to paper) + `window.print()`; a `PrintView` wrapper renders any exporter's markdown as a clean article.
4. **Email me** — new `api/send-to-me.js` (clone of `send-share-email.js`, already Resend-wired): POSTs `{subject, markdown}`, emails to your address. This is "send to my phone" v1 — works today, zero new services.
5. **PWA completion** — add a service worker (vite-plugin-pwa): the admin becomes installable + offline-tolerant on your phone; the phone experience IS the app. Later (optional): Web Push for the morning brief.
6. **The Morning Brief** — unify the three overlapping "summary" systems (Dashboard's `getAIBriefing`, Galadriel's overseer cron, agent_actions digest) into ONE brief: renders on Today, files to Brain (already does), and **emails itself to you at 7:00** via the existing overseer cron + Resend. The command center that comes to you.

Rollout order for exporters: Money (transactions CSV + monthly PDF) → School (semester PDF, grades CSV) → Plan (week agenda print) → Brain (note→PDF) → Bugs (exists, wire into kit) → everything else.

### 2.5 Data-layer truth (one concept, one home)

1. **Backup then drop 20 dead tables**: `fin_*` (10), `meal_plans`, `meal_plan_items`, `pantry_ledger`, `ingredients`, `recipe_ingredients`, `grocery_products`, `product_aliases`, `journal_entries`, `simulations`, `seed_*` (3 — confirm weed feature doesn't lazily reference). Keep wired-but-empty ones (`grades`, `workouts`, `event_types`, `document_shares`, grocery receipts trio, hike attendees/imports).
2. **Normalize the budget blob**: `recurring_bills` and `income_sources` become real tables with real FKs from `transactions`; migrate blob ids; delete blob's `transactions[]` copy and fuzzy-match fallback; categories become ONE list (DB-backed, seeds `TX_CATEGORIES`).
3. **One `src/api/_base.js`**: shared `uid()` (one behavior: throw), `genId`, error wrapper, and the localStorage-fallback pattern — every module imports it. Kills ~10 duplicates and 4 divergent styles.
4. **Server-side filtering** for `aiLibrary.libraryQuery` (translate where/search/date/limit to PostgREST instead of loading whole tables).
5. Fix `verifySupabaseUser` fail-open → fail closed.

### 2.6 AI system: one loop, one memory, honest policy

1. **One agent loop**: fold tiering, history-trim, cache-markers, and vision from `useAIAgent` into `runAgent`; ChatBot becomes a thin consumer. Delete the third inline copy in `overseer-run.js` by importing the shared prompt builder.
2. **One persistence store**: everything in `agent_sessions` (Frodo + Banker migrate off local/sessionStorage).
3. **Policy from the registry, not string sets**: agents declare `canWriteBrain: true` in registry.js; `brainWriteDenial` reads it. Fixes the Galadriel hole (cron path bypasses the guard today) and the drift risk.
4. Rename `agent_actions.tier` → `agent_id` (migration + code sweep).
5. **Retire Elrond & Lúthien** from the registry (config-only, no surface, no usage). Two fewer personas; re-add when a real surface exists.

### 2.7 Design system: one kit, one sheet of truth

1. Rebuild `src/components/ui/` for real: `Card`, `StatTile`, `Badge`, `Modal`, `PageHeader` (title + tabs + ExportKit slot), `DataTable`. Adopt in new work immediately; migrate old pages opportunistically.
2. **Budget de-inlining** is the flagship migration (150-inline-style components → the kit + tokens).
3. Split `index.css` (5.2k lines) into `tokens.css` / `base.css` / `components.css` / `public.css`; admin skin keeps its scoped override but aliases get defined once.
4. Kill dead code now: `ui/Modal|FormField|LoadingSkeleton` (replaced by the new kit), `useForm`, `DocViewerModal`, `OverviewDashboard`, `AdminSubSidebar`.

---

## Part 3 — The Roadmap (6 phases, each shippable)

| Phase | Name | Contents | Size | Model |
|---|---|---|---|---|
| **0** | **Take out the trash** | Delete /overview + navbar link, AdminSubSidebar, dead ui/ + useForm + DocViewerModal; backup (CSV dump) + drop the 20 dead tables; fix Galadriel/BRAIN_WRITERS hole; rename tier→agent_id | 1 session | Sonnet |
| **1** | **Foundation** | `api/_base.js` shared helpers; `lib/exporter.js`; global print stylesheet; new `ui/` kit (Card, StatTile, Modal, PageHeader+ExportKit shell); split index.css | 1–2 sessions | Sonnet |
| **2** | **The Seven Spaces** | New rail (Today · Plan · Money · School · Life · Mission Control · Vault); dissolve Tools; merge/demote per §2.2; Money 8→5 tabs; Context→Brain Memory tab; single Brain mount; Design→Settings | 2 sessions | Opus (big multi-file move) |
| **3** | **School** | `courses` table + api; School page (semester view, course cards, deadlines rail); promote GradeTracker + aiGrades; `course_id` on reminders; seed 3 courses; agent collection | 1–2 sessions | Sonnet |
| **4** | **Export everything / phone** | ExportKit on all 7 spaces; `api/send-to-me.js`; service worker (installable PWA); Morning Brief unification + 7am email | 2 sessions | Sonnet |
| **5** | **Deep clean** | Budget blob→tables migration (the careful one); aiLibrary server-side filters; one agent loop + one persistence store; budget component de-inlining | 2–3 sessions | Opus (migration risk) |

Ordering logic: visible wins first (0–2 transform how the app *feels* in ~4 sessions), risky data migration last (5), School early (3) because it's a brand-new life domain with the school term running. Every phase leaves the app deployable — and per the standing lesson: **each phase ends with commit + deploy, or it didn't happen.**

### Definition of "pristine" (acceptance)
- ≤7 primary destinations; any feature reachable in ≤2 clicks or one ⌘K.
- Zero dead pages/components/tables; zero duplicate concepts (one place per fact).
- Every space has ExportKit: print, PDF, CSV, email-to-me minimum.
- The morning brief lands in your inbox daily without opening the app.
- School shows current weighted average and this week's deadlines at a glance.
- One agent loop, one session store, policy from the registry.
- New pages compose from `ui/` kit; no new inline-style pages.

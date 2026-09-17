# heyScottyBro: the current system, for the rebuild

**Snapshot:** 2026-09-16, `main` at `2aea5c8`. Live Supabase project `mogoybejtmkoheqvfvuc`.

**Who this is for:** Scotty, and the DEVRULES FULL session that designs the new heyScottyBro. It describes what exists today, what data is live, and what should not be carried forward.

**Companion file:** [live-schema.md](live-schema.md) lists every live table and column with row counts, read from the database on 2026-09-16.

**How this was checked.** Every claim was read from code, SQL or the live database. The live database was read with read-only calls only:
- the schema description;
- a row count per table;
- the Storage bucket list;
- the number of sign-in users.

Nothing was written. Anything marked *inferred* comes from code with no SQL behind it.

---

## 1. The system in one page

- **What it is:** Scott's personal command centre. It is a React 18 + Vite single-page app with plain CSS, backed by Supabase (Postgres, Auth, Storage) and hosted on Vercel (static site, serverless `api/*.js`, two crons).
- **AI agents:** a group of agents (the "Fellowship") reads and writes most of the data through one generic data layer (the Library) and one tool belt.
- **Spaces, as the sidebar shows them:**
  - Today
  - Plan (with Reminders and Work log)
  - Money
  - School
  - Life (Journal, Habits, Arcade)
  - Mission Control (Agents, Brain, Inbox, Build, Research, Usage)
  - Vault (Secrets, Documents, Files, Databases)
  - Settings
- **Public site:** `/` is a Windows-XP-style landing page (Hike Club, Lift Club, myBackyard). It also has project pages, a games hub, an "build an app with AI" guide, and public document share links (`/doc/:token`).
- **Users:** a single user. The live project has **1 sign-in user** (email provider).
- **Removed on 2026-09-16:** food, recipes, fitness and weight moved to Achilles (DR-015), and the Smoke tracker was removed (DR-016). Their tables and data are still in the database.

### Numbers that matter

| Thing | Value |
|---|---|
| Live tables/views in the Supabase project | 60, of which 27 belong to **Calendula** (same project, `calendula_*`) |
| Largest data sets | `agent_actions` 766 · `brain_links` 1,585 · `brain_nodes` 533 · `reminders` 134 · `hiker_members` 116 · `events` 68 · `bugs` 55 |
| Storage buckets | `documents` (50 MB limit), `receipts`, `nutrition`, `bug-screenshots` (all private) |
| Serverless endpoints | 11 committed, plus 1 untracked (`api/kiwi-tasks.js`) |
| Tests | 10 test files, plain `node` / `node --test`, logic only (no UI tests) |
| Decision ledger | `ledger.jsonl`, DR-000 … DR-016 (the rebuild continues at **DR-017**) |

---

## 2. Data inventory: every live table

Rows are live counts. "Owner in new system" follows Scotty's 2026-09-16 direction:
- **Calendula** owns tasks and events.
- **Orbit** owns people.
- **Achilles** owns food, gym and weight.
- **ExplorerPro** owns files.
- **Vault** and **Brain** are retired.
- **Command Center** is deleted.

These owner assignments are a **proposal** for the Frame and architecture phases, not a ledger decision.

### 2.1 heyScottyBro tables in use

| Table | Rows | What it holds | Proposed owner in new system |
|---|---|---|---|
| `reminders` | 134 | Tasks, including recurring tasks, school deadlines and event auto-tasks | Calendula (tasks) |
| `events` | 68 | Calendar events: multi-day, timed, recurring | Calendula (events) |
| `event_types` | 3 | Event templates with `auto_tasks` (prep tasks created at event date + offset) | heyScottyBro (prep logic) or Calendula |
| `projects` | 8 | Projects, nestable through `parent_id` | heyScottyBro (goals/plans) |
| `initiatives` | 2 | Recurring intents under a project | heyScottyBro (goals) |
| `journal` | 22 | Journal entries | heyScottyBro (insight source) |
| `accountability_state` | 1 | **Blob:** every habit tracker, log and miss | Open question (habits) |
| `work_log` | 26 | Daily work log, including mirrored habit completions | Open question |
| `transactions` | **0** | Money ledger (wiped at Scott's request 2026-09-14; backup in Drive) | Open question (money) |
| `budget_config` | 1 | Budget settings (categories, pay schedule, balance, envelopes, goals, simulations) | Open question (money) |
| `recurring_bills` | 11 | One bill per row, payload in `data` jsonb | Open question (money) |
| `income_sources` | 1 | One income source per row, payload in `data` jsonb | Open question (money) |
| `grocery_stores` / `grocery_receipts` / `grocery_receipt_items` | 0 / 0 / 0 | Receipt scanner (Money › Receipts) | Open question (money) |
| `courses` | 3 | School courses | Open question (school) |
| `grades` | 4 | Graded assessments per course | Open question (school) |
| `context_entries` | 35 | Frodo's memory facts about Scott | heyScottyBro (insight) |
| `brain_nodes` / `brain_links` | 533 / 1,585 | Knowledge graph, mostly synced from the Drive `claude-memory` vault | **Retire** (the vault on Drive is the source) |
| `doc_links` | 3 | Attaches a Brain note or a document to any item | Retire with Brain/Vault |
| `documents` / `document_shares` | 4 / 0 | Uploaded files and public share tokens | ExplorerPro / retire |
| `snippets` | 7 | Vault secrets and snippets (passwords, wifi, cards, notes) | **Retire; export first** (sensitive) |
| `hiker_members` / `hiker_imports` / `hike_attendees` | 116 / 0 / 0 | St. John's Hike Club member database | **PII.** Orbit, or an SJHC tool; not heyScottyBro |
| `messages` | 3 | AI Inbox (Gmail sync, drafts, replies) | Open question |
| `bugs` | 55 | In-app bug and feature tracker, with screenshots | Rebuild tooling |
| `research_requests` | 1 | Research tasks assigned to agents | Retire with Command Center |
| `agent_actions` | 766 | Audit log of every agent tool call | heyScottyBro (keep the pattern) |
| `agent_sessions` | 2 | Saved chat threads | heyScottyBro |

### 2.2 Tables with no code, data kept

| Table | Rows | Note |
|---|---|---|
| `nutrition_profiles` | 1 | For Achilles (DR-015). Scott's profile only. |
| `food_logs` | 27 | For Achilles |
| `weight_logs` | 3 | For Achilles. Stored in **kg**; the old UI showed lb. |
| `workouts` | 3 | For Achilles. Weight in **lb**. |
| `recipes` | 26 | For Achilles |
| `weed_state` | 1 | Smoke tracker blob (DR-016). Kept until Scott confirms deletion and a backup is saved. |
| `date_ideas` / `date_completed` | 0 / 0 | Old Dates tab, removed. Empty; safe to drop. |

### 2.3 In the repo's SQL but **not** in the live database
These should be treated as dead designs:
- `fin_settings`, `fin_categories`, `fin_income`, `fin_recurring_bills`, `fin_bill_instances`, `fin_expenses`, `fin_savings_goals`, `fin_savings_allocations`, `fin_debts`, `fin_debt_payments`, and their RPCs;
- `ingredients`, `grocery_products`, `product_aliases`, `pantry_ledger`, `recipe_ingredients`, `meal_plans`, `meal_plan_items`.

### 2.4 Calendula tables in the same project
There are 27 tables prefixed `calendula_`. Notable row counts:
- `calendula_schedule_runs` 69, `calendula_placements` 60, `calendula_chat_messages` 44
- `calendula_tasks` 6, `calendula_fixed_blocks` 6
- `calendula_reminders` 3, `calendula_habits` 1
- plus `_calendula_migrations`

Calendula keeps **its own** tasks, reminders and habits, separate from heyScottyBro's `reminders` and habit blob. **There are two task stores and two habit stores today.** The rebuild must pick one owner for each (see §10).

### 2.5 Storage and auth
- **Storage buckets:** all private, and each path must start with the user's id.

| Bucket | Size limit | Path pattern |
|---|---|---|
| `documents` | 50 MB | `<uid>/<docId>/<safeName>` |
| `bug-screenshots` | 20 MB live (10 MB in SQL) | `<uid>/<bugId>/<ts>-<rand>.<ext>`; chat-staged files under `<uid>/_staging/…` |
| `receipts` | 10 MB | `<uid>/<receiptId>.<ext>` |
| `nutrition` | 10 MB | `<uid>/<profileId>/<uuid>.<ext>` (for Achilles) |

- **Auth:**
  - Supabase email/password. The login page also shows "Continue with Google", but that provider is **disabled** in the project (noted 2026-09-13), so the button returns 400.
  - The app never calls `signUp`. Whether the project itself allows sign-ups is a dashboard setting; see §9.
  - There is 1 user.

---

## 3. Table details (columns that carry meaning)

Unless noted, every table has:
- `id uuid PK default gen_random_uuid()`;
- `user_id uuid → auth.users ON DELETE CASCADE`;
- `created_at timestamptz`;
- the RLS policy "owner only" (`auth.uid() = user_id`).

The full live column list is in [live-schema.md](live-schema.md).

### Tasks and calendar
- **`reminders`**
  - Columns: `name`, `date` (nullable; null = Anytime), `time` (TIME), `description`, `recurrence` (`none|daily|weekly|monthly`), `recur_until` (inclusive), `recur_times` (total occurrences from the series start), `completed`, `completed_date`, `show_on_calendar` (default true), `project_id` (→ projects, SET NULL), `course_id` (→ courses), `event_id` (→ events, CASCADE; live).
  - `priority` and `sort_order` are live but no longer written.
  - **`duration_min` is not live.** The migration `supabase/migrations/2026-09-14-reminder-duration.sql` was never run. The app saves the day and time without it and warns.
  - **Recurring completion:** `completed_date` moves forward to each finished occurrence. `completed` becomes true only when the series is used up.
- **`events`**
  - Columns: `title`, `date`, `end_date` (inclusive, CHECK ≥ date), `start_time` / `end_time` (TIME; null start = all-day), `description`, `project_id`, `event_type_id`, `recurrence`, `recur_until`, `recur_times`.
  - Legacy and unused: `time`, `cost`, `location`, `all_day`.
  - Recurrence is ignored for multi-day events.
- **`event_types`**
  - Columns: `name`, `color`, `auto_tasks` jsonb `[{offset_days, name}]`.
  - When an event of that type is created, one task is made per auto-task: `"<task> — <event title>"`, dated event date + offset, with `event_id` set.
  - This is the existing "prep" mechanism.
- **`projects`:** `name`, `description`, `color`, `archived`, `due_date`, `sort_order`, `parent_id` (CASCADE). Deleting a project deletes its sub-projects and their tasks and events.
- **`initiatives`:** `project_id` (CASCADE), `name`, `description`, `recurrence` (a label only, never expanded), `active`.
- **`work_log`:** `date`, `task`, `notes`, `project_id`, `minutes`. Habit completions are mirrored here as `notes = "habit:<trackerId>"`.

### Journal and memory
- **`journal`:** `title`, `entry`, `date`, `mood`, `tags text[]`.
  - **Bug:** `mood` and `tags` are never saved. The API accepts them from agents and then drops them.
- **`context_entries`:** `text`, `tags` jsonb, `by` (`manual|frodo|scott`, plus a legacy `maria` value), `why`, `ts` (epoch ms).
  - These are plain facts. The planned "learning" model (DR-006: belief update + decay) was **never built**.

### Habits: the `accountability_state` blob
One row per user. Column `state` jsonb, schema **2** (`src/api/accountabilityApi.js`):
```js
{
  schema: 2,
  version: int,                       // optimistic-concurrency counter
  trackers: [{ id, name, emoji, color, mode: "check"|"count", created: "YYYY-MM-DD",
               schedule?: { schema: 1, kind: "none"|"interval", every: 1..365,
                            unit: "days"|"weeks", startDate: "YYYY-MM-DD" } }],
  logs:   [{ id, trackerId, date, at /* epoch ms */ }],  // count mode: one per tap
  misses: [{ id, trackerId, date, at }]                  // "Missed it" (DR-014)
}
```
- **Validation:** `normalize()` upgrades schema 0 and 1 and **throws** on anything it doesn't recognise (QF-3).
- **Writes:** `updateAccountability(mutator)` works like this:
  1. load the row fresh;
  2. apply the change to a copy;
  3. write only if `state->>version` still matches;
  4. on a conflict, retry once; a second conflict throws.
- **Rules:**
  - A miss is never a log.
  - Logging a day clears that day's miss.
  - A day that is already logged can't be marked missed.
  - The next due date counts from the latest log **or** miss.
  - Check-mode trackers with no schedule are due daily; count-mode trackers are never due.
- **Known gap:** deleting a tracker from the page leaves its misses behind. The agent delete path removes them.

### Money
- **`transactions`**
  - Columns: `description`, `amount` NUMERIC(10,2) **signed dollars** (expense, future and savings are negative; income is positive), `type` (`expense|income|future|savings`), `category`, `date`, `notes`, `is_bill`, `reconciled`, `fulfills_recurring_id` / `fulfills_income_id` (text ids with no foreign key).
  - The UI works with absolute values plus the type.
- **`budget_config`** (one row per user)
  - In use: `categories`, `tax_rate` (a fraction, stored but not used in any calculation), `starting_balance` (dollars), `pay_schedule` `{type, anchorDate, customDays}`, `simulations`, `category_budgets` `{category: amount}`, `savings_goals` `[{id, name, target, targetDate, saved}]`.
  - **Legacy and no longer written:** `income_sources`, `recurring_bills` and `transactions` jsonb columns.
  - No schema version and no concurrency check; the last writer wins.
- **`recurring_bills` / `income_sources`** (tables)
  - Columns: `id text` (mixed id formats: `rb-<uuid>`, 8-character ids, legacy `"rent"`), `user_id`, `data` jsonb.
  - Bill payload: `{name, amount, category, frequency: monthly|weekly|biweekly|yearly, startDate, autoPay, variable, notes, dueDay?, endDate?}`.
  - Income payload: `{name, amount, frequency, startDate, endDate, notes?}`.
  - **Money is stored as floating-point dollars everywhere, which breaks QF-4 (integer cents).**
- **Grocery tables:**
  - `grocery_receipts`: `store_id`, `purchase_date`, `subtotal`, `total`, `image_path`.
  - `grocery_receipt_items`: `receipt_id`, `raw_text`, `quantity`, `unit_price`, `total_price`.

### School
- **`courses`:** `code`, `name`, `term`, `instructor`, `target_grade`, `color`, `archived`. There is no SQL in the repo; the live table matches the code.
- **`grades`:** `course_id`, `course` (text), `name`, `earned` (null until graded), `max`, `weight` (% of the final mark), `feedback`, `sort_order`.
- **Grade maths:**
  - current % = Σ(earned/max × weight) / Σweight over graded rows;
  - projected final = graded points + current % × remaining weight, capped at 100.

### Agents and knowledge
- **`agent_actions`:** `agent_id`, `tool`, `collection`, `item_id`, `args` jsonb, `status` (`ok|error`), `error`, `created_at`.
- **`agent_sessions`:** `agent_id` (`frodo`, or `<agent>:cc` for Command Center threads), `display` jsonb (images replaced by a count), `convo` jsonb (Anthropic messages, trimmed to 60,000 characters). Unique on (user_id, agent_id).
- **`brain_nodes`:** `slug` (unique per user), `title`, `body` (vault sync caps it at 4,000 characters), `type` (`root|projects|checkpoints|procedures|note`), `tags text[]`, `source` (`vault`, `manual`, or an agent id).
- **`brain_links`:** `source_slug` → `target_slug`, joined by slug with no foreign key.
- **`doc_links`:** `entity_type` (reminder, event, project, initiative, agent, research), `entity_id` text, and **exactly one** of `node_slug` / `document_id`; plus `read` and `read_at`.
- **`research_requests`:** `title`, `details`, `assignee` (an agent id), `status` (`open|in_progress|delivered|archived`).

### Vault, documents, inbox, bugs, hikers
- **`snippets`:** `title`, `value`, `type` (`code|password|wifi|card|note|prompt|other`), `secret` (default true), `notes`, `updated_at` (trigger). **This table contains real secrets.**
- **`documents`:** `name`, `filename`, `storage_path`, `mime_type`, `size_bytes`, `description`, `tags text[]`.
- **`document_shares`:** `token` (64 hex characters), `expires_at`, `revoked`, `access_count`. Resolved server-side with the service role.
- **`messages`:**
  - Columns: `channel` (`manual|email|slack|discord`), `sender`, `subject`, `body`, `draft`, `status` (`needs_reply|drafted|replied|archived`), `flagged`, `read`, `external_id` (Gmail id, unique per user), `thread_id`.
- **`bugs`:**
  - Columns: `type` (`bug|feature`), `title`, `description`, `steps`, `page`, `priority` (`low|medium|high|critical`), `status` (`open|in_progress|resolved|closed`), `notes`, `resolved_at`, `screenshots` jsonb (storage paths).
- **`hiker_members`:** `first`, `last`, `email`, `phone`, `attendance`, `joined_date`. Unique on (user, first, last).
- **`hiker_imports`:** `filename`, `imported_at` (**DATE**, although the code writes a full timestamp), `hike_name`, `hike_date`, plus counts.
- **`hike_attendees`:** `hike_import_id`, `member_id`. It has no `user_id`; access is checked through the import's owner.

### Removed domains (data kept for Achilles and for the record)
- **`nutrition_profiles`:** `sex`, `height_cm`, `birth_year`, `activity_level`, `goal`, `target_calories`, `start_weight_kg`, `goal_weight_kg`.
- **`food_logs`:** `profile_id`, `date`, `meal_type`, `name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `quantity`, `source` (`manual|ai|photo|recipe`), `image_path`, `items` jsonb `[{name, quantity, calories, protein_g, carbs_g, fat_g}]`, `recipe_id`.
- **`weight_logs`:** `profile_id`, `date` (unique per profile), `weight_kg`, `note`.
- **`workouts`:** `date`, `exercise`, `weight` (lb), `reps`, `sets`, `notes`.
- **`recipes`:** `title`, `servings`, `prep_minutes`, `cook_minutes`, `ingredients` jsonb `[{item, quantity}]`, `steps` jsonb `string[]`, per-serving macros, `tags`, `favorite`, `source`, `image_path`.
- **`weed_state.state`** (schema 1):
  - `{sharedDailyCapG, penGramEquiv, scott: {taperEnabled, taperStart, logs: [{id, ts, type: joint|pen, grams, penHits?}]}}`.
  - The live row may still hold schema-0 keys.

---

## 4. How values are represented

| Kind | Current convention | Problem for the rebuild |
|---|---|---|
| Money | NUMERIC or JS float **dollars**; transactions signed | Breaks QF-4. Use integer cents. |
| Calendar day | `"YYYY-MM-DD"` local day (America/St_Johns), built with `toDateStr()`; the cron uses the **UTC** day | Pick one time zone rule. |
| Clock time | Postgres TIME, written `"HH:MM"`, read back `"HH:MM:SS"` | |
| Timestamps | timestamptz ISO strings; blobs use epoch ms | Mixed |
| Duration | minutes (`duration_min`, `work_log.minutes`); default task length 30 min, event 60 min | |
| Weight | kg in `weight_logs`, lb in `workouts` | Mixed units |
| Ids | DB UUIDs; plus 8-character, `rb-`/`inc-`, `loc-`, `a-` client ids; brain notes keyed by slug; kiwi-tasks ids = sha256(user:request) as a UUID | Several id schemes |
| Recurrence | `recurrence` + `recur_until` + `recur_times` on the row; expanded on the client (`plannerUtils.expandReminders`) | No RRULE; multi-day events can't repeat |

**Agent-created schedules** go through `src/utils/recurrence.js`:
- "2× a week for 6 weeks" becomes one weekly row per weekday (Tue + Fri), each with `recur_times = 6`.
- `times_per_week` spacing: 1 → Mon; 2 → Tue/Fri; 3 → Mon/Wed/Fri; and so on.

---

## 5. Features, space by space

### Today
- **KPIs:** tasks due today (with overdue); free to spend this week; spending over 7 days excluding bills, compared with the previous 7 days.
- **"Frodo's take":** a 3–5 sentence AI paragraph (Haiku).
- **Spending chart:** 7 or 30 days.
- **Up next:** overdue tasks with **Fit it in**, then today's tasks, the next 7 days of events and 30 days of tasks.
- **This week cards:** Money, Plan, School, Journal.
- **Morning brief:** data-first sections from `lib/brief.js`.
- **Lists:** upcoming bills and agent activity.
- **Habits card:** tap to log, streaks, **Missed it** / Undo.
- **Status:** storage usage and connection status.
- **Known issue:** failed loads show as empty instead of an error (breaks QF-3).

### Plan
- **Tabs:** Overview (calendar + tasks), Projects, Work.
- **Calendar**
  - Month grid with URL filters for project, kind and "show done".
  - Cells show tasks, events, planned transactions, journal entries and habit logs.
  - An **overdue strip** of chips you can drag onto a day.
  - Day sheet: events, tasks by project, completed tasks with Undo, journal entries, that day's money, habits, and quick add.
- **Tasks (Reminders)**
  - **Due habits** card (Done / Missed it / Schedule) at the top.
  - Lists: Active (sorted by next occurrence), No due date, Completed.
  - Form: name, repeat, end date **or** "after N times", project, date/time, description, show-on-calendar.
- **Fit it in / Schedule sheet** (`RescheduleSheet.jsx`, `utils/reschedule.js`)
  - Choose a day from the next 14, with load dots and the 3 lightest days suggested.
  - Choose a duration: 15 min – 3 h, or custom.
  - Place the block on an hour timeline (06:00–23:00, 15-minute snap), by dragging, clicking or with the keyboard.
  - Overlaps are named; "First free slot" is available.
  - One-off items only.
- **Task page** (`/admin/tasks/:id`): details, notes, attached documents, edit, done or reopen, delete.
- **Projects:** sub-projects, tasks, events (with event-type auto-tasks), initiatives, attached docs, and the event-type editor.
- **Work log:** form (date, project, minutes, task, notes; optionally also adds a completed task) and a list grouped by day.

### Money
- **Tabs:** Overview · Transactions · Bills & Income · Receipts · Banker · Tools.
- **Pay periods:** each period runs from one payday to the next. With fewer than 2 paydays, the calendar month is used.
- **Overview**
  - Period navigator.
  - Tiles for income, bills paid of the total due, spending excluding bills, and savings.
  - **Weekly allowance** (explained under Rules below).
  - Money-flow chart and bills-this-period list. Tapping a bill logs it as paid; tapping again undoes it.
  - Category envelopes, savings goals (each with an amount per paycheque), and analytics: 6-period history, next-period projection, auto insights, category sparklines.
- **Transactions**
  - Log and edit, with a link to a bill.
  - Running balance.
  - Filters.
  - **Statement import:** the AI proposes matches, and a deterministic check rejects matches unless the date is within ±6 days, the amount within max($5, 20%), and the direction agrees. Nothing is written until Apply.
- **Bills & Income:** income sources, recurring bills (including variable "envelope" bills), pay schedule, categories, starting balance, fresh-start reset.
- **Receipts:** photo → AI draft (store, date, items, totals) → optionally posted as a Groceries expense.
- **Banker:** chat with Griphook. Its history lives in sessionStorage for 1 hour.
- **Tools:** reconcile the last 6 periods; a what-if simulator whose runs are saved in `budget_config.simulations`.
- **Rules** (`utils/budgetCalc.js`):
  - **Income** = logged income if there is any, otherwise scheduled income.
  - **Remaining** = income − spent − unpaid fixed bills − savings.
  - **Weekly allowance:**
    - spendable = planned income − fixed bills − savings per period;
    - that amount is split into 7-day weeks;
    - leftover money and overspending both carry into the next week.
  - **Matching a bill to a transaction:**
    - an explicit link counts first;
    - otherwise a fuzzy test: the description contains the bill name and the amount is within $1.
    - The date window for the fuzzy test is **inconsistent**: ±3 days in the totals, ±5 days in the bills list.
- **Known issues:**
  - Money is stored as floats.
  - The reconcile view double-counts income.
  - `set_balance` writes the starting balance directly, which double-counts the ledger.
  - Five dead budget components remain.

### School
- **Tiles:** semester average, courses, due this week, overdue.
- **Course cards:** current and projected grade against the target; deadlines (saved as tasks with `course_id`); an embedded grade tracker with an **AI catch-up plan** whose items can be added as tasks.
- **Import:** drop a syllabus, announcement or grade release. The AI proposes deadlines, grades and course fixes. On approval it writes tasks, grades and course changes, uploads the document, and creates a Brain note.
- **Document viewer:** the file and its notes side by side.

### Life
- **Journal**
  - List and compose views.
  - **Drafts are saved on every keystroke** (localStorage; versioned; unreadable drafts are set aside, not lost).
  - Edit, delete, and **Export all as Markdown**.
- **Habits**
  - Trackers use check or count mode, with an optional schedule: daily, or every N days/weeks from a start date.
  - Actions: Mark done / Log, **Missed it**, Undo.
  - 7-day strip; detail view with streak, 16-week grid and log list.
  - Due habits also appear in Reminders.
- **Arcade:** 50 small games and simulated surveys ported from Kiwi, run in sandboxed frames. Break tokens have no way to be earned, because the Learn page was never built.

### Mission Control
- **Agents:** the Command Center (agent cards, chat per agent, images, deliverables as Markdown/PDF, profile, activity feed) and **Aulë**, a local Claude Code bridge over a WebSocket.
- **Brain:** 3D graph, folders, Memory (context facts), tool list. "Sync from vault" works only in development.
- **Inbox:** Gmail starred-mail sync (daily cron), AI draft replies in Scott's voice, send via Gmail, mark read, status.
- **Build:** bug and feature tracker with screenshots, a "Claude fix prompt", and a zip export.
- **Research:** requests assigned to agents, with attached docs.
- **Usage:** Anthropic cost and token reports (admin key) plus per-agent action counts.

### Vault
- **Secrets:** snippets with reveal and copy.
- **Documents:** upload, view (PDF/image), tag, and share by token with expiry and optional email.
- **Files:** database and storage quota bars.
- **Databases:** SJHC hiker members; CSV import per hike, history, and attendees per hike.

### Settings
- **Appearance:** Light / Dark / Automatic.
- **Hidden pages:** per space.
- **Clear AI chat history:** does not clear the Banker's session or the Command Center threads.

### Shell and cross-cutting features
- Collapsible sidebar; top bar on phones (menu, search, chat).
- ⌘K command palette.
- Frodo chat docked on the right (top half of the screen on phones), with an unread dot.
- `ExportKit` (Print / PDF / CSV / Markdown / Email me) on Today, Plan, Money, School and the readers.
- In-tab data-change events (`utils/dataEvents.js`) refresh open pages when an agent writes. There is **no Supabase Realtime and no sync across tabs or devices.**
- Local mode (`localStorage.forceLocal=1`) stores planner data in `localdb:<table>`. It is used for testing only.

---

## 6. The AI layer

### Agents and models
| Agent | Role | Model |
|---|---|---|
| Frodo → Sam → Gandalf | Chat assistant tiers. A tier hands off with `pass_to_*` after 3 tool errors in a row or when it runs out of turns (10 / 16 / 24). | Sonnet 4.6 · Sonnet 4.6 · Fable 5.1 |
| Bilbo | Archivist: searches across collections, keeps the Brain | Opus 4.8 |
| Griphook | Banker: owns ledger edits, called with `consult_banker` | Sonnet 4.6 |
| Galadriel | Overseer: writes the daily summary note (client run, and a server cron at 11:00 UTC that can email a morning brief) | Sonnet 4.6 |
| Elrond, Lúthien | Research and marketing (MASTERPLAN planned to retire both) | Sonnet 4.6 |
| Aulë | Local Claude Code through `agent-server/server.mjs` on 127.0.0.1:8787 (Max-plan login) | Claude Code |
| Helpers | Receipt reader, grade catch-up plan, inbox draft, context-fact cleanup, AI briefing | Haiku 4.5 |
| Smart import | Statement and school document extraction | Sonnet 4.6 |

**Server model allowlist** (`api/_utils.js`): haiku-4-5, sonnet-4-6, opus-4-8, fable-5-1. `max_tokens` is capped at 4096.

### The Library (`src/api/aiLibrary.js`): agents' only data path
- **Generic tools:** `library_catalog`, `query`, `create_item`, `update_item`, `delete_item`.
- **Query behaviour:** filters are pushed down to Postgres. Default limit 25, max 100. Strings are truncated to 280 characters. Modes are rows, count and summary.
- **Validation:** unknown fields are rejected; enums and real dates are checked; times are normalised.
- **Writes:** every update and create reads back and returns what was stored. **Every delete needs `confirm: true`.**
- **Collections (20):**
  - Read/write: reminders, habits (the blob), events, projects, journal, initiatives, event_types, transactions, recurring_bills, income_sources, snippets (secrets hidden unless `reveal`), bugs, work_log, courses, brain.
  - Query and delete only: hikers.
  - Read-only: grades, documents, receipts, agent_actions.

### Tool belt (`src/api/aiTools.js`, 20 tools)
The Library tools, plus:
- `complete_reminder`
- `log_habit` (with `missed`)
- `set_balance`, `set_category_budget`
- `consult_banker`, `consult_archivist`
- `clear_all_hikers`
- `export_bugs`
- `log_bug` (with duplicate detection)
- `web_fetch`
- `link_brain_nodes`
- `list_context`, `save_context`, `delete_context`, `reorganize_context`

**Every call is logged to `agent_actions`**, except read-only tools.

**Brain write guard (`brainWriteDenial`):** only bilbo, elrond, luthien and galadriel may write the Brain.
- The prompts claim "only Bilbo" can write it.
- The cron writes directly, bypassing the guard.
- The chat tiers log every action as `frodo`, so Sam's and Gandalf's actions appear under Frodo's name.

### Prompts
`src/api/aiTiers.js` builds one large shared system prompt. It includes:
- today's date and a map of the next 7 days;
- an overview of the app (IA);
- rules: never claim anything without looking, confirm what was stored, fix mistakes with update, bias to action, "find before you fold";
- the collection catalog;
- recurrence rules;
- bug and screenshot policy;
- where each kind of thing is stored;
- defer money changes to Griphook;
- the live transaction categories;
- the note that food, gym and weight moved to Achilles.

**For the rebuild:** these rules were each learned from real incidents and are worth carrying forward (see §10).

---

## 7. Server, deploy, integrations

### Endpoints (`api/*.js`)
| Endpoint | Auth | What it does |
|---|---|---|
| `/api/chat`, `/api/briefing` | Supabase JWT | Anthropic proxy with model allowlist and token cap |
| `/api/fetch` | JWT | Server-side URL fetch; returns up to 12,000 characters of text. Partial SSRF guard. |
| `/api/anthropic-usage` | JWT | Admin usage and cost API (`ANTHROPIC_ADMIN_KEY`) |
| `/api/doc-share` | **Share token only** | Service role; returns a 1-hour signed URL |
| `/api/send-share-email`, `/api/send-to-me` | JWT | Resend email; send-to-me only mails the caller's own address |
| `/api/overseer-run` | `CRON_SECRET`, **open if that secret is unset** | Daily summary note in the Brain, plus the morning-brief email |
| `/api/inbox-sync` / `inbox-send` / `inbox-read` | Cron secret or JWT | Gmail (`gmail.modify` + `gmail.send`, one global refresh token) ↔ `messages` |
| `/api/brain-vault` | JWT | Production stub (501). The vault sync is dev-only. |
| `/api/kiwi-tasks` *(untracked)* | JWT; `?config=1` is public | Kiwi desktop app reads today's tasks and adds one-off tasks. Runs under RLS with the user's own token; idempotent ids. |

- **Hosting (`vercel.json`):** SPA rewrites; security headers; crons `overseer-run` at 11:00 UTC and `inbox-sync` at 12:00 UTC.
- **Dev (`vite.config.js`):** stand-ins for `/api/*`. The dev Anthropic proxy has **no auth, allowlist or token cap**. The dev fetch has no SSRF guard. The dev endpoint `/api/aule-control` starts and stops the agent server.
- **Env var names** (values never recorded):
  - Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - Anthropic and OpenAI: `ANTHROPIC_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `OPENAI_API_KEY`
  - Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_QUERY`
  - Crons and email: `CRON_SECRET`, `OVERSEER_USER_ID`, `INBOX_USER_ID`, `RESEND_API_KEY`, `FROM_EMAIL`, `BRIEF_EMAIL`
  - Aulë: `AULE_TOKEN`, `AULE_PORT`, `AULE_WORKSPACE`, `AULE_PERMISSION_MODE`, `AULE_MODEL`, `AULE_CLAUDE_PATH`, `VITE_AULE_URL`, `VITE_AULE_TOKEN`
  - Other: `BRAIN_VAULT_PATH`, `VITE_LOCAL_DATA`, `VITE_SUPABASE_DB_LIMIT_MB`, `VITE_SUPABASE_STORAGE_LIMIT_MB`
  - `.env.example` is out of date: it lists `VITE_SUPABASE_ANON_KEY`, but the client requires `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- **External services:** Anthropic, Supabase, Vercel, Gmail API, Resend, and Google Drive (the `claude-memory` Obsidian vault feeds the Brain in dev).

### Browser storage
**localStorage:**
- `setting:theme`, `setting:hiddenPages`
- `setting:hideSmokeTracker`: orphaned
- `draft:journal:*`
- `accountability`: habit mirror, used only to seed a new account
- `adminRailCollapsed`
- `forceLocal`, `localSession`, `localdb:<table>`: test mode
- Legacy keys read once for migration: `context_store_v1`, `frodo_chat_session`, `vaultSnippets`
- Arcade and landing-page keys: `hsb_break_tokens`, `hsb_arcade_best`, `kiwi.*`, `xpd-geom-v1`

**sessionStorage:** `banker_chat_session` (1 hour), `budgetTab`, and two chunk-reload guards.

---

## 8. Design system (DR-013)
- **Tokens:** `src/styles/globals.css`, with `:root` (light) and `[data-theme="dark"]`.
  - Warm cream sidebar `#F5EEE7`; ink `#221E1B`; coral accent `#D2452D`.
  - Chart colours: coral, teal, amber, sky, umber.
  - Roboto Slab for titles and headline numbers; the system SF font for body text.
- **Scales:**
  - Type: 11/12/13/14/16/20/24/32/40.
  - Spacing: 4/8/12/16/24/32/48/64.
  - Radii: 6/8/12/16/24, plus capsule.
  - Controls: 32/40/48 (44 on touch).
  - Sidebar 256px (72 collapsed); content max 1200px; chat panel 380px.
- **Components:** `src/styles/system.css`, scoped under `.admin-shell`. Page CSS may use tokens but not redefine components. `index.css` is still 2,087 lines of older rules.
- **Rules:**
  - Every text colour ≥ 4.5:1 contrast.
  - Reduced motion is honoured.
  - Visible focus rings.
  - No theme packs.
  - Page titles have no icons.
  - **Phones:** nothing scrolls sideways at 390px; tab strips wrap.
- **Measured:** UI-1 47 (user-chosen and chart colours), UI-5 0, UI-7 ✓. UI-2/3/4/6 are not measurable on plain CSS (DR-004).

---

## 9. Security and risk notes (carry these into the rebuild)
1. **Single-tenant by assumption.**
   - Every `/api/*` endpoint checks only that the caller is *some* signed-in user of the project; nothing checks that it is Scott.
   - If sign-ups are open (the Supabase dashboard reportedly has open sign-up with auto-confirm), any new account could spend the Anthropic key or pull Scott's Gmail into its own inbox rows and reply as Scott.
   - Today there is 1 user. Close sign-ups or add an owner check.
2. **`/api/overseer-run` is open when `CRON_SECRET` is unset.**
3. **`/api/fetch` SSRF guard is partial:** 172.16/12 and IPv6 private ranges aren't blocked, and redirects aren't re-checked.
4. **The dev proxy** forwards to Anthropic with no auth, allowlist or cap.
5. **`VITE_AULE_TOKEN`** is built into the client bundle. The server only listens on localhost.
6. **`snippets`** holds real secrets; `hiker_members` holds third-party PII (116 people).
7. **Brain single-writer policy** is enforced on one of its two write paths only.

---

## 10. Lessons and decisions to carry forward

### Keep (proven in use)
- **Versioned persistence with a loud load failure.** Never fall back to defaults (QF-3). This repo is where that rule came from, after data vanished.
- **Optimistic version check on shared state** (the habit blob pattern).
- **One generic data layer for agents**, with:
  - validation;
  - read-back after every write ("confirm what was stored");
  - `confirm: true` on every delete;
  - an audit log of every tool call.
- **Agent rules learned the hard way:**
  - fix a mistake by updating the row, never by adding a duplicate;
  - the "Today is …" line overrides any date said earlier in the thread;
  - search before saying something doesn't exist;
  - defer money changes to the money owner.
- **Missing-column tolerance that reports loudly** (`{dropped: [...]}`) instead of failing silently.
- **Journal drafts** saved on every keystroke; **Missed it**; **Fit it in** with durations and an hour timeline; event-type **auto-tasks** as the seed of "prep"; the deterministic check on AI statement matches; **nothing is written until the user applies** AI imports.

### Fix in the new system
- **Money:** integer cents; one bill-matching rule (today there are 4 different date/amount windows).
- **Time:** one time zone rule; one id scheme; one unit per measure.
- **One owner per concept.** Tasks and habits currently exist in both heyScottyBro and Calendula (same Supabase project, separate tables).
- **Recurrence:** a real recurrence model (multi-day events can't repeat today; `recur_times` counts from the series start).
- **Change propagation:** no Realtime, no sync across tabs or devices. The Frame promise "appears within a minute" needs a real sync mechanism.
- **Chat history:** in three places today (`agent_sessions`, Banker sessionStorage, legacy localStorage).
- **Loads:** Today, Research and Projects swallow load errors.
- **Unbuilt decisions:** DR-006 (learning model for facts) and DR-007 (a "How it works" page with provenance) were decided but never built.

### Pending actions on the old system
- **Run `supabase/migrations/2026-09-14-reminder-duration.sql`**, or drop durations from the old app. The Supabase connector in claude.ai needs re-authorizing before Claude can run it.
- **Decide the fate of `weed_state`** (DR-016). Delete only after a backup.
- **Before retiring the Vault:** export `snippets` (secrets) and `documents` (files).
- **Before moving people data to Orbit:** export `hiker_members`.
- **Legacy redirects** are due for removal around 2026-10-03.
- **Kiwi integration** (`api/kiwi-tasks.js`) is uncommitted work from another session. It is a second external client of `reminders`, next to Calendula.

---

## 11. Where things live in the repo

| Area | Path |
|---|---|
| Routes | `src/App.jsx`, `src/pages/admin/adminRoutes.jsx`, `src/pages/admin/AdminLayout.jsx` |
| Data layer | `src/api/*Api.js` (`plannerApi.js` is the big one), `src/api/_base.js` |
| Agents | `src/api/aiLibrary.js`, `aiTools.js`, `aiTiers.js`, `archivist.js`, `banker.js`, `src/agents/*`, `src/hooks/useAIAgent.js`, `src/components/ChatBot.jsx`, `agent-server/server.mjs` |
| Business logic | `src/utils/{plannerUtils,recurrence,habitSchedule,reschedule,budgetCalc,budgetSummary,budgetAnalytics,drafts,journalExport,theme,settings,dates}.js`, `src/lib/{brief,events,smartImport,exporter,balance,budgetProjection}.js` |
| Server | `api/*.js`, `vercel.json`, `vite.config.js` |
| SQL | `SUPABASE_SETUP.sql`, root `MIGRATION_*.sql`, `supabase/migrations/*`, `migrate-*.sql`. **These disagree with each other; the live schema is the truth — see [live-schema.md](live-schema.md).** |
| Design | `src/styles/globals.css`, `src/styles/system.css`, `src/pages/admin/*.css` |
| Decisions | `ledger.jsonl` (DR-000…DR-016), `MASTERPLAN.md`, `CLAUDE.md` |
| Backlog | `docs/backlog/weekly-report-and-reflection.md` (weekly report + AI journal reflection, not started) |

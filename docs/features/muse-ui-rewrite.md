# Feature: Muse-UI Rewrite (heyScottyBro in the Muse app UI)

**Status:** Approved by Scott on 2026-10-21 ("approval on both", covering this rewrite and Connected Pages), with this plan's SPEC-GAP recommendations adopted (light + dark kept, icon-only rail, phone bar Today/Plan/Tasks/Money/More, shell before Connected Pages surfaces). The interactive blueprint gate is satisfied by the approved visual before/after reference (`~/workspace/your_files/heyscottybro-ui-before-after/before-after.html`). Phase 0 and Phase 1 built locally on 2026-10-21 (see the build record at the end of this document). Not pushed: Scott approves the deploy after seeing the result.
**Owner:** Scott
**Started:** 2026-10-21
**Build Process position:** This document is the **executive plan** (step 2 of Scott's Build Process, `~/workspace/workflows/scott-build-process.md`). The idea arrived as Scott's 2026-10-21 direction: after a verified clone of the Muse app UI was built (repo `github.com/scottadamsx/muse-UI-clone`, single `index.html`; exported copy at `~/workspace/your_files/muse-ui-clone/muse-ui-clone.html`), Scott said: "rewrite heyscottybro to use this UI, its much cleaner." The next step is not code: it is the interactive HTML blueprint (step 3), which Scott must see, understand, and approve before any build. See the closing section, "Next gate: interactive blueprint."

## User problem

heyScottyBro works, but its presentation has grown page by page and it shows:

- One wide labelled sidebar (`src/pages/admin/AdminLayout.jsx`) plus a separate phone top bar and slide-over drawer: three navigation behaviours for one app, and the sidebar spends its width on labels for sections Scott already knows by icon and position.
- Seventeen page-level CSS files (`today.css`, `plan.css`, `health.css`, `mission.css`, `bin.css`, and the rest under `src/pages/admin/`) sit alongside the single component layer (`src/styles/system.css`, 1,206 lines). QF-7 says one styling source of truth; in practice each page has drifted toward its own card shapes, spacing habits, and density.
- The current type system (DR-013, recorded in `CLAUDE.md`) sets titles in Roboto Slab, a serif, with system SF for body. Scott's standing product spec is DM Sans for everything including headers and DM Mono for numbers and labels, with no serif anywhere. The app does not follow his own spec.
- Detail work pushes Scott off the page he is on. A task opens as a full page (`TaskDetailPage.jsx`, route `tasks/:id`); there is no quick-look surface that keeps the list visible beside the detail.
- Density varies by page because nothing enforces one content column, one card language, or one list-plus-detail pattern across Today, Planner, Finance, Health, People, and Vault.

Scott has already approved the replacement look itself: the Muse UI clone was built from his live Muse app, verified by driving it (rail switching, composer, approval card, Settings dialog, status panel, mobile bottom bar), and his verdict was "its much cleaner." What remains to design and approve is the **mapping**: how heyScottyBro's sections, pages, and detail flows fit into that shell.

## Desired outcome

heyScottyBro keeps every page, route, record, and behaviour it has today, and presents all of it in the Muse app UI:

1. A slim left icon rail carries Scott's sections; a bottom mobile bar with a More sheet carries them on the phone.
2. Every page renders inside one content frame with one card language, one list language, and the app's type spec: DM Sans everywhere, DM Mono for numbers and labels, no serif.
3. Detail opens in a slide-in right panel (task detail, event detail, document preview, pre-hangout person brief) without losing the list behind it; full pages remain for deep work and deep links.
4. Settings becomes a dialog in the Muse pattern, opened from the rail, instead of a destination page.
5. The rewrite lands in phases that each ship on their own. No big-bang switch, no phase where the app is half one shell and half another at the navigation level.

## Governing rules

### Presentation only: the hard boundary

This rewrite changes layout structure, navigation chrome, and visual styling. It does not change:

- Any Supabase table, column, RLS policy, or stored value. No migration is part of this plan.
- Any API module's behaviour: `src/api/*Api.js`, `api/orbit.js`, `api/` serverless handlers, and the agent Library (`aiLibrary.js`) keep their contracts, names, and return shapes.
- Any business logic: planner rules, budget and transaction reconciliation in `BudgetPage.jsx` and `src/components/budget/*`, grocery costing, health calculations (`src/utils/overload.js`, `src/utils/healthInsights.js`), cascades and watchers designed in `docs/features/connected-pages.md`, and every other feature contract stay as they are.
- Route paths and their data behaviour. `src/App.jsx` and `src/pages/admin/adminRoutes.jsx` keep the same paths, redirects, and lazy-loading (DR-020 speed floor stands: every route stays its own chunk, reads keep the shared cache).
- Frodo, Banker, and the agent runtime: the assistant still docks on the right on wide screens (`src/components/ChatBot.jsx`) and opens from the top bar on phones. Only its frame styling follows the new system.
- The public site (`src/pages/HomePage.jsx`, guide, games, shared-doc routes) keeps its own public chrome (`Navbar`/`Footer`). This plan covers the signed-in admin app only (see SPEC-GAP 9).

If a page cannot be re-presented without touching its data flow, that is a stop condition under the repo workflow: the page is reported back, not quietly re-engineered.

### Type spec (Scott's standing rule, supersedes the DR-013 font choice)

- **DM Sans** for everything, including headers. Headers: weight 500, letter-spacing -0.015em, line-height 1.12.
- **DM Mono** for numbers, amounts, dates-as-data, and small labels.
- **No serif anywhere.** This replaces the current `--font-display: "Roboto Slab", "Rockwell", "Georgia", serif` in `src/styles/globals.css` and the system-SF body stack (`--font-body`).
- Source-of-truth note: `AGENTS.md` puts Scott's latest explicit instruction above `CLAUDE.md` and the ledger. His DM Sans / DM Mono / no-serif spec is that instruction (set 2026-10-20 and applied across his other products since). The build phase should append a ledger decision superseding the font portion of DR-013 so the record stays honest; the rest of DR-013 (one system, tokens in `globals.css`, components in `system.css`, 8-pt spacing, contrast floors) remains in force and this plan builds on it.

### View First, Edit by Button (and DR-019)

- Records display read-only by default as clean, compact summaries. Create and edit forms appear only after an explicit Edit, Add, New, or Log action. No open forms on a page, ever, unless Scott asks for that screen to be an input screen (search, sign-in, chat composer are the standing exceptions).
- This is the same rule DR-019 already enforces mechanically (every form behind a button, in `FormModal`). The Muse UI strengthens it presentationally: its cards are read-first summaries with one clear action, its detail panel shows the record before it offers editing, and its dialogs hold the form when editing is chosen. The rewrite adopts that presentation without weakening DR-019: forms still open in modals (or the panel's edit state), submit/busy/error behaviour unchanged.
- The complete picture should fit with minimal scrolling where practical: summaries sized to scan, detail one tap away, never a wall of expanded records.

### Standing floors that carry over unchanged

- **List-card counts (DR-025):** every settled card with repeated rows keeps its accurate count (`N`, `N of M`, `0`), derived from the rendered rows.
- **Display dates:** calendar dates render as `Thursday, Jan 15th` via the shared formatters; stored dates untouched.
- **Accessibility (QF-9):** real buttons and links, visible focus, colour never the only signal, 44px minimum touch targets, mobile form inputs at least 16px.
- **One accent colour, no pure black or pure white,** per Scott's product UI rules; every text colour keeps the existing 4.5:1 contrast floor from DR-013.
- **No emojis in the UI.** Icons are proper icons. The Muse clone uses a single icon language throughout; the current app uses Font Awesome classes (see Risks for the icon decision this creates).

## Design reference: the Muse UI patterns being adopted

From the exported clone (`~/workspace/your_files/muse-ui-clone/muse-ui-clone.html`), verified against the live app on 2026-10-21:

1. **Slim left icon rail** (web): one narrow rail on the left edge. Top group: Chat, Search, Feed, Ideas, Goals, Library (icon buttons with tooltips, `aria-label="Primary"`). Bottom of the rail: a menu button opening Settings as a dialog. Active section is marked by a filled/weighted icon treatment, not a wide highlighted row.
2. **Centered content column:** the main surface is one column of cards and reading content, generously spaced, on a very light canvas. Nothing stretches edge to edge on a wide monitor.
3. **Card language:** white cards, large radius, soft shadow, one idea per card, small caps-free headings, quiet metadata lines, one primary action per card at most.
4. **Slide-in right status panel:** clicking the avatar/name at the top of the chat column slides a panel in from the right with tabs: Activity, Approvals, Upcoming, Identity. It overlays, it does not push the column.
5. **Artifact/space view:** content (an artifact) opens as its own view with a header bar, replacing the column rather than stacking under it.
6. **Library pattern:** a section sidebar (Artifacts: All, Documents, Web artifacts; Media: Images, Videos; System files) beside a card grid with sort control (Last opened, Last created, Title), grid/list toggle, and a per-card menu (Pin, Share, Download, Delete).
7. **Settings dialog:** a modal with a left pane list (General, Connectors, Wallet, Secure credentials store, Permissions, Data Controls, Help & Support, Legal info, Log out) and the selected pane's content on the right. It opens over any view and closes back to it.
8. **Search overlay:** the rail's Search entry (and Cmd-K) opens a quick-search palette over the app.
9. **Mobile:** the rail hides; an icon-only bottom bar shows Chat, Feed, Ideas, Goals, Library plus a **More** button opening a sheet with the remaining destinations and actions.
10. **Message and composer language** (for Frodo): right-aligned user bubbles, left-aligned plain assistant text, embedded cards inside the thread, one rounded composer at the bottom.

## Design mapping: Muse pattern to heyScottyBro

### The rail: Scott's sections in Muse's rail

Scott has more sections than Muse (thirteen spaces plus utility destinations, from `NAV_ITEMS` in `AdminLayout.jsx` and `ADMIN_PAGES` in `adminRoutes.jsx`). The mapping keeps a short pinned group in the rail and puts the rest one tap away, the same job Muse's More sheet does on mobile:

| Rail position | heyScottyBro section | Route | Notes |
|---|---|---|---|
| Top (brand) | Home / Today | `/admin/today` | The heyScottyBro mark replaces the Muse avatar spot as the home anchor; Today is the landing view, as now. |
| Pinned | Plan (Planner) | `/admin/planner` | Calendar, projects, work tabs stay inside the page. |
| Pinned | Tasks (Reminders) | `/admin/reminders` | Tasks and reminders are one system (`reminders` table); one rail entry, as now. |
| Pinned | Money (Finance) | `/admin/finance` | Budget page with its tabs (Bills & Income, Receipts) inside. |
| Pinned | Health | `/admin/health` | Tabs inside: Overview, Workouts, Exercises, Food, Body. |
| Pinned | People (Orbit) | `/admin/people` | Host frame only around the embedded Orbit; see the Orbit rule below. |
| Pinned | Search | opens palette | The existing Cmd-K `CommandPalette` restyled as the Muse search overlay. Same sources, same rule: it never fetches Vault secret values (DR-021). |
| Overflow ("More" panel on desktop, More sheet on mobile) | Work log | `/admin/work` | |
| Overflow | School | `/admin/school` | School document reader (`school/doc/*`) opens as a space view. |
| Overflow | Life | `/admin/life` | Journal, habits live here as tabs, as now. |
| Overflow | Analytics | `/admin/analytics` | |
| Overflow | Mission Control | `/admin/mission` | Frodo/Brain surfaces. |
| Overflow | Vault | `/admin/vault` | Secrets, Documents, Files, Databases tabs inside. |
| Overflow | Bin | `/admin/bin` | |
| Overflow | Arcade | `/admin/arcade` | |
| Rail bottom | Menu: Settings, View site, Log out | Settings opens the dialog | Mirrors the Muse rail: the bottom menu button opens the Settings dialog; View site and Log out live in that menu/dialog footer, as they sit in today's sidebar foot. |

Rules that travel with the rail:

- The existing "hide this page" setting (`useHiddenPages`, consumed by `AdminLayout` and Settings) filters both the pinned rail and the More list. A hidden section appears in neither.
- The collapse behaviour of today's wide sidebar (`adminRailCollapsed`) has no equivalent in an icon rail and is retired; the rail is one width. On phone widths the rail is replaced by the bottom bar entirely (no drawer, no top bar nav cluster; the top bar keeps only the brand anchor and the Frodo button, as today Frodo already lives in the phone top bar).
- Active state, focus order, and keyboard behaviour follow the clone: the rail is a labelled navigation landmark, entries are real links (QF-5: no dead controls; every rail entry routes or opens its named surface).

### The content column

- One content frame (`.admin-main` successor) with two width classes, because Muse's reading column is right for summaries and wrong for a calendar grid or a transactions table:
  - **Reading width** (clone-like centered column): Today, Life/Journal reading, Brain reader, School document reader, person brief.
  - **Data width** (wider, still framed and card-based): Planner calendar, Finance tables, Health charts, Analytics, Documents grid, People.
- Page headers shrink to the Muse pattern: the page title in DM Sans 500, one quiet metadata line (counts per DR-025, "Last updated" where the page already shows it), and the page's primary actions as buttons on the header line (PageActions already exists as a component). No page-title icons (existing DR-013 rule).
- In-page tabs (`PageTabs`: Planner's Overview/Projects/Work, Health's five tabs, Vault's four, Finance's tabs, Life's tabs) stay, restyled to the clone's quiet segmented/tab treatment. Tab state stays in the URL exactly as today (`?tab=`), so deep links and the legacy redirects in `ADMIN_REDIRECTS` keep working.

### Cards and lists

- `system.css` gains the clone's card primitives in place (the DR-013 rule: change the rule in place, do not add a skin layer): summary card, list card with count, stat card (DM Mono values), and the embedded-card treatment used inside Frodo's thread.
- Lists render read-first rows: title, one metadata line, status chip where the page already has one, and a trailing chevron/action only when the row opens something. Selecting a row opens the detail panel (below) instead of navigating, where the page's contract allows it.
- Page-level CSS files are retired page by page as each page migrates (see Phasing): a migrated page composes tokens and `system.css` primitives only, per QF-7.

### The slide-in right panel: heyScottyBro's detail surface

The Muse status panel's pattern (overlay from the right, tabs across the top, closes back to the untouched view) becomes heyScottyBro's standard **detail panel**. It is a shell-level surface: any page can open it, it never unmounts the page behind it, and on phones it becomes a full-screen sheet.

What goes in it:

- **Task detail:** today's `tasks/:id` content (title, schedule, notes, completion) as a panel over Reminders or Planner. The route stays for deep links and opens the same content full-page on direct load (see SPEC-GAP 5).
- **Event detail and the pre-hangout brief:** from Planner, an event's detail, and when people are linked (Connected Pages design), the assembled person brief: who they are, current situation, unresolved items, natural things to ask. The brief is a read model; the panel is where it lives.
- **Person quick context:** from anywhere a person is named (Planner chips, Journal links, brief), a compact profile summary panel. The full profile still opens the People space (Orbit); the panel is a summary, not a second profile editor (DR-017 boundary, below).
- **Document preview:** from Vault > Documents, the existing preview in panel form, with the card menu actions (the clone's Library menu: Pin, Share, Download, Delete equivalents the page already supports).
- **Status tabs (the Muse panel's own content, translated):** the avatar/brand anchor at the rail top opens the panel on a **Status** view with Scott's equivalents of the four tabs: **Upcoming** (today and near-term Planner items and open reminders), **Approvals** (pending permission and review items the app already surfaces, e.g. Orbit review proposals), **Activity** (the existing activity history), **Identity** (profile summary with a route into Settings). Only tabs backed by real existing data render (QF-5); a tab with no existing source is not invented for symmetry.

Panel mechanics (contract, detailed in Pseudocode): one panel at a time; Frodo's dock and the detail panel are mutually exclusive on the right edge (opening one closes the other); Esc closes; focus moves in on open and returns to the invoking control on close; the URL does not change for panel opens except where a route already exists (task detail keeps its route as the canonical deep link).

### Settings as a dialog

`SettingsPage.jsx` (228 lines, route `/admin/settings`) becomes a dialog in the Muse pattern: opened from the rail's bottom menu button, left pane listing the settings groups the page already has (including the hidden-pages list, date format, theme choice), content on the right, closing back to the page underneath. The route stays and renders the same content full-page for deep links (Settings links exist in help text and redirects: legacy `design` redirects to `/admin/settings`).

### Mobile: bottom bar and More sheet

- Bottom bar, five slots, icon-only like the clone: **Today, Plan, Tasks, Money, More**. (Health is the arguable fifth; see SPEC-GAP 3.)
- More opens a sheet listing every remaining visible section (Health, People, Work, School, Life, Analytics, Mission Control, Vault, Bin, Arcade), plus Search, Settings, View site, and Log out.
- The phone top bar keeps: brand anchor (to Today), Search button, Frodo button with its unread dot (all three exist in today's top bar). The hamburger and drawer are retired.
- Detail panel becomes a full-screen sheet; FormModal keeps its existing bottom-sheet behaviour on phones (DR-019).

### Library pattern: Documents and People

The clone's Library (section sidebar + card grid + sort + per-card menu) is the template for the two list-and-browse surfaces:

- **Vault > Documents** (`DocumentsPage.jsx`, today a tab inside the 43-line `VaultPage` shell beside Secrets, Files, Databases): in the new frame, Vault keeps its tabs, and the Documents tab adopts the Library arrangement: a left section list (All, Agent work, and the tag groups the page already supports), the document grid with sort, and per-card menus with the actions Documents already has. Nothing about upload, storage buckets, or the "This is agent work" flow changes.
- **People** (`PeoplePage.jsx`, 58-line host): the host chrome around Orbit adopts the shell (rail, frame, panel), and Orbit's own list/detail inside the shadow root is untouched by this rewrite (see below). Where Connected Pages later adds host-side people surfaces (event people picker, profile calendar history), they are built in the new system from the start.

### Frodo in the new shell

Frodo's thread adopts the clone's message language (bubbles, embedded cards, one rounded composer, minimal chrome per the repo's chatbot-simplicity rule: prompt and Send prioritised, history behind an Entries button). Frodo's data, tools, sessions, and the agent runtime do not change. Banker and Command Center conversations get the same thread styling where they share the chat components.

## The Orbit rule (DR-017)

`orbit/` is a synchronized read-only copy of the canonical Orbit repo. Orbit renders in a shadow root from `PeoplePage.jsx`, restyled through `people-orbit.css` token mapping, and its data flows through `api/orbit.js`. Therefore:

- This rewrite restyles the **host frame** around People (rail, page frame, panel host, top spacing) and may update the **token values** `people-orbit.css` maps from, in step with the new `globals.css` tokens.
- It does **not** edit anything inside `orbit/`, does not restyle Orbit's own components, and does not change Orbit's router or API. If the new shell makes an Orbit-internal screen look wrong, that fix is proposed in the canonical Orbit repo under its own process, then re-synced with `npm run sync-orbit`. It is never patched locally.
- The blueprint shows the People page as the new frame with Orbit's current internal look inside it, honestly, so Scott approves the real combination and not a fantasy mock of Orbit restyled.

## Current-state inventory

Evidence from the code on 2026-10-21. Routes are from `adminRoutes.jsx`; navigation from `AdminLayout.jsx`; sizes are source line counts, given only to show where the layout weight sits.

| Page / route | Today | Layout problem the rewrite fixes |
|---|---|---|
| Shell (`AdminLayout.jsx`, `system.css` `.admin-shell`) | Wide labelled sidebar with brand block, profile block, collapse toggle; separate phone top bar + drawer; sidebar foot holds Search/Settings/View site/Log out | Three nav behaviours; sidebar width spent on labels; settings and search are sidebar rows instead of the rail/dialog/palette pattern. Retired: sidebar, drawer, collapse. Kept: Cmd-K palette, hidden-pages filtering, logout behaviour. |
| Today (`today`, `DashboardPage.jsx`, 562 lines, `today.css`) | Brief cards, space cards, dashboard cards (`db-card`) in a multi-column grid | Densest page in the app; competing card styles (brief, space, db) in one view. Becomes the reading-width column of summary cards with counts, one card language. |
| Plan (`planner`, `PlannerPage.jsx` 168 over `CalendarPage.jsx` 853 + `ProjectsPage.jsx` 708, `plan.css`) | Tabs (Overview/Projects/Work); Overview pairs the calendar with a side panel and a phone panel switcher | The calendar is a wide data surface squeezed by page chrome; the ad-hoc side panel is replaced by the standard detail panel; phone panel switcher is replaced by the sheet pattern. Highest-risk page (see Risks). |
| Tasks (`reminders` 326 lines; `tasks/:id`, `TaskDetailPage.jsx` 271) | Reminder list page; task detail is a separate full page | Detail-as-page breaks the list context. Detail becomes the slide-in panel; route remains for deep links. |
| Work log (`work`, 196 lines) | Simple list page | Straight migration: list card language, counts. |
| Money (`finance`, `BudgetPage.jsx` 405 + `src/components/budget/*`, tabs incl. Bills & Income, Receipts) | Hero values, tabbed tables and cards | Numbers currently inherit display serif in hero values in places the token stack reaches; DM Mono for all figures; hero becomes stat cards; tables keep data width. |
| School (`school`, 339 lines; `school/doc/*` reader) | List page plus a document reader route | Reader becomes a space view (reading width) in the Muse artifact pattern; list adopts card language. |
| Life (`life`, tabs incl. Journal via `JournalPage.jsx` 852, habits/accountability 521) | Tabbed page hosting journal and habits | Journal reading/writing surfaces adopt reading width and the card language; journal data and the Orbit review flow untouched. |
| Health (`health`, `HealthPage.jsx` 626, tabs Overview/Workouts/Exercises/Food/Body; `health.css`; workout session route 345 lines) | Five tabs, stat blocks, charts (`LineChart`), food log tables and modals | Charts and the food log need data width inside a card frame; the live workout session is a focused full-screen flow that keeps its own layout inside the frame (see Risks). Food Log specifically: read-first day list, Log actions opening the existing modals (DR-019). |
| People (`people/*`, host 58 lines + Orbit shadow app, `people-orbit.css`) | Host page embedding canonical Orbit | Host frame only; Orbit internals out of scope per DR-017. |
| Arcade (`arcade`, 192 lines) | Games grid page | Card grid language (the Library grid pattern fits directly). |
| Mission Control (`mission`, `CommandCenterPage.jsx` 651 + Brain/Context pages) | Agent command surfaces, chat-like panels | Thread surfaces adopt the Frodo/composer language; dense control panels keep data width. |
| Analytics (`analytics`) | Chart and metric cards | Stat/chart cards in the new language; chart palettes are user-data colours tagged `theme-fixed` today and stay data colours, not chrome. |
| Vault (`vault`, shell 43 lines over Secrets/`SnippetsPage.jsx` 367, Documents 203, Files/`StoragePage.jsx`, Databases/`HikerPage.jsx` 424) | Four tabs in one page | Documents adopts the Library pattern; Secrets keeps its masked list with reveal-on-action only (no panel previews of secret values, ever); Files and Databases adopt list/grid language. |
| Bin (`bin`, `BinPage.jsx` 305, `bin.css`) | Intake list with status flow (new / picked up / done) and context flag | List language + detail panel for an item's full text (today the full body is not readable in the list view); pickup workflow and statuses unchanged. |
| Settings (`settings`, 228 lines) | Full page of setting groups | Becomes the rail-opened dialog (route kept for deep links). |
| Brain reader (`read/*`) | Long-form reading view | Reading width, Muse reading column. |
| Login (`/admin/login`) | Standalone sign-in page | Restyled to the same tokens/cards; auth behaviour untouched. |
| Public site | Own chrome (`Navbar`, `Footer`, `public.css`) | Out of scope for this rewrite (SPEC-GAP 9). |

Cross-cutting evidence: `globals.css` (276 lines) holds the tokens including the serif display stack; `system.css` (1,206 lines) is the component layer scoped under `.admin-shell`; page CSS totals roughly 4,000 further lines across the admin folder; 36 `style={{` blocks exist across admin pages (CLAUDE.md records the inline-style history; the sweep threshold is 20 per app, so migrations also retire inline blocks a page carries, without behaviour change).

## Phasing

No big-bang. The shell changes once, at the navigation level, and page interiors migrate one by one inside it. Every phase ends shippable, verified (lint, tests, build, desktop and phone visual checks), and reported with the Build Process job report before the next phase starts.

### Phase 0: Foundations (no visible change)

- Add DM Sans and DM Mono to the font loading already used by the app (non-blocking, per DR-020) and repoint `--font-body`, `--font-display`, and `--font-mono` in `globals.css`; delete the serif stack.
- Introduce the new shell tokens (rail width, panel width, column widths, card radius/shadow values from the clone) beside the existing ones; existing pages keep rendering identically except for the font change, which is itself verified page by page in this phase's visual pass.
- Append the ledger decision superseding DR-013's font choice; record the theme decision from SPEC-GAP 1.

### Phase 1: The shell

- Replace `AdminLayout`'s sidebar/drawer/top-bar navigation with: the icon rail (pinned + More), the phone bottom bar + More sheet, the Settings dialog host, the detail-panel host, and the restyled Cmd-K palette. Routes, outlets, page-usage tracking, hidden-pages filtering, the Frodo lazy panel, and the Orbit host event listeners in `AdminShell.jsx` are preserved as-is.
- All pages render inside the new frame with their existing interiors. This is the one coordinated cutover, and it is at the frame level only: page content CSS is untouched in this phase, so any page that looks wrong inside the frame is a frame bug, fixed in the frame.
- Retire: `.sidebar` family, drawer, collapse state, `xp-desktop.css` leftovers if any reach the admin shell.

### Phase 2: High-value pages

In order: **Today** (the landing page; sets the card language), **Planner** (frame + standard detail panel for events and tasks; calendar grid kept data-width), **Finance** (stat cards, DM Mono figures, tab restyle). Each page: migrate interior to `system.css` primitives, retire its page CSS file, move its task detail fully onto the panel pattern.

### Phase 3: Data and browse pages

**Health** (tabs, stat/chart cards, Food Log read-first list; workout session keeps its focused layout inside the frame), **Vault** (Documents onto the Library pattern; Secrets/Files/Databases list language), **People host frame** (frame and token mapping only, per DR-017), **Bin** (list + panel reading).

### Phase 4: Long tail and close-out

Life/Journal, School + reader, Work log, Reminders list polish (if not completed with Phase 2's panel work), Analytics, Mission Control, Arcade, Brain reader, Login. Settings content moves fully into the dialog (the page route renders the dialog content full-page for deep links). Final sweep: no page CSS files remain that a migrated page no longer uses; inline-style count rechecked against the floor; full visual pass at desktop and phone widths.

### Coordination notes

- **Connected Pages** (`docs/features/connected-pages.md`) is a separate in-flight feature with its own phases touching Planner, Finance, and Meal Plan. This rewrite changes none of its data design. Sequencing recommendation: land this rewrite's Phase 1 shell before Connected Pages builds new surfaces, so its new UI (people picker, brief, meal plan) is born in the new system instead of being migrated twice. If Connected Pages ships first, its surfaces migrate with their host pages in Phases 2 and 3. Either order works; building the same surface twice does not.
- Each phase is its own approval: Scott's "go" or "I approve" per phase, per the repo workflow. A phase's job report is the gate document for the next phase.

## Pseudocode

Per `docs/development/PSEUDOCODE_STANDARD.md`. Behaviour contracts for the shell surfaces; page interiors keep their existing feature-doc behaviour.

### Rail and More navigation

```text
Trigger: app shell mounts (AdminLayout), or the hidden-pages setting changes.
Inputs: NAV_ITEMS and ADMIN_PAGES (existing source of truth), the hidden-pages
  list, the current route.
Rules:
  - Pinned rail = Today, Plan, Tasks, Money, Health, People, Search,
    filtered by the hidden-pages list.
  - More list = every other visible section, same filter, in NAV_ITEMS order.
  - Active entry derives from the current route only; no stored nav state.
  - Desktop: rail always visible; More opens a panel anchored to the rail.
  - Phone: bottom bar = Today, Plan, Tasks, Money, More; More opens a sheet.
States: More panel/sheet open or closed; Esc, outside tap, or any navigation
  closes it. Focus returns to the More button on close.
Invariants: every visible section is reachable in at most two taps on every
  form factor; no entry renders that routes nowhere (QF-5).
```

### Detail panel

```text
Trigger: user activates a row or control that has a detail target (task,
  event, document, person summary, brief), or the brand anchor for Status.
Inputs: the target's existing route/API data, loaded by the same api modules
  the full page uses. The panel introduces no new data path.
Rules:
  - One panel at a time. Opening Frodo closes the panel and vice versa.
  - Read-first: the panel opens on the summary view. Edit appears only via
    an explicit Edit action, which opens the existing FormModal flow
    (DR-019), never an inline form in the panel.
  - Task detail: the canonical deep link remains /admin/tasks/:id; loading
    that route directly renders the same content as a full page; opening a
    task from a list shows the panel and does not change the URL.
  - Loading, empty, and error states render inside the panel; an error never
    blanks the page behind it.
Mobile: panel is a full-screen sheet with a close button; desktop: overlay
  panel from the right, page behind it inert but visible.
Accessibility: dialog semantics, focus trapped while open, labelled by the
  record's title, focus returns to the invoking row on close.
Invariants: closing the panel never loses unsaved work, because the panel
  holds no form state of its own; list scroll position and filters behind
  the panel are untouched.
```

### Settings dialog

```text
Trigger: rail bottom menu -> Settings, or a deep link to /admin/settings.
Rules: the dialog hosts the existing SettingsPage groups unchanged (same
  controls, same settings storage). On a direct route load, the same
  content renders full-page in the frame instead of in a dialog.
States: opening from the rail never navigates; closing returns to the exact
  page and scroll position underneath.
```

### Page migration (per page, Phases 2 to 4)

```text
For each page, in phase order:
  1. Recompose the page from system.css primitives inside its width class
     (reading or data). Same components, same api calls, same order of
     information unless the plan for that page says otherwise.
  2. Move any remaining page-specific CSS that is truly local into the
     page's existing css file only if it composes tokens; primitives move
     into system.css. (QF-7: no new skin layer.)
  3. Delete the page css file when nothing references it.
  4. Verify: the page's existing tests, lint, build; screenshot pass at
     desktop and 390px phone width; counts, dates, and money formats
     spot-checked against the pre-migration page.
Invariant: at every commit boundary the app is fully usable; a half-migrated
  page never ships, and pages not yet migrated keep working in the shell.
```

### Tests that prove the shell behaviour (for the build phases)

- Route table unchanged: every existing path and redirect from `adminRoutes.jsx` resolves as before.
- Hidden-pages setting hides a section from rail, More, and bottom bar together.
- Panel: open/close, Esc, focus return, Frodo mutual exclusion, deep-link route renders full page.
- Settings dialog opens from the rail on every page and closes back to the same scroll position.
- Visual regression pass per migrated page at desktop and phone widths, including Planner calendar and Health charts.

## Risks and unknowns

- **Planner calendar density.** `CalendarPage.jsx` (853 lines) renders a real calendar grid plus, on Overview, a companion panel and a phone panel-switcher. The Muse column language is spacious; a calendar needs its width. Mitigation: data-width class for Planner, standard detail panel replacing the ad-hoc side panel. Residual risk: month-grid legibility at phone width needs the blueprint to prove, not this document.
- **Health charts and the live workout.** Charts (`LineChart`, health tabs) reflow risk inside cards; the workout session is a mid-activity flow where layout churn is a safety issue, not a cosmetic one. Mitigation: workout session keeps its internal layout in Phase 3; only its frame changes. Charts get a dedicated blueprint check.
- **Finance tables.** Receipts and transactions are wide tables; data width plus card framing is the plan, but column behaviour at phone width (the page already handles this today) must be preserved exactly, not redesigned.
- **Orbit embedding (DR-017).** Covered above: frame and token mapping only. Unknown: whether the new `globals.css` token values, mapped through `people-orbit.css`, keep every Orbit screen legible (Orbit has its own light/dark mapping). The blueprint shows the real combination; any Orbit-internal fix is a canonical-Orbit change, separately approved and re-synced.
- **Two right-edge surfaces.** Frodo already docks right on wide screens. The detail panel is the second right-edge surface. The mutual-exclusion rule is in the contract, but z-order, animation overlap, and Frodo's unread badge behaviour while the panel is open need build-phase verification.
- **Vault Secrets.** Secret values must never appear in panel previews, search results, or the Status panel. The existing rules already forbid the palette from fetching secret values; the panel contract adds: Secrets gets no quick-look panel content beyond the masked list row itself.
- **Bin reading.** The Bin list today shows a one-line preview; the full body is read in the panel under this plan. The pickup workflow (`bin_items` statuses, context flag behaviour) is unchanged; only the reading surface moves.
- **Icons.** The app uses Font Awesome classes throughout (`fa-*` in `adminRoutes.jsx` and `AdminLayout.jsx`); the clone uses one consistent drawn-icon language. Restyling the rail and cards without touching icons is possible (icons are class-swappable at the component level), but a full icon replacement touches every page's markup. Treated as SPEC-GAP 6 rather than assumed.
- **Theme.** The clone demonstrates a light look. The app's token system is dual-scope (light and dark, DR-013). Dropping dark would be a behaviour removal, not a restyle. SPEC-GAP 1.
- **Speed floor (DR-020).** The shell must not grow the entry chunk: rail, panel host, and dialog host are part of the shell chunk that already exists (`AdminLayout`); page chunks stay lazy. Font files for DM Sans/DM Mono add weight; subsetting and the existing non-blocking load pattern apply.
- **Settings as dialog vs. page links.** Help text and at least one legacy redirect (`design` -> `/admin/settings`) point at the route. The route therefore stays; the dialog is an additional host of the same content, not a replacement that breaks links.

## Acceptance criteria

For the build phases (not this docs phase), the rewrite is done when:

- [ ] Every admin route from `adminRoutes.jsx` renders in the new shell with the same data, actions, and deep-link behaviour as before.
- [ ] No serif font is reachable in the admin app; DM Sans and DM Mono are the only UI typefaces; figures use DM Mono with tabular numbers.
- [ ] Navigation is exactly: icon rail + More (desktop), bottom bar + More sheet (phone); no sidebar, drawer, or collapse control remains.
- [ ] Task detail, event detail, document preview, and the person brief open in the detail panel; their routes still work when loaded directly.
- [ ] Settings opens as a dialog from the rail on every page; `/admin/settings` still renders.
- [ ] View First holds everywhere: no page shows an open form that DR-019 did not already place behind a button and modal.
- [ ] List-card counts, display dates, and money/number formats are unchanged in value everywhere (presentation may differ, values may not).
- [ ] The People page's Orbit content is byte-identical in behaviour; only host frame and token mapping changed; `orbit/` untouched.
- [ ] Lint, full test suite, and production build pass at each phase boundary; desktop and phone visual checks recorded per phase.
- [ ] Each phase closes with a one-page job report filed in heyscottybro Documents, per Scott's Build Process.

## Open questions for Scott

These are product decisions, not implementation details. The recommendations are the defaults used in this plan, but the blocked work should not proceed until Scott answers or approves the document as a whole.

### SPEC-GAP 1: Theme scopes

- **Decision:** Does the rewritten app keep light and dark themes (the current DR-013 token system), or go light-only like the clone demonstrates?
- **Options:** keep light + dark (and Automatic) | light only
- **Recommendation:** keep light + dark. The tokens already exist in both scopes, dark is a behaviour Scott uses the OS setting for today, and the Muse look translates to dark by token values rather than redesign.
- **Blocked work:** Phase 0 token work.

### SPEC-GAP 2: Rail style

- **Decision:** Is the rail icon-only with tooltips (the Muse rail), or icon plus short label?
- **Options:** icon-only | icon + label
- **Recommendation:** icon-only, matching the approved clone. Scott knows his thirteen sections by icon and position; labels are what the More panel and tooltips are for. The mobile bottom bar is icon-only either way.
- **Blocked work:** Phase 1 shell.

### SPEC-GAP 3: Phone bottom-bar fifth slot

- **Decision:** The bottom bar holds Today, Plan, Tasks, Money, and More in this plan. Should Health take a slot (replacing one of these or making the bar six slots), or stay in More?
- **Options:** current five (Health in More) | swap Money for Health | six slots
- **Recommendation:** current five. Money is a daily check; Health is reached several times a day around workouts and meals, but its Log actions also surface on Today. Judge it on the blueprint, where the bar is clickable.
- **Blocked work:** Phase 1 shell (easily changed later; it is data, not structure).

### SPEC-GAP 4: First page after the shell

- **Decision:** Phase 2 migrates Today, then Planner, then Finance. Should Finance go first instead (it is the system of record for money and the page Scott checks most), with Today second?
- **Options:** Today first (sets the card language on the landing page) | Finance first
- **Recommendation:** Today first. Every other page copies its card language; setting it on the page Scott opens most often surfaces problems earliest.
- **Blocked work:** Phase 2 ordering only.

### SPEC-GAP 5: Task detail: panel, page, or both

- **Decision:** This plan keeps both: panel from lists, full page at `tasks/:id` for deep links. Should the route instead redirect into the Reminders page with the panel open (one surface only)?
- **Options:** both (panel + route) | route redirects to panel
- **Recommendation:** both. Reminders and notifications already deep-link to the route; breaking those links to save one rendering path is a bad trade.
- **Blocked work:** Phase 2 Planner/Tasks work.

### SPEC-GAP 6: Icon language

- **Decision:** Keep Font Awesome (current `fa-*` classes everywhere) inside the new visual system, or replace the icon set with the clone's drawn-icon language as part of the migration?
- **Options:** keep Font Awesome | replace during page migration
- **Recommendation:** keep Font Awesome in Phases 0 to 2 (it is consistent, loaded, and not what makes the current UI feel cluttered), then decide with the blueprint in hand. Replacing icons page by page later is mechanical; replacing them during the shell phase couples two risks.
- **Blocked work:** nothing in Phases 0 to 2; a later decision before Phase 3 closes.

### SPEC-GAP 7: Status panel tabs

- **Decision:** Which of the translated Status tabs ship in Phase 1: Upcoming, Approvals, Activity, Identity? Approvals depends on which pending-review surfaces Scott wants gathered (Orbit review proposals are the clear existing source).
- **Options:** all four | Upcoming + Activity only in Phase 1, Approvals and Identity added when their sources are confirmed
- **Recommendation:** Upcoming + Activity in Phase 1 (both have clear existing data), Approvals when Scott names its sources, Identity as a simple profile summary in Phase 4. No tab ships empty or invented (QF-5).
- **Blocked work:** the Status view of the panel in Phase 1.

### SPEC-GAP 8: Content widths

- **Decision:** This plan uses two width classes (reading and data). Is that the right call, or should every page use the single Muse column width for strict consistency?
- **Options:** two widths | one column width everywhere
- **Recommendation:** two widths. The Planner calendar, Finance tables, and Health charts cannot honour both the single narrow column and their data. The frame, cards, and spacing stay identical; only the measure changes.
- **Blocked work:** Phase 0 tokens, blueprint layout.

### SPEC-GAP 9: Public site scope

- **Decision:** This plan covers the signed-in admin app only. Should the public site (home, guide, games) be restyled to match in a later phase, or left as its own thing?
- **Options:** admin only, decide public later | add a Phase 5 for the public site
- **Recommendation:** admin only for this rewrite. The public site has different visitors and its own working chrome; mixing it in doubles the surface before the first job report.
- **Blocked work:** none; scope confirmation only.

## Ordered task checklist

### Docs and approval (this phase)

- [x] Inspect the repo startup docs, the design system records (DR-013, DR-017, DR-019, DR-025), the shell, routes, and every admin page.
- [x] Inspect the Muse UI clone export and extract the patterns being adopted.
- [x] Write this executive plan with the mapping, inventory, phasing, pseudocode, risks, and open questions.
- [x] Scott answers the SPEC-GAP decisions or approves the document with its recommendations. (2026-10-21: "approval on both"; recommendations adopted.)
- [x] Interactive HTML blueprint built from this plan and walked through with Scott (the before/after visual reference, approved 2026-10-21).
- [x] Scott gives the repository's exact implementation approval ("go" or "I approve") for Phase 0. (Covered by the 2026-10-21 approval of both plans.)

### Build phases (after approval, each separately gated)

- [x] Phase 0: fonts and tokens; ledger decision superseding DR-013's fonts; visual pass. (Built 2026-10-21, local commit; see build record.)
- [x] Phase 1: shell (rail, More, bottom bar, panel host, Settings dialog host, palette restyle); job report. (Built 2026-10-21, local commit; see build record. Deploy awaits Scott's go after review.)
- [ ] Phase 2: Today, Planner, Finance; job report.
- [ ] Phase 3: Health, Vault, People host frame, Bin; job report.
- [ ] Phase 4: long tail, Settings full dialog conversion, final sweep; job report.

## Next gate: interactive blueprint

Per Scott's Build Process, this executive plan does not go straight to code. The next deliverable is ONE interactive HTML blueprint file, built from this plan, that Scott clicks through and reads before approving any build. It is not built in this docs phase; it comes back to Scott first.

One thing the blueprint does **not** need to do: re-litigate the Muse look. Scott already approved that look by approving the clone. The blueprint's job is narrower and more important: **approving the mapping of his app into it.** Every screen in the blueprint is a heyScottyBro screen wearing the new shell, with his real sections, his real data shapes, and his real workflows, so what he approves is "my app, arranged this way," not "a style I liked somewhere else."

The blueprint must show, at minimum:

1. **The rail with his sections:** the slim rail with Today, Plan, Tasks, Money, Health, People pinned, Search, and the bottom menu; the More panel open showing Work, School, Life, Analytics, Mission Control, Vault, Bin, Arcade; a hidden section demonstrably absent from both lists. The Settings dialog opened from the rail, with his real settings groups in the left pane.
2. **Four key pages fully mocked in the new shell with realistic content** (his own data shapes and figures, clearly sample data):
   - **Home / Today:** the reading-width column of summary cards (day brief, upcoming, bills with DM Mono figures, spaces), counts on every list card.
   - **Planner:** the calendar at data width, an event selected, and its detail in the slide-in panel, including a linked-person chip and the pre-hangout brief state of the panel; the phone arrangement with the panel as a sheet.
   - **Finance:** stat cards with DM Mono figures, the Bills & Income and Receipts tabs, a transaction list read-first with Edit opening the modal state (shown, not functional), planned-versus-actual presented exactly as the current page computes it.
   - **Health, Food Log tab:** the day view read-first (entries as summary rows with per-item figures), Log food / Log weight buttons opening their modal states, the targets summary card; plus one glimpse of the Workouts tab so the chart cards are judged too.
   - **Documents (Vault):** the Library arrangement: section sidebar (All, Agent work, tags), sort control, card grid, one card's menu open, and a document preview in the detail panel.
3. **The slide-in detail panel as a pattern:** the same panel hosting, in turn, a task detail (from a Reminders list), an event brief, and a document preview, with the read-first view and its single Edit action visible; Frodo's dock shown closed while the panel is open, demonstrating the one-right-surface rule.
4. **Mobile:** the bottom bar (Today, Plan, Tasks, Money, More), the More sheet open with all sections, the detail panel as a full-screen sheet, and the phone top bar with Search and Frodo.
5. **The pseudocode hotspots in plain language beside the screens they govern:** rail/More derivation from `NAV_ITEMS` plus the hidden-pages filter; panel open/close, mutual exclusion with Frodo, and focus return; the per-page migration invariant (same data, same actions, presentation only).
6. **The People page honestly framed:** the new shell around Orbit's current internal UI (as it really looks through the token mapping), labelled as such, so the DR-017 boundary is approved with eyes open.

**Gate rule:** no project generation happens until Scott has seen the blueprint, understands it, and approves. His repo approvals ("go", "I approve") apply at this gate, per phase. The SPEC-GAP decisions should be settled by or at the blueprint walkthrough; several (rail style, bottom-bar slots, widths, Status tabs) are easiest to judge on screen.

**Completion document:** each build phase closes with the Build Process job report (one page: how it went, where the project is, where it needs improvement), delivered in chat and filed in heyscottybro Documents. No separate completion PDF is produced for this docs phase.

## Implementation record for this docs phase

- **Files changed:** `docs/features/muse-ui-rewrite.md` only (this file).
- **Application code changed:** none.
- **Migrations:** none created and none run.
- **Production data:** none read through a live service and none written.
- **ACTIVE_WORK.md and WORKLOG.md:** not edited in this phase (concurrency rule; other agents are writing feature records that touch them). Follow-up owed in the coordination phase: add the Muse-UI Rewrite to `ACTIVE_WORK.md` with this document as its feature record, and a `WORKLOG.md` entry for the docs phase. A ledger decision superseding DR-013's font choice is also owed, scheduled for Phase 0 so it lands with the change it describes.
- **Existing working tree:** preserved. At inspection, the branch was `main` tracking `origin/main`, with pre-existing modifications to `AGENTS.md`, `docs/development/WORKLOG.md`, `ledger.jsonl`, `src/components/TaskFormModal.jsx`, `src/pages/HomePage.jsx`, and `src/pages/admin/TaskDetailPage.jsx`, plus untracked `docs/features/brain-dump.md`, `docs/features/connected-pages.md`, `docs/features/task-priority-field.md`, and `supabase/migrations/2026-10-18-task-priority.sql`. None of those files was changed by this docs phase.

## Validation

- **Automated:** Not run. This phase changes documentation only.
- **Code inspection:** Completed against `AGENTS.md`, `docs/README.md`, `docs/development/ONBOARDING.md`, `WORKFLOW.md`, `ACTIVE_WORK.md`, `PSEUDOCODE_STANDARD.md`, `DOCS_STYLE.md`, `CLAUDE.md`, `ledger.jsonl` (DR-013, DR-017, DR-019, DR-020, DR-021, DR-025, DR-031), `src/App.jsx`, `src/pages/admin/adminRoutes.jsx`, `AdminLayout.jsx`, `AdminShell.jsx`, `VaultPage.jsx`, `PlannerPage.jsx`, `HealthPage.jsx`, `BudgetPage.jsx`, `src/styles/globals.css`, and `src/styles/system.css`.
- **Design reference inspection:** Completed against the exported clone at `~/workspace/your_files/muse-ui-clone/muse-ui-clone.html` (views: chat, feed, ideas, goals, library; rail, status panel, search overlay, mobile bar all present in the file).
- **Desktop visual check:** Not applicable to a feature design document and not run.
- **Mobile visual check:** Not applicable to a feature design document and not run.
- **Known limitations:** Page interiors were inventoried from source, not from a rendered walkthrough of every page; any layout behaviour that only appears with real data (very long lists, empty states in production shape) should be re-checked during the blueprint, which uses realistic content. The live app may have changed since the 2026-10-21 inspection if other approved work landed in between.

## Build record: Phase 0 + Phase 1 (2026-10-21)

**Approval:** Scott, 2026-10-21: "approval on both" (this rewrite's executive plan and Connected Pages). SPEC-GAP recommendations adopted as written. Scope of this build unit: Phase 0 and Phase 1 only. Local commits only; no push, no deploy, no migration, no production data.

**Baseline before any change (working tree as found, 2026-10-21):**

- `npm test`: full pass (final block 333/333; all blocks green). Note on evidence: the first baseline capture delivered to the build agent showed two `chatRoute.test.js` admin-gate failures, but the log that run wrote to disk records a full pass, the test passes standalone (4/4), and the Phase 0 full-suite run is also fully green. The anomalous capture was not reproducible; the on-disk logs are the baseline of record.
- `npm run lint`: pass, zero warnings.
- `npm run build`: pass.
- Phase 0 result: lint pass, `npm test` full pass (333/333 final block), build pass; built CSS carries the DM Sans token and no Roboto Slab remains in the built CSS, `globals.css`, or `index.html`.

**Ordered steps:**

- [x] 1. Startup reads (AGENTS.md, docs index, onboarding, workflow, active work, CLAUDE.md, ledger, this plan, the approved before/after visual, the Muse clone) and shell-code inspection (AdminLayout, AdminShell, adminRoutes, globals.css, system.css, SettingsPage, CommandPalette, ChatBot toggle contract).
- [x] 2. Baseline test, lint, and build runs recorded above.
- [x] 3. Approval and this build recorded (this section, ACTIVE_WORK.md, WORKLOG.md); ledger DR-032 appended, superseding DR-013's font choice only.
- [x] 4. Phase 0: font tokens repointed to DM Sans / DM Mono in `globals.css`; serif stack deleted; shell tokens added (rail width, panel width, reading width, card radius, clone accent in both scopes); `people-orbit.css` font mapping aligned; Roboto Slab dropped from the `index.html` font request (DM Sans 700 added for headline weights); header metrics (weight 500, -0.015em, 1.12) applied in the `system.css` base heading rule.
- [x] 5. Phase 0 verification: lint, tests, build against baseline (all pass; see baseline note). Route-load smoke pass runs with Phase 1 verification (step 7), since the shell is what changes route framing.
- [x] 6. Phase 1: `AdminLayout.jsx` rebuilt as the Muse shell (icon rail, More popover, rail menu, phone top bar + bottom bar + More sheet, Settings dialog host, detail-panel host via `DetailPanelContext`, Status view shell); `system.css` shell section rewritten in place (sidebar/drawer/collapse retired); Cmd-K palette restyled as the Muse search overlay.
- [x] 7. Phase 1 verification: lint pass, `npm test` full pass (333/333 final block), build pass. Production-preview smoke pass: all 15 main admin routes (`today, planner, reminders, work, finance, school, life, health, people, mission, analytics, vault, bin, arcade, settings`) returned HTTP 200; the built layout chunk carries the new shell markers (`bottombar`, "Open status panel") and `adminRailCollapsed` appears nowhere in the built JS; `SettingsDialog` ships as its own lazy chunk. Not verified: signed-in rendered behaviour at desktop and phone widths (the preview is auth-gated and no session was available); that check is Scott's review gate before deploy, as with prior work in this repo.
- [x] 8. Records closed (this record, WORKLOG.md, ACTIVE_WORK.md, CHANGELOG.md); local phase commits; diff reviewed. Push/deploy waits for Scott.

**Phase 0 result:** commit `7954182`. Files: `src/styles/globals.css` (font tokens, shell tokens), `src/styles/system.css` (base heading metrics), `index.html` (font request), `src/pages/admin/people-orbit.css` (Orbit token mapping fonts), this document, `docs/development/ACTIVE_WORK.md`. Ledger DR-032 and the WORKLOG entries are recorded in the working tree; their files also carry the prior session's uncommitted DR-031 / Brain Dump appends, so they were left uncommitted rather than sweeping another work unit's records into this commit.

**Phase 1 files:** `src/pages/admin/AdminLayout.jsx` (rewritten shell), `src/contexts/DetailPanelContext.jsx` (new), `src/components/DetailPanel.jsx` (new host), `src/components/StatusPanel.jsx` (new Status view shell), `src/pages/admin/SettingsDialog.jsx` (new), `src/styles/system.css` (shell section, panel/dialog/sheet styles, palette restyle, pressed-state and small-screen updates), `src/styles/globals.css` (retired `--sidebar-w` tokens), `CHANGELOG.md`.

**Phase 1 behaviour notes:**

- Rail derivation follows the plan's pseudocode: pinned = Plan, Tasks, Money, Health, People (Today is the brand anchor), More = Work log, School, Life, Analytics, Mission Control, Vault, Bin, Arcade; the hidden-pages setting filters both by route; the More button takes the active treatment when the current route is one of its sections. Phone bottom bar: Today, Plan, Tasks, Money, More (icon-only, per SPEC-GAP 2); the More sheet carries the remaining pinned sections (Health, People) plus the full More list, Search, Settings, View site, Log out.
- The detail panel and Frodo's dock are mutually exclusive in both directions (panel open dispatches Frodo's existing toggle; Frodo opening closes the panel). The panel traps focus, closes on Esc, and returns focus to the invoking control. Panel and Settings dialog close on navigation.
- The Status view ships as a shell: profile summary plus Upcoming and Activity tabs whose bodies state plainly that they fill in with their source phases (SPEC-GAP 7's phased recommendation; the Approvals tab is not rendered until Scott names its sources).
- Settings dialog hosts the existing `SettingsPage` unchanged (its own page header is hidden inside the dialog, which titles it); `/admin/settings` still renders full-page.
- Frodo's phone trigger, unread dot, Cmd-K handling, page-usage tracking, the Orbit host listeners in `AdminShell.jsx`, and every route are untouched.

**What Phase 2 will need:** Today's card migration onto the new card primitives (and retiring `today.css`), Planner's event/task detail moving into the panel (the host and context are ready; `TaskDetailPage` content is the first panel integration), Finance stat cards with DM Mono figures, per-page header weight normalization (specific header rules still set 600/700 until their page phase), and Scott's rendered review of Phases 0+1 before any push.

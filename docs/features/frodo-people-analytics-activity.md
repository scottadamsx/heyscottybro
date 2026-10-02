# Feature: Frodo previews, People integrity, analytics, and activity history

**Status:** Released — migration remains separately gated
**Owner:** Scott
**Started:** 2026-09-30
**Last reconciled:** 2026-10-01
**Session:** `SAI00000003`
**Approval:** Scott approved this recorded contract and pseudocode with exact **“go”** on 2026-10-01. This authorizes the listed application-code work and additive migration files. It does not authorize applying a production migration, changing dependencies, committing, pushing, deploying, deleting or changing production data, or making a live AI request.

## User problem

Frodo image previews can become unusable, a People event contains an incorrect attendee, the retired Bug Tracker still appears throughout the product, and the app lacks one truthful place for cross-domain analytics, page-use measurement, and activity history.

## Desired outcome

Make saved chat images recoverable and honest, protect People-event attendee integrity while preserving the existing manual management flow, remove the obsolete Bug Tracker product surface without touching its old records, and add private analytics and activity history that clearly distinguish existing historical evidence from measurements that begin only after release.

## Evidence-backed current behavior

### Frodo attachments

- `ChatBot` accepts picker, drop, and paste images, normalizes supported formats, shows local data-URL thumbnails, stages private objects, and sends image bytes independently of storage success.
- Persisted `agent_sessions` rows contain versioned attachment path and media metadata, never image bytes. Hydration creates one-hour signed URLs for those private paths.
- Saved previews have no rendered-image error state and no re-sign or retry path. A signed URL that expires while a chat stays open can leave a broken image until the complete session is rehydrated.
- Attachment storage is still imported from `bugsApi.js`. The live chat-storage lifecycle therefore depends on a module that also owns the retired `bugs` collection.
- Existing pure tests cover serialization, hydration, ownership, and storage operations, but not the assembled `ChatBot` rendering path or a real image-element failure. This overlaps the direct-composition gap already recorded as `BUG-055`.

### People events

- People is a synchronized Orbit application. The checked-in `orbit/` directory is a read-only copy; source changes belong in the clean sibling Orbit repository and must be committed there before synchronization under `DR-017`.
- Each event is an independent owner-scoped `orbit_events` row. The inspected create/edit form produces new attendee arrays, uses a new event ID, remounts for each modal entry, validates people IDs, and rolls optimistic writes back on failure.
- The current desktop and 390-by-844 mobile UI already exposes Edit and Delete. Edit opens with the event's current attendees; Delete requires an explicit event-and-date confirmation. No live record was changed during inspection.
- The affected Workout event visibly contains four attendees. The inspected UI/state/repository paths do not show shared mutable selection state, reused event IDs, a bad join, or a missing form reset.
- Orbit's AI tool intentionally merges people into an existing same-date, same-kind, same/overlapping-title occasion unless the request says it is a different occasion. Imports also trust each supplied attendee list. The stored event has no immutable creation provenance or before/after audit, so the exact historical writer cannot be proved from current data. The leading evidence is incorrect AI/import input or the same-occasion merge, not the manual event form.

### Retired Bug Tracker

- Mission Control still renders a Build/Bug Tracker page and the dashboard still reads its open count.
- Frodo still advertises and exposes `log_bug` and `export_bugs`, the AI Library still registers a writable `bugs` collection, and chat suggestions still refer to bug logging and export.
- The legacy page is functional but contains stale and contradictory reports. It is not an authoritative product backlog.
- The private `bug-screenshots` bucket also carries active owner-scoped chat-staging objects. The product surface and `bugs` data access can be removed only after chat attachment storage is separated; the bucket and old records must remain untouched.
- No other page has been authorized as obsolete. This contract removes only the confirmed Bug Tracker surfaces.

### Analytics and history

- Mission Control's Usage tab already summarizes `agent_actions`. That work should be reused inside Analytics rather than duplicated.
- Real historical evidence exists for reminders, journals, calendar events, transactions, accountability logs/misses, food, weight, workouts/sets, People events, projects, and AI tool actions, but timestamp precision differs by source.
- `agent_sessions` has only a row `updated_at`; individual display messages have no timestamps. Historical per-turn chat activity cannot be reconstructed.
- There is no page-visit or active-time store. Historical page use cannot be reconstructed.
- Current People rows do not preserve who created/changed/deleted an event or earlier versions. Past event mutations cannot be reconstructed.
- Existing `LineChart`, budget analytics, Usage summaries, and house UI primitives can support the new page without a chart dependency.

## Scope

### Included

- Move live chat attachment storage behind a neutral module while preserving the private bucket, owner-scoped paths, accepted formats, cleanup rules, and persisted metadata contract.
- Restore or refresh signed saved-preview URLs after expiry/failure, show an honest per-image failure state, and add assembled rendering regressions for pre-send and post-hydration thumbnails.
- Preserve the existing Orbit event Edit and confirmed Delete UI; add regression coverage for fresh event IDs, attendee isolation, reopening/reset, save rollback, delete cancellation, and successful mutation.
- Prevent accidental same-occasion attendee expansion unless the tool request explicitly opts into merging, and record future People-event provenance without attempting to rewrite the affected historical record automatically.
- Remove the Mission Build/Bug Tracker surface, dashboard bug pulse, `bugs` AI Library registration, bug CRUD/export tools, bug suggestions, and live imports of the retired data API.
- Leave the legacy `bugs` table, its records, and the private storage bucket untouched.
- Add top-level Analytics and move the existing AI Usage material into it. Remove the duplicate Mission Usage tab after its content is represented in Analytics.
- Add Today, 7-day, 30-day, 90-day, and All available data ranges with clear source/precision notes and useful empty, partial, loading, and error states.
- Add forward-only, owner-scoped activity events and page-usage sessions with minimal privacy-safe metadata, idempotent writes, and bounded reads.
- Add reusable Activity History that combines truthfully derivable legacy entries with new immutable activity events without double counting.
- Instrument the canonical successful mutation boundary for approved domains, including Orbit through its source repository and synchronized copy.

### Not included

- Reading, migrating, repairing, converting, deleting, or writing the dead `bugs` collection.
- Automatically correcting or deleting the known People event. Scott can use the existing Edit flow; a production-data change needs separate explicit approval.
- Granting Frodo unrestricted People delete authority. Manual UI deletion remains confirmed; any future assistant delete tool is separate product work.
- Guessing which additional pages are obsolete.
- Fabricated historical page visits, chat turns, edit history, deleted records, or exact times for date-only rows.
- Journal bodies, chat bodies, attachment contents, access details, full URLs, search text, entity-specific route IDs, or notes in telemetry/activity metadata.
- Fixing unrelated amount-unit inconsistencies, data-model debt, or other defects found during implementation.
- Dependency changes, applying migrations, production writes/deletes, commit, push, deployment, or live AI/API calls without their required approvals.

## Product and architecture decisions in this proposal

Approval of this contract accepts these defaults:

1. Analytics is a top-level `/admin/analytics` destination because it spans the product; AI Usage becomes one Analytics section instead of a second competing page.
2. Only Bug Tracker is removed. Other low-use pages remain until Scott names them or forward page telemetry provides evidence.
3. People event management remains manual and confirmed in Orbit. Frodo may read People data, but this feature does not add an assistant delete tool.
4. AI same-occasion matching may reuse an event only when the tool request explicitly sets a merge intention; title/date similarity alone may not add attendees.
5. A visit is stored after at least three seconds of active time. Active time pauses whenever the document is hidden, the window is unfocused, or there has been no input for 60 seconds.
6. Analytics labels page use, activity events, and chat turns **Since tracking began**. “All available data” never implies coverage before a source existed.
7. New schema is additive and owner-scoped. Migration files can be written after feature approval, but production application remains a separate approval gate.

## Data contracts

### `activity_events`

- `id uuid primary key`
- `user_id uuid not null`
- `idempotency_key text not null`; unique per owner so a retried successful action cannot double-log
- `event_type text not null`; stable versioned vocabulary such as `task.created`, `task.completed`, `habit.logged`, `journal.created`, `transaction.created`, `workout.completed`, `people.event.created`, `people.event.updated`, `people.event.deleted`, and `chat.turn.sent`
- `entity_type text not null`, `entity_id text null`, and a short safe `entity_label text null`
- `occurred_at timestamptz not null`, `source text not null`, `schema_version integer not null`, `metadata jsonb not null default '{}'`, and `created_at timestamptz not null`
- Owner-only RLS; indexes by owner/time and owner/type/time
- Metadata allowlist only. It may contain non-sensitive category/status identifiers, date precision, and normalized numeric totals; it never contains journal/chat text, attachment data, notes, secrets, account numbers, or raw route data.

### `page_usage_sessions`

- `visit_id uuid primary key`, `user_id uuid not null`, `route_key text not null`
- `started_at timestamptz not null`, `ended_at timestamptz not null`, `active_ms bigint not null`, `last_seen_at timestamptz not null`
- `schema_version integer not null`, `created_at timestamptz not null`, `updated_at timestamptz not null`
- Owner-only RLS; indexes by owner/start time and owner/route/start time
- `route_key` comes from a fixed route taxonomy such as `people`, `person_detail`, and `people_event`; it never contains a person/event ID, query, hash, search, or full URL.
- One client-generated visit ID is upserted throughout a visit. Route change finalizes the prior visit and starts another; refresh starts a new visit. A versioned local pending queue retries offline/close-boundary checkpoints without duplicate rows.

### Historical adapters

- Existing records are transformed at read time into stable synthetic entries such as `legacy:reminder:<id>:completed`; source, precision (`exact` or `date_only`), and limitations remain attached.
- Legacy derivation stops at the tracking-start cutoff for event types now emitted to `activity_events`, preventing a current row and its new event from appearing twice.
- Deleted historical entities are not invented. New deletion events keep only a safe label snapshot and render without a link.

## Analytics contract

- **Overview:** active days from available sources, recorded actions, completed tasks, habit completion, and tracked page active time.
- **Tasks and reminders:** created, completed, completion trend/rate, and current overdue snapshot with denominator notes.
- **Habits:** logs, misses, completion against truthfully derivable due opportunities, and streak/trend where the existing schedule supports it.
- **Journal:** entry count and active days only; no text analysis.
- **Money:** income, spending, net, and categories using the existing finance normalization and integer-cent presentation boundary.
- **Workouts:** completed sessions, duration, sets, volume, and exercise frequency.
- **Meals and weight:** meals, calories/protein where stored, latest weight, change, and trend.
- **People:** events/interactions, unique people, type/channel/status breakdown, and date trend.
- **Projects:** created/current projects and recorded work-log minutes only; no invented progress percentage.
- **AI:** existing tool actions, errors, agents, and top tools from `agent_actions`; chat-turn totals only after `chat.turn.sent` starts.
- **Pages:** visits, active time, top route keys, and return frequency only since tracking began.
- Every repeated-row card follows `DR-025`: `N`, `N of M`, `0`, or no count while unresolved/error.

## Experience contract

- Desktop uses the existing admin shell, accessible cards, range controls, and charts. Analytics must not create a separate visual system.
- Mobile preserves the current stacked People event modal and touch-safe Edit/Delete actions; analytics cards/charts stack without horizontal page overflow.
- The Analytics range control and section filters are keyboard reachable and have one announced selected state.
- Charts have a visible summary and accessible text/table equivalent; color is not the only differentiator.
- Activity History groups by local calendar date, supports domain/action/source filters and safe-label search, preserves stable sort order, and links only when the current entity still exists.
- Loading, loaded-empty, partial, and error states are distinct. Partial-source failure names the unavailable section without discarding valid sections.
- Telemetry failure never blocks navigation or the user's primary mutation. It stays queued for bounded retry and surfaces only if user action is required.

## Acceptance criteria

### Frodo previews

- [ ] A supported image renders before send, remains usable by Frodo if staging fails, and renders from private saved metadata after reload.
- [ ] Expired or failed saved URLs receive one bounded owner-checked refresh; persistent failure becomes an accessible per-image fallback with retry, never a silent broken icon.
- [ ] Session storage contains no image bytes and no cross-owner path can be signed, rendered, cleared, or copied.
- [ ] Removing retired bug tools does not alter chat staging, hydration, send, evidence cleanup, or confirmed Clear behavior.
- [ ] A component-level regression exercises the assembled rendering boundary noted by `BUG-055` for this scoped path.

### People integrity

- [ ] Two new-event drafts receive different IDs and new attendee arrays.
- [ ] Opening, canceling, switching, reopening, and saving an event cannot retain another draft/event's attendee selection.
- [ ] Edit persists only the displayed event; failure restores prior state and stays actionable.
- [ ] Delete names the event/date, cancel is inert, confirm deletes only that event, and failure restores it.
- [ ] AI same-occasion matching never adds attendees without explicit merge intent; `different_occasion` always creates a separate event.
- [ ] New create/update/delete activity entries identify the safe event label and action without private notes.
- [ ] Orbit source tests/commit precede a clean synchronization into this repository.

### Retired Bug Tracker

- [ ] No navigation, dashboard card, prompt, tool, Library entry, suggestion, or production import reads or writes `bugs`.
- [ ] Old rows and the storage bucket are not queried, migrated, edited, or deleted.
- [ ] Active chat attachments continue through the neutral storage module with the same owner and cleanup protections.

### Analytics, page use, and Activity History

- [ ] Each metric maps to a named existing source or a clearly labeled tracking-start source; unsupported history is not shown as zero.
- [ ] Today/7/30/90/All boundaries are deterministic in the user's local timezone and date-only rows remain date-only.
- [ ] Page visits exclude hidden, unfocused, idle, and sub-three-second active time; route transitions, refresh, offline retry, pagehide, repeated heartbeats, and Strict Mode cannot double-count.
- [ ] Route keys cannot contain sensitive identifiers or arbitrary URL data.
- [ ] Canonical successful mutations emit at most one immutable activity event; failed or rolled-back writes emit none.
- [ ] Legacy and new events do not double-count at the rollout cutoff.
- [ ] Deleted entities render a safe fallback without a broken link.
- [ ] Analytics uses bounded/paginated owner reads, computes aggregates in pure tested utilities, and does not trigger one request per card.
- [ ] Existing AI Usage information remains available in Analytics before Mission Usage is removed.
- [ ] Desktop, 390-pixel mobile, keyboard, screen-reader semantics, loading, empty, partial, and failure states pass rendered verification.

## Edge cases

- A signed attachment URL expires while the chat stays mounted; a file is deleted; one attachment fails while siblings succeed; the owner changes during refresh.
- Multiple files have the same name; normalization completes after an agent switch; staging succeeds after a turn is canceled; Clear races hydration.
- A People event has zero or many attendees; a person was deleted; two events share date/title/type; an update changes the attendee set; two writes race.
- An optimistic Orbit save succeeds but activity logging fails, or vice versa. The Orbit server/RPC design must make the product write and activity event one atomic operation where both are required.
- A browser sleeps, changes system clock, backgrounds without `pagehide`, closes offline, replays a pending visit, or mounts an effect twice in development.
- A range crosses daylight-saving or year boundaries. Date-only records use local dates; exact timestamps use real instants.
- A source is unavailable or has more rows than one page. Analytics shows partial truth and continues bounded pagination rather than treating failure/truncation as zero.
- An entity is renamed or deleted after an activity event. History keeps its safe action-time label and only links when resolvable.

## Pseudocode

```text
RESTORE A SAVED CHAT IMAGE
  validate attachment metadata and established owner
  request a short-lived signed URL for that exact owner path
  render the image with an accessible loading state
  if the image element reports failure and refresh has not been tried
    request one fresh signed URL and render it
  if refresh fails
    preserve the attachment row and metadata
    show an honest unavailable-preview state with retry
  never persist bytes or accept a path owned by another account

REMOVE THE RETIRED BUG PRODUCT SURFACE
  first move staging/signing/cleanup wrappers into neutral chat attachment storage
  prove current chat attachment and Clear tests still pass
  remove Bug Tracker routes, cards, tools, catalog entries, suggestions, and imports
  never query, migrate, write, or delete legacy bug rows or their storage bucket

CREATE OR EDIT A PEOPLE EVENT
  open a fresh modal state copied from the selected event or blank defaults
  allocate a new ID only for a new event
  update attendees with new arrays
  validate every referenced person and normalize updates to attendees
  send one owner-scoped mutation
  atomically save the event and its one idempotent activity event
  on failure restore the prior event and keep an actionable modal state
  on close discard the draft

MATCH AN AI-SUPPLIED PEOPLE EVENT
  find same-day, same-kind, similar-title candidates
  if explicit different-occasion intent is present, create a new event
  else if explicit merge intent is present, update the named candidate
  else create a separate event and never append attendees by inference alone

DELETE A PEOPLE EVENT
  show the exact event label and date in a confirmation
  if canceled, change nothing
  if confirmed, atomically delete that one owner event and add one deletion activity event
  retain a safe action-time label for history but no private note content
  on failure restore the event and report that deletion did not complete

RECORD AN ACTIVITY
  receive a canonical successful mutation plus a stable idempotency key
  allow only registered event types and allowlisted metadata keys
  omit private bodies, notes, secrets, attachments, and raw routes
  write once under owner RLS at the canonical mutation boundary
  treat a retry with the same key as the same event

TRACK A PAGE VISIT
  map the current route to a fixed non-sensitive route key
  create one client visit ID and monotonic active-time accumulator
  count only while visible, focused, and not idle for 60 seconds
  pause immediately when any condition fails and resume with a new monotonic baseline
  checkpoint a versioned pending record locally and upsert it in bounded batches
  on route change finalize this visit and start another
  on pagehide store the final local checkpoint; replay it on the next load
  do not persist a visit with less than three active seconds

LOAD ANALYTICS
  resolve the selected local-time range
  load bounded owner-scoped source pages through one analytics API boundary
  convert exact timestamps and date-only values without inventing precision
  merge derived legacy facts with post-rollout activity events at the cutoff
  compute section aggregates in pure utilities
  render available sections and name unavailable or partial sections
  label forward-only metrics Since tracking began

LOAD ACTIVITY HISTORY
  page immutable activity events and truthfully derivable legacy adapters
  deduplicate them at the tracking-start cutoff
  filter by domain, action, source, safe label, and selected date range
  group by local day with stable newest-first ordering
  link a row only when its current entity route can be resolved
  otherwise show the safe deleted/unavailable-entity fallback
```

## Ordered task checklist

- [x] Step 1 — Verify the SAI identity and binding; read governing startup, workflow, quality, documentation, archive, active-work, prior-session, and decision records; inventory Git state.
- [x] Step 2 — Inspect relevant routes, components, API modules, schemas, migrations, tests, existing documentation, and the sibling Orbit source without changing application code.
- [x] Step 3 — Inspect the current authenticated desktop and 390-by-844 mobile People experience, including the affected event, Edit, and confirmed Delete; make no production write.
- [x] Step 4 — Record evidence-backed diagnoses, historical-data limits, architecture defaults, privacy/data-integrity risks, and genuine product decisions.
- [x] Step 5 — Finish this feature contract, acceptance criteria, edge cases, data proposal, and plain-language pseudocode.
- [x] Step 6 — Run planning-document, registry, JSON, privacy, whitespace, and repository-state checks; refresh the SAI00000003 archive and planning records.
- [x] Step 7 — Present this plan and receive Scott's exact `go` before any application-code edit.
- [x] Step 8 — After approval only, implement in recorded units: attachment decoupling/recovery; Bug Tracker removal; Orbit integrity; additive schema/data APIs; activity instrumentation; page telemetry; Analytics/History UI; regressions and rendered checks. The sibling Orbit source is validated but must be committed before its read-only copy is synchronized.
- [ ] Step 9 — Complete the post-task checklist and obtain separate approval for any commit, push, production migration, production write/delete, or deployment.

## Approved scope addition — Agents page

Scott requested: **“also remove the agents page I dont need them”** on 2026-10-01. This is not covered by the approved Bug Tracker-only removal and is ambiguous because Mission Control currently contains Agents, Brain, Inbox, and Research.

Scott accepted the recommended narrow scope with exact **“go”** on 2026-10-01: remove only the Agents tab/surface, make Brain the Mission Control default, and retain Brain, Inbox, and Research.

```text
SPEC-GAP
decision: Does “remove the agents page” mean only the Agents tab, or the entire Mission Control destination?
options: remove only the Agents tab and make Brain the Mission Control default | remove all of Mission Control, including Brain, Inbox, and Research
recommendation: remove only the Agents tab, its command-palette shortcut, and its direct product surface; keep Mission Control with Brain as the default plus Inbox and Research, because Scott named Agents rather than the whole Mission Control space
blocked-task: T-10 — Agents-page removal
```

Proposed pseudocode for the recommended option:

```text
REMOVE THE AGENTS PAGE
  remove Agents from Mission Control tabs and rendered routes
  make Brain the default Mission Control tab
  remove the Agents command-palette shortcut
  redirect or fall back old Agents/default Mission links to Brain
  keep Brain, Inbox, and Research unchanged
  add a regression proving Agents is absent and the retained tools still resolve
  run desktop/mobile rendered checks
```

- [x] Step 10 — Scott approved the recommended Agents-tab-only scope with exact **“go.”** Implement and validate that narrow removal without removing Brain, Inbox, or Research.

## Implementation record

- Files changed: approved application implementation is in progress across neutral chat attachment storage/recovery, retired Bug Tracker surfaces, Analytics/Activity History, page-use tracking, and the sibling Orbit event-matching source plus tests.
- Decisions: the seven recorded defaults were approved with exact **“go.”** Scott separately approved the narrow Agents-tab-only addition with exact **“go.”**
- Data/API changes: one additive owner-scoped analytics/activity migration file was written but not applied. No production record was changed.
- Live inspection: authenticated read-only desktop and 390-pixel Analytics checks passed, including the legacy Mission Usage redirect. The earlier People Delete confirmation was canceled.
- Agents removal: Mission Control now exposes Brain, Inbox, and Research only; Brain is the default, the Agents command shortcut is gone, and Morning Brief AI-action links lead to Analytics. Desktop and 390-pixel rendered checks confirmed all three retained tabs, no Agents tab, and no horizontal page overflow.

## Validation

- Automated: session registry reports three valid IDs and `SAI00000004` next; manifest, registry JSONL, and decision JSONL parse; sanitized transcript/summary scans contain no machine paths, private-key markers, service-role text, or JWT-like values; `git diff --check` passes.
- Desktop visual check: current People event detail, populated Edit flow, and explicit Delete confirmation inspected.
- Mobile visual check: 390-by-844 People layout and affected event modal inspected; event detail remains stacked and exposes Edit/Delete.
- Repository state before release: `main` began one commit ahead of `origin/main`; the complete implementation was committed as `7afd2d5`. Orbit was committed as `c5a1b8a`, synchronized, and both repositories were subsequently pushed. Post-release documentation is now the only uncommitted work.
- Current implementation validation: focused feature tests pass 48/48; sibling Orbit tests pass 136/136; full ESLint and the 3,148-module production build pass; `git diff --check` passes. The complete registered suite passes 279/280, with only the pre-existing Project Manager-owned registry fixture failing because it expects two sessions while the valid append-only registry contains three. The authoritative registry check passes with three IDs and `SAI00000004` next; that unrelated fixture was preserved.
- Rendered validation: authenticated desktop and 390-pixel checks pass for Analytics Overview/Activity History/AI Usage and Mission Control's retained Brain/Inbox/Research tabs. Activity History exposes domain/action/source/search filters, loaded mobile width is 390 pixels with no horizontal overflow, and the Agents tab is absent.
- Known limitations: the exact historical cause of the incorrect attendee cannot be recovered from current event data; the user's original private-image failure instant was not reproduced with a fresh attachment, although the established recovery path now has focused and assembled rendering coverage; forward page/chat/activity history cannot predate its instrumentation; the additive SQL migration was source-reviewed but not compiled or applied because no local Supabase/Postgres compiler is available and production application is unauthorized.
- Release boundary: the user-visible release is now recorded in `CHANGELOG.md`. The additive database migration remains unapplied, and no production record was written or deleted.
- Orbit source commit and sync: Scott said exact **“go commit”** for the presented two-file Orbit change. Commit `c5a1b8a` (`Require explicit event merge intent`) records the validated source fix; no push occurred. `node scripts/sync-orbit.mjs` synchronized that clean committed source into this repository and updated `orbit/VENDORED.md` to `c5a1b8a`. The copied tool is byte-identical to source, Orbit passes 136/136, the 51-test synchronized focused set passes, lint/build pass, and the registered suite remains 279/280 only because of reopened `BUG-058`.
- Main commit approval: after reviewing the settled 45-file scope, proposed message, Orbit hash, and validation results, Scott said exact **“go commit.”** This authorizes only the presented main-repository commit. Push, migration application, production writes/deletes, and deployment remain unauthorized.
- Main commit: commit `7afd2d5` (`Add private analytics and retire obsolete admin surfaces`) contains the approved 45-file change set. After a separate consequence review, Scott said exact **“go”** to authorize pushing both `orbit/main` and `heyscottybro/main`, including the expected automatic Vercel Production deployment from the main-app push. Database migration application and production-data writes/deletes remain unauthorized.
- Orbit push: `c5a1b8a` is published to `origin/main`.
- Main push: GitHub accepted `origin/main` through `7afd2d5` (from `7cc8db4`), and automatic Vercel Production deployment `6785320311` succeeded. The additive database migration remains unapplied.
- Hosted checks: GitHub Actions run `36867894281` completed with the already-recorded `BUG-058` registry-fixture failure; no new feature failure appeared.
- Release verification: Vercel reports deployment `6785320311` successful at exact SHA `7afd2d5`. The production homepage and `/admin/analytics` shell return HTTP 200; the deployed shell references the Analytics and Mission chunks, Analytics contains the released history/range/filter labels, and Mission contains Brain/Inbox/Research without Agents. Authenticated production interaction could not be completed from a fresh session because the visible Google sign-in method is disabled (`BUG-061`). The database migration remains unapplied, so forward-only activity/page sources correctly remain unavailable until separately approved.

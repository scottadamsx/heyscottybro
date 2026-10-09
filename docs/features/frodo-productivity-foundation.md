# Feature: Frodo productivity foundation

**Status:** Resolved locally — no database migration
**Owner:** Scott
**Started:** 2026-10-09
**Approval:** Scott reviewed the proposed retrieval-and-operations roadmap and said “go” on 2026-10-09.

## Purpose

Make Frodo materially faster and more reliable at answering planning questions by giving it occurrence-aware planner reads, a first-class cross-collection search, and richer safe query filters. Preserve the existing deliberate confirmation boundary for deletes.

## Current findings

- The UI already expands recurring reminders and events in `plannerUtils`, but the Library query filters seed rows, so an agent can miss a recurring occurrence in a requested date range.
- `consult_archivist` can search across domains, but it starts a nested agent turn rather than providing a direct, parallel, source-ranked read tool.
- Library `where` is exact-match only. It cannot express ranges, membership, substring conditions, or OR clauses.
- Brain queries load the whole graph before filtering. Semantic/vector retrieval, keyed fact memory, and truly atomic multi-record writes require schema/server work and are deferred from this no-migration unit.

## Scope

### Included

- Add an opt-in occurrence expansion mode to Library queries for reminders and events.
- Add a read-only `global_search` tool that searches appropriate collections in parallel and returns compact, cited matches.
- Extend `query.where` with an allow-listed operator DSL: equality, `in`, `gt`, `gte`, `lt`, `lte`, and `contains`; add OR groups with the same validation.
- Preserve exact-match behavior and current pagination, redaction, ownership, and fallback semantics.
- Add focused tests for recurrence, filters, global-search ranking/error isolation, and no-secret exposure.

### Explicitly deferred

- Database migrations, RPC transactions, vector embeddings, or changes to production data.
- A fake client-side “atomic batch write.” Real all-or-nothing writes need an approved transaction/RPC migration.
- Replacing the context schema with keyed facts.
- Configurable notifications or autonomous external actions. The existing daily cron/email brief remains unchanged.
- Weakening delete confirmation. A later action-authorization receipt must be separately designed and approved.

## Experience contract

- Asking “what is on 2026-10-22?” can return recurring instances that occur that day, with the source record ID retained.
- Asking “what do we know about X?” can use one read-only tool instead of a nested agent just to gather context.
- Search results identify their collection, record ID, matched field/text, and source URL when one is stored; they never reveal redacted secret values.
- Invalid fields or operators fail before a query runs. A failed collection does not suppress matches from other collections and is reported honestly.
- This is tool-layer work only; there is no new visual control or repeated list card.

## Acceptance criteria

- [x] `query` can expand reminder and event occurrences within an explicit inclusive date range without changing raw stored records.
- [x] Expanded results retain a source ID and expose occurrence metadata; non-expanded reads remain unchanged.
- [x] `global_search` searches multiple safe collections concurrently, respects ownership/redaction, and returns deterministic compact rankings plus collection errors.
- [x] Rich filters are validated per collection and work on server-backed and fallback-loader paths.
- [x] Unsupported operators, malformed values, and unknown fields fail safely.
- [x] Delete confirmation remains explicit; no batch write or schema migration is introduced.
- [x] Focused tests, lint, full tests, and build are recorded.

## Pseudocode

```text
WHEN an agent calls query with expand_occurrences true
  REQUIRE collection is reminders or events
  REQUIRE date_from and date_to are valid local calendar dates
  LOAD the smallest safe candidate set using existing ownership-scoped reads
  EXPAND candidates with the existing planner recurrence utility
  KEEP only generated occurrences inside the requested inclusive range
  RETURN compact rows with source_id, occurrence_date, and span metadata
  NEVER write generated occurrences back to storage

WHEN an agent calls query with a rich where or OR condition
  VALIDATE every field is allowed for that collection
  VALIDATE each operator and value type
  APPLY supported conditions server-side where representable
  APPLY the identical predicate after a legacy/local fallback load
  RETURN the existing rows/count/summary shape and paging metadata

WHEN an agent calls global_search
  NORMALIZE the search text and reject an empty request
  SELECT only safe searchable collections; exclude secret-revealing shelves
  SEARCH those collections concurrently using compact projections
  ISOLATE a collection failure into an errors array
  RANK exact title/name matches ahead of other substring matches
  RETURN compact source-labelled results, errors, and an honest total

WHEN an agent asks to delete data
  KEEP the existing target preview and explicit confirm:true requirement
  DO NOT infer authorization from a previous operation or from this feature

TEST occurrence, exact/filter/operator/OR/error/redaction paths
  ASSERT raw records are unchanged
  ASSERT fallback and table-backed paths agree on predicate semantics
  ASSERT a failed search shelf does not hide other results
```

## Ordered task checklist

- [x] Step 1 — Record the approved contract, risks, and no-migration boundary.
- [x] Step 2 — Implement and test occurrence-aware reads.
- [x] Step 3 — Implement and test validated rich filters.
- [x] Step 4 — Implement and test direct global search.
- [x] Step 5 — Run full validation, review the diff, and complete durable records.

## Implementation record

- Files changed: `src/api/aiQueryCore.js`, `src/api/aiLibrary.js`, `src/api/aiTools.js`, `src/api/aiTiers.js`, `src/utils/plannerUtils.js`, their focused tests, and `package.json` test registration.
- Data/API changes: Tool schemas only; no migration or stored-data change. `query` accepts `expand_occurrences`; `global_search` is read-only; `where` accepts the documented bounded operators.
- Decisions: Broad discovery excludes Vault snippets and agent audit records. Vault must still be queried explicitly when Scott asks for a saved secret/link. Rich predicates deliberately use the same authenticated fallback predicate across data paths instead of pretending every operator has an equivalent PostgREST translation.
- Related correction: recurring multi-day events now repeat their full span per recurrence instead of treating the original span as permanent.
- Deferred architecture: batch RPC, keyed facts, hybrid retrieval, and proactive-rule delivery need separate approved contracts.

## Validation

- Automated: `node src/utils/plannerUtils.test.js` (24/24), `node --test src/api/aiQueryCore.test.js src/api/aiLibraryGlobalSearch.test.js` (6/6), `npm run lint`, `npm test` (322/322), `npm run build` (3,156 modules), and `git diff --check` passed on 2026-10-09.
- Visual: No UI changed. Browser-backed authenticated agent-tool exercise remains untested because the available browser providers cannot open the local server; no live/private data query was attempted.
- Known limitations: Rich predicates and occurrence expansion load the authenticated collection locally to keep semantics identical to the offline/fallback path. Full-text/vector Brain retrieval, atomic batches, structured context facts, and proactive rule delivery remain separate approved-work candidates.

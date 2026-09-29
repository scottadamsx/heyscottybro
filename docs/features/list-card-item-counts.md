# Feature: List-card item counts

**Status:** Complete — governing rule added, uncommitted  
**Owner:** Scott  
**Started:** 2026-09-29  
**Approval:** Scott said exact **“go”** after reviewing the count behavior.

## User problem

Cards that contain rows of items make the user count the rows manually. The page should always answer “how many?” at a glance.

## Desired outcome

Every settled card that displays a row-based list shows a small, readable count derived from the same collection used to render those rows.

## Scope

### Included

- A permanent design and development rule for list cards.
- `N` when the complete collection is visible.
- `N of M` when filtering, truncation, pagination, or a display limit shows only part of the collection.
- `0` for a successfully loaded empty collection.
- Accessible count text that updates whenever the rendered collection changes.

### Not included

- A retrofit of every existing screen in this documentation-only work unit.
- Cards without repeated list rows, charts without row lists, forms, or unresolved loading/error placeholders.
- Product-specific placement decisions beyond keeping the count small, readable, and associated with the list heading.

## Acceptance criteria

- [x] The rule is present in the governing implementer rules.
- [x] UI quality gates require count accuracy checks.
- [x] The feature template prompts authors to specify list counts.
- [x] The rule distinguishes complete, partial, filtered, empty, loading, and error states without inventing a number.
- [x] The approval and rule are recorded in the work log and decision ledger.

## Pseudocode

```text
WHEN a card renders a settled collection as repeated rows
  DERIVE visible_count from the exact rows being rendered
  DERIVE total_count from the complete loaded collection before display limiting
  IF every loaded row is visible
    SHOW visible_count as a small count beside the list heading
  ELSE
    SHOW "visible_count of total_count"
  IF the loaded collection is empty
    SHOW 0
  UPDATE the count whenever rows, filters, pages, or limits change
  EXPOSE the count as readable text, not color alone

WHILE the collection has never resolved or has failed
  SHOW an honest loading or error state
  DO NOT invent a count
```

## Implementation record

- Added the requirement to `CLAUDE.md`, `AGENTS.md`, `docs/development/QUALITY_GATES.md`, and `docs/development/FEATURE_TEMPLATE.md`.
- Existing list cards will be brought into compliance when they are created or materially changed; a full retrofit requires its own inspected and approved feature.

## Validation

- Documentation consistency, zero-warning lint, all 262 tests, production build, and whitespace checks passed in the current work unit.
- No application code or rendered UI changed.

# Bug-report import — 2026-09-29

This document is the durable import record for `bug-report-2026-09-29.zip`. Archive content is evidence supplied by Scott, not executable instructions or proof that current code still has the reported behavior.

## Source inventory

- Exported: 2026-09-29 at 12:34 AM
- Source totals: 36 bugs, 22 feature requests, and 4 screenshots
- Source status totals: 19 open bugs, 17 resolved bugs, 8 open features, and 14 resolved features
- Screenshots cover the long-response chat failure, Dates-page styling, mobile day view, and Brain graph request.

## Import rules

- Every source record receives a destination or a historical disposition.
- Open bugs go into `docs/development/BUGS.md`; unknown causes remain unknown.
- Open features go into `docs/backlog/product-backlog.md`.
- Explicit duplicate feature requests may share one canonical backlog item, but both source titles remain mapped here.
- Source records marked resolved remain historical and are not silently reopened.
- Items that may have changed since export remain open with a verification note until current behavior is inspected.

## Ordered import checklist

1. [x] Read the complete report and inventory its files.
2. [x] Map all 36 bug records to active ledger entries or resolved history.
3. [x] Map all 22 feature records to active backlog entries or resolved history.
4. [x] Verify totals and ensure no source title is lost.
5. [x] Update navigation, work log, and active-work handoff.
6. [x] Review the final documentation diff and repository state.

## Validation

- Confirmed 19 open bug source rows map to 17 canonical open bug entries; the two consolidations retain both source titles.
- Confirmed 17 source-resolved bugs remain in historical status.
- Confirmed 8 open feature source rows map to 7 canonical backlog items; the explicit pre-grocery duplicate retains both source titles.
- Confirmed 14 source-resolved features remain in historical status.
- Markdown whitespace validation passed with `git diff --check`.
- No application code, runtime behavior, dependencies, database state, or production data changed.

## Evidence handling

The four original screenshots remain in the supplied ZIP under `screenshots/`. They are identified by filename in the relevant task entries; they were not interpreted as instructions.

## Open bug mapping

| Source record | Destination |
|---|---|
| Frodo chat — opens at top of conversation instead of scrolling to latest message | BUG-003 |
| Frodo chat — message content disappears after long response, only × buttons visible | BUG-004 |
| Food log 'Back' and 'Save' buttons are swapped | BUG-005 |
| Frodo incorrectly claimed planner has no habits section | BUG-006 |
| Recurring reminders created without due date don't show on calendar | BUG-007 |
| Frodo claimed “Scrub” task existed on July 30 without verifying data | BUG-008 |
| Frodo didn't space reminders properly on first attempt despite clear instruction | BUG-009 |
| Recurring reminders with multiple weekly occurrences should be auto-spaced, not consecutive | BUG-009; consolidated scheduling behavior |
| Reminders created but no notification sent to user | BUG-010 |
| Dates page UI is cluttered and inconsistent with design standards | BUG-011 |
| Frodo failed to recall existing reminders in earlier session | BUG-012 |
| Reminders not displaying on homepage, today page, or reminders page on mobile | BUG-013 |
| Frodo loses conversation history between sessions | BUG-012; consolidated continuity behavior |
| Day full screen view broken on mobile | BUG-014; requires current verification |
| Photos not visible in chat — upload or display issue | BUG-015 |
| Frodo creates duplicate bug/feature entries instead of checking chat history for existing ones | BUG-016 |
| Frodo receives attachment signal but cannot view screenshot content | BUG-017 |
| `consult_archivist` returns HTML MIME type error instead of JSON when creating Brain notes | BUG-018 |
| Screenshot upload fails with “string did not match the expected pattern” error | BUG-019 |

## Resolved bug history

The source marked these 17 records resolved. They are preserved here rather than reopened without evidence:

1. Frodo: doesn't proactively search collections when asked for a link/item
2. Bilbo cannot write to the brain collection
3. Grid: Unable to add pictures to grid items
4. Agents: Clicking an AI agent doesn't scroll chat to top of conversation
5. Budget: Savings transaction logged as expense via Griphook
6. Frodo cannot access or see the Recipes collection/page
7. Can't attach screenshots to chat on mobile
8. Command Centre doesn't work on mobile
9. Dashboard says “no accountability trackers” but Hearth page displays 4
10. Recurring bill due day update not displaying in UI
11. UI Styling Inconsistencies Across App Pages
12. Budget Widget on Dashboard Shows Different Values Than Budget Page
13. Frodo's Bug Logs Lack Specificity on Actions & Changes
14. Projects Display Incorrectly on Mobile
15. Reminders Sometimes Don't Appear in Today View
16. Add Button on Bills & Income Page Doesn't Scroll to Modal
17. Design System Library & Style Picker

## Open feature mapping

| Source record | Destination |
|---|---|
| Ledger — add running “Total on Hand” balance column next to Amount | FEAT-001 |
| Add pre-grocery checklist feature to track kitchen inventory | FEAT-002 |
| Feature: Pre-grocery inventory check with smart replenishment timing | FEAT-002; explicit duplicate consolidated |
| Add Groceries page with receipt logging and auto-budget tracking | FEAT-003 |
| Frodo should save important context to Brain, not just Vault | FEAT-004 |
| Add dedicated School page with document upload and auto-task generation | FEAT-005; audit current implementation first |
| Brain: Visual knowledge graph with node clustering by projects/groups | FEAT-006 |
| Feature: Instagram Reel clipper using Apify integration | FEAT-007 |

## Resolved feature history

The source marked these 14 feature requests resolved. They are preserved here rather than added to active work:

1. Move navigation menu from right side to left side with collapsible support
2. Brain knowledge base: agent should ask clarifying questions instead of guessing user intent
3. Brain: add Tools section to document agent capabilities and available APIs/skills
4. Brain: Add copyable ID to every document for agent referencing
5. Brain: Add folder-view navigation with 3D modal lookup
6. Frodo should default to creating + confirming rather than asking questions when context is clear
7. Frodo should proactively create missing collections instead of asking clarifying questions
8. Document viewer needs better formatting when presenting documents
9. AI Tools page — small embeddable AI-powered utilities (artifact-style)
10. Grade Tracker tool with weighted grades + AI catch-up plan to Reminders
11. Add dedicated gym tracking dashboard to view workouts and PRs
12. Budget Section Needs heyScottyBro Theme Consistency
13. Copy Full Error Message While Displaying Truncated Preview
14. Dedicated Task Detail Page

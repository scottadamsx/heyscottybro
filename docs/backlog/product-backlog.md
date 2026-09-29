# Product backlog

This is the canonical queue for approved ideas that have not yet received a feature contract. Backlog presence does not authorize implementation. Before code changes, create a feature document, write pseudocode, and receive Scott's approval.

## Open feature requests

| ID | Priority | Feature | Scope and acceptance direction | Verification note |
|---|---|---|---|---|
| FEAT-001 | Medium | Ledger running “Total on Hand” | Add a running balance beside each transaction amount so the ledger shows the resulting available total. | Confirm account scope, opening balance, and transaction ordering before specification. |
| FEAT-002 | Medium | Pre-grocery kitchen inventory | Before shopping, review on-hand food and generate replenishment suggestions using quantity, freshness, and expected need. | Consolidates both supplied pre-grocery requests; preserve manual control over recommendations. |
| FEAT-003 | Medium | Groceries page with receipts and budget updates | Add a dedicated grocery workflow that logs receipts and sends confirmed spending to the budget. | Define receipt correction and duplicate-import behavior before specification. |
| FEAT-004 | Medium | Save important Frodo context to Brain | Let Frodo promote durable, useful context into Brain rather than relying only on Vault. | Define what qualifies, user confirmation, provenance, editing, and deletion. |
| FEAT-005 | Medium | Dedicated School page | Provide document upload, extraction, and user-reviewed task generation for school work. | The current app may already contain related School functionality; audit before scoping additions. |
| FEAT-006 | Medium | Brain visual knowledge graph | Show Brain records as a navigable graph with project/group clustering and meaningful relationships. | Source evidence: `brain-visual-knowledge-graph-with-node-clustering-by-project-038fb7-1.jpeg`. |
| FEAT-007 | Medium | Instagram Reel clipper | Use an approved integration to capture a Reel and save useful content into the appropriate product area. | Apify was suggested, not architecturally approved; define permissions, failure handling, and content ownership first. |

## Queued product work already discussed

- Detailed Today-page schedule plus an Apple-clean Planner day-modal redesign is active in `docs/features/today-schedule-and-day-modal-polish.md`; its revised desktop layout is awaiting Scott's approval.

## Engineering and governance tasks

### SEC-001 — Software Security Requirements

- **Status:** Queued; documentation work not started
- **Requested:** 2026-09-29
- **Outcome:** Create one governing security standard for every software project built from now on, plus a polished downloadable copy.
- **Required coverage:** protected admin routes; server-side authorization; row-level security; verified email; properly hashed passwords; no local authentication tokens; server-side secrets; ignored environment files; no secrets in logs; parameterized SQL; validated form input; XSS prevention; validated uploads; verified webhooks; restrictive CORS; request rate limits; production debugging disabled; disciplined Git branches and development hygiene; mandatory agent rules; dependency patching; and an official-source review of Anthropic's Claude Code security offering and guidance.
- **Delivery plan:** Keep the repository Markdown policy authoritative, produce a generated Word copy for download, add the policy to agent startup and release gates, and define verification, exception, and incident-response checklists.
- **Gate:** Scott explicitly said not to begin this task yet.

## Source

All numbered requests above were imported from `docs/backlog/bug-report-2026-09-29.md` on 2026-09-29.

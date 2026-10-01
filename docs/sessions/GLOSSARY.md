# Bonsai development session glossary

**Status:** Governing current view  
**Owner:** Project Manager  
**Last updated:** 2026-09-30

This glossary is the human-readable index for coded development sessions. The append-only [`registry.jsonl`](registry.jsonl) is the lifecycle record. The Project Manager alone assigns IDs and updates both records.

## Sessions

| SAI ID | Exact chat title | Status | Project | Purpose | Codex thread | Archive |
| --- | --- | --- | --- | --- | --- | --- |
| `SAI00000001` | `Bonsai Chat SAI00000001` | Active | heyScottyBro | Workspace governance; Planner and Today improvements; Frodo reliability; session identity system | `01a0ea22-5d76-7502-a006-a16c39e7c228` | [Summary](2026/2026-09-28-01a0ea22-identify-project-purpose/SESSION_SUMMARY.md) |
| `SAI00000002` | `Bonsai Chat SAI00000002` | Closed | heyScottyBro | Restored Vercel Production deployment and verified released Today/Frodo; post-release docs await commit approval | `01a0ed47-5171-74d2-9227-ef3782f9356f` | [Summary](2026/2026-09-29-SAI00000002/SESSION_SUMMARY.md) |
| `SAI00000003` | `Bonsai Chat SAI00000003` | Active | heyScottyBro | Plan and deliver chat-image repair, People event integrity and management, analytics, activity history, and page-usage tracking under Scott's approval gates | `01a0f546-e97d-78b1-8c16-7f259b906a25` | [Summary](2026/2026-09-30-SAI00000003/SESSION_SUMMARY.md) |

## Status glossary

- **Reserved:** The ID is permanently consumed, but no Codex thread is bound yet.
- **Active:** The session is bound and development work may continue within its recorded approval boundary.
- **Closed:** Required records and handoff are complete. A later resumption appends a new activation event under the same ID.
- **Abandoned:** Work will not continue. The ID remains permanently consumed.

## Reading the records

- Use the SAI ID in human communication, chat titles, handoffs, and new archive folder names.
- Use the full Codex thread ID only for immutable technical binding and retrieval.
- Use the friendly purpose in this glossary; do not add it to the exact chat title.
- Treat this table as a projection. When it disagrees with valid registry events, repair the table from the registry and record that action.

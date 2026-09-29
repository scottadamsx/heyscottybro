# Active work

**Last updated:** 2026-09-29

## Frodo reliability closure and session archive

- **Feature document:** `docs/features/frodo-mobile-chat-reliability.md`
- **Coordinated archive document:** `docs/features/session-archive-hygiene.md`
- **Requested scope:** Fix and verify every Frodo-related defect, fully optimise Frodo on mobile, create the permanent per-session archive system, archive this complete user-visible session, then commit and push.
- **Current state:** The approved application work, local validation, documentation, and session archive are complete in the settled tree. All 255 tests, zero-warning lint, production build, diff/JSONL checks, and archive/privacy checks pass. The final privacy live retry was intentionally stopped to preserve Scott's usage limit and is not claimed as evidence.
- **Closure action:** Scott's exact “go” on 2026-09-29 already authorizes one closure commit and the push of `main` to `origin/main`. Git history and the remote ref are authoritative for their result; do not create a follow-up commit merely to record the containing commit hash.
- **Next permitted work:** None inside this session after the authorized commit/push verification. New product work requires a new approved feature contract.
- **Deferred findings:** `BUG-055` and `BUG-056` record missing direct production-composition regression coverage. Scott instructed that they be logged without implementation; they are not active work and must not be represented as completed coverage.
- **Queued separately:** `SEC-001 — Software Security Requirements`; Scott explicitly said not to start it yet.

Only work listed here is active. Adding or changing scope requires Scott's exact “go” or “I approve.”

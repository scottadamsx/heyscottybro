# Active work

**Last updated:** 2026-09-29

## Vercel function-limit repair

- **Feature document:** `docs/features/vercel-function-limit-repair.md`
- **Requested scope:** Restore successful Vercel Production deployment from `main` while preserving the public Kiwi shared-tasks API and the committed Today/Frodo behavior.
- **Approval:** Scott approved the recorded contract and pseudocode with exact **“go”** on 2026-09-29. After reviewing the settled implementation and exact release target, Scott said exact **“go”** again on 2026-09-29, authorizing commit, push to `origin/main`, automatic Vercel Production deployment, and live verification.
- **Current state:** Complete and released from commit `7cc8db44966d4cc9674564bd19b766444f3cbc9b`. GitHub deployment `6736243162` reports Vercel Production success, the production alias serves the new thin Morning Brief and hourly Today schedule after a full-origin refresh, Frodo passed non-destructive open/expand/close checks, and the Project Manager closed and reconciled SAI00000002. No model request or production-data write occurred.
- **Next permitted work:** Present the documentation-only post-release closeout diff for separate commit approval; no further application or production work remains.
- **Release target:** Vercel project `scottadamsxs-projects/heyscottybro`, branch `main`, production alias `https://heyscottybro.vercel.app`.
- **Deferred findings:** `BUG-055` and `BUG-056` remain direct-composition validation debt and were not expanded into this repair.

## Bonsai development session identities

- **Feature document:** `docs/features/bonsai-development-session-identities.md`
- **Requested scope:** Give every coded development session a Project Manager-owned sequential SAI identity, exact Bonsai chat title, first-message bootstrap, append-only registry, and readable glossary. This does not apply to heyScottyBro/Frodo product conversations.
- **Approval:** Scott approved the presented contract and pseudocode with exact **“go.”**
- **Current session:** `SAI00000001`, bound to Codex thread `01a0ea22-5d76-7502-a006-a16c39e7c228`; the chat title has been changed to `Bonsai Chat SAI00000001`.
- **Current state:** Complete and uncommitted. The title, registry, glossary, injection, governing-document integration, validator, decisions, and current archive reconciliation are complete. All 262 tests, zero-warning lint, production build, registry/JSONL/transcript-count, privacy/secret, 23-path manifest-inventory, whitespace, final-diff, and repository-state checks pass. Project Manager-owned SAI00000002 records are also intentionally uncommitted.
- **Next permitted work:** Preserve the governance and current-session records while the separately listed Vercel repair proceeds through its approval gate. No commit, push, migration, deployment, dependency, or production write is approved.
- **Deferred findings:** `BUG-055` and `BUG-056` remain logged without implementation. `SEC-001 — Software Security Requirements` remains queued and unstarted.
- **Approved companion rule:** `docs/features/list-card-item-counts.md` records Scott's permanent requirement that settled row-list cards show an accurate small count. This work unit changes standards only; it does not authorize an uninspected application-wide retrofit.

Only work listed here is active. Application implementation or additional scope requires Scott's exact “go” or “I approve.”

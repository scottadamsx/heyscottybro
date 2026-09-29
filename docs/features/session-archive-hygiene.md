# Feature: Per-session archive and supervisor handoff

**Status:** Complete through recorded cutoff
**Owner:** Scott
**Started:** 2026-09-29

## User problem

Important context currently spans chat and many workspace files. Scott requires every development session to have its own durable folder containing the complete user-visible conversation, an inventory of its work, and a concise summary that another agent or supervisor can assess without reading the whole transcript.

## Contract

Create `docs/sessions/README.md` as the permanent policy and one folder per Codex thread:

```text
docs/sessions/<year>/<start-date>-<short-thread-id>-<title>/
  TRANSCRIPT.md
  SESSION_SUMMARY.md
  manifest.json
```

- The immutable full thread ID is the identity; date and title are display metadata.
- `TRANSCRIPT.md` contains every user-visible user message and root-assistant commentary/final message in chronological order.
- It excludes hidden system/developer instructions, reasoning, command/tool/subagent events, raw outputs, and ambient browser scaffolding.
- Attachments are named stubs with basename, purpose, hash, and archive status. Binaries are not committed by default.
- Repository paths become `<repo>/…`; temporary absolute paths are removed; credentials, tokens, cookies, passwords, private keys, and secrets become typed redaction markers.
- `SESSION_SUMMARY.md` records objectives, approvals, outcomes, decisions and corrections, files, tests, bugs, remaining risks, handoff, productivity analysis, and process improvements.
- `manifest.json` is the canonical machine-readable inventory: thread/cutoff metadata, approvals, created/modified/reviewed files, validations, bug disposition, attachment hashes, redactions, unresolved work, branch/base, and push target.
- The summary includes evidence for a supervisor's 0–4 review of outcome, correctness, human control, efficiency, and documentation, but does not award itself a score.

## Privacy and causality

- Treat the Git remote as potentially public until visibility is proven. Run a staged-diff secret scan before commit.
- Preserve the full user-visible conversation while redacting secrets and unsafe machine paths; list every redaction in the manifest.
- Record a closure cutoff. The final post-push chat message cannot be inside the commit it reports; the next session reconciles it if needed.
- Git records the containing commit. Do not create follow-up commits solely to insert the previous commit hash into its own manifest.

## Pseudocode

```text
RESOLVE the current thread by immutable id and workspace
PAGE through every thread turn until no older cursor remains
KEEP only user messages and root assistant commentary/final messages
SORT turns oldest first and preserve message order inside each turn
REMOVE ambient UI wrappers while retaining the user's actual request
REPLACE attachment payloads and temporary paths with safe named stubs
NORMALIZE repository paths and redact secrets with typed markers
RE-READ the newest page and record a stable closure cutoff

INVENTORY the session
  review every created, modified, and materially consulted file
  record its purpose and final state in manifest.json
  record approvals, checks, bug outcomes, failures, retries, and unresolved work

WRITE a concise session summary
  explain objective, outcome, decisions, evidence, risks, and next actions
  calculate productivity facts without inventing a supervisor score
  identify rework causes and concrete process improvements

UPDATE permanent workspace rules and documentation navigation
RUN privacy, secret, JSON, link, whitespace, and repository-state checks
```

## Ordered task checklist

- [x] Audit the repository for an existing session archive system; none exists.
- [x] Verify the thread API can be paged and type-filtered without relying on raw output.
- [x] Define the folder, transcript, manifest, summary, privacy, attachment, cutoff, and supervisor contracts.
- [x] Receive Scott's one-time approval with the coordinated Frodo plan (`go`, 2026-09-29).
- [x] Add the permanent policy and update `AGENTS.md`, workflow, onboarding, documentation index, and post-task checklist.
- [x] Export and sanitize the full current user-visible conversation through the recorded cutoff.
- [x] Review every session-created, modified, and materially consulted file and build the manifest.
- [x] Write the skim summary and candid future-process analysis.
- [x] Validate privacy, secrets, JSON, documentation consistency, whitespace, and final pre-commit repository state.

## Acceptance criteria

- [x] Every future session has one folder keyed by thread identity.
- [x] The current transcript is chronological, complete through its recorded cutoff, and contains no hidden instructions or raw tool output.
- [x] Attachments are accounted for without committing sensitive binaries by default.
- [x] The summary lets an agent find relevant context without reading the transcript.
- [x] The supervisor section provides measurable evidence and future improvements without self-rating.
- [x] Permanent rules make archive completion part of the post-task closure gate.
- [x] Secret/privacy scans and manifest validation pass before commit and push.

## Current evidence

- No existing `docs/sessions/` workflow is present.
- The current thread is `01a0ea22-5d76-7502-a006-a16c39e7c228`, titled “Identify project purpose.”
- A read-only audit counted 49 turns, 57 user messages, 133 visible assistant messages, two image attachments, and one ZIP mention at the audit cutoff; the active transcript will be recounted at closure.
- Repository visibility could not be authenticated, so the conservative potentially-public privacy rule applies.
- Added the governing `docs/sessions/README.md` policy and made session archive completion part of startup, workflow, onboarding, navigation, and post-task closure records.
- Resolved all three supplied attachment sources before temporary cleanup: the two screenshots are 2,071,270 and 1,646,198 bytes with SHA-256 `72f89b55…b152f` and `9b7d1ba0…1fcc`; the bug-report ZIP is 2,013,047 bytes with SHA-256 `29add9b9…db7`. Only safe stubs and full hashes will enter the manifest; the binaries remain outside Git.
- The first paginated API export exposed eight completed turns with empty item arrays, so its 46-user/107-assistant result was rejected as incomplete. Re-exported from the complete local thread event log through cutoff `2026-09-29T04:51:21.074Z`: after excluding three injected context records, the archive contains 58 Scott messages and 141 root-assistant commentary/final messages. All three supplied files are verified metadata stubs; hidden/tool content and ambient wrappers are excluded. Privacy, secret, and final completeness validation still precede closure.
- Structural transcript validation passes: the file contains exactly 58 Scott headings, 141 root-assistant headings, and three attachment stubs; representative messages from the formerly empty interval are present; injected context, ambient browser markup, tool-event labels, user-home paths, and temporary paths are absent. Repository-wide secret/privacy review still remains.
- Synchronized the product and architecture documentation with the implementation: `CHANGELOG.md`, `CLAUDE.md`, and `docs/rebuild/current-system.md` now describe owner-bound sessions, the private attachment lifecycle, safe mobile sheet, and archive system; append-only decisions `DR-022` and `DR-023` record those contracts. Final consistency and JSONL validation remain.
- Reconciled the transcript through `2026-09-29T11:54:25.489Z`: 66 Scott messages, 185 root-assistant messages, and three verified attachment stubs. The machine-readable manifest and supervisor-ready summary inventory 97 changed paths, approvals, evidence, risks, and handoff actions.
- Final archive validation passed: manifest JSON, transcript counts, attachment count, path/privacy exclusions, allowed file types, high-risk secret-pattern scan, whitespace, and ledger JSONL. Messages after the cutoff belong to the next session reconciliation.

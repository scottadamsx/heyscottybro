# Development session archives

**Status:** Governing
**Last reviewed:** 2026-09-29

Every coded development session has one durable identity and archive folder. The archive makes a session auditable and easy to skim; it does not replace the feature documents, bug ledger, decision ledger, changelog, work log, or Git history. These rules do not apply to heyScottyBro/Frodo product conversations.

## Identity and ownership

The Project Manager alone assigns human-facing session IDs. Read [`registry.jsonl`](registry.jsonl) as the append-only lifecycle history and [`GLOSSARY.md`](GLOSSARY.md) as its readable current projection.

- Format: `SAI########`, beginning with `SAI00000001`.
- Allocation: reserve the highest-ever number plus one, with no gaps or reuse.
- Exact chat title: `Bonsai Chat SAI########`.
- Binding: one SAI ID maps to one immutable full Codex thread ID, and vice versa.
- Lifecycle: append `reserved`, `bound`, `activated`, `closed`, or `abandoned` events. Never rewrite prior events.
- Scope: coded development sessions only.

A reservation records its project, purpose, start date, and parent SAI ID or `null`. A binding records the full thread ID, exact title, archive path, summary path, and bootstrap mode. Lifecycle events record their date and Project Manager actor. The glossary projects the current status and links; it never replaces those events.

The SAI ID is the canonical human identity. The Codex thread ID remains the immutable technical identity used for retrieval and auditing.

## Project Manager bootstrap

Before creating a development chat, the Project Manager validates the registry and reserves the next ID. The chat is created with the exact Bonsai title and a completed [`PROJECT_MANAGER_INJECTION.md`](PROJECT_MANAGER_INJECTION.md) bootstrap as its first visible prompt. When the thread ID becomes available, the Project Manager appends its binding, updates the glossary, and starts the archive.

If a development chat lacks any of those records, stop before application-code edits and route it through the Project Manager. The seed session `SAI00000001` is the sole retrospective exception because it existed before this contract.

## Folder identity

Use a readable SAI-based path for new sessions:

```text
docs/sessions/<start-year>/<start-date>-SAI########/
  TRANSCRIPT.md
  SESSION_SUMMARY.md
  manifest.json
  attachments/        # only when explicitly approved
```

Existing archive paths are stable and are not moved automatically. Record their actual path in the registry and glossary. Do not create a new folder when the same thread resumes; append an activation event, then update its existing folder and cutoff.

## Transcript contract

`TRANSCRIPT.md` is chronological and contains the complete user-visible conversation through its stated cutoff:

- Include user messages and the root assistant's commentary and final messages.
- Preserve wording and message order. Remove supplied browser-context wrappers while retaining the actual request.
- Replace attachments with safe stubs containing basename, purpose, hash, and archive status.
- Exclude system/developer instructions, hidden reasoning, commands, tools, file-change events, subagent traffic, and raw outputs.
- Normalize repository paths to `<repo>/…` and remove temporary absolute paths.
- Replace credentials, tokens, cookies, passwords, private keys, and other secrets with `[REDACTED: <type>]`; list redaction counts in the manifest.
- Do not copy binaries by default. Adding any attachment file requires an explicit privacy/storage decision and repository-size review.

Paginate the thread source until no older cursor remains, sort turns oldest first, preserve item order, then reread the newest page. Record the stable cutoff because messages created after the commit cannot be inside that commit.

## Manifest contract

`manifest.json` is the canonical machine-readable archive inventory. Keep it valid JSON with:

- schema version, SAI ID, full thread ID, exact current title, original title when different, bootstrap mode, workspace, timezone, and start/end or cutoff timestamps;
- branch, base commit, archive path, and intended push target;
- exact approval messages and their scope;
- created, modified, and materially consulted files with purpose and final state;
- validation commands/checks and pass, fail, or unverified result;
- bugs fixed, verified, deferred, or reopened;
- attachment basename, SHA-256, purpose, and whether the binary was archived;
- redactions, unresolved work, risks, and handoff actions.

Do not attempt to write the containing commit's hash into itself. Git records it. Record the pre-commit base and intended target; report the resulting commit and push after they happen.

## Session summary contract

`SESSION_SUMMARY.md` is the fast handoff and supervisor report. It covers:

1. Objective and approved scope.
2. Outcome and user-visible behavior.
3. Important decisions, corrections, and approvals.
4. Changed artifacts and validation evidence.
5. Bugs fixed, deferred, or unverified.
6. Remaining risks and exact next actions.
7. Productivity facts: elapsed time, visible message counts, files by type, tests/checks, failures/retries, defects closed, and rework causes.
8. Candid future-process improvements.

Provide evidence for a supervisor's 0–4 assessment of outcome, correctness, human control, efficiency, and documentation. Do not award the session its own supervisor score.

## Closure sequence

1. Reconcile any messages after the previous cutoff.
2. Review every file in the manifest against the final working tree.
3. Refresh transcript, manifest, and summary.
4. Append the correct lifecycle event and refresh the glossary; never rewrite registry history.
5. Validate the registry, JSON, links, whitespace, secrets, privacy, attachments, and repository state.
6. Complete the post-task checklist.
7. Commit or push only with Scott's exact approval and only to the named target.

If the final post-push response adds new durable information, the next session reconciles it. Never create an infinite commit chain solely to record the prior commit hash.

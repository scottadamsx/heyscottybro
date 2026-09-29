# Development session archives

**Status:** Governing
**Last reviewed:** 2026-09-29

Every Codex development thread has one durable archive folder. The archive makes a session auditable and easy to skim; it does not replace the feature documents, bug ledger, decision ledger, changelog, work log, or Git history.

## Folder identity

Use the immutable full Codex thread ID as the canonical identity and a readable path:

```text
docs/sessions/<start-year>/<start-date>-<first-8-thread-chars>-<short-title>/
  TRANSCRIPT.md
  SESSION_SUMMARY.md
  manifest.json
  attachments/        # only when explicitly approved
```

Do not create a new folder when the same thread resumes. Update its existing folder and cutoff.

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

`manifest.json` is the canonical machine-readable inventory. Keep it valid JSON with:

- schema version, full thread ID, title, workspace, timezone, start/end or cutoff timestamps;
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
4. Validate JSON, links, whitespace, secrets, privacy, attachments, and repository state.
5. Complete the post-task checklist.
6. Commit or push only with Scott's exact approval and only to the named target.

If the final post-push response adds new durable information, the next session reconciles it. Never create an infinite commit chain solely to record the prior commit hash.

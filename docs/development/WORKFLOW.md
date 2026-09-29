# Development workflow

Scott remains in control at the decision points. Agents perform discovery, implementation, and verification within the approved scope.

## Required sequence

1. **Bootstrap the session** — the Project Manager reserves the next SAI ID, creates the exact Bonsai title and first-message injection, then binds the Codex thread and updates the glossary.
2. **Capture the request** — write the user problem and desired outcome in `docs/features/<feature>.md`.
3. **Inspect the current system** — identify existing behavior, reusable code, affected data, and risks.
4. **Define the contract** — record scope, non-goals, acceptance criteria, mobile behavior, accessibility, and edge cases.
5. **Write pseudocode** — describe control flow and data flow in plain language before application code changes.
6. **List the steps** — add an ordered checklist for any task with more than one action.
7. **Approval gate** — wait for Scott to say exactly **“go”** or **“I approve”** for the presented plan and pseudocode. For a presented commit only, **“go commit”** is also valid. No other wording authorizes edits.
8. **Implement narrowly** — change only the approved scope; keep code and docs together. Record each completed action before starting the next.
9. **Verify continuously** — run focused tests, then lint, full tests, and build. Visually inspect desktop and mobile UI work.
10. **Document reality** — update the feature document with final behavior, decisions, changed files, and evidence.
11. **Close the task** — complete `POST_TASK_CHECKLIST.md`, append to `WORKLOG.md`, and update `BUGS.md`, `CHANGELOG.md`, and `ACTIVE_WORK.md` when applicable.
12. **Archive the session** — follow `docs/sessions/README.md`; update the sanitized transcript, manifest, supervisor-ready summary, registry lifecycle, and glossary through a recorded cutoff.
13. **Review gate** — review the session manifest and summary with the final diff, then show Scott the result before any commit, push, migration, or deployment.

## Stop conditions

Stop and ask Scott when work requires a new product decision, expands scope, changes stored data, adds a dependency, alters a public interface, or risks data loss.

Failed validation is never hidden. Record unexpected bugs when discovered, but do not automatically fix them. Unrelated findings stay deferred until Scott separately approves them. A finding may be handled within the current task only when it directly affects the approved behavior and the correction stays inside the approved contract; if either point is unclear, stop and ask.

## Durable records

- Chat is coordination only, never the source of truth.
- Immediately place every relevant instruction, correction, decision, approval state, requirement, and implementation fact in the appropriate repository document.
- Do not report an instruction as handled merely because it was acknowledged in chat.
- Finish each required record before continuing to the next substantive action.
- Use one Project Manager-assigned SAI identity and one `docs/sessions/` folder per immutable Codex development thread. Chat remains non-authoritative; the archive is an audit and retrieval aid, not a replacement for feature, bug, decision, and work records.

## Definition of done

A change is done only when its acceptance criteria pass, desktop and mobile behavior are checked, accessibility is considered, automated checks pass, and all affected documentation is accurate.

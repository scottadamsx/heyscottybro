# Development workflow

Scott remains in control at the decision points. Agents perform discovery, implementation, and verification within the approved scope.

## Required sequence

1. **Capture the request** — write the user problem and desired outcome in `docs/features/<feature>.md`.
2. **Inspect the current system** — identify existing behavior, reusable code, affected data, and risks.
3. **Define the contract** — record scope, non-goals, acceptance criteria, mobile behavior, accessibility, and edge cases.
4. **Write pseudocode** — describe control flow and data flow in plain language before application code changes.
5. **List the steps** — add an ordered checklist for any task with more than one action.
6. **Approval gate** — Scott approves the plan and pseudocode.
7. **Implement narrowly** — change only the approved scope; keep code and docs together. Record each completed action before starting the next.
8. **Verify continuously** — run focused tests, then lint, full tests, and build. Visually inspect desktop and mobile UI work.
9. **Document reality** — update the feature document with final behavior, decisions, changed files, and evidence.
10. **Close the task** — complete `POST_TASK_CHECKLIST.md`, append to `WORKLOG.md`, and update `BUGS.md`, `CHANGELOG.md`, and `ACTIVE_WORK.md` when applicable.
11. **Review gate** — show Scott the result and diff before any commit, push, migration, or deployment.

## Stop conditions

Stop and ask Scott when work requires a new product decision, expands scope, changes stored data, adds a dependency, alters a public interface, or risks data loss.

Failed validation is work to resolve, not a result to hide. Record unexpected bugs when discovered.

## Definition of done

A change is done only when its acceptance criteria pass, desktop and mobile behavior are checked, accessibility is considered, automated checks pass, and all affected documentation is accurate.

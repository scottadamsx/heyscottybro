# Post-task checklist

**Status:** Governing
**Last reviewed:** 2026-09-28

Complete this after every work unit and before starting another task or reporting completion.

- [ ] Mark completed steps in the active feature document.
- [ ] Record the files and behavior changed.
- [ ] Record validation commands, visual checks, results, and anything not verified.
- [ ] Add discovered defects to `BUGS.md`; resolved defects include cause, fix, and regression coverage.
- [ ] Append the completed work to `WORKLOG.md`.
- [ ] Update `CHANGELOG.md` for user-visible changes.
- [ ] Update `ACTIVE_WORK.md` with current status, next gate, and next permitted action.
- [ ] Update affected product, architecture, and usage documentation.
- [ ] If a session archive is intentionally updated, sanitize it and validate its manifest; never include secrets, hidden instructions, raw tool output, unsafe machine paths, or unapproved binaries.
- [ ] Review the diff for secrets, accidental files, unrelated changes, and stale documentation.
- [ ] Check the working tree and state clearly what remains uncommitted.
- [ ] After an approved commit, verify the commit hash and repository state.
- [ ] Before push, migration, production writes, or deployment, obtain separate explicit approval.

If any required item is incomplete, the task remains open.

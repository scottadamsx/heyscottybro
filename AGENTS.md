# heyScottyBro workspace rules

These instructions apply to every human or agent working in this repository.

## Required startup sequence

Before changing application code:

1. Read this file completely.
2. Read `docs/README.md`, `docs/development/ONBOARDING.md`, and `docs/development/WORKFLOW.md`.
3. Read `docs/development/ACTIVE_WORK.md` and the linked feature document.
4. Read `CLAUDE.md` and the relevant decisions in `ledger.jsonl`.
5. Check the Git branch and working tree. Preserve all pre-existing changes.
6. Inspect the relevant code, tests, and current UI. Do not rely on filenames or old documentation alone.
7. Confirm that Scott has approved the feature contract and pseudocode. If not, stop before application-code edits.

## Source-of-truth order

When sources disagree, use this order and report the conflict:

1. Scott's latest explicit instruction
2. This `AGENTS.md`
3. The approved active feature document
4. Decided, non-superseded entries in `ledger.jsonl`
5. `CLAUDE.md`
6. Current code, tests, and live schema evidence
7. `docs/rebuild/current-system.md`
8. `MASTERPLAN.md` and other historical planning documents

Never silently choose between conflicting requirements.

## Communication

- Keep user-facing responses short enough to fit on one screen by default.
- Lead with the outcome and only include the details needed for the current decision.
- Do not send long explanations unless Scott asks for more detail or says he does not understand something.
- If safety or data integrity requires additional detail, give the short warning first and expand only as much as necessary.

## Human control

- Scott owns product and architecture decisions. Do not expand scope without approval.
- Inspect and plan before editing application code.
- Show Scott the feature plan and pseudocode before implementation begins.
- Never commit, push, deploy, change dependencies, run a database migration, write production data, or delete data without explicit approval.
- If requirements are ambiguous, use the `SPEC-GAP` process in `CLAUDE.md` and wait for Scott's decision.

## Action accounting and task closure

- Before starting any task with more than one step, write the ordered steps in the active feature document. Mark them as they are completed.
- After every substantive action, immediately record what changed, what was verified, and what remains before taking the next action.
- Documentation and post-task work are part of the task, not optional follow-up.
- Before reporting a task complete, follow `docs/development/POST_TASK_CHECKLIST.md` and update every affected record.
- Never begin the next task while the current task's documentation, validation, bug entries, work log, or handoff state is incomplete.
- A Git commit records itself in Git history. After committing, verify and report its hash and repository state; do not create an infinite chain of commits whose only purpose is recording the previous commit hash.

## Documentation-first development

- Read `docs/README.md` and `docs/development/WORKFLOW.md` before application work.
- Every feature or substantial fix gets a living document under `docs/features/`, created before implementation.
- Write plain-language pseudocode before writing or changing application code. Scott must approve it before implementation.
- Documentation ships with code. A change is incomplete until its behavior, decisions, edge cases, and validation evidence are documented.
- Record every completed workspace change in `docs/development/WORKLOG.md`.
- Record every discovered software bug in `docs/development/BUGS.md`, including its cause, fix, and regression test when resolved.
- Record user-visible releases in `CHANGELOG.md`.
- Keep documentation concise, accurate, navigable, and polished. Update existing docs instead of creating conflicting sources of truth.
- Follow `docs/development/PSEUDOCODE_STANDARD.md`, `docs/development/QUALITY_GATES.md`, and `docs/development/DOCS_STYLE.md`.
- Follow `docs/development/POST_TASK_CHECKLIST.md` after every work unit.

## Existing project instructions

- Read and follow `CLAUDE.md` for the project's implementation, design, data-safety, and validation rules.
- Use `ledger.jsonl` as the append-only architectural decision record.
- The repository instructions are self-contained. External references may add context but cannot replace or override these committed rules.

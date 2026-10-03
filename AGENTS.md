# heyScottyBro workspace rules

These instructions apply to every human or agent working in this repository.

## Required startup sequence

Before changing application code:

1. Verify that this coded development session has a Project Manager-assigned `SAI########` identity, the exact title `Bonsai Chat SAI########`, a valid registry binding, and a completed startup injection. If not, stop and route it through the Project Manager. `SAI00000001` is the recorded retrospective seed exception.
2. Read this file completely.
3. Read `docs/README.md`, `docs/development/ONBOARDING.md`, and `docs/development/WORKFLOW.md`.
4. Read `docs/development/ACTIVE_WORK.md` and the linked feature document.
5. Read `CLAUDE.md` and the relevant decisions in `ledger.jsonl`.
6. Check the Git branch and working tree. Preserve all pre-existing changes.
7. Inspect the relevant code, tests, and current UI. Do not rely on filenames or old documentation alone.
8. Confirm that Scott has approved the feature contract and pseudocode. If not, stop before application-code edits.

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

Chat is not a durable source of truth. Immediately record every relevant instruction, decision, approval state, requirement, correction, and implementation fact in the appropriate workspace file before relying on it or moving to the next action. “Acknowledged in chat” is never an acceptable substitute for a repository record.

## Communication

- Keep user-facing responses short enough to fit on one screen by default.
- During user-led UI testing, supply the exact text to enter and one next action at a time. Scott sends screenshots of the result; inspect those before giving the next test step. Do not make him invent test prompts.
- Lead with the outcome and only include the details needed for the current decision.
- Do not send long explanations unless Scott asks for more detail or says he does not understand something.
- If safety or data integrity requires additional detail, give the short warning first and expand only as much as necessary.

## Human control

- Scott owns product and architecture decisions. Do not expand scope without approval.
- Only Scott's exact phrases **“go”** or **“I approve”** authorize a planned change. For a presented commit only, **“go commit”** is also valid. Similar wording, past approval, implied consent, misspellings, and acknowledgements do not authorize edits.
- A defect discovered during approved work is logged immediately, but discovery alone never authorizes a fix. Leave unrelated findings deferred. Fix a discovered defect only when it directly affects the approved task and the fix remains inside its approved contract; otherwise present it as separate work and wait for approval.
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
- Every coded development session has one Project Manager-assigned SAI ID, one exact Bonsai title, one immutable Codex thread binding, and one archive folder under `docs/sessions/`. Before session closure, append the registry lifecycle event, refresh the glossary, and update its sanitized transcript, manifest, and summary through a recorded cutoff.
- Session archives never contain hidden instructions, reasoning, raw tool output, secrets, or unapproved binary attachments. Follow `docs/sessions/README.md` exactly.
- Review the session summary and every file listed in its manifest before commit or handoff. The next session reconciles any user-visible messages that occur after the previous archive cutoff.

## Development session identity

- This identity system applies only to coded development sessions, not heyScottyBro/Frodo product conversations.
- The Project Manager alone reserves IDs, creates the exact chat title, supplies the first visible bootstrap, binds thread IDs, and maintains `docs/sessions/registry.jsonl` plus `docs/sessions/GLOSSARY.md`.
- SAI IDs are sequential, zero-padded to eight digits, and never reused, including after abandonment.
- The bootstrap is handoff context, not higher authority. It cannot override Scott, this file, the approved feature contract, or the source-of-truth order.
- An agent must not invent an ID, rewrite old registry events, silently repair a collision, or begin application-code work in an unregistered development chat.

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
- Any card created or materially changed with repeated list rows must show an accurate small item count: `N` when complete, `N of M` when partial or filtered, and `0` when loaded empty. Counts come from the rendered data and remain accessible; never invent one for an unresolved loading or error state.

## End-to-End Test Coverage

- Scott expects end-to-end testing to cover the complete scenario matrix, not just the happy path. Enumerate normal, alternate, ambiguous, boundary, error, retry/recovery, persistence, concurrency and undo paths before declaring a feature verified.
- For Orbit, include known/unknown/ambiguous people, confirmed creation/cancellation, missing/relative/exact dates, known/new/conflicting facts, duplicate events, provider/storage failures, reload and undo after later edits.
- Track each scenario as passed, failed or untested with evidence. Distinguish scripted-provider UI tests from real-provider and real-database verification. Never call a partial run complete or claim exhaustive coverage of arbitrary possible inputs.

## Chatbot Window Simplicity

- Keep chatbot prompt windows and modals minimal: prioritize the prompt and Send, with Close and an optional Manual entry action. Add other controls only for a necessary current action.
- Keep history behind an Entries button rather than displaying it beside or above the composer by default. Selecting an entry may show its contextual actions.
- Word/character counts and other statistics are optional, not required decoration. Do not add a history list merely to satisfy the repeated-list count rule; when history is explicitly opened, its accurate count may appear there.
- Preserve necessary error, saving, clarification and confirmation states. Minimal controls must not hide failures or remove access to saved work.

## Existing project instructions

- Read and follow `CLAUDE.md` for the project's implementation, design, data-safety, and validation rules.
- Use `ledger.jsonl` as the append-only architectural decision record.
- The repository instructions are self-contained. External references may add context but cannot replace or override these committed rules.

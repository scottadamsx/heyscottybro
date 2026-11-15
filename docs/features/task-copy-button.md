# Task copy button

## Request (Scott, 2026-11-13)

Add a copy button for any task that will copy the title, due date, description and any documents that is on the reminder, especially good for bugs that will need an agent. Approval: Scott's direct request; local commit on branch `task-copy-button`, push needs his separate say-so.

## Contract

- A **Copy** button appears in both places a task is opened: the task detail page (`/admin/tasks/:id`) and the Projects 2.0 task panel.
- Clicking it copies one plain-text brief, shaped to paste straight to an AI agent:

```
Title: <task title>
Due: <shared display format, e.g. Thursday, Jan 15th, or "No due date">
Project: <project name>            (line present only when the task has a project)
Description:
<description, or "None">
Documents:
- <document name>
- <document name>                  (or "None" when the task has no documents)
```

- Documents are the task's linked documents (DocLinks data), listed by name. The document model carries no stable URL (file links resolve to one-hour signed URLs on demand), so no links are invented; names only.
- The due label each surface already displays is what gets copied: the detail page's next-occurrence date for a recurring task, the panel's stored date otherwise.
- Success shows the standard toast, "Task copied." A failed document load or clipboard write shows an error toast and copies nothing, so a bug brief never goes out silently missing its documents.
- Non-goals: no copy button on Tasks & reminders rows (different, denser row pattern; follow-up if wanted), no document URLs, no change to how documents are stored or loaded.

## Pseudocode

- Pure helper `buildTaskCopyText({ title, due, projectName, description, documents })` in `src/lib/taskCopy.js` assembles the text; `taskDocNames(links)` maps DocLinks rows to trimmed names. No imports, unit-tested.
- Shared component `CopyTaskButton` (`src/components/CopyTaskButton.jsx`): on click, load the task's links with the existing `loadDocLinks("reminder", task.id)` (the same loader `DocLinks` uses), build the text, write it with the existing `copyToClipboard` helper from `ToastContext` (Clipboard API with the textarea fallback), then toast.
- Both surfaces render `CopyTaskButton` with the task, its project name, and the due label they already compute.

## Steps

- [x] Feature document and contract (this file)
- [x] Pure text builder plus unit tests, added to the `npm test` chain
- [x] `copyToClipboard` exported from ToastContext for reuse
- [x] Shared `CopyTaskButton` component
- [x] Button wired into the task detail page and the Projects task panel
- [x] Tests, lint, build verified; local-mode click check
- [x] WORKLOG and CHANGELOG entries

## Validation (2026-11-13)

- New tests `src/lib/taskCopy.test.js`: 9 assertions covering documents present, no documents, no due date, no description, project line omitted when unset, document-name trimming/filtering. Full `npm test` chain passes, ESLint clean on changed files, `npm run build` passes.
- Local mode (`VITE_LOCAL_DATA=1`) click check with Playwright: opened a task in the Projects panel, clicked Copy, read the clipboard back from the page — text matched the contract shape (title, due label, project, description, document names from the local DocLinks data).
- Not covered: Tasks & reminders page rows (noted as a follow-up above); the signed-in production click-through remains Scott's, after he approves the push.

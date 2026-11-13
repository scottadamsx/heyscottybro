import { useState } from "react";
import { loadDocLinks } from "../api/docLinksApi";
import { buildTaskCopyText, taskDocNames } from "../lib/taskCopy";
import { copyToClipboard, useToast } from "../contexts/ToastContext";

/**
 * Copy button for a task/reminder: copies a plain-text brief (title, due,
 * project, description, linked document names) shaped to paste straight to
 * an AI agent. Documents load on click through the same loadDocLinks the
 * DocLinks panel uses; a failed load copies nothing and toasts the error,
 * so a brief never goes out silently missing its documents.
 *
 * Props:
 *   task         the reminder row (id, name, description)
 *   projectName  project name, or null
 *   dueLabel     due date in the shared display format, or null
 *   className    button styling (default btn-secondary-sm)
 */
export default function CopyTaskButton({ task, projectName = null, dueLabel = null, className = "btn-secondary-sm" }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    if (busy || !task?.id) return;
    setBusy(true);
    try {
      const links = await loadDocLinks("reminder", task.id);
      const text = buildTaskCopyText({
        title: task.name,
        due: dueLabel,
        projectName,
        description: task.description,
        documents: taskDocNames(links),
      });
      await copyToClipboard(text);
      addToast("Task copied.", "success");
    } catch (e) {
      addToast(`Couldn't copy task: ${e?.message || e}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={copy} disabled={busy} title="Copy task brief (title, due, description, documents)">
      <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-copy"}`} aria-hidden="true" /> Copy
    </button>
  );
}

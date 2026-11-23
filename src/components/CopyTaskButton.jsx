import { useState } from "react";
import { loadDocLinks } from "../api/docLinksApi";
import { buildTaskCopyText, taskDocNames } from "../lib/taskCopy";
import { copyText } from "../utils/clipboard";
import { useToast } from "../contexts/ToastContext";
import { Modal } from "./ui";

/**
 * Copy button for a task/reminder: copies a plain-text brief (title, due,
 * project, description, linked document names) shaped to paste straight to
 * an AI agent. Documents load on click through the same loadDocLinks the
 * DocLinks panel uses; a failed load copies nothing and toasts the error,
 * so a brief never goes out silently missing its documents.
 *
 * If the clipboard itself refuses (denied permission, unfocused document,
 * in-app browser), the brief opens in a dialog, already selected, so Scott
 * can copy it by hand. The raw platform error is never shown.
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
  const [manualText, setManualText] = useState(null);

  const copy = async () => {
    if (busy || !task?.id) return;
    setBusy(true);
    let text;
    try {
      const links = await loadDocLinks("reminder", task.id);
      text = buildTaskCopyText({
        title: task.name,
        due: dueLabel,
        projectName,
        description: task.description,
        documents: taskDocNames(links),
      });
    } catch {
      addToast("Couldn't load this task's documents, so nothing was copied.", "error");
      setBusy(false);
      return;
    }
    try {
      await copyText(text);
      addToast("Task copied.", "success");
    } catch {
      setManualText(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={copy} disabled={busy} title="Copy task brief (title, due, description, documents)">
        <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-copy"}`} aria-hidden="true" /> Copy
      </button>
      {manualText != null && (
        <Modal
          title="Copy this task by hand"
          onClose={() => setManualText(null)}
          footer={(
            <button type="button" className="btn" onClick={() => setManualText(null)}>Done</button>
          )}
        >
          <p>The copy did not go through automatically. The task text is selected below, copy it by hand: Ctrl+C or Command+C, or tap and hold on a phone.</p>
          <textarea
            readOnly
            value={manualText}
            rows={10}
            aria-label="Task text to copy"
            data-autofocus
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
    </>
  );
}

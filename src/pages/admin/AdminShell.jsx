import { useEffect } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import MotionScope from "../../components/motion/MotionScope";
import { AgentRuntimeProvider } from "../../contexts/AgentRuntimeContext";
import AdminLayout from "./AdminLayout";
import { updateEvent, completeReminder, loadJournal, updateJournalEntry } from "../../api/plannerApi";
import { useToast } from "../../contexts/ToastContext";

/**
 * The signed-in app's frame (sign-in check, agent runtime, layout), loaded as its own chunk
 * from App.jsx so the public site never downloads Supabase auth, the agents or the admin.
 */
export default function AdminShell() {
  const { addToast } = useToast();
  useEffect(() => {
    const onOrbitSaved = async (event) => {
      const { sourceHostEventId, orbitEventId } = event.detail || {};
      if (!sourceHostEventId || !orbitEventId) return;
      try {
        await updateEvent(sourceHostEventId, { orbit_log_status: "logged", orbit_event_id: orbitEventId });
        addToast("Event logged in Orbit.", "success");
      } catch (err) {
        addToast(`Orbit saved the log, but the event link wasn't recorded. Reopen Log in Orbit to retry safely. ${err?.message || ""}`, "error");
      }
    };
    const onReminderSaved = async (event) => {
      const { reminderId, occurrenceDate, destination } = event.detail || {};
      if (!reminderId || !occurrenceDate) return;
      try {
        await completeReminder(reminderId, occurrenceDate);
        addToast(`Reminder completed after saving ${destination || "your entry"}.`, "success");
      } catch (err) {
        addToast(`Your ${destination || "entry"} was saved, but the reminder is still open. Mark it done manually or retry: ${err?.message || "unknown error"}`, "error");
      }
    };
    const onOrbitJournalSaved = async (event) => {
      const { sourceHostJournalId, orbitJournalId, receipt } = event.detail || {};
      if (!sourceHostJournalId || !orbitJournalId) return;
      try {
        const entries = await loadJournal();
        const source = entries.find((entry) => String(entry.id) === String(sourceHostJournalId));
        if (!source) throw new Error("The original journal entry could not be found.");
        const previous = source.ai_provenance && typeof source.ai_provenance === "object" ? source.ai_provenance : {};
        await updateJournalEntry(source.id, { aiProvenance: {
          ...previous,
          orbit: { status: "saved", orbitJournalId, personReferences: receipt?.personReferences || [], receipt: receipt || null },
        } });
        addToast("Orbit updates saved and linked to this journal entry.", "success");
      } catch (err) {
        addToast(`Orbit saved the updates, but the journal link wasn't recorded. Reopen Review in Orbit to retry. ${err?.message || ""}`, "error");
      }
    };
    const onOrbitJournalUndone = async (event) => {
      const { sourceHostJournalId, orbitJournalId } = event.detail || {};
      if (!sourceHostJournalId || !orbitJournalId) return;
      try {
        const entries = await loadJournal();
        const source = entries.find((entry) => String(entry.id) === String(sourceHostJournalId));
        if (!source) return;
        const previous = source.ai_provenance && typeof source.ai_provenance === "object" ? source.ai_provenance : {};
        await updateJournalEntry(source.id, { aiProvenance: {
          ...previous,
          orbit: { ...(previous.orbit || {}), status: "undone", orbitJournalId, personReferences: [], receipt: null },
        } });
        addToast("Orbit changes were undone; the journal entry remains.", "success");
      } catch (err) {
        addToast(`Orbit undid its changes, but couldn't update the journal link: ${err?.message || "unknown error"}`, "error");
      }
    };
    window.addEventListener("orbit:host-event-saved", onOrbitSaved);
    window.addEventListener("orbit:host-journal-saved", onOrbitJournalSaved);
    window.addEventListener("orbit:host-journal-undone", onOrbitJournalUndone);
    window.addEventListener("app:reminder-destination-saved", onReminderSaved);
    return () => {
      window.removeEventListener("orbit:host-event-saved", onOrbitSaved);
      window.removeEventListener("orbit:host-journal-saved", onOrbitJournalSaved);
      window.removeEventListener("orbit:host-journal-undone", onOrbitJournalUndone);
      window.removeEventListener("app:reminder-destination-saved", onReminderSaved);
    };
  }, [addToast]);
  return (
    <ProtectedRoute>
      <MotionScope>
        <AgentRuntimeProvider>
          <AdminLayout />
        </AgentRuntimeProvider>
      </MotionScope>
    </ProtectedRoute>
  );
}

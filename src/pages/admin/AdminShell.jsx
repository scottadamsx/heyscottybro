import { useEffect } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import MotionScope from "../../components/motion/MotionScope";
import { AgentRuntimeProvider } from "../../contexts/AgentRuntimeContext";
import AdminLayout from "./AdminLayout";
import { updateEvent, completeReminder } from "../../api/plannerApi";
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
    window.addEventListener("orbit:host-event-saved", onOrbitSaved);
    window.addEventListener("app:reminder-destination-saved", onReminderSaved);
    return () => {
      window.removeEventListener("orbit:host-event-saved", onOrbitSaved);
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

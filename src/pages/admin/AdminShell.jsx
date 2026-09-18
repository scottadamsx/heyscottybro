import ProtectedRoute from "../../components/ProtectedRoute";
import MotionScope from "../../components/motion/MotionScope";
import { AgentRuntimeProvider } from "../../contexts/AgentRuntimeContext";
import AdminLayout from "./AdminLayout";

/**
 * The signed-in app's frame (sign-in check, agent runtime, layout), loaded as its own chunk
 * from App.jsx so the public site never downloads Supabase auth, the agents or the admin.
 */
export default function AdminShell() {
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

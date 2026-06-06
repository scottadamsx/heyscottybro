import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { isLocalMode } from "../api/plannerApi";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (isLocalMode()) { setStatus("authed"); return undefined; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "authed" : "unauthed");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "authed" : "unauthed");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (status === "unauthed") {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

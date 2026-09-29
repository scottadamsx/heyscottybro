import { Fragment, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { isLocalMode } from "../api/plannerApi";
import { bindEstablishedOwnerId, protectedAuthTransition } from "../utils/authIdentityBoundary";

export default function ProtectedRoute({ children }) {
  const [auth, setAuth] = useState({ status: "loading", ownerId: null });
  const ownerRef = useRef(undefined);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (isLocalMode()) {
      bindEstablishedOwnerId("local");
      ownerRef.current = "local";
      setAuth({ status: "authed", ownerId: "local" });
      return undefined;
    }

    let cancelled = false;
    const applySession = (session) => {
      if (cancelled || reloadingRef.current) return;
      const next = protectedAuthTransition(ownerRef.current, session);
      if (next.action === "reload") {
        // Hide/unmount all owner-bound UI immediately, then terminate pending
        // model/tool/save continuations by replacing this browser runtime.
        reloadingRef.current = true;
        bindEstablishedOwnerId(null);
        setAuth({ status: "loading", ownerId: null });
        window.location.reload();
        return;
      }
      bindEstablishedOwnerId(next.ownerId);
      ownerRef.current = next.ownerId;
      setAuth({ status: next.status, ownerId: next.ownerId });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    }).catch(() => applySession(null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (auth.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (auth.status === "unauthed") {
    return <Navigate to="/admin/login" replace />;
  }

  return <Fragment key={auth.ownerId}>{children}</Fragment>;
}

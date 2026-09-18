import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import EmptyState from "../../components/EmptyState";

/* Unknown /admin/* path: a 404 inside the admin shell (the rail stays, so you can navigate away). */
export default function AdminNotFound() {
  const { pathname } = useLocation();
  useEffect(() => {
    const prev = document.title;
    document.title = "Page not found — heyScottyBro";
    return () => { document.title = prev; };
  }, []);
  return (
    <div className="module-page">
      <div className="module-header"><h1>Page not found</h1></div>
      <EmptyState
        icon="fa-compass"
        title={`Nothing lives at ${pathname}`}
        description="The link may be old, or the page was moved or renamed. Pick a space from the sidebar, or head back to Today."
        action={<Link to="/admin/today" className="btn btn-primary">Go to Today</Link>}
      />
    </div>
  );
}

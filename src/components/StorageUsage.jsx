import { useCallback, useEffect, useState } from "react";
import { loadStorageUsage } from "../api/plannerApi";

// Plan quotas (bytes). Supabase Free tier = 500 MB DB / 1 GB file storage.
// Override via env if you upgrade (e.g. Pro = 8 GB DB).
const MB = 1024 * 1024;
const DB_LIMIT = (Number(import.meta.env.VITE_SUPABASE_DB_LIMIT_MB) || 500) * MB;
const STORAGE_LIMIT = (Number(import.meta.env.VITE_SUPABASE_STORAGE_LIMIT_MB) || 1024) * MB;

function fmt(b) {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * MB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / (1024 * MB)).toFixed(2)} GB`;
}

function Bar({ label, used, limit }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? "var(--red)" : pct >= 75 ? "var(--gold,var(--orange))" : "var(--green)";
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{fmt(used)} / {fmt(limit)} · {pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 8, background: "var(--bg-raised,#222)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5, transition: "width .3s" }} />
      </div>
    </div>
  );
}

export default function StorageUsage() {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [expanded, setExpanded] = useState(false);

  const fetchUsage = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      const data = await loadStorageUsage();
      if (!data) { setState({ status: "unavailable", data: null, error: "" }); return; }
      setState({ status: "ready", data, error: "" });
    } catch (e) {
      setState({ status: "error", data: null, error: e?.message || "Failed to load storage usage." });
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const { status, data, error } = state;
  const buckets = data?.buckets || [];
  const tables = data?.tables || [];
  const storageBytes = buckets.reduce((s, b) => s + (Number(b.bytes) || 0), 0);

  return (
    <div className="db-card col-6">
      <div className="db-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="db-card-title"><i className="fa-solid fa-database" style={{ marginRight: 8, opacity: 0.7 }} />Storage</h3>
        <button className="btn btn-sm btn-secondary-sm" onClick={fetchUsage} disabled={status === "loading"} aria-label="Refresh storage usage">
          <i className={`fa-solid fa-rotate-right ${status === "loading" ? "fa-spin" : ""}`} />
        </button>
      </div>

      {status === "loading" && <p className="no-entries">Measuring…</p>}

      {status === "error" && (
        <p className="error-message" style={{ fontSize: "0.85rem" }}>
          {/function .*does not exist|could not find/i.test(error)
            ? "storage_usage() isn’t in the database yet — run MIGRATION_2026-06-14-storage-usage.sql in the Supabase SQL editor."
            : error}
        </p>
      )}

      {status === "unavailable" && (
        <p className="no-entries">Storage usage is unavailable in local mode or while signed out.</p>
      )}

      {status === "ready" && (
        <>
          <div style={{ marginTop: "0.5rem" }}>
            <Bar label="Database" used={data.db_bytes} limit={DB_LIMIT} />
            <Bar label="File storage" used={storageBytes} limit={STORAGE_LIMIT} />
          </div>

          <button className="dashboard-expand" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide breakdown" : "Show breakdown"} <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`} />
          </button>

          {expanded && (
            <div style={{ marginTop: "0.6rem" }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>Tables</div>
              <div className="db-list">
                {tables.slice(0, 12).map((t) => (
                  <div className="db-list-item" key={t.name} style={{ padding: "4px 0" }}>
                    <div className="db-list-item-title" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{t.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{fmt(t.bytes)}</div>
                  </div>
                ))}
                {tables.length === 0 && <p className="no-entries">No tables found.</p>}
              </div>

              <div className="stat-label" style={{ margin: "0.7rem 0 4px" }}>File buckets</div>
              <div className="db-list">
                {buckets.map((b) => (
                  <div className="db-list-item" key={b.name} style={{ padding: "4px 0" }}>
                    <div className="db-list-item-title" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{b.name} <span style={{ color: "var(--text-muted)" }}>· {b.files} file{b.files === 1 ? "" : "s"}</span></div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{fmt(b.bytes)}</div>
                  </div>
                ))}
                {buckets.length === 0 && <p className="no-entries">No files stored yet.</p>}
              </div>
            </div>
          )}

          {data.measured_at && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
              Measured {new Date(data.measured_at).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

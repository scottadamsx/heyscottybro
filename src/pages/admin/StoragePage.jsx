import { useCallback, useEffect, useState } from "react";
import { loadStorageUsage } from "../../api/plannerApi";

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

function colorFor(pct) {
  return pct >= 90 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "#22c55e";
}

// Big quota bar (Database / File storage vs plan limit)
function QuotaBar({ label, icon, used, limit }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = colorFor(pct);
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}><i className={`fa-solid ${icon}`} style={{ marginRight: 8, opacity: 0.7 }} />{label}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-mono,monospace)" }}>{fmt(used)} / {fmt(limit)} · {pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 12, background: "var(--bg-raised,#222)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, transition: "width .3s" }} />
      </div>
      {pct >= 75 && (
        <div style={{ fontSize: 11, color, marginTop: 4 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
          {pct >= 90 ? "Nearly full — consider cleaning up or upgrading." : "Getting full — keep an eye on this."}
        </div>
      )}
    </div>
  );
}

// Per-item row with a share-of-total bar
function ItemRow({ name, sub, bytes, maxBytes, totalBytes }) {
  const pctOfMax = maxBytes > 0 ? (bytes / maxBytes) * 100 : 0;
  const shareOfTotal = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono,monospace)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}{sub ? <span style={{ color: "var(--text-muted)" }}> · {sub}</span> : null}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono,monospace)", flexShrink: 0 }}>
          {fmt(bytes)} <span style={{ opacity: 0.6 }}>({shareOfTotal.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: 5, background: "var(--bg-raised,#222)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pctOfMax}%`, background: "var(--accent,#6366f1)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function StoragePage() {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

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
  const tables = [...(data?.tables || [])].sort((a, b) => (Number(b.bytes) || 0) - (Number(a.bytes) || 0));
  const buckets = [...(data?.buckets || [])].sort((a, b) => (Number(b.bytes) || 0) - (Number(a.bytes) || 0));
  const dbBytes = Number(data?.db_bytes) || 0;
  const storageBytes = buckets.reduce((s, b) => s + (Number(b.bytes) || 0), 0);
  const maxTable = tables.length ? Number(tables[0].bytes) || 0 : 0;
  const maxBucket = buckets.length ? Number(buckets[0].bytes) || 0 : 0;

  const card = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.6rem", padding: "1.1rem 1.25rem", marginBottom: 14 };
  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 12px", fontWeight: 600 };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-database" /> Storage</h1>
        <button className="btn-primary" onClick={fetchUsage} disabled={status === "loading"}>
          <i className={`fa-solid fa-rotate-right ${status === "loading" ? "fa-spin" : ""}`} /> Refresh
        </button>
      </div>

      {status === "loading" && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Measuring database and file storage…</p>}

      {status === "error" && (
        <div style={{ ...card, borderColor: "rgba(239,68,68,0.3)" }}>
          <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>
            {/function .*does not exist|could not find/i.test(error)
              ? "storage_usage() isn’t in the database yet — run MIGRATION_2026-06-14-storage-usage.sql in the Supabase SQL editor, then refresh."
              : error}
          </p>
        </div>
      )}

      {status === "unavailable" && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Storage usage is unavailable in local mode or while signed out.</p>
      )}

      {status === "ready" && (
        <>
          {/* Quota overview */}
          <div style={card}>
            <p style={sh}>Plan quotas</p>
            <QuotaBar label="Database" icon="fa-table" used={dbBytes} limit={DB_LIMIT} />
            <QuotaBar label="File storage" icon="fa-folder-open" used={storageBytes} limit={STORAGE_LIMIT} />
            <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{tables.length} table{tables.length === 1 ? "" : "s"}</span>
              <span>{buckets.length} bucket{buckets.length === 1 ? "" : "s"}</span>
              <span>{buckets.reduce((s, b) => s + (Number(b.files) || 0), 0)} file{buckets.reduce((s, b) => s + (Number(b.files) || 0), 0) === 1 ? "" : "s"}</span>
            </div>
          </div>

          {/* Tables breakdown */}
          <div style={card}>
            <p style={sh}>Database tables · {fmt(dbBytes)}</p>
            {tables.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No tables found.</p>
              : tables.map((t) => (
                <ItemRow key={t.name} name={t.name} bytes={Number(t.bytes) || 0} maxBytes={maxTable} totalBytes={dbBytes} />
              ))
            }
          </div>

          {/* File buckets breakdown */}
          <div style={card}>
            <p style={sh}>File buckets · {fmt(storageBytes)}</p>
            {buckets.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No files stored yet.</p>
              : buckets.map((b) => (
                <ItemRow key={b.name} name={b.name} sub={`${b.files} file${b.files === 1 ? "" : "s"}`} bytes={Number(b.bytes) || 0} maxBytes={maxBucket} totalBytes={storageBytes} />
              ))
            }
          </div>

          {data.measured_at && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Measured {new Date(data.measured_at).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { loadStorageUsage } from "../../api/plannerApi";
import "./mission.css";

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

function toneFor(pct) {
  return pct >= 90 ? "bad" : pct >= 75 ? "warn" : "good";
}

// Big quota bar (Database / File storage vs plan limit)
function QuotaBar({ label, icon, used, limit }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const tone = toneFor(pct);
  return (
    <div className="storage-quota">
      <div className="storage-row-head">
        <span className="storage-quota-label"><i className={`fa-solid ${icon}`} aria-hidden="true" />{label}</span>
        <span className="storage-num">{fmt(used)} / {fmt(limit)} · {pct.toFixed(1)}%</span>
      </div>
      <div className={`fin-progress storage-bar tone-${tone}`}><span style={{ width: `${pct}%` }} /></div>
      {pct >= 75 && (
        <div className={`storage-warn tone-${tone}`}>
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
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
    <div className="storage-item">
      <div className="storage-row-head">
        <span className="storage-item-name">
          <code>{name}</code>{sub ? <span className="storage-item-sub"> · {sub}</span> : null}
        </span>
        <span className="storage-num">
          {fmt(bytes)} <span className="storage-num-sub">({shareOfTotal.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="fin-progress storage-item-bar"><span style={{ width: `${pctOfMax}%` }} /></div>
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

  return (
    <div className="module-page storage-page">
      <div className="module-header">
        <h1>Storage</h1>
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={fetchUsage} disabled={status === "loading"}>
          <i className={`fa-solid fa-rotate-right ${status === "loading" ? "fa-spin" : ""}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {status === "loading" && <p className="no-entries">Measuring database and file storage…</p>}

      {status === "error" && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">
            {/function .*does not exist|could not find/i.test(error)
              ? "storage_usage() isn’t in the database yet — run MIGRATION_2026-06-14-storage-usage.sql in the Supabase SQL editor, then refresh."
              : error}
          </p>
        </div>
      )}

      {status === "unavailable" && (
        <p className="no-entries">Storage usage is unavailable in local mode or while signed out.</p>
      )}

      {status === "ready" && (
        <>
          {/* Quota overview */}
          <section className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Plan quotas</h3>
            </div>
            <QuotaBar label="Database" icon="fa-table" used={dbBytes} limit={DB_LIMIT} />
            <QuotaBar label="File storage" icon="fa-folder-open" used={storageBytes} limit={STORAGE_LIMIT} />
            <div className="storage-counts">
              <span>{tables.length} table{tables.length === 1 ? "" : "s"}</span>
              <span>{buckets.length} bucket{buckets.length === 1 ? "" : "s"}</span>
              <span>{buckets.reduce((s, b) => s + (Number(b.files) || 0), 0)} file{buckets.reduce((s, b) => s + (Number(b.files) || 0), 0) === 1 ? "" : "s"}</span>
            </div>
          </section>

          <div className="storage-pair">
            {/* Tables breakdown */}
            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">Database tables</h3>
                <span className="storage-card-meta">{fmt(dbBytes)}</span>
              </div>
              {tables.length === 0
                ? <p className="no-entries">No tables found.</p>
                : tables.map((t) => (
                  <ItemRow key={t.name} name={t.name} bytes={Number(t.bytes) || 0} maxBytes={maxTable} totalBytes={dbBytes} />
                ))
              }
            </section>

            {/* File buckets breakdown */}
            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">File buckets</h3>
                <span className="storage-card-meta">{fmt(storageBytes)}</span>
              </div>
              {buckets.length === 0
                ? <p className="no-entries">No files stored yet.</p>
                : buckets.map((b) => (
                  <ItemRow key={b.name} name={b.name} sub={`${b.files} file${b.files === 1 ? "" : "s"}`} bytes={Number(b.bytes) || 0} maxBytes={maxBucket} totalBytes={storageBytes} />
                ))
              }
            </section>
          </div>

          {data.measured_at && (
            <p className="storage-measured">
              Measured {new Date(data.measured_at).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

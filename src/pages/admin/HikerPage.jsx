import { useEffect, useRef, useState } from "react";
import { loadMembers, loadStats, importCSV, exportCSV } from "../../api/hikerApi";

export default function HikerPage() {
  const [view, setView] = useState("dashboard"); // dashboard | members
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("last");
  const [sortDir, setSortDir] = useState("asc");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const reload = async () => {
    const [s, m] = await Promise.all([loadStats(), loadMembers(search)]);
    setStats(s);
    setMembers(m);
  };

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    loadMembers(search).then(setMembers);
  }, [search]);

  const handleFiles = async (files) => {
    if (!files.length) return;
    setImporting(true);
    setImportResult(null);
    let totals = { first_timers: 0, returning: 0, total: 0, files: files.length };
    for (const file of Array.from(files)) {
      const text = await file.text();
      const result = await importCSV(text, file.name);
      totals.first_timers += result.first_timers;
      totals.returning += result.returning;
      totals.total += result.total;
    }
    setImportResult(totals);
    setImporting(false);
    await reload();
    setView("dashboard");
  };

  const sorted = [...members].sort((a, b) => {
    let va = a[sortCol] ?? "", vb = b[sortCol] ?? "";
    if (sortCol === "attendance") return sortDir === "asc" ? va - vb : vb - va;
    va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const arrow = (col) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>⛰️ SJHC Hiker Database</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`filter-chip ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={`filter-chip ${view === "members" ? "active" : ""}`} onClick={() => setView("members")}>
            Members {members.length > 0 && `(${members.length})`}
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`hiker-drop-zone ${dragOver ? "dragover" : ""} ${importing ? "importing" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input ref={fileRef} type="file" accept=".csv" multiple hidden onChange={e => handleFiles(e.target.files)} />
        <div className="hiker-drop-icon">{importing ? "⏳" : "📂"}</div>
        <div className="hiker-drop-text">{importing ? "Importing…" : "Drop CSV files here or tap to upload"}</div>
        <div className="hiker-drop-hint">Auto-detects name, email &amp; phone columns</div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="hiker-import-result">
          <h3>Import Complete — {importResult.files} file{importResult.files !== 1 ? "s" : ""}</h3>
          <div className="hiker-import-grid">
            <div className="hiker-import-card">
              <div className="hiker-import-num">{importResult.total}</div>
              <div className="hiker-import-label">Total Processed</div>
            </div>
            <div className="hiker-import-card">
              <div className="hiker-import-num" style={{ color: "var(--green)" }}>{importResult.first_timers}</div>
              <div className="hiker-import-label">🆕 First Timers</div>
            </div>
            <div className="hiker-import-card">
              <div className="hiker-import-num" style={{ color: "var(--orange)" }}>{importResult.returning}</div>
              <div className="hiker-import-label">🔄 Returning</div>
            </div>
          </div>
          <button className="btn" style={{ marginTop: "0.75rem" }} onClick={() => { setView("members"); setImportResult(null); }}>
            View Members →
          </button>
        </div>
      )}

      {/* Dashboard */}
      {view === "dashboard" && stats && (
        <>
          <div className="hiker-stats-grid">
            <div className="hiker-stat-card">
              <div className="hiker-stat-num">{stats.total}</div>
              <div className="hiker-stat-label">Total Members</div>
            </div>
            <div className="hiker-stat-card">
              <div className="hiker-stat-num">{stats.returning}</div>
              <div className="hiker-stat-label">Returning Hikers</div>
            </div>
            <div className="hiker-stat-card">
              <div className="hiker-stat-num">{stats.withEmail}</div>
              <div className="hiker-stat-label">Have Email</div>
            </div>
            <div className="hiker-stat-card">
              <div className="hiker-stat-num">{stats.totalCheckins}</div>
              <div className="hiker-stat-label">Total Check-ins</div>
            </div>
            <div className="hiker-stat-card">
              <div className="hiker-stat-num">{stats.totalImports}</div>
              <div className="hiker-stat-label">CSVs Imported</div>
            </div>
          </div>

          {stats.topHikers.length > 0 && (
            <div className="db-card">
              <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>🏆 Most Active Hikers</h3>
              {stats.topHikers.map((h, i) => (
                <div key={i} className="completed-item">
                  <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontWeight: 800, color: "var(--orange)", width: "28px" }}>#{i + 1}</span>
                    <span>{h.first} {h.last}</span>
                  </span>
                  <span style={{ background: "rgba(251,146,60,0.15)", color: "var(--orange)", padding: "2px 12px", borderRadius: "100px", fontSize: "0.78rem", fontWeight: 700 }}>
                    {h.attendance}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Members Table */}
      {view === "members" && (
        <>
          <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <input
              className="hiker-search"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {sorted.length} result{sorted.length !== 1 ? "s" : ""}
            </span>
            <button className="btn-sm btn-secondary-sm btn" onClick={() => exportCSV(sorted)}>
              📥 Export
            </button>
          </div>

          <div className="hiker-table-wrap">
            <table className="hiker-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("first")}>First{arrow("first")}</th>
                  <th onClick={() => toggleSort("last")}>Last{arrow("last")}</th>
                  <th onClick={() => toggleSort("email")}>Email{arrow("email")}</th>
                  <th onClick={() => toggleSort("phone")}>Phone{arrow("phone")}</th>
                  <th onClick={() => toggleSort("attendance")}>Check-ins{arrow("attendance")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No members yet. Upload a CSV to get started.
                  </td></tr>
                )}
                {sorted.map(m => (
                  <tr key={m.id}>
                    <td>{m.first}</td>
                    <td>{m.last}</td>
                    <td style={{ color: m.email ? "var(--text-primary)" : "var(--text-muted)" }}>{m.email || "—"}</td>
                    <td style={{ color: m.phone ? "var(--text-primary)" : "var(--text-muted)" }}>{m.phone || "—"}</td>
                    <td>
                      <span className={`hiker-badge ${m.attendance > 1 ? "hiker-badge-ret" : "hiker-badge-new"}`}>
                        {m.attendance}×
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadMembers, loadStats, importCSV, exportCSV, loadHikeHistory, loadHikeAttendees, deleteHikeImport } from "../../api/hikerApi";

export default function HikerPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState("dashboard"); // dashboard | members | history | hike-detail
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("last");
  const [sortDir, setSortDir] = useState("asc");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  // Hike name/date modal
  const [pendingFiles, setPendingFiles] = useState(null);
  const [hikeModal, setHikeModal] = useState(false);
  const [hikeName, setHikeName] = useState("");
  const [hikeDate, setHikeDate] = useState(new Date().toISOString().split("T")[0]);

  // History
  const [hikes, setHikes] = useState([]);
  const [selectedHike, setSelectedHike] = useState(null);
  const [hikeAttendees, setHikeAttendees] = useState([]);
  const [copyAnim, setCopyAnim] = useState(false);
  const [deletingHike, setDeletingHike] = useState(false);

  const reload = async () => {
    const [s, m] = await Promise.all([loadStats(), loadMembers(search)]);
    setStats(s);
    setMembers(m);
  };

  const reloadHistory = async () => {
    const h = await loadHikeHistory().catch(() => []);
    setHikes(h);
  };

  useEffect(() => { reload(); reloadHistory(); }, []);
  useEffect(() => { loadMembers(search).then(setMembers); }, [search]);

  const handleFiles = (files) => {
    if (!files.length) return;
    setPendingFiles(files);
    setHikeName("");
    setHikeDate(new Date().toISOString().split("T")[0]);
    setHikeModal(true);
  };

  const runImport = async () => {
    if (!hikeName.trim()) return;
    setHikeModal(false);
    setImporting(true);
    setImportResult(null);
    let totals = { first_timers: 0, returning: 0, total: 0, files: pendingFiles.length };
    for (const file of Array.from(pendingFiles)) {
      const text = await file.text();
      const result = await importCSV(text, file.name, hikeName.trim(), hikeDate);
      totals.first_timers += result.first_timers;
      totals.returning += result.returning;
      totals.total += result.total;
    }
    setImportResult(totals);
    setImporting(false);
    await reload();
    await reloadHistory();
    setView("dashboard");
  };

  const openHike = async (hike) => {
    setSelectedHike(hike);
    const attendees = await loadHikeAttendees(hike.id).catch(() => []);
    setHikeAttendees(attendees);
    setView("hike-detail");
  };

  // Sidebar drives view / selected hike via URL params
  useEffect(() => {
    const hikeId = params.get("hike");
    const v = params.get("view");
    if (hikeId) {
      const h = hikes.find((x) => String(x.id) === hikeId);
      if (h && selectedHike?.id !== h.id) openHike(h);
    } else if (v) {
      setView(v);
      setSelectedHike(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, hikes]);

  const copyEmails = () => {
    const emails = hikeAttendees.filter(m => m.email).map(m => m.email).join(", ");
    navigator.clipboard.writeText(emails).then(() => {
      setCopyAnim(true);
      setTimeout(() => setCopyAnim(false), 2000);
    });
  };

  const handleDeleteHike = async () => {
    if (!selectedHike) return;
    const confirmed = window.confirm(`Delete "${selectedHike.hike_name || selectedHike.filename}"? This will also adjust member attendance counts.`);
    if (!confirmed) return;
    setDeletingHike(true);
    try {
      await deleteHikeImport(selectedHike.id);
      setSelectedHike(null);
      setHikeAttendees([]);
      setView("history");
      await reload();
      await reloadHistory();
    } finally {
      setDeletingHike(false);
    }
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
      </div>

      {/* Hike Name Modal */}
      {hikeModal && (
        <div className="event-overlay" onClick={e => { if (e.target.className === "event-overlay") setHikeModal(false); }}>
          <div className="event-card">
            <h3>Name This Hike</h3>
            <input
              placeholder="e.g. Blue Mountains Day Hike"
              value={hikeName}
              onChange={e => setHikeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && hikeName.trim() && runImport()}
              autoFocus
            />
            <label style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Hike date</label>
            <input
              type="date"
              value={hikeDate}
              onChange={e => setHikeDate(e.target.value)}
            />
            <div className="budget-widget-actions">
              <button className="btn" onClick={runImport} disabled={!hikeName.trim()}>Import</button>
              <button className="btn" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setHikeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Hike History List */}
      {view === "history" && (
        <div className="db-card">
          <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>🗓️ Hike History</h3>
          {hikes.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>No hikes recorded yet. Import a CSV to get started.</p>
          )}
          {hikes.map(h => (
            <button key={h.id} className="hiker-hike-row" onClick={() => openHike(h)}>
              <div>
                <div className="hiker-hike-name">{h.hike_name || h.filename}</div>
                <div className="hiker-hike-meta">
                  {h.hike_date ? new Date(h.hike_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : h.imported_at}
                  {" · "}{h.total} hiker{h.total !== 1 ? "s" : ""}
                  {h.first_timers > 0 && ` · ${h.first_timers} new`}
                </div>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* Hike Detail */}
      {view === "hike-detail" && selectedHike && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <button className="btn-sm btn-secondary-sm btn" onClick={() => setView("history")}>← Back</button>
            <h2 style={{ margin: 0, fontSize: "1.1rem", flex: 1 }}>{selectedHike.hike_name || selectedHike.filename}</h2>
            <button
              className="btn-sm btn"
              style={{ background: "var(--red, #ef4444)", color: "#fff", opacity: deletingHike ? 0.6 : 1 }}
              onClick={handleDeleteHike}
              disabled={deletingHike}
            >
              {deletingHike ? "Deleting…" : "🗑 Delete"}
            </button>
          </div>

          <div className="db-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {selectedHike.hike_date ? new Date(selectedHike.hike_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : selectedHike.imported_at}
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {hikeAttendees.length} attendee{hikeAttendees.length !== 1 ? "s" : ""}
                  {" · "}{hikeAttendees.filter(m => m.email).length} with email
                </div>
              </div>
              <button
                className={`btn hiker-copy-btn ${copyAnim ? "copied" : ""}`}
                onClick={copyEmails}
                disabled={hikeAttendees.filter(m => m.email).length === 0}
              >
                {copyAnim ? "✓ Copied!" : "📋 Copy Emails"}
              </button>
            </div>

            <div className="hiker-table-wrap">
              <table className="hiker-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Total Check-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {hikeAttendees.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                      No attendee data for this hike.
                    </td></tr>
                  )}
                  {hikeAttendees.map(m => (
                    <tr key={m.id}>
                      <td>{m.first} {m.last}</td>
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
          </div>
        </>
      )}
    </div>
  );
}

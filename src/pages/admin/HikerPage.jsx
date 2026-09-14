import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadMembers, loadStats, importCSV, exportCSV, loadHikeHistory, loadHikeAttendees } from "../../api/hikerApi";
import { toDateStr } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import "./mission.css";
import { RowChevron } from "../../components/ui";

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
  const [importError, setImportError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  // Hike name/date modal
  const [pendingFiles, setPendingFiles] = useState(null);
  const [hikeModal, setHikeModal] = useState(false);
  const [hikeName, setHikeName] = useState("");
  const [hikeDate, setHikeDate] = useState(() => toDateStr(new Date()));

  // History
  const [hikes, setHikes] = useState([]);
  const [selectedHike, setSelectedHike] = useState(null);
  const [hikeAttendees, setHikeAttendees] = useState([]);
  const [copyAnim, setCopyAnim] = useState(false);

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
    setHikeDate(toDateStr(new Date()));
    setHikeModal(true);
  };

  const runImport = async () => {
    if (!hikeName.trim()) return;
    setHikeModal(false);
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      let totals = { first_timers: 0, returning: 0, total: 0, files: pendingFiles.length };
      for (const file of Array.from(pendingFiles)) {
        const text = await file.text();
        const result = await importCSV(text, file.name, hikeName.trim(), hikeDate);
        totals.first_timers += result.first_timers;
        totals.returning += result.returning;
        totals.total += result.total;
      }
      setImportResult(totals);
      await reload();
      await reloadHistory();
      setView("dashboard");
    } catch (e) {
      setImportError(e?.message || "Import failed. Please try again.");
    } finally {
      // Always clear the spinner — a thrown error must never leave it stuck on "Importing…".
      setImporting(false);
    }
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
  const ariaSort = (col) => sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="module-page hiker-page">
      <div className="module-header">
        <h1>SJHC Hiker Database</h1>
      </div>

      {/* Hike Name Modal */}
      {hikeModal && (
        <div className="event-overlay" onClick={e => { if (e.target.className === "event-overlay") setHikeModal(false); }}>
          <div className="event-card hiker-modal" role="dialog" aria-modal="true" aria-labelledby="hiker-modal-title">
            <h3 id="hiker-modal-title" className="hiker-modal-title">Name this hike</h3>
            <input
              aria-label="Hike name"
              placeholder="e.g. Blue Mountains Day Hike"
              value={hikeName}
              onChange={e => setHikeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && hikeName.trim() && runImport()}
              autoFocus
            />
            <span className="field-label">Hike date</span>
            <DatePicker value={hikeDate} onChange={(v) => setHikeDate(v)} />
            <div className="form-actions hiker-modal-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHikeModal(false)}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={runImport} disabled={!hikeName.trim()}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <button
        type="button"
        className={`hiker-drop-zone ${dragOver ? "dragover" : ""} ${importing ? "importing" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <span className="hiker-drop-icon"><i className={`fa-solid ${importing ? "fa-spinner fa-spin" : "fa-folder-open"}`} aria-hidden="true" /></span>
        <span className="hiker-drop-text">{importing ? "Importing…" : "Drop CSV files here or tap to upload"}</span>
        <span className="hiker-drop-hint">Auto-detects name, email &amp; phone columns</span>
      </button>
      <input ref={fileRef} type="file" accept=".csv" multiple hidden onChange={e => handleFiles(e.target.files)} />

      {/* Import Error */}
      {importError && (
        <div className="load-error" role="alert"><p className="load-error-msg">{importError}</p></div>
      )}

      {/* Import Result */}
      {importResult && (
        <section className="db-card hiker-import-result">
          <div className="db-card-header">
            <h3 className="db-card-title">Import complete — {importResult.files} file{importResult.files !== 1 ? "s" : ""}</h3>
          </div>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-label">Total processed</span>
              <span className="stat-value">{importResult.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">First timers</span>
              <span className="stat-value hiker-num-good">{importResult.first_timers}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Returning</span>
              <span className="stat-value hiker-num-warn">{importResult.returning}</span>
            </div>
          </div>
          <div className="hiker-import-foot">
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => { setView("members"); setImportResult(null); }}>
              View members <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Dashboard */}
      {view === "dashboard" && stats && (
        <>
          <div className="stat-grid hiker-stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total members</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Returning hikers</span>
              <span className="stat-value">{stats.returning}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Have email</span>
              <span className="stat-value">{stats.withEmail}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total check-ins</span>
              <span className="stat-value">{stats.totalCheckins}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">CSVs imported</span>
              <span className="stat-value">{stats.totalImports}</span>
            </div>
          </div>

          {stats.topHikers.length > 0 && (
            <section className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">Most active hikers</h3>
              </div>
              <ol className="db-list hiker-top">
                {stats.topHikers.map((h, i) => (
                  <li key={i} className="db-list-item">
                    <span className="hiker-top-name">
                      <span className="hiker-rank">#{i + 1}</span>
                      <span>{h.first} {h.last}</span>
                    </span>
                    <span className="uik-badge tone-warn">
                      {h.attendance}×<span className="visually-hidden"> check-ins</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {/* Members Table */}
      {view === "members" && (
        <>
          <div className="vault-toolbar">
            <input
              className="hiker-search vault-search"
              type="search"
              aria-label="Search by name or email"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="vault-count">
              {sorted.length} result{sorted.length !== 1 ? "s" : ""}
            </span>
            <button className="btn-sm btn-secondary-sm btn" onClick={() => exportCSV(sorted)}>
              <i className="fa-solid fa-download" aria-hidden="true" /> Export
            </button>
          </div>

          <div className="hiker-table-wrap">
            <table className="hiker-table">
              <thead>
                <tr>
                  <th aria-sort={ariaSort("first")}><button type="button" className="hiker-sort-btn" onClick={() => toggleSort("first")}>First{arrow("first")}</button></th>
                  <th aria-sort={ariaSort("last")}><button type="button" className="hiker-sort-btn" onClick={() => toggleSort("last")}>Last{arrow("last")}</button></th>
                  <th aria-sort={ariaSort("email")}><button type="button" className="hiker-sort-btn" onClick={() => toggleSort("email")}>Email{arrow("email")}</button></th>
                  <th aria-sort={ariaSort("phone")}><button type="button" className="hiker-sort-btn" onClick={() => toggleSort("phone")}>Phone{arrow("phone")}</button></th>
                  <th aria-sort={ariaSort("attendance")}><button type="button" className="hiker-sort-btn" onClick={() => toggleSort("attendance")}>Check-ins{arrow("attendance")}</button></th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={5} className="hiker-empty">
                    No members yet. Upload a CSV to get started.
                  </td></tr>
                )}
                {sorted.map(m => (
                  <tr key={m.id}>
                    <td>{m.first}</td>
                    <td>{m.last}</td>
                    <td className={m.email ? undefined : "is-muted"}>{m.email || "—"}</td>
                    <td className={m.phone ? undefined : "is-muted"}>{m.phone || "—"}</td>
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
        <section className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Hike history</h3>
          </div>
          {hikes.length === 0 && (
            <p className="no-entries">No hikes recorded yet. Import a CSV to get started.</p>
          )}
          <div className="db-list">
            {hikes.map(h => (
              <button key={h.id} type="button" className="hiker-hike-row" onClick={() => openHike(h)}>
                <span className="db-list-item-content">
                  <span className="hiker-hike-name">{h.hike_name || h.filename}</span>
                  <span className="hiker-hike-meta">
                    {h.hike_date ? new Date(h.hike_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : h.imported_at}
                    {" · "}{h.total} hiker{h.total !== 1 ? "s" : ""}
                    {h.first_timers > 0 && ` · ${h.first_timers} new`}
                  </span>
                </span>
                <RowChevron />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Hike Detail */}
      {view === "hike-detail" && selectedHike && (
        <>
          <div className="hiker-detail-head">
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setView("history")}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back</button>
            <h2 className="section-title">{selectedHike.hike_name || selectedHike.filename}</h2>
          </div>

          <section className="db-card">
            <div className="hiker-detail-bar">
              <div>
                <div className="hiker-detail-date">
                  {selectedHike.hike_date ? new Date(selectedHike.hike_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : selectedHike.imported_at}
                </div>
                <div className="hiker-detail-meta">
                  {hikeAttendees.length} attendee{hikeAttendees.length !== 1 ? "s" : ""}
                  {" · "}{hikeAttendees.filter(m => m.email).length} with email
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm hiker-copy-btn ${copyAnim ? "copied" : ""}`}
                onClick={copyEmails}
                disabled={hikeAttendees.filter(m => m.email).length === 0}
              >
                <i className={`fa-solid ${copyAnim ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copyAnim ? "Copied!" : "Copy emails"}
              </button>
            </div>

            <div className="hiker-table-wrap">
              <table className="hiker-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Total check-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {hikeAttendees.length === 0 && (
                    <tr><td colSpan={4} className="hiker-empty">
                      No attendee data for this hike.
                    </td></tr>
                  )}
                  {hikeAttendees.map(m => (
                    <tr key={m.id}>
                      <td>{m.first} {m.last}</td>
                      <td className={m.email ? undefined : "is-muted"}>{m.email || "—"}</td>
                      <td className={m.phone ? undefined : "is-muted"}>{m.phone || "—"}</td>
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
          </section>
        </>
      )}
    </div>
  );
}

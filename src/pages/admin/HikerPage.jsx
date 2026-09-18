import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadMembers, loadStats, importCSV, exportCSV, loadHikeHistory, loadHikeAttendees } from "../../api/hikerApi";
import { toDateStr } from "../../utils/plannerUtils";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import DatePicker from "../../components/DatePicker";
import "./mission.css";
import { RowChevron, FormModal, Field, ShowMore } from "../../components/ui";
import { usePaged } from "../../hooks/usePaged";

export default function HikerPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState("dashboard"); // dashboard | members | history | hike-detail
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("last");
  const [sortDir, setSortDir] = useState("asc");
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
  // Searching hits the database: wait until typing pauses, and ignore answers to older searches.
  const searchQuery = useDebouncedValue(search, 250);
  const [searchError, setSearchError] = useState(null);
  useEffect(() => {
    let current = true;
    loadMembers(searchQuery)
      .then((m) => { if (current) { setMembers(m); setSearchError(null); } })
      .catch((err) => { if (current) setSearchError(err?.message || "Search failed"); });
    return () => { current = false; };
  }, [searchQuery]);

  const openImport = () => {
    setPendingFiles(null);
    setHikeName("");
    setHikeDate(toDateStr(new Date()));
    setImportError("");
    setHikeModal(true);
  };
  const handleFiles = (files) => {
    if (!files?.length) return;
    setPendingFiles(Array.from(files));
  };

  // Runs inside FormModal (DR-019): busy state is the modal's, and a failure is
  // thrown so the modal stays open with the files and name still filled in.
  const runImport = async () => {
    if (!hikeName.trim() || !pendingFiles?.length) return false;
    setImportResult(null);
    setImportError("");
    let totals = { first_timers: 0, returning: 0, total: 0, files: pendingFiles.length };
    try {
      for (const file of pendingFiles) {
        const text = await file.text();
        const result = await importCSV(text, file.name, hikeName.trim(), hikeDate);
        totals.first_timers += result.first_timers;
        totals.returning += result.returning;
        totals.total += result.total;
      }
    } catch (e) {
      throw new Error(e?.message || "Import failed. Please try again.", { cause: e });
    }
    setImportResult(totals);
    try {
      await reload();
      await reloadHistory();
    } catch (e) {
      setImportError(`Imported, but couldn't refresh the list: ${e?.message || e}`);
    }
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
  const memberPage = usePaged(sorted, 100, `${searchQuery}|${sortCol}|${sortDir}`);

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

      <div className="hiker-actions">
        <button type="button" className="btn btn-sm" onClick={openImport}>
          <i className="fa-solid fa-file-import" aria-hidden="true" /> Import CSV
        </button>
        <span className="hiker-drop-hint">Auto-detects name, email &amp; phone columns</span>
      </div>

      {/* Import modal: files + hike name + date */}
      {hikeModal && (
        <FormModal
          title="Import hike CSV"
          submitLabel="Import"
          submitDisabled={!hikeName.trim() || !pendingFiles?.length}
          onClose={() => setHikeModal(false)}
          onSubmit={runImport}
        >
          <button
            type="button"
            className={`hiker-drop-zone ${dragOver ? "dragover" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            data-autofocus
          >
            <span className="hiker-drop-icon"><i className="fa-solid fa-folder-open" aria-hidden="true" /></span>
            <span className="hiker-drop-text">
              {pendingFiles?.length ? pendingFiles.map((f) => f.name).join(", ") : "Drop CSV files here or tap to choose"}
            </span>
          </button>
          <input ref={fileRef} type="file" accept=".csv" multiple hidden onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
          <Field label="Hike name">
            <input placeholder="e.g. Blue Mountains Day Hike" required value={hikeName} onChange={e => setHikeName(e.target.value)} />
          </Field>
          <div className="uik-field">
            <span className="field-label">Hike date</span>
            <DatePicker value={hikeDate} onChange={(v) => setHikeDate(v)} />
          </div>
        </FormModal>
      )}

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
            {searchError && <p className="load-error-msg" role="alert">Couldn't search: {searchError}</p>}
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
                {memberPage.visible.map(m => (
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
            <ShowMore remaining={memberPage.remaining} pageSize={100} onClick={memberPage.showMore} noun="members" />
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

"""
SJHC Hiker Database
====================
Run:  python hiker_db.py
Open: http://localhost:5000

- Upload CSVs to add hikers
- Auto-detects name/email/phone columns
- Tracks attendance (no duplicates)
- Shows returning vs first-time hikers per import
- SQLite database persists between runs
"""

import os, csv, io, re, json
from flask import Flask, request, jsonify, send_file
from datetime import date
import sqlite3

DB_PATH = "hikers.db"
app = Flask(__name__)

# ── Database Setup ────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first TEXT NOT NULL,
            last TEXT NOT NULL,
            email TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            attendance INTEGER DEFAULT 1,
            joined_date TEXT,
            UNIQUE(first COLLATE NOCASE, last COLLATE NOCASE)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            imported_at TEXT,
            first_timers INTEGER,
            returning INTEGER,
            total INTEGER
        )
    """)
    conn.commit()
    conn.close()

# ── CSV Parsing ───────────────────────────────────────────────────────

def detect_columns(headers):
    h = [x.lower() for x in headers]
    name_idx = email_idx = phone_idx = first_idx = last_idx = -1
    for i, col in enumerate(h):
        if re.search(r'full\s*name|first\s*and\s*last|your\s*full\s*name', col) and name_idx == -1:
            name_idx = i
        if re.search(r'^first', col) and first_idx == -1:
            first_idx = i
        if re.search(r'^last', col) and last_idx == -1:
            last_idx = i
        if re.search(r'email', col) and email_idx == -1:
            email_idx = i
        if re.search(r'phone', col) and not re.search(r'emergency', col) and phone_idx == -1:
            phone_idx = i
    return name_idx, first_idx, last_idx, email_idx, phone_idx

def split_name(full):
    parts = full.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])

def clean_phone(p):
    if not p:
        return ""
    return re.sub(r'[^0-9+]', '', p)

def process_csv(file_text, filename):
    reader = csv.reader(io.StringIO(file_text))
    rows = list(reader)
    if len(rows) < 2:
        return {"error": "Empty CSV", "first_timers": 0, "returning": 0, "total": 0}

    headers = rows[0]
    name_idx, first_idx, last_idx, email_idx, phone_idx = detect_columns(headers)

    conn = get_db()
    first_timers = 0
    returning = 0

    for row in rows[1:]:
        if not row:
            continue
        first = last = email = phone = ""

        if name_idx >= 0 and name_idx < len(row) and row[name_idx].strip():
            first, last = split_name(row[name_idx])
        else:
            if first_idx >= 0 and first_idx < len(row):
                first = row[first_idx].strip()
            if last_idx >= 0 and last_idx < len(row):
                last = row[last_idx].strip()

        if not first and not last:
            continue

        if email_idx >= 0 and email_idx < len(row):
            email = row[email_idx].strip()
        if phone_idx >= 0 and phone_idx < len(row):
            phone = clean_phone(row[phone_idx])

        first = first.strip().title()
        last = last.strip().title()

        existing = conn.execute(
            "SELECT id, email, phone FROM members WHERE first = ? COLLATE NOCASE AND last = ? COLLATE NOCASE",
            (first, last)
        ).fetchone()

        if existing:
            conn.execute("UPDATE members SET attendance = attendance + 1 WHERE id = ?", (existing["id"],))
            if email and not existing["email"]:
                conn.execute("UPDATE members SET email = ? WHERE id = ?", (email, existing["id"]))
            if phone and not existing["phone"]:
                conn.execute("UPDATE members SET phone = ? WHERE id = ?", (phone, existing["id"]))
            returning += 1
        else:
            conn.execute(
                "INSERT INTO members (first, last, email, phone, attendance, joined_date) VALUES (?, ?, ?, ?, 1, ?)",
                (first, last, email, phone, date.today().isoformat())
            )
            first_timers += 1

    total = first_timers + returning
    conn.execute(
        "INSERT INTO imports (filename, imported_at, first_timers, returning, total) VALUES (?, ?, ?, ?, ?)",
        (filename, date.today().isoformat(), first_timers, returning, total)
    )
    conn.commit()
    conn.close()
    return {"first_timers": first_timers, "returning": returning, "total": total, "filename": filename}

# ── API Routes ────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload():
    results = []
    for f in request.files.getlist("files"):
        text = f.read().decode("utf-8-sig", errors="ignore")
        result = process_csv(text, f.filename)
        results.append(result)
    totals = {
        "first_timers": sum(r["first_timers"] for r in results),
        "returning": sum(r["returning"] for r in results),
        "total": sum(r["total"] for r in results),
        "files": len(results),
        "details": results
    }
    return jsonify(totals)

@app.route("/api/members")
def get_members():
    conn = get_db()
    rows = conn.execute("SELECT * FROM members ORDER BY last COLLATE NOCASE, first COLLATE NOCASE").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/stats")
def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) as c FROM members").fetchone()["c"]
    returning = conn.execute("SELECT COUNT(*) as c FROM members WHERE attendance > 1").fetchone()["c"]
    with_email = conn.execute("SELECT COUNT(*) as c FROM members WHERE email != ''").fetchone()["c"]
    total_checkins = conn.execute("SELECT COALESCE(SUM(attendance), 0) as c FROM members").fetchone()["c"]
    imports = conn.execute("SELECT COUNT(*) as c FROM imports").fetchone()["c"]
    top = conn.execute("SELECT first, last, attendance FROM members ORDER BY attendance DESC LIMIT 5").fetchall()
    conn.close()
    return jsonify({
        "total_members": total, "returning": returning, "with_email": with_email,
        "total_checkins": total_checkins, "total_imports": imports,
        "top_hikers": [dict(r) for r in top]
    })

@app.route("/api/search")
def search_members():
    q = request.args.get("q", "").strip()
    conn = get_db()
    if q:
        rows = conn.execute(
            "SELECT * FROM members WHERE first LIKE ? OR last LIKE ? OR email LIKE ? ORDER BY last COLLATE NOCASE, first COLLATE NOCASE",
            (f"%{q}%", f"%{q}%", f"%{q}%")
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM members ORDER BY last COLLATE NOCASE, first COLLATE NOCASE").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/export")
def export_csv():
    conn = get_db()
    rows = conn.execute("SELECT first, last, email, phone, attendance FROM members ORDER BY last COLLATE NOCASE, first COLLATE NOCASE").fetchall()
    conn.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["First Name", "Last Name", "Email", "Phone", "Attendance"])
    for r in rows:
        writer.writerow([r["first"], r["last"], r["email"], r["phone"], r["attendance"]])
    mem = io.BytesIO(output.getvalue().encode("utf-8"))
    return send_file(mem, mimetype="text/csv", as_attachment=True, download_name="sjhc_members_export.csv")

# ── Frontend ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    return FRONTEND_HTML

FRONTEND_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SJHC Hiker Database</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#09090b;color:#e4e4e7;min-height:100vh}
.app{max-width:920px;margin:0 auto;padding:20px}
header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:24px}
h1{font-size:24px;font-weight:800;letter-spacing:-.5px;color:#fff}
h1 span{margin-right:8px}
.subtitle{font-size:13px;color:#71717a;margin-top:4px}
nav{display:flex;gap:6px}
nav button{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:8px 16px;color:#a1a1aa;cursor:pointer;font:600 13px 'DM Sans',sans-serif;transition:.15s}
nav button.active{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.3);color:#22c55e}
nav button:hover{border-color:#3f3f46}

.drop-zone{border:2px dashed #27272a;border-radius:14px;padding:32px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:24px}
.drop-zone:hover,.drop-zone.dragover{border-color:#22c55e;background:rgba(34,197,94,.03)}
.drop-icon{font-size:32px;margin-bottom:8px}
.drop-text{font-weight:600;color:#d4d4d8;font-size:14px}
.drop-hint{font-size:12px;color:#52525b;margin-top:4px}

.import-results{background:#0d1117;border:1px solid #1e3a1e;border-radius:14px;padding:28px;margin-bottom:24px;animation:fadeIn .3s}
.import-results h2{font-size:18px;text-align:center;margin-bottom:16px;color:#fff}
.import-grid{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.import-card{background:#111;border:1px solid #27272a;border-radius:12px;padding:18px 32px;text-align:center;min-width:130px}
.import-num{font-size:36px;font-weight:800;color:#fff}
.import-num.green{color:#22c55e}.import-num.amber{color:#f59e0b}
.import-label{font-size:12px;color:#71717a;margin-top:4px}
.view-all-btn{display:block;margin:20px auto 0;background:#22c55e;color:#000;border:none;border-radius:8px;padding:10px 28px;font:700 14px 'DM Sans';cursor:pointer;transition:.15s}
.view-all-btn:hover{background:#16a34a}

.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}
.stat-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:22px;text-align:center}
.stat-num{font-size:30px;font-weight:800;color:#fff}
.stat-label{font-size:12px;color:#71717a;margin-top:4px}
.top-card{grid-column:1/-1;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px}
.top-card h3{font-size:15px;font-weight:700;margin-bottom:14px;color:#fff}
.top-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1c1c1c}
.top-rank{font-weight:800;color:#f59e0b;width:30px;font-size:13px}
.top-name{flex:1;font-weight:500;font-size:14px}
.top-badge{background:rgba(245,158,11,.12);color:#f59e0b;padding:2px 12px;border-radius:20px;font-size:12px;font-weight:700}

.search-bar{display:flex;gap:10px;align-items:center;margin-bottom:14px}
.search-bar input{flex:1;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:10px 14px;color:#fff;font:14px 'DM Sans';outline:none}
.search-bar input:focus{border-color:#22c55e}
.result-count{font-size:12px;color:#52525b;white-space:nowrap}
.export-btn{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:8px 14px;color:#a1a1aa;cursor:pointer;font:600 12px 'DM Sans';text-decoration:none;transition:.15s}
.export-btn:hover{border-color:#3f3f46;color:#fff}

.table-wrap{overflow-x:auto;border-radius:12px;border:1px solid #27272a}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:11px 14px;background:#18181b;border-bottom:1px solid #27272a;color:#71717a;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;user-select:none;white-space:nowrap}
th:hover{color:#a1a1aa}
td{padding:10px 14px;border-bottom:1px solid #18181b}
tr:nth-child(even){background:#0d0d0d}
.badge{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.badge-new{background:#22c55e;color:#000}
.badge-ret{background:#f59e0b;color:#000}
.empty{text-align:center;color:#52525b;padding:48px}
.muted{color:#3f3f46}

@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>
<div class="app" id="app"></div>
<script>
const API = '';
let currentView = 'dashboard';
let importResult = null;
let sortCol = 'last', sortDir = 'asc';
let searchQuery = '';

async function api(path, opts) {
  const r = await fetch(API + path, opts);
  return r.json();
}

function $(sel) { return document.querySelector(sel); }

async function render() {
  const app = $('#app');
  const stats = await api('/api/stats');
  
  let html = `
    <header>
      <div>
        <h1><span>⛰️</span>SJHC Hiker Database</h1>
        <p class="subtitle">${stats.total_members} members tracked · ${stats.total_checkins} total check-ins</p>
      </div>
      <nav>
        <button onclick="switchView('dashboard')" class="${currentView==='dashboard'?'active':''}">📊 Dashboard</button>
        <button onclick="switchView('members')" class="${currentView==='members'?'active':''}">👥 Members</button>
      </nav>
    </header>

    <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept=".csv" multiple hidden onchange="handleUpload(this.files)">
      <div class="drop-icon">📂</div>
      <div class="drop-text">Drop CSV files here or click to upload</div>
      <div class="drop-hint">Automatically detects name, email & phone columns</div>
    </div>`;

  if (importResult && currentView === 'import') {
    html += `
      <div class="import-results">
        <h2>Import Complete</h2>
        <div class="import-grid">
          <div class="import-card"><div class="import-num">${importResult.total}</div><div class="import-label">Total Processed</div></div>
          <div class="import-card"><div class="import-num green">${importResult.first_timers}</div><div class="import-label">🆕 First Timers</div></div>
          <div class="import-card"><div class="import-num amber">${importResult.returning}</div><div class="import-label">🔄 Returning Hikers</div></div>
        </div>
        <button class="view-all-btn" onclick="switchView('members')">View All Members →</button>
      </div>`;
  }

  if (currentView === 'dashboard') {
    html += `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${stats.total_members}</div><div class="stat-label">Total Members</div></div>
        <div class="stat-card"><div class="stat-num">${stats.returning}</div><div class="stat-label">Returning Hikers</div></div>
        <div class="stat-card"><div class="stat-num">${stats.with_email}</div><div class="stat-label">Have Email</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_imports}</div><div class="stat-label">CSVs Imported</div></div>
        ${stats.top_hikers.length ? `
        <div class="top-card">
          <h3>🏆 Most Active Hikers</h3>
          ${stats.top_hikers.map((h,i) => `
            <div class="top-row">
              <span class="top-rank">#${i+1}</span>
              <span class="top-name">${h.first} ${h.last}</span>
              <span class="top-badge">${h.attendance}x</span>
            </div>`).join('')}
        </div>` : ''}
      </div>`;
  }

  if (currentView === 'members') {
    const members = await api('/api/search?q=' + encodeURIComponent(searchQuery));
    
    members.sort((a, b) => {
      let va = a[sortCol] || '', vb = b[sortCol] || '';
      if (sortCol === 'attendance') return sortDir === 'asc' ? va - vb : vb - va;
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    html += `
      <div class="search-bar">
        <input placeholder="Search by name or email…" value="${searchQuery}" oninput="searchQuery=this.value;render()">
        <span class="result-count">${members.length} result${members.length!==1?'s':''}</span>
        <a href="/api/export" class="export-btn">📥 Export CSV</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th onclick="toggleSort('first')">First Name${arrow('first')}</th>
            <th onclick="toggleSort('last')">Last Name${arrow('last')}</th>
            <th onclick="toggleSort('email')">Email${arrow('email')}</th>
            <th onclick="toggleSort('phone')">Phone${arrow('phone')}</th>
            <th onclick="toggleSort('attendance')">Check-ins${arrow('attendance')}</th>
          </tr></thead>
          <tbody>
            ${members.length ? members.map(m => `<tr>
              <td>${m.first}</td>
              <td>${m.last}</td>
              <td class="${m.email?'':'muted'}">${m.email||'—'}</td>
              <td class="${m.phone?'':'muted'}">${m.phone||'—'}</td>
              <td><span class="badge ${m.attendance>1?'badge-ret':'badge-new'}">${m.attendance}x</span></td>
            </tr>`).join('') : `<tr><td colspan="5" class="empty">No members yet. Upload a CSV to get started.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  app.innerHTML = html;

  // Re-bind drag events
  const dz = $('#dropZone');
  if (dz) {
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('dragover'); };
    dz.ondragleave = () => dz.classList.remove('dragover');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('dragover'); handleUpload(e.dataTransfer.files); };
  }
}

async function handleUpload(files) {
  if (!files.length) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  importResult = await api('/api/upload', { method: 'POST', body: fd });
  currentView = 'import';
  render();
}

function switchView(v) { currentView = v; render(); }

function toggleSort(col) {
  if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortCol = col; sortDir = 'asc'; }
  render();
}

render();
</script>
</body>
</html>"""

# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("\n  ⛰️  SJHC Hiker Database running at http://localhost:5000\n")
    app.run(debug=True, port=5000)

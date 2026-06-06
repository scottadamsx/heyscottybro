import "./overview.css";

/* ── tiny inline charts ─────────────────────────── */

function Donut({ value, max = 5, size = 132, stroke = 14 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <svg width={size} height={size} className="ovd-donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-track)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-blue)" strokeWidth={stroke}
        strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="46%" textAnchor="middle" className="ovd-donut-val">{value.toFixed(2)}</text>
      <text x="50%" y="62%" textAnchor="middle" className="ovd-donut-sub">154 Review</text>
    </svg>
  );
}

function Ring({ pct, size = 26 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="ovd-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-track)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-blue)" strokeWidth={stroke}
        strokeDasharray={`${c * (pct / 100)} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function StackedBars() {
  const data = [
    { d: "Sun", v: [3, 2, 1] }, { d: "Mon", v: [4, 3, 1] }, { d: "Tus", v: [3, 2, 2] },
    { d: "Wed", v: [2, 3, 1] }, { d: "Thu", v: [1, 2, 1] }, { d: "Fri", v: [3, 4, 2] }, { d: "Sat", v: [2, 1, 1] },
  ];
  const max = 10;
  const colors = ["var(--ovd-blue)", "var(--ovd-blue-2)", "var(--ovd-blue-3)"];
  return (
    <div className="ovd-bars">
      <div className="ovd-bars-y">{[10, 8, 6, 4, 2, 0].map((n) => <span key={n}>{n}</span>)}</div>
      <div className="ovd-bars-plot">
        {data.map((col) => (
          <div className="ovd-bar-col" key={col.d}>
            <div className="ovd-bar-stack">
              {col.v.map((seg, i) => (
                <div key={i} className="ovd-bar-seg" style={{ height: `${(seg / max) * 100}%`, background: colors[i] }} />
              ))}
            </div>
            <span className="ovd-bar-x">{col.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart() {
  const W = 320, H = 150;
  const series = [
    { color: "var(--ovd-teal)", pts: [3, 7, 5, 2, 4, 8, 6] },
    { color: "var(--ovd-blue)", pts: [6, 4, 6, 7, 3, 2, 5] },
    { color: "var(--ovd-green)", pts: [2, 3, 4, 5, 6, 5, 4] },
  ];
  const max = 10;
  const x = (i) => (i / 6) * (W - 20) + 10;
  const y = (v) => H - 16 - (v / max) * (H - 30);
  const path = (pts) => {
    return pts.map((v, i) => {
      const px = x(i), py = y(v);
      if (i === 0) return `M ${px} ${py}`;
      const prevX = x(i - 1), prevY = y(pts[i - 1]);
      const cx = (prevX + px) / 2;
      return `C ${cx} ${prevY} ${cx} ${py} ${px} ${py}`;
    }).join(" ");
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ovd-line" preserveAspectRatio="none">
      {[2, 4, 6, 8].map((g) => <line key={g} x1="10" x2={W - 10} y1={y(g)} y2={y(g)} className="ovd-grid-line" />)}
      {series.map((s, i) => <path key={i} d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="2.5" />)}
    </svg>
  );
}

function ReviewBars() {
  const data = [4, 6, 8, 5, 7, 3, 6];
  const days = ["Sun", "Mon", "Tus", "Wed", "Thu", "Fri", "Sat"];
  const max = 10;
  return (
    <div className="ovd-bars ovd-bars-single">
      <div className="ovd-bars-y">{[10, 8, 6, 4, 2, 0].map((n) => <span key={n}>{n}k</span>)}</div>
      <div className="ovd-bars-plot">
        {data.map((v, i) => (
          <div className="ovd-bar-col" key={i}>
            <div className="ovd-bar-stack">
              <div className="ovd-bar-seg" style={{ height: `${(v / max) * 100}%`, background: "var(--ovd-blue)" }} />
            </div>
            <span className="ovd-bar-x">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pie() {
  const size = 120, r = 54, c = 2 * Math.PI * r;
  const replied = 0.99;
  return (
    <svg width={size} height={size} className="ovd-pie">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-gray)" strokeWidth="18" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ovd-blue)" strokeWidth="18"
        strokeDasharray={`${c * replied} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="38%" y="40%" textAnchor="middle" className="ovd-pie-lbl">99%</text>
      <text x="64%" y="74%" textAnchor="middle" className="ovd-pie-lbl ovd-pie-lbl-sm">1%</text>
    </svg>
  );
}

/* ── page ───────────────────────────────────────── */

const NAV = [
  { icon: "fa-table-cells-large", label: "Overview", active: true },
  { icon: "fa-location-dot", label: "Location" },
  { icon: "fa-star", label: "Reviews" },
  { icon: "fa-chart-column", label: "Advanced Reports" },
  { icon: "fa-share-nodes", label: "Social" },
  { icon: "fa-circle-play", label: "Tutorials" },
  { icon: "fa-screwdriver-wrench", label: "Tools" },
];

const STATUS = [
  { icon: "fa-globe", label: "Number of listings published online", val: "495" },
  { icon: "fa-cloud-arrow-up", label: "Number of listings to be published", val: "0" },
  { icon: "fa-list", label: "Total number of listings", val: "495" },
  { icon: "fa-comment-dots", label: "Total number of reviews", val: "495" },
  { icon: "fa-reply", label: "Number of reviews replied", val: "12" },
  { icon: "fa-diagram-project", label: "Number of online networks published", val: "323" },
];

const COMPLETENESS = [
  { name: "Türk Telekom-bala", pct: 100, done: true },
  { name: "Türk Telekom İspir GSM İstasyonu", pct: 95 },
  { name: "Türk Telekom-arda Telekom", pct: 80 },
  { name: "Türk Telekom Santral Binası", pct: 15 },
  { name: "Türk Telekom Net İletişim", pct: 87 },
  { name: "Türk Telekom Toprak İletişim", pct: 70 },
];

const RATING_ROWS = [
  { star: 5, count: 98, pct: 40 },
  { star: 4, count: 35, pct: 20 },
  { star: 3, count: 28, pct: 16 },
  { star: 2, count: 20, pct: 10 },
  { star: 1, count: 25, pct: 14 },
];

const PINS = [
  [38, 30], [44, 42], [52, 35], [60, 50], [48, 58], [66, 38], [34, 48], [58, 64], [70, 55], [42, 68], [55, 46],
];

export default function OverviewDashboard() {
  return (
    <div className="ovd">
      {/* Sidebar */}
      <aside className="ovd-side">
        <div className="ovd-brand"><span className="ovd-brand-dot" />locaroom</div>
        <nav className="ovd-nav">
          {NAV.map((n) => (
            <button key={n.label} className={`ovd-nav-link ${n.active ? "active" : ""}`}>
              <i className={`fa-solid ${n.icon}`} /><span>{n.label}</span>
            </button>
          ))}
          <div className="ovd-nav-sep">More menu</div>
          <button className="ovd-nav-link"><i className="fa-solid fa-gear" /><span>Settings</span></button>
          <button className="ovd-nav-link"><i className="fa-regular fa-bookmark" /><span>Support</span></button>
        </nav>
      </aside>

      {/* Main */}
      <div className="ovd-main">
        <header className="ovd-top">
          <div className="ovd-top-title">
            <button className="ovd-back"><i className="fa-solid fa-chevron-left" /></button>
            <h1>Overview</h1>
          </div>
          <div className="ovd-top-right">
            <div className="ovd-search"><i className="fa-solid fa-magnifying-glass" /><input placeholder="Search" /></div>
            <button className="ovd-icon-btn ovd-plus"><i className="fa-solid fa-plus" /></button>
            <button className="ovd-icon-btn"><i className="fa-regular fa-bell" /></button>
            <button className="ovd-acct"><i className="fa-solid fa-circle-user" /> Harwaresoft <i className="fa-solid fa-chevron-down" /></button>
          </div>
        </header>

        <div className="ovd-filterbar">
          <span className="ovd-filter-label">Filter by:</span>
          <div className="ovd-chip"><i className="fa-solid fa-magnifying-glass" /><input placeholder="Search" /></div>
          <div className="ovd-chip"><i className="fa-regular fa-calendar" /> 9/12/2022 – 9/18/2022</div>
          <div className="ovd-chip">Directory <i className="fa-solid fa-chevron-down" /></div>
          <div className="ovd-filter-actions">
            <button className="ovd-btn ovd-btn-primary"><i className="fa-solid fa-download" /> Export</button>
            <button className="ovd-btn"><i className="fa-solid fa-print" /> Print</button>
          </div>
        </div>

        <div className="ovd-grid">
          {/* Presence */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Presence <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <div className="ovd-map">
              {PINS.map((p, i) => <span key={i} className="ovd-pin" style={{ left: `${p[0]}%`, top: `${p[1]}%` }} />)}
              <span className="ovd-map-tag">Map</span>
            </div>
          </section>

          {/* Readiness */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Readiness <i className="fa-regular fa-circle-question" /></h3>
              <div className="ovd-readiness-meter"><span className="ovd-meter"><span style={{ width: "80%" }} /></span> 4/5 COMPLETED</div>
            </div>
            <ul className="ovd-checklist">
              {["Connect Google Business Profile", "Import or Create Locations", "List online your locations", "Manage Reviews"].map((t) => (
                <li key={t} className="done"><i className="fa-solid fa-circle-check" /> {t}</li>
              ))}
              <li><i className="fa-regular fa-circle" /> Connect Facebook Business Account <i className="fa-solid fa-arrow-up-right-from-square ovd-ext" /></li>
            </ul>
          </section>

          {/* Status */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Status <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <ul className="ovd-statlist">
              {STATUS.map((s) => (
                <li key={s.label}><span className="ovd-stat-ic"><i className={`fa-solid ${s.icon}`} /></span><span className="ovd-stat-lbl">{s.label}</span><span className="ovd-stat-val">{s.val}</span></li>
              ))}
            </ul>
          </section>

          {/* Location completeness */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Location completeness <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <ul className="ovd-complete">
              {COMPLETENESS.map((c) => (
                <li key={c.name}>
                  <i className={`fa-solid ${c.done ? "fa-circle-check ovd-ok" : "fa-circle-notch"}`} />
                  <span className="ovd-complete-name">{c.name} {!c.done && <i className="fa-solid fa-arrow-up-right-from-square ovd-ext" />}</span>
                  <span className="ovd-complete-pct">{c.pct}%</span>
                  <Ring pct={c.pct} />
                </li>
              ))}
            </ul>
          </section>

          {/* Impressions */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Impressions <i className="fa-brands fa-google" /> <i className="fa-brands fa-facebook" /></h3><a className="ovd-link">View Details ›</a></div>
            <StackedBars />
            <div className="ovd-legend">
              <span><i className="ovd-dot b1" /> Google Map</span>
              <span><i className="ovd-dot b2" /> Google Search</span>
              <span><i className="ovd-dot b3" /> Facebook</span>
            </div>
          </section>

          {/* Customer action */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Customer action <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <LineChart />
            <div className="ovd-legend">
              <span><i className="ovd-dot teal" /> Website clicks</span>
              <span><i className="ovd-dot b1" /> Phone calls</span>
              <span><i className="ovd-dot green" /> Directions</span>
            </div>
          </section>

          {/* Average Rating */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Average Rating <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <div className="ovd-rating">
              <Donut value={4.13} />
              <ul className="ovd-rating-rows">
                {RATING_ROWS.map((r) => (
                  <li key={r.star}>
                    <span className="ovd-rating-star">{r.star} <i className="fa-solid fa-star" /></span>
                    <span className="ovd-rating-track"><span style={{ width: `${r.pct * 2}%` }} /></span>
                    <span className="ovd-rating-count">{r.count} ({r.pct}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Ratings & Reviews */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Ratings &amp; Reviews <i className="fa-regular fa-circle-question" /></h3><a className="ovd-link">View Details ›</a></div>
            <ReviewBars />
          </section>

          {/* Reviews */}
          <section className="ovd-card">
            <div className="ovd-card-head"><h3>Reviews</h3><a className="ovd-link">View Details ›</a></div>
            <div className="ovd-reviews">
              <Pie />
              <ul className="ovd-reviews-legend">
                <li><span className="ovd-dot b1" /> <b>420</b> Replied</li>
                <li><span className="ovd-dot gray" /> <b>780</b> Unreplied</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

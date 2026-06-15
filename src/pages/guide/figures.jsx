/* Shared illustrative figures for the Guide sub-pages — terminal/phosphor style. */

export function Figure({ children, caption }) {
  return (
    <figure className="lp-figure">
      {children}
      {caption && <figcaption className="lp-figure-cap">{caption}</figcaption>}
    </figure>
  );
}

const FLOW = [
  ["1", "Build brief", "What you're making, in one page."],
  ["2", "Where it lives", "Website, installable app, or both — and OS features."],
  ["3", "Data model", "The “things” the app remembers."],
  ["4", "Database", "Where it's all safely stored."],
  ["5", "Screens", "Every page, mapped out."],
  ["6", "Flows", "What you actually do, step by step."],
  ["7", "AI brain?", "Optional — add one only if it needs to think."],
  ["8", "The look", "Locked from pictures you love."],
];

export function FlowFigure() {
  return (
    <Figure caption="each step feeds the next — the finished app is the final link">
      <div className="lp-flow">
        {FLOW.map(([n, title, desc]) => (
          <div key={n}>
            <div className="lp-flow-node">
              <span className="lp-flow-num">{n}</span>
              <div><b>{title}</b> — <span>{desc}</span></div>
            </div>
            <div className="lp-flow-arrow" />
          </div>
        ))}
        <div className="lp-flow-node is-final">
          <span className="lp-flow-num"><i className="fa-solid fa-check" /></span>
          <div><b>Your finished app</b> — <span>built one screen at a time, tested as it goes.</span></div>
        </div>
      </div>
    </Figure>
  );
}

export function DataTableFigure() {
  return (
    <Figure caption="a “data model” is really just a spreadsheet’s column headers">
      <table className="lp-mini-table">
        <thead>
          <tr><th>Each plant has a…</th><th>which is a…</th></tr>
        </thead>
        <tbody>
          <tr><td>name</td><td>word — “Monstera”</td></tr>
          <tr><td>type</td><td>word — “tropical”</td></tr>
          <tr><td>water every X days</td><td>number — 7</td></tr>
          <tr><td>last watered</td><td>date</td></tr>
        </tbody>
      </table>
    </Figure>
  );
}

export function DesignFigure() {
  return (
    <Figure caption="show 2–3 apps you love + 1 you hate → your look gets pulled from the real pictures">
      <div className="lp-refs">
        <div className="lp-ref-item">
          <div className="lp-ref" style={{ background: "linear-gradient(135deg,#143a2a,#0f261c)" }}>🌿</div>
          <div className="lp-ref-label">love it</div>
        </div>
        <div className="lp-ref-item">
          <div className="lp-ref" style={{ background: "linear-gradient(135deg,#1a2238,#121a2e)" }}>📱</div>
          <div className="lp-ref-label">love it</div>
        </div>
        <div className="lp-ref-item">
          <div className="lp-ref" style={{ background: "repeating-linear-gradient(45deg,#3a1a1a,#3a1a1a 6px,#2a1212 6px,#2a1212 12px)" }}>🚫</div>
          <div className="lp-ref-label">hate it</div>
        </div>
        <i className="fa-solid fa-arrow-right lp-refs-arrow" />
        <div className="lp-ref-item">
          <div className="lp-ref" style={{ background: "var(--green-soft)", border: "1px solid var(--green-dim)", color: "var(--green)" }}>
            <i className="fa-solid fa-palette" />
          </div>
          <div className="lp-ref-label">your theme</div>
        </div>
      </div>
    </Figure>
  );
}

export function LayoutFigure() {
  return (
    <Figure caption="same app, two shells — a bottom tab bar on phones, a sidebar on desktop. you choose.">
      <div className="lp-wire-row">
        <div>
          <div className="lp-wire lp-wire-phone">
            <div className="lp-wire-top" />
            <div className="lp-wire-content">
              <div className="lp-wire-cell" /><div className="lp-wire-cell" />
              <div className="lp-wire-cell" /><div className="lp-wire-cell" />
            </div>
            <div className="lp-wire-bottombar"><span /><span /><span /></div>
          </div>
          <div className="lp-wire-label">phone · bottom nav</div>
        </div>
        <div>
          <div className="lp-wire lp-wire-desk">
            <div className="lp-wire-side"><span /><span /><span /><span /></div>
            <div className="lp-wire-main">
              <div className="lp-wire-top" />
              <div className="lp-wire-content">
                <div className="lp-wire-cell" /><div className="lp-wire-cell" />
                <div className="lp-wire-cell" /><div className="lp-wire-cell" />
              </div>
            </div>
          </div>
          <div className="lp-wire-label">desktop · sidebar</div>
        </div>
      </div>
    </Figure>
  );
}

export function ScreensFigure() {
  return (
    <Figure caption="build → test → next. you’re never handed a mystery box at the end">
      <div className="lp-screens">
        <div className="lp-screen">
          <div className="lp-screen-bar"><span /><span /><span /></div>
          <div className="lp-screen-body"><i className="fa-solid fa-list" /></div>
          <div className="lp-screen-tag"><span className="ok">✓ tested</span></div>
        </div>
        <div className="lp-screen">
          <div className="lp-screen-bar"><span /><span /><span /></div>
          <div className="lp-screen-body"><i className="fa-solid fa-plus" /></div>
          <div className="lp-screen-tag"><span className="ok">✓ tested</span></div>
        </div>
        <div className="lp-screen building">
          <div className="lp-screen-bar"><span /><span /><span /></div>
          <div className="lp-screen-body"><i className="fa-solid fa-gear fa-spin" /></div>
          <div className="lp-screen-tag">building…</div>
        </div>
      </div>
    </Figure>
  );
}

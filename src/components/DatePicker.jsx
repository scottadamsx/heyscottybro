import { useEffect, useRef, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parse(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fmtDisplay(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DatePicker({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = parse(value);
  const today = new Date();
  const [view, setView] = useState(() => selected || today);

  useEffect(() => {
    if (!open) return;
    setView(selected || today);
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => { onChange(fmt(new Date(y, m, d))); setOpen(false); };

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className={`picker-trigger ${selected ? "" : "is-placeholder"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-calendar-day picker-lead" />
        <span className="picker-value">{selected ? fmtDisplay(selected) : placeholder}</span>
        {selected ? (
          <i
            className="fa-solid fa-xmark picker-clear"
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <i className="fa-solid fa-chevron-down picker-caret" />
        )}
      </button>

      {open && (
        <div className="picker-pop dtp-pop">
          <div className="dtp-head">
            <button type="button" className="dtp-nav" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Previous month">
              <i className="fa-solid fa-chevron-left" />
            </button>
            <span className="dtp-month">{MONTHS[m]} {y}</span>
            <button type="button" className="dtp-nav" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Next month">
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>

          <div className="dtp-grid">
            {DOW.map((d) => <span key={d} className="dtp-dow">{d}</span>)}
            {cells.map((d, i) =>
              d === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  type="button"
                  key={d}
                  className={`dtp-day${sameDay(new Date(y, m, d), today) ? " today" : ""}${sameDay(new Date(y, m, d), selected) ? " sel" : ""}`}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              )
            )}
          </div>

          <div className="dtp-foot">
            <button type="button" className="dtp-foot-btn" onClick={() => { onChange(fmt(today)); setOpen(false); }}>Today</button>
            <button type="button" className="dtp-foot-btn" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

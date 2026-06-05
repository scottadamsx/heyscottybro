import { useEffect, useRef, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PRESETS = ["09:00", "12:00", "15:00", "17:00"];

function to12h(v) {
  const [H, M] = v.split(":").map(Number);
  const ap = H < 12 ? "AM" : "PM";
  const h = H % 12 || 12;
  return `${h}:${String(M).padStart(2, "0")} ${ap}`;
}
const pad = (n) => String(n).padStart(2, "0");

export default function TimePicker({ value, onChange, placeholder = "Select time" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);

  const [h, mn] = value ? value.split(":").map(Number) : [null, null];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // scroll the selected hour/minute into view
    const id = requestAnimationFrame(() => {
      popRef.current?.querySelectorAll(".tmp-opt.sel").forEach((el) =>
        el.scrollIntoView({ block: "center" })
      );
    });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(id);
    };
  }, [open]);

  const set = (nh, nm) => {
    const H = nh == null ? (h ?? 9) : nh;
    const M = nm == null ? (mn ?? 0) : nm;
    onChange(`${pad(H)}:${pad(M)}`);
  };

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className={`picker-trigger ${value ? "" : "is-placeholder"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-clock picker-lead" />
        <span className="picker-value">{value ? to12h(value) : placeholder}</span>
        {value ? (
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
        <div className="picker-pop tmp-pop" ref={popRef}>
          <div className="tmp-presets">
            {PRESETS.map((p) => (
              <button type="button" key={p} className={`tmp-preset${value === p ? " sel" : ""}`} onClick={() => { onChange(p); setOpen(false); }}>
                {to12h(p)}
              </button>
            ))}
          </div>
          <div className="tmp-cols">
            <div className="tmp-col">
              <div className="tmp-col-head">Hour</div>
              <div className="tmp-col-scroll">
                {HOURS.map((H) => (
                  <button type="button" key={H} className={`tmp-opt${h === H ? " sel" : ""}`} onClick={() => set(H, null)}>
                    {pad(H)}
                  </button>
                ))}
              </div>
            </div>
            <div className="tmp-col">
              <div className="tmp-col-head">Min</div>
              <div className="tmp-col-scroll">
                {MINUTES.map((M) => (
                  <button type="button" key={M} className={`tmp-opt${mn === M ? " sel" : ""}`} onClick={() => set(null, M)}>
                    {pad(M)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The XP desktop: pages open as windows you can drag, resize, stack, minimise
 * and maximise, with a taskbar. Each window runs its page inside its own
 * MemoryRouter, so two windows never fight over ?tab= or /tasks/:id.
 *
 * Clicking a rail item calls openWindow(path): an existing window for that
 * space comes to the front; otherwise a new one cascades in. The browser URL
 * mirrors the focused window so a refresh brings the desktop back.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MemoryRouter, useLocation, UNSAFE_LocationContext, UNSAFE_NavigationContext, UNSAFE_RouteContext } from "react-router-dom";

/**
 * react-router refuses to mount a Router inside another Router. Each window
 * is its own little app though, so we blank the outer router's contexts
 * before mounting the window's MemoryRouter. The page inside then navigates
 * within its window only — exactly the browser-tab behaviour we want.
 */
function RouterIsland({ children }) {
  return (
    <UNSAFE_LocationContext.Provider value={null}>
      <UNSAFE_NavigationContext.Provider value={null}>
        <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
          {children}
        </UNSAFE_RouteContext.Provider>
      </UNSAFE_NavigationContext.Provider>
    </UNSAFE_LocationContext.Provider>
  );
}
import { WindowRoutes, pageFor } from "../../pages/admin/adminRoutes";

const STORE = "xp-admin-desktop-v1";
const DesktopCtx = createContext(null);
export const useDesktop = () => useContext(DesktopCtx);

const spaceOf = (path) => path.replace(/^\/admin\/?/, "").split(/[/?]/)[0] || "today";
const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; } };
const writeStore = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } };

let nextId = 1;
const CASCADE = 28;

export function DesktopProvider({ children, initialPath, onFocusPath }) {
  const [wins, setWins] = useState(() => {
    const saved = readStore();
    if (saved?.wins?.length) { nextId = (saved.nextId || saved.wins.length) + 1; return saved.wins; }
    return [];
  });
  const areaRef = useRef(null);
  const zTop = useRef(Math.max(10, ...wins.map((w) => w.z || 0)));

  // Persist geometry + order.
  useEffect(() => { writeStore({ wins, nextId }); }, [wins]);

  const focused = useMemo(() => wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0] || null, [wins]);
  useEffect(() => { if (focused) onFocusPath?.(focused.path); }, [focused?.id, focused?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultGeom = (index) => {
    const area = areaRef.current;
    const W = area?.clientWidth || 1200, H = area?.clientHeight || 800;
    const w = Math.min(W - 16, Math.min(980, Math.max(560, Math.round(W * 0.72))));
    const h = Math.min(H - 16, Math.min(760, Math.max(420, Math.round(H * 0.8))));
    const off = (index % 8) * CASCADE;
    return { x: 24 + off, y: 16 + off, w, h };
  };

  const focus = useCallback((id) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: ++zTop.current, min: false } : w))), []);
  const openWindow = useCallback((path) => {
    const space = spaceOf(path);
    setWins((ws) => {
      const existing = ws.find((w) => spaceOf(w.path) === space);
      if (existing) return ws.map((w) => (w.id === existing.id ? { ...w, path, z: ++zTop.current, min: false, nav: (w.nav || 0) + 1 } : w));
      const meta = pageFor(path);
      const g = defaultGeom(ws.length);
      return [...ws, { id: nextId++, path, title: meta?.title || "Window", icon: meta?.icon || "fa-window-maximize", ...g, z: ++zTop.current, min: false, max: false, nav: 0 }];
    });
  }, []);
  const close = useCallback((id) => setWins((ws) => ws.filter((w) => w.id !== id)), []);
  const minimize = useCallback((id) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, min: true } : w))), []);
  const toggleMax = useCallback((id) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, max: !w.max, z: ++zTop.current } : w))), []);
  const setGeom = useCallback((id, g) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...g } : w))), []);
  const setPathTitle = useCallback((id, path, title, icon) => setWins((ws) => ws.map((w) => (w.id === id && (w.path !== path || w.title !== title) ? { ...w, path, title, icon } : w))), []);

  // First visit with an empty desktop: open whatever URL we arrived on.
  useEffect(() => { if (wins.length === 0 && initialPath) openWindow(initialPath); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ wins, focused, openWindow, close, minimize, toggleMax, focus, setGeom, setPathTitle, areaRef }), [wins, focused, openWindow, close, minimize, toggleMax, focus, setGeom, setPathTitle]);
  return <DesktopCtx.Provider value={value}>{children}</DesktopCtx.Provider>;
}

/** Keeps the window's caption/taskbar label in step with where its page navigated. */
function PathSync({ id, initialPath }) {
  const loc = useLocation();
  const { setPathTitle } = useDesktop();
  useEffect(() => {
    const full = loc.pathname + loc.search;
    const meta = pageFor(loc.pathname);
    setPathTitle(id, full, meta?.title || "Window", meta?.icon || "fa-window-maximize");
  }, [loc.pathname, loc.search]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function XpWindow({ w }) {
  const { focused, focus, close, minimize, toggleMax, setGeom, areaRef } = useDesktop();
  const active = focused?.id === w.id;
  const drag = useRef(null);

  const start = (e, mode) => {
    if (e.button !== 0 || w.max) return;
    const area = areaRef.current?.getBoundingClientRect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: w.x, y: w.y, w: w.w, h: w.h, area };
    const move = (ev) => {
      const d = drag.current; if (!d) return;
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      if (d.mode === "move") {
        const maxX = (d.area?.width || 4000) - 120, maxY = (d.area?.height || 4000) - 40;
        setGeom(w.id, { x: Math.max(-d.w + 160, Math.min(d.x + dx, maxX)), y: Math.max(0, Math.min(d.y + dy, maxY)) });
      } else {
        const minW = Math.min(420, (d.area?.width || 4000) - 16);
        setGeom(w.id, { w: Math.max(minW, d.w + dx), h: Math.max(240, d.h + dy) });
      }
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  const style = w.max ? { left: 0, top: 0, width: "100%", height: "100%" } : { left: w.x, top: w.y, width: w.w, height: w.h };
  return (
    <section className={`xpw${active ? " active" : ""}${w.max ? " max" : ""}`} style={{ ...style, zIndex: w.z, display: w.min ? "none" : undefined }} onPointerDown={() => { if (!active) focus(w.id); }} aria-label={w.title}>
      <header className="xpw-caption" onPointerDown={(e) => start(e, "move")} onDoubleClick={() => toggleMax(w.id)}>
        <i className={`fa-solid ${w.icon}`} />
        <span className="xpw-title">{w.title}</span>
        <div className="xpw-btns">
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => minimize(w.id)} aria-label="Minimize"><i className="fa-solid fa-window-minimize" /></button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleMax(w.id)} aria-label={w.max ? "Restore" : "Maximize"}><i className={`fa-regular ${w.max ? "fa-window-restore" : "fa-window-maximize"}`} /></button>
          <button type="button" className="close" onPointerDown={(e) => e.stopPropagation()} onClick={() => close(w.id)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
      </header>
      <div className="xpw-body">
        {/* key on nav so opening the same space with a new path re-routes the window */}
        <RouterIsland>
          <MemoryRouter key={w.nav || 0} initialEntries={[w.path]}>
            <PathSync id={w.id} initialPath={w.path} />
            <div className="xpw-page"><WindowRoutes /></div>
          </MemoryRouter>
        </RouterIsland>
      </div>
      {!w.max && <span className="xpw-resize" onPointerDown={(e) => start(e, "resize")} aria-hidden="true" />}
    </section>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return <span className="xpd-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>;
}

export function DesktopArea() {
  const { wins, areaRef } = useDesktop();
  return (
    <div className="xp-desktop-area" ref={areaRef}>
      {wins.length === 0 && <p className="xp-desktop-empty">Open something from the menu.</p>}
      {wins.map((w) => <XpWindow key={w.id} w={w} />)}
    </div>
  );
}

export function Taskbar() {
  const { wins, focused, focus, minimize } = useDesktop();
  return (
    <footer className="xp-taskbar">
      <div className="xp-taskbar-tasks">
        {wins.map((w) => {
          const isTop = focused?.id === w.id && !w.min;
          return (
            <button type="button" key={w.id} className={`xpd-task${isTop ? " active" : ""}`} onClick={() => (isTop ? minimize(w.id) : focus(w.id))} title={w.title}>
              <i className={`fa-solid ${w.icon}`} /> <span>{w.title}</span>
            </button>
          );
        })}
      </div>
      <div className="xp-taskbar-tray"><Clock /></div>
    </footer>
  );
}

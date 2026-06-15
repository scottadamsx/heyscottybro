import { useCallback, useEffect, useMemo, useRef, useReducer, useState } from "react";
import { loadBrain, syncFromVault } from "../../api/brainApi";
import { useToast } from "../../contexts/ToastContext";
import { renderMarkdown } from "../../utils/markdown";

const W = 900, H = 560, CX = W / 2, CY = H / 2;
const TYPE_COLOR = {
  root: "#8b5cf6", projects: "#22c55e", checkpoints: "#f59e0b",
  procedures: "#14b8a6", note: "#6366f1",
};
const colorFor = (t) => TYPE_COLOR[t] || "#94a3b8";

export default function BrainPage() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { addToast } = useToast();

  const svgRef = useRef(null);
  const pos = useRef(new Map());           // slug -> {x,y,vx,vy}
  const drag = useRef(null);               // slug being dragged
  const pan = useRef(null);                // {x,y} pan start
  const view = useRef({ tx: 0, ty: 0, scale: 1 });
  const [, tick] = useReducer((x) => x + 1, 0);

  const fetchBrain = useCallback(async () => {
    setStatus("loading");
    try { const b = await loadBrain(); setData(b); setStatus("ready"); }
    catch (e) { setError(e?.message || "Failed to load brain."); setStatus("error"); }
  }, []);
  useEffect(() => { fetchBrain(); }, [fetchBrain]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFromVault();
      addToast(`Synced ${r.nodes} notes, ${r.links} links from your vault.`, "success");
      await fetchBrain();
    } catch (e) {
      addToast(e?.message?.includes("local dev") ? "Vault sync only runs locally (npm run dev)." : (e?.message || "Sync failed."), "error");
    } finally { setSyncing(false); }
  };

  // Graph model — only keep links whose endpoints both exist.
  const graph = useMemo(() => {
    const have = new Set(data.nodes.map((n) => n.slug));
    const links = data.links.filter((l) => have.has(l.source_slug) && have.has(l.target_slug));
    const deg = {};
    links.forEach((l) => { deg[l.source_slug] = (deg[l.source_slug] || 0) + 1; deg[l.target_slug] = (deg[l.target_slug] || 0) + 1; });
    return { nodes: data.nodes, links, deg };
  }, [data]);

  // Seed positions for any new nodes.
  useEffect(() => {
    const p = pos.current;
    graph.nodes.forEach((n, i) => {
      if (!p.has(n.slug)) {
        const a = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2;
        p.set(n.slug, { x: CX + Math.cos(a) * 160 + (Math.random() - 0.5) * 40, y: CY + Math.sin(a) * 160 + (Math.random() - 0.5) * 40, vx: 0, vy: 0 });
      }
    });
    for (const slug of [...p.keys()]) if (!graph.nodes.find((n) => n.slug === slug)) p.delete(slug);
  }, [graph]);

  // Force simulation.
  useEffect(() => {
    if (!graph.nodes.length) return;
    let raf, frames = 0;
    const step = () => {
      const p = pos.current;
      const ns = graph.nodes;
      for (let i = 0; i < ns.length; i++) {
        const a = p.get(ns[i].slug); if (!a) continue;
        let fx = (CX - a.x) * 0.006, fy = (CY - a.y) * 0.006; // gravity
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const b = p.get(ns[j].slug); if (!b) continue;
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01;
          const f = 2600 / d2; const d = Math.sqrt(d2);
          fx += (dx / d) * f; fy += (dy / d) * f;
        }
        a._fx = fx; a._fy = fy;
      }
      for (const l of graph.links) {
        const a = p.get(l.source_slug), b = p.get(l.target_slug); if (!a || !b) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 90) * 0.015;
        const ux = dx / d, uy = dy / d;
        a._fx += ux * f; a._fy += uy * f; b._fx -= ux * f; b._fy -= uy * f;
      }
      for (const n of ns) {
        const a = p.get(n.slug); if (!a || drag.current === n.slug) continue;
        a.vx = (a.vx + (a._fx || 0)) * 0.82; a.vy = (a.vy + (a._fy || 0)) * 0.82;
        a.vx = Math.max(-12, Math.min(12, a.vx)); a.vy = Math.max(-12, Math.min(12, a.vy));
        a.x += a.vx; a.y += a.vy;
      }
      tick();
      if (++frames < 600 || drag.current) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [graph]);

  // Pointer -> graph coords (account for viewBox + pan/zoom <g>).
  const toGraph = (clientX, clientY) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const { tx, ty, scale } = view.current;
    return { x: (loc.x - tx) / scale, y: (loc.y - ty) / scale };
  };

  const onDown = (e, slug) => {
    e.stopPropagation();
    drag.current = slug; setSelected(graph.nodes.find((n) => n.slug === slug) || null);
    const g = toGraph(e.clientX, e.clientY); const a = pos.current.get(slug);
    if (a) { a._ox = a.x - g.x; a._oy = a.y - g.y; }
    tick();
  };
  const onBgDown = (e) => { pan.current = { x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty }; };
  const onMove = (e) => {
    if (drag.current) {
      const g = toGraph(e.clientX, e.clientY); const a = pos.current.get(drag.current);
      if (a) { a.x = g.x + (a._ox || 0); a.y = g.y + (a._oy || 0); a.vx = a.vy = 0; tick(); }
    } else if (pan.current) {
      view.current.tx = pan.current.tx + (e.clientX - pan.current.x);
      view.current.ty = pan.current.ty + (e.clientY - pan.current.y); tick();
    }
  };
  const onUp = () => { drag.current = null; pan.current = null; };
  const onWheel = (e) => {
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    view.current.scale = Math.max(0.3, Math.min(3, view.current.scale * f)); tick();
  };

  const { tx, ty, scale } = view.current;

  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-brain" /> Brain</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={fetchBrain} disabled={status === "loading"} style={{ fontSize: 13 }}>
            <i className={`fa-solid ${status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} /> Refresh
          </button>
          <button className="btn-primary" onClick={handleSync} disabled={syncing}>
            <i className={`fa-solid ${syncing ? "fa-spinner fa-spin" : "fa-cloud-arrow-down"}`} /> {syncing ? "Syncing…" : "Sync from vault"}
          </button>
        </div>
      </div>

      {status === "error" && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}
      {status === "ready" && graph.nodes.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Your brain is empty. Run the app locally (<code>npm run dev</code>) and click <strong>Sync from vault</strong> to import your Obsidian / Claude memory notes.
        </p>
      )}

      {graph.nodes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 320px" : "1fr", gap: 12 }}>
          <div style={{ background: "var(--bg-elevated,#101216)", border: "0.5px solid var(--border,#333)", borderRadius: "0.6rem", overflow: "hidden" }}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 560, display: "block", cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
              onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}>
              <g transform={`translate(${tx},${ty}) scale(${scale})`}>
                {graph.links.map((l, i) => {
                  const a = pos.current.get(l.source_slug), b = pos.current.get(l.target_slug);
                  if (!a || !b) return null;
                  return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border,#333)" strokeWidth={0.6} opacity={0.5} />;
                })}
                {graph.nodes.map((n) => {
                  const a = pos.current.get(n.slug); if (!a) return null;
                  const r = 5 + Math.min(10, graph.deg[n.slug] || 0);
                  const sel = selected?.slug === n.slug;
                  return (
                    <g key={n.slug} transform={`translate(${a.x},${a.y})`} style={{ cursor: "pointer" }} onPointerDown={(e) => onDown(e, n.slug)}>
                      <circle r={r} fill={colorFor(n.type)} stroke={sel ? "#fff" : "rgba(0,0,0,0.4)"} strokeWidth={sel ? 2 : 0.5} opacity={0.92} />
                      {(scale > 0.7 || sel) && <text x={r + 3} y={3.5} fontSize={9} fill="var(--text-secondary,#bbb)" style={{ pointerEvents: "none" }}>{n.title.slice(0, 26)}</text>}
                    </g>
                  );
                })}
              </g>
            </svg>
            <div style={{ display: "flex", gap: 12, padding: "8px 12px", borderTop: "0.5px solid var(--border)", fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span>{graph.nodes.length} notes · {graph.links.length} links · drag to move · scroll to zoom</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                {Object.entries(TYPE_COLOR).map(([t, c]) => <span key={t}><i className="fa-solid fa-circle" style={{ color: c, fontSize: 8, marginRight: 3 }} />{t}</span>)}
              </span>
            </div>
          </div>

          {selected && (
            <div style={{ background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.6rem", padding: "1rem 1.1rem", maxHeight: 605, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{selected.title}</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}><i className="fa-solid fa-xmark" /></button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 10px" }}>
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: colorFor(selected.type) + "22", color: colorFor(selected.type), textTransform: "uppercase", letterSpacing: "0.04em" }}>{selected.type}</span>
                {(selected.tags || []).map((t) => <span key={t} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "var(--bg-raised,#222)", color: "var(--text-muted)" }}>#{t}</span>)}
              </div>
              {selected.source && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontFamily: "monospace" }}>{selected.source}</div>}
              <div className="chat-md" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.body || "*(empty note)*") }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

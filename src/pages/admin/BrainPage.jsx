import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBrain, syncFromVault } from "../../api/brainApi";
import { useToast } from "../../contexts/ToastContext";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
import "./brain.css";

// Three.js is heavy (~600 kB) — load the WebGL graph only when this page mounts
// so it never weighs down the rest of the app. (Vite SPA = client-only, so no
// SSR guard is needed; we just code-split it.)
const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

// Node colours by type. CSS vars are resolved to concrete values at runtime
// because WebGL can't read `var(--x)`.
const TYPE_COLOR = {
  root: "#8b5cf6", projects: "var(--green)", checkpoints: "var(--orange)",
  procedures: "#14b8a6", note: "var(--accent)",
};
const FALLBACK = "#94a3b8";

function resolveColors() {
  const cs = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const out = {};
  for (const [k, v] of Object.entries(TYPE_COLOR)) {
    out[k] = cs && v.startsWith("var(")
      ? (cs.getPropertyValue(v.slice(4, -1)).trim() || FALLBACK)
      : v;
  }
  return out;
}

const isMobileNow = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

export default function BrainPage() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [dims, setDims] = useState({ w: 800, h: 560 });
  const [colors, setColors] = useState(resolveColors);
  const [mobile] = useState(isMobileNow);
  const { addToast } = useToast();

  const fgRef = useRef(null);
  const wrapRef = useRef(null);
  const fitted = useRef(false);

  const fetchBrain = useCallback(async () => {
    setStatus("loading");
    try { const b = await loadBrain(); setData(b); setStatus("ready"); }
    catch (e) { setError(e?.message || "Failed to load brain."); setStatus("error"); }
  }, []);
  useEffect(() => { fetchBrain(); }, [fetchBrain]);

  // Re-resolve theme colours after mount (covers the live "preview theme" path).
  useEffect(() => { setColors(resolveColors()); }, []);

  // Keep the canvas sized to its container — graph re-fits as the side panel
  // opens/closes or the viewport changes.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: Math.max(280, Math.round(width)), h: Math.max(320, Math.round(height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFromVault();
      addToast(`Synced ${r.nodes} notes, ${r.links} links from your vault.`, "success");
      fitted.current = false;
      await fetchBrain();
    } catch (e) {
      addToast(e?.message?.includes("local dev") ? "Vault sync only runs locally (npm run dev)." : (e?.message || "Sync failed."), "error");
    } finally { setSyncing(false); }
  };

  // Build the force-graph model. Map slug → id, keep only links whose endpoints
  // both exist, and pre-compute degree for node sizing.
  const graph = useMemo(() => {
    const have = new Set(data.nodes.map((n) => n.slug));
    const links = data.links
      .filter((l) => have.has(l.source_slug) && have.has(l.target_slug))
      .map((l) => ({ source: l.source_slug, target: l.target_slug }));
    const deg = {};
    links.forEach((l) => { deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; });
    const nodes = data.nodes.map((n) => ({ ...n, id: n.slug, deg: deg[n.slug] || 0 }));
    return { nodes, links };
  }, [data]);

  const big = graph.nodes.length > 300; // shed cost on large graphs

  // Tap (not hover) to select — and gently fly the camera to the node.
  const handleNodeClick = useCallback((node) => {
    setSelected(node);
    const fg = fgRef.current;
    if (!fg || node.x == null) return;
    const dist = 80;
    const hyp = Math.hypot(node.x, node.y, node.z || 0) || 1;
    const ratio = 1 + dist / hyp;
    fg.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node, 1200
    );
  }, []);

  const onEngineStop = useCallback(() => {
    if (fitted.current) return;
    fitted.current = true;
    fgRef.current?.zoomToFit(500, 40);
  }, []);

  const nodeColor = useCallback((n) => colors[n.type] || FALLBACK, [colors]);

  return (
    <div className="module-page brain-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-brain" /> Brain</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm btn-secondary-sm" onClick={fetchBrain} disabled={status === "loading"}>
            <i className={`fa-solid ${status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} /> Refresh
          </button>
          <button className="btn btn-sm" onClick={handleSync} disabled={syncing}>
            <i className={`fa-solid ${syncing ? "fa-spinner fa-spin" : "fa-cloud-arrow-down"}`} /> {syncing ? "Syncing…" : "Sync from vault"}
          </button>
        </div>
      </div>

      {status === "error" && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {status === "ready" && graph.nodes.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Your brain is empty. Run the app locally (<code>npm run dev</code>) and click <strong>Sync from vault</strong> to import your Obsidian / Claude memory notes.
        </p>
      )}

      {graph.nodes.length > 0 && (
        <div className={`brain-layout${selected ? " with-panel" : ""}`}>
          <div className="brain-stage" ref={wrapRef}>
            <Suspense fallback={<div className="brain-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading 3D engine…</div>}>
              <ForceGraph3D
                ref={fgRef}
                width={dims.w}
                height={dims.h}
                graphData={graph}
                backgroundColor="#0b1020"
                showNavInfo={false}
                nodeLabel="title"
                nodeColor={nodeColor}
                nodeRelSize={4}
                nodeVal={(n) => 1 + Math.min(12, n.deg)}
                nodeOpacity={0.92}
                nodeResolution={mobile || big ? 8 : 16}
                linkColor={() => "rgba(255,255,255,0.16)"}
                linkWidth={0.4}
                linkOpacity={0.5}
                enableNodeDrag={false}
                onNodeClick={handleNodeClick}
                onBackgroundClick={() => setSelected(null)}
                warmupTicks={mobile ? 20 : 60}
                cooldownTicks={mobile ? 60 : 120}
                onEngineStop={onEngineStop}
                rendererConfig={{ antialias: !mobile, powerPreference: "high-performance" }}
              />
            </Suspense>

            <div className="brain-legend">
              <span>{graph.nodes.length} notes · {graph.links.length} links · drag to orbit · pinch to zoom · tap a node</span>
              <span className="brain-legend-types">
                {Object.keys(TYPE_COLOR).map((t) => (
                  <span key={t}><i className="fa-solid fa-circle" style={{ color: colors[t], fontSize: 8, marginRight: 3 }} />{t}</span>
                ))}
              </span>
            </div>
          </div>

          {selected && (
            <aside className="brain-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selected.title}</h3>
                <button onClick={() => setSelected(null)} className="icon-x" aria-label="Close"><i className="fa-solid fa-xmark" /></button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 10px" }}>
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: (colors[selected.type] || FALLBACK) + "22", color: colors[selected.type] || FALLBACK, textTransform: "uppercase", letterSpacing: "0.04em" }}>{selected.type}</span>
                {(selected.tags || []).map((t) => <span key={t} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "var(--bg-raised)", color: "var(--text-muted)" }}>#{t}</span>)}
              </div>
              <div style={{ marginBottom: 10 }}>
                <CopyId id={docId(selected.title, selected.slug)} />
              </div>
              {selected.source && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontFamily: "monospace", wordBreak: "break-all" }}>{selected.source}</div>}
              <div className="chat-md" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.body || "*(empty note)*") }} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

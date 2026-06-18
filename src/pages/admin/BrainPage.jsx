import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBrain, syncFromVault } from "../../api/brainApi";
import { useToast } from "../../contexts/ToastContext";
import { renderMarkdown } from "../../utils/markdown";
import CopyId, { docId } from "../../components/CopyId";
import { AGENTS } from "../../agents/registry";
import { resolveTools, modelLabel } from "../../agents/agentProfile";
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
  const [tab, setTab] = useState("graph");   // "graph" | "folders" | "tools"
  const [toolQuery, setToolQuery] = useState("");
  const [folderNode, setFolderNode] = useState(null); // note open in the 3D lookup modal
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
        {tab === "graph" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-secondary-sm" onClick={fetchBrain} disabled={status === "loading"}>
              <i className={`fa-solid ${status === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"}`} /> Refresh
            </button>
            <button className="btn btn-sm" onClick={handleSync} disabled={syncing}>
              <i className={`fa-solid ${syncing ? "fa-spinner fa-spin" : "fa-cloud-arrow-down"}`} /> {syncing ? "Syncing…" : "Sync from vault"}
            </button>
          </div>
        )}
      </div>

      <div className="brain-tabs">
        <button type="button" className={`brain-tab${tab === "graph" ? " active" : ""}`} onClick={() => setTab("graph")}>
          <i className="fa-solid fa-diagram-project" /> Graph
        </button>
        <button type="button" className={`brain-tab${tab === "folders" ? " active" : ""}`} onClick={() => setTab("folders")}>
          <i className="fa-solid fa-folder-tree" /> Folders
        </button>
        <button type="button" className={`brain-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>
          <i className="fa-solid fa-toolbox" /> Agent Tools
        </button>
      </div>

      {tab === "tools" && <AgentTools query={toolQuery} setQuery={setToolQuery} />}

      {tab === "folders" && (
        data.nodes.length === 0
          ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Your brain is empty — sync from your vault first (on the Graph tab).</p>
          : <FolderTree nodes={data.nodes} onSelect={setFolderNode} />
      )}

      {folderNode && (
        <NodeGraphModal
          node={folderNode}
          data={data}
          colors={colors}
          mobile={mobile}
          onClose={() => setFolderNode(null)}
          onOpenInGraph={(n) => { setSelected({ ...n, id: n.slug }); setFolderNode(null); setTab("graph"); }}
        />
      )}

      {tab === "graph" && status === "error" && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {tab === "graph" && status === "ready" && graph.nodes.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Your brain is empty. Run the app locally (<code>npm run dev</code>) and click <strong>Sync from vault</strong> to import your Obsidian / Claude memory notes.
        </p>
      )}

      {tab === "graph" && graph.nodes.length > 0 && (
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

/**
 * Agent Tools reference — a searchable, centralised view of every agent and the
 * toolset it actually carries. Derived live from the registry + shared TOOLS
 * belt (via agentProfile), so it never drifts from how the agents really run.
 * Local agents (Aulë) have no app toolbelt — they get a note instead.
 */
function AgentTools({ query, setQuery }) {
  const q = query.trim().toLowerCase();

  const agents = AGENTS.map((a) => ({ agent: a, tools: resolveTools(a) }));
  const matches = q
    ? agents.filter(({ agent, tools }) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.title || "").toLowerCase().includes(q) ||
        (agent.tagline || "").toLowerCase().includes(q) ||
        tools.some((t) => t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)))
    : agents;

  return (
    <div className="brain-tools">
      <div className="brain-tools-head">
        <p className="brain-tools-intro">
          What each agent can do — native capabilities, the tools/APIs on its belt, and the skills you've given it.
        </p>
        <div className="brain-tools-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents or tools…"
          />
        </div>
      </div>

      {matches.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No agent or tool matches “{query}”.</p>}

      <div className="brain-tools-grid">
        {matches.map(({ agent, tools }) => {
          const shown = q ? tools.filter((t) => t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)) : tools;
          // When the agent itself matched (not its tools), still show its full belt.
          const list = q && shown.length === 0 ? tools : shown;
          return (
            <div key={agent.id} className="brain-agent-card" style={{ "--agent": agent.color }}>
              <div className="brain-agent-head">
                <span className="brain-agent-avatar" style={{ background: agent.color }}>
                  <i className={`fa-solid ${agent.icon}`} />
                </span>
                <div className="brain-agent-id">
                  <div className="brain-agent-name">{agent.name}</div>
                  <div className="brain-agent-title">{agent.title} · {modelLabel(agent.model)}</div>
                </div>
              </div>
              {agent.tagline && <p className="brain-agent-tagline">{agent.tagline}</p>}

              {agent.kind === "local" ? (
                <p className="brain-agent-note"><i className="fa-solid fa-terminal" /> Runs real Claude Code on your Mac — full file-system &amp; shell access, not the app toolbelt.</p>
              ) : list.length === 0 ? (
                <p className="brain-agent-note">No tools — replies from knowledge only.</p>
              ) : (
                <>
                  <div className="brain-agent-tools-h"><i className="fa-solid fa-toolbox" /> {tools.length} tool{tools.length === 1 ? "" : "s"}</div>
                  <ul className="brain-tool-list">
                    {list.map((t) => (
                      <li key={t.name} className="brain-tool">
                        <code className="brain-tool-name">{t.name}</code>
                        <span className="brain-tool-desc">{t.description}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Folder view ──────────────────────────────────────────────────────────────
// Each note's slug is its vault path (e.g. "Claude Chats/MOCs/MOC - Career & …"),
// so the folder hierarchy already lives in the data — we just rebuild the tree.
function buildTree(nodes) {
  const root = { folders: {}, notes: [] };
  for (const n of nodes) {
    const parts = String(n.slug || n.title || "").split("/").filter(Boolean);
    parts.pop(); // last segment is the note itself
    let cur = root;
    for (const part of parts) {
      cur.folders[part] = cur.folders[part] || { folders: {}, notes: [] };
      cur = cur.folders[part];
    }
    cur.notes.push(n);
  }
  return root;
}
function countNotes(folder) {
  let c = folder.notes.length;
  for (const k of Object.keys(folder.folders)) c += countNotes(folder.folders[k]);
  return c;
}
const noteLabel = (n) => n.title || String(n.slug || "").split("/").pop() || n.slug;

/**
 * Hierarchical folder/tree view of the Brain, built from note slug paths.
 * Folders collapse/expand; a search box flattens to matching notes. Picking a
 * note hands it to the 3D lookup modal via onSelect.
 */
function FolderTree({ nodes, onSelect }) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState("");
  const toggle = (p) => setOpen((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const query = q.trim().toLowerCase();
  const flat = query
    ? nodes.filter((n) => noteLabel(n).toLowerCase().includes(query) || String(n.slug || "").toLowerCase().includes(query))
        .sort((a, b) => noteLabel(a).localeCompare(noteLabel(b)))
    : null;

  const renderFolder = (folder, path, depth) => {
    const names = Object.keys(folder.folders).sort((a, b) => a.localeCompare(b));
    const notes = [...folder.notes].sort((a, b) => noteLabel(a).localeCompare(noteLabel(b)));
    return (
      <>
        {names.map((name) => {
          const childPath = path ? `${path}/${name}` : name;
          const isOpen = open.has(childPath);
          return (
            <div key={childPath}>
              <button className="brain-folder-row" style={{ paddingLeft: depth * 14 + 8 }} onClick={() => toggle(childPath)}>
                <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} brain-folder-caret`} />
                <i className={`fa-solid ${isOpen ? "fa-folder-open" : "fa-folder"}`} style={{ color: "var(--orange)" }} />
                <span className="brain-folder-name">{name}</span>
                <span className="brain-folder-count">{countNotes(folder.folders[name])}</span>
              </button>
              {isOpen && renderFolder(folder.folders[name], childPath, depth + 1)}
            </div>
          );
        })}
        {notes.map((n) => (
          <button key={n.slug} className="brain-note-row" style={{ paddingLeft: depth * 14 + 26 }} onClick={() => onSelect(n)} title="Open 3D lookup">
            <i className="fa-solid fa-note-sticky" />
            <span className="brain-folder-name">{noteLabel(n)}</span>
          </button>
        ))}
      </>
    );
  };

  return (
    <div className="brain-folders">
      <div className="brain-tools-search" style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-magnifying-glass" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" />
      </div>
      {flat
        ? (flat.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No notes match “{q}”.</p>
            : flat.map((n) => (
              <button key={n.slug} className="brain-note-row" style={{ paddingLeft: 8 }} onClick={() => onSelect(n)} title="Open 3D lookup">
                <i className="fa-solid fa-note-sticky" />
                <span className="brain-folder-name">{noteLabel(n)}</span>
                <span className="brain-folder-path">{n.slug}</span>
              </button>
            )))
        : renderFolder(tree, "", 0)}
    </div>
  );
}

/**
 * 3D lookup modal: shows the picked note and its directly-linked neighbours in a
 * focused force-graph, so you can explore relationships without leaving the
 * folder view. Click a neighbour to re-centre on it.
 */
function NodeGraphModal({ node, data, colors, mobile, onClose, onOpenInGraph }) {
  const [center, setCenter] = useState(node);
  const fgRef = useRef(null);
  const fitted = useRef(false);
  useEffect(() => { setCenter(node); }, [node]);

  // The picked note + its 1-hop neighbours, and the links among that set.
  const sub = useMemo(() => {
    const slug = center.slug;
    const keep = new Set([slug]);
    (data.links || []).forEach((l) => {
      if (l.source_slug === slug) keep.add(l.target_slug);
      if (l.target_slug === slug) keep.add(l.source_slug);
    });
    const nodes = (data.nodes || []).filter((n) => keep.has(n.slug)).map((n) => ({ ...n, id: n.slug }));
    const links = (data.links || [])
      .filter((l) => keep.has(l.source_slug) && keep.has(l.target_slug))
      .map((l) => ({ source: l.source_slug, target: l.target_slug }));
    return { nodes, links };
  }, [center, data]);

  const W = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.86 : 560, 560);
  const H = mobile ? 300 : 380;
  const neighbourCount = sub.nodes.length - 1;
  fitted.current = false; // re-fit whenever the centre changes

  return (
    <div className="brain-modal-backdrop" onClick={onClose}>
      <div className="brain-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brain-modal-head">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{center.title || center.slug}</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
              {center.type && <span className="reader-pill" style={{ background: colors[center.type] || FALLBACK }}>{center.type}</span>}
              {(center.tags || []).slice(0, 5).map((t) => <span key={t} className="reader-tag">#{t}</span>)}
              <CopyId id={docId(center.title, center.slug)} />
            </div>
          </div>
          <button onClick={onClose} className="icon-x" aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="brain-modal-stage" style={{ height: H }}>
          {neighbourCount === 0 ? (
            <div className="brain-loading" style={{ height: "100%" }}>
              <span><i className="fa-solid fa-circle-nodes" style={{ marginRight: 6 }} />No connections yet — this note stands alone in the graph.</span>
            </div>
          ) : (
            <Suspense fallback={<div className="brain-loading" style={{ height: "100%" }}><i className="fa-solid fa-spinner fa-spin" /> Loading 3D…</div>}>
              <ForceGraph3D
                ref={fgRef}
                width={W}
                height={H}
                graphData={sub}
                backgroundColor="#0b1020"
                showNavInfo={false}
                nodeLabel="title"
                nodeColor={(n) => (n.slug === center.slug ? "#ffffff" : (colors[n.type] || FALLBACK))}
                nodeVal={(n) => (n.slug === center.slug ? 10 : 3)}
                nodeOpacity={0.95}
                nodeResolution={12}
                linkColor={() => "rgba(255,255,255,0.28)"}
                linkWidth={0.6}
                enableNodeDrag={false}
                onNodeClick={(n) => { if (n.slug !== center.slug) setCenter(n); }}
                cooldownTicks={80}
                onEngineStop={() => { if (!fitted.current) { fitted.current = true; fgRef.current?.zoomToFit(400, 30); } }}
              />
            </Suspense>
          )}
        </div>

        <div className="brain-modal-foot">
          <span className="brain-modal-hint">{neighbourCount} connection{neighbourCount === 1 ? "" : "s"} · tap a node to explore</span>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn btn-sm btn-secondary-sm" href={`/admin/read/${String(center.slug).split("/").map(encodeURIComponent).join("/")}`}>
              <i className="fa-solid fa-book-open" /> Open note
            </a>
            <button className="btn btn-sm" onClick={() => onOpenInGraph(center)}>
              <i className="fa-solid fa-diagram-project" /> Show in full graph
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

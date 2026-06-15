/**
 * Aulë — the local coding agent server.
 *
 * Runs on your Mac (`npm run agents`) and bridges a real Claude Code session
 * (via the Claude Agent SDK, on your Max-plan login) to the Command Center over
 * a localhost WebSocket. The deployed Vercel app can't spawn a terminal, so
 * this is how Aulë writes code while you chat with him in the browser.
 *
 * Safety: binds 127.0.0.1 only, requires a shared token, and confines Aulë to
 * an allow-listed workspace (your repos) — he can't wander your whole disk.
 *
 * Config (env / .env): AULE_PORT, AULE_TOKEN (required), AULE_WORKSPACE,
 * AULE_PERMISSION_MODE (acceptEdits|bypassPermissions|default), AULE_MODEL,
 * AULE_CLAUDE_PATH.
 */
import { WebSocketServer } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── tiny .env loader (no dep) ────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
(function loadEnv() {
  const f = join(REPO_ROOT, ".env");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

// Force the Max-plan login: if an API key is present it would bill the API
// instead of the subscription. Aulë is the one agent that must use Max.
delete process.env.ANTHROPIC_API_KEY;

const PORT = Number(process.env.AULE_PORT) || 8787;
const TOKEN = process.env.AULE_TOKEN || "";
const WORKSPACE = resolve(process.env.AULE_WORKSPACE || resolve(REPO_ROOT, ".."));
const PERMISSION_MODE = process.env.AULE_PERMISSION_MODE || "acceptEdits";
const MODEL = process.env.AULE_MODEL || undefined;
const CLAUDE_PATH = process.env.AULE_CLAUDE_PATH || undefined;

if (!TOKEN) {
  console.error("✖ AULE_TOKEN is not set. Add AULE_TOKEN=<a long random string> to .env, then `npm run agents`.");
  process.exit(1);
}

// A requested working dir must live inside the workspace (or be it).
const inWorkspace = (p) => {
  const r = resolve(p);
  return r === WORKSPACE || r.startsWith(WORKSPACE + "/");
};

// Discover repos: the workspace itself + its immediate git subfolders.
function listRepos() {
  const repos = [];
  if (existsSync(join(WORKSPACE, ".git"))) repos.push(WORKSPACE);
  try {
    for (const name of readdirSync(WORKSPACE)) {
      const p = join(WORKSPACE, name);
      try { if (statSync(p).isDirectory() && existsSync(join(p, ".git"))) repos.push(p); } catch { /* skip */ }
    }
  } catch { /* workspace unreadable */ }
  return [...new Set(repos)].sort();
}

const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } };

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
console.log(`🔨 Aulë agent server on ws://127.0.0.1:${PORT}`);
console.log(`   workspace: ${WORKSPACE}`);
console.log(`   permission mode: ${PERMISSION_MODE}${MODEL ? ` · model ${MODEL}` : ""}`);
console.log(`   repos: ${listRepos().map((r) => r.replace(WORKSPACE + "/", "")).join(", ") || "(none found)"}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  if ((url.searchParams.get("token") || "") !== TOKEN) {
    send(ws, { type: "error", text: "Bad token." });
    ws.close();
    return;
  }

  const state = { cwd: null, sessionId: null, running: false, q: null };
  send(ws, { type: "ready", workspace: WORKSPACE, repos: listRepos(), permissionMode: PERMISSION_MODE });

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "start") {
      if (!inWorkspace(msg.cwd)) { send(ws, { type: "error", text: "That folder is outside Aulë's workspace." }); return; }
      state.cwd = resolve(msg.cwd);
      state.sessionId = null;
      send(ws, { type: "started", cwd: state.cwd });
      return;
    }

    if (msg.type === "interrupt") {
      try { await state.q?.interrupt?.(); } catch { /* ignore */ }
      return;
    }

    if (msg.type === "input") {
      if (state.running) { send(ws, { type: "error", text: "Aulë is still working — wait or interrupt." }); return; }
      if (!state.cwd) { send(ws, { type: "error", text: "Pick a repo first." }); return; }
      const text = String(msg.text || "").trim();
      if (!text) return;
      state.running = true;
      send(ws, { type: "turn_start" });
      try {
        const q = query({
          prompt: text,
          options: {
            cwd: state.cwd,
            permissionMode: PERMISSION_MODE,
            allowDangerouslySkipPermissions: PERMISSION_MODE === "bypassPermissions",
            ...(state.sessionId ? { resume: state.sessionId } : {}),
            ...(MODEL ? { model: MODEL } : {}),
            ...(CLAUDE_PATH ? { pathToClaudeCodeExecutable: CLAUDE_PATH } : {}),
            stderr: () => {},
          },
        });
        state.q = q;
        for await (const m of q) {
          if (m.session_id) state.sessionId = m.session_id;
          if (m.type === "system") {
            if (m.subtype === "init") send(ws, { type: "status", text: `Session ready${m.model ? ` · ${m.model}` : ""}` });
          } else if (m.type === "assistant") {
            for (const block of m.message?.content || []) {
              if (block.type === "text" && block.text.trim()) send(ws, { type: "assistant", text: block.text });
              else if (block.type === "tool_use") send(ws, { type: "tool", name: block.name, input: block.input });
            }
          } else if (m.type === "result") {
            send(ws, { type: "result", text: m.result || "", cost: m.total_cost_usd, isError: m.is_error });
          }
        }
      } catch (e) {
        send(ws, { type: "error", text: e?.message || "Aulë hit an error." });
      } finally {
        state.running = false;
        state.q = null;
        send(ws, { type: "turn_end" });
      }
    }
  });
});

wss.on("error", (e) => console.error("Aulë server error:", e.message));

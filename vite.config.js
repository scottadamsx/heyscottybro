import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import net from "node:net";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Dev-only stand-in for the Vercel serverless proxy (api/_utils.js):
  // forwards /api/chat and /api/briefing straight to Anthropic with the key
  // from .env, so the chat features work under `vite dev`.
  const anthropicProxy = {
    target: "https://api.anthropic.com",
    changeOrigin: true,
    rewrite: () => "/v1/messages",
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        const key = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
        if (key) proxyReq.setHeader("x-api-key", key);
        proxyReq.setHeader("anthropic-version", "2023-06-01");
        proxyReq.setHeader("anthropic-dangerous-direct-browser-access", "true");
        proxyReq.removeHeader("origin");
        proxyReq.removeHeader("referer");
        proxyReq.removeHeader("authorization"); // Supabase session token is for our own /api, not Anthropic
      });
    },
  };

  // Dev-only stand-in for api/fetch.js (Frodo's web_fetch) — vite dev doesn't
  // run the Vercel serverless functions, so handle /api/fetch here.
  const devFetchPlugin = {
    name: "dev-api-fetch",
    configureServer(server) {
      server.middlewares.use("/api/fetch", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const json = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
          try {
            const { url } = JSON.parse(body || "{}");
            if (!url || !/^https?:\/\//i.test(url)) return json(400, { error: "Provide a full http(s) URL" });
            const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (heyScottyBro-Frodo)" }, redirect: "follow" });
            const ctype = r.headers.get("content-type") || "";
            const raw = await r.text();
            const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const text = ctype.includes("html") ? strip(raw) : raw;
            const m = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            json(200, { url, status: r.status, title: m ? strip(m[1]) : "", text: text.slice(0, 12000), truncated: text.length > 12000 });
          } catch (e) { json(500, { error: e.message }); }
        });
      });
    },
  };

  // Dev-only stand-in for api/anthropic-usage.js (Admin Usage & Cost API).
  const devUsagePlugin = {
    name: "dev-api-anthropic-usage",
    configureServer(server) {
      server.middlewares.use("/api/anthropic-usage", (req, res) => {
        const json = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
        const key = env.ANTHROPIC_ADMIN_KEY;
        if (!key) return json(200, { error: "no_admin_key", message: "Set ANTHROPIC_ADMIN_KEY (an sk-ant-admin01 key) in .env for local dev." });
        (async () => {
          try {
            const u = new URL(req.url, "http://localhost");
            const days = Math.min(Number(u.searchParams.get("days")) || 30, 31);
            const d = new Date(); d.setUTCDate(d.getUTCDate() - days); d.setUTCHours(0, 0, 0, 0);
            const starting_at = d.toISOString();
            const get = async (path, group) => {
              const qs = new URLSearchParams({ starting_at, bucket_width: "1d", limit: "31" });
              group.forEach((g) => qs.append("group_by[]", g));
              const r = await fetch(`https://api.anthropic.com/v1/organizations${path}?${qs}`, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
              const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || `Admin API ${r.status}`); return j;
            };
            const [cost, usage] = await Promise.all([get("/cost_report", ["description"]), get("/usage_report/messages", ["model"])]);
            json(200, { days, starting_at, cost, usage });
          } catch (e) { json(200, { error: "admin_api_error", message: e.message }); }
        })();
      });
    },
  };

  // Dev-only: read the local Obsidian/markdown vault off disk and return parsed
  // brain nodes + links. The deployed app can't reach the local folder, so this
  // is how "Sync from vault" works during `npm run dev` on the Mac.
  const VAULT_PATH = env.BRAIN_VAULT_PATH
    || `${process.env.HOME}/Library/CloudStorage/GoogleDrive-scottadamsx@gmail.com/My Drive/claude-memory`;
  const devBrainPlugin = {
    name: "dev-api-brain-vault",
    configureServer(server) {
      server.middlewares.use("/api/brain-vault", (req, res) => {
        const json = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
        (async () => {
          try {
            const { parseVault } = await import("./scripts/brainVault.mjs");
            const { nodes, links } = await parseVault(VAULT_PATH);
            json(200, { vault: VAULT_PATH, nodes, links });
          } catch (e) { json(200, { error: "vault_read_error", message: e.message }); }
        })();
      });
    },
  };

  // Dev-only stand-in for api/overseer-run.js (Galadriel's daily summary). Sets
  // the server-side env vars the handler reads, then runs it with a tiny res shim.
  const devOverseerPlugin = {
    name: "dev-api-overseer-run",
    configureServer(server) {
      server.middlewares.use("/api/overseer-run", (req, res) => {
        for (const k of ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "OVERSEER_USER_ID", "CRON_SECRET"]) {
          if (!process.env[k] && env[k]) process.env[k] = env[k];
        }
        const shim = {
          statusCode: 200,
          status(c) { this.statusCode = c; return this; },
          json(o) { res.statusCode = this.statusCode; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
          end() { res.end(); },
        };
        import("./api/overseer-run.js")
          .then((m) => m.default({ headers: req.headers, url: req.url, method: req.method }, shim))
          .catch((e) => { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: e.message })); });
      });
    },
  };

  // Dev-only stand-in for api/inbox-sync.js (AI Inbox Gmail poller). Maps the
  // VITE_ Supabase vars to the server-side names the handler reads, then runs it.
  const devInboxSyncPlugin = {
    name: "dev-api-inbox-sync",
    configureServer(server) {
      server.middlewares.use("/api/inbox-sync", (req, res) => {
        if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
        if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
        for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_QUERY", "CRON_SECRET", "INBOX_USER_ID", "OVERSEER_USER_ID"]) {
          if (!process.env[k] && env[k]) process.env[k] = env[k];
        }
        const shim = {
          statusCode: 200,
          status(c) { this.statusCode = c; return this; },
          json(o) { res.statusCode = this.statusCode; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
          end() { res.end(); },
        };
        import("./api/inbox-sync.js")
          .then((m) => m.default({ headers: req.headers, url: req.url, method: req.method }, shim))
          .catch((e) => { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: e.message })); });
      });
    },
  };

  // Dev-only stand-in for api/inbox-send.js (AI Inbox — send a Gmail reply).
  // Buffers the POST body since the handler reads it via parseBody.
  const devInboxSendPlugin = {
    name: "dev-api-inbox-send",
    configureServer(server) {
      server.middlewares.use("/api/inbox-send", (req, res) => {
        if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
        if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
        for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_QUERY"]) {
          if (!process.env[k] && env[k]) process.env[k] = env[k];
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const shim = {
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json(o) { res.statusCode = this.statusCode; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
            end() { res.end(); },
          };
          import("./api/inbox-send.js")
            .then((m) => m.default({ headers: req.headers, url: req.url, method: req.method, body }, shim))
            .catch((e) => { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: e.message })); });
        });
      });
    },
  };

  // Dev-only stand-in for api/inbox-read.js (AI Inbox — mark a message read).
  const devInboxReadPlugin = {
    name: "dev-api-inbox-read",
    configureServer(server) {
      server.middlewares.use("/api/inbox-read", (req, res) => {
        if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
        if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
        for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_QUERY"]) {
          if (!process.env[k] && env[k]) process.env[k] = env[k];
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const shim = {
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json(o) { res.statusCode = this.statusCode; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
            end() { res.end(); },
          };
          import("./api/inbox-read.js")
            .then((m) => m.default({ headers: req.headers, url: req.url, method: req.method, body }, shim))
            .catch((e) => { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: e.message })); });
        });
      });
    },
  };

  // Dev-only: turn the Aulë coding agent on/off from the Command Center. The
  // browser can't spawn a process, but the Vite dev server (Node, on the Mac)
  // can — so this starts `npm run agents` as a detached child. Not present in
  // production (the deployed app has no local machine to run Claude Code on).
  const AULE_PORT_N = Number(env.AULE_PORT) || 8787;
  let auleChild = null;
  const portOpen = (port) => new Promise((res) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); res(true); });
    s.on("error", () => res(false));
    s.setTimeout(600, () => { s.destroy(); res(false); });
  });
  const devAuleControlPlugin = {
    name: "dev-api-aule-control",
    configureServer(server) {
      server.middlewares.use("/api/aule-control", (req, res) => {
        const json = (c, o) => { res.statusCode = c; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const running = await portOpen(AULE_PORT_N);
          if (req.method === "GET") return json(200, { running, port: AULE_PORT_N });
          if (req.method !== "POST") return json(405, { error: "method not allowed" });
          let action = "start";
          try { action = JSON.parse(body || "{}").action || "start"; } catch { /* default */ }
          if (action === "stop") {
            if (auleChild) { try { process.kill(-auleChild.pid); } catch { try { auleChild.kill(); } catch { /* gone */ } } auleChild = null; }
            return json(200, { stopped: true });
          }
          if (running) return json(200, { running: true, alreadyRunning: true });
          if (!env.AULE_TOKEN) return json(200, { error: "no_token", message: "Add AULE_TOKEN to .env, then try again." });
          try {
            auleChild = spawn("npm", ["run", "agents"], { cwd: process.cwd(), detached: true, stdio: "ignore", env: { ...process.env } });
            auleChild.unref();
            return json(200, { started: true });
          } catch (e) { return json(500, { error: e.message }); }
        });
      });
    },
  };

  return {
    plugins: [react(), devFetchPlugin, devUsagePlugin, devBrainPlugin, devOverseerPlugin, devInboxSyncPlugin, devInboxSendPlugin, devInboxReadPlugin, devAuleControlPlugin],
    build: {
      outDir: "dist",
    },
    server: {
      proxy: {
        "/api/briefing": anthropicProxy,
        "/api/chat": anthropicProxy,
      },
    },
  };
});

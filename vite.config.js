import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

  return {
    plugins: [react(), devFetchPlugin, devUsagePlugin, devBrainPlugin],
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

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

  return {
    plugins: [react(), devFetchPlugin],
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

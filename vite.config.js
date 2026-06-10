import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    build: {
      outDir: "dist",
    },
    server: {
      proxy: {
        "/api/briefing": {
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
        },
        "/api/chat": {
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
        },
      },
    },
  };
});

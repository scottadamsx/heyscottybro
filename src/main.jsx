import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import "./pages/home.css"; // front-facing design system (loads after index.css to override)
import "./styles/admin-executive.css"; // minimal executive skin for /admin (loads last)
import "./styles/features.css"; // documents · nutrition · recipes (loads after admin theme)
import "./styles/print.css"; // print layer — @media print only

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY"];
const missing = REQUIRED_ENV.filter((k) => !import.meta.env[k]);
if (missing.length > 0) {
  document.body.innerHTML = `<pre style="color:var(--red);padding:2rem;font-family:monospace">Missing required environment variables:\n\n${missing.join("\n")}\n\nCheck your .env file.</pre>`;
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {/* reducedMotion="user" → respects prefers-reduced-motion app-wide */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

// PWA: register the service worker (prod only — dev HMR and SW caching fight).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import "./index.css";
import "./pages/home.css"; // front-facing design system (loads after index.css to override)
import "./styles/admin-executive.css"; // minimal executive skin for /admin (loads last)
import "./styles/features.css"; // documents · nutrition · recipes (loads after admin theme)

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* reducedMotion="user" → respects prefers-reduced-motion app-wide */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>
);

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { configureOrbit } from "../../../orbit/src/lib/runtime.js";
import { OrbitProvider } from "../../../orbit/src/state/OrbitContext.jsx";
import { DerivedProvider } from "../../../orbit/src/state/useDerived.js";
import { UIProvider } from "../../../orbit/src/state/UIContext.jsx";
import OrbitApp from "../../../orbit/src/pages/App.jsx";
import orbitCss from "../../../orbit/src/globals.css?inline";
import hostCss from "./people-orbit.css?inline";
import { getAuthHeaders } from "../../utils/supabase";
import "./people.css";

/**
 * PEOPLE — Orbit, the personal CRM, as a heyScottyBro space (DR-017).
 *
 * Orbit is its own app (orbit/, copied from the Orbit repo). It runs here in a shadow root, so its
 * stylesheet and the admin's never touch each other. people-orbit.css re-points its tokens at
 * this design. It has its own router under /admin/people (person and event drawers are deep
 * links). Its data comes from /api/orbit with the signed-in session. The local Orbit app reads
 * the same Supabase rows.
 */

// Orbit's stylesheet was written for a whole page; inside a shadow root the page is the host.
const scopeOrbitCss = (css) => css.replace(/:root/g, ":host").replace(/(^|\n)html,\s*\nbody\s*\{/g, "$1:host {");

export default function PeoplePage() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${scopeOrbitCss(orbitCss)}\n${hostCss}`;
    const mount = document.createElement("div");
    shadow.replaceChildren(style, mount);

    configureOrbit({ apiBase: "/api/orbit", headers: getAuthHeaders, embedded: true, title: "People" });
    const root = createRoot(mount);
    root.render(
      <BrowserRouter basename="/admin/people" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <OrbitProvider>
          <DerivedProvider>
            <UIProvider>
              <Routes>
                <Route path="*" element={<OrbitApp />} />
              </Routes>
            </UIProvider>
          </DerivedProvider>
        </OrbitProvider>
      </BrowserRouter>,
    );
    // Unmount after this commit finishes; React refuses a synchronous unmount mid-render.
    return () => setTimeout(() => root.unmount(), 0);
  }, []);

  return <div ref={hostRef} className="people-host" />;
}

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The shell's slide-in detail panel (Muse-UI rewrite, Phase 1).
 * Any page can open it with { title, content }; the layout renders the host
 * and owns the mechanics (Esc, focus, mutual exclusion with Frodo's dock).
 * The panel holds no form state of its own, so closing it loses nothing.
 */
const DetailPanelContext = createContext(null);

export function DetailPanelProvider({ children }) {
  const [panel, setPanel] = useState(null);
  const openPanel = useCallback((next) => setPanel(next), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const value = useMemo(
    () => ({ panel, openPanel, closePanel }),
    [panel, openPanel, closePanel]
  );
  return <DetailPanelContext.Provider value={value}>{children}</DetailPanelContext.Provider>;
}

export function useDetailPanel() {
  const ctx = useContext(DetailPanelContext);
  if (!ctx) throw new Error("useDetailPanel must be used inside DetailPanelProvider");
  return ctx;
}

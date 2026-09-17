import { useCallback, useEffect, useState } from "react";
import * as api from "../../api/healthApi";
import { onDataChange } from "../../utils/dataEvents";
import { toDateStr } from "../../utils/dates";

/**
 * Everything the Health space shows, loaded together and refreshed on any Health write.
 * A failed load is an error state (QF-3), never an empty screen.
 */
export function useHealthData() {
  const [state, setState] = useState({ status: "loading", error: null });

  const load = useCallback(async () => {
    try {
      const profile = await api.loadProfile();
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const [weights, food, plans, sessions, history] = await Promise.all([
        api.loadWeights(profile.id),
        api.loadFood(profile.id, { from: toDateStr(since) }),
        api.loadPlans(),
        api.loadSessions(),
        api.loadHistory(),
      ]);
      setState({
        status: "ready",
        error: null,
        profile, weights, food, plans, sessions, history,
        openSession: sessions.find((s) => !s.endedAt) || null,
      });
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
    return onDataChange("health", load);
  }, [load]);

  return { ...state, reload: load };
}

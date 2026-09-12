import { useState } from "react";
import { THEMES, useTheme, setTheme } from "../../utils/theme";
import { Link } from "react-router-dom";
import { HIDE_SMOKE_TRACKER, useSetting, setSetting, useHiddenPages, toggleHiddenPage } from "../../utils/settings";
import { NAV_ITEMS } from "./AdminLayout";
import { clearAgentSession } from "../../api/agentSessionsApi";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";

// The chat-backed agents (agent_sessions rows) — "aule" runs locally in a
// terminal and has no session to clear.
const CHAT_AGENT_IDS = ["frodo", "elrond", "bilbo", "luthien", "banker"];

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-knob" />
    </button>
  );
}

export default function SettingsPage() {
  const theme = useTheme();
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
  const hiddenPages = useHiddenPages();
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [clearingChat, setClearingChat] = useState(false);

  const clearAllChatHistory = async () => {
    if (!await confirm("Clear every AI chat thread (Frodo, Bilbo, Elrond, Lúthien, Griphook)? This only removes the conversations — your data, habits, tasks, and everything else is untouched.", { title: "Clear chat history", confirmLabel: "Clear" })) return;
    setClearingChat(true);
    const results = await Promise.allSettled(CHAT_AGENT_IDS.map((id) => clearAgentSession(id)));
    setClearingChat(false);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) addToast(`Cleared ${results.length - failed.length} of ${results.length} — ${failed[0].reason?.message || "one or more failed"}`, "error");
    else addToast("All chat history cleared.", "success");
  };

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Settings</h1>
      </div>

      <div className="db-card">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-eye-slash" /> Hidden pages
            </div>
            <div className="settings-row-meta">
              Remove any space from the sidebar, menus, and command palette — handy
              when showing the dashboard to someone else. Nothing is deleted; a
              hidden page still opens if you go to it directly.
            </div>
          </div>
        </div>
        <div className="settings-page-list">
          {NAV_ITEMS.map((item) => (
            <div className="settings-row settings-row-compact" key={item.to}>
              <div className="settings-row-body">
                <div className="settings-row-title"><i className={`fa-solid ${item.icon}`} /> {item.label}</div>
              </div>
              <Toggle
                checked={hiddenPages.includes(item.to)}
                onChange={(v) => toggleHiddenPage(item.to, v)}
                label={`Hide ${item.label}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="db-card">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-leaf" /> Hide Smoke Tracker
            </div>
            <div className="settings-row-meta">
              Removes Smoke Tracker from the sidebar, menus, and command palette —
              handy when showing the dashboard to someone else. Your data is kept.
            </div>
          </div>
          <Toggle
            checked={hideSmoke}
            onChange={(v) => setSetting(HIDE_SMOKE_TRACKER, v)}
            label="Hide Smoke Tracker"
          />
        </div>
      </div>

      <div className="db-card">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-comment-slash" /> Clear AI chat history
            </div>
            <div className="settings-row-meta">
              Wipes every agent's conversation thread (Frodo, Bilbo, Elrond, Lúthien,
              Griphook) — a clean slate if a thread's gotten long, confused, or
              stale. Your saved context, habits, tasks, and everything else stay put.
            </div>
          </div>
          <button className="btn btn-sm btn-secondary-sm" onClick={clearAllChatHistory} disabled={clearingChat}>
            {clearingChat ? "Clearing…" : "Clear all"}
          </button>
        </div>
      </div>

      <div className="db-card">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-circle-half-stroke" /> Theme
            </div>
            <div className="settings-row-meta">
              Light is the default. Dark follows the same layout; Windows XP is the full Luna treatment.
              Saved on this device and applied instantly.
            </div>
          </div>
          <div className="theme-picker" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                className={`theme-picker-opt${theme === t.id ? " active" : ""}`}
                onClick={() => setTheme(t.id)}
                title={t.hint}
              >
                <i className={t.icon} /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-swatchbook" /> Appearance
            </div>
            <div className="settings-row-meta">
              The design system — themes, tokens, and the component gallery. Moved out of the
              main nav; it's a workshop, not a daily destination.
            </div>
          </div>
          <Link className="btn btn-sm btn-secondary-sm" to="/admin/design">
            Open Design <i className="fa-solid fa-arrow-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}

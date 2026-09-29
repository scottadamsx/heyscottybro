import { useState } from "react";
import { THEMES, useTheme, setTheme } from "../../utils/theme";
import { useHiddenPages, toggleHiddenPage } from "../../utils/settings";
import { NAV_ITEMS } from "./AdminLayout";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { useAgentRuntime } from "../../contexts/AgentRuntimeContext";
import { API_AGENTS } from "../../agents/registry";
import { captureEstablishedOwnerId } from "../../utils/authIdentityBoundary";
import {
  cancelOwnerBoundBankerClear,
  clearOwnerBoundBankerSession,
  prepareOwnerBoundBankerClear,
} from "../../utils/bankerSessionPolicy";
import {
  clearAllAIChatHistory,
  GLOBAL_CHAT_CLEAR_CONFIRMATION,
  GLOBAL_CHAT_CLEAR_SUCCESS,
} from "../../utils/globalChatHistory";

// Aulë runs in a local terminal and is intentionally not an app chat session.
const COMMAND_CENTER_AGENT_IDS = API_AGENTS.map(({ id }) => id);

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
  const hiddenPages = useHiddenPages();
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const { prepareAllThreadClear, clearAllThreads } = useAgentRuntime();
  const [clearingChat, setClearingChat] = useState(false);

  const clearAllChatHistory = async () => {
    if (!await confirm(GLOBAL_CHAT_CLEAR_CONFIRMATION, { title: "Clear this account's chat history", confirmLabel: "Clear" })) return;
    setClearingChat(true);
    try {
      const ownerId = captureEstablishedOwnerId();
      const result = await clearAllAIChatHistory({
        prepareBankerClear: () => prepareOwnerBoundBankerClear(ownerId),
        cancelBankerClear: cancelOwnerBoundBankerClear,
        prepareCommandCenterClear: () => prepareAllThreadClear(COMMAND_CENTER_AGENT_IDS, ownerId),
        clearCommandCenter: clearAllThreads,
        clearBanker: (preparation) => clearOwnerBoundBankerSession(sessionStorage, ownerId, preparation),
      });
      if (result.failures.length) {
        const first = result.failures[0];
        addToast(`Some chat history could not be cleared. ${first.label}: ${first.error?.message || first.error}`, "error");
      } else if (result.warnings.length) {
        const first = result.warnings[0];
        addToast(`Chat history cleared, but cleanup needs a retry. ${first.label}: ${first.error?.message || first.error}`, "error");
      } else {
        addToast(GLOBAL_CHAT_CLEAR_SUCCESS, "success");
      }
    } catch (error) {
      addToast(error?.message || "Chat history could not be cleared.", "error");
    } finally {
      setClearingChat(false);
    }
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
              <i className="fa-solid fa-circle-half-stroke" /> Appearance
            </div>
            <div className="settings-row-meta">
              Light is the default. Automatic follows your device and switches with it.
              Saved on this device and applied instantly.
            </div>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Appearance">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                className={`segmented-opt${theme === t.id ? " active" : ""}`}
                onClick={() => setTheme(t.id)}
              >
                <i className={t.icon} aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>
        </div>
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
              <i className="fa-solid fa-comment-slash" /> Clear AI chat history
            </div>
            <div className="settings-row-meta">
              Clears this account's Frodo, Command Center, and Griphook chats plus
              Frodo's staged screenshots. Quarantined older backups without account
              ownership stay untouched for explicit recovery. Aulë's local terminal
              session and your saved context, habits, tasks, and other data stay put.
            </div>
          </div>
          <button className="btn btn-sm btn-secondary-sm" onClick={clearAllChatHistory} disabled={clearingChat} aria-busy={clearingChat || undefined}>
            {clearingChat ? "Clearing…" : "Clear all"}
          </button>
        </div>
      </div>

    </div>
  );
}

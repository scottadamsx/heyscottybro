import { useState } from "react";
import GradeTracker from "./GradeTracker";
import GymTracker from "./GymTracker";
import "./tools.css";

/**
 * AI Tools hub — a card grid of small, self-contained mini-apps that share a
 * common shell. Each lives permanently in the app, reads/writes the user's
 * Supabase data, and can call the AI proxy. Adding a tool is one entry in TOOLS
 * + a component — that's the whole framework.
 */
const TOOLS = [
  {
    id: "grades", name: "Grade Tracker", icon: "fa-graduation-cap", color: "#6366f1",
    blurb: "Track weighted grades, see your projected final, and turn instructor feedback into an AI catch-up plan that drops study tasks into your reminders.",
    Component: GradeTracker,
  },
  {
    id: "gym", name: "Gym Tracker", icon: "fa-dumbbell", color: "#f59e0b",
    blurb: "Log sets, watch your PRs and estimated 1-rep-max, and see per-exercise progression at a glance.",
    Component: GymTracker,
  },
];

export default function AiToolsHub() {
  const [openId, setOpenId] = useState(null);
  const tool = TOOLS.find((t) => t.id === openId);

  if (tool) {
    const C = tool.Component;
    return (
      <div className="tools-shell">
        <div className="tools-shell-head">
          <button className="btn btn-sm" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setOpenId(null)}>
            <i className="fa-solid fa-arrow-left" /> Tools
          </button>
          <h2 className="tools-shell-title"><i className={`fa-solid ${tool.icon}`} style={{ color: tool.color }} /> {tool.name}</h2>
        </div>
        <C />
      </div>
    );
  }

  return (
    <div>
      <p className="tools-hub-intro">Small AI-powered tools that live in your app and work with your data.</p>
      <div className="tools-hub">
        {TOOLS.map((t) => (
          <button key={t.id} className="tools-card" style={{ "--tool": t.color }} onClick={() => setOpenId(t.id)}>
            <span className="tools-card-icon" style={{ background: t.color }}><i className={`fa-solid ${t.icon}`} /></span>
            <span className="tools-card-name">{t.name}</span>
            <span className="tools-card-blurb">{t.blurb}</span>
            <span className="tools-card-open">Open <i className="fa-solid fa-arrow-right" /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

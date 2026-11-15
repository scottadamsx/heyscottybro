// Projects tab home, Dashboard view (design-reference 3.1): StatTiles from
// the rollup, a Needs attention list, a clearly labelled Suggested panel,
// and the enriched project card grid.
import { useState } from "react";
import { StatTile, Badge } from "../../../components/ui";
import { formatDisplayDate } from "../../../utils/plannerUtils";
import {
  ProgressBar, StageDot, StatusDot, dashboardData, getStatus, isOverdue,
  stageLabel, statsFor, suggestionsFor,
} from "./shared.jsx";

const DISMISS_KEY = "hsb.suggestionDismissals";
const readDismissals = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); }
  catch { return new Set(); }
};

export default function Dashboard({
  projects, tasks, milestones = [],
  onOpenProject, onOpenTask, onEditProject, onArchiveProject, onNewTaskForProject,
}) {
  const [dismissed, setDismissed] = useState(readDismissals);
  const data = dashboardData(projects, tasks);
  const suggestions = suggestionsFor(projects, tasks, milestones).filter((s) => !dismissed.has(s.id));
  const projectById = (id) => projects.find((p) => String(p.id) === String(id));

  const dismiss = (s) => {
    const next = new Set(dismissed); next.add(s.id); setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
  };

  const accept = (s) => {
    if (s.type === "no_next_task") {
      if (s.project) onNewTaskForProject?.(s.project);
      return;
    }
    if (s.task) { onOpenTask?.(s.task); return; }
    if (s.project) { onOpenProject?.(s.project.id); }
  };

  return (
    <div className="p2-dashboard">
      <div className="p2-stats" role="group" aria-label="Project totals">
        <StatTile label="Active projects" value={data.activeProjects} />
        <StatTile label="Due today" value={data.dueToday} tone={data.dueToday ? "warn" : "default"} />
        <StatTile label="Overdue" value={data.overdue} tone={data.overdue ? "bad" : "default"} />
        <StatTile label="Blocked" value={data.blocked} tone={data.blocked ? "bad" : "default"} />
        <StatTile label="Due this week" value={data.dueThisWeek} />
        <StatTile label="Stalled" value={data.stalled} tone={data.stalled ? "warn" : "default"} />
        <StatTile label="Recently completed" value={data.recentlyCompleted} tone="good" />
      </div>

      <div className="db-grid p2-dash-grid">
        <section className="db-card p2-span-7" aria-label="Needs attention">
          <div className="db-card-header">
            <h3 className="db-card-title">Needs attention ({data.attention.length})</h3>
          </div>
          {data.attention.length === 0 && <p className="no-entries">Nothing overdue or blocked.</p>}
          <div className="db-list plan-list">
            {data.attention.map((t) => {
              const project = projectById(t.project_id);
              const blocked = getStatus(t) === "blocked";
              return (
                <button
                  key={t.id}
                  type="button"
                  className="db-list-item p2-attention-row"
                  onClick={() => onOpenTask?.(t)}
                >
                  <StatusDot status={blocked ? "blocked" : "backlog"} label={blocked ? "Blocked" : "Overdue"} />
                  <span className="db-list-item-content">
                    <span className="db-list-item-title">{t.name}</span>
                    <span className="db-list-item-subtitle">
                      {project ? project.name : "No project"}
                      {t.date ? ` · ${formatDisplayDate(t.date)}` : ""}
                      {isOverdue(t) && !blocked ? " · Overdue" : ""}
                    </span>
                  </span>
                  <i className="fa-solid fa-chevron-right project-tile-chevron" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="db-card p2-span-5" aria-label="Suggested next steps">
          <div className="db-card-header">
            <h3 className="db-card-title">Suggested ({suggestions.length})</h3>
          </div>
          <p className="project-card-desc">Suggested from overdue, blocked, stalled and next-task checks. Nothing here runs on its own.</p>
          {suggestions.length === 0 && <p className="no-entries">No suggestions right now.</p>}
          <div className="db-list plan-list">
            {suggestions.map((s) => (
              <div className="db-list-item" key={s.id}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{s.text}</div>
                  <div className="db-list-item-subtitle">
                    Suggested · {s.type.replace(/_/g, " ")}
                    {s.project ? ` · ${s.project.name}` : ""}
                  </div>
                </div>
                <button type="button" className="btn-mini" onClick={() => accept(s)}>Accept</button>
                <button type="button" className="btn-mini" onClick={() => dismiss(s)}>Dismiss</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="All projects">
        <div className="db-card-header">
          <h3 className="db-card-title">All projects ({projects.length})</h3>
        </div>
        {projects.length === 0 && <p className="no-entries">No projects match the current filters.</p>}
        <div className="projects-grid">
          {projects.map((p) => {
            const stats = statsFor(p, tasks);
            return (
              <article key={p.id} className="project-tile p2-project-card">
                <div className="p2-project-card-main">
                  <button type="button" className="p2-project-open" onClick={() => onOpenProject?.(p.id)}>
                    <span className="project-tile-dot" style={{ background: p.color }} aria-hidden="true" />
                    <span className="project-tile-name">{p.name}</span>
                    <i className="fa-solid fa-chevron-right project-tile-chevron" aria-hidden="true" />
                  </button>
                  {p.description && <p className="p2-project-desc">{p.description}</p>}
                  <ProgressBar value={stats.progress} label={`${p.name} progress`} />
                  <div className="p2-project-meta">
                    <span className="p2-mono">{stats.done} of {stats.total} done · {stats.open} open</span>
                    <StageDot stage={p.stage || "idea"} label={stageLabel(p)} />
                    {p.due_date && <span>{formatDisplayDate(p.due_date)}</span>}
                    {p.archived && <StatusDot status="backlog" label="Archived" />}
                    {stats.stalled && <StatusDot status="blocked" label="Stalled" />}
                  </div>
                  {(stats.overdue > 0 || stats.blocked > 0) && (
                    <div className="p2-project-badges">
                      {stats.overdue > 0 && <Badge tone="bad">{stats.overdue} overdue</Badge>}
                      {stats.blocked > 0 && <Badge tone="bad">{stats.blocked} blocked</Badge>}
                    </div>
                  )}
                  <div className="p2-project-actions">
                    <button type="button" className="btn-mini" onClick={() => onOpenProject?.(p.id)}>Open</button>
                    <button type="button" className="btn-mini" onClick={() => onEditProject?.(p)}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                    <button type="button" className="btn-mini" onClick={() => onArchiveProject?.(p)}>
                      {p.archived ? "Unarchive" : "Archive"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

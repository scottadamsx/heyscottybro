// Lifecycle pipeline: the Kanban board in stage mode. A drag (or the
// card's Move-to select) writes the project's stage only; the shell handler
// logs the stage change to the project's Updates feed.
import KanbanBoard from "./KanbanBoard.jsx";

export default function Pipeline({ projects, tasks, onOpenProject, onMoveProject }) {
  return (
    <KanbanBoard
      mode="stages"
      projects={projects}
      tasks={tasks}
      onOpenProject={onOpenProject}
      onMoveProject={onMoveProject}
    />
  );
}

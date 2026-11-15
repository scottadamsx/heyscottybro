// Pure helpers for the project delete flow (Projects 2.0).
//
// plannerApi.deleteProject removes a project, every sub-project under it
// (any depth) and every task attached to any of them, because the FK is
// ON DELETE SET NULL and would otherwise orphan the tasks. The page needs
// the same tree computed against its local list state so a confirmed
// delete can update the UI immediately (and roll back on failure) instead
// of waiting for a full reload. Keep the traversal in step with
// descendantIds in src/api/plannerApi.js.

/** The project plus every sub-project under it (any depth), root first. */
export function projectTreeIds(projects, rootId) {
  const ids = [String(rootId)];
  for (let i = 0; i < ids.length; i++) {
    for (const p of projects || []) {
      if (p?.parent_id != null && String(p.parent_id) === ids[i] && !ids.includes(String(p.id))) {
        ids.push(String(p.id));
      }
    }
  }
  return ids;
}

/**
 * Remove a project tree from local list state. Pure: returns new arrays,
 * inputs untouched. Tasks attached to any removed project go with it;
 * tasks with no project or another project stay.
 */
export function removeProjectTree(projects, tasks, rootId) {
  const ids = projectTreeIds(projects, rootId);
  const gone = new Set(ids);
  return {
    projects: (projects || []).filter((p) => !gone.has(String(p.id))),
    tasks: (tasks || []).filter((t) => t?.project_id == null || !gone.has(String(t.project_id))),
    removedIds: ids,
  };
}

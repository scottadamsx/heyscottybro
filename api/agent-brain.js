import { parseBody } from "./_utils.js";
import { sbConfigured, sbSelect, sbUpsert } from "./_supabase.js";
import { requireAgent } from "./_agentAuth.js";

const enc = encodeURIComponent;
const clean = (value, max = 20000) => String(value ?? "").trim().slice(0, max);
const list = (value, max = 20) => Array.isArray(value) ? value.map((v) => clean(v, 120)).filter(Boolean).slice(0, max) : [];
const validSlug = (value) => /^[a-z0-9][a-z0-9_-]{1,119}$/i.test(String(value || ""));

function bodyProjectId(body) {
  const id = clean(body?.project_id || body?.projectId, 100);
  return id || null;
}

async function getProjectContext(ownerId, projectId, q = "") {
  const owner = enc(ownerId);
  const brainFilter = q
    ? `&or=(title.ilike.*${enc(q)}*,body.ilike.*${enc(q)}*,tags.cs.{${enc(q)}})`
    : "";

  const [brain, context, projects, activity] = await Promise.all([
    sbSelect("brain_nodes", `user_id=eq.${owner}&select=id,slug,title,body,type,tags,source,created_at,updated_at${brainFilter}&order=updated_at.desc&limit=100`),
    sbSelect("context_entries", `user_id=eq.${owner}&select=id,text,tags,by,why,ts,created_at&order=created_at.desc&limit=100`),
    projectId
      ? sbSelect("projects", `user_id=eq.${owner}&id=eq.${enc(projectId)}&select=*&limit=1`)
      : sbSelect("projects", `user_id=eq.${owner}&select=*&order=created_at.asc&limit=100`),
    projectId
      ? sbSelect("agent_actions", `user_id=eq.${owner}&project_id=eq.${enc(projectId)}&select=*&order=created_at.desc&limit=100`)
      : sbSelect("agent_actions", `user_id=eq.${owner}&select=*&order=created_at.desc&limit=50`),
  ]);

  let tasks = [];
  let initiatives = [];
  if (projectId) {
    [tasks, initiatives] = await Promise.all([
      sbSelect("reminders", `user_id=eq.${owner}&project_id=eq.${enc(projectId)}&select=*&order=completed.asc,date.asc.nullslast&limit=200`),
      sbSelect("initiatives", `user_id=eq.${owner}&project_id=eq.${enc(projectId)}&select=*&limit=100`),
    ]);
  }

  return {
    brain,
    context,
    project: projectId ? (projects[0] || null) : null,
    projects: projectId ? undefined : projects,
    tasks,
    initiatives,
    recent_activity: activity,
  };
}

async function logAction({ ownerId, agentId, body, status = "ok", itemId = null, error = null }) {
  const row = {
    user_id: ownerId,
    tier: agentId,
    tool: clean(body.event_type || body.action || "agent_update", 80),
    collection: clean(body.collection || (bodyProjectId(body) ? "projects" : "brain"), 80) || null,
    item_id: itemId ? String(itemId) : null,
    args: {
      summary: clean(body.summary, 2000),
      details: body.details ?? null,
      files_changed: list(body.files_changed, 100),
      blockers: Array.isArray(body.blockers) ? body.blockers : body.blockers ? [clean(body.blockers, 2000)] : [],
      next_step: clean(body.next_step, 2000),
      goal_alignment: clean(body.goal_alignment, 4000),
      task_id: clean(body.task_id, 120) || null,
      parent_task_id: clean(body.parent_task_id, 120) || null,
      milestone_id: clean(body.milestone_id, 120) || null,
      goal_id: clean(body.goal_id, 120) || null,
      work_session_id: clean(body.work_session_id, 120) || null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    },
    status,
    error,
    project_id: bodyProjectId(body),
    task_id: clean(body.task_id, 120) || null,
    parent_task_id: clean(body.parent_task_id, 120) || null,
    work_session_id: clean(body.work_session_id, 120) || null,
    event_type: clean(body.event_type || body.action || "agent_update", 80),
    summary: clean(body.summary, 2000) || null,
    goal_alignment: clean(body.goal_alignment, 4000) || null,
    next_step: clean(body.next_step, 2000) || null,
    blockers: Array.isArray(body.blockers) ? body.blockers : body.blockers ? [clean(body.blockers, 2000)] : [],
    details: body.details && typeof body.details === "object" ? body.details : {},
  };
  const rows = await sbUpsert("agent_actions", [row]);
  return rows[0] || row;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!sbConfigured()) return res.status(503).json({ error: "Supabase is not configured" });

  const agent = requireAgent(req, res);
  if (!agent) return;

  try {
    if (req.method === "GET") {
      const projectId = clean(req.query?.project_id || req.query?.projectId, 100) || null;
      const q = clean(req.query?.q, 100);
      const data = await getProjectContext(agent.ownerId, projectId, q);
      return res.status(200).json({ agent: agent.id, owner_id: agent.ownerId, ...data });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = parseBody(req) || {};
    const action = clean(body.action, 80);

    if (action === "upsert_node") {
      if (!validSlug(body.slug)) return res.status(400).json({ error: "slug must be 2-120 letters, numbers, _ or -" });
      const title = clean(body.title, 300);
      if (!title) return res.status(400).json({ error: "title is required" });
      const rows = await sbUpsert("brain_nodes", [{
        user_id: agent.ownerId,
        slug: clean(body.slug, 120),
        title,
        body: clean(body.body, 50000),
        type: clean(body.type || "note", 80),
        tags: list(body.tags, 30),
        source: agent.id,
        updated_at: new Date().toISOString(),
      }], "user_id,slug");
      const node = rows[0];
      await logAction({ ownerId: agent.ownerId, agentId: agent.id, body: { ...body, summary: body.summary || `Updated brain note: ${title}`, collection: "brain", event_type: "brain_updated" }, itemId: node?.id || body.slug });
      return res.status(200).json({ ok: true, agent: agent.id, node });
    }

    if (action === "link_nodes") {
      if (!validSlug(body.source_slug) || !validSlug(body.target_slug) || body.source_slug === body.target_slug) {
        return res.status(400).json({ error: "valid, different source_slug and target_slug are required" });
      }
      const rows = await sbUpsert("brain_links", [{
        user_id: agent.ownerId,
        source_slug: clean(body.source_slug, 120),
        target_slug: clean(body.target_slug, 120),
      }], "user_id,source_slug,target_slug");
      await logAction({ ownerId: agent.ownerId, agentId: agent.id, body: { ...body, summary: body.summary || `Linked ${body.source_slug} to ${body.target_slug}`, collection: "brain", event_type: "brain_linked" } });
      return res.status(200).json({ ok: true, agent: agent.id, link: rows[0] || null });
    }

    if (action === "save_context") {
      const text = clean(body.text, 10000);
      if (!text) return res.status(400).json({ error: "text is required" });
      const rows = await sbUpsert("context_entries", [{
        user_id: agent.ownerId,
        text,
        tags: list(body.tags, 30),
        by: agent.id,
        why: clean(body.why || "saved by external agent", 1000),
        ts: Date.now(),
      }]);
      const entry = rows[0];
      await logAction({ ownerId: agent.ownerId, agentId: agent.id, body: { ...body, summary: body.summary || `Saved durable context: ${text.slice(0, 120)}`, collection: "context", event_type: "context_saved" }, itemId: entry?.id });
      return res.status(201).json({ ok: true, agent: agent.id, entry });
    }

    if (action === "activity" || action === "task_started" || action === "task_progress" || action === "task_completed" || action === "blocker_found" || action === "decision_made" || action === "file_changed" || action === "agent_error") {
      if (!bodyProjectId(body)) return res.status(400).json({ error: "project_id is required for activity" });
      if (!clean(body.summary, 2000)) return res.status(400).json({ error: "summary is required for activity" });
      if (action === "task_completed" && !clean(body.goal_alignment, 4000)) {
        return res.status(400).json({ error: "goal_alignment is required when completing a task" });
      }
      const activity = await logAction({
        ownerId: agent.ownerId,
        agentId: agent.id,
        body: { ...body, event_type: body.event_type || action },
        status: action === "agent_error" ? "error" : "ok",
        error: action === "agent_error" ? clean(body.error || body.summary, 4000) : null,
      });
      return res.status(201).json({ ok: true, agent: agent.id, activity });
    }

    return res.status(400).json({ error: "Unknown action", supported_actions: ["upsert_node", "link_nodes", "save_context", "activity", "task_started", "task_progress", "task_completed", "blocker_found", "decision_made", "file_changed", "agent_error"] });
  } catch (err) {
    console.error("[agent-brain]", err);
    return res.status(500).json({ error: err?.message || "Agent API failed" });
  }
}

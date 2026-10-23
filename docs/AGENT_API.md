# heyscottybro Agent API

`heyscottybro` is the source of truth. External Claude/AI workers authenticate as named agents, fetch only the project/Brain context they need, perform work, and write observable results back.

The API intentionally stores **results, decisions, changes, blockers and next steps — never hidden chain-of-thought**.

## Server configuration

Set these only in the deployed server environment:

```bash
HSB_AGENT_OWNER_ID=<Supabase auth user UUID>
HSB_AGENT_KEYS={"project-manager":"<random secret>","mybackyard-admin":"<another random secret>"}
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must also be configured for the serverless API. Do not expose any of these values through a `VITE_` variable.

Apply `supabase/migrations/2026-09-14-agent-project-activity.sql` before enabling external activity writes.

## Authentication

Send one agent's secret on every request:

```http
Authorization: Bearer <agent-secret>
```

`X-Agent-Key` is also supported. The matching key name (for example `project-manager`) is stored as provenance on writes.

## Read context

### All projects + shared Brain

```http
GET /api/agent-brain
Authorization: Bearer <agent-secret>
```

Returns the agent identity, Brain nodes, durable context entries, project list, and recent agent activity.

### One project

```http
GET /api/agent-brain?project_id=<project-uuid>
Authorization: Bearer <agent-secret>
```

Adds the selected project, its tasks/reminders, initiatives and project-scoped agent activity. This is the preferred context call before starting project work.

A `q` query parameter can narrow Brain retrieval by keyword.

## Write to the Brain

### Upsert a durable Brain node

```json
{
  "action": "upsert_node",
  "slug": "faigo-checkout-architecture",
  "title": "Faigo checkout architecture",
  "body": "Durable Markdown knowledge...",
  "type": "note",
  "tags": ["faigo", "checkout"],
  "summary": "Documented the checkout architecture after implementation."
}
```

The API forces `source` to the authenticated agent id; callers cannot spoof provenance.

### Link Brain nodes

```json
{
  "action": "link_nodes",
  "source_slug": "faigo-checkout-architecture",
  "target_slug": "faigo"
}
```

### Save a durable context fact

```json
{
  "action": "save_context",
  "text": "Faigo checkout pricing is calculated server-side before payment begins.",
  "tags": ["faigo", "checkout"],
  "why": "Future agents must preserve the pricing boundary."
}
```

## Report project work

Supported event actions include:

- `task_started`
- `task_progress`
- `file_changed`
- `decision_made`
- `blocker_found`
- `task_completed`
- `agent_error`
- generic `activity` with `event_type`

Example progress report:

```json
{
  "action": "task_progress",
  "project_id": "<project-uuid>",
  "task_id": "checkout-api",
  "work_session_id": "claude-session-123",
  "summary": "Connected checkout to the server-side pricing service and added validation.",
  "details": {
    "result": "Invalid carts now fail before payment initialization."
  },
  "files_changed": ["src/api/checkout.ts", "src/services/pricing.ts"],
  "blockers": [],
  "next_step": "Add the payment provider adapter.",
  "goal_alignment": "This advances the commerce milestone by making generated models safely purchasable."
}
```

A `task_completed` report **must include `goal_alignment`**. The recommended completion shape is:

- what the agent did
- what changed
- result
- files/systems affected
- goal alignment
- remaining blockers/risks
- recommended next step

Those values can be carried in `summary`, `details`, `files_changed`, `goal_alignment`, `blockers`, and `next_step`.

## Agent operating pattern

1. Project Manager calls `GET /api/agent-brain?project_id=...`.
2. It creates/chooses work and passes the project goal lineage to a specialist agent.
3. Specialist posts `task_started` and meaningful `task_progress` events while working.
4. Specialist posts `task_completed` with a plain-English report and goal alignment.
5. Durable discoveries are separately written using `upsert_node` / `save_context`.
6. The next agent pulls fresh context from the same API and sees the updated project record.

This keeps the Projects UI, Project Manager, specialist agents and heyscottybro Brain on one shared data path rather than separate agent memory silos.

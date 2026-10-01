export const ACTIVITY_SCHEMA_VERSION = 1;

const EVENT_TYPES = new Set(["habit.logged", "habit.missed", "chat.turn.sent"]);
const META_KEYS = new Set(["attachment_count", "precision"]);

export function buildActivityEvent({ idempotencyKey, eventType, entityType, entityId = null, entityLabel = null, occurredAt = new Date().toISOString(), source = "app", metadata = {} }) {
  if (!idempotencyKey || typeof idempotencyKey !== "string") throw new Error("Activity needs an idempotency key.");
  if (!EVENT_TYPES.has(eventType)) throw new Error(`Unsupported activity type: ${eventType}`);
  if (!entityType || typeof entityType !== "string") throw new Error("Activity needs an entity type.");
  const safeMetadata = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (!META_KEYS.has(key)) continue;
    if (key === "attachment_count") safeMetadata[key] = Math.max(0, Math.round(Number(value) || 0));
    if (key === "precision" && ["exact", "date_only"].includes(value)) safeMetadata[key] = value;
  }
  const instant = new Date(occurredAt);
  if (Number.isNaN(instant.getTime())) throw new Error("Activity time is invalid.");
  return {
    idempotency_key: idempotencyKey.slice(0, 200),
    event_type: eventType,
    entity_type: String(entityType).slice(0, 80),
    entity_id: entityId == null ? null : String(entityId).slice(0, 200),
    entity_label: entityLabel == null ? null : String(entityLabel).trim().slice(0, 160),
    occurred_at: instant.toISOString(),
    source: String(source).slice(0, 80),
    schema_version: ACTIVITY_SCHEMA_VERSION,
    metadata: safeMetadata,
  };
}

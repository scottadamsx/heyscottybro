const isRecord = (value) => value != null && typeof value === "object" && !Array.isArray(value);

export function isValidDisplayMessage(message, allowedRoles = null) {
  if (!isRecord(message) || typeof message.role !== "string" || !message.role) return false;
  if (allowedRoles && !allowedRoles.includes(message.role)) return false;
  if (message.text != null && typeof message.text !== "string") return false;
  if (message.images != null && !Array.isArray(message.images)) return false;
  if (message.attachments != null
    && (!Array.isArray(message.attachments) || message.attachments.some((item) => !isRecord(item)))) return false;
  return true;
}

export function isValidModelMessage(message) {
  if (!isRecord(message) || !["user", "assistant"].includes(message.role)) return false;
  if (typeof message.content === "string") return true;
  if (!Array.isArray(message.content)) return false;
  return message.content.every((block) => (
    isRecord(block) && typeof block.type === "string" && block.type.length > 0
  ));
}

export function isValidDisplayHistory(messages, allowedRoles = null) {
  return Array.isArray(messages) && messages.every((message) => isValidDisplayMessage(message, allowedRoles));
}

export function isValidModelHistory(messages) {
  return Array.isArray(messages) && messages.every(isValidModelMessage);
}

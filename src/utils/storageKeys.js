const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const SAFE_EXTENSION = /^[a-z0-9]{1,5}$/;

const TYPE_EXTENSIONS = Object.freeze({
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

export const CHAT_STAGING_FOLDER = "_staging";

export function assertStorageSegment(value, label = "storage path segment") {
  const segment = String(value || "");
  if (!SAFE_SEGMENT.test(segment)) throw new Error(`Invalid ${label}.`);
  return segment;
}

export function imageExtension(file = {}) {
  const type = String(file.type || "").toLowerCase();
  if (TYPE_EXTENSIONS[type]) return TYPE_EXTENSIONS[type];

  const name = String(file.name || "");
  const dot = name.lastIndexOf(".");
  const candidate = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return SAFE_EXTENSION.test(candidate) ? candidate : "png";
}

export function imageMediaType(file = {}) {
  const type = String(file.type || "").toLowerCase();
  if (TYPE_EXTENSIONS[type]) return type === "image/jpg" ? "image/jpeg" : type;
  const extension = imageExtension(file);
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return `image/${extension}`;
}

function objectName(file, timestamp, randomId) {
  const stamp = Number(timestamp);
  if (!Number.isSafeInteger(stamp) || stamp < 0) throw new Error("Invalid storage timestamp.");
  const suffix = assertStorageSegment(randomId, "storage random id");
  return `${stamp}-${suffix}.${imageExtension(file)}`;
}

export function chatStagingStoragePath({ userId, file, timestamp, randomId }) {
  const owner = assertStorageSegment(userId, "storage owner id");
  return `${owner}/${CHAT_STAGING_FOLDER}/${objectName(file, timestamp, randomId)}`;
}

export function bugScreenshotStoragePath({ userId, bugId, file, timestamp, randomId }) {
  const owner = assertStorageSegment(userId, "storage owner id");
  const bug = assertStorageSegment(bugId, "bug id");
  return `${owner}/${bug}/${objectName(file, timestamp, randomId)}`;
}

export function fileFromStoragePath(path) {
  const name = String(path || "").split("/").pop() || "screenshot.png";
  return { name, type: imageMediaType({ name }) };
}

export function isOwnedStoragePath(path, userId) {
  const owner = assertStorageSegment(userId, "storage owner id");
  const parts = String(path || "").split("/");
  return parts.length >= 3 && parts[0] === owner && parts.every(Boolean);
}

export function isOwnedChatStagingPath(path, userId) {
  if (!isOwnedStoragePath(path, userId)) return false;
  const parts = String(path).split("/");
  return parts.length === 3 && parts[1] === CHAT_STAGING_FOLDER;
}

export function isChatStagingPath(path) {
  const parts = String(path || "").split("/");
  return parts.length === 3 && SAFE_SEGMENT.test(parts[0]) && parts[1] === CHAT_STAGING_FOLDER && Boolean(parts[2]);
}

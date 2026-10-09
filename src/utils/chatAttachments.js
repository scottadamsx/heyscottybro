import { isChatStagingPath } from "./storageKeys.js";

export const CHAT_ATTACHMENT_VERSION = 1;
export const SUPPORTED_VISION_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isHeicFile(file = {}) {
  return /\.hei[cf]$/i.test(file.name || "") || /^image\/hei[cf]$/i.test(file.type || "");
}

export function undecodableImageMessage(file = {}) {
  const name = file.name || "That image";
  if (isHeicFile(file)) return `${name} couldn't be decoded in this browser. Export it as JPEG or PNG and try again.`;
  return `${name} couldn't be prepared as a supported JPEG, PNG, WebP, or GIF image.`;
}

export function canSendOriginalImage(file = {}) {
  return SUPPORTED_VISION_TYPES.has(String(file.type || "").toLowerCase());
}

export function hasPendingAttachmentWork(shots = [], activeWorkCount = 0) {
  return activeWorkCount > 0 || shots.some((shot) => shot?.uploading);
}

export function canBeginAttachmentSafeClear(shots = [], activeWorkCount = 0) {
  return !hasPendingAttachmentWork(shots, activeWorkCount);
}

export function agentAttachmentIntakePolicy({
  busy = false,
  clearing = false,
  mutationInFlight = false,
  historyReady = true,
} = {}) {
  if (!historyReady) return { allowed: false, message: "Wait for chat history to load before attaching an image." };
  if (clearing) return { allowed: false, message: "Wait for the conversation to finish clearing before attaching an image." };
  if (busy || mutationInFlight) return { allowed: false, message: "Wait for this agent to finish working before attaching another image." };
  return { allowed: true, message: "" };
}

export function createAgentAttachmentDraft(agentId = null) {
  return {
    agentId: agentId || null,
    generation: 0,
    shots: [],
    activeWorkCount: 0,
  };
}

export function bindAgentAttachmentDraft(draft, agentId) {
  const nextAgentId = agentId || null;
  if (draft?.agentId === nextAgentId) return draft;
  return {
    agentId: nextAgentId,
    generation: Number.isSafeInteger(draft?.generation) ? draft.generation + 1 : 0,
    shots: [],
    activeWorkCount: 0,
  };
}

function attachmentTokenMatches(draft, token) {
  return Boolean(
    token
    && draft?.agentId === token.agentId
    && draft?.generation === token.generation,
  );
}

export function agentAttachmentSnapshot(draft, agentId) {
  if (!agentId || draft?.agentId !== agentId) {
    return { shots: [], activeWorkCount: 0, token: null };
  }
  return {
    shots: draft.shots || [],
    activeWorkCount: draft.activeWorkCount || 0,
    token: { agentId, generation: draft.generation },
  };
}

export function beginAgentAttachmentWork(draft, agentId) {
  const snapshot = agentAttachmentSnapshot(draft, agentId);
  if (!snapshot.token) return { draft, token: null };
  return {
    draft: { ...draft, activeWorkCount: snapshot.activeWorkCount + 1 },
    token: snapshot.token,
  };
}

export function publishAgentAttachment(draft, token, shot) {
  if (!attachmentTokenMatches(draft, token)) return draft;
  return { ...draft, shots: [...(draft.shots || []), shot] };
}

export function finishAgentAttachmentWork(draft, token) {
  if (!attachmentTokenMatches(draft, token)) return draft;
  return { ...draft, activeWorkCount: Math.max(0, (draft.activeWorkCount || 0) - 1) };
}

export function removeAgentAttachment(draft, token, shotId) {
  if (!attachmentTokenMatches(draft, token)) return draft;
  return { ...draft, shots: (draft.shots || []).filter((shot) => shot.id !== shotId) };
}

export function clearAgentAttachments(draft, token) {
  if (!attachmentTokenMatches(draft, token)) return draft;
  return { ...draft, shots: [] };
}

export function chatAttachmentDraftAfterClear(result, shots = [], stagedPaths = []) {
  if (!result?.cleared) return { shots, stagedPaths };
  return { shots: [], stagedPaths: [] };
}

export function visionAttachmentsFromShots(shots = []) {
  return shots.flatMap((shot) => {
    const comma = String(shot.dataUrl || "").indexOf(",");
    const mediaType = String(shot.media_type || "").toLowerCase();
    if (comma < 0 || !SUPPORTED_VISION_TYPES.has(mediaType)) return [];
    return [{
      media_type: mediaType,
      data: shot.dataUrl.slice(comma + 1),
      ...(shot.path ? { path: shot.path } : {}),
      ...(shot.name ? { name: shot.name } : {}),
      ...(Number.isFinite(shot.size) ? { size: shot.size } : {}),
      ...(typeof shot.document_id === "string" ? { document_id: shot.document_id } : {}),
    }];
  });
}

export function persistedAttachmentMetadata(attachments = [], { preserveUnknown = false } = {}) {
  return attachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object") return [];
    if (attachment.version != null && attachment.version !== CHAT_ATTACHMENT_VERSION) {
      // A newer client may understand fields this build does not. Keep the
      // record byte-for-byte on the next automatic save instead of erasing it.
      return preserveUnknown ? [{ ...attachment }] : [];
    }
    if (!attachment.path || !isChatStagingPath(attachment.path)) return [];
    return [{
      version: CHAT_ATTACHMENT_VERSION,
      path: attachment.path,
      media_type: attachment.media_type || "image/jpeg",
      name: attachment.name || "screenshot",
      size: Number.isFinite(attachment.size) ? attachment.size : null,
      ...(typeof attachment.document_id === "string" && /^[0-9a-f-]{36}$/i.test(attachment.document_id)
        ? { document_id: attachment.document_id }
        : {}),
    }];
  });
}

export function serializeDisplayMessages(rows = []) {
  return rows.map((message) => {
    const next = { ...message };
    const liveImageCount = Array.isArray(next.images) ? next.images.length : 0;
    delete next.images;
    delete next.imagePreviews;
    next.attachments = persistedAttachmentMetadata(next.attachments || [], { preserveUnknown: true });
    if (!next.attachments.length) delete next.attachments;
    if (liveImageCount > 0 && !next.shots) next.shots = liveImageCount;
    return next;
  });
}

export async function hydrateDisplayAttachments(rows = [], signPath) {
  const errors = [];
  const display = await Promise.all(rows.map(async (message) => {
    const rawAttachments = message.attachments || [];
    const attachments = [];
    const images = [];
    const imagePreviews = [];
    for (const attachment of rawAttachments) {
      if (attachment?.version != null && attachment.version !== CHAT_ATTACHMENT_VERSION) {
        errors.push({
          path: attachment.path,
          error: new Error(`Unsupported saved screenshot metadata version: ${attachment.version}`),
        });
        attachments.push({ ...attachment });
        continue;
      }
      const supported = persistedAttachmentMetadata([attachment]);
      if (!supported.length) continue;
      attachments.push(supported[0]);
      try {
        const src = await signPath(supported[0].path);
        images.push(src);
        imagePreviews.push({ ...supported[0], src, status: "ready", refreshCount: 0 });
      } catch (error) {
        errors.push({ path: supported[0].path, error });
        imagePreviews.push({ ...supported[0], src: "", status: "unavailable", refreshCount: 0, error: error?.message || String(error) });
      }
    }
    if (!attachments.length) return message;
    return { ...message, attachments, imagePreviews, ...(images.length ? { images } : {}) };
  }));
  return { display, errors };
}

export async function refreshSavedAttachmentPreview(preview, signPath) {
  if (!preview?.path || !isChatStagingPath(preview.path)) {
    return { ...preview, status: "unavailable", error: "This saved image path is invalid." };
  }
  const refreshCount = (Number(preview.refreshCount) || 0) + 1;
  try {
    const src = await signPath(preview.path);
    return { ...preview, src, status: "ready", refreshCount, error: "" };
  } catch (error) {
    return { ...preview, src: "", status: "unavailable", refreshCount, error: error?.message || "The saved image preview is unavailable." };
  }
}

export function chatStagingPathsFromDisplay(rows = []) {
  const paths = [];
  for (const message of rows) {
    for (const attachment of message.attachments || []) {
      if (isChatStagingPath(attachment?.path)) paths.push(attachment.path);
    }
  }
  return [...new Set(paths)];
}

export function stagingPathsEvictedByDisplayLimit(rows = [], limit = 200) {
  const boundedLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (rows.length <= boundedLimit) return [];
  const splitAt = rows.length - boundedLimit;
  const retained = new Set(chatStagingPathsFromDisplay(rows.slice(splitAt)));
  return chatStagingPathsFromDisplay(rows.slice(0, splitAt))
    .filter((path) => !retained.has(path));
}

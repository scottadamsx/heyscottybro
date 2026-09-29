import {
  bugScreenshotStoragePath,
  chatStagingStoragePath,
  fileFromStoragePath,
  imageExtension,
  imageMediaType,
  isOwnedChatStagingPath,
  isOwnedStoragePath,
} from "../utils/storageKeys.js";

export const BUG_SCREENSHOTS_BUCKET = "bug-screenshots";

const SUPPORTED_STORAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const detail = (error) => error?.message || error?.code || String(error || "unknown storage error");

function unsupportedImageError(file) {
  const name = file?.name || "That image";
  const heic = /\.hei[cf]$/i.test(name) || /^image\/hei[cf]$/i.test(file?.type || "");
  const reason = heic
    ? "HEIC couldn't be decoded. Export it as JPEG or PNG and try again."
    : "Only JPEG, PNG, WebP, and GIF images are supported.";
  return new Error(`Couldn't save ${name} to "${BUG_SCREENSHOTS_BUCKET}": ${reason}`);
}

export function createBugScreenshotStorage({
  getUserId,
  captureOwnerId = null,
  verifyOwnerId = null,
  getBucket,
  now = () => Date.now(),
  randomId,
}) {
  const nextId = () => String(randomId()).slice(0, 32);
  const bucket = () => getBucket(BUG_SCREENSHOTS_BUCKET);

  const resolveOperationOwner = async (expectedOwnerId = null) => {
    const capturedOwnerId = expectedOwnerId || captureOwnerId?.() || null;
    const resolvedOwnerId = await getUserId(capturedOwnerId);
    if (capturedOwnerId && resolvedOwnerId !== capturedOwnerId) {
      throw new Error("The authenticated owner changed before screenshot storage work began; the operation was cancelled.");
    }
    return capturedOwnerId || resolvedOwnerId;
  };

  const verifyOperationOwner = async (ownerId) => {
    if (!verifyOwnerId) return ownerId;
    const verifiedOwnerId = await verifyOwnerId(ownerId);
    if (verifiedOwnerId !== ownerId) {
      throw new Error("The authenticated owner changed during screenshot storage work; the operation was cancelled.");
    }
    return ownerId;
  };

  const validateUpload = (file) => {
    const mediaType = imageMediaType(file);
    const extension = imageExtension(file);
    if (!SUPPORTED_STORAGE_TYPES.has(mediaType) || !["gif", "jpg", "jpeg", "png", "webp"].includes(extension)) {
      throw unsupportedImageError(file);
    }
    return mediaType;
  };

  async function upload(path, file, action, userId) {
    const mediaType = validateUpload(file);
    let response;
    try {
      await verifyOperationOwner(userId);
      response = await bucket().upload(path, file, { contentType: mediaType, upsert: false });
    } catch (error) {
      throw new Error(`${action} in "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(error)}`, { cause: error });
    }
    if (response?.error) {
      throw new Error(`${action} in "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(response.error)}`);
    }
    return mediaType;
  }

  async function stage(file, original = {}, expectedOwnerId = null) {
    const userId = await resolveOperationOwner(expectedOwnerId);
    const path = chatStagingStoragePath({ userId, file, timestamp: now(), randomId: nextId() });
    const mediaType = await upload(path, file, "Staging the chat screenshot", userId);
    return {
      version: 1,
      path,
      name: original.name || file?.name || `screenshot.${imageExtension(file)}`,
      // Describe the bytes that were actually stored, not the camera file's
      // pre-normalisation type (which may have been HEIC).
      media_type: mediaType,
      size: Number.isFinite(original.size) ? original.size : (Number.isFinite(file?.size) ? file.size : null),
    };
  }

  async function uploadForBug(bugId, file, expectedOwnerId = null) {
    const userId = await resolveOperationOwner(expectedOwnerId);
    const path = bugScreenshotStoragePath({ userId, bugId, file, timestamp: now(), randomId: nextId() });
    await upload(path, file, "Saving the bug screenshot", userId);
    return path;
  }

  async function removeOwnedPaths(paths, action, userId) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return 0;
    if (unique.some((path) => !isOwnedStoragePath(path, userId))) {
      throw new Error(`${action} from "${BUG_SCREENSHOTS_BUCKET}" failed: a path was outside the signed-in owner's folder.`);
    }
    // Supabase accepts bounded removal batches. Chunking also avoids turning a
    // long-lived chat with hundreds of images into one oversized request.
    for (let offset = 0; offset < unique.length; offset += 100) {
      const batch = unique.slice(offset, offset + 100);
      let response;
      try {
        await verifyOperationOwner(userId);
        response = await bucket().remove(batch);
      } catch (error) {
        throw new Error(`${action} from "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(error)}`, { cause: error });
      }
      if (response?.error) {
        throw new Error(`${action} from "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(response.error)}`);
      }
    }
    return unique.length;
  }

  async function removePaths(paths, action = "Removing screenshots", expectedOwnerId = null) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return 0;
    return removeOwnedPaths(unique, action, await resolveOperationOwner(expectedOwnerId));
  }

  async function removeStaged(paths, expectedOwnerId = null) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return 0;
    const userId = await resolveOperationOwner(expectedOwnerId);
    if (unique.some((path) => !isOwnedChatStagingPath(path, userId))) {
      throw new Error(`Clearing chat screenshots from "${BUG_SCREENSHOTS_BUCKET}" failed: a path was not an owned chat-staging object.`);
    }
    return removeOwnedPaths(unique, "Clearing chat screenshots", userId);
  }

  async function clearAllStaged(extraPaths = [], expectedOwnerId = null) {
    const userId = await resolveOperationOwner(expectedOwnerId);
    const folder = `${userId}/_staging`;
    const discovered = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      let response;
      try {
        await verifyOperationOwner(userId);
        response = await bucket().list(folder, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
      } catch (error) {
        throw new Error(`Listing chat screenshots in "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(error)}`, { cause: error });
      }
      if (response?.error) {
        throw new Error(`Listing chat screenshots in "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(response.error)}`);
      }
      const rows = Array.isArray(response?.data) ? response.data : [];
      for (const row of rows) {
        if (row?.name && !String(row.name).includes("/")) discovered.push(`${folder}/${row.name}`);
      }
      if (rows.length < pageSize) break;
    }

    const known = [...new Set((extraPaths || []).filter(Boolean))];
    if (known.some((path) => !isOwnedChatStagingPath(path, userId))) {
      throw new Error(`Clearing chat screenshots from "${BUG_SCREENSHOTS_BUCKET}" failed: a path was not an owned chat-staging object.`);
    }
    return removeOwnedPaths([...discovered, ...known], "Clearing chat screenshots", userId);
  }

  async function claim(bugId, paths, expectedOwnerId = null) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return [];
    const userId = await resolveOperationOwner(expectedOwnerId);
    if (unique.some((path) => !isOwnedChatStagingPath(path, userId))) {
      throw new Error(`Attaching chat evidence in "${BUG_SCREENSHOTS_BUCKET}" failed: a path was not an owned chat-staging object.`);
    }

    const copied = [];
    try {
      for (const source of unique) {
        const file = fileFromStoragePath(source);
        const destination = bugScreenshotStoragePath({
          userId,
          bugId,
          file,
          timestamp: now(),
          randomId: nextId(),
        });
        await verifyOperationOwner(userId);
        const response = await bucket().copy(source, destination);
        if (response?.error) throw response.error;
        copied.push(destination);
      }
    } catch (error) {
      let rollbackError = null;
      if (copied.length) {
        try {
          await verifyOperationOwner(userId);
          const rollback = await bucket().remove(copied);
          if (rollback?.error) throw rollback.error;
        } catch (cleanupError) {
          rollbackError = cleanupError;
        }
      }
      const warning = rollbackError
        ? ` Automatic rollback also failed (${detail(rollbackError)}). Manual cleanup is required for: ${copied.join(", ")}.`
        : "";
      const failure = new Error(
        `Attaching chat evidence in "${BUG_SCREENSHOTS_BUCKET}" failed: ${detail(error)}.${warning}`,
        { cause: error },
      );
      if (rollbackError) {
        failure.rollbackError = rollbackError;
        failure.orphanedPaths = [...copied];
      }
      throw failure;
    }
    return copied;
  }

  return { stage, uploadForBug, claim, removePaths, removeStaged, clearAllStaged };
}

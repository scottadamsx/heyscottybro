import { supabase } from "../utils/supabase";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";
import { uid } from "./_base";
import { BUG_SCREENSHOTS_BUCKET, createBugScreenshotStorage } from "./bugScreenshotStorageCore";

// The existing private bucket and owner-scoped `_staging` path are a deployed
// storage contract. This neutral module owns the live chat lifecycle so the
// retired Bug Tracker can disappear without changing or deleting that data.
const storage = createBugScreenshotStorage({
  captureOwnerId: captureEstablishedOwnerId,
  getUserId: (expectedOwnerId) => uid(expectedOwnerId),
  verifyOwnerId: (expectedOwnerId) => uid(expectedOwnerId),
  getBucket: (bucket) => supabase.storage.from(bucket),
  randomId: () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)),
});

export function stageChatAttachment(file, originalMetadata, expectedOwnerId = null) {
  return storage.stage(file, originalMetadata, expectedOwnerId);
}

export function removeStagedChatAttachments(paths, expectedOwnerId = null) {
  return storage.removeStaged(paths, expectedOwnerId);
}

export function clearStagedChatAttachments(extraPaths = [], expectedOwnerId = null) {
  return storage.clearAllStaged(extraPaths, expectedOwnerId);
}

export async function signChatAttachment(path, expiresIn = 3600, expectedOwnerId = null) {
  const ownerId = expectedOwnerId || captureEstablishedOwnerId();
  await uid(ownerId);
  const { data, error } = await supabase.storage.from(BUG_SCREENSHOTS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Couldn't load the saved image preview: ${error.message || error}`);
  if (!data?.signedUrl) throw new Error("Couldn't load the saved image preview: no signed URL was returned.");
  return data.signedUrl;
}

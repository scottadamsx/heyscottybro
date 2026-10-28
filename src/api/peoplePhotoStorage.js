// src/api/peoplePhotoStorage.js — person pictures for the People space.
// The image bytes live in the same private bucket as chat screenshots
// ("bug-screenshots": owner-folder policies, 10 MB, PNG/JPEG/WebP/GIF),
// under <uid>/people/<personId>/…; the person document stores only the
// path. The People page hands these functions to Orbit as its media
// capability (configureOrbit), and peopleApi uses claimPersonPhoto when
// Frodo sets a picture from a chat screenshot.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { BUG_SCREENSHOTS_BUCKET } from "./bugScreenshotStorageCore";
import {
  fileFromStoragePath,
  imageExtension,
  imageMediaType,
  isOwnedChatStagingPath,
  isOwnedPersonPhotoPath,
  isOwnedStoragePath,
  personPhotoStoragePath,
} from "../utils/storageKeys";

const SUPPORTED_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const bucket = () => supabase.storage.from(BUG_SCREENSHOTS_BUCKET);
const randomId = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
const detail = (error) => error?.message || error?.code || String(error || "unknown storage error");

function validateImage(file) {
  const mediaType = imageMediaType(file);
  const extension = imageExtension(file);
  if (!SUPPORTED_TYPES.has(mediaType) || !["gif", "jpg", "jpeg", "png", "webp"].includes(extension)) {
    const heic = /\.hei[cf]$/i.test(file?.name || "") || /^image\/hei[cf]$/i.test(file?.type || "");
    throw new Error(heic
      ? "HEIC pictures can't be shown here. Export it as JPEG or PNG and try again."
      : "Only JPEG, PNG, WebP, and GIF pictures are supported.");
  }
  return mediaType;
}

/** Upload a chosen picture file for a person; returns the stored path. */
export async function uploadPersonPhoto(file, personId) {
  const ownerId = await uid();
  const mediaType = validateImage(file);
  const path = personPhotoStoragePath({ userId: ownerId, personId, file, timestamp: Date.now(), randomId: randomId() });
  const { error } = await bucket().upload(path, file, { contentType: mediaType, upsert: false });
  if (error) throw new Error(`Couldn't save the picture: ${detail(error)}`, { cause: error });
  return path;
}

/** Signed URL for a stored person picture (owner's own paths only). */
export async function signPersonPhoto(path, expiresIn = 3600) {
  const ownerId = await uid();
  if (!isOwnedStoragePath(path, ownerId)) throw new Error("That picture path is outside the signed-in owner's folder.");
  const { data, error } = await bucket().createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Couldn't load the picture: ${detail(error)}`, { cause: error });
  if (!data?.signedUrl) throw new Error("Couldn't load the picture: no signed URL was returned.");
  return data.signedUrl;
}

/** Remove a stored person picture. Only ever touches the people folder. */
export async function removePersonPhoto(path) {
  const ownerId = await uid();
  if (!isOwnedPersonPhotoPath(path, ownerId)) return 0;
  const { error } = await bucket().remove([path]);
  if (error) throw new Error(`Couldn't remove the old picture: ${detail(error)}`, { cause: error });
  return 1;
}

/**
 * Make a chat-staged screenshot a person's permanent picture: copy it out
 * of _staging (which chat Clear deletes) into the person's folder. The
 * source must be the signed-in owner's staged file.
 */
export async function claimPersonPhoto(personId, stagedPath) {
  const ownerId = await uid();
  if (!isOwnedChatStagingPath(stagedPath, ownerId)) {
    throw new Error("That screenshot is not one of this conversation's staged images.");
  }
  const file = fileFromStoragePath(stagedPath);
  validateImage(file);
  const path = personPhotoStoragePath({ userId: ownerId, personId, file, timestamp: Date.now(), randomId: randomId() });
  const { error } = await bucket().copy(stagedPath, path);
  if (error) throw new Error(`Couldn't save the screenshot as the picture: ${detail(error)}`, { cause: error });
  return path;
}

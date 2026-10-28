import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bugScreenshotStoragePath,
  chatStagingStoragePath,
  imageExtension,
  isChatStagingPath,
  isOwnedChatStagingPath,
  isOwnedPersonPhotoPath,
  isPersonPhotoPath,
  personPhotoStoragePath,
} from "./storageKeys.js";

const base = { userId: "owner-123", timestamp: 1234567890, randomId: "abc_123" };

test("storage keys never include spaces, Unicode, or parentheses from filenames", () => {
  const path = chatStagingStoragePath({
    ...base,
    file: { name: "Résumé photo (final) ①.PNG", type: "image/png" },
  });
  assert.equal(path, "owner-123/_staging/1234567890-abc_123.png");
  assert.match(path, /^[a-zA-Z0-9_./-]+$/);
});

test("missing extensions use the MIME type and then a safe PNG default", () => {
  assert.equal(imageExtension({ name: "clipboard", type: "image/jpeg" }), "jpg");
  assert.equal(imageExtension({ name: "clipboard", type: "" }), "png");
  assert.equal(imageExtension({ name: "image.verylongextension", type: "" }), "png");
});

test("HEIC names produce a syntactically safe key without copying the raw basename", () => {
  const path = chatStagingStoragePath({
    ...base,
    file: { name: "IMG 0042 (1).HEIC", type: "image/heic" },
  });
  assert.equal(path, "owner-123/_staging/1234567890-abc_123.heic");
  assert.equal(path.includes("IMG 0042"), false);
});

test("bug screenshot keys use the authenticated owner and bug id", () => {
  assert.equal(bugScreenshotStoragePath({
    ...base,
    bugId: "bug-456",
    file: { name: "shot.jpg", type: "image/jpeg" },
  }), "owner-123/bug-456/1234567890-abc_123.jpg");
});

test("staging path checks reject other owners and non-staging folders", () => {
  const path = "owner-123/_staging/123-abc.png";
  assert.equal(isChatStagingPath(path), true);
  assert.equal(isOwnedChatStagingPath(path, "owner-123"), true);
  assert.equal(isOwnedChatStagingPath(path, "other-owner"), false);
  assert.equal(isOwnedChatStagingPath("owner-123/bug-1/123-abc.png", "owner-123"), false);
});

test("generated path segments are validated", () => {
  assert.throws(() => chatStagingStoragePath({
    ...base,
    randomId: "bad id (1)",
    file: { name: "shot.png", type: "image/png" },
  }), /Invalid storage random id/);
});

test("person photo keys live under the owner's people folder", () => {
  const path = personPhotoStoragePath({
    ...base,
    personId: "p_01J8Z3K4",
    file: { name: "Mum at the beach.JPG", type: "image/jpeg" },
  });
  assert.equal(path, "owner-123/people/p_01J8Z3K4/1234567890-abc_123.jpg");
  assert.equal(isPersonPhotoPath(path), true);
  assert.equal(isOwnedPersonPhotoPath(path, "owner-123"), true);
  assert.equal(isOwnedPersonPhotoPath(path, "other-owner"), false);
});

test("person photo path checks reject staging files, urls and other shapes", () => {
  assert.equal(isPersonPhotoPath("owner-123/_staging/123-abc.png"), false);
  assert.equal(isPersonPhotoPath("owner-123/people/p_1/123-abc.bmp"), false);
  assert.equal(isPersonPhotoPath("https://example.com/people/p_1/123-abc.png"), false);
  assert.equal(isPersonPhotoPath("owner-123/people/p_1/sub/123-abc.png"), false);
  assert.equal(isPersonPhotoPath(""), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createBugScreenshotStorage } from "./bugScreenshotStorageCore.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};

function harness(overrides = {}) {
  const calls = { upload: [], copy: [], list: [], remove: [] };
  const ids = ["rand-a", "rand-b", "rand-c", "rand-d"];
  const bucket = {
    upload: async (...args) => { calls.upload.push(args); return { error: null }; },
    copy: async (...args) => { calls.copy.push(args); return { error: null }; },
    list: async (...args) => { calls.list.push(args); return { data: [], error: null }; },
    remove: async (...args) => { calls.remove.push(args); return { error: null }; },
    ...overrides.bucket,
  };
  const storage = createBugScreenshotStorage({
    getUserId: async () => "owner-1",
    getBucket: (name) => { assert.equal(name, "bug-screenshots"); return bucket; },
    now: () => 1000,
    randomId: () => ids.shift(),
    ...overrides.dependencies,
  });
  return { storage, calls };
}

test("staging returns versioned path metadata and uploads accepted bytes", async () => {
  const { storage, calls } = harness();
  const file = { name: "normalized.jpg", type: "image/jpeg", size: 123 };
  const result = await storage.stage(file, {
    name: "IMG 0042 (1).HEIC",
    media_type: "image/jpeg",
    size: 456,
  });

  assert.deepEqual(result, {
    version: 1,
    path: "owner-1/_staging/1000-rand-a.jpg",
    name: "IMG 0042 (1).HEIC",
    media_type: "image/jpeg",
    size: 456,
  });
  assert.equal(calls.upload.length, 1);
  assert.deepEqual(calls.upload[0].slice(0, 2), [result.path, file]);
  assert.deepEqual(calls.upload[0][2], { contentType: "image/jpeg", upsert: false });
});

test("raw HEIC is rejected actionably before storage upload", async () => {
  const { storage, calls } = harness();
  await assert.rejects(
    storage.stage({ name: "IMG 0042 (1).HEIC", type: "image/heic", size: 50 }),
    /HEIC couldn't be decoded\. Export it as JPEG or PNG/,
  );
  assert.equal(calls.upload.length, 0);
});

test("opaque upload errors name the action and private bucket", async () => {
  const { storage } = harness({
    bucket: { upload: async () => ({ error: { message: "The string did not match the expected pattern" } }) },
  });
  await assert.rejects(
    storage.stage({ name: "photo.png", type: "image/png", size: 50 }),
    /Staging the chat screenshot in "bug-screenshots" failed: The string did not match the expected pattern/,
  );
});

test("claim copies staging evidence into bug-specific paths without deleting source", async () => {
  const { storage, calls } = harness();
  const result = await storage.claim("bug-9", [
    "owner-1/_staging/1-one.png",
    "owner-1/_staging/2-two.jpg",
    "owner-1/_staging/1-one.png",
  ]);

  assert.deepEqual(result, [
    "owner-1/bug-9/1000-rand-a.png",
    "owner-1/bug-9/1000-rand-b.jpg",
  ]);
  assert.deepEqual(calls.copy, [
    ["owner-1/_staging/1-one.png", result[0]],
    ["owner-1/_staging/2-two.jpg", result[1]],
  ]);
  assert.deepEqual(calls.remove, []);
});

test("claim rejects paths outside the authenticated staging folder", async () => {
  const { storage, calls } = harness();
  await assert.rejects(
    storage.claim("bug-9", ["someone-else/_staging/1-one.png"]),
    /not an owned chat-staging object/,
  );
  assert.equal(calls.copy.length, 0);
});

test("a partial copy failure rolls back bug-specific copies", async () => {
  let copies = 0;
  const { storage, calls } = harness({
    bucket: {
      copy: async (...args) => {
        calls.copy.push(args);
        copies++;
        return copies === 2 ? { error: { message: "copy denied" } } : { error: null };
      },
    },
  });
  await assert.rejects(storage.claim("bug-9", [
    "owner-1/_staging/1-one.png",
    "owner-1/_staging/2-two.jpg",
  ]), /Attaching chat evidence.*copy denied/);
  assert.deepEqual(calls.remove, [[[
    "owner-1/bug-9/1000-rand-a.png",
  ]]]);
});

for (const [label, remove] of [
  ["returned storage error", async () => ({ error: { message: "rollback denied" } })],
  ["thrown storage error", async () => { throw new Error("rollback offline"); }],
]) {
  test(`partial-copy failure discloses manual cleanup after a ${label}`, async () => {
    let copies = 0;
    const { storage } = harness({
      bucket: {
        copy: async () => (++copies === 2 ? { error: { message: "copy denied" } } : { error: null }),
        remove,
      },
    });

    await assert.rejects(
      storage.claim("bug-9", [
        "owner-1/_staging/1-one.png",
        "owner-1/_staging/2-two.jpg",
      ]),
      (error) => {
        assert.match(error.message, /Manual cleanup is required/);
        assert.match(error.message, /owner-1\/bug-9\/1000-rand-a\.png/);
        assert.deepEqual(error.orphanedPaths, ["owner-1/bug-9/1000-rand-a.png"]);
        assert.ok(error.rollbackError);
        return true;
      },
    );
  });
}

test("confirmed-clear cleanup deduplicates staging paths and exposes removal errors", async () => {
  const { storage, calls } = harness();
  assert.equal(await storage.removeStaged([
    "owner-1/_staging/1-one.png",
    "owner-1/_staging/1-one.png",
  ]), 1);
  assert.deepEqual(calls.remove, [[[
    "owner-1/_staging/1-one.png",
  ]]]);

  const failing = harness({ bucket: { remove: async () => ({ error: { message: "delete denied" } }) } });
  await assert.rejects(
    failing.storage.removeStaged(["owner-1/_staging/1-one.png"]),
    /Clearing chat screenshots.*delete denied/,
  );
});

test("confirmed Clear lists and removes more than 200 staged objects plus unsent paths", async () => {
  const names = Array.from({ length: 225 }, (_, index) => `${String(index).padStart(3, "0")}-shot.png`);
  const { storage, calls } = harness({
    bucket: {
      list: async (folder, options) => {
        calls.list.push([folder, options]);
        return { data: names.slice(options.offset, options.offset + options.limit).map((name) => ({ name })), error: null };
      },
    },
  });
  const unsent = "owner-1/_staging/999-unsent.png";
  const removed = await storage.clearAllStaged([unsent]);

  assert.equal(removed, 226);
  assert.equal(calls.list.length, 3);
  assert.deepEqual(calls.list.map(([, options]) => options.offset), [0, 100, 200]);
  assert.equal(calls.remove.length, 3, "removals are bounded to 100 paths per request");
  const removedPaths = calls.remove.flatMap(([batch]) => batch);
  assert.equal(removedPaths.length, 226);
  assert.equal(removedPaths.includes(unsent), true);
  assert.equal(removedPaths.includes("owner-1/_staging/000-shot.png"), true);
  assert.equal(removedPaths.includes("owner-1/_staging/224-shot.png"), true);
});

test("confirmed Clear exposes staging-prefix listing failures", async () => {
  const { storage } = harness({
    bucket: { list: async () => ({ error: { message: "list denied" } }) },
  });
  await assert.rejects(storage.clearAllStaged(), /Listing chat screenshots.*list denied/);
});

test("A-started deferred auth drift blocks every staging operation before B storage access", async () => {
  const cases = [
    ["stage", (storage) => storage.stage({ name: "one.png", type: "image/png", size: 1 })],
    ["claim", (storage) => storage.claim("bug-1", ["owner-a/_staging/one.png"])],
    ["remove", (storage) => storage.removeStaged(["owner-a/_staging/one.png"])],
    ["clear", (storage) => storage.clearAllStaged(["owner-a/_staging/one.png"])],
  ];

  for (const [label, start] of cases) {
    let establishedOwner = "owner-a";
    const auth = deferred();
    const { storage, calls } = harness({
      dependencies: {
        captureOwnerId: () => establishedOwner,
        getUserId: () => auth.promise,
        verifyOwnerId: async (ownerId) => ownerId,
      },
    });

    const operation = start(storage);
    establishedOwner = "owner-b";
    auth.resolve("owner-b");

    await assert.rejects(operation, /authenticated owner changed.*cancelled/i, label);
    assert.deepEqual(calls, { upload: [], copy: [], list: [], remove: [] }, `${label} must issue no B storage operation`);
  }
});

test("whole-prefix Clear re-verifies its captured owner before listing or deleting", async () => {
  let establishedOwner = "owner-a";
  const executionAuth = deferred();
  const { storage, calls } = harness({
    dependencies: {
      captureOwnerId: () => establishedOwner,
      getUserId: async (expectedOwnerId) => expectedOwnerId,
      verifyOwnerId: async () => executionAuth.promise,
    },
  });

  const clear = storage.clearAllStaged(["owner-a/_staging/one.png"]);
  establishedOwner = "owner-b";
  executionAuth.resolve("owner-b");

  await assert.rejects(clear, /authenticated owner changed.*cancelled/i);
  assert.deepEqual(calls.list, []);
  assert.deepEqual(calls.remove, []);
});

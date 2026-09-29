import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPendingScreenshotContext,
  setPendingScreenshots,
  takePendingScreenshots,
  withCheckpointProgress,
} from "./pendingScreenshots.js";

test("overlapping agent turns consume only their own screenshot evidence", () => {
  const floatingFrodo = createPendingScreenshotContext(["owner/_staging/frodo.png"]);
  const commandCenter = createPendingScreenshotContext(["owner/_staging/command.png"]);

  assert.deepEqual(takePendingScreenshots(commandCenter), ["owner/_staging/command.png"]);
  assert.deepEqual(takePendingScreenshots(floatingFrodo), ["owner/_staging/frodo.png"]);
  assert.deepEqual(takePendingScreenshots(commandCenter), []);
});

test("restoring failed evidence affects only the originating turn", () => {
  const first = createPendingScreenshotContext(["owner/_staging/first.png"]);
  const second = createPendingScreenshotContext(["owner/_staging/second.png"]);
  const claimed = takePendingScreenshots(first);
  setPendingScreenshots(first, claimed);

  assert.deepEqual(takePendingScreenshots(second), ["owner/_staging/second.png"]);
  assert.deepEqual(takePendingScreenshots(first), ["owner/_staging/first.png"]);
});

test("missing turn context fails instead of falling back to shared global evidence", () => {
  assert.throws(() => takePendingScreenshots(), /context is missing/);
  assert.throws(() => setPendingScreenshots(null, ["path"]), /context is missing/);
});

test("adding checkpoint progress preserves the one-shot turn context", () => {
  const context = createPendingScreenshotContext(["owner/_staging/once.png"]);
  const checkpointProgress = async () => {};
  const executionContext = withCheckpointProgress(context, checkpointProgress);

  assert.equal(executionContext, context, "production must not spread-copy the mutable queue");
  assert.equal(executionContext.checkpointProgress, checkpointProgress);
  assert.deepEqual(takePendingScreenshots(executionContext), ["owner/_staging/once.png"]);
  assert.deepEqual(takePendingScreenshots(context), [], "later tools cannot reclaim consumed evidence");
});

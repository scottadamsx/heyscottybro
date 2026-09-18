import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedRead, invalidateReads } from "./_cache.js";
import { emitDataChange } from "../utils/dataEvents.js";

test("identical reads share one request and each caller gets its own array", async () => {
  let calls = 0;
  const load = () => { calls++; return Promise.resolve([3, 1, 2]); };
  const [a, b] = await Promise.all([cachedRead("t1", "things", load), cachedRead("t1", "things", load)]);
  assert.equal(calls, 1);
  a.sort();
  assert.deepEqual(b, [3, 1, 2], "sorting one copy doesn't change the other");
});

test("a write to the collection drops the cached read before pages reload", async () => {
  let calls = 0;
  const load = () => Promise.resolve(++calls);
  assert.equal(await cachedRead("t2", "widgets", load), 1);
  assert.equal(await cachedRead("t2", "widgets", load), 1, "reused inside the window");
  emitDataChange("widgets");
  assert.equal(await cachedRead("t2", "widgets", load), 2, "fresh after a change");
  invalidateReads();
  assert.equal(await cachedRead("t2", "widgets", load), 3, "cleared entirely");
});

test("failures are not cached", async () => {
  let n = 0;
  const load = () => (++n === 1 ? Promise.reject(new Error("down")) : Promise.resolve("ok"));
  await assert.rejects(cachedRead("t3", "x", load), /down/);
  assert.equal(await cachedRead("t3", "x", load), "ok");
});

test("results expire after the window", async () => {
  let calls = 0;
  const load = () => Promise.resolve(++calls);
  await cachedRead("t4", "y", load, 10);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(await cachedRead("t4", "y", load, 10), 2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advancePageVisit,
  createPageVisit,
  persistedPageVisit,
  routeKeyForPath,
} from "./pageUsage.js";

const trackerSource = readFileSync(new URL("../hooks/usePageUsageTracker.js", import.meta.url), "utf8");

test("route keys remove entity ids, query data, and unknown paths", () => {
  assert.equal(routeKeyForPath("/admin/people/event/private-id"), "people_event");
  assert.equal(routeKeyForPath("/admin/people/person/private-id"), "person_detail");
  assert.equal(routeKeyForPath("/admin/tasks/private-id"), "task_detail");
  assert.equal(routeKeyForPath("/admin/unknown/private-id"), "other");
});

test("active time uses monotonic deltas and pauses while inactive", () => {
  let visit = createPageVisit({ visitId: "v1", routeKey: "people", wallNow: 1000, monotonicNow: 10 });
  visit = advancePageVisit(visit, { wallNow: 2000, monotonicNow: 1010, active: true });
  visit = advancePageVisit(visit, { wallNow: 900000, monotonicNow: 2010, active: false });
  visit = advancePageVisit(visit, { wallNow: 901000, monotonicNow: 3010, active: true });
  visit = advancePageVisit(visit, { wallNow: 902000, monotonicNow: 4010, active: true });
  assert.equal(visit.active_ms, 2000, "hidden time and wall-clock jumps do not count");
});

test("short visits are omitted and settled visits drop runtime-only state", () => {
  const short = { ...createPageVisit({ visitId: "v1", routeKey: "today", wallNow: 0, monotonicNow: 0 }), active_ms: 2999 };
  assert.equal(persistedPageVisit(short), null);
  const stored = persistedPageVisit({ ...short, active_ms: 3000.4 });
  assert.equal(stored.active_ms, 3000);
  assert.equal("monotonic_at" in stored, false);
});

test("repeated checkpoints at the same monotonic instant cannot double-count", () => {
  const visit = createPageVisit({ visitId: "v2", routeKey: "analytics", wallNow: 0, monotonicNow: 100 });
  const first = advancePageVisit(visit, { wallNow: 4000, monotonicNow: 4100, active: true });
  const repeated = advancePageVisit(first, { wallNow: 4000, monotonicNow: 4100, active: true });
  assert.equal(repeated.active_ms, 4000);
});

test("assembled tracking binds its queue to the owner and handles route, attention, idle, replay, and pagehide boundaries", () => {
  assert.match(trackerSource, /QUEUE_PREFIX.*ownerId/);
  assert.match(trackerSource, /location\.pathname/);
  assert.match(trackerSource, /document\.visibilityState === "visible"/);
  assert.match(trackerSource, /document\.hasFocus\(\)/);
  assert.match(trackerSource, /PAGE_IDLE_MS/);
  assert.match(trackerSource, /flushQueue\(ownerId\)/);
  assert.match(trackerSource, /addEventListener\("pagehide"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  bugReportRollbackError,
  createKeyedMutex,
  findCanonicalOpenReport,
  isSameBugReport,
  mergeBugDescription,
  mergeUniqueScreenshotPaths,
} from "./bugDedup.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};

const report = (overrides = {}) => ({
  id: "bug-1",
  type: "bug",
  status: "open",
  page: "Frodo chat",
  title: "Frodo chat close button overlaps Dynamic Island",
  description: "Element: Close button\nActual: Dynamic Island covers the control",
  ...overrides,
});

test("canonical matching accepts reordered specific titles in the same product area", () => {
  assert.equal(isSameBugReport(report(), {
    page: "Frodo chat panel on iPhone",
    title: "Dynamic Island overlaps Frodo chat close button",
    description: "Element: Close button\nActual: The control is covered by the Dynamic Island",
  }), true);
});

test("canonical matching rejects same-looking titles on different pages", () => {
  assert.equal(isSameBugReport(report({ title: "Save button does not persist changes", page: "Settings" }), {
    title: "Save button does not persist changes",
    page: "Journal",
    description: "Element: Save button",
  }), false);
});

test("canonical matching rejects different problems in the same area", () => {
  assert.equal(isSameBugReport(report(), {
    page: "Frodo chat",
    title: "Uploaded photos are missing after reload",
    description: "Element: Screenshot preview\nActual: Preview disappears",
  }), false);
});

test("lookup returns only a canonical open report of the requested type", async () => {
  const closed = report({ id: "closed", status: "resolved" });
  const feature = report({ id: "feature", type: "feature" });
  const open = report({ id: "open" });
  const found = await findCanonicalOpenReport({
    loadReports: async () => [closed, feature, open],
    type: "bug",
    incoming: report(),
  });
  assert.equal(found.id, "open");
});

test("lookup failure is closed and explicitly promises no creation", async () => {
  await assert.rejects(
    findCanonicalOpenReport({
      loadReports: async () => { throw new Error("offline"); },
      type: "bug",
      incoming: report(),
    }),
    /no report was created/i,
  );
  await assert.rejects(
    findCanonicalOpenReport({ loadReports: async () => null, type: "feature", incoming: report() }),
    /invalid response/i,
  );
});

test("description and screenshot merges are stable and deduplicated", () => {
  assert.equal(
    mergeBugDescription("Element: Close\nActual: Covered", "Actual: Covered\nExpected: Reachable"),
    "Element: Close\nActual: Covered\n\nAlso reported:\nExpected: Reachable",
  );
  assert.deepEqual(
    mergeUniqueScreenshotPaths([" chat/a.jpg ", "chat/a.jpg", ""], ["chat/b.jpg", "chat/a.jpg", null]),
    ["chat/a.jpg", "chat/b.jpg"],
  );
});

test("rollback errors preserve the primary failure and disclose incomplete cleanup", () => {
  const primary = new Error("database update failed");
  assert.equal(bugReportRollbackError(primary, { reportId: "bug-1" }), primary);

  const combined = bugReportRollbackError(primary, {
    reportId: "bug-1",
    cleanupErrors: [new Error("storage delete failed"), new Error("row delete failed")],
  });
  assert.match(combined.message, /database update failed/);
  assert.match(combined.message, /rollback was incomplete for report bug-1/);
  assert.match(combined.message, /storage delete failed; row delete failed/);
  assert.equal(combined.cause, primary);
});

test("same-type bug lookup/create transactions cannot overlap in one browser", async () => {
  const withLock = createKeyedMutex();
  const firstGate = deferred();
  const firstStarted = deferred();
  const secondStarted = deferred();
  const events = [];

  const first = withLock("bug", async () => {
    events.push("first:start");
    firstStarted.resolve();
    await firstGate.promise;
    events.push("first:end");
  });
  const second = withLock("bug", async () => {
    events.push("second:start");
    secondStarted.resolve();
  });

  await firstStarted.promise;
  assert.deepEqual(events, ["first:start"]);
  firstGate.resolve();
  await secondStarted.promise;
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
});

test("different report types may use independent mutex keys", async () => {
  const withLock = createKeyedMutex();
  const bugGate = deferred();
  const featureStarted = deferred();
  const bug = withLock("bug", () => bugGate.promise);
  const feature = withLock("feature", async () => { featureStarted.resolve(); });
  await featureStarted.promise;
  bugGate.resolve();
  await Promise.all([bug, feature]);
});

test("overlapping same-client read-then-create calls produce one canonical row", async () => {
  const withLock = createKeyedMutex();
  const reports = [];
  let creates = 0;
  const file = () => withLock("log_bug:bug", async () => {
    const existing = reports.find((item) => item.title === "same report");
    if (existing) return existing;
    // Yield inside the critical section to reproduce the original race window.
    await Promise.resolve();
    const created = { id: `bug-${++creates}`, title: "same report" };
    reports.push(created);
    return created;
  });

  const [first, second] = await Promise.all([file(), file()]);
  assert.equal(first.id, second.id);
  assert.equal(creates, 1);
  assert.equal(reports.length, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function workerHarness({ cached = new Map(), fetchImpl = async () => { throw new Error("offline"); } } = {}) {
  const handlers = new Map();
  const cacheMatches = [];
  const cachePuts = [];
  const networkRequests = [];
  const responseError = { kind: "response-error" };
  const context = {
    URL,
    location: { origin: "https://app.test" },
    Response: { error: () => responseError },
    fetch: async (request) => {
      networkRequests.push(request);
      return fetchImpl(request);
    },
    caches: {
      keys: async () => [],
      delete: async () => true,
      match: async (key) => {
        cacheMatches.push(key);
        const cacheKey = typeof key === "string" ? key : new URL(key.url).pathname;
        return cached.get(cacheKey);
      },
      open: async () => ({ put: async (request, response) => { cachePuts.push([request, response]); } }),
    },
    self: {
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
  };
  vm.runInNewContext(source, context, { filename: "public/sw.js" });
  return { handlers, cacheMatches, cachePuts, networkRequests, responseError };
}

function request(path, overrides = {}) {
  return {
    url: `https://app.test${path}`,
    method: "GET",
    mode: "cors",
    destination: "script",
    ...overrides,
  };
}

function dispatchFetch(handler, req) {
  let response;
  handler({ request: req, respondWith: (promise) => { response = Promise.resolve(promise); } });
  return response;
}

test("offline navigations may fall back to the cached app shell", async () => {
  const shell = { kind: "index" };
  const harness = workerHarness({ cached: new Map([["/index.html", shell]]) });
  const result = await dispatchFetch(
    harness.handlers.get("fetch"),
    request("/admin/today", { mode: "navigate", destination: "document" }),
  );
  assert.equal(result, shell);
  assert.ok(harness.cacheMatches.includes("/index.html"));
});

test("offline script requests never receive index.html as a fallback", async () => {
  const shell = { kind: "index" };
  const harness = workerHarness({ cached: new Map([["/index.html", shell]]) });
  const result = await dispatchFetch(harness.handlers.get("fetch"), request("/assets/old-hash.js"));
  assert.equal(result, harness.responseError);
  assert.equal(harness.cacheMatches.includes("/index.html"), false);
});

test("an exact cached script is returned without consulting the app shell", async () => {
  const script = { kind: "javascript" };
  const harness = workerHarness({ cached: new Map([["/assets/app.js", script], ["/index.html", { kind: "index" }]]) });
  const result = await dispatchFetch(harness.handlers.get("fetch"), request("/assets/app.js"));
  assert.equal(result, script);
  assert.equal(harness.cacheMatches.includes("/index.html"), false);
});

test("API and non-GET requests are never intercepted", () => {
  const harness = workerHarness();
  assert.equal(dispatchFetch(harness.handlers.get("fetch"), request("/api/chat")), undefined);
  assert.equal(dispatchFetch(harness.handlers.get("fetch"), request("/admin/today", { method: "POST", destination: "document" })), undefined);
  assert.equal(harness.networkRequests.length, 0);
});

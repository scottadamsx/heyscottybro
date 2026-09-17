// node --test scripts/orbit-route.test.js — the Vercel rewrite hands Orbit's router the path it expects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { orbitUrl } from "../api/orbit.js";

test("rewritten request gets its sub-path back", () => {
  assert.equal(orbitUrl("/api/orbit?__orbit=people/amy"), "/api/orbit/people/amy");
  assert.equal(orbitUrl("/api/orbit?__orbit=people/amy&allowDuplicate=1"), "/api/orbit/people/amy?allowDuplicate=1");
  assert.equal(orbitUrl("/api/orbit?__orbit=ai/interview"), "/api/orbit/ai/interview");
});

test("a request that kept its original path is left alone", () => {
  assert.equal(orbitUrl("/api/orbit/people"), "/api/orbit/people");
  assert.equal(orbitUrl("/api/orbit/people?__orbit=people"), "/api/orbit/people");
  assert.equal(orbitUrl("/api/orbit/import?apply=1"), "/api/orbit/import?apply=1");
});

test("the bare root stays the root", () => {
  assert.equal(orbitUrl("/api/orbit?__orbit="), "/api/orbit/");
  assert.equal(orbitUrl("/api/orbit"), "/api/orbit");
});

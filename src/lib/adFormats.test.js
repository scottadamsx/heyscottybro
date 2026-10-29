// Unit tests for the Ad Formats library data (src/lib/adFormats.js).
// Run with: node src/lib/adFormats.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import { AD_FORMATS, AD_FORMAT_BUSINESSES, filterAdFormats } from "./adFormats.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

test("the library holds exactly 32 formats", () => {
  eq(AD_FORMATS.length, 32);
});

test("numbers are the legible reel numbers: 1-31 and 34, each once, in order", () => {
  const expected = [...Array(31)].map((_, i) => i + 1).concat(34);
  eq(JSON.stringify(AD_FORMATS.map((f) => f.n)), JSON.stringify(expected));
});

test("every entry carries a name, a business, a description, and an example", () => {
  for (const f of AD_FORMATS) {
    for (const field of ["name", "business", "description", "example"]) {
      assert(typeof f[field] === "string" && f[field].trim().length > 0, `#${f.n} is missing ${field}`);
    }
  }
});

test("names are unique", () => {
  eq(new Set(AD_FORMATS.map((f) => f.name)).size, AD_FORMATS.length);
});

test("businesses come only from Scott's four, eight examples each", () => {
  for (const f of AD_FORMATS) assert(AD_FORMAT_BUSINESSES.includes(f.business), `#${f.n} has an unknown business`);
  for (const b of AD_FORMAT_BUSINESSES) {
    eq(AD_FORMATS.filter((f) => f.business === b).length, 8, `${b} should carry eight examples`);
  }
});

test("descriptions stay short: one to two sentences each", () => {
  for (const f of AD_FORMATS) {
    assert(f.description.length >= 60, `#${f.n} description looks too thin`);
    assert(f.description.length <= 340, `#${f.n} description runs long`);
  }
});

test("filter: a blank query returns the full list", () => {
  eq(filterAdFormats(AD_FORMATS, "").length, 32);
  eq(filterAdFormats(AD_FORMATS, "   ").length, 32);
  eq(filterAdFormats(AD_FORMATS, undefined).length, 32);
});

test("filter: matches name, business, description, and example, case-insensitively", () => {
  eq(filterAdFormats(AD_FORMATS, "tier list").length, 1);
  eq(filterAdFormats(AD_FORMATS, "TIER").length, 1);
  eq(filterAdFormats(AD_FORMATS, "bonsai").length, 8);
  eq(filterAdFormats(AD_FORMATS, "receipt").length, 1);
});

test("filter: no match returns an empty list, never a fallback", () => {
  eq(filterAdFormats(AD_FORMATS, "zzz-no-such-thing").length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

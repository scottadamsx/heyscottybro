// Unit tests for the Client Finder playbook data (src/lib/clientFinder.js).
// Run with: node src/lib/clientFinder.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import {
  HARVEY, VERDICT_POINTS, WORKFLOW_STEPS, ICP_INTRO, ICP_FIELDS,
  ICP_FIT_SIGNALS, PROSPECT_FIELDS, EXAMPLE_EMAIL, GUARDRAILS,
} from "./clientFinder.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

test("Harvey header carries the verified repo facts (checked Nov 4, 2026)", () => {
  eq(HARVEY.repoUrl, "https://github.com/ethanplusai/harvey");
  eq(HARVEY.stats.license, "MIT");
  eq(HARVEY.stats.language, "Python");
  eq(HARVEY.stats.stars, "4,361");
  eq(HARVEY.stats.forks, "912");
  eq(HARVEY.stats.created, "Mar 12, 2026");
  eq(HARVEY.stats.lastPush, "Nov 2, 2026");
  eq(HARVEY.stats.verifiedOn, "Nov 4, 2026");
  assert(HARVEY.summary.trim().length > 0, "summary is missing");
});

test("the verdict holds three points: real tool, demo-only proof, no keyword engagement", () => {
  eq(VERDICT_POINTS.length, 3);
  for (const p of VERDICT_POINTS) assert(typeof p === "string" && p.trim().length > 0, "empty verdict point");
  assert(VERDICT_POINTS[1].includes(".test"), "the demo-only point should name the .test evidence");
});

test("the workflow holds exactly 9 steps, numbered 1 to 9 in order", () => {
  eq(WORKFLOW_STEPS.length, 9);
  eq(JSON.stringify(WORKFLOW_STEPS.map((s) => s.n)), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9]));
});

test("step titles are unique and every step carries a description", () => {
  eq(new Set(WORKFLOW_STEPS.map((s) => s.title)).size, WORKFLOW_STEPS.length);
  for (const s of WORKFLOW_STEPS) {
    assert(typeof s.title === "string" && s.title.trim().length > 0, `step ${s.n} is missing a title`);
    assert(typeof s.description === "string" && s.description.trim().length > 0, `step ${s.n} is missing a description`);
  }
});

test("the ICP names industries, cities, company size, and the offer, in that order", () => {
  assert(ICP_INTRO.trim().length > 0, "ICP intro is missing");
  eq(JSON.stringify(ICP_FIELDS.map((f) => f.label)), JSON.stringify(["Industries", "Cities", "Company size", "The offer"]));
  for (const f of ICP_FIELDS) assert(f.value.trim().length > 0, `${f.label} has no value`);
  const offer = ICP_FIELDS.find((f) => f.label === "The offer").value;
  assert(offer.includes("free upfront"), "the offer must state the free build");
  assert(offer.includes("$300"), "the offer must state the $300 price");
  assert(offer.includes("$50 per month"), "the offer must state the $50 per month care");
});

test("the ICP fit signals list five non-empty signals, phone-only booking among them", () => {
  eq(ICP_FIT_SIGNALS.length, 5);
  for (const s of ICP_FIT_SIGNALS) assert(typeof s === "string" && s.trim().length > 0, "empty fit signal");
  assert(ICP_FIT_SIGNALS.some((s) => s.toLowerCase().includes("phone-only")), "phone-only booking must be a fit signal");
});

test("the prospect checklist is the exact 9 fields Harvey collects", () => {
  eq(JSON.stringify(PROSPECT_FIELDS), JSON.stringify([
    "Business name", "Owner name and title", "Verified email", "Rating",
    "Review count", "Category", "Address", "Opening hours", "Phone",
  ]));
});

test("the example email is a marked draft on Scott's approved terms", () => {
  assert(EXAMPLE_EMAIL.note.toLowerCase().includes("draft example"), "the email must be marked as a draft example");
  assert(EXAMPLE_EMAIL.note.toLowerCase().includes("fictional"), "the email must say the business is fictional");
  assert(EXAMPLE_EMAIL.subject.trim().length > 0, "subject is missing");
  const body = EXAMPLE_EMAIL.body.join("\n");
  assert(body.includes("only reach you by phone"), "the email must name the phone-only gap");
  assert(body.includes("free upfront"), "the email must offer the free build");
  assert(body.includes("$300") && body.includes("$50 a month"), "the email must carry the $300 / $50 terms");
  eq(EXAMPLE_EMAIL.body[EXAMPLE_EMAIL.body.length - 1], "Scott Adams", "the email must sign off as Scott Adams");
});

test("the guardrails keep sending and replies off and name the approval rule and CASL", () => {
  eq(GUARDRAILS.length, 5);
  for (const g of GUARDRAILS) assert(typeof g === "string" && g.trim().length > 0, "empty guardrail");
  const joined = GUARDRAILS.join(" ");
  assert(joined.includes("Automatic sending stays OFF"), "sending must be off");
  assert(joined.includes("Automatic replies stay OFF"), "replies must be off");
  assert(joined.includes("approves the outreach kit and every batch"), "the approval rule must be stated");
  assert(joined.includes("CASL"), "CASL must be named");
});

test("no em dash character appears anywhere in the page content", () => {
  const everything = JSON.stringify({
    HARVEY, VERDICT_POINTS, WORKFLOW_STEPS, ICP_INTRO, ICP_FIELDS,
    ICP_FIT_SIGNALS, PROSPECT_FIELDS, EXAMPLE_EMAIL, GUARDRAILS,
  });
  assert(!everything.includes("—"), "an em dash slipped into the content");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkifySegments } from "./linkify.js";

const hrefs = (segs) => segs.filter((s) => s.href).map((s) => s.href);
const roundTrip = (segs) => segs.map((s) => s.text).join("");

test("the Concept 11 note links its full bundle URL (BUG-082)", () => {
  const note = "Open the matching Library PDF: 011-timeouts.pdf. Bundle: https://chatgpt.com/library?file_id=libfile_57fdcdc80fcc819laafd09252d683995&account_id=personal";
  const segs = linkifySegments(note);
  assert.deepEqual(hrefs(segs), ["https://chatgpt.com/library?file_id=libfile_57fdcdc80fcc819laafd09252d683995&account_id=personal"]);
  assert.equal(roundTrip(segs), note);
});

test("trailing sentence punctuation stays outside the link (BUG-082)", () => {
  const segs = linkifySegments("See https://example.com/a?x=1. Then rest");
  assert.deepEqual(hrefs(segs), ["https://example.com/a?x=1"]);
  assert.equal(roundTrip(segs), "See https://example.com/a?x=1. Then rest");
});

test("a closing parenthesis after a URL stays outside the link (BUG-082)", () => {
  const segs = linkifySegments("(details at https://example.com/spec)");
  assert.deepEqual(hrefs(segs), ["https://example.com/spec"]);
});

test("balanced parentheses inside a URL are kept (BUG-082)", () => {
  const segs = linkifySegments("https://example.com/wiki/Foo_(bar) end");
  assert.deepEqual(hrefs(segs), ["https://example.com/wiki/Foo_(bar)"]);
});

test("text without URLs is returned unchanged as one segment (BUG-082)", () => {
  assert.deepEqual(linkifySegments("Just a plain note."), [{ text: "Just a plain note." }]);
  assert.deepEqual(linkifySegments(""), []);
});

test("multiple URLs each become links, and non-http schemes never do (BUG-082)", () => {
  const segs = linkifySegments("a https://one.example/x b http://two.example/y c javascript:alert(1) d ftp://three.example/z");
  assert.deepEqual(hrefs(segs), ["https://one.example/x", "http://two.example/y"]);
});

test("the task detail Notes render through LinkifiedText (BUG-082)", () => {
  const page = readFileSync(new URL("../pages/admin/TaskDetailPage.jsx", import.meta.url), "utf8");
  assert.match(page, /<LinkifiedText text=\{task\.description\} className="task-detail-notes" \/>/);
});

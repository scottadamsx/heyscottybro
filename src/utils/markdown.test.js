import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown.js";

test("normal HTTPS links remain clickable and preserve query parameters", () => {
  assert.equal(
    renderMarkdown("[Open docs](https://example.com/guide?one=1&two=2#start)"),
    '<p><a href="https://example.com/guide?one=1&amp;two=2#start" target="_blank" rel="noreferrer">Open docs</a></p>',
  );
});

test("only the owner-app uploaded-document deep link is accepted as a local link", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(
    renderMarkdown(`[Open screenshot](/admin/vault?tab=documents&open=${id})`),
    `<p><a href="/admin/vault?tab=documents&amp;open=${id}">Open screenshot</a></p>`,
  );
  for (const href of ["/admin/vault", "/admin/other?open=" + id, "//evil.example/admin/vault?tab=documents&open=" + id, "/admin/vault?tab=documents&open=../../etc"]) {
    assert.equal(renderMarkdown(`[unsafe](${href})`).includes("<a "), false, href);
  }
});

test("quotes and tag text cannot break out of the href attribute", () => {
  const html = renderMarkdown('[click](https://example.com/"><img/src=x/onerror=evil>)');
  assert.equal(
    html,
    '<p><a href="https://example.com/&quot;&gt;&lt;img/src=x/onerror=evil&gt;" target="_blank" rel="noreferrer">click</a></p>',
  );
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.equal(html.includes("<img"), false);
  assert.equal(/\sonerror\s*=/.test(html), false);
});

test("unsafe and relative URL schemes remain inert text", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "vbscript:msgbox(1)",
    "//example.com/path",
  ]) {
    const html = renderMarkdown(`[unsafe](${href})`);
    assert.equal(html.includes("<a "), false, href);
    assert.match(html, /\[unsafe\]/);
  }
});

test("balanced parentheses in an HTTPS destination are parsed as one safe link", () => {
  assert.equal(
    renderMarkdown("[reference](https://example.com/wiki/Function_(mathematics))"),
    '<p><a href="https://example.com/wiki/Function_(mathematics)" target="_blank" rel="noreferrer">reference</a></p>',
  );
});

test("malformed HTTPS destinations and HTML in labels fail closed", () => {
  assert.equal(renderMarkdown("[bad](https://)"), "<p>[bad](https://)</p>");
  assert.equal(
    renderMarkdown("[<script>](https://example.com)"),
    '<p><a href="https://example.com" target="_blank" rel="noreferrer">&lt;script&gt;</a></p>',
  );
});

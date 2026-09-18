import { test } from "node:test";
import assert from "node:assert/strict";
import { tagOutboundHref, campaignForPath, isOutbound, hasAuthMaterial, isExcludedPage } from "./utm.js";

const origin = "https://heyscottybro.com";
const tag = (href, pathname = "/sjhc") => tagOutboundHref(href, { origin, pathname });

test("adds source, medium and the page as campaign to an outbound https link", () => {
  const out = new URL(tag("https://stjohnshikeclub.com/events?x=1#top"));
  assert.equal(out.searchParams.get("utm_source"), "heyscottybro");
  assert.equal(out.searchParams.get("utm_medium"), "referral");
  assert.equal(out.searchParams.get("utm_campaign"), "sjhc");
  assert.equal(out.searchParams.get("x"), "1");
  assert.equal(out.hash, "#top");
});

test("campaign is the first path segment, or home", () => {
  assert.equal(campaignForPath("/"), "home");
  assert.equal(campaignForPath("/guide/step/brief"), "guide");
  assert.equal(campaignForPath("/never86"), "never86");
  assert.equal(new URL(tag("http://never86.ca", "/")).searchParams.get("utm_campaign"), "home");
});

test("never overwrites existing utm params, fills only the missing ones", () => {
  const out = new URL(tag("https://example.com/?utm_source=newsletter&utm_campaign=spring"));
  assert.equal(out.searchParams.get("utm_source"), "newsletter");
  assert.equal(out.searchParams.get("utm_campaign"), "spring");
  assert.equal(out.searchParams.get("utm_medium"), "referral");
  const full = "https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c";
  assert.equal(tag(full), full, "fully tagged link is returned untouched");
});

test("leaves mailto, tel, javascript, relative and same-origin links alone", () => {
  for (const href of ["mailto:scottadamsx@gmail.com", "tel:7097302937", "javascript:void(0)", "/guide", "#main", "https://heyscottybro.com/games", "//heyscottybro.com/sjhc"]) {
    assert.equal(tag(href), href, href);
  }
  assert.equal(isOutbound("/guide", origin), false);
  assert.equal(isOutbound("https://github.com/scotty3xe", origin), true);
});

test("leaves links carrying tokens or signatures alone", () => {
  const signed = [
    "https://abc.supabase.co/storage/v1/object/sign/docs/a.pdf?token=eyJhbGci",
    "https://bucket.s3.amazonaws.com/a.pdf?X-Amz-Signature=abc&X-Amz-Expires=60",
    "https://example.com/reset#access_token=abc&type=recovery",
    "https://example.com/callback?code=123&state=xyz",
    "https://acct.blob.core.windows.net/c/a.pdf?sv=2020&sig=abc",
    "https://user:pass@example.com/",
  ];
  for (const href of signed) {
    assert.equal(hasAuthMaterial(href, origin), true, href);
    assert.equal(tag(href), href, href);
  }
});

test("never rewrites anything on /admin or shared-document pages", () => {
  assert.equal(isExcludedPage("/admin/today"), true);
  assert.equal(isExcludedPage("/admin"), true);
  assert.equal(isExcludedPage("/doc/abc123"), true);
  assert.equal(isExcludedPage("/administrator-guide"), false);
  assert.equal(tag("https://github.com", "/admin/mission"), "https://github.com");
  assert.equal(tag("https://github.com", "/doc/tok"), "https://github.com");
});

test("bad input is returned as-is", () => {
  assert.equal(tagOutboundHref("", { origin }), "");
  assert.equal(tagOutboundHref("https://example.com", {}), "https://example.com");
  assert.equal(tag("http://[bad"), "http://[bad");
});

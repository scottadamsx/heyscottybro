import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHAT_MODAL_MEDIA,
  getChatLogA11y,
  getChatStatusAnnouncement,
  getFocusWrapIndex,
  getInitialChatFocusTarget,
  isChatModalViewport,
  shouldActivateChatLog,
  scrollChatToBottom,
} from "./chatBotUi.js";

const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const systemCss = readFileSync(new URL("../styles/system.css", import.meta.url), "utf8");
const chatBotSource = readFileSync(new URL("./ChatBot.jsx", import.meta.url), "utf8");

test("the Frodo modal breakpoint includes 900px but preserves desktop at 901px", () => {
  assert.equal(CHAT_MODAL_MEDIA, "(max-width: 900px)");
  assert.equal(isChatModalViewport(320), true);
  assert.equal(isChatModalViewport(900), true);
  assert.equal(isChatModalViewport(901), false);
});

test("touch and modal openings focus Close instead of the composer", () => {
  assert.equal(getInitialChatFocusTarget({ modal: true, touch: false }), "close");
  assert.equal(getInitialChatFocusTarget({ modal: false, touch: true }), "close");
  assert.equal(getInitialChatFocusTarget({ modal: false, touch: false }), "composer");
});

test("the conversation log stays quiet through hydration and activates only after opening settles", () => {
  assert.equal(shouldActivateChatLog({ open: true, hydrating: true, historyReady: false }), false);
  assert.equal(shouldActivateChatLog({ open: false, hydrating: false, historyReady: true }), false);
  assert.equal(shouldActivateChatLog({ open: true, hydrating: false, historyReady: true }), true);

  assert.deepEqual(getChatLogA11y({ active: false, busy: true }), {
    role: "log",
    "aria-live": "off",
    "aria-relevant": "additions text",
    "aria-atomic": false,
    "aria-busy": true,
  });
  assert.deepEqual(getChatLogA11y({ active: true, busy: false }), {
    role: "log",
    "aria-live": "polite",
    "aria-relevant": "additions text",
    "aria-atomic": false,
    "aria-busy": undefined,
  });
});

test("Frodo work status has a concise dedicated announcement", () => {
  assert.equal(getChatStatusAnnouncement({ loading: false, status: "thinking…" }), "");
  assert.equal(getChatStatusAnnouncement({ loading: true }), "Frodo is working.");
  assert.equal(getChatStatusAnnouncement({ loading: true, status: "checking the plan…" }), "Frodo: checking the plan…");
});

test("the mobile chat header target outranks the later shared 28px mini control", () => {
  const mobileMediaAt = indexCss.indexOf("@media (max-width: 900px)");
  const mobileSelector = ".admin-shell .chat-header-actions .btn-mini";
  const mobileRuleAt = indexCss.indexOf(mobileSelector, mobileMediaAt);
  assert.ok(mobileMediaAt >= 0 && mobileRuleAt > mobileMediaAt);

  const mobileDeclarations = indexCss.slice(indexCss.indexOf("{", mobileRuleAt) + 1, indexCss.indexOf("}", mobileRuleAt));
  assert.match(mobileDeclarations, /min-width:\s*44px/);
  assert.match(mobileDeclarations, /min-height:\s*44px/);

  const sharedSelector = ".admin-shell .btn-mini";
  const sharedRuleAt = systemCss.indexOf(`${sharedSelector},\n.admin-shell .btn-tiny-blue`);
  assert.ok(sharedRuleAt >= 0);
  const sharedDeclarations = systemCss.slice(systemCss.indexOf("{", sharedRuleAt) + 1, systemCss.indexOf("}", sharedRuleAt));
  assert.match(sharedDeclarations, /min-height:\s*28px/);
  assert.ok((mobileSelector.match(/\./g) || []).length > (sharedSelector.match(/\./g) || []).length);
});

test("focus wrapping stays inside the first and last dialog controls", () => {
  assert.equal(getFocusWrapIndex(0, 4, true), 3);
  assert.equal(getFocusWrapIndex(3, 4, false), 0);
  assert.equal(getFocusWrapIndex(1, 4, false), -1);
  assert.equal(getFocusWrapIndex(-1, 4, false), 0);
  assert.equal(getFocusWrapIndex(-1, 4, true), 3);
  assert.equal(getFocusWrapIndex(0, 0, false), -1);
});

test("bottom scrolling moves only the supplied message container", () => {
  let options;
  const scroller = {
    scrollHeight: 2400,
    scrollTo(next) { options = next; },
  };

  assert.equal(scrollChatToBottom(scroller, "smooth"), true);
  assert.deepEqual(options, { top: 2400, behavior: "smooth" });
  assert.equal(scrollChatToBottom(null), false);
});

test("bottom scrolling supports containers without scrollTo", () => {
  const scroller = { scrollHeight: 720, scrollTop: 0 };
  scrollChatToBottom(scroller);
  assert.equal(scroller.scrollTop, 720);
});

test("assembled Frodo rendering covers local and saved attachment previews", () => {
  assert.match(chatBotSource, /<img src=\{s\.dataUrl\} alt="screenshot"/, "pre-send attachments must render from local normalized bytes");
  assert.match(chatBotSource, /<SavedAttachmentPreview key=\{preview\.path \|\| j\}/, "hydrated messages must use the saved-preview boundary");
  assert.match(chatBotSource, /onError=\{onImageError\}/, "saved image-element failures must enter recovery");
  assert.match(chatBotSource, /refreshSavedAttachmentPreview\(preview, \(path\) => signChatAttachment\(path, 3600\)\)/, "recovery must re-sign the owner-checked stored path");
  assert.match(chatBotSource, /aria-label=\{`Retry attached screenshot/, "persistent failure must expose an accessible retry");
});

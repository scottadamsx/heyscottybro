import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentAttachmentSnapshot,
  agentAttachmentIntakePolicy,
  beginAgentAttachmentWork,
  bindAgentAttachmentDraft,
  canSendOriginalImage,
  canBeginAttachmentSafeClear,
  chatAttachmentDraftAfterClear,
  chatStagingPathsFromDisplay,
  clearAgentAttachments,
  createAgentAttachmentDraft,
  finishAgentAttachmentWork,
  hasPendingAttachmentWork,
  hydrateDisplayAttachments,
  isHeicFile,
  publishAgentAttachment,
  serializeDisplayMessages,
  stagingPathsEvictedByDisplayLimit,
  undecodableImageMessage,
  visionAttachmentsFromShots,
} from "./chatAttachments.js";

function shot(id) {
  return { id, dataUrl: `data:image/png;base64,${id}`, media_type: "image/png" };
}

function addReadyShot(draft, agentId, id) {
  const started = beginAgentAttachmentWork(draft, agentId);
  draft = publishAgentAttachment(started.draft, started.token, shot(id));
  return finishAgentAttachmentWork(draft, started.token);
}

function draftWithReadyShot(agentId, id) {
  return addReadyShot(createAgentAttachmentDraft(agentId), agentId, id);
}

test("an immediate agent switch never exposes or sends the previous agent's ready shots", () => {
  const agentA = draftWithReadyShot("agent-a", "a-ready");
  const agentB = bindAgentAttachmentDraft(agentA, "agent-b");

  assert.deepEqual(agentAttachmentSnapshot(agentB, "agent-b").shots, []);
  assert.deepEqual(agentAttachmentSnapshot(agentB, "agent-a").shots, []);
  assert.deepEqual(visionAttachmentsFromShots(agentAttachmentSnapshot(agentB, "agent-b").shots), []);
});

test("deferred normalization cannot publish an old agent's shot after a switch", () => {
  const started = beginAgentAttachmentWork(createAgentAttachmentDraft("agent-a"), "agent-a");
  const agentB = bindAgentAttachmentDraft(started.draft, "agent-b");
  const returnedToAgentA = bindAgentAttachmentDraft(agentB, "agent-a");
  const latePublish = publishAgentAttachment(returnedToAgentA, started.token, shot("late-a"));
  const lateSettlement = finishAgentAttachmentWork(latePublish, started.token);

  assert.equal(latePublish, returnedToAgentA, "the stale publish is ignored even after returning to the same owner");
  assert.equal(lateSettlement, returnedToAgentA, "the stale generation cannot mutate the new draft's counters");
  assert.deepEqual(agentAttachmentSnapshot(lateSettlement, "agent-a").shots, []);
});

test("agent A's awaited send completion cannot erase new agent B shots", () => {
  const agentA = draftWithReadyShot("agent-a", "a-send");
  const sendToken = agentAttachmentSnapshot(agentA, "agent-a").token;
  const agentB = addReadyShot(bindAgentAttachmentDraft(agentA, "agent-b"), "agent-b", "b-new");

  const afterOldSend = clearAgentAttachments(agentB, sendToken);
  assert.equal(afterOldSend, agentB);
  assert.deepEqual(agentAttachmentSnapshot(afterOldSend, "agent-b").shots, [shot("b-new")]);
});

test("agent A's awaited Clear completion cannot erase new agent B shots", () => {
  const agentA = draftWithReadyShot("agent-a", "a-clear");
  const clearToken = agentAttachmentSnapshot(agentA, "agent-a").token;
  const agentB = addReadyShot(bindAgentAttachmentDraft(agentA, "agent-b"), "agent-b", "b-new");

  const afterOldClear = clearAgentAttachments(agentB, clearToken);
  assert.equal(afterOldClear, agentB);
  assert.deepEqual(agentAttachmentSnapshot(afterOldClear, "agent-b").shots, [shot("b-new")]);
});

test("an authoritative Clear resets local shots even when cleanup only warns", () => {
  const result = {
    cleared: true,
    cleanupWarning: new Error("staging cleanup needs a retry"),
  };
  const reset = chatAttachmentDraftAfterClear(
    result,
    [shot("deleted-evidence")],
    ["owner/_staging/deleted-evidence.png"],
  );

  assert.deepEqual(reset, { shots: [], stagedPaths: [] });
  assert.deepEqual(visionAttachmentsFromShots(reset.shots), [], "deleted evidence cannot be resent");
});

test("a delayed same-agent send rejects late paste and drop intake visibly", () => {
  const sentDraft = draftWithReadyShot("agent-a", "sent");
  const sendToken = agentAttachmentSnapshot(sentDraft, "agent-a").token;
  const duringSend = agentAttachmentIntakePolicy({ busy: true, mutationInFlight: true });

  assert.equal(duringSend.allowed, false);
  assert.match(duringSend.message, /finish working/i, "paste/drop rejection is not silent");

  const afterSend = clearAgentAttachments(sentDraft, sendToken);
  assert.deepEqual(agentAttachmentSnapshot(afterSend, "agent-a").shots, []);
  assert.equal(
    agentAttachmentIntakePolicy({ busy: false, mutationInFlight: false }).allowed,
    true,
    "new intake reopens only after the old send settles",
  );
});

test("a failed durable Clear retains the local attachment draft for retry", () => {
  const shots = [shot("still-durable")];
  const stagedPaths = ["owner/_staging/still-durable.png"];
  assert.deepEqual(chatAttachmentDraftAfterClear({ cleared: false }, shots, stagedPaths), {
    shots,
    stagedPaths,
  });
});

test("send stays blocked until every attachment preparation and upload settles", () => {
  assert.equal(hasPendingAttachmentWork([{ uploading: true }], 0), true);
  assert.equal(hasPendingAttachmentWork([], 1), true, "work remains pending after a thumbnail is removed");
  assert.equal(hasPendingAttachmentWork([{ uploading: false }], 0), false);
});

test("Clear cannot begin while ref-backed preparation or rendered staging is active", () => {
  assert.equal(canBeginAttachmentSafeClear([], 1), false, "same-tick work ref closes the pre-render race");
  assert.equal(canBeginAttachmentSafeClear([{ uploading: true }], 0), false);
  assert.equal(canBeginAttachmentSafeClear([{ uploading: false }], 0), true);
});

test("supported bytes are sent even when storage staging failed", () => {
  const attachments = visionAttachmentsFromShots([{
    dataUrl: "data:image/png;base64,c3VwcG9ydGVkLWJ5dGVz",
    media_type: "image/png",
    path: null,
    failed: true,
    name: "screenshot.png",
  }]);
  assert.deepEqual(attachments, [{
    media_type: "image/png",
    data: "c3VwcG9ydGVkLWJ5dGVz",
    name: "screenshot.png",
  }]);
});

test("unsupported bytes are never presented as vision attachments", () => {
  assert.deepEqual(visionAttachmentsFromShots([{
    dataUrl: "data:image/heic;base64,aGVpYw==",
    media_type: "image/heic",
  }]), []);
  assert.equal(canSendOriginalImage({ type: "image/heic" }), false);
  assert.equal(canSendOriginalImage({ type: "image/jpeg" }), true);
});

test("undecodable HEIC receives an actionable JPEG/PNG request", () => {
  const file = { name: "IMG 0042 (1).HEIC", type: "image/heic" };
  assert.equal(isHeicFile(file), true);
  assert.match(undecodableImageMessage(file), /Export it as JPEG or PNG and try again/);
});

test("serialized display keeps only versioned metadata, never data URLs or bytes", () => {
  const display = serializeDisplayMessages([{
    role: "user",
    text: "look",
    images: ["data:image/png;base64,SECRET_BYTES"],
    attachments: [{
      path: "owner-1/_staging/1-one.png",
      media_type: "image/png",
      name: "one.png",
      size: 25,
      data: "SECRET_BYTES",
      signedUrl: "temporary-secret-url",
    }],
  }]);

  assert.deepEqual(display, [{
    role: "user",
    text: "look",
    shots: 1,
    attachments: [{
      version: 1,
      path: "owner-1/_staging/1-one.png",
      media_type: "image/png",
      name: "one.png",
      size: 25,
    }],
  }]);
  assert.equal(JSON.stringify(display).includes("SECRET_BYTES"), false);
  assert.equal(JSON.stringify(display).includes("temporary-secret-url"), false);
});

test("saved metadata rehydrates signed previews and reports individual failures", async () => {
  const rows = [{
    role: "user",
    attachments: [
      { path: "owner-1/_staging/1-one.png", media_type: "image/png", name: "one.png" },
      { path: "owner-1/_staging/2-two.png", media_type: "image/png", name: "two.png" },
    ],
  }];
  const result = await hydrateDisplayAttachments(rows, async (path) => {
    if (path.includes("2-two")) throw new Error("sign denied");
    return `signed:${path}`;
  });

  assert.deepEqual(result.display[0].images, ["signed:owner-1/_staging/1-one.png"]);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].path, "owner-1/_staging/2-two.png");
});

test("unknown attachment metadata versions fail explicitly instead of being guessed", async () => {
  let signed = false;
  const result = await hydrateDisplayAttachments([{
    role: "user",
    attachments: [{
      version: 99,
      path: "owner-1/_staging/1-one.png",
      media_type: "image/png",
    }],
  }], async () => { signed = true; return "signed"; });

  assert.equal(signed, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].error.message, /Unsupported saved screenshot metadata version: 99/);
});

test("hydrate then serialize preserves unknown attachment metadata verbatim", async () => {
  const unknown = {
    version: 99,
    path: "owner-1/future-location/1-one.avif",
    media_type: "image/avif",
    future_field: { keep: "exactly" },
  };
  const hydrated = await hydrateDisplayAttachments([{
    role: "user",
    text: "future attachment",
    attachments: [unknown],
  }], async () => { throw new Error("must not sign unknown metadata"); });

  assert.deepEqual(serializeDisplayMessages(hydrated.display), [{
    role: "user",
    text: "future attachment",
    attachments: [unknown],
  }]);
});

test("clear cleanup finds each persisted staging path once", () => {
  assert.deepEqual(chatStagingPathsFromDisplay([
    { attachments: [{ path: "owner-1/_staging/1-one.png" }] },
    { attachments: [
      { path: "owner-1/_staging/1-one.png" },
      { path: "owner-1/bug-1/2-two.png" },
    ] },
  ]), ["owner-1/_staging/1-one.png"]);
});

test("display truncation removes only evicted staging objects after retention", () => {
  const evictedOnly = "owner-1/_staging/evicted.png";
  const shared = "owner-1/_staging/shared.png";
  const retainedOnly = "owner-1/_staging/retained.png";
  const rows = [
    { attachments: [{ path: evictedOnly }, { path: shared }] },
    ...Array.from({ length: 199 }, () => ({ role: "assistant", text: "filler" })),
    { attachments: [{ path: shared }, { path: retainedOnly }] },
  ];

  assert.deepEqual(stagingPathsEvictedByDisplayLimit(rows, 200), [evictedOnly]);
});

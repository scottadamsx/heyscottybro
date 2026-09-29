import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearAllAIChatHistory,
  GLOBAL_CHAT_CLEAR_CONFIRMATION,
  GLOBAL_CHAT_CLEAR_SUCCESS,
  registerFrodoHistoryController,
} from "./globalChatHistory.js";

test("global Clear copy states the owner and quarantine boundaries", () => {
  assert.match(GLOBAL_CHAT_CLEAR_CONFIRMATION, /this account/i);
  assert.match(GLOBAL_CHAT_CLEAR_CONFIRMATION, /quarantined.*stay untouched/i);
  assert.match(GLOBAL_CHAT_CLEAR_SUCCESS, /this account/i);
  assert.match(GLOBAL_CHAT_CLEAR_SUCCESS, /quarantined unowned backups.*left untouched/i);
  assert.doesNotMatch(GLOBAL_CHAT_CLEAR_SUCCESS, /^all app chat history/i);
});

test("global Clear preflights both mounted runtimes before deleting anything", async () => {
  const events = [];
  const unregister = registerFrodoHistoryController({
    prepare() { events.push("frodo:ready"); return "frodo-plan"; },
    cancel() { events.push("frodo:cancel"); },
    clear(plan) { assert.equal(plan, "frodo-plan"); events.push("frodo:clear"); },
  });
  try {
    await assert.rejects(clearAllAIChatHistory({
      prepareBankerClear() { events.push("banker:ready"); return "banker-plan"; },
      cancelBankerClear() { events.push("banker:cancel"); },
      prepareCommandCenterClear() { events.push("cc:blocked"); throw new Error("agent busy"); },
      clearCommandCenter() { events.push("cc:clear"); },
      clearBanker() { events.push("banker:clear"); },
    }), /agent busy/);
    assert.deepEqual(events, ["frodo:ready", "banker:ready", "cc:blocked", "frodo:cancel", "banker:cancel"]);
  } finally {
    unregister();
  }
});

test("global Clear runs every surface and reports partial failures and cleanup warnings truthfully", async () => {
  const events = [];
  const unregister = registerFrodoHistoryController({
    prepare() { events.push("frodo:ready"); return "frodo-plan"; },
    async clear(plan) {
      assert.equal(plan, "frodo-plan");
      events.push("frodo:clear");
      return { cleared: true, cleanupWarning: new Error("staging retry") };
    },
  });
  try {
    const result = await clearAllAIChatHistory({
      prepareBankerClear() { events.push("banker:ready"); return "banker-plan"; },
      cancelBankerClear() { events.push("banker:cancel"); },
      prepareCommandCenterClear() { events.push("cc:ready"); return "cc-plan"; },
      async clearCommandCenter(plan) { assert.equal(plan, "cc-plan"); events.push("cc:clear"); throw new Error("row denied"); },
      clearBanker(plan) { assert.equal(plan, "banker-plan"); events.push("banker:clear"); },
    });
    assert.deepEqual(events, ["frodo:ready", "banker:ready", "cc:ready", "frodo:clear", "cc:clear", "banker:clear"]);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].label, "Command Center");
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].label, "Frodo");
  } finally {
    unregister();
  }
});

test("global Clear settles every surface when one clear throws synchronously", async () => {
  const events = [];
  const unregister = registerFrodoHistoryController({
    prepare() { events.push("frodo:ready"); return "frodo-plan"; },
    async clear() { events.push("frodo:clear:start"); await Promise.resolve(); events.push("frodo:clear:end"); },
  });
  try {
    const result = await clearAllAIChatHistory({
      prepareBankerClear() { events.push("banker:ready"); return "banker-plan"; },
      cancelBankerClear() { events.push("banker:cancel"); },
      prepareCommandCenterClear() { events.push("cc:ready"); return "cc-plan"; },
      async clearCommandCenter() { events.push("cc:clear:start"); await Promise.resolve(); events.push("cc:clear:end"); },
      clearBanker() { events.push("banker:clear"); throw new Error("session storage blocked"); },
    });

    assert.deepEqual(events, [
      "frodo:ready",
      "banker:ready",
      "cc:ready",
      "frodo:clear:start",
      "cc:clear:start",
      "banker:clear",
      "frodo:clear:end",
      "cc:clear:end",
    ]);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].label, "Griphook");
    assert.match(result.failures[0].error.message, /storage blocked/i);
  } finally {
    unregister();
  }
});

test("a busy Griphook cancels Frodo preflight before any deletion", async () => {
  const events = [];
  const unregister = registerFrodoHistoryController({
    prepare() { events.push("frodo:ready"); return "frodo-plan"; },
    cancel() { events.push("frodo:cancel"); },
    clear() { events.push("frodo:clear"); },
  });
  try {
    await assert.rejects(clearAllAIChatHistory({
      prepareBankerClear() { events.push("banker:busy"); throw new Error("Griphook is still working"); },
      cancelBankerClear() { events.push("banker:cancel"); },
      prepareCommandCenterClear() { events.push("cc:ready"); },
      clearCommandCenter() { events.push("cc:clear"); },
      clearBanker() { events.push("banker:clear"); },
    }), /still working/i);
    assert.deepEqual(events, ["frodo:ready", "banker:busy", "frodo:cancel"]);
  } finally {
    unregister();
  }
});

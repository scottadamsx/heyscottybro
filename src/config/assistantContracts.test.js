import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HABITS_COLLECTION_CONTRACT,
  LIFE_TABS,
  MEMORY_DISCLOSURE_CONTRACT,
  PRODUCT_SPACES,
  TASK_FACT_GROUNDING_CONTRACT,
  memoryDisclosurePromptBlock,
  productMapPromptBlock,
  taskFactGroundingPromptBlock,
} from "./assistantContracts.js";

const aiLibrarySource = readFileSync(new URL("../api/aiLibrary.js", import.meta.url), "utf8");
const aiToolsSource = readFileSync(new URL("../api/aiTools.js", import.meta.url), "utf8");
const missionSource = readFileSync(new URL("../pages/admin/MissionPage.jsx", import.meta.url), "utf8");
const commandPaletteSource = readFileSync(new URL("../components/CommandPalette.jsx", import.meta.url), "utf8");

test("Life exposes Habits from the shared product-map contract", () => {
  const life = PRODUCT_SPACES.find((space) => space.label === "Life");
  assert.ok(life, "Life must remain in the assistant product map");
  assert.equal(life.route, "/admin/life");
  assert.equal(life.tabs, LIFE_TABS, "the UI and assistant map must share one tab list");
  assert.deepEqual(LIFE_TABS.map(({ key, label }) => [key, label]), [
    ["journal", "Journal"],
    ["habits", "Habits"],
    ["arcade", "Arcade"],
  ]);
  assert.match(productMapPromptBlock(), /Life \(\/admin\/life — tabs Journal \(first\/default\), Habits, Arcade\)/);
});

test("the Library's shared habits catalog contract names its real product home", () => {
  assert.match(HABITS_COLLECTION_CONTRACT.description, /Life › Habits/);
  assert.deepEqual(HABITS_COLLECTION_CONTRACT.defaultFields, ["id", "name", "emoji", "mode", "created"]);
  assert.equal(HABITS_COLLECTION_CONTRACT.fields.name.required, true);
  assert.deepEqual(HABITS_COLLECTION_CONTRACT.fields.mode.values, ["check", "count"]);
});

test("task facts require a successful authoritative reminder query in the current turn", () => {
  const prompt = taskFactGroundingPromptBlock();
  assert.equal(TASK_FACT_GROUNDING_CONTRACT.tool, "query");
  assert.equal(TASK_FACT_GROUNDING_CONTRACT.collection, "reminders");
  assert.match(prompt, /successful query/);
  assert.match(prompt, /"reminders" collection in THIS turn/);
  assert.match(prompt, /Conversation history, memory, and the app map are not evidence/);
  assert.match(prompt, /If the query fails, do not guess or claim a result/);
  for (const claim of ["existence", "absence", "date", "time", "completion", "status", "count"]) {
    assert.match(prompt, new RegExp(`\\b${claim}\\b`));
  }
});

test("generic memory recall cannot volunteer physical or account-access secrets", () => {
  const prompt = memoryDisclosurePromptBlock();
  for (const category of [
    "passwords or credentials",
    "access or recovery codes",
    "physical key or spare-key locations",
    "security-question answers",
    "precise private locations",
    "health, medical, fitness, or body details",
    "financial or account details",
    "relationship or private contact details",
    "identity, legal, or private schedule details",
  ]) {
    assert.ok(MEMORY_DISCLOSURE_CONTRACT.neverVolunteer.includes(category));
    assert.match(prompt, new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(prompt, /generic recall, summaries, examples, proactive context/i);
  assert.match(prompt, /are NOT permission to reveal sensitive personal data or a secret/);
  assert.match(prompt, /only when Scott explicitly asks for that exact subject in the current turn/i);
  assert.match(prompt, /only when he asks for that exact secret/i);
  assert.match(prompt, /ordinary preferences, non-sensitive project context, app navigation facts/i);
  assert.match(prompt, /never repeat sensitive data while explaining a refusal/i);
});

test("the retired Bug Tracker has no live product, assistant, or command surface", () => {
  assert.doesNotMatch(aiLibrarySource, /\bbugs\s*:/);
  assert.doesNotMatch(aiToolsSource, /name:\s*["'](?:log_bug|export_bugs)["']/);
  assert.doesNotMatch(missionSource, /BugsPage|tab=build|["']build["']/);
  assert.doesNotMatch(commandPaletteSource, /Build \(Bugs\)|tab=build/);
  assert.match(commandPaletteSource, /\/admin\/analytics\?section=ai/);
});

test("Mission Control retains Brain, Inbox, and Research without the Agents page", () => {
  assert.doesNotMatch(missionSource, /CommandCenterPage|key:\s*["']agents["']|tab === ["']agents["']/);
  assert.match(missionSource, /const DEFAULT_TAB = ["']brain["']/);
  for (const tab of ["brain", "inbox", "research"]) assert.match(missionSource, new RegExp(`key: \\"${tab}\\"`));
  assert.doesNotMatch(commandPaletteSource, /label:\s*["']Agents["']/);
});

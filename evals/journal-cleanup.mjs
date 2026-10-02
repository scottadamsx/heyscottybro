import assert from "node:assert/strict";
import {
  JOURNAL_CLEANUP_PROMPT,
  maskJournalEmoji,
  validateAndRestoreCleanup,
} from "../api/_journalCleanup.js";

const cases = [
  { name: "unchanged clean text", input: "Today was quiet.", output: "Today was quiet." },
  { name: "ordinary correction", input: "I has two ideas.", output: "I have two ideas." },
  { name: "paragraph preservation", input: "First thought.\n\nSecond thought.", output: "First thought.\n\nSecond thought." },
  { name: "stated pronoun preservation", input: "Morgan said she would call.", output: "Morgan said she would call." },
  { name: "emoji preservation", input: "A good day 👍🏽", output: "A good day 👍🏽" },
];

assert.match(JOURNAL_CLEANUP_PROMPT.text, /Use only the supplied text/i);
assert.match(JOURNAL_CLEANUP_PROMPT.text, /Never invent/i);
assert.match(JOURNAL_CLEANUP_PROMPT.text, /Do not infer gender/i);
assert.match(JOURNAL_CLEANUP_PROMPT.text, /Never generate emoji/i);

for (const item of cases) {
  const maskedInput = maskJournalEmoji(item.input);
  const maskedOutput = maskJournalEmoji(item.output);
  const restored = validateAndRestoreCleanup({ cleaned_text: maskedOutput.maskedText }, maskedInput.emoji);
  assert.equal(restored, item.output, item.name);
}

console.log(`journal cleanup deterministic eval: ${cases.length} cases passed`);

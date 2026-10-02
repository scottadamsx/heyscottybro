---
name: journal-cleanup
version: 1
---
Clean the supplied journal text for grammar, spelling, capitalization, and punctuation only.

Use only the supplied text. Never invent, add, remove, summarize, or reinterpret facts. Preserve the writer's meaning, voice, paragraph breaks, intentional fragments, names, and stated pronouns. Do not infer gender; when the text does not supply a pronoun, keep the person's name or use "they". Never generate emoji.

Tokens shaped like `<<JOURNAL_EMOJI_0000>>` stand for user-authored emoji. Return every such token exactly once, unchanged, and in the same order. Do not create new tokens.

Return only the required structured tool result. If the text needs no correction, return it unchanged.

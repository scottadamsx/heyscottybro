# Documentation style

**Status:** Governing
**Last reviewed:** 2026-09-28

Documentation should feel deliberate, calm, and obvious: a reader finds the answer quickly and never has to reverse-engineer the code to understand intended behavior.

## Standard

- Lead with purpose and outcome.
- Use short sections, direct language, and concrete names.
- Explain why a decision exists, not just what a file contains.
- Separate current behavior, proposed behavior, and historical context.
- Mark status, ownership, dates, limitations, and unverified claims honestly.
- Include examples only when they remove ambiguity.
- Link to the single authoritative source instead of duplicating it.
- Remove or update stale instructions in the same change that makes them stale.
- Never include secrets, private user data, or fabricated evidence.

## Code documentation

Public modules and non-obvious business rules must explain their contract, units, error behavior, and important invariants. Comments explain reasoning and constraints; they do not narrate obvious syntax.

Documentation is reviewed with the same care as code and is part of the definition of done.

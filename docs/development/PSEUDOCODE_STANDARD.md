# Pseudocode standard

**Status:** Governing
**Last reviewed:** 2026-09-28

Pseudocode is the human-readable design contract between the request and the implementation. It is written before application code and approved by Scott.

## Required content

For each changed behavior, describe:

1. Trigger or entry point
2. Inputs and their source
3. Data preparation and business rules
4. User-visible states and transitions
5. Error, loading, and empty behavior
6. Mobile, keyboard, and accessibility behavior
7. Outputs or persisted changes
8. Invariants that must remain true
9. Tests that prove the behavior

## Style

Use plain language and domain names, not syntax disguised as prose. Keep it precise enough that another agent can implement it without inventing product behavior. Reference existing components or utilities that should be reused.

After implementation, update the pseudocode when the approved design changes. The final code, pseudocode, acceptance criteria, and tests must describe the same behavior.

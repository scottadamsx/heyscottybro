# Quality gates

**Status:** Governing
**Last reviewed:** 2026-09-28

## Every change

- Scope matches the approved feature document.
- Existing user changes are preserved.
- No secrets, silent fallback, dead controls, or optimistic success messages.
- Relevant documentation, work log, and bug ledger are updated.
- Diff is reviewed for unrelated changes before handoff.

## Logic or data behavior

- Add or update a focused regression test.
- Exercise success, empty, invalid, and failure paths where applicable.
- Preserve stored-data compatibility or document an approved migration and rollback.

## User-interface behavior

- Verify desktop and mobile layouts using real rendered UI.
- Check keyboard operation, focus visibility, labels, contrast, touch targets, reduced motion, loading, empty, and error states.
- Test long text, overlapping content, and narrow screens when relevant.
- For every card with repeated list rows, verify an associated small count is accurate after filtering, pagination, truncation, display limits, refresh, and empty results. Use `N of M` whenever not all loaded rows are visible; never show a fabricated loading/error count.
- Capture visual evidence in the feature document.

## Final automated checks

Run `npm run lint`, `npm test`, and `npm run build`. Do not describe work as complete while a required check fails. Record the command and outcome in the feature document.

## Release actions

Commit, push, database migration, production data writes, and deployment each require Scott's explicit approval. Report the exact intended action and target first.

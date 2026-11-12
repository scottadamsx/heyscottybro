# Feature: Search modal keeps its scroll position (BUG-077)

**Status:** Built and verified locally 2026-10-28; committed locally, push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-10-28

## User problem

Scott, on the search modal (the ⌘K command palette): "there's a bug that if you move the cursor even just a bit when scrolled down on the search modal, it will jump back up to the top so you can never reach what you wanna reach, heyscottybro fix it".

## Desired outcome

- In the command palette, scrolling down and then moving the mouse over the results keeps the list where it is; the hovered result highlights and can be clicked.
- Arrow-key navigation still moves the highlight and scrolls the active result into view.
- Nothing else about the palette changes: same results, same grouping, same reset of the highlight to the first result when the result set itself changes (typing, sources finishing loading).

## Current behavior

- Bug (BUG-077): the palette's highlight resets to the first result on every render, and a companion effect scrolls that first result into view, so the first mouse move after scrolling snaps the list back to the top.
- Mechanism, in three steps:
  1. `useHiddenPages()` (`src/utils/settings.js`) runs `parseHiddenPages` on every render. `JSON.parse` returns a brand-new array each time, so the hook's return value has a new identity on every render even though the stored setting did not change.
  2. In `src/components/CommandPalette.jsx`, `commands`, `pageHits`, and `groups` are `useMemo`s keyed (directly or transitively) on that array, so `groups` is also a new array on every render.
  3. `useEffect(() => { setCursor(0); }, [groups])` therefore fires after every render, resetting the cursor to 0; the `[cursor]` effect then calls `scrollIntoView` on `#cmdk-0`, the first result.
- Wheel scrolling does not render, so the scrolled position survives until the first state change. A mouse move over a result is that state change (`onMouseMove` calls `setCursor(i)`), which is why the jump happens on "even just a bit" of cursor movement, and why it repeats on every subsequent move, making lower results unreachable by mouse. Keyboard navigation is caught by the same reset.

## Scope

### Included

- `useHiddenPages()` returns a stable array identity while the stored hidden-pages string is unchanged (memoize the parse on the raw string). This is the shared root cause; its other consumers (`AdminLayout`, `SettingsPage`) only read the array (`.some`, `.includes`, filtering) and are unaffected by identity stability.
- A regression test pinning the memoized parse, in `src/utils/settings.test.js` (already in the `npm test` chain).
- Records: BUG-077 in `docs/development/BUGS.md`, this document, `WORKLOG.md`, `CHANGELOG.md`, `ACTIVE_WORK.md`.

### Not included

- Any change to `CommandPalette.jsx`: its cursor reset on a genuinely new result set, its `scrollIntoView` on cursor change, and its hover-to-highlight handler are the intended behaviour and stay as they are.
- Any change to what the palette searches, how groups are built, or the debounce.
- A ledger decision: no architectural posture changes; this restores the behaviour the palette code already intends. (DR pattern is reserved for capability/architecture decisions like DR-034.)
- Push/deploy: separate approval gate (see Approval).

## Experience contract

- Desktop: palette list holds its scroll position while the mouse moves over results; hovered row highlights; click still opens the result.
- Mobile: touch scrolling does not involve the mouse handler; behaviour unchanged.
- Keyboard and screen reader: arrow keys move the active option and scroll it into view exactly as intended; `aria-activedescendant` follows the cursor as before. Home/End still jump to first/last.
- Loading, empty, and error states: when the result set genuinely changes (typing settles, a source finishes loading or fails), the cursor still resets to the first result, as today.
- List-card counts: the palette's group headings already show "top N of M" from the rendered data; untouched.

## Acceptance criteria

- [x] With the palette open and the list scrolled down, moving the mouse across results does not change the list's scroll position (beyond the small "nearest" adjustment if the hovered row is partially clipped at an edge); the hovered row becomes the active row. (Rendered check, see Validation.)
- [x] Arrow Down/Up move the active row and scroll it into view when it is outside the visible area. (Rendered check: End lands on the last row, active and visible; the pre-fix code could not move the highlight off row 0 at all.)
- [x] Typing a query still resets the active row to the first result of the new set. (Unchanged code path: a settled query changes `pageHits`/`groups` for real, so the reset effect fires as designed. Not separately re-run in the harness, which exercised the at-rest list.)
- [x] `useHiddenPages()` returns the identical array reference across re-renders while the stored value is unchanged, and a new array when the stored value changes. (By construction via `useMemo` on the raw string, pinned by the regression test; the rendered check is the behavioural proof at the consumer.)
- [x] Lint, full test suite, and production build pass; the new regression test is in the `npm test` chain.

## Edge cases

- Hidden-pages setting actually changes (Settings toggle): the raw string changes, the memo re-parses, consumers get the new list, and an open palette rebuilds its groups and resets its cursor once — correct, because the result set changed.
- Malformed stored value: `parseHiddenPages` already falls back to `[]`; the memo caches that same `[]` until the raw value changes.
- A result row partially visible at the list's bottom edge on hover: the existing `scrollIntoView({ block: "nearest" })` on cursor change may nudge the list by that row's clipped amount so the active row is fully visible. That is the intended active-row visibility behaviour, not the jump-to-top defect.

## Pseudocode

```text
src/utils/settings.js

useHiddenPages():
  1. raw = useStringSetting(HIDDEN_PAGES, "[]")
     (useSyncExternalStore over localStorage; the snapshot is the stored
     string itself, so it is stable while the setting is unchanged.)
  2. return useMemo(() => parseHiddenPages(raw), [raw])
     Same stored string → same parsed array reference on every render, so
     consumers that memoize on it (the palette's commands/pageHits/groups)
     keep their results, and effects keyed on those results only run when
     the results genuinely change. Changed string → re-parse → new array.
```

## Ordered task checklist

- [x] Inspect the palette and the settings hook; record the root cause
- [x] Write this feature document; log BUG-077 in BUGS.md
- [x] Memoize the hidden-pages parse in `useHiddenPages`; add the regression test
- [x] Run focused tests, lint, full test suite, and build
- [x] Verify in a rendered app: mount the real palette, scroll down, move the mouse across results, confirm the scroll position holds; screenshot evidence in `verification/`
- [x] Close out: BUGS.md resolution, WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md, post-task checklist
- [x] Commit locally; push and deploy wait for Scott's separate approval

## Approval

Scott's direct order on 2026-10-28 ("there's a bug that if you move the cursor even just a bit when scrolled down on the search modal, it will jump back up to the top so you can never reach what you wanna reach, heyscottybro fix it") authorizes implementing the fix and a local commit. Per AGENTS.md and the post-task checklist, push and deployment require Scott's separate explicit approval and are not part of this work unit.

## Implementation record

- Files changed:
  - `src/utils/settings.js`: `useHiddenPages` memoizes `parseHiddenPages` on the raw stored string via `useMemo` (plus the `useMemo` import and a comment naming BUG-077). Nothing else in the file changed; `getHiddenPages` (non-hook reads) already re-parsed per call and still does, which is correct for one-shot reads.
  - `src/utils/settings.test.js`: regression test "useHiddenPages memoizes its parse on the raw string (BUG-077)" (source pin, the same style as the BUG-076 test in `chatBotUi.test.js`). The file was already in the `npm test` chain, so `package.json` is untouched.
  - `docs/features/search-modal-scroll-reset.md` (this file), `docs/development/BUGS.md` (BUG-077), `docs/development/WORKLOG.md`, `docs/development/ACTIVE_WORK.md`, `CHANGELOG.md`: records.
  - `verification/bug077-palette-scroll-verify.py`, `verification/bug077-palette-scroll-verify-output.txt`, `verification/bug077-palette-after-mouse.png` (evidence only, not committed). The scratch Vite entry used for the rendered run was deleted after the run.
- Decisions: none requiring the ledger (no capability or architecture posture changed).
- Data or API changes: none.

## Validation

- Automated: `npm run lint` clean; `npm test` green end to end (final `node --test` group 335 pass / 0 fail, up from 334 with the new test, plus the plain-assertion files); `npm run build` passes (pre-existing large-chunk advisory only).
- Rendered check (the behavioural proof): the real `CommandPalette` was mounted in a scratch Vite page with the real settings module and the app's own stylesheets, and driven with Playwright (harness and full numbers in `verification/bug077-palette-scroll-verify*`). With the at-rest "Go to" list (34 rows; list scrollHeight 1403, clientHeight 416): wheel-scroll to scrollTop 300, then move the mouse across visible lower rows.
  - With the fix: scrollTop stayed exactly 300, the hovered row (cmdk-14, "Journal") became active, and pressing End moved the highlight to the last row (cmdk-33) scrolled into view (scrollTop 979, row fully visible). Screenshot: `verification/bug077-palette-after-mouse.png`.
  - With the fix reverted (settings.js stashed, nothing else changed): the same mouse move snapped scrollTop from 300 to 35 with the active row reset to cmdk-0 ("Today"), and End could not move the highlight off row 0 — Scott's report reproduced exactly, confirming both the mechanism and that the harness discriminates.
- Desktop visual check: the harness above (900×800) is the desktop check for this component. The signed-in production palette was not re-run; it is the same component and stylesheet, and the post-deploy pass can repeat the two-minute scroll-and-hover check in place.
- Mobile visual check: not run. The defect path is mouse-driven (`onMouseMove`); touch scrolling never calls it, and the change is in a data hook, not in layout or CSS.
- Known limitations: the harness page has no Supabase env vars, so the palette's content sources report themselves unavailable there (that status strip is visible in the screenshot); the pages list and all scroll behaviour exercised are the production component's own. Icon-font glyphs and web fonts do not load in the bare scratch page, which affects only the screenshot's cosmetics.

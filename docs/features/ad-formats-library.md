# Feature: Ad Formats library

**Status:** Built and verified locally 2026-10-29; committed locally, push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-10-29

## User problem

Scott's words (2026-10-29): "steal these and put them in heyscottybro", about an Instagram reel by @byjoeym (Joey Mulcahy, posted 2026-10-28) titled "35 S-Tier Ad Formats to Steal". The reel is a numbered list of 35 short-form ad format concepts with small example cards; the creator's full workflow is gated behind commenting on the post, which we do not engage with. Scott wants the format ideas in his HQ as a reference library he can reach when planning ads for the Lift Club, myBackyard, BONSAI, and his websites service.

## Desired outcome

- A new admin page, **Ad Formats** at `/admin/ads`, reachable from the admin navigation (More list) and ⌘K.
- All legible formats from the reel as cards in a grid: the reel's number, the format name, an original one-to-two sentence description of how the format works, and one original example line written for one of Scott's businesses.
- A simple text filter at the top narrows the cards as Scott types.
- The content lives in one data module Scott (or an agent) can edit later; no database, no API route, no generation.

## Source material and its limits

32 of the 35 formats were legible in the reel inspection: numbers 1–31 and 34. Numbers 32, 33, and 35 were too small to read. They are **left out, not invented**; the library holds 32 entries under their original reel numbers, so the numbering visibly skips 32, 33, and 35. Format names are the reel's short functional labels, used as-is. Every description and every example line is written fresh for this library in Scott's context; none of the reel's example ad copy or images is copied.

## Current behavior (inspected 2026-10-29)

- Admin pages are declared once in `src/pages/admin/adminRoutes.jsx` (`ADMIN_PAGES`, lazy via `lazyWithReload`) and rendered as nested routes by `App.jsx`. Page files live in `src/pages/admin/` with a page-scoped CSS file beside them (model: `BinPage.jsx` + `bin.css`).
- Navigation is hand-listed in `src/pages/admin/AdminLayout.jsx`: `NAV_ITEMS` (also the Settings "hide this page" source) and `MORE_ITEMS` (the rail's More list and phone sheet). The ⌘K palette has its own hand-listed `COMMANDS` in `src/components/CommandPalette.jsx`. Nothing derives these from `ADMIN_PAGES`, and no test pins their contents.
- Pure data/logic lives in `src/lib/` with a plain-Node assertion test beside it (model: `src/lib/attendees.js` + `attendees.test.js`), wired into the `test` chain in `package.json` by file name.
- Page header pattern: `.module-page` + `.module-header` with an `h1` and a DM Mono count span (BinPage). Cards use the shared tokens (`--bg-card`, `--border-subtle`, `--radius-lg`, `--shadow-card`). Scott's standing type rules apply on the page scope: DM Sans for text and headings, DM Mono for numbers and labels, no serif, no emojis in the UI, 44px minimum touch targets, inputs at 16px.
- AGENTS.md count rule: a settled list shows an accurate small count, `N` when complete and `N of M` when filtered. The header count does this for the grid.

## Scope

### Included

- `src/lib/adFormats.js`: `AD_FORMATS`, an array of 32 objects `{ n, name, business, description, example }` (`n` is the reel number; `business` is one of "St. John's Lift Club", "myBackyard", "BONSAI", "Websites", eight examples each), plus a pure `filterAdFormats(formats, query)` helper (case-insensitive substring across name, business, description, and example; a blank query returns everything).
- `src/lib/adFormats.test.js`: house-style plain-Node tests (32 entries, the exact reel-number set, unique numbers, every field present and non-empty, businesses from the allowed set at eight each, filter narrows/empties/passes through). Wired into `package.json`'s `test` chain beside the other `src/lib` tests.
- `src/pages/admin/AdFormatsPage.jsx` + `src/pages/admin/ad-formats.css`: the grid page. Each card shows the format number (DM Mono), the name, the business as its single type label (DM Mono), the description, and the example under an "Example" label. A filter input sits above the grid; filtering is local state only (no modal, none of the palette's machinery). An empty result shows a plain "no formats match" line.
- Route and reachability: `ADMIN_PAGES` entry (`ads`), `NAV_ITEMS` + `MORE_ITEMS` entries in `AdminLayout.jsx`, and a `COMMANDS` entry in `CommandPalette.jsx` (section "Mission"), all labelled "Ad Formats" with the `fa-rectangle-ad` icon.
- Records: this document, `WORKLOG.md`, `CHANGELOG.md` (Unreleased › Added), `ACTIVE_WORK.md`. No ledger entry: the page is static content in one data module, the same posture as other in-repo static libraries; no storage, API, or architecture contract changes (the BUG-077 precedent).

### Not included

- The 3 illegible formats (32, 33, 35). If Scott later gets a legible copy, entries are added to the data module under their real numbers.
- Ad generation, image rendering, saving favorites, editing entries in the UI, or any external call.
- Any database table, API route, Library collection, or agent access to the formats.
- Posting, commenting, or otherwise engaging with the source reel.

## Experience contract

- **Trigger:** Scott opens Ad Formats from More (desktop rail or phone sheet), from ⌘K, or by URL `/admin/ads`.
- **States:** The data is static and bundled, so there is no loading or error state: the page renders the full grid immediately. The header count reads `32`; while a filter is typed it reads `N of 32` for the matches, and `0 of 32` with the empty line when nothing matches.
- **Filter behavior:** typing filters on every keystroke against all card text; clearing the box restores all 32. Filter state is component-local and resets on navigation; nothing is stored.
- **Layout:** responsive grid (auto-fill columns, one column on narrow phones), cards are read-only text, so the only interactive target is the filter input (44px tall, 16px text).
- **Accessibility:** the filter input has an accessible label; the count is plain text tied to the heading; colour is never the only signal (the business is a text label, not a colour code).

## Pseudocode

```
DATA (src/lib/adFormats.js)
  AD_FORMATS = 32 objects in reel order:
    { n (reel number), name, business, description, example }
  filterAdFormats(formats, query):
    q = trimmed, lowercased query
    if q is empty: return formats unchanged
    return the entries whose name, business, description, or example
      contains q (case-insensitive)

PAGE (AdFormatsPage)
  state: query (string, starts empty)
  shown = filterAdFormats(AD_FORMATS, query)   (recomputed on render)
  render:
    header: "Ad Formats" + count span
      (32 when unfiltered, "N of 32" when a query is typed)
    intro line: what the library is and where it came from
    filter input (label "Filter formats", placeholder naming an example term)
    if shown is empty: "No formats match ..." line
    grid of cards, one per shown entry, in reel-number order:
      number (DM Mono), name (heading), business label (DM Mono),
      description, "Example" label + example line
```

## Acceptance criteria

- `/admin/ads` renders 32 cards in reel order with number, name, business label, description, and example on each.
- Ad Formats appears in the desktop More list, the phone sheet, the Settings hide list, and ⌘K, and hides everywhere when set hidden in Settings.
- Typing in the filter narrows the grid live; the header count switches to `N of 32`; a no-match query shows the empty line; clearing restores 32.
- `npm run lint`, `npm test` (including the new data test), and `npm run build` pass.
- A rendered local check (scratch entry through the app's own styles, Playwright) shows the page, counts the cards, and exercises the filter, with screenshots under `verification/`.

## Steps

- [x] Write this feature document (contract + pseudocode).
- [x] Write `src/lib/adFormats.js` (32 original entries + filter helper).
- [x] Write `src/lib/adFormats.test.js` and wire it into `package.json`.
- [x] Write `AdFormatsPage.jsx` + `ad-formats.css`.
- [x] Register the route, nav entries, and palette command.
- [x] Run lint, focused test, full test suite, and build.
- [x] Rendered verification with Playwright; screenshots in `verification/`.
- [x] Update WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md; mark steps and validation here.
- [x] Commit locally on main (Scott approves the push separately).

## Validation (2026-10-29)

- `node src/lib/adFormats.test.js`: 9 passed, 0 failed (32 entries; exact reel-number set 1–31 and 34, in order; every field present and non-empty; unique names; businesses only from the four allowed, eight examples each; description length bounds; filter pass-through on blank, narrowing across each field, empty on no match).
- `npm run lint`: clean. `npm test`: green end to end (the new data test is in the chain). `npm run build`: pass, pre-existing large-chunk advisory only.
- Rendered check (`verification/adformats-ui-verify.py`, output in `verification/adformats-ui-verify-output.txt`): the real `AdFormatsPage` in a scratch Vite page with the app's own stylesheets, driven by Playwright. All steps passed: 32 cards in reel order (1 Censored to 34 Google search) with header count `32`; filter "bonsai" narrows to the 8 BONSAI cards and the count switches to `8 of 32`; a no-match query shows the empty line at `0 of 32`; clearing restores 32; at 390×844 the grid is one column and the filter measures 44px tall. Screenshots: `verification/adformats-full-grid.png`, `adformats-filtered.png`, `adformats-phone.png`. The scratch entry files were deleted after the run.
- One find, fixed in scope: the system field rule sets input `min-height: var(--control-h)` (40px on fine pointers). The page filter rule now reads `.ad-formats-page .ad-formats-filter input` (min-height 44px), which out-specifies the system rule at any cascade order, so the filter is a 44px target everywhere.
- Not verified: the signed-in production surfaces (More list and phone sheet entry, ⌘K entry, Settings hide behaviour) cannot be exercised in the bare harness; they are the post-deploy gate. Font Awesome does not load in the scratch page, so the intro icon renders only in production.

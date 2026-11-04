# Feature: Client Finder (Harvey playbook)

**Status:** Built and verified locally 2026-11-04; committed locally, push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-11-04

## User problem

Scott's words (2026-11-04): "get this in heyscottybro", about an Instagram reel by Nick Saraev (@nick_saraev, posted 2026-10-31) presenting "Harvey", a free, open-source autonomous AI sales agent that runs in Claude Code or Codex. Per source-of-truth rule 1 in `AGENTS.md`, Scott's latest explicit instruction authorises this feature and a local commit, the same pattern as the Ad Formats library (commit `392ad9b`). Scott runs a websites prospecting lane by hand today (an approved kit, drafts he approves before anything sends). He wants Harvey's method in his HQ as a playbook page he can open and use: what the tool does, the profile it needs, the data it collects per prospect, and the guardrails that keep its automation off until he says otherwise.

## Desired outcome

- A new admin page, **Client Finder** at `/admin/client-finder`, reachable from the admin navigation (More list) and ⌘K.
- The page states what Harvey is, links the public repo, and shows the verified repo facts.
- An honest verdict card: the tool is real and open source; the reel's results are demo data only; the gated download link was not engaged with.
- The nine workflow steps as numbered cards, in original wording.
- Scott's ICP card, filled in with his approved prospecting terms for the websites service, including the fields Harvey needs and the fit signals to look for.
- The per-prospect data checklist Harvey collects.
- One original example outreach email (a draft, for a fictional business), written to Scott's approved terms.
- A guardrails card: automatic sending and automatic replies stay off; Scott approves the kit and every batch; CASL applies; the approved club outreach sequence is a separate lane.
- The content lives in one data module; no database, no API route, no agent access, and nothing sends.

## Source material and its limits

Verified on GitHub on 2026-11-04: the repo is `ethanplusai/harvey` (https://github.com/ethanplusai/harvey), MIT license, Python, 4,361 stars, 912 forks, created Mar 12, 2026, last push Nov 2, 2026. The workflow facts used on the page (the nine steps and the per-prospect fields) come from the reel inspection and the repo. Two limits are stated on the page itself: the reel's proof is demo data only (its example contacts use reserved `.test` email domains; no real results are shown), and its download link is gated behind commenting a keyword, which we did not engage with; the public repo was found directly. Every description on the page is written fresh for this playbook; none of the reel's wording is copied.

## Current behavior (inspected 2026-11-04)

- Mirrors the Ad Formats build exactly. Admin pages are declared once in `src/pages/admin/adminRoutes.jsx` (`ADMIN_PAGES`, lazy via `lazyWithReload`) and rendered as nested routes by `App.jsx`. Page files live in `src/pages/admin/` with a page-scoped CSS file beside them (model: `AdFormatsPage.jsx` + `ad-formats.css`).
- Navigation is hand-listed in `src/pages/admin/AdminLayout.jsx`: `NAV_ITEMS` (also the Settings "hide this page" source) and `MORE_ITEMS` (the rail's More list and phone sheet). The ⌘K palette has its own hand-listed `COMMANDS` in `src/components/CommandPalette.jsx`. Nothing derives these from `ADMIN_PAGES`.
- Pure data lives in `src/lib/` with a plain-Node assertion test beside it (model: `src/lib/adFormats.js` + `adFormats.test.js`), wired into the `test` chain in `package.json` by file name.
- Page header pattern: `.module-page` + `.module-header` with an `h1` and a DM Mono count span. Cards use the shared tokens (`--bg-card`, `--border-subtle`, `--radius-lg`, `--shadow-card`). Scott's standing type rules apply on the page scope: DM Sans for text and headings, DM Mono for numbers and labels, no serif, no emojis in the UI, no em dashes in copy.
- AGENTS.md count rule: a card with repeated list rows shows an accurate small count from the rendered data. Every list section on this page shows its count (steps, ICP fields, fit signals, prospect fields, guardrails, verdict points).

## Scope

### Included

- `src/lib/clientFinder.js`: the page content as structured data: `HARVEY` (name, summary, repo URL, verified stats), `VERDICT_POINTS`, `WORKFLOW_STEPS` (9 objects `{ n, title, description }`), `ICP_FIELDS` (label/value pairs), `ICP_FIT_SIGNALS`, `ICP_INTRO`, `PROSPECT_FIELDS` (the 9 collected fields), `EXAMPLE_EMAIL` (`{ subject, body }` plus its fictional-business note), and `GUARDRAILS`.
- `src/lib/clientFinder.test.js`: house-style plain-Node tests (stats exact, 9 steps numbered 1 to 9 in order with unique titles and non-empty fields, ICP and prospect data complete and exact where the source fixes it, the example email carries the approved terms and the sign-off, no em dash character anywhere in the content). Wired into `package.json`'s `test` chain beside `adFormats.test.js`.
- `src/pages/admin/ClientFinderPage.jsx` + `src/pages/admin/client-finder.css`: the playbook page, reusing the Ad Formats page's components and visual patterns (module header, intro line, card sections, numbered step grid). Read-only text; no controls beyond links.
- Route and reachability: `ADMIN_PAGES` entry (`client-finder`), `NAV_ITEMS` + `MORE_ITEMS` entries in `AdminLayout.jsx`, and a `COMMANDS` entry in `CommandPalette.jsx` (section "Mission"), all labelled "Client Finder" with the `fa-magnifying-glass` icon (an icon already in use in this codebase).
- Records: this document, `WORKLOG.md`, `CHANGELOG.md` (Unreleased, Added), `ACTIVE_WORK.md`. No ledger entry: the page is static content in one data module, the same posture as the Ad Formats library; no storage, API, or architecture contract changes.

### Not included

- Installing, running, or configuring Harvey itself. This page is the playbook, not the tool.
- Any sending, replying, scraping, or prospect data. No list is built by this change.
- Ad generation, editing entries in the UI, saving state, or any external call from the page.
- Any database table, API route, Library collection, or agent access to the content.
- Posting, commenting, or otherwise engaging with the source reel.

## Experience contract

- **Trigger:** Scott opens Client Finder from More (desktop rail or phone sheet), from ⌘K, or by URL `/admin/client-finder`.
- **States:** The data is static and bundled, so there is no loading or error state: the page renders immediately. Each list section's count is derived from the data array it renders.
- **Layout:** sections stack in reading order; the nine steps sit in a responsive grid (auto-fill columns, one column on narrow phones). Cards are read-only text; the only interactive elements are the repo link and normal navigation.
- **Accessibility:** section headings are real headings; counts are plain text tied to their headings; colour is never the only signal (steps carry numbers, the email carries a text "Draft example" label).

## Pseudocode

```
DATA (src/lib/clientFinder.js)
  HARVEY = { name, summary, repoUrl, stats: { license, language, stars,
             forks, created, lastPush, verifiedOn } }
  VERDICT_POINTS = 3 short strings (real tool / demo-only proof / no
             keyword engagement)
  WORKFLOW_STEPS = 9 objects in order: { n (1..9), title, description }
  ICP_INTRO = one line: the profile below is what Harvey needs first
  ICP_FIELDS = label/value pairs: Industries, Cities, Company size, The offer
  ICP_FIT_SIGNALS = 5 strings (weak site, no site, phone-only booking, ...)
  PROSPECT_FIELDS = 9 strings, the fields Harvey collects per prospect
  EXAMPLE_EMAIL = { subject, body } for a fictional roofing company,
             built on the approved terms, signed "Scott Adams"
  GUARDRAILS = 5 strings (sending off, replies off, approval rule, CASL,
             club lane is separate)

PAGE (ClientFinderPage)
  render:
    header: "Client Finder" + count span ("9 steps")
    intro: what Harvey is, the repo as a link, and the verified stats line
    Verdict card: heading + count, one row per verdict point
    Workflow section: heading + count, grid of numbered step cards
      (number in DM Mono, title, description)
    Scott's ICP card: heading + count, intro line, field rows
      (label in DM Mono, value), then fit signals with their own count
    Per-prospect data card: heading + count, the 9 fields as a checklist
    Example email card: "Draft example" label, the fictional-business
      note, subject line, body in pre-wrap paragraphs
    Guardrails card: heading + count, one row per guardrail
```

## Acceptance criteria

- `/admin/client-finder` renders: the Harvey header with repo link and verified stats line, the verdict card, 9 numbered workflow step cards in order, Scott's ICP card with fields and fit signals, the 9-field prospect checklist, the example email marked as a draft for a fictional business, and the guardrails card.
- Every list section shows an accurate small count derived from its data.
- Client Finder appears in the desktop More list, the phone sheet, the Settings hide list, and ⌘K.
- The example email is original, short, references the phone-only booking gap, offers the free build and the $300 / $50 per month terms, and signs off "Scott Adams". No page copy contains an em dash or an emoji.
- `npm run lint`, `npm test` (including the new data test), and `npm run build` pass.
- A rendered local check (scratch entry through the app's own styles, Playwright) shows the page rendering correctly, with screenshots under `verification/`.

## Steps

- [x] Write this feature document (contract + pseudocode).
- [x] Write `src/lib/clientFinder.js` (Harvey data, steps, ICP, prospect fields, example email, guardrails).
- [x] Write `src/lib/clientFinder.test.js` and wire it into `package.json`.
- [x] Write `ClientFinderPage.jsx` + `client-finder.css`.
- [x] Register the route, nav entries, and palette command.
- [x] Run lint, focused test, full test suite, and build.
- [x] Rendered verification with Playwright; screenshots in `verification/`.
- [x] Update WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md; mark steps and validation here.
- [x] Commit locally on main (Scott approves the push separately).

## Validation (2026-11-04)

- `node src/lib/clientFinder.test.js`: 10 passed, 0 failed (verified repo facts exact; 3 verdict points; 9 steps numbered 1 to 9 in order with unique titles; ICP fields in order with the offer carrying the free build, $300, and $50 per month; 5 fit signals including phone-only booking; the prospect checklist equal to the exact 9 fields; the example email marked as a draft for a fictional business, naming the phone-only gap, carrying the terms, and signing off "Scott Adams"; 5 guardrails with sending and replies OFF, the approval rule, and CASL; no em dash character anywhere in the content).
- `npm run lint`: clean. `npm test`: green end to end (the new data test is in the chain). `npm run build`: pass, pre-existing large-chunk advisory only.
- Rendered check (`verification/clientfinder-ui-verify.py`, output in `verification/clientfinder-ui-verify-output.txt`): the real `ClientFinderPage` in a scratch Vite page with the app's own stylesheets (globals, index, system), driven by Playwright. All steps passed: header count "9 steps"; the stats line and the repo link render; the verdict card holds its 3 points; the 9 step cards render numbered 1 to 9 in order (Describe the business to Follow up when a prospect goes cold); the ICP card shows the 4 fields with the offer terms and the fit signals; the checklist shows all 9 prospect fields; the email card shows the Draft example label, the subject, the phone-only gap, and the Scott Adams sign-off; the guardrails card shows 5 rows with sending OFF first; the phone-width render is a clean single column. Screenshots: `verification/clientfinder-full.png`, `verification/clientfinder-phone.png`, both viewed. The scratch entry files were deleted after the run.
- Not verified: the signed-in production surfaces (More list and phone sheet entry, ⌘K entry, Settings hide behaviour) cannot be exercised in the bare harness; they are the post-deploy gate. Font Awesome does not load in the scratch page, so the intro icon renders only in production. Harvey itself was not installed or run; this page is the playbook only.

# Bin: remote clipboard and agent holding bin

**Status:** Implemented 2026-10-21. Code shipped; database migration
`supabase/migrations/2026-10-21-bin-items.sql` ships with the code and must be
applied to Supabase project `mogoybejtmkoheqvfvuc` before the page can load
items (the page shows a load error with Retry until then).
**Approval:** Scott, 2026-10-21: "I want heyscottybro to be able to be used
as a remote clipboard... I need a holding bin... make it live", plus the
addition "or if its context then save it, remember we want all context from
my life."

## Purpose

Scott works on more than one computer and cannot easily move text, files, or
links from his work computer to Muse. The Bin is a set of holding spaces
inside heyScottyBro: he drops material in from any signed-in browser, and
Muse later takes each item out and turns it into actual work (a document, a
task, a finished deliverable), or saves it as life context when that is what
the item is.

## Contract

- Route: `/admin/bin`, nav label "Bin", behind the normal admin sign-in.
- Each space is one `bin_items` row: a title, a kind (`text`, `file`, or
  `link`), content, a status, and a context flag.
- Text items hold pasted text in `body`. Link items hold the URL in `body`
  (a note can follow on a second line). File items upload to the existing
  private `documents` storage bucket under `<user_id>/bin/<item_id>/<name>`
  (the first path segment stays the owner id, which the bucket's existing
  owner policies require) and keep `file_path`, `file_name`, `file_size`.
- Status flows `new` -> `picked_up` -> `done`, and can be moved back to
  `new`. Newest first. Counts follow the list-card rule: the header card
  shows the live item count.
- Non-goals for v1: sharing links, search, agent write access from inside
  the app, editing a file item's stored file.

## Pseudocode

```
load:    select the owner's bin_items, newest first; render one card each
add:     pick a kind (Paste text | Upload document | Save link)
         text: title (optional, defaults to first words) + body + context flag
         file: file + optional title + context flag; upload, then insert row
         link: URL + optional title/note + context flag
         insert row with status 'new', prepend to the list
card:    title edits inline and saves on blur/Enter
         text: preview excerpt + Copy text
         file: file name + size + Download (signed URL)
         link: the URL + Open
         status button advances new -> picked up -> done (done -> back to new)
         context toggle flips is_context; a Context pill shows when set
         Delete asks for confirmation, removes the storage file, then the row
```

## Agent pickup loop (how Muse works the Bin)

1. Read items with status `new`, oldest first.
2. Triage each item before working it:
   - **Flagged context** (`is_context` is on, or Scott labelled it context):
     save the content verbatim into Scott's memory and HQ notes as life
     context, then mark the item `done`. Never turn context into a task or
     a document.
   - **Plainly context but unflagged** (a fact, a schedule, a preference,
     background about his life, with no ask attached): save it the same way,
     set the item's context flag on, note on the item that it was saved as
     context, and mark it `done`.
   - **Work** (everything else): set status `picked_up`, do the work (build
     the document, run the research, draft the thing), file deliverables in
     Documents as usual, then mark the item `done`.
3. Principle, in Scott's words: "we want all context from my life" saved.
   When in doubt between working an item and saving it, save it and say so.

## Data model

`public.bin_items`: `id` uuid pk, `user_id` uuid (owner, RLS owner-only like
every app table), `title` text, `kind` text (`text` | `file` | `link`),
`body` text nullable, `file_path` text nullable, `file_name` text nullable,
`file_size` bigint nullable, `is_context` boolean default false, `status`
text default `new` (`new` | `picked_up` | `done`), `created_at`,
`updated_at` (kept current by the shared `set_updated_at()` trigger).
Explicit table grants for `authenticated` and `service_role` are in the
migration, matching this project's post-2026-10 grant requirement.

## Design notes

The Bin page mirrors Documents (same shell, cards, modal, confirm, and
skeleton patterns) with Scott's standing type rules scoped to the page:
DM Sans for text and headings, DM Mono for labels and numbers (both added to
the shared Google Fonts request), one accent (the app accent token), 44px
minimum touch targets, 16px minimum input text, no emojis, no em dashes in
UI copy.

## Validation

- `src/utils/binHelpers.test.js`: status flow, next-action labels, and
  excerpt trimming pass under `node --test`.
- `npm run lint`, full `npm test`, and `npm run build` results are recorded
  in `docs/development/WORKLOG.md` for 2026-10-21.
- Rendered checks (signed-in desktop/mobile) and a live round trip wait on
  the migration being applied; until then the route loads and shows the
  admin sign-in or the page's load error state.

## Steps

- [x] Feature record, contract, and pseudocode (this file)
- [x] Migration `2026-10-21-bin-items.sql` (apply step outstanding, see Status)
- [x] `src/api/binApi.js` data layer mirroring `documentsApi.js`
- [x] `src/pages/admin/BinPage.jsx` + `bin.css`, route, and nav entry
- [x] Helper test registered in the `npm test` script
- [x] Lint, tests, and build run; results recorded in the work log
- [x] Work log, changelog, and decision ledger updated
- [x] Commit and push to `main`; Vercel deployment and live route checked
- [ ] Apply the migration to `mogoybejtmkoheqvfvuc` (needs Scott's Supabase sign-in)

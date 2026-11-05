# Feature: Linked documents open in the in-app viewer modal

**Status:** Built and verified locally 2026-11-05; committed locally, push/deploy awaits Scott's approval
**Owner:** Scott
**Started:** 2026-11-05

## User problem

Scott, on 2026-11-05, right after the BUG-080 event rows shipped: "can you link the documents so clicking on them brings up a modal with them with an x once youre done".

Today, clicking a file in a Documents list (the `DocLinks` panel shown on events, tasks, projects, and elsewhere) opens the file in a new browser tab via a signed URL. There is no in-app viewing, so reviewing an attachment means leaving the page and juggling tabs.

## Desired outcome

- Clicking a linked file opens it inside the app in the existing document viewer modal: PDFs in the full `PdfViewer` (paging, zoom, download), images inline, other file types with a download fallback. The modal closes with its X button, the overlay, or Escape.
- Opening a file marks that link read, matching how Brain note links already behave when opened.
- Brain note links are unchanged: they open in the full-page reader, which was a deliberate earlier choice for long-form reading on phones.

## Plan

1. `DocLinks.jsx`: import the existing `DocumentViewer` component (`src/components/documents/DocumentViewer.jsx`); add a `viewing` state; the file branch of the open handler sets the viewer doc from the link's enriched `document` record instead of calling `window.open`; render the viewer with an onClose that clears the state. Remove the now-unused `fileLinkUrl` import.
2. Mark read on open for file links, reusing `setDocRead` and the existing summarize flow.
3. Source tests (viewer wiring, no `window.open` left, read-marking), full suite, lint, build, and a rendered check of the real `PdfViewer` modal with a sample PDF. The full signed-in click-through (event, Documents, click a PDF, modal opens, X closes) is the post-deploy gate.

## Approval

Scott's direct order on 2026-11-05 (quoted above) authorises the change and a local commit, per the established precedent in ACTIVE_WORK. Push/deploy need Scott's separate explicit approval.

## Validation record (2026-11-05)

- `npm run lint` clean; `npm test` green end to end (exit 0), including the 4 new source tests in `src/components/docs/docLinksViewer.test.js`; `npm run build` pass (pre-existing large-chunk advisory only).
- Rendered harness: the real `PdfViewer` with a two-page sample PDF rendered page 1 with its toolbar, the arrow key paged to page 2, the close button dismissed the modal, and the 390px width had no horizontal overflow. Screenshots read: `verification/bug080-docviewer-{desktop,phone}.png`.
- Overlay stacking verified from the stylesheets: the doc viewer overlay (z-index 1000) and the PDF viewer overlay (12000) both sit above the day modal overlay (200), so the viewer opens on top when a document is clicked from inside a day's event.
- Remaining gate: Scott approves the push; then the signed-in production click-through.

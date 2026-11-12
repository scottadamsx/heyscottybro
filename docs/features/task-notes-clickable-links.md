# Feature: URLs in task Notes are clickable (BUG-082)

**Status:** Built and verified locally 2026-11-06; committed locally, push/deploy awaits Scott's approval
**Owner:** Scott
**Started:** 2026-11-06

## User problem

Scott, on 2026-11-06: "you didn't put the document viewer into the thing so when I go into topic 11 i can't click the fucking document link". Investigation of the live app the same day found the underlying state: the Concept 11 task ("Learn and implement concept 11 - timeouts") has NO linked document at all. Its Notes read "Open the matching Library PDF: 011-timeouts.pdf. Bundle: https://chatgpt.com/library?file_id=...&account_id=personal", and `TaskDetailPage` renders the description as raw text in a `<p>`, so the URL is dead text: clicking it does nothing (verified live: no modal, no navigation, no toast). Concept 10 is identical, and the pattern holds across the concept tasks: the lesson reference lives only in Notes, as an unclickable URL.

## Desired outcome

- A URL written in a task's Notes is a real link: tapping it opens it (new tab, `rel="noreferrer"`). This covers the ChatGPT bundle link on every concept task today, and any URL in any task's notes from now on.
- Plain text without URLs renders exactly as before (the Notes paragraph keeps `white-space: pre-wrap`).
- This does not replace the standing end-state for the concept lessons (the PDFs themselves attached to each task's Documents, opening in the in-app viewer, with the ChatGPT references removed from Notes). That work waits on getting the PDFs: the candidate zip on Scott's Mac (unreachable while the Mac is offline) or the ChatGPT library pull (needs Scott present for the verification code). Linkifying Notes is the fix for the click itself; attaching the PDFs remains its own tracked follow-up.

## Plan

1. `src/utils/linkify.js`: pure `linkifySegments(text)` splitting text into text and link segments. Only http/https URLs link; trailing sentence punctuation and unbalanced closing brackets stay outside the link. Rendered as React nodes, never HTML, so note text cannot inject markup.
2. `src/components/LinkifiedText.jsx`: renders the segments in a `<p>` with the given class name; link segments become anchors.
3. `TaskDetailPage.jsx`: the Notes paragraph uses `LinkifiedText` with the existing `task-detail-notes` class. No other surface changes in this fix.
4. Unit tests for the splitter (the exact Concept 11 note, trailing punctuation, parentheses, multiple URLs, no-URL text, non-http schemes) plus a source test that the task page uses the component, wired into the `npm test` chain.
5. Full suite, lint, build, and a rendered harness check of the real component with the real stylesheet at desktop and 390px.

## Steps

- [x] Diagnosis recorded (this doc, BUGS.md BUG-082)
- [x] Splitter, component, and page wiring built
- [x] Tests added and passing
- [x] Full suite, lint, build pass
- [x] Rendered harness check read at desktop and 390px
- [x] WORKLOG entry; commit locally; push only on Scott's say-so

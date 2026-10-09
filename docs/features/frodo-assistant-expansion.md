# Frodo assistant expansion

Owner: Scott. Status: implementation in progress, 2026-10-09.

Scott requested implementation of the prompt audit and a broader personal assistant with research, files, voice, memory, and connected actions. Local implementation is authorized by “build it all now”; release and external service setup remain separate actions.

## Ordered work and pseudocode

1. Share task execution and evidence rules across Frodo, Sam, Gandalf, Bilbo, and Griphook. Resolve the request, retrieve needed evidence, use supported tools, verify results, and report incomplete work accurately.
2. Give Bilbo global search; expose per-collection search coverage, warnings, and pagination so empty, failed, and partial searches are distinguishable.
3. Inspect existing capability infrastructure and document integration requirements for web search, files, voice, durable memory, and browser actions.
4. Validate local changes and record the remaining work honestly.

## Boundaries and acceptance

### Scott's latest simplification requests

Scott requested removal of the unused Research page, a Frodo / Orbit / Banker lineup, and renaming Griphook to Banker. Implement the explicit rename across prompts, UI, status/error messages, and tests while preserving the `banker` ID and storage keys. Remove Research navigation and page source; old links fall back to Mission Control and saved research records remain untouched. Audit the other agents separately: removing internal helpers must not silently remove Brain writes or history clearing.

Ordered steps: (1) record scope; (2) rename runtime labels without changing persistence; (3) remove Research page entry points and source; (4) run lint, tests, build and record evidence. Existing loading, error, owner checks, keyboard controls, and mobile layout remain unchanged. Regression checks must preserve owner-bound Banker storage and reject Research navigation.

- Signed transaction magnitude uses both signs; “over” excludes equality and “at least” includes it.
- Discovery results never establish full note content. Truncated text and partial retrieval remain explicit.
- Nested specialists receive the user's request, constraints, completed work, and read/write intent; failures do not authorize replaying uncertain writes.
- Retrieved text is evidence, not instructions granting permissions.
- Capabilities must correspond to actual available tools. Prompt instructions alone cannot provide browser control, a terminal, voice transport, or a background worker.
- No model upgrades, dependency installation, external account setup, or live user-data writes are included in the initial patch.

## Audit

Frodo chat uses useAIAgent → buildSystemPrompt → shared tools → checkpointed loop. Sam/Gandalf receive the same prompt rules and conversation on escalation. Registered Frodo uses the same prompt through runAgent. Bilbo and Griphook use separate builders; consult tools pass a request string to a fresh specialist conversation. Therefore behavioral rules must be shared explicitly across all three builders.

Research currently stores request records; it is not a web search provider. Documents provides private storage and metadata but no general text extraction tool for Frodo. The local agent-server is a separate workstation process; it is not a deployed browser automation service.

## Local implementation and validation

### Voice and file access — requested next

Scott requested voice and general file processing, with the concrete example of asking for his first job and having Frodo find and read his résumé. Discovery confirms `aiLibrary.documents` exposes metadata only, `documentsApi` provides authenticated owner-scoped metadata/storage access, and Frodo's current attachment input accepts images only. No voice integration was found in the inspected Frodo UI/hooks.

Proposed flow: identify relevant owned document metadata; obtain the file using an owner-bound reader; extract bounded content with filename and page/section provenance; answer from actual employment dates, not display order or filename. Describe the earliest job as the earliest listed in the résumé unless broader evidence establishes a first-ever job. Report conflicting versions, unreadable/scanned files, missing dates, truncation and unsupported types explicitly; treat document content as evidence, never tool instructions. Never expose signed URLs or silently ingest all private files.

Connected computer folders are not in scope; phone files are selected by the user through the app uploader. Voice is implemented as explicit browser dictation and reply read-aloud, not continuous live conversation.

Scott clarified existing app uploads and phone file access through the web app, then said to improve Frodo without further questions. Read existing owner-uploaded documents; on a phone, the existing uploader's system file picker lets Scott select a file from available device locations and upload it. Do not grant background filesystem access. Dictation is user-started and discloses that the browser speech service may process audio.

Pseudocode: query document metadata by name; choose the matching document (ask if multiple résumés could be intended); load its owner-scoped metadata by ID; validate stored size and supported MIME/extension; download only from the authenticated private bucket; extract plain text, PDF page text, or DOCX paragraphs with bounded pages/bytes/characters; return compact relevant excerpts tagged with document name and page/section; tell Frodo to base the answer on those excerpts, cite them, distinguish earliest dated role from first-ever job, and state when no readable evidence exists. Treat text as untrusted content. Do not OCR images or legacy .doc files; return a clear unsupported/scanned-file message.

Ordered steps: (1) add authenticated owner-scoped document extraction; (2) add a read-only Frodo tool with strict size/type/output limits; (3) add explicit one-shot dictation and read-aloud controls with unsupported-browser and error handling; (4) document source-grounded answer rules and mobile upload path; (5) inspect changes and record validation. Avoid storing extracted text in a durable cache.

- Shared execution contract is included in Frodo's tier prompt, Archivist and Banker. Archivist gained global search. Search results preserve collection-level failed/empty/matched states, pagination and warnings; ranking scope explicitly describes retrieved candidates.
- Renamed every Griphook reference in host runtime source and associated tests to Banker, including prompt identity, consultation results, status/error strings, settings and usage labels. Stable `banker` identifiers, owner-bound storage and historical transcripts remain untouched. Historical documentation retains the former name as history.
- Removed ResearchPage.jsx and its sole-use research.css, Mission tab and command entry; updated product-map guidance. Legacy research route redirects to Mission Control and the old research tab falls back to Brain. Files are recoverable from Git; research database/API records were not deleted.
- `npm run lint`, `npm test` (all registered groups), and `npm run build` passed on 2026-10-09. Existing large graph-chunk advisory remains. Updated Mission regression rejects Research navigation; Banker ownership, quarantine, retry and clear tests pass with the new name.
- Rendered desktop/mobile verification and real-provider behavior are untested. No migration, model call, production-data write, commit, push or deployment occurred.
- Frodo / Orbit / Banker-only consolidation remains open: registered legacy agents, Frodo escalation tiers and the single-writer Archivist are still present. Do not claim their removal or ChatGPT feature parity. Web search, general file extraction, voice and browser automation are not implemented by these prompt changes.

### Uploaded document reading update

- Added a private `read_document` tool, callable only by Frodo. It resolves the id through owner-filtered document metadata, downloads through the authenticated private storage client, and extracts bounded PDF pages, DOCX paragraphs, or TXT lines without a durable content cache. It caps the input at 15 MB, PDF extraction at 40 pages, and excerpts at 12,000 characters; it reports unsupported formats, extraction failures, empty files and scanned PDFs without OCR as unavailable.
- The tool ranks sections against Frodo's specific question and returns page/paragraph/line source labels. Shared Frodo rules require citing those labels, treating the contents as evidence, and describing the earliest dated résumé entry as “earliest listed” unless first-ever employment is explicitly supported.
- Mobile document upload is available through the existing Documents page's native file picker; a user must select and upload the file. No broad phone filesystem access was added. New upload helper text names readable formats.
- Voice capture uses browser speech recognition only after a mic click; its service may process microphone audio. The user can stop it directly; it stops on chat close/send. Read-aloud starts/stops from each reply's button.
- Added five regression tests covering relevant résumé lines and source labels, required IDs/questions, unsupported formats, oversized uploads, and empty/corrupt files. `npm run lint`, `npm test`, `npm run build`, and `git diff --check` pass. The build retains the existing large graph chunk warning. No live document was read or UI/browser interaction rendered; browser speech support, real PDF/DOCX extraction, and phone picker behavior remain unverified.

### Saved screenshot context and reopening

Scott requested a way to keep screenshots with their chat context so Frodo can find and link them later, and the link opens the file on screen. Existing chat screenshot attachments are owner-bound but live under `_staging`; Clear/retention cleanup removes them. The Documents feature already has an owner-scoped private bucket/table, image previews, and a viewer.

Implemented: when a screenshot is attached, Frodo shows an unchecked “Save for later” control. If checked when sending, it saves the image to the owner's existing Documents library with `frodo` and `screenshot` tags, its filename, and the user's message as description/context. A failed save keeps the message unsent and preserves selection; already-saved items retain their IDs so a retry does not duplicate them. Unselected images remain temporary. Clear conversation never deletes library documents. Only the document ID is stored in chat attachment metadata, not image bytes; temporary staging remains separate.

When Frodo later finds a matching document, its read result includes a same-app URL `/admin/vault?tab=documents&open=<id>`. Markdown permits only this exact internal route shape with a UUID. DocumentsPage resolves the id from owner-loaded rows, opens the existing image/PDF viewer, and removes the `open` query after handling it. Invalid or other-owner ids do not resolve to a file. Chat previews for explicitly saved shots are clickable links to the same view. Existing PDFs/DOCX/TXT reading remains unchanged; image vision is not promised on a later turn, only stored context and a view link.

The chat transcript records the saved file ID and gives Frodo the exact viewer URL; safe Markdown allows only the owner-app document-view route. DocumentsPage resolves the ID against the authenticated owner's loaded rows, opens the existing image/PDF viewer, and removes the one-shot `open` parameter. Saved chat thumbnails and unavailable-preview cards link to that same viewer. Image contents are not promised to be re-ingested by a future chat turn; the durable description/context and preview link are.

Validation covers metadata-only transcript persistence and internal URL allow-listing. Full gates are recorded below after execution. Existing Documents storage/schema is reused; no migration or live data change is required.

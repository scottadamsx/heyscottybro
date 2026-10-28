# Feature: A picture for each person in Orbit

**Status:** Built and verified locally 2026-10-28; committed locally, push/deploy awaiting Scott's separate approval
**Owner:** Scott
**Started:** 2026-10-28

## User problem

Scott's words: "I'm unable to add a picture to Orbit, I wanna be able to send screenshots like I can for Frodo." A person in People (Orbit) has no picture anywhere: profiles and list rows show initials on a group-coloured disc (Orbit's `Avatar`). Scott wants to give a person a picture with the same ease as attaching a screenshot in the Frodo chat.

## Desired outcome

- On a person's profile, Scott can add, replace, or remove their picture by choosing an image file (screenshots included: PNG, JPEG, WebP, GIF), pasting one from the clipboard, or dropping one on the picture field, the same gestures the Frodo composer already supports.
- The picture shows in the person's profile header and everywhere their avatar appears (People list rows, chips, pickers, search), replacing the initials when one is set.
- Frodo can set a person's picture from a screenshot attached in the conversation ("add this screenshot to Aaron Burke"), reusing the chat's existing staged upload: no new upload plumbing.

## Current behavior (inspected 2026-10-28)

- The person document (`orbit_people` rows, one JSONB `doc` each) has no photo field: name, group, birthday, how, notes, facts, intents, createdAt. `validatePerson` (`orbit/src/lib/validate.js`) checks the known fields and passes everything else through its spread, so a `photo` string is storable today; it just has no validation, no UI, and nothing renders it.
- `Avatar` (`orbit/src/components/ui/Avatar.jsx`) renders initials only. It is used by the profile drawer header (size lg), `PersonRow` (the People list), `PersonChip`, `PeoplePicker`, the map, and search results, so one change there covers every surface.
- Profile basics are edited in `EditPersonModal` (`orbit/src/components/person/PersonFormModal.jsx`); the Add People modal is a batch name form and is not where profile fields live.
- Images in this app already live in Supabase Storage. The Frodo chat stages screenshots in the private `bug-screenshots` bucket under `<uid>/_staging/…` (10 MB limit; PNG/JPEG/WebP/GIF; storage policies scope every object to the owner's top folder) and reads them back with signed URLs (`src/api/chatAttachmentStorage.js`). The Documents bucket requires a `documents` table row per file, which a profile picture is not; the `bug-screenshots` bucket is the app's existing private owner-image store (chat imagery generally, per `chatAttachmentStorage.js`) and is the one reused here.
- Orbit's UI has no Supabase client and no upload route; it talks only to its API, configured by the host through `configureOrbit` (`orbit/src/lib/runtime.js`: apiBase, headers, embedded, title). A host-supplied capability through that same seam is how the embedded UI gets storage without Orbit importing host code.
- Frodo's writes to people go through the Library (`src/api/peopleApi.js` + pure `peopleCore.js`, DR-034). A chat attachment's staged path exists in the turn (ChatBot stages it before send); the model is already told a saved screenshot's Documents id in the user turn, but is never told the staged path.

## Scope

### Included

- Person document gains `photo`: `""` or the storage path of the picture. `validatePerson` validates the shape when present (a string of safe path segments ending in an image extension, length-capped) and normalizes a missing value to `""`. No database migration: the doc is JSONB.
- Picture bytes live in the existing private `bug-screenshots` bucket at `<uid>/people/<personId>/<timestamp>-<rand>.<ext>`, built by a new `personPhotoStoragePath` helper in `src/utils/storageKeys.js` (same pattern as the bug/staging paths).
- `configureOrbit` gains an optional `media` capability (`upload(file, personId)`, `sign(path)`, `remove(path)`), supplied by the host's People page from a new `src/api/peoplePhotoStorage.js`. Without it (standalone Orbit), the picture control does not render and avatars keep initials: no dead controls (QF-5).
- `Avatar` shows the picture when one is set and its signed URL resolves (module-level URL cache in `orbit/src/lib/photoUrl.js`); initials remain the fallback while loading, on error, and when no host media capability exists.
- `EditPersonModal` gains a Picture field: current picture preview, Add/Change via file picker (accept PNG/JPEG/WebP/GIF), paste and drag-and-drop of an image onto the field (the Frodo composer's gestures), and Remove. Uploads happen on selection; the path is saved with the form through the existing `savePerson` write. A replaced or removed picture's stored file is deleted only after the save succeeds.
- Frodo: the Library `people` collection gains a `photo` field. On create/update, `peopleApi` accepts a chat-staged path (it must be the signed-in owner's), copies it to the permanent people path before saving (the storage core's claim pattern), accepts an existing people path as-is, and refuses anything else with a clear error. `""` clears the picture; a replaced picture's old file is removed after the save succeeds. The chat turn tells the model an attached screenshot's staged path (the same note pattern already used for Documents ids), and Frodo's PEOPLE prompt bullet says how to use it.
- Ledger record DR-035; CLAUDE.md's People paragraph aligned.

### Not included

- Multiple photos per person, cropping/editing, face detection, bulk import.
- A picture field in the batch Add People modal (add the person first, then the picture from their profile).
- Standalone (local) Orbit storage support: the canonical Orbit repo supplies its own `media` capability when it adopts the field; here the capability is host-supplied only, and the control hides without it.
- Deleting a person's stored picture when the person is deleted (Orbit's delete cascade is server-side and storage-blind; the orphan is one small file in Scott's own bucket, noted as a known limit).
- Cleaning up a picture uploaded in the edit modal but never saved (same orphan class as unsent chat staging).

## A note on the orbit/ copy

CLAUDE.md and ONBOARDING.md say `orbit/` is a read-only copy, changed in the canonical Orbit repo and re-synced. That repo is not present in this environment (`scripts/sync-orbit.mjs` reads `../orbit`, which does not exist here), and the People UI plus person validation exist only under `orbit/`. Scott's direct order is to build this in heyscottybro, so the minimal Orbit-side edits are made in the copy and recorded here. **These edits must be ported to the canonical Orbit repo before the next `npm run sync-orbit`, or the sync will overwrite them.** Files affected: `orbit/src/lib/validate.js`, `orbit/src/lib/runtime.js`, `orbit/src/lib/photoUrl.js` (new), `orbit/src/components/ui/Avatar.jsx`, `orbit/src/components/person/PersonFormModal.jsx`, `orbit/src/globals.css` (one `.avatar img` rule).

## Experience contract

- Desktop and mobile: the Picture field sits at the top of Edit basics; the file picker is the native one, paste/drop work on desktop, tap targets use the existing Button sizes. The drawer header and list rows show the picture at the existing avatar sizes.
- Keyboard and screen reader: the picker is a real button with a visually hidden file input; Remove is a real button; the avatar image is decorative (`alt=""`) because the person's name is always adjacent text, as with today's initials.
- Loading, empty, and error states: an upload shows "Uploading…"; a failed upload keeps the previous picture and shows the error in the form; a picture whose URL cannot be signed falls back to initials instead of a broken image.
- List-card counts: not applicable (no list content changes; avatars only).

## Acceptance criteria

- [x] Edit basics on a person offers Add picture; choosing a PNG stores it in the bucket, saves its path on the person, and the picture appears in the profile header and the People list. (Rendered check with a stub media store; the bucket write itself is the post-deploy signed-in check, see Validation.)
- [x] Change picture replaces it (old file removed after the save succeeds); Remove picture clears it and initials return. (Rendered check; post-save deletion is wired in EditPersonModal and peopleApi.)
- [x] Paste and drag-and-drop of an image onto the Picture field upload the same way the picker does. (Same `takeFile` path as the picker; wired, not separately exercised in the rendered run.)
- [x] A non-image or oversized file is refused with a clear message and nothing is saved (bucket enforces 10 MB and the four image types; the UI validates type before upload).
- [x] `validatePerson` accepts a well-shaped photo path, normalizes a missing photo to `""`, and rejects a malformed one (non-string, URL, spaces, non-image extension). (Verified against the real Orbit server, see Validation.)
- [x] Frodo: `update_item` on people with `photo` set to an owned chat-staged path stores a copy at the person's permanent path and saves that path; a path owned by someone else or outside the known prefixes is refused and nothing is written; `photo: ""` clears. (Claim/refusal logic in peopleApi + peoplePhotoStorage; unit-covered at the peopleCore/storageKeys layers, server-covered for the doc write; the live signed-in claim is the post-deploy check.)
- [x] Lint, full test suite, and production build pass; new tests cover the path helper, the peopleCore photo handling, and the validation rule.

## Edge cases

- Two pictures uploaded in one edit session before saving: the first upload is orphaned (noted above); the saved path is the last one chosen.
- Replace, then the save fails (for example a duplicate rename): the modal stays open with the error, the stored document still points at the old picture, and the old file is not deleted (deletion waits for a successful save).
- A photo path left pointing at a file deleted elsewhere: Avatar's signed-URL request fails and it falls back to initials; Edit basics shows initials and offers Add picture.
- A staged chat path is claimed by copy, never by reference, so clearing the chat (which deletes staged files) can never break a saved picture.
- Merging two people keeps the kept person's picture (existing spread order in `mergePeople`).

## Pseudocode

```text
Storage key (src/utils/storageKeys.js)
  personPhotoStoragePath({ userId, personId, file, timestamp, randomId })
    -> "<uid>/people/<personId>/<timestamp>-<rand>.<ext>" (segments validated like the other builders)
  isPersonPhotoPath(path)            -> four segments, second is "people", image extension
  isOwnedPersonPhotoPath(path, uid)  -> isOwnedStoragePath && isPersonPhotoPath && segment 3 is any person id

Validation (orbit/src/lib/validate.js, validatePerson)
  if doc.photo is present and not "":
    it must be a string matching ^[\w-]+(/[\w-]+)*\.(png|jpe?g|webp|gif)$ (case-insensitive), length <= 300,
    else error "photo must be a stored image path"
  returned value gains photo: doc.photo || ""

Host media capability (orbit/src/lib/runtime.js + src/api/peoplePhotoStorage.js)
  configureOrbit({ media }) stores { upload, sign, remove } or null.
  Host uploadPersonPhoto(file, personId): validate image type (storageKeys media/extension helpers,
    same supported set as chat staging), upload to personPhotoStoragePath in "bug-screenshots",
    return the path.
  Host signPersonPhoto(path): owner-checked signed URL (1 hour), mirroring signChatAttachment.
  Host removePersonPhoto(path): remove only an owned people path.
  Host claimPersonPhoto(personId, stagedPath): owner-check the staged path, copy it to the
    person's permanent path (storage core claim pattern), return the new path.

Orbit UI (orbit/src/lib/photoUrl.js, Avatar.jsx, PersonFormModal.jsx, globals.css)
  resolvePhotoUrl(path): no media capability -> null; else a cached sign() per path (1 hour).
  usePhotoUrl(path): hook returning the resolved URL or null.
  Avatar: if person.photo resolves to a URL, render <img> inside the existing avatar disc
    (one CSS rule: .avatar img fills the disc, object-fit cover); otherwise initials, unchanged.
  EditPersonModal Picture field:
    state photoPath (from person.photo), pendingDelete list, busy, error.
    choose/paste/drop a file -> upload -> on success, queue the previous path for post-save
      deletion and set photoPath; on failure show the error, keep the old path.
    Remove -> queue the current path for post-save deletion, photoPath = "".
    save -> savePerson(id, { ...p, ...form, photo: photoPath }); only after it succeeds,
      media.remove each queued path (best effort).

Frodo (src/api/peopleCore.js, peopleApi.js, aiLibrary.js, aiTiers.js, useAIAgent.js)
  peopleCore: "photo" joins PERSON_SCALAR_FIELDS; buildNewPersonDoc stores photo ("" default);
    flattenPersonDoc exposes photo; a non-string photo value is a validation error.
  peopleApi create/update: resolvePhoto(personId, data.photo, currentPhoto):
    undefined -> untouched (update) / "" (create); "" -> "" (clear);
    owned chat-staging path -> claimPersonPhoto copy, use the permanent path;
    owned people path -> as-is; anything else -> throw, nothing written.
    After the PUT succeeds, remove the replaced permanent file (best effort).
  aiLibrary: people gains photo: { type: "string" } plus a description note; defaultFields gains photo.
  useAIAgent: the user-turn note for an attachment with a path adds its staged path and says
    Frodo can pass it as photo to update_item/create_item on "people" to make it that person's picture.
  aiTiers PEOPLE bullet: one clause teaching exactly that.
```

## Ordered task checklist

- [x] Write this feature document; add the ACTIVE_WORK entry
- [x] storageKeys: person photo path helpers + tests
- [x] Orbit validate.js: photo rule; runtime.js: media capability; photoUrl.js: resolver + hook
- [x] Avatar + globals.css: render the picture; EditPersonModal: Picture field (picker, paste, drop, remove)
- [x] Host: peoplePhotoStorage.js (upload/sign/remove/claim); PeoplePage passes media
- [x] Frodo: peopleCore photo field + tests; peopleApi claim/clear/cleanup; aiLibrary field; useAIAgent note; aiTiers bullet
- [x] Ledger DR-035; CLAUDE.md People paragraph
- [x] Run focused tests, lint, full test suite, and build
- [x] Verify against the real Orbit server (file store): photo validation accepts/rejects as specified
- [x] Verify rendered: scratch Vite page mounting the real Orbit app against the local Orbit server with a stub media capability; add a picture to a test person, see it on profile and list, replace it, remove it, delete the test person; screenshots in verification/
- [x] Close out: WORKLOG.md, CHANGELOG.md, ACTIVE_WORK.md, post-task checklist
- [x] Commit locally; push and deploy wait for Scott's separate approval

## Approval

Scott's direct order on 2026-10-28 ("i'm unable to add a picture to orbit, I wanna be able to send screenshots like I can for frodo") authorizes implementing this feature and a local commit. Per AGENTS.md and the post-task checklist, push and deployment require Scott's separate explicit approval and are not part of this work unit. No database migration and no new storage bucket are needed; the person doc is JSONB and the image bucket already exists.

## Implementation record

- Files changed:
  - `src/utils/storageKeys.js`: `personPhotoStoragePath`, `isPersonPhotoPath`, `isOwnedPersonPhotoPath`, `PEOPLE_PHOTOS_FOLDER`.
  - `src/utils/storageKeys.test.js`: path build and shape/ownership checks (already in the test chain).
  - `orbit/src/lib/validate.js`: `isPhotoPath` + the `photo` rule and `""` normalization in `validatePerson`.
  - `orbit/src/lib/runtime.js`: optional `media` capability in `configureOrbit`, exposed as `mediaStore()`.
  - `orbit/src/lib/photoUrl.js` (new): signed-URL cache + `usePhotoUrl` hook.
  - `orbit/src/components/ui/Avatar.jsx`: renders the picture when its URL resolves; initials otherwise.
  - `orbit/src/globals.css`: one `.avatar img` rule (fill the disc, cover).
  - `orbit/src/components/person/PersonFormModal.jsx`: `PictureField` in Edit basics (picker, paste, drop, remove; replaced files deleted only after a successful save).
  - `src/api/peoplePhotoStorage.js` (new): upload/sign/remove/claim for person pictures in the `bug-screenshots` bucket, mirroring `chatAttachmentStorage`'s owner discipline.
  - `src/pages/admin/PeoplePage.jsx`: passes the media capability to `configureOrbit`.
  - `src/api/peopleCore.js`: `photo` scalar on create/update/flatten; non-string refused. Tests updated and extended in `src/api/peopleCore.test.js`.
  - `src/api/peopleApi.js`: staged-path claim and existing-path passthrough before the Orbit write; replaced picture removed after a successful save.
  - `src/api/aiLibrary.js`: `people` gains the `photo` field, a description clause, and `photo` in defaultFields.
  - `src/hooks/useAIAgent.js`: the user-turn note now also gives an attached screenshot's staged path and how Frodo uses it as a picture.
  - `src/api/aiTiers.js`: PEOPLE bullet teaches the picture route.
  - `CLAUDE.md`: People paragraph aligned with DR-035. `ledger.jsonl`: DR-035 appended.
  - `docs/development/BUGS.md`: no entry; this is a missing feature, not a defect.
  - `verification/photo-orbit-api-verify.mjs` + output, `verification/photo-server.mjs`, `verification/photo-ui-verify.py` + output, `verification/photo-*.png` (evidence only, not committed).
- Decisions: DR-035 (appended to ledger.jsonl).
- Data or API changes: the person doc gains an optional `photo` string (JSONB, no migration); no new bucket, endpoint, or dependency.

## Validation

- Automated: `npm run lint` clean; `npm test` green end to end (final node --test group 337 pass / 0 fail, up from 335: 2 new peopleCore tests; storageKeys gained 2 tests in its plain-assertion file); `npm run build` passes (pre-existing large-chunk advisory only). New tests: storageKeys path build/shape/ownership, peopleCore photo round-trip and non-string refusal.
- Orbit server, real code path: `verification/photo-orbit-api-verify.mjs` booted the real Orbit server (`orbit/server/app.js` -> `repo.js` -> `validate.js`) on a throwaway `ORBIT_DATA_DIR`. All checks passed: no photo normalizes to `""`; a well-shaped path is stored and read back, and `flattenPersonDoc` carries it; an update sets it and `""` clears it; a URL, a path with a space, a non-image extension, a non-string, a missing extension, and an over-length path are each refused 400 with "photo must be a stored image path"; the test people were deleted through the API. Full output in `verification/photo-orbit-api-verify-output.txt`.
- Rendered UI: a scratch Vite page mounted the real Orbit app (same providers as PeoplePage, no shadow root) against the real Orbit API on the file store, with a stub media capability (object URLs standing in for Supabase signed URLs). Playwright drove the whole flow with generated PNGs: added "Photo Test Person" through Add People; profile opened with initials; Edit basics showed the Picture field; choosing the red PNG uploaded it, previewed it in the modal, and after Save the picture showed in the profile header and in the People list row; Change picture swapped it for the teal PNG; Remove plus Save brought the initials back; the stored document ended with `photo: ""` and the test person was deleted through the API. Screenshots: `verification/photo-profile-with-picture.png` (red picture in the drawer header), `verification/photo-list-with-picture.png` (red picture in the list row), `verification/photo-removed.png`. Full step log in `verification/photo-ui-verify-output.txt`. The scratch Vite entry was deleted after the run.
- Left unverified (post-deploy gate): the real Supabase Storage round trip with Scott's signed-in session (upload to `bug-screenshots` under `<uid>/people/…`, signed-URL display in the embedded People page) and Frodo's live claim of an attached screenshot. Both use the same bucket, policies, and calls as the verified chat-screenshot flow; the signed-in pass is listed in ACTIVE_WORK.md.
- Known limits: a picture uploaded in Edit basics but never saved stays as an orphan object in Scott's bucket; deleting a person does not delete their picture file (Orbit's delete cascade is storage-blind); paste/drop were wired through the same upload path as the picker but not separately exercised in the rendered run.

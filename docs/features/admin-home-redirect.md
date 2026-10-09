# Feature: Admin home redirect

**Status:** Approved implementation
**Owner:** Scott
**Started:** 2026-10-09
**Approval:** Scott said “go” on 2026-10-09.

## User problem

On a phone, an already signed-in owner who opens the site root must first navigate through the public home page and tap Admin to return to the personal command centre.

## Desired outcome

The root URL sends an existing authenticated admin session directly to Today. Signed-out visitors retain the public home page.

## Scope

### Included

- Check for an existing Supabase session only on the root route.
- Replace `/` with `/admin/today` when that session has an authenticated user.
- Keep public, shared-document, and all non-root routes unchanged.

### Not included

- Automatic sign-in, session creation, authentication-policy changes, or redirecting signed-out visitors.

## Experience contract

- Desktop and mobile: A signed-in owner opening `/` reaches Today without tapping Admin; other visitors see the public home.
- Keyboard and screen reader: The redirect replaces browser history; no new interactive control is introduced.
- Loading and error: The public home remains available while the asynchronous session check runs or if it fails.
- List-card counts: Not applicable.

## Acceptance criteria

- [x] An authenticated session maps `/` to `/admin/today` with a history replacement.
- [x] No session or session-check failure leaves the public home visible.
- [x] Public and non-root routes do not perform this redirect.
- [x] Focused regression coverage and required validation pass.

## Pseudocode

```text
WHEN the root route mounts
  RENDER the public home immediately
  ASYNCHRONOUSLY read the existing Supabase session
  IF the session contains an authenticated user
    REPLACE the root history entry with /admin/today
  OTHERWISE keep the public home rendered

WHEN the session lookup fails
  KEEP the public home rendered
  DO NOT create, refresh, or alter authentication state

TEST the authenticated, signed-out, and malformed-session decisions
```

## Ordered task checklist

- [x] Step 1 — Record the approved scope and redirect contract.
- [x] Step 2 — Add a root-only session decision and regression coverage.
- [x] Step 3 — Run automated validation.
- [x] Complete the post-task checklist, except authenticated browser verification.

## Implementation record

- Files changed: `src/App.jsx`, `src/utils/adminHomeRedirect.js`, `src/utils/adminHomeRedirect.test.js`, and `package.json`.
- Data or API changes: None planned.

## Validation

- Automated: `node --test src/utils/adminHomeRedirect.test.js` (1/1), `npm run lint`, `npm test` (322/322), and `npm run build` (3,155 modules) passed on 2026-10-09. The Vite local root returned HTTP 200.
- Desktop visual check: Unverified. The available browser providers could not open the local server.
- Mobile visual check: Unverified. Confirm on a signed-in phone browser after release by opening the root URL.

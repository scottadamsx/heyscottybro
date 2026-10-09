# Feature: Admin lazy-chunk recovery

**Status:** Resolved locally — uncommitted
**Owner:** Scott
**Started:** 2026-10-09
**Approval:** Scott said “go” on 2026-10-09 after the diagnosed `BUG-068` fix was presented.

## Problem

Admin routes use raw React lazy imports while public routes use the existing one-reload stale-chunk recovery wrapper. A phone/PWA tab that loses or outlives a hashed admin chunk can therefore show “Importing a module script failed” in the `Lazy`/`Suspense` error boundary instead of recovering.

## Scope

- Route every admin page chunk through the existing `lazyWithReload` wrapper.
- Add focused coverage for the reported import-error class, one guarded reload, reset after a successful load, and a real non-chunk error.
- Preserve existing admin `Suspense`, error boundary, route paths, and skeleton behavior.

## Non-goals

- No service-worker cache strategy change, dependency, migration, data write, or deployment.
- No repeated reload loop or suppression of genuine component errors.

## Acceptance criteria

- [x] A stale/importing-module failure on an admin route requests one reload only.
- [x] A successful later route chunk re-arms recovery for a future deployment.
- [x] A non-chunk exception reaches the existing error boundary without reload.
- [x] Existing admin route paths and loading skeletons remain unchanged.
- [x] Focused tests, lint, full tests, build, and whitespace check are recorded.

## Pseudocode

```text
WHEN an admin route component is declared
  CREATE it with the same shared lazy-with-reload helper used by public routes

WHEN its dynamic import succeeds
  CLEAR the one-reload guard and render normally inside the existing Suspense shell

WHEN its import matches the known stale/transient module-load error
  RELOAD once so the tab obtains the current deployment manifest
  IF that guard was already used
    PRESERVE the existing error-boundary behavior instead of looping

WHEN its import fails for any other reason
  DO NOT reload
  PRESERVE the existing error-boundary behavior

TEST the helper directly for first failure, rearmed recovery, and ordinary errors
  AND assert the admin route registry imports the shared helper rather than React lazy
```

## Ordered task checklist

- [x] Step 1 — Record diagnosis, scope, pseudocode, and Scott’s approval.
- [x] Step 2 — Move admin route imports to the shared recovery helper.
- [x] Step 3 — Add focused regression coverage.
- [x] Step 4 — Run validation and complete durable records.

## Validation

- Files changed: `src/pages/admin/adminRoutes.jsx`, `src/utils/lazyWithReload.js`, `src/utils/lazyWithReload.test.js`, and test registration.
- Behavior: Every admin page now uses `lazyWithReload`. The guard reloads only when the reported module-import error matches; it validates session storage before reloading, so unavailable storage fails visibly rather than looping. Successful imports clear the guard. Ordinary component errors still reach the existing error boundary.
- Automated: `node --test src/utils/lazyWithReload.test.js` (3/3), `npm run lint`, `npm test` (325/325 final Node test group), `npm run build` (3,156 modules), and `git diff --check` passed on 2026-10-09.
- Visual: No visual control/layout changed. Production/PWA confirmation remains pending release because the fix is local and uncommitted.

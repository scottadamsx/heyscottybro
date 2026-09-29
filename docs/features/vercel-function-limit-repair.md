# Feature: Vercel function-limit repair

**Status:** Release approved — commit, push, and production verification in progress

**Owner:** Scott

**Started:** 2026-09-29
**Approval:** Scott said exact **“go”** on 2026-09-29 after reviewing this contract and pseudocode, authorizing implementation and local validation. After reviewing the settled implementation and exact release target, Scott said exact **“go”** again on 2026-09-29, authorizing the recorded commit, push to `origin/main`, automatic Vercel Production deployment, and live verification.

## User problem

The live site does not contain the committed Today dashboard or Frodo reliability work even though local `main` and `origin/main` contain both features.

## Desired outcome

Restore successful automatic production deployment from `main` without removing Kiwi shared tasks or changing its public API, then verify that the live Today and Frodo experiences match the committed behavior.

## Current behavior

- The Vercel project is `scottadamsxs-projects/heyscottybro`, sourced from GitHub repository `scottadamsx/heyscottybro` and default branch `main`.
- The public production alias is `https://heyscottybro.vercel.app`.
- The most recent successful Production deployment is commit `b1cb1b69c1b87ff1691914f90fe4712299f2cee5`, deployed on 2026-09-18 at `https://heyscottybro-4jgbeco4n-scottadamsxs-projects.vercel.app`.
- Commit `76f44736604829cd8001395d5fa6b166c0812e90` added `api/kiwi-tasks.js`, increasing deployable non-underscore `api/*.js` files from the Vercel Hobby limit of 12 to 13.
- Vercel attempted Production deployments for `76f4473`, Frodo commit `0760393`, and current `main` commit `d24492f`; each failed and therefore was not promoted. The earlier record that no deployment was performed remains true for manual agent action, but automatic Vercel deployment attempts did occur.
- The live Today page still shows the pre-`c2b8700` dashboard, confirming that the failed builds did not reach the production alias.
- Local application build evidence from the Today and Frodo work passed because the Vite build does not enforce Vercel's hosted-function count.

## Scope

### Included

- Preserve the external `/api/kiwi-tasks` path, methods, authentication, validation, response shapes, time-zone behavior, row limits, and idempotent task creation.
- Move the Kiwi implementation to an underscore-prefixed internal API module so it is not counted as a separate Vercel function.
- Add an exact Vercel rewrite from `/api/kiwi-tasks` to the existing `/api/fetch` function with an internal route marker.
- Dispatch the marked request to the Kiwi handler before `/api/fetch` applies its existing POST-only web-fetch behavior.
- Keep ordinary `/api/fetch` behavior unchanged.
- Add focused routing coverage and a deterministic regression that rejects more than 12 deployable non-underscore API functions.
- Run focused tests, lint, all tests, the production build, registry validation, whitespace review, and final diff review.
- After separate release approval, commit and push the repair to `main`, allow Vercel to deploy the pushed commit to `scottadamsxs-projects/heyscottybro`, and verify `https://heyscottybro.vercel.app`.

### Not included

- Removing or weakening Kiwi shared tasks.
- Changing Supabase schema, policies, stored data, environment values, dependencies, or Vercel plan.
- Changing Today or Frodo product behavior beyond making their committed versions deployable.
- Fixing deferred `BUG-055` or `BUG-056`; they remain validation debt, not evidence that the deployed Frodo behavior is broken.

## Experience contract

- Desktop: no intentional UI change; after deployment the existing committed Today dashboard and Frodo desktop behavior are present.
- Mobile: no intentional UI change; after deployment the committed Frodo safe-area, newest-message, containment, and control behavior are present.
- Keyboard and screen reader: no intentional interaction or semantics change.
- Loading, empty, and error states: Kiwi preserves its current responses; unsupported methods remain `405`, missing or expired sessions remain `401`, invalid inputs remain `400`, and unavailable upstream work remains an honest error.
- List-card counts: not applicable; this repair changes serverless routing and deployment validation only.

## Acceptance criteria

- [x] The deployable non-underscore `api/*.js` count is 12 or fewer.
- [x] `/api/kiwi-tasks` still supports its existing public configuration GET, authenticated task GET, and authenticated idempotent task POST contracts.
- [x] `/api/fetch` still supports its existing authenticated POST contract and rejects unsupported methods.
- [x] The route marker cannot accidentally invoke Kiwi through an ordinary unmarked `/api/fetch` request.
- [x] Focused Kiwi, routing, and function-count regressions pass.
- [x] `npm run lint`, `npm test`, and `npm run build` pass on the settled tree.
- [x] No dependency, schema, production-data, secret, or unrelated application change is introduced.
- [ ] After separate release approval, Vercel reports a successful Production deployment from the repaired `main` commit.
- [ ] `https://heyscottybro.vercel.app/admin/today` shows the committed thin Priority/Agenda/Money brief and paired schedule layout.
- [ ] Frodo opens and retains the committed desktop/mobile reliability behavior through non-destructive checks.
- [ ] Production verification states that `BUG-055` and `BUG-056` remain deferred direct-composition test gaps.

## Edge cases

- Existing query parameters, including Kiwi's `config=1`, must survive the rewrite alongside the internal route marker.
- Direct requests to `/api/fetch` must not be interpreted as Kiwi requests merely because their body resembles a Kiwi payload.
- The internal marker must be removed or ignored before the existing fetch handler interprets its own input.
- Failed Vercel deployment attempts must not be described as promoted releases.
- A successful build is not enough: the production alias and deployed Git commit must both be verified.
- Commit, push, and production deployment remain separate release actions after implementation review.

## Pseudocode

```text
WHEN Vercel receives /api/kiwi-tasks
  rewrite the request to the existing /api/fetch serverless entry
  attach one private route marker
  preserve the original method, headers, body, and query parameters

WHEN /api/fetch receives a request
  IF the private route marker identifies Kiwi shared tasks
    hand the request to the internal Kiwi handler before normal fetch validation
    preserve Kiwi's current GET, POST, authentication, validation, limits, errors, and response shapes
  OTHERWISE
    run the existing authenticated web-fetch handler unchanged

ORGANIZE the Kiwi code
  move its implementation to an underscore-prefixed module under api
  keep its testable helper exports
  do not expose that module as its own Vercel function

VALIDATE locally
  count only non-underscore JavaScript entry files directly under api
  fail the regression if the count exceeds 12
  prove the rewrite marker selects Kiwi and an unmarked request stays on the fetch handler
  rerun the existing Kiwi success, validation, authentication, recurrence, limit, and idempotency cases
  run lint, all tests, production build, registry validation, whitespace, and diff review

AFTER Scott reviews the settled implementation and separately approves release
  commit and push the repair to main
  allow Vercel project scottadamsxs-projects/heyscottybro to build the pushed main commit
  require the Production deployment to succeed before claiming release
  verify the production alias reports the repaired commit
  inspect Today and Frodo without writing production data
  report BUG-055 and BUG-056 as still deferred validation limitations
```

## Ordered task checklist

- [x] Step 1 — Verify the session identity, governing documents, branch, working tree, feature records, and prior commits.
- [x] Step 2 — Identify the Vercel project, production alias, source branch, live successful commit, failed deployment commits, and exact function-count boundary.
- [x] Step 3 — Record the diagnosis, repair contract, pseudocode, acceptance criteria, edge cases, and approval boundary.
- [x] Step 4 — Receive Scott's exact `go` or `I approve` for implementation.
- [x] Step 5 — Move the Kiwi implementation behind `/api/fetch` while preserving `/api/kiwi-tasks`.
- [x] Step 6 — Add and run focused route, Kiwi, and function-count regressions.
- [x] Step 7 — Run full quality gates and review the settled diff.
- [x] Step 8 — Present the implementation and exact release target for separate commit, push, and deployment approval.
- [ ] Step 9 — After release approval, commit, push, verify the Vercel Production deployment, and inspect Today/Frodo non-destructively.
- [ ] Step 10 — Complete the post-task records and session handoff.

## Implementation record

- Files changed: Moved `api/kiwi-tasks.js` to internal `api/_kiwi-tasks.js`; added marked dispatch to `api/fetch.js`; added the exact rewrite to `vercel.json`; updated Kiwi tests; added the function-count/rewrite regression; registered it in `package.json`; updated coordinated documentation.
- Decisions: Preserve `/api/kiwi-tasks`; share the existing `/api/fetch` Vercel entry through an explicit rewrite and internal dispatch. Ordinary unmarked fetch requests remain on the existing handler.
- Data or API changes: No public API, schema, dependency, or production-data change is proposed.

## Validation

- Automated: The combined Kiwi, marked-dispatch, exact-rewrite, and 12-function focused suite passes 10/10. The registry suite passes 7/7. All 264 registered tests pass. Full and scoped ESLint pass with zero warnings. The 3,148-module production build passes with the existing mixed-import and large-chunk advisories. Registry validation passes for two IDs and selects `SAI00000003`; `git diff --check` passes.
- Desktop visual check: Live installed app inspected at `https://heyscottybro.vercel.app/admin/today`; it shows the older dashboard without the committed Today schedule layout.
- Mobile visual check: Await successful deployment; no production release is approved yet.
- Known limitations: Vercel build logs require account access, but the GitHub deployment boundary, first failing commit, 12-to-13 function change, repeated later failures, and repository's recorded Hobby limit establish the cause. Production verification cannot occur until Scott separately approves commit, push, and deployment. `BUG-055` and `BUG-056` remain deferred.

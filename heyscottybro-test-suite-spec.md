# Test Suite Setup — heyscottybro

> **Prompt to give Claude Code.** Read the ASSUMPTIONS block first and fix anything that's wrong before running. Everything below depends on it.

---

## ASSUMPTIONS (correct these before you start)

- **Frontend:** Next.js + React + TypeScript + Tailwind
- **Backend:** Node (Next.js API routes / server actions)
- **Database:** Supabase (Postgres)
- **AI agent ("Frodo"):** calls an LLM API (Anthropic) server-side
- **No existing test suite** (this is a from-scratch setup)

If any of these are wrong, tell me and I'll adjust the plan before writing code.

---

## GOAL

Stand up a practical, layered test suite. **Do not chase 100% coverage.** Prioritize the code where a bug actually costs something: auth, anything that writes user data, the Frodo message loop, and PII handling. Get a working test runner + a few high-value tests first, then expand.

---

## TEST STACK TO USE

- **Vitest** — unit + integration test runner (fast, TS-native, Jest-compatible API)
- **React Testing Library** — component tests
- **Playwright** — end-to-end (one or two critical flows only, to start)
- **MSW (Mock Service Worker)** — intercept and mock the LLM API and any external HTTP calls
- A **mocked Supabase client** for unit/integration, and a **separate test database / local Supabase** for integration tests that genuinely need the DB

Set up config, scripts (`test`, `test:watch`, `test:e2e`), and a CI step that runs unit + integration on every push (E2E can run separately).

---

## WHAT TO BUILD, BY LAYER

### 1. Smoke test (do this first)
A single test that proves the app boots and the test infrastructure works. Don't move on until this is green.

### 2. Unit tests — deterministic logic only
Pure functions with no I/O. These are cheap and catch the most regressions:
- Prompt builders / context assembly for Frodo
- Parsers and validators for the LLM's responses (e.g. JSON extraction, schema validation)
- Any formatters, date/timezone helpers, state reducers
- Input validation and sanitization

### 3. Integration tests — pieces working together
- API routes hitting a **test database** (seed → call → assert → teardown)
- Auth middleware: authenticated vs unauthenticated vs wrong-user access
- The **Frodo agent loop with the LLM mocked** (see next section)
- Database read/write paths for user data

### 4. End-to-end tests — critical user flows only
Pick the 1–2 flows that, if broken, make the app useless. Likely:
- User sends a message to Frodo → gets a response → it persists to history
- Login / session

---

## TESTING FRODO (the part people get wrong)

Frodo's output is **non-deterministic**, so do **not** assert on exact LLM text in your test suite. Split it:

**In the test suite (deterministic, runs in CI):**
- **Mock the LLM client at the boundary.** Use MSW or a stubbed client so the agent code runs against fixed, fake responses.
- Test the code *around* the model:
  - Is the prompt assembled correctly from conversation state + user input?
  - When the LLM returns valid output, is it parsed and persisted correctly?
  - When the LLM returns **malformed** output, does the app fail gracefully (no crash, sensible fallback)?
  - When the LLM API **errors or times out**, is it handled (retry/error message, not a hang)?
  - If Frodo uses tools/function calls, is dispatch correct and are unknown tools rejected safely?

**As a separate eval set (NOT in CI on every commit):**
- A small folder of `input → expected-property` cases (e.g. "response mentions the user's name", "response is valid JSON", "refuses out-of-scope request").
- Assert on **properties**, not exact strings.
- Run occasionally / before releases. Keep it out of the per-commit run because it costs money and is inherently flaky.

---

## PII (relevant since this is a production app)

Add tests that lock down data handling:
- Logging does **not** capture PII (assert sensitive fields are redacted/absent from log output)
- API responses don't leak other users' data (authorization tests)
- Anything sent to the LLM API is the minimum necessary

---

## DO NOT

- Aim for a coverage percentage target
- Assert on exact LLM-generated text in CI tests
- Hit the real LLM API or real production database in the test suite
- Test trivial getters/setters or framework internals

---

## DELIVERABLES / DEFINITION OF DONE

1. Test runner configured, `npm test` works
2. Green smoke test
3. Unit tests for prompt building + response parsing
4. Integration test for the Frodo loop with a mocked LLM
5. Integration test for one authenticated API route against a test DB
6. One Playwright E2E for the core message flow
7. One PII/authorization test
8. A short `TESTING.md` explaining how to run each layer and where to add new tests
9. CI config running unit + integration on push

Build it incrementally and pause after the smoke test and after the first Frodo loop test so I can review before you keep going.

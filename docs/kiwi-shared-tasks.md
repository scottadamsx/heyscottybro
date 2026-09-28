# Kiwi shared tasks — first integration

Kiwi now connects to the existing Hey Scotty Bro account and uses canonical `reminders`. No duplicate task database or Brain writes are added. The first supported commands are “What are my tasks today?”, “Add task: Buy groceries”, and “Add task for 2026-10-01: Buy groceries”. These are deterministic commands handled before a model call; they consume no provider tokens.

The endpoint verifies the user's access token with Supabase, performs every database call using that token plus the public project key, and scopes reads and writes to the verified user ID. Today uses America/St_Johns and existing recurrence expansion, with undated tasks separately labeled Anytime. Reads cap candidate rows at 500 and return a visible error above that cap, rather than silently omitting tasks; each output section is capped at 100 with a truncation indicator.

Creation supports one-time tasks only. A UUID request ID and authenticated user ID derive the canonical reminder ID. Repeated delivery returns the existing record; changed input with the same ID is rejected. Kiwi coalesces concurrent identical commands and retains uncertain write IDs in memory for retry. Retry the identical command while connected after an uncertain result. Disconnecting, quitting, or session expiry clears that memory: check Hey Scotty Bro before re-adding an uncertain task afterward. Cancellation cannot undo a write already accepted by the server.

## Setup and verification

Deploy this revision to a test environment connected to a test Supabase project, using the project's existing public key and URL environment variables (`SUPABASE_URL` or `VITE_SUPABASE_URL`, and `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`, or `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`). The service key is neither needed nor returned. An accidentally privileged JWT or secret key in the public-key field fails closed. The canonical reminders table must already exist with normal user access policies; no migration is included.

Build Kiwi, then open Settings → Hey Scotty Bro tasks. Enter the trusted test website address and an existing test account's email/password. Credentials go directly to the configured Supabase Auth endpoint; the password is not persisted and the access token stays only in the main process. Session expiry requires signing in again. No production endpoint was deployed, existing password entered, or production data read/written during implementation.

Local tests cover two-user scoping, expired/missing sessions, validation, repeated delivery, date boundaries, recurrence, Anytime, bounded output, client offline retry, concurrent duplicate commands, and cancellation suppressing late account results. Live authentication, database policies, cross-client visibility after refresh, and Electron visual interaction still require the test-environment smoke check. Existing tests/builds pass; Kiwi's localhost hook test remains skipped by the sandbox.

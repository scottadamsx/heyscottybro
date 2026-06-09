# heyscottybro — Claude Instructions

## Bug-Fixing Workflow

When asked to check for and fix bugs, follow these steps in order:

### 1. Retrieve open bug tasks from the database
- List Supabase projects to get the project ID.
- Query the `reminders` table for open items (`completed = false`) whose names indicate a bug or fix (e.g. contain "fix", "bug", "broken", "error", "not working").
- For each matching task, read its `name` as the description and reproduction hint.

### 2. Scan the codebase for broken parts
In addition to logged tasks, actively inspect the codebase for common breakage patterns:
- **Missing exports/imports** — functions referenced in one file but not exported from another.
- **Dead API calls** — calls to Supabase tables or columns that don't exist in the schema (`SUPABASE_SETUP.sql` or live DB).
- **Unhandled promise rejections** — `await` calls with no try/catch and no `.catch()` at any level.
- **Broken routes** — pages listed in the router that don't have a corresponding component file.
- **Console errors** — obvious patterns like accessing `.map()` on a potentially-null value without a guard.
- **Stale feature flags / TODOs marked BROKEN** — grep for `// TODO`, `// FIXME`, `// BROKEN`, `// HACK` comments.

Use `Grep` and `Glob` to search; focus on `src/`, `api/`, and root config files.

### 3. Fix each issue
- Make the minimal change needed to fix the bug — no refactoring, no unrelated cleanup.
- Do not add comments explaining the fix; the commit message is the record.

### 4. Commit and push
- One commit per logical fix (or group closely related fixes in one commit if they touch the same feature).
- Commit message format: `Fix <short description>\n\nResolves task: "<exact task name from DB>" (if applicable)`
- Push to the active development branch.

## General Guidelines
- Always develop on the branch specified at session start (check git branch).
- Never push to `main` directly.
- Run `npm run build` (or check for TypeScript/lint errors) after non-trivial changes if a build script is available.

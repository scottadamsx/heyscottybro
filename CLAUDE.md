# heyScottyBro — implementer rules

Scott's personal command centre: seven spaces (Today · Plan · Money · School ·
Life · Mission Control · Vault), a Fellowship of AI agents that can read and
write every collection, on React 18 + Vite + Supabase + Vercel.

Orientation: `MASTERPLAN.md` is the architecture and IA of record. `ledger.jsonl`
is the decision ledger — records are append-only; never edit one, append a
superseding record and flip the old one's status. There is no compiled
`docs/devrules/` set yet: the 2026-07-26 session ran **house-style-only** on the
existing app (DR-008), so the floors below are the governing rules, not a spec.

## Inherited house style — non-negotiable

This repo inherits `~/Documents/GitHub/DEVRULES & FORGE/devrules/housestyle.md`
(QF-1…QF-10) and `housestyle-ui.md` (UI-1…UI-9). Read them before a styling or
persistence change. The ones this codebase has actually broken before:

- **QF-3 · Persistence is versioned.** Stored state carries a schema version and
  an explicit load-failure path. **Silent fallback to defaults is forbidden** —
  this repo is the origin of that floor (the vanishing-data incident).
  `plannerApi.op()` logs loudly on fallback; keep it that way.
- **QF-4 · Money is integer cents; time is a real timestamp.** Never a float for
  currency, never a display string as stored time.
- **QF-5 · No dead controls ship.** A rendered button either acts or doesn't render.
- **QF-6 · Displayed metrics update** or are tagged `static-display`.
- **QF-7 · One styling source of truth.** Tokens live in `src/styles/globals.css`,
  components in `src/styles/system.css`.
  Inline styles only for truly local layout; the sweep threshold is 20 blocks
  per app. This repo is the origin of that floor too (125 inline blocks).
- **QF-9 · Accessibility.** Real buttons/links, visible focus, colour is never
  the only signal.
- **QF-10 · Secrets never enter the ledger, docs, or source.** Names only.

## Measurement honesty (DR-004)

`node "…/devrules/validate-ui.mjs" .` is a **Tailwind class scanner**. This repo
is plain CSS, so UI-2 (height), UI-3 (radius), UI-4 (border) and UI-6 (focus)
report green *without being measured*. Treat those four as unchecked and review
them by hand. Only UI-1 (hex literals), UI-5 (repeated classNames) and UI-7
(reduced-motion) are real signals here. Baseline 2026-07-26: **UI-1 176 · UI-5 2
· UI-7 missing**. After the 2026-08-25 theme sweep: **UI-1 108 · UI-5 2 · UI-7 ✓**
(the remaining UI-1 hits are JSX inline colours, mostly user data / chart
palettes tagged `theme-fixed`). After the 2026-09-14 redesign (DR-013):
**UI-1 47 · UI-5 0 · UI-7 ✓** — the 47 are user-chosen palettes (project,
tracker, profile colours that get saved) and data-coloured charts. Do not
claim a check that does not exist.

## Design system (2026-09-14, DR-013 — supersedes DR-011)

One system, two scopes. `<html data-theme="light|dark">` is set before first
paint by `src/utils/theme.js` (the stored choice may also be `auto`, which
follows the OS live). The XP desktop and the nine novelty themes are gone —
do not reintroduce theme packs.

- **Tokens** — `src/styles/globals.css` only: `:root` + `:root[data-theme="dark"]`,
  identical names. A new colour goes in both scopes; a component never
  carries a literal.
- **Components** — `src/styles/system.css` is the single component layer
  (shell, buttons, fields, cards, lists, tabs, overlays, states), scoped
  under `.admin-shell`. Do not add skin/"polish" layers on top of it; change
  the rule in place. Page-specific CSS (e.g. `pages/admin/today.css`) may
  compose tokens but not redefine primitives.
- **The rules** — 8-pt spacing (4·8·12·16·24·32·48·64); type 11/12/13/14/16/
  20/24/32/40, body 14/20; Roboto Slab for titles and headline numbers,
  system SF for reading; radii 6/8/12/16/24 + capsule buttons/tabs;
  controls 32/40/48 (44 on touch); every text colour ≥ 4.5:1; no uppercase
  tracked micro-labels; page titles carry no icons.

## The escalation rule (QF-8) — verbatim

> If implementation requires a decision not present in these documents, STOP.
> Do not infer. Emit a `SPEC-GAP` block naming the missing decision, its
> apparent options, and your recommended default. Await resolution.

```
SPEC-GAP
decision: <what's missing>
options: <a> | <b>
recommendation: <a, because ...>
blocked-task: <T-x>
```

## Conventions digest

- **Data** — every collection goes through `src/api/*Api.js`; one `uid()` from
  `api/_base.js`; agents reach data only via the Library (`aiLibrary.js`), never
  bespoke queries. Adding a collection means registering it there or agents
  cannot see it.
- **Errors** — surface real messages. A tool that failed says so; never report
  an optimistic result. Storage/API errors get context added before they reach a
  toast.
- **Styling** — `src/styles/globals.css` tokens (`--bg-*`, `--text-*`, `--accent`,
  `--space-*`, `--radius-*`); compose from `src/styles/system.css` classes and
  `src/components/ui/`. New pages do not
  ship inline-style blocks.
- **Agents** — one loop core (`agents/loop.js`); the Brain is single-writer
  (Bilbo) and the policy lives in `aiTools.brainWriteDenial`; conversations
  persist in `agent_sessions`, not localStorage.

## Cadence

`npm run build && npm test` before every commit; commit at each task boundary
(QF-1). Deploy is not optional — the standing lesson in this repo is that a
phase which isn't pushed didn't happen.

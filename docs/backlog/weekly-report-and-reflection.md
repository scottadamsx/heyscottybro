# Backlog — Weekly Report + AI Journal Reflection

Queued 2026-09-14 at Scott's request. Not started. These are the design
rules agreed before building; treat them as the spec.

## Build order (fastest path to value)

1. **Habit toggles inside the journal entry.** One tap per habit (worked out,
   smoked, read, wrote code…) while writing. The journal *is* the habit
   tracker; everything downstream needs this data and it can't be backfilled.
2. **Report page, numbers only, no AI.**
3. **AI summary + next-week actions**, once there are ~4 weeks of data.

## 1 · Personal Report page (weekly)

Trends against yourself, not letter grades. Report cards turn into the
thing you avoid opening, then you stop logging. Show arrows and deltas:
"Workouts: 2 this week · 3 last week · 4-week avg 2.5". If a single score
exists, it rises when you log, so honesty is what gets rewarded.

| Metric | Source |
|---|---|
| Spending by category | Money (`transactions`), week vs last week |
| Tasks on time vs late | tasks/reminders: needs a due date + `completed_at` on every item |
| Workouts, smoked, read | journal habit toggles (step 1) |
| Journaled | an entry exists that day |
| Wrote code | GitHub API, commits per day across repos (automatic) |

Layout, top to bottom: numbers with deltas, then the spending breakdown,
task hit rate, habit grid (7 columns × one row per habit, filled/empty),
the AI summary paragraph, and next week's actions.

**Actions (closed loop):** at most 3. Each is tied to a number in the report
("late on 4 of 6 tasks, all same-day due dates → set due dates the night
before"), gets inserted as a task for next week, and the next report checks
whether it was done. The report grades its own advice.

## 2 · AI Journal Reflection

Worth building: patterns you can't see from inside a day ("money stress in
9 of 14 entries, every one also 'smoked'"; "said 'make content tonight' 4×,
never followed up").

Failure modes to design against: generic therapy-speak, and flattery.

**Prompt rules:**
- Every claim quotes or cites specific entries by date.
- No advice unless a pattern repeats at least 3 times.
- At most one question at the end, and make it pointed.
- Match Scott's register. Swearing is fine; no motivational tone.
- Allowed to say uncomfortable things ("you keep saying you'll sell the
  bike. Have you listed it?").
- Short: one screen max.

**Cadence:** weekly (Sunday morning), from that week's entries plus the
previous few weeklies so it can see trends across weeks. Monthly reads the
weeklies for the bigger picture. No daily reflections: too little signal,
and they get repetitive.

**Extras:** it may reference old entries ("in June you wrote…"). Scott can
reply to a reflection, and the reply is stored as a journal entry.

**Guardrail:** the reflection never replaces Scott's own weekly questions.
Surface it *after* he's written his own, so it doesn't lead him.

## Agent access

Both features read through the Library (`src/api/aiLibrary.js`). Any new
collection (habit toggles, reflections, report actions) must be registered
there, or the Fellowship can't see it.

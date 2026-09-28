# Feature: Hourly day calendar beside day modal

**Status:** Discovery
**Owner:** Scott
**Started:** 2026-09-28

## User problem

Opening a day or choosing a date does not consistently show what is already scheduled that day. Scott must leave the current context or remember the schedule before assigning a time.

## Desired outcome

When a day is opened from the Planner, show its complete hourly schedule beside the day modal so existing commitments are visible without leaving the task.

## Requested reference

Reuse the interaction language of the existing **Fit it in** schedule panel, including positioned events such as “Gym, 4:30–6:00 PM” and “Minecraft with Carter, 10:00–11:00 PM.”

## Scope and current behavior

Pending code and visual inspection. No implementation has begun.

## Experience contract

- Desktop: day details and hourly context should remain visible together.
- Mobile: must not force an unreadably narrow two-column layout; final behavior requires inspection and Scott's approval.
- Keyboard and screen reader: the schedule must be navigable and events must expose names and times as text.
- Loading, empty, and error states: must be explicit and must not imply an empty day after a failed load.

## Acceptance criteria

- [ ] Opening a Planner day shows the correct date's hourly schedule without navigation.
- [ ] Timed events appear at the correct start and end times.
- [ ] The panel stays synchronized if the selected day changes.
- [ ] Empty days have a clear empty state.
- [ ] Existing day-modal actions continue to work.
- [ ] Desktop and mobile layouts are intentionally designed and verified.
- [ ] Automated regression coverage and visual evidence are recorded.

## Pseudocode

Not written yet. It will follow inspection of the existing day modal, `RescheduleSheet`, event expansion, and mobile modal system. Implementation is blocked until Scott approves the completed pseudocode.

## Implementation record

No application code changed.

## Validation

Not started.

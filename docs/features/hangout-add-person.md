# Add a new person from the people pickers

Status: approved by Scott's direct report, 2026-11-27 ("there's no option to add a new person this is a big flaw").
Work steps: [x] inspect pickers · [x] pseudocode · [x] implement · [x] build/test · [x] push · [~] live verify (bundle confirmed; interactive proof via main-session browser task) · [x] records

## Problem

Orbit's "Log a hangout" modal picks people with `PeoplePicker` chips of existing
people only. Someone new at an event cannot be logged. The Planner event form's
people search has the same gap (it even says typing a name never creates a link).

## Pseudocode

```
PeoplePicker (orbit/src/components/ui/PeoplePicker.jsx):
  always show the filter input (16px, placeholder "Filter people, or type a new name")
  name = trimmed filter text
  canAdd = name is not empty AND no existing person has that exact name
  if canAdd: render a dashed chip "+ Add new person: <name>" after the person chips
  on click:
    id = newId('p')
    savePerson(id, same document the Add people form saves:
                   { name, group 'friends', birthday '', how '', notes '',
                     facts [], intents [], createdAt now })
    on success: select id for this hangout, clear the filter
    on duplicate error: show "already in Orbit" inline, select nothing

EventForm people search (src/components/EventForm.jsx):
  when the search has no exact-name match, render "Add new person: <name>"
  on click: createPerson({ name, group 'friends' })   // peopleApi, Orbit's own API
            append the created person to the local list and to attendees, clear search
```

## Scope

- `orbit/src/components/ui/PeoplePicker.jsx` (covers Log a hangout, both entry modes)
- `orbit/src/globals.css` (filter input spacing/size, dashed add chip)
- `src/components/EventForm.jsx` (Planner attendee picker, same pattern)
- Checked, no change: GroupsView (opens LogModal with members prefilled, not a
  picker), tasks (no person attach exists), InterviewDrawer (AI-resolved people).

## Scenarios

- New name, no match: add chip appears, click creates + selects, hangout saves with them. (live-verified)
- Partial match only ("Sam" vs "Samir Rajani"): add chip still offered.
- Exact name already in Orbit: no add chip; the existing chip is the match.
- Duplicate rejected by the server: inline error, nothing selected, no crash.
- Empty Orbit: input + add chip are the way in; no dead-end hint.
- Cancel after creating: the person stays in Orbit (creation is its own save, same
  as the Add people form); the hangout is not saved.

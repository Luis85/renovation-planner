---
type: Task
parent: "[[Choose how to start a floor]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Continue contextual onboarding through the first room

## Evidence

The interaction specification's first-use sequence continues beyond the empty-floor choice:
place the first room, set its real dimensions, then name it. The same section explicitly rejects
a long tutorial in favor of contextual guidance that produces useful work.

## Why it matters

Ending guidance as soon as a start choice is made leaves an inexperienced renovator to discover
the first complete room workflow alone, while a blocking tutorial would delay or endanger valid
work already created.

## Approach

Project a short, non-blocking guidance step from the current Floor and first Room state: guide
placement, then dimension confirmation, then naming. Route each prompt to the existing canonical
action, allow dismissal at every stage, and retire the sequence once the first Room has completed
those milestones. Derive progress from persisted valid work so reopening resumes truthfully
without storing tutorial-only completion over the Room.

## Acceptance criteria

- Choosing the room-start path presents concise guidance for placing the first Room without
  blocking the canvas or other editor actions.
- After valid placement, guidance advances to confirming real dimensions through the canonical
  dimension action.
- After valid dimensions are confirmed, guidance encourages naming through the canonical Room
  naming action.
- Once the first Room is validly placed, dimensioned and named, the guidance retires and does not
  return for that completed state.
- Dismissing guidance never deletes, rolls back or invalidates persisted work.
- Valid Room work survives dismissal and editor close/reopen, and any resumed guidance reflects
  the persisted milestones rather than restarting blindly.
- Every prompted action and dismissal is keyboard operable with visible focus.
- Screen-reader users receive an equivalent ordered description of the current step, its action
  and the option to dismiss; no meaning depends on canvas visuals alone.
- The sequence never becomes a blocking modal tutorial and does not prevent unrelated valid
  editor work.

## Risks

Tutorial-only state can drift from canonical Room data, and automatic announcements can become
repetitive if ordinary edits repeatedly move the derived milestone backward and forward.

## Outcome

Contextual onboarding helps a renovator finish one useful Room, then gets out of the way without
owning or risking the work.

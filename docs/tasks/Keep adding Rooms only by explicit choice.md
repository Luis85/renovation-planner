---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 50
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Keep adding Rooms only by explicit choice

## Evidence

M03 defines `Keep adding rooms` as an off-by-default choice; normal completion returns to Select.

## Why it matters

Implicit repetition leaves the editor in a creation task when the homeowner expects the new Room to be selected.

## Approach

Add an opt-in repeat-Room setting to the active draft. On successful creation, either start one clean Room
draft or return to Select and select the result. Ensure cancel and refusal never trigger repetition.

## Acceptance criteria

- Repeat-Room mode is off by default and visibly opt-in.
- Default success returns to Select with the created Room selected.
- Opt-in success starts one empty next draft after the first commit completes.
- Cancel, refusal and failure return to a safe state without starting another draft.

## Risks

Starting the next draft before commit settles can duplicate activation or hide failure.

## Outcome

Room creation repeats only when the renovator deliberately asks it to.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **off by default and visibly opt-in** — is one `keepAdding` flag in
`room-draft-store.ts`, reset to false by `beginTask` (so entering the task never inherits it),
and one checkbox on the New room form. Held by `roomDraftStore.test.ts`'s 'beginTask resets
keepAdding and the name; clearRect keeps both; reset drops the name' and by
`newRoomInspector.test.ts`'s 'Keep adding rooms writes through to the draft'.

Criteria 2 and 3 — **default success returns to Select with the room selected; opt-in success
starts one empty next draft** — are the two arms of one branch in `createRoomFromDraft`, driven
both ways: `tests/presentation/editor/add/roomCreation.test.ts`'s 'a valid draft dispatches
exactly one command, selects the new id, and returns to Select' and 'keepAdding: the room is
selected, the draft restarts with the next default name, Select is not returned to'.

**Criterion 3's "after the first commit completes" is the half worth naming, because it is an
ORDERING and a test can pass without it.**
`tests/presentation/editor/roomCreation.e2e.test.ts`'s 'Keep adding rooms restarts the task on
the created room and re-counts the default name' asserts the next default name reads **Room 3**,
which is only true if the post-command refresh has already re-read the plan by the time
`beginTask(defaultName())` runs. A build that restarted the task before the write settled would
show Room 2 again and would pass every other assertion in that case.

Criterion 4 — **cancel, refusal and failure start no second draft** — is 'a refused write reports
once, keeps the draft, and stays in the task' (the draft is KEPT, so pressing Create again is the
recovery), 'a second call while the first is in flight is dropped', and the e2e Cancel and
detonated-save cases.

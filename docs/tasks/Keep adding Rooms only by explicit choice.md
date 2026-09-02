---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 50
status: New
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

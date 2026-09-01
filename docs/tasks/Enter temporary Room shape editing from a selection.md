---
type: Task
parent: "[[Edit a selected room shape and dimensions]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Enter temporary Room shape editing from a selection

## Evidence

M00 exposes boundary handles, editable dimensions and `Edit shape` from one selected Room.

## Why it matters

Editing must remain a bounded draft instead of writing on every pointer or field change.

## Approach

Connect canvas selection and the room list/form to one temporary Edit shape state. Load the same
Room draft, expose handles and exact fields, and define Finish, Cancel and focus restoration.

## Acceptance criteria

- Canvas, list and form routes enter one edit state for the same Room ID.
- The persisted Room remains unchanged until Finish.
- Cancel retires the draft and restores a meaningful selection and focus.

## Risks

Separate canvas and form drafts can diverge or dispatch twice.

## Outcome

A selected Room enters one cancellable shape-editing workflow from every supported route.

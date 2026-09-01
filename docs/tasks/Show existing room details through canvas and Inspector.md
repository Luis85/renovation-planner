---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Show existing room details through canvas and Inspector

## Evidence

M08 requires surface markers with equivalent Inspector rows, while the component library requires
every canvas marker to have a list equivalent. The implementation plan places this read path in
Phase 7.

## Why it matters

A spatial marker without the same canonical row is inaccessible and risks becoming a second
identity for one room detail.

## Approach

Deliver one read-only vertical path from selected room identity through the existing-state query to
the Inspector/list and its canvas projection. Preserve unreadable counts and capability
availability.

## Acceptance criteria

- Canvas, Inspector and list resolve the same room and detail IDs.
- Selecting either projection focuses the other.
- Empty, unavailable and unreadable results are distinct.
- The workflow is keyboard-usable without the canvas marker.

## Risks

A presentation adapter may accidentally copy geometry or flatten a read refusal into an empty
list.

## Outcome

A selected room truthfully shows what is known to exist through synchronized spatial and
non-spatial routes.

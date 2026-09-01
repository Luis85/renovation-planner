---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Verify Wall cancellation, reload and non-canvas precision

## Evidence

M04 requires keyboard numeric length, Finish/Cancel, reference tracing and theme-safe feedback;
Feature B requires reload and reversibility.

## Why it matters

Canvas-only happy paths conceal drafts written too early and Wall data that cannot be recovered or inspected.

## Approach

Build an end-to-end Wall journey over a dimmed reference, including undo-point, Escape, valid
finish, optional Room, undo/redo, reload and failed writes. Provide a Wall list and exact-length
form path. Run accessibility and theme checks plus a live-vault trace.

## Acceptance criteria

- Escape discards the whole uncommitted chain.
- Finished Walls and optional Room survive reload and reverse once.
- Exact dimensions are operable outside pointer placement.
- Wall records are reachable from a non-canvas list.
- Failure leaves no partial chain.

## Risks

Reference rendering and Wall persistence can fail independently; tests must distinguish them.

## Outcome

Connected Wall creation is accessible, recoverable and trustworthy beyond the canvas.

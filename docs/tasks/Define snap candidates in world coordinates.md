---
type: Task
parent: "[[Grid and snapping]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Define snap candidates in world coordinates

## Evidence

The existing requirement and editor specification require stored geometry to be zoom-independent
while acquisition tolerance remains understandable on screen.

## Why it matters

Screen-space geometry makes accuracy depend on the zoom level used during creation.

## Approach

Define candidate kinds, deterministic priority and screen-to-world tolerance conversion in the
existing snap service. Let each Room/Wall/Opening caller supply eligible targets. Add pure tests
for grid, endpoints, corners, alignments, ties and extreme camera transforms.

## Acceptance criteria

- Snapped world results are invariant across equivalent zoom/pan views.
- Candidate priority is deterministic and documented by tests.
- Unsupported candidate kinds are declined rather than guessed.

## Risks

Centralizing caller-specific eligibility would turn the snap service into a domain registry.

## Outcome

Spatial tools share one predictable, zoom-safe snapping calculation.

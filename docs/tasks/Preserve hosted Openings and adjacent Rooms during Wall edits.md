---
type: Task
parent: "[[Edit a selected wall precisely]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Preserve hosted Openings and adjacent Rooms during Wall edits

## Evidence

M07 identifies hosted Openings and adjacent Rooms as required Wall context, and the prerequisite owns
their topology and persistence invariants.

## Why it matters

A geometrically valid Wall edit can still orphan an Opening or invalidate a Room boundary.

## Approach

Evaluate the complete draft against prerequisite relationships, include supported dependent changes in
the preview, and require explicit resolution where preservation is impossible. Refuse unsupported outcomes.

## Acceptance criteria

- Hosted Openings remain valid on their Wall or require an explicit supported resolution.
- Adjacent Rooms remain coherent and reloadable.
- Unsupported dependent changes refuse the Wall edit without writes.
- Concurrent relationship changes invalidate the prepared edit.

## Risks

Reimplementing topology in the editor would diverge from prerequisite commands.

## Outcome

Precise Wall editing never silently damages the spatial relationships around the Wall.

---
type: Task
parent: "[[Add and safely edit a wall opening]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Edit hosted Openings without orphaning them

## Evidence

M07 requires exact edits, impact preview and deletion behavior that cannot silently orphan hosted
Openings.

## Why it matters

Moving/resizing an Opening or changing its Wall can break the host relationship after valid creation.

## Approach

Route drag and Inspector dimensions through prerequisite Opening edit commands. Preview host bounds,
query Wall-edit impacts and require a valid resulting relationship before commit. Capture one inverse
per user edit and propagate revision failures.

## Acceptance criteria

- Move and resize preserve a valid host relationship.
- Pointer and numeric edits share one command boundary.
- A Wall edit cannot silently orphan an Opening.
- Each completed edit undoes/redoes once.

## Risks

Host-relative and world coordinates can drift; define one conversion boundary and round-trip it.

## Outcome

Openings remain structurally attached while homeowners adjust their placement and size.

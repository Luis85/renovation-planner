---
type: Task
parent: "[[Add and safely edit a wall opening]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Verify Opening reversibility, reload and non-canvas paths

## Evidence

Feature-B acceptance requires completed edits to reverse and reload; the editor design requires
every essential entity/action outside the canvas.

## Why it matters

Hosted relationships are easy to display correctly while persisting or restoring the wrong Wall ID.

## Approach

Create fixture-vault journeys for create, move, resize, Wall impact, undo, redo, reload, missing
host and failed writes. Add a Wall/Opening list and Inspector form journey, accessibility scan,
theme captures and live-vault selection check.

## Acceptance criteria

- Reload restores the same Opening and host IDs.
- Undo/redo preserve relationship integrity.
- Missing host and failed writes never yield a free-floating Opening.
- Creation and editing are reachable through labeled non-canvas controls.

## Risks

In-memory fakes can conceal relationship serialization errors; assert vault bytes and mapped reads.

## Outcome

Hosted Openings remain recoverable, reversible and accessible after every supported edit.

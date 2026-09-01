---
type: Task
parent: "[[Walls and hosted openings]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Host and restore an opening on its wall]]"
---

# Keep wall and opening references safe through change

## Evidence

M07 requires exact wall edits and deletion impact to preserve or explicitly resolve hosted
openings; the [[Zones and spatial objects]] Feature already refuses dangling references.

## Why it matters

A wall edit that silently detaches a door or window makes the saved plan plausible but false.

## Approach

Route wall geometry changes and deletion through the reference-integrity boundary, compute hosted
opening impact before writing, and make each accepted resolution reversible and recoverable.

## Acceptance criteria

- A valid wall change preserves hosted-opening identity and placement.
- An invalidating change is refused or requires an explicit defined resolution.
- Wall deletion cannot leave a dangling hosted opening.
- Undo and reload restore one coherent wall/opening state.

## Risks

Implicitly moving openings may hide a material design change; commands must expose impact rather
than guessing the renovator's intent.

## Outcome

Not started.

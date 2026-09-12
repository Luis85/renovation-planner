---
adr: 31
title: Construction materials, plan-origin requirements and plan patterns
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0031: Construction materials, plan-origin requirements and plan patterns

## Decision

- A wall's or opening's Existing and Planned facts carry an optional catalogue `assetId`: one core
  material for a wall, one product for a door or window. `unchanged` keeps the existing material;
  `remove` carries none. Only a material a write introduces must exist; a note naming a deleted
  asset reads and stays editable. Written at plan schema 11.
- An asset has an optional `planPattern` from a fixed list drawn in theme colours (the Asset
  library's Inspector field — [design amendment 5](../../user-experience/archive/asset-library-overview-DESIGN-SPEC.md)).
  It is an additive `.catch(null)` key with no schema bump — the `height` trade: an older build
  that saves the asset drops it. The Plan Editor fills the wall body polygon with the pattern
  (Konva `fillPatternImage`, scaled by 1/zoom) rather than stroking its centre-line: Konva offers
  no stroke pattern, and a fill scales with `fillPatternScale` without a custom `sceneFunc`. The
  per-wall mitre gap is unchanged.
- A subject whose planned material is new, or differs from its existing one, owns ONE construction
  Requirement (`source.construction: true`, `outcomeId` = the subject, `state: intended`), measured
  by the asset's unit: wall `m2` → `wall-net`, `m` → `wall-length`, `m3` → `wall-volume`; opening
  `piece` → `count`, `m2` → `opening-area`; any other unit produces none.
- `ConstructionMaterialCommand` saves the subject and its entry as one history entry: entry
  deletions, then the renovation write, then entry saves, each from a fresh read — the plan note's
  version check is preserved and only the geometry sidecar is rebased between steps. Any refusal
  after a step has moved puts back the moved steps newest-first through each step's own
  version-checked undo; only a failed put-back retires the command and marks the write
  uncompensated. Clearing a material whose entry a cost or order still uses is refused, naming the
  costs or orders (`renovation.construction-referenced`, `{names}`).
- `RequirementOrigin` gains `{ kind: 'plan', planId }` for a material with no room; its source names
  the target. Requirement schema 5 holds the plan origin, `wall-volume` and the marker.
- Deleting an asset a plan subject names is refused, naming the plans (`asset.material-in-use`,
  `{names}`); the resolution options do not cover it.

## Alternatives

- **Computed until touched (M2).** Budget, procurement and quotes read saved requirements and would undercount.
- **Layered build-ups; frame and glazing fields; custom colours; material on the sidecar wall.** More UI, theme clashes, and ADR-0021 gives the sidecar coordinates only.

## Amends

ADR-0020's deferral of "wall construction text"; ADR-0022's room-only requirement origin;
*Edit a selected wall precisely*'s out-of-scope construction line.

---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 60
status: New
horizon: "V1"
release: ""
---

# Navigate between a material need and its spatial source

## Evidence

M12 links each material row to a room surface or work marker, while [[Requirement]] records the
canonical origin that explains why the material is needed.

## Why it matters

A quantity without a navigable source is hard to verify, and a marker without an equivalent row is
unavailable to users who cannot operate the canvas.

## Approach

Use stable Requirement and origin identities to unify selection across material need, Inspector
row, optional marker and source geometry or work. Provide row-to-source and source-to-row reveal
paths without treating display numbers as identity.

## Acceptance criteria

1. Selecting a material row reveals its authoritative spatial or work source.
2. Selecting a material marker focuses the matching row and need.
3. Selecting supported source geometry exposes its linked material needs.
4. Every navigation has a list or Inspector path that does not require canvas pointing.
5. Missing or unreadable sources remain explicit unresolved relationships.

## Risks

- Marker numbering could be mistaken for persistent identity.
- Focus synchronization could discard a useful multi-selection or move the viewport unexpectedly.

## Outcome

A renovator can move reliably between a material need, its accessible row, marker and canonical
spatial source.

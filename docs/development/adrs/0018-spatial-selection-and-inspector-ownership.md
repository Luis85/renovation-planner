---
adr: 18
title: Spatial selection and Inspector ownership
status: Accepted
date: 2026-09-05
area: presentation
---

# ADR-0018: Spatial selection and Inspector ownership

## Context

Editor implementation phases 0–2 require typed selection and one Inspector route. The existing
editor stores Zone IDs, already shared by the canvas and list. Introducing another store of
Room/Area objects would make hydration, deletion and narrow-layout changes reconcile two sources.

## Decision

- `useSelectionStore` owns an ordered, unique set of stable IDs and one focused member ID per
  leaf. Membership and focus are distinct. Focus never adds, removes or reorders a member.
- `selectSpatial` owns replace/toggle semantics for canvas and accessible list inputs.
- `spatialSelection` derives the supported Room/Area types from hydrated records (ADR-0016),
  preserving selection order. No display kind or selection is persisted to Markdown.
- `resolveSelectionTarget` owns hover and click resolution. A single selected room exposes
  handles. Multiple rooms expose numbered focus badges, without geometry-edit handles.
  Body candidates retain their render order; Alt cycles that order and bypasses badges/handles.
- `EntityInspector` owns the route: active room draft, floor, multiple selection, or one room.
  `MultiSelectionInspector` shows individual-area sums and explicit mixed types. The area sum
  counts overlap separately; it is not a polygon union, floor footprint or cost estimate.
- `ResponsiveEditorShell` owns placement only. It may remount panels without replacing the
  per-leaf stores. `runtime` owns command decoration and projection refresh; components do not
  call repositories or retain versions for writes.
- The future perspective state belongs to the leaf's presentation state and changes through
  one runtime action that cancels temporary tools and preserves compatible selection/viewport.
  Only Plan currently has content. A switch is introduced with the first functioning Renovate
  route; this decision creates no inactive tabs or second navigation history.

## Alternatives

Storing `{ id, kind, entity }` as the selection would duplicate the hydrated model. Putting the
route in individual inspectors would duplicate task precedence. Using single-selection list
actions for M11 focus would silently collapse the user's batch scope. All three are rejected.

## Enforcement and limits

- `selectionStore.test.ts` and `spatialSelection.test.ts`: identity stability, uniqueness,
  order, focus retirement, toggle, overlap cycling, and selection without a write.
- `multiSelectionInspector.test.ts`: real list/canvas/Inspector agreement and resize retention.
- `editorContext.test.ts`: the tool facade exposes only declared selection members, no Konva.
- Build/lint: typed query/command seams, layer imports, and infrastructure-only vault writes.
- The first Wall/Opening/Object slice must extend candidate geometry and test the reserved
  object → opening → wall → room priority. These types are not fabricated in today's read model.
- Perspective transition behavior remains a future implementation obligation, not an executed
  test result. Batch renovation commands remain unavailable until their domains exist.

## Compatibility

No frontmatter field, schema version, migration, Zone ID or geometry sidecar changes. Existing
vault content and undo behavior retain their current persistence boundaries.

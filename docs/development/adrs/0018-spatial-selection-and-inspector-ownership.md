---
adr: 18
title: Spatial selection and Inspector ownership
status: Accepted
date: 2026-09-05
area: presentation
---

# ADR-0018: Spatial selection and Inspector ownership

Phase 5 extension (2026-09-06, ADR-0020): the same ordered ID store and typed projection now
include Wall and Opening records. Body priority is Opening, Wall, then Room/Area, preserving
paint order within a kind; Alt-click cycles the same candidates. The persistent structure list
and Inspector share those IDs. Shared hover/multi-selection overlays include the new types;
only a single wall's end supports direct junction movement. Root-owned measurement forms keep
their draft and focus through reflow and dispatch the same reversible geometry command as the
pointer edit. Multi-selection remains a read-only summary; no batch renovation action is implied.

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
- `PlanEditorRoot` handles unconsumed Escape events from list, Inspector, task buttons and
  rail controls through `routeEscape`. Add, overlays and canvas consume their own key first;
  repeat events do not clear selection after an overlay restores focus to its rail. Clearing
  preserves persistent control focus and returns disappearing Inspector controls to the Inspector.
  Native text/number fields, textareas, selects and editable content own their editing keys.
  Checkboxes and buttons bubble Escape; a temporary task is cancelled even with no selection,
  and idle single selections clear through the same route as multiple selections.
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
- The typed slice supplies Object, Opening, Wall and Room/Area candidates. The user reconfirmed
  handle → Object → Opening → Wall → Room for this release on 2026-09-08 after the earlier
  Opening-first closeout amendment. `selection/resolveSelectionTarget.test.ts` pins Object
  footprints across paint orders; `structureSelection.test.ts` preserves linear-element ranks,
  hover/click agreement and mixed-kind body/badge focus without collapsing membership.
- Perspective transition behavior remains a future implementation obligation, not an executed
  test result. Batch renovation commands remain unavailable until their domains exist.

## Compatibility

No frontmatter field, schema version, migration, Zone ID or geometry sidecar changes. Existing
vault content and undo behavior retain their current persistence boundaries.


## Area numeric task extension — 2026-09-05

Area coordinate input belongs to the temporary task banner, not the selected entity Inspector.
Its per-leaf raw text state has no geometry or persistence authority. Applying or removing a
corner delegates through `ToolManager.editActiveCorner` to `DrawPolygonTool`'s existing buffer;
`RenderState.polygonSketch` remains the canvas projection. The task's shared completion gate
checks outline validity, pending form input, stale state and saving before any completion door
can dispatch. ADR-0016's Room/Area mapping and the Zone command/sidecar contracts are unchanged.
Native fields retain Escape; the existing root route still owns Escape from task buttons.


## Existing-room dimension form extension — 2026-09-06

The single Room Inspector owns the entry, and `roomResizeAction` in the per-leaf runtime owns
versioned baseline acquisition. `RoomDimensionsForm` owns only local text/validation and uses
`FormDialog` for inert siblings, focus trapping, busy cancellation and opener restoration.
Responsive panel remounts cannot replace the form because `DialogHost` belongs to the root.
The existing InteractionLayer draws its temporary preview; the project projection is unchanged
until the ordinary dispatcher refreshes after Apply. Inspector `geometry` edits use the same
`ReversibleMoveZoneCommand` / `MoveSpatialObjectCommand` as canvas edits, adding the captured
baseline expectation to the first dispatch. No component reads a repository or persists geometry.

Only four-corner axis-aligned Room rectangles are supported. The world-min corner, vertex order
and winding remain fixed; widths/depths mean x/y extents. Other outlines are explicitly unavailable
for this form, never reduced to bounds. See M03's bounded precision contract and its test case.
The form is an explicit modal task: Cancel/Escape discard, while saving refuses cancellation;
selection/creation controls behind it are inert. This does not resolve SDD §101's wider Inspector
field-commit policy, nor promise recovery after forced leaf/process termination.

## Existing-room naming extension — 2026-09-06

The Room Inspector's Rename room action opens the root-owned modal through `roomNamingAction`.
Naming and dimensions share `createRoomEditAction` for baseline acquisition, retirement, busy gating
and conflict refresh. It captures one `GetZone` baseline/version; `RoomNameForm` holds local text only. Explicit Apply
uses the same Inspector dispatch/history/refresh boundaries as dimension edits, with
`RenameZoneCommand` and the shared Zone repository; Cancel/Escape discard under the existing modal
contract. Inert background controls prevent changing selection or creation task mid-form. Responsive
placement changes preserve the form and restore the replacement action/Details focus on closing.

All Room geometries qualify. The dimension form's geometry eligibility remains specific to size
changes. `ZoneRenamed` joins the existing plan-change event source for peer-leaf projections;
renaming does not pretend geometry changed. Names are non-empty after the existing trim rule;
duplicates remain valid because identity and references use IDs. No filenames, links, schema keys
or geometry are renamed/redefined. M03 records the exact draft/conflict/persistence contract.
This bounded modal task does not settle SDD §101's wider field-commit policy.


## Area details and numeric outline extension — 2026-09-07

The same root-owned modal lifecycle now serves Area metadata and explicit corner coordinates. `editorFormActions` composes the existing Room name/dimension/reference actions with these new actions; it does not introduce another runtime or dialog owner. `AreaDetailsForm` captures one Zone version and applies name/type together through `EditZoneDetailsCommand`. `ZoneDetailsChanged` refreshes peer projections without pretending the geometry changed. Room/Area identity cannot be exchanged through metadata editing, preserving Room-owned renovation records and boundaries.

`OutlinePointsForm` edits any existing Room/Area outline through the original `MoveSpatialObject` history path. Only axes explicitly edited are parsed and rounded; untouched coordinates retain their stored precision. Valid form drafts update transient preview geometry, and disposal clears it. Apply remains conditioned on the captured baseline and shared session ledger. Existing walls remain independently owned; this form does not infer wall or boundary rewrites. Focus/reflow and history are covered by the focused finalization cases; integrated and live-host acceptance remain pending.

**Amended 2026-09-12:** the Room/Area use of `OutlinePointsForm` is withdrawn, with its Inspector action, canvas `Edit shape` button and zone context-menu `Edit`. A zone's outline is edited only by dragging its canvas vertices; the form now serves linear and object elements alone. Later the same day the canvas `Edit length`/`Edit shape` button was withdrawn for walls, openings and elements too: the context menu's `Edit` is their one direct route, beside the Inspector and a wall's length label.

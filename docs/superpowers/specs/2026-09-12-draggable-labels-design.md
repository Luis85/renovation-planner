# Draggable labels on the plan canvas

**Date:** 2026-09-12
**Baseline:** `main` at `210be3f4`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-12. The
implementation plan derived from it is `docs/superpowers/plans/2026-09-12-draggable-labels.md`.
Where this document and the SDD disagree, the SDD is the authority.

## 1. What this delivers

A renovator drags the label of a room, an area, an element or a placed asset to a better place
on the plan, and it stays there: after a reload, and when the item it names is moved, nudged or
rotated.

Today every canvas label is placed automatically and none can be moved:

| Label | Where it is drawn today |
| --- | --- |
| Room/area caption (name + area) | `labelAnchor` inside the polygon, displaced away from pins by `captionOffsetY` (`ZoneShape.vue`) |
| Element label (object, path, fence, measurement, stair, arrow) | 18 screen px above the element's first point (`ElementShapes.vue`) |
| Asset label | 18 screen px above the footprint's top edge (`assetShapeConfig.ts`) |

All three are `listening: false` and have no stored position.

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| Which labels | **All three**: rooms/areas, elements, assets. |
| When a press grabs a label | **Only while its item is selected.** An unselected room dragged from its middle still moves the room. |
| What is stored | **An offset from the automatic position**, in world millimetres, so the label follows its item. |
| Where it is stored | **The plan geometry sidecar** (ADR-0002); no Markdown note changes. |
| Is it saved | **Yes**, undoable, one history entry per drag. |
| A way back to automatic | **Not in this increment.** Undo covers an accidental drag. |

## 3. Data and persistence

### 3.1 Domain

- `Zone` gains `labelOffset: Vector | null` (absent/`null` = automatic) and
  `withLabelOffset(offset: Vector | null): Zone` — `null` restores the automatic position, which
  is what lets undo of a first drag put a caption back where it started; no UI action clears an
  offset directly. `withGeometry`, `withDetails`, `withName` and `withLocked` carry it through
  `fields()` unchanged, which is what makes a moved, nudged or rotated zone keep its label
  placement with no extra code.
- `SpatialElement` gains `labelOffset?: Vector`. It covers asset placements, which are elements
  of kind `'asset'`.
- Nothing validates the offset's magnitude beyond finiteness: a label may be dragged anywhere.

### 3.2 Sidecar schema v10

`src/infrastructure/persistence/dto/planGeometry.ts`:

- `SpatialObjectGeometrySchemaV10 = SpatialObjectGeometrySchemaV7` + `labelOffset: { dx, dy }`
  optional, both `z.number()` — zod 4's `z.number()` already refuses a non-finite value, so no
  `.finite()` is needed.
- `SpatialElementSchemaV10 = SpatialElementSchemaV9` + the same optional `labelOffset`, used by
  both `structure.elements` and `intended.elements` (one structure schema, as today). The key is
  the domain's own name because elements pass through the sidecar port unmapped.
- `PlanGeometrySchemaV10`, added to the union; `PlanGeometryDTO`'s version union gains `10`;
  `PlanGeometryStore` validates against v10.
- `PLAN_GEOMETRY_MIGRATIONS` gains 9 → 10, a version bump only, like every step before it.
- `PlanGeometryStore.writtenSchema` declares the LOWEST version a document's content needs, so a
  plan nobody has dragged a label on stays readable by an older build. It gains a first arm:
  `10` when any `objects` entry or any `structure`/`intended` element carries `labelOffset`. A test
  pins both directions — a labelled document writes 10, an unlabelled one keeps its current
  answer.

A Zod object strips unknown keys, so the field has to be declared, not merely written (the
schema file's own header says so).

### 3.3 Mapping

- `zoneToGeometryEntry` writes `labelOffset` when `zone.labelOffset` is set; `zoneFromPersistence`
  reads it back; the `ObsidianZoneRepository.save` pre-validation parses against the v10 entry
  schema.
- `ObsidianPlanGeometrySidecar` passes `labelOffset` through `toStructure` (it already spreads
  each element) and through the `objects` mapping in both directions, where it must be added
  explicitly.
- `ZoneDto` gains `labelOffset?: Vector`; elements already reach `ProjectStore.structure` in
  their domain shape.

## 4. Grabbing and dragging

### 4.1 Placement functions

Rooms are placed by `roomCaptionAnchor` and their block height by `captionBottom`
(`layers/zone/captionPlacement.ts`), and grabbed by `roomCaptionBounds`; a room caption's block is
taller while a detail-plans line shows (`captionBottom`, ADR-0028). Elements and assets are placed
by `elementCaptionLayout` and grabbed by `textLabelBounds` (`labels/labelLayout.ts`), text width
from `measureLabelWidth`. `ZoneShape`, `ElementShapes`, `assetShapeConfig` and `labelActions` all
call the same functions, so what is drawn and what can be grabbed cannot disagree — the same
relationship `handleMetrics.ts` keeps for vertex handles.

### 4.2 Hit-testing

- `SelectionTarget` gains `{ kind: 'label'; id }`.
- `SelectTool` gains a `labelHits` dependency (the `rotationControls` precedent), answered by
  `labelActions` from the same placement functions the renderers call.
- `resolveSelectionTarget` answers `'label'` after the rotation handle, vertex handles and
  badges, and before bodies — an element's name tag sits just above its first point, where its
  handle is grabbed — for any SELECTED candidate whose label bounds, padded by a few screen
  pixels converted through the camera, contain the point. With several items selected, each
  selected item's label is grabbable.
- It answers no label when `cycle` (Alt) is set, and `SelectTool` passes an empty selection when
  Shift or select-multiple mode is on (as it already does for handles), so neither can grab a
  label.

### 4.3 Gesture

A `LabelMove` class beside `ElementMove`, owned by `SelectTool`:

- **Start** only when writes are not blocked and the perspective is `plan`. Records the id, the
  original offset and the start point.
- **Move** sets `renderState.labelPreview = { id, offset }`. No snapping: a label is an
  annotation, and wall guides would fight fine placement.
- **Finish** below `CLICK_EPSILON_PX` is a no-op that keeps the selection. Above it, the preview
  stays at the drop and one write is dispatched; the preview is cleared once the write has been
  read back, as element moves do.
- **Cancel** (Escape, tool switch, `abandonGesture`) clears the preview. `hasDraft()` includes it.
- **Hover** over a grabbable label sets `hoveredTargetKind = 'label'`; `cursor.ts` maps it to the
  grab cursor alongside `'handle'` and `'rotation'`.

## 5. Drawing, saving and undo

### 5.1 Drawing

- `ZoneShape`: the caption anchor is `labelAnchor + offset`, with `renderState.labelPreview`
  overriding the offset for its id. When an offset is set, `captionOffsetY`'s pin displacement is
  skipped: a placement the renovator chose wins. Name and area move together.
- `ElementShapes` and `assetShapeConfig`: today's position plus the offset (or preview).
- A room caption's block is taller while a detail-plans line shows (`captionBottom`, ADR-0028).

### 5.2 Saving

Label drags reuse the two source-specific write paths rotation already uses, through
`RotationBaseline`'s `labelCommand(offset)` (`rotationBaseline.ts`), used by
`labels/labelActions.ts`:

- **Rooms/areas.** `MoveSpatialObjectInput` gains `labelOffset?: Vector | null` (absent keeps the
  zone's current offset, `null` restores the automatic position). `MoveSpatialObjectCommand`
  applies it with `withLabelOffset` after the geometry. `ReversibleMoveZoneCommand`'s forward and
  inverse states each carry an optional `labelOffset: Vector | null` alongside the geometry,
  rather than a separate offset parameter; a label drag hands it identical forward and inverse
  geometry, differing only in `labelOffset`. The ledger, the conditional write and the
  `zoneGeometryChanged` refresh are unchanged.
- **Elements/assets.** `service.command(baseline, elementInput(baseline, { ...element, labelOffset }), ledger)`,
  the two-document command moves and rotations already use.
- **Every rewrite of the geometry carries it**: a calibration rescales offsets; the group-move
  projection and its zone versions carry them; the zone version digest observes them.

`MoveSpatialObjectInput` and `ReversibleMoveZoneCommand` are shared contracts: every caller's
test directory runs, not only the new paths (nudge, select-tool body/vertex drags, rotation).

### 5.3 Stale guard

Before dispatching, the baseline is re-read and compared against what the canvas shows, exactly
as `readZoneBaseline`/`readElementBaseline` do; a mismatch is the usual stale-write refusal and
nothing is written.

### 5.4 Undo

One drag, one history entry; undo restores the previous offset. A later move of the same item
supersedes it by the existing ledger rule.

### 5.5 ADR

ADR-0029, "A label position is sidecar geometry, stored as an offset", records §2's storage rows
and the rejected alternatives: an absolute position (would be left behind by every move, nudge
and rotate command), session-only state (lost on reload), and frontmatter on the zone note
(elements have no note, and a caption position is geometry).

## 6. Testing

Every test is watched failing before its code exists.

| Area | Case |
| --- | --- |
| Schema | v10 accepts `labelOffset` on objects and elements; rejects a non-finite component; 9 → 10 migrates; `writtenSchema` answers 10 only when a `labelOffset` is present. |
| Mapping | `zoneMapper` round-trips `labelOffset`; an element's offset survives the sidecar port. |
| Domain | `withLabelOffset` sets it; `withGeometry` keeps it. |
| Hit-testing | `'label'` only for selected candidates; outranks bodies but not vertex handles or badges; none under Alt, Shift or select-multiple mode. |
| Gesture | sub-threshold release dispatches nothing; cancel clears the preview; no gesture while writes are blocked. |
| Commands | `ReversibleMoveZoneCommand` label undo restores the offset with geometry unchanged; element label drag round-trips through `elementInput`. |
| Drawing | `ZoneShape` draws at anchor + offset and skips pin displacement; element and asset labels shift by the offset. |
| Consistency | `labelActions`'s hit bounds equal what `ZoneShape`, `ElementShapes` and `assetShapeConfig` draw at (`roomCaptionBounds`/`textLabelBounds`). |

Outside the gates: the manual case `docs/tests/cases/Drag a caption.md`. No fixed harness
capture: the harness Plan Editor floor has no renovation services, so a drag cannot save there.

## 7. Out of scope

- A "reset label position" action (undo covers an accidental drag).
- Moving a label by keyboard (nudging moves the item, and the label follows).
- Dragging labels in the renovation perspective.
- Separating a room's name from its area.

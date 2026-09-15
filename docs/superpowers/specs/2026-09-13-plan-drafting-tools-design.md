# Drafting tools on the plan (dimension chains, section and view markers, hatching, text, boundary and grid)

**Date:** 2026-09-13
**Baseline:** `main` at `50696459`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-13. No
implementation plan exists yet. Where this document and the SDD disagree, the SDD is the authority
(§17 architecture layer, §40 geometry sidecar).

## 1. What this delivers

A renovator can draw a plan that reads like an architect's floor plan (Bauantragsplan): besides the
rooms, walls, doors and windows the editor already draws, the **drafting marks** around them —

- **dimension chains** (Maßketten): several ticks along one line, a length over every segment;
- **section lines** (S-01): a dash-dot cut line with filled triangles on its look side;
- **view markers** (A-01): a hollow triangle pointing the way an elevation looks;
- **hatched areas**: a cross-hatched polygon with no room meaning;
- **text** placed anywhere;
- **boundary lines**: a long-dash property or plot line;
- **grid points**: a circle with a letter or number (Achspunkt).

All seven are reached from one new **Drafting** submenu in the canvas right-click menu.

What exists today:

| Fact | Where |
| --- | --- |
| Point-based floor elements are one union; a new kind plugs in there | `SpatialElementKind`, `validSpatialElement` in `src/domain/spatial/SpatialElement.ts` |
| Geometry sidecar is at schema version 11; elements are a `z.enum` of kinds with per-kind `refine`s | `src/infrastructure/persistence/dto/planGeometry.ts`, `writtenSchema` in `PlanGeometryStore.ts` |
| Element drawing is one tool class keyed by tool id, registered by one loop | `ElementTool.ts`, `ELEMENT_TOOLS` in `elements/elementDraft.ts`, `elementTask.ts` |
| A new draft's name is prefilled with its kind's label | `start` in `elements/elementBaseline.ts` |
| The canvas right-click menu is a Vue menu with one level of submenu, already used by Add | `CanvasMenuSubmenu`, `addSubmenu` in `selection/useCanvasMenuActions.ts`; `CanvasMenuList.vue`, `submenuPlacement.ts`, `menuKeyboard.ts` |
| A tool can already be started at the right-click point | `elementTask.measureFrom` |
| Every element is a renovation target and a requirement quantity source | `renovationTargets.ts:14`; `elementMeasurement` in `domain/requirement/RequirementSource.ts` |
| A cross-hatch tile already exists | `patternTile('stone', …)` in `structure/patternTile.ts` |
| Room corners, wall ends, opening jambs and element vertices are snap candidates | `snapping/roomSnapCandidates.ts` |
| Posts and beams draw above the wall paint, every other element below it | `isStructuralKind` in `structure/StructureLayer.vue` |
| Nothing draws a dimension chain, section line, view marker, hatch, free text, boundary line or grid point | — |

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| Which marks | **All seven** above, in one increment. |
| Model | **Seven new `SpatialElementKind`s** in the existing element pipeline. A separate `Plan.annotations` list was refused (a parallel path through move, clipboard, groups, removal, undo and snapping — the reason posts and beams refused one). A freeform stroke overlay was refused (nothing to select, edit or measure). |
| Dimension chains and moved walls | **Static, snapped.** Points are clicked with snapping and stored; segment lengths are derived from the stored points, so they stay truthful, but a chain does not follow a wall moved later. Associativity is out of scope (§9). |
| What a hatch means | **Visual only.** No cost, quantity or renovation-state meaning; always cross-hatch. |
| What section and view markers link to | **Nothing.** A label and a look direction. |
| Where the tools are offered | **A Drafting submenu on every canvas right-click outside Review.** Not in the Add palette. |

## 3. Domain model

`src/domain/spatial/SpatialElement.ts`:

```ts
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset' | 'post' | 'beam'
	| 'dimension' | 'section' | 'view' | 'hatch' | 'text' | 'boundary' | 'grid';
export interface SpatialElement {
	// … existing members
	/** A dimension chain's signed distance from its baseline to its dimension line, world mm. Only a `'dimension'` carries one, and it always does. */
	readonly offset?: number;
	/** Which side a section line looks at. Only a `'section'` carries one, and it always does. */
	readonly flipped?: boolean;
}
/** Drafting marks: drawn on the plan, never renovation targets or quantity sources. */
export function draftingKind(kind: string | undefined): boolean;
```

| Kind | `points` | Extra field | The name is… |
| --- | --- | --- | --- |
| `dimension` | ≥ 2, the chain's tick points, consecutive points distinct | `offset`, finite, `abs ≤ 1e6` | not drawn; the segment lengths are |
| `section` | exactly 2 distinct, the cut line's ends | `flipped` | drawn at both ends (`S-01`) |
| `view` | exactly 2 distinct: anchor, facing point (as an asset) | — | drawn beside the triangle (`A-01`) |
| `hatch` | ≥ 3, a closed outline (`outlineKind` answers `true`) | — | not drawn |
| `text` | exactly 1 | — | the text itself |
| `boundary` | ≥ 2, an open polyline, consecutive points distinct | — | not drawn |
| `grid` | exactly 1 | — | drawn inside the circle |

- **`validSpatialElement`** adds a one-point rule for `text` and `grid` (every other kind keeps
  `≥ 2`), `offset` present exactly on `dimension`, `flipped` present exactly on `section`, and
  exactly two points for `section` and `view`. `hatch` joins `outlineKind`, so
  `acceptsElementPoints` refuses a self-crossing hatch through `areaOutline` as it does for
  `object` and `post`.
- **`dimensionSegments(element)`**, new and pure, in `src/domain/spatial/dimensionChain.ts`:
  projects every point onto the first→last direction and answers the ordered projected positions
  and the segment lengths between them. A segment whose two points project onto each other has
  length 0. This is the only place a chain's lengths come from; nothing stores one.
- **Calibration** scaling (`structureGeometry.ts`) scales `offset` by the factor, beside `width`
  and `labelOffset`.
- **Exclusions.** `renovationTargets` skips drafting kinds, so they carry no existing or planned
  facts and the Add submenu offers them no Work, Note or Photo record. `elementMeasurement`
  answers `null` for a drafting kind, so no requirement can take a quantity from one. Move,
  clipboard, groups, removal and undo are unchanged and apply to them as to every element.
- Defaults live in the presentation draft, not the domain: `offset` 0 until phase 2 sets it
  (§5), `flipped: false`.

## 4. Persistence

`src/infrastructure/persistence/dto/planGeometry.ts`, following the v10 → v11 precedent:

- `SpatialElementShapeV12` extends the v11 element shape: the `kind` enum gains the seven kinds;
  `offset: z.number().finite().min(-1e6).max(1e6).optional()`; `flipped: z.boolean().optional()`.
- A `draftingRule` refine mirrors §3 (`dimension` ⇔ `offset` present; `section` ⇔ `flipped`
  present).
- `PlanGeometrySchemaV12` (`schemaVersion: z.literal(12)`), added to the `PlanGeometrySchema`
  union and to `PlanGeometryDTO`'s version union.
- `writtenSchema` answers 12 when any drafting kind is present in `structure` or `intended`, so a
  sidecar without one keeps its lower version and an older build refuses one with drafting marks
  rather than dropping them.
- The migration v11 → v12 changes only `schemaVersion`: no v11 element can be a drafting kind.

Names stay in plan frontmatter `spatial-elements`, unchanged.

## 5. Tools and interaction

`ToolId` and `ELEMENT_TOOLS` gain seven ids; the existing loop in `elementTask.ts` registers each
as an `ElementTool`. No new tool class.

| Tool id | Kind | Gesture | Saves |
| --- | --- | --- | --- |
| `draw-dimension` | `dimension` | Click the chain points; **Finish** (Enter, banner, form) enters **phase 2**, where the pointer's perpendicular distance from the baseline sets `offset` live; a click saves. The task form carries a numeric **Offset** field with a Save for keyboard use. | on the phase-2 click, or form Save |
| `draw-section` | `section` | Click the cut line's points — two, or more for a stepped cut — then Finish | on Finish (as `draw-boundary`) |
| `place-view` | `view` | Click the anchor, click the facing direction | on the second click |
| `draw-hatch` | `hatch` | Click the outline points, Finish | on Finish |
| `draw-boundary` | `boundary` | Click the polyline points, Finish | on Finish |
| `place-text` | `text` | A click places the point and focuses the **Text** field; a further click moves the point rather than adding one | on Enter or Finish, once the text is not empty |
| `place-grid` | `grid` | A click | at once; the tool stays on for the next point, with the next name (as `place-post`) |

- **Names.** The existing prefill in `elementBaseline.start` supplies them. `section`, `view` and
  `grid` take the **next free sequence name on the plan**: `S-01`, `S-02`, … / `A-01`, … /
  `1`, `2`, …, computed from the names of that kind already present. `dimension`, `hatch` and
  `boundary` take their kind's label. `text` starts empty; the text field is the name field,
  labelled **Text** for that kind, and an empty one refuses Finish as a name does today.
- **Snapping.** Every tool goes through `constrainDrawingPoint` and `snapPointWithGuides` as now;
  Shift constrains to orthogonal. Room corners (a room's inner face), wall ends, opening jambs and
  element vertices are already candidates; wall face corners are not added (§9).
- **Starting at a point from outside the pointer.** `elementTask.startAt(toolId, point)` sets the
  tool, waits for the baseline read, and calls `addPoint(point)` unless the tool changed meanwhile.
  It replaces `measureFrom`, whose one caller becomes `startAt('measure', opened())`. For `grid`
  that saves at once; for `text` it places the point and focuses the field; for the others it is
  the first point.
- **Draft preview** in `StructureLayer.vue` treats `section` and `view` like `measurement`,
  `stair` and `beam` (no cursor point past two), and `text` and `grid` as a single cursor point.
  In a dimension chain's phase 2 the preview draws the whole chain at the pointer's `offset` and
  adds no cursor point. `ElementDraft` gains `offset: number` and `dimensionPhase: 'points' |
  'offset'`; **Undo point** in phase 2 returns to `'points'` with the points kept, and Cancel
  discards the draft as it does for every tool. The click's offset is rounded to whole
  millimetres.
- **Rotation.** `hatch` is an `outlineKind`, so it takes the object rotation control and its
  rotation command exactly as `object` does. `dimension`, `section`, `view` and `boundary` rotate
  about their length-weighted centre as every open element already does (`linearPivot`); `text`
  and `grid` have no pivot and do not rotate.

## 6. Rendering and hit-testing

**Paint order** (`structure/StructureLayer.vue`): `isStructuralKind` becomes
`drawsAboveWalls(kind)` — `post`, `beam`, `dimension`, `section`, `view`, `text`, `boundary`,
`grid` draw above the wall paint; `hatch` joins every other kind below it, so walls lie over a
hatched area.

**Shapes** (`elements/ElementShapes.vue`, architecture layer; theme tokens only, no literal
colour): stroke `zoneStroke`, `accent` when selected, text `zoneLabel`; every mark is a constant
screen size (`/ zoom`), as the measurement ruler is.

| Kind | Drawn as |
| --- | --- |
| `dimension` | New `elements/DimensionChainShape.vue` over `dimensionSegments`: the dimension line at `offset`, parallel to first→last; an extension line from every point to it, starting a small screen gap from the point; a 45° oblique tick at every projected position; each segment's length centred over it, rotated with the line and kept upright, formatted by `formatMetres` without a unit (`2,62`). A 0-length segment has no text. |
| `section` | A dash-dot line through every point; a filled triangle at each end on the look side of that end's segment (`flipped` chooses the side); the name beside each triangle. |
| `view` | A hollow triangle at the anchor pointing at the facing point; the name beside it, unrotated. |
| `hatch` | The closed outline, filled with `patternTile('stone', tokens.zoneStroke, tokens.canvasBackground)` at `fillPatternScale 1 / zoom`, as `wall-pattern` is. A tint of the colour, when set, is the tile's ground instead (ADR-0033). |
| `text` | The name as a `VText` at the point, 14 px. |
| `boundary` | A long-dash polyline, `16 / 8` px — unlike a fence's `4 / 4`. |
| `grid` | A 10 px circle with the name centred inside. |

**Name tags.** `elementLabelLayout`'s separate tag (and its `labelOffset` drag) is not drawn for
any drafting kind: `section`, `view`, `text` and `grid` draw their name as part of the mark, and
`dimension`, `hatch` and `boundary` show theirs in the tree and inspector only.

**Hit-testing** through the existing candidate `hitPoints` polygon (`resolveSelectionTarget`,
`spatialOutlinePoints`):

- `dimension`: the band between the chain's points and its dimension line;
- `text`, `grid`, `view`: the mark's screen-size box converted to world at the current zoom;
- `section`, `boundary`: line proximity, as `nearLine` already does;
- `hatch`: its outline.

The screen-size boxes need the zoom and, for a text, its words, so `structureCandidates` takes an
optional `{ zoom, names }` context. The canvas's own callers (`canvasCandidates` for `SelectTool`,
and `InteractionLayer`) pass it; a caller without it falls back to the stored points.

**Handles.** `hasPointHandles` answers `true` for `dimension`, `section`, `view`, `hatch` and
`boundary`; `text` and `grid` move by the ordinary element body drag.

## 7. Right-click submenu, labels and editing

**Submenu** (`selection/useCanvasMenuActions.ts`): `{ id: 'drafting-menu', label:
'editor.drafting.menu', group: 'create', icon: 'pencil', children }`, pushed on every
right-click outside Review — nothing, one item or several selected — beside Add… or the per-item
Add submenu; Measure here stays. The existing `CanvasMenuSubmenu` machinery places it, drives it
by keyboard and greys it when every child is.

| Child id | Label (en / de) | Icon | Runs |
| --- | --- | --- | --- |
| `draft-dimension` | Dimension chain / Maßkette | `rp-dimension` | `elementTask.startAt('draw-dimension', opened())` |
| `draft-section` | Section line / Schnittlinie | `rp-section` | `startAt('draw-section', …)` |
| `draft-view` | View marker / Ansichtspfeil | `rp-view` | `startAt('place-view', …)` |
| `draft-hatch` | Hatched area / Schraffur | `rp-hatch` | `startAt('draw-hatch', …)` |
| `draft-text` | Text / Text | `rp-text` | `startAt('place-text', …)` |
| `draft-boundary` | Boundary line / Grenzlinie | `rp-boundary` | `startAt('draw-boundary', …)` |
| `draft-grid` | Grid point / Achspunkt | `rp-grid` | `startAt('place-grid', …)` |

Each child is `disabled: blocked || !runtime.elementTask.available`; its reason comes from the
existing `reason()`. The seven icons are application artwork registered in
`src/plugin/editorIconRegistration.ts` beside `rp-post` and `rp-beam`: none of the Lucide names
that would fit is among the harness's pinned icon fixtures, and the menu test refuses a missing
icon. The parent uses `pencil`, which is.

**Kind labels** in `en` and `de`, wherever posts and beams needed theirs: `zoneTypeLabel` (form
heading, tree row), `TemporaryToolBanner`, the default-name prefill and `surface/cursor.ts`
(crosshair).

**Editing.** A dimension chain's Edit opens `DimensionEditForm.vue` (name and **Offset**), on the
`StructuralEditForm` pattern. **Flip direction** is a direct action, as the load-bearing switch
is: a button in `ElementInspector.vue` and, for a single selected section, an item in its
right-click menu (group `edit`). Both write through the same guarded, reversible element edit
(`elementActions`, `renovation.command` with `elementInput`), so they are undoable and
stale-refused like a move. A text is edited through the existing outline form, whose name field is
the text. The inspector shows no length line for a text or grid point and no renovation entry for
any drafting mark.

**Layers panel.** Unchanged: drafting marks draw in the architecture Konva layer and so follow the
"Walls and openings" row (§9).

## 8. Testing

**Domain (node).**
- `validSpatialElement` per kind: point counts, the one-point rule, `offset` only on `dimension`,
  `flipped` only on `section`, `hatch` as an outline.
- `dimensionSegments`: an off-line point, two points projecting onto each other (length 0), a
  reversed direction.
- `draftingKind` exclusions: not in `renovationTargets`; `sourceMeasurement` refuses one.
- Calibration scales `offset`.

**Persistence.** Schema v12 accepts and refuses the enum and both refines; `writtenSchema` answers
12 only with a drafting kind present; a v11 sidecar still loads; write then read round-trips.

**Editor (jsdom).**
- `startAt` for every tool, and a tool change during the baseline read cancels it.
- Gestures: section and view save on the second click; grid saves at once, stays on and takes the
  next sequence name; text places, focuses and refuses empty; dimension phase 2 sets `offset` from
  the pointer, and the form field sets it too; hatch refuses a self-crossing outline.
- Sequence names skip taken ones (`S-01`, `S-03` present → `S-02`).
- Drafting submenu: children and order; present with nothing, one and several selected; absent in
  Review; a greyed child carries its reason; a child runs `startAt` with the opened point.
- Shapes: Konva node names; a chain's segment texts; the hatch fill is the stone tile; paint order
  relative to the wall passes.
- Hit-testing per kind, the screen-size marks at two zooms.
- Inspector Offset and Flip dispatch the reversible edit, and undo restores the element.
- Every invariant a comment states gets a test watched red first.

**Visual.** A reference-workspace plan carrying all seven kinds becomes a `harness-shot` entry in
both schemes, pinned in `tests/build/harness-shot.test.ts` — the check that the plan reads like
the reference drawing, which jsdom cannot measure. A manual case
`docs/tests/cases/Draw drafting marks.md` joins `Smoke Test the Editor.md`, recorded as not run in
a vault until it is.

**Gate.** `npm run check:fast` while working; `npm run check` in CI on the pull request.

## 9. Out of scope

- **Associative dimensions** that follow a moved wall or opening.
- **Wall face corners** as snap candidates.
- **Architectural length notation**: centimetres below 1 m (`75`) and the superscript half
  centimetre (`1,60⁵`).
- **Moving a segment text** that does not fit outside its chain; it draws in place.
- **Rotated view-marker labels.**
- **Hatch pattern choice** and **text size**.
- **A caption drawn for a hatch, boundary or dimension chain**; place a text instead.
- **Linking** a section or view marker to a plan.
- **Drafting entries in the Add palette**, and a **Drafting row** in the Layers panel.
- **Existing / planned / demolished state** expressed by hatching (`docs/requirements/State visualization.md`).

# Plan editor canvas fidelity — design

Date: 2026-09-10 · One PR off `main` at `dd2942eb`. Sibling of
`2026-09-10-plan-editor-sidebar-polish-design.md`, which owns the sidebar and chrome and
touches nothing on the canvas; this one owns the canvas's drawing and touches nothing else.

Amended during implementation (2026-09-10): the walls' joint extension, the enclosed-outline
rule and the status gap are recorded in `docs/development/agent-guide-increment-history.md`,
section "The canvas fidelity pass, 2026-09-10".

## Why this exists

`docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md` is the
locked home state. A screenshot of the current build with a drawn wall loop and a door, set
beside the mockup, shows the canvas reading as a diagram rather than a floor plan. Measured
against the mockup and against the harness's own `plan-editor-light` capture, the gap is:

1. **Walls.** `StructureLayer.vue` draws each wall as one stroke at `opacity: 0.65`. Where two
   walls meet the strokes overlap and the alpha doubles, which is the dark square at every
   corner of the screenshot. The mockup draws a wall as two thin dark lines with a light fill
   between and clean joints.
2. **Rooms.** `ZoneShape.vue` gives every room a dashed outline per status, a colour tint per
   zone type and a third caption line ("Planned", "In progress"). The mockup draws none of
   that: the wall is the room's edge, there is no resting fill, and the label is name plus
   area. Status was assumed to move to the Inspector's room list; it does not — nothing in
   `src/` reads it, there or anywhere else (see Records).
3. **The harness fixture has no walls.** `findZonesByPlan` in `tests/harness/planEditor.ts`
   answers no `structure`, so no capture has ever drawn a wall, a joint or an opening. That is
   why the first two went unseen through every green gate.

Openings already match the mockup's shape. The grid defaults off in `WorkspaceStore`, as the
mockup has it. Neither changes.

Decisions taken with the user, in order:

1. Room status leaves the canvas. A room keeps a fill only while selected or hovered; the dash
   pattern and the status caption go. (Status is not shown in the Inspector either — see
   Records.)
2. Walls are drawn in two passes over the same polylines rather than as a unioned polygon.
3. The fixture gains a minimal wall loop around the Kitchen; no second, mockup-mirroring floor.

## Scope

### 1. Walls

Files: `src/presentation/editor/structure/StructureLayer.vue`,
`src/presentation/editor/theme/themeTokens.ts`.

The single `VLine` per wall becomes two passes over ALL walls, both fully opaque:

| Pass | Stroke | Width | Purpose |
|---|---|---|---|
| 1 | `tokens.zoneStroke` | `thickness + 2 / zoom` | the two dark edge lines |
| 2 | `tokens.wallFill` | `thickness` | the light interior, painted over pass 1 |

Pass 2 of wall B paints over pass 1 of wall A inside their shared joint, closing the joint's
INNER corner by pass order alone. The OUTER corner needs more than order: `wallPasses.ts`
extends each wall past a shared joint by the largest half-thickness among the other walls
there (the edge pass a further `1 / zoom`), which is what closes it — a mitred corner falls
out of that extension, not of the passes by themselves, with no union, no offset polygons and
no T-joint cases. A free wall end gets only the edge's own `1 / zoom` extension, which is what
shows as a 1 px dark cap, the architectural convention for a wall end and intended. Both passes
are `lineCap: 'butt'`, `lineJoin: 'miter'`. Curved walls go through `arcPolyline` exactly as
today.

The v-for structure changes from one `VGroup` per wall holding stroke, selection dash and
handles, to: pass 1 over all walls, pass 2 over all walls, then the existing per-wall group
holding only the selection dash and the handles. `OpeningSymbols` stays after them; its cut
line, drawn in `canvasBackground` at `thickness + 2 / zoom`, already covers both passes.

`THEME_TOKENS` gains `wallFill: '--background-secondary'`: the theme's own slightly darker
surface, so a light vault gets the mockup's pale grey and a dark vault a lifted grey, with
no literal colour. Its fallback is the module's existing `fallbackColor` rule.

The docblock records the two-pass argument and the polygon-union alternative it refuses.

### 2. Rooms

Files: `src/presentation/editor/layers/zone/ZoneShape.vue`,
`src/presentation/editor/layers/zone/ZoneRenderModel.ts`.

- `outlineConfig`: `dash` removed; `strokeWidth` 1, `strokeScaleEnabled: false` stays. A room
  without walls draws a thin solid outline. A room whose boundary walls still run along every
  edge (`enclosedByBoundary`, asked of the structure being drawn, preview included —
  `useDrawnStructure`) keeps the node mounted with `visible: false`: the zone layer
  paints ABOVE the walls (SDD §17), so pass 2 cannot cover it, and the walls are its edge.
- `fillConfig`: `opacity: props.selected ? 0.12 : 0`. The fill node STAYS mounted at zero
  opacity, because `ZoneLayer`'s paint order and `scene.test.ts`'s `flatPoints` identity case
  both rest on the group's child list not changing shape.
- `statusConfig` and its `VText` are removed. `nameConfig` keeps `offsetY: CAPTION_PX * 1.6`;
  `areaConfig` keeps `offsetY: 0`, so the pair sits where the mockup puts name over area.
- `StatusAppearance` loses `dash`; `captionKey` stays as vocabulary for a future status UI —
  nothing reads it today, `RoomInspector.vue` included (see Records). `zoneFillToken` and the
  seven zone-type tokens stay, since the selected fill still reads them. The designer's
  footprint and clearance layers cite `statusAppearance` in prose only and import nothing
  from it.

### 3. Hover fill

File: `src/presentation/editor/layers/InteractionLayer.vue`.

Beside the existing `hover-outline` line, a `hover-fill` line over the same `hoverOutlineFlat`
points, drawn only when `hoverClosed` is true: `fill: tokens.accent`, `opacity: 0.06`,
`closed: true`, `listening: false`, no stroke. The outline stays. Order: fill first, outline
over it. This is the "or hover" half of decision 1.

### 4. Fixture

File: `tests/harness/planEditor.ts`.

`HARNESS_STRUCTURE: Structure`, exported beside `HARNESS_PLAN` for the same reason it is:

- four walls, thickness 240, height 2600, closing the Kitchen's rectangle corner to corner in
  the zone's own vertex order;
- one `door` on the south wall, width 900, with a swing (`hinge: 'start'`, `side: 'left'`,
  `angle: 90`);
- one `window` on the north wall, width 1200, sill 900;
- one `boundaries` entry linking the four wall ids to `harness-kitchen`.

`findZonesByPlan` answers `structure: structuredClone(HARNESS_STRUCTURE)` beside `zones`.
Terrace and Garden stay wall-less on purpose, so the same frame photographs a room with walls
and a room without.

No new fixed shots. `plan-editor-dark`, `plan-editor-light`, `plan-editor-selected` and the
`plan-editor-multiple*` family already frame the Kitchen and now carry walls, a joint at each
corner, a door and a window.

## Testing

- `tests/presentation/editor/scene.test.ts`: the three opacity expectations become
  `[0, 0]`, `[0.12, 0]`, `[0, 0]`.
- `tests/presentation/editor/renderModels.test.ts`: dash assertions on `statusAppearance`
  removed; `captionKey` assertions stay.
- New `tests/presentation/editor/structureLayerPasses.test.ts`: mounts `StructureLayer` with
  two walls sharing a corner and asserts (a) every pass-1 node precedes every pass-2 node in
  the layer's child order, (b) no wall node carries `opacity() < 1`, (c) pass-1 width is
  pass-2 width plus `2 / zoom`. Watched red against the current single-stroke layer before the
  change lands.
- `tests/presentation/editor/renderModels.test.ts`, which already walks `THEME_TOKENS`:
  `wallFill` resolves `--background-secondary` and falls back with the others.
- Hover: one case beside the outline's existing one, asserting `hover-fill` mounts only for a
  closed hovered shape and never for an open one.
- Captures: `npm run harness-shot`, then `plan-editor-light`, `plan-editor-dark`,
  `plan-editor-selected` and `plan-editor-multiple` READ, not just produced, for: no dark
  square at any of the four corners, door and window cut through both passes, the selected
  Kitchen's fill visible and the unselected rooms' absent, Terrace's thin solid outline.
- `npm run check` green once before the commit.

## Out of scope, stated so nobody reads silence as omission

- The mockup's furniture and sanitary symbols. Objects stay generic rectangles; a symbol
  library is its own feature.
- Wall hatching. The mockup's fill is plain.
- The mockup's navy label colour. `--text-normal` stays; the theme owns ink.
- A second fixture mirroring M01's four-room floor (decision 3). Add it when the comparison
  scripts under `docs/user-experience/renovation-planner-editor-specs/implementation/` are
  pointed at a like-for-like frame.
- The wall legend's "wall to remove" and "new wall" semantics: `RenovationLayer` draws them
  already and is untouched.

## Records

- M01's Layout section gains one line: room status is shown nowhere in the editor — not on the
  canvas and not in the Inspector room list — dated 2026-09-10.
- Increment-history entry: the fixture carried no walls, so the wall look went unphotographed
  through every green gate; the alpha-doubling corner; and the two-pass rendering with the
  union it refuses.
- CLAUDE.md is not edited: it names no wall opacity, no fixture shape and no token count.

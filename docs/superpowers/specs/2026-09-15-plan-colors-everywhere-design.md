# Plan editor: a colour on everything, with a colour picker

**Date:** 2026-09-15
**Baseline:** `main` at `36cd544c`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-15. No
implementation plan yet.
Where this document and the SDD disagree, the SDD is the authority. It amends ADR-0031's rejected
"custom colours" alternative through a new ADR-0033 (§5) and rewrites the contract in
`docs/development/item-colors.md`.

## 0. Where this sits

Item colours shipped in #214: six named presets (`slate`, `rose`, `amber`, `green`, `blue`,
`violet`) on `object` and `asset` elements only, one selected element at a time, sidecar schema 14.
This increment widens that in four directions, all chosen by the user:

| Question | Decision |
| --- | --- |
| Which things take a colour | **Every element kind, walls, openings and rooms/areas.** Reference plans do not. |
| Custom colours | **Presets stay, plus any `#rrggbb`** from a native colour picker. |
| Several selected things | **One colour applied to all of them, as one undo step**, with a *Mixed* state. |
| Where a room's colour is stored | **The geometry sidecar**, beside every other colour — not the room note. |
| A coloured line or text while selected | **Accent while selected**; the colour returns on deselect. |
| A post | **The colour is the post's ink**: load-bearing stays solid, in that colour. |
| A room's fill | **Translucent**: opacity 0.18 at rest, 0.28 selected, so a background plan stays readable. |
| The custom picker in the right-click menu | **Not there.** Details only; the menu keeps Default + presets. |

Out of scope: colour contrast enforcement, colour in Renovate/Review editing, recolouring the
intended (proposed) structure independently, colours on reference plans, a colour as a Bases
property on the room note.

## 1. Data and file format

### Value

`ItemColor` (`src/domain/spatial/ItemColor.ts`) becomes `PlanColor = PresetColor | HexColor`:

- `PresetColor` is today's closed id list, unchanged. Details names it ("Blue").
- `HexColor` is a lowercase `#rrggbb`, validated strictly (`/^#[0-9a-f]{6}$/`). The control
  normalises the native input's value to lowercase before it reaches the action. A picked hex is
  stored as hex even when it equals a preset's RGB — no silent conversion.
- Absence still means Default. `null`, `default`, other CSS forms and unknown ids stay invalid.

### Where it lives

All in the sidecar. `color?: PlanColor` on:

| Family | Field on | Domain type |
| --- | --- | --- |
| Every `SpatialElementKind` | `structure.elements[]`, `intended.elements[]` | `SpatialElement` |
| Walls | `structure.walls[]`, `intended.walls[]` | `Wall` (`Structure.ts`) |
| Openings | `structure.openings[]`, `intended.openings[]` | `Opening` (`Structure.ts`) |
| Rooms / areas | `objects[]` | `Zone` (new field, round-tripped like `labelOffset`) |

`itemColorKind` is deleted; `validSpatialElement` accepts a valid `PlanColor` on any kind.
`validateStructure` validates wall and opening colours.

### Schema 15

- `planGeometry.ts` gains `PlanGeometrySchemaV15`: elements' `color` becomes the `PlanColor` schema
  and the kind refine is dropped; walls, openings and `objects[]` entries gain an optional `color`.
- Migration 14→15 changes only the discriminator.
- `writtenSchema` (`PlanGeometryStore.ts`) returns **15** when any hex colour exists or any
  wall/opening/room/non-item element carries a colour; otherwise the existing ladder, so a plan
  whose only colours are presets on items keeps writing **14** and current builds still open it.
  Reset removes the field, so the normal downgrade applies.
- Older readers refuse version 15 rather than strip the field.
- The two hard-coded V10 parses of a zone entry (`zoneMapper.ts` `zoneFromPersistence`,
  `ObsidianZoneRepository.ts` pre-write check) read the colour-bearing entry shape.

### Two traps closed

1. **A room save would erase its colour.** `ObsidianZoneRepository.save` replaces the whole
   `objects[]` entry with `zoneToGeometryEntry(zone)`. So `Zone` carries `color`,
   `zoneFromPersistence` reads it, `zoneToGeometryEntry` writes it, and every `with*` preserves it.
2. **Undo would overwrite a peer's recolour.** `sameGeometryDocument` adds `color` to the wall,
   opening and object tuples (elements already include it), and `digest.ts`'s `ENTRY_KEYS` adds
   `color`, so a zone's observed version changes with its colour. `JSON.stringify` with a key list
   omits an absent key, so no uncoloured zone's version changes.

Copy/paste and item promotion spread every field already; both keep the colour.

## 2. Drawing

`itemColorAppearance.ts` becomes `planColorAppearance.ts`:

- `planColorRgb(color)` — preset → its content RGB, hex → itself.
- `planColorTint(color, background)` — today's opaque 28/72 blend against the resolved canvas
  background, with today's fallback to the host fill when Konva cannot parse the background.
- `planColorInk(color, fallback)` — the RGB at full strength, or `fallback` when absent.
- `planColorWash(color)` — the RGB as a translucent fill, for rooms.

| Family | Coloured part | Unchanged |
| --- | --- | --- |
| object, asset | tint: footprint and solid details (as today) | outline, label, clearance, dashed overhead |
| stair | tint: outline fill | treads, direction arrow |
| hatch mark | tint: tile ground (3rd argument of `patternTile`) | hatch ink |
| wall | tint: body; a patterned wall uses it as tile ground | material hatch ink, edge line |
| path, fence, measurement, beam, boundary | ink: line (measurement ticks share the stroke) | dash patterns, widths |
| arrow | ink: line and head | end handles keep `accent` |
| dimension, section, view, grid, text | ink: lines, marks and their text | geometry of each mark |
| post | ink: stroke; load-bearing solid fill in that ink | diagonals invert as today |
| opening | ink: frame, leaf, swing arc | the cut (`canvasBackground`) |
| room / area | wash: opacity 0.18 at rest, 0.28 selected | outline, name, area caption |

Selected strokes and text use `accent` exactly as today; fills keep their tint or wash. An
uncoloured room keeps today's behaviour (no fill at rest, 12% zone-type token when selected).

**Walls.** Chained runs draw many walls as one line, so a coloured wall is taken out of the chained
pass and drawn in the existing per-wall pattern pass (`StructureLayer.vue`'s `patterned` set widens
to "has a pattern or a colour"). A coloured unpatterned wall is a solid tinted polygon. The tile
cache key becomes `(pattern, ground)`. The mitre wedge this per-wall path leaves at a corner is
already accepted for patterned walls.

**Known limit.** A custom hex can be low-contrast as ink (yellow text on a light theme). Nothing
enforces contrast; Default resets it. Presets are the same fixed content samples under every theme.

## 3. Commands and UI

### One recolour action, through group operations

`createPlanColorActions` (presentation) exposes `setColor(ids, color)` for any selection size:

1. `operations.capture(ids, ids.length === 1)` (`groupOperations.ts`) — refuses while blocked,
   working, a dialog is open, or when an id is unavailable.
2. `next` = the captured document with `color` set, or the key removed for Default, on exactly
   `snapshot.selectionIds` — **not** `memberIds`, which expands a wall to its hosted openings.
3. `operations.commit(snapshot, next)` → `GroupGeometryCommand`: one conditional sidecar write, one
   history entry, generation/stale/busy checks, Review blocked, and `geometryPermitted` refusing any
   non-group change outside Plan.

A request that changes nothing returns before a write or a history push (`commit` already
short-circuits on `sameGeometryDocument`).

`GroupGeometryCommand`'s `zoneReceipts` compares `{ points, bulges, color }`, so a recoloured room
records its new version in the ledger and a later rename is not refused as a peer change.

**Deleted:** `elementActions.setColor`, `recolored`, and the `RenovationCommand` colour route, which
rewrote the Plan note for a sidecar-only change.

### `PlanColorControl`

`ItemColorControl.vue` becomes `PlanColorControl.vue` (and `ItemColorSwatch` → `PlanColorSwatch`):

- **Visible** in Plan when the selection holds at least one colourable id (anything but a
  reference plan).
- **Choices:** Default, the six presets, and — in Details only (`menu` prop false) — **Custom**, a
  labelled native `<input type="color">`. It writes on `change`, never `input`, so a drag through
  the OS picker is one write. Its chip shows the saved hex when the shared value is a hex; its
  accessible name includes the hex.
- **State:** every selected id sharing one value → that swatch checked, label names it (`Blue`,
  `#3a7bd5`, `Default`). Values differ → label reads **Mixed**, nothing checked; any choice sets all.
- Keyboard behaviour of the preset row is unchanged (Left/Right within, Enter/Space apply; the menu
  keeps Up/Down/Home/End).

**Mounts:** `ElementInspector` (existing), `StructureInspector` (walls/openings), `RoomInspector`'s
More toolbar, `MultiSelectionInspector`'s `#actions` slot, and the context menu's `#appearance` slot,
now also for multi-selections.

### Strings

EN and DE: `mixed`, `custom`, the custom input's label and hex-bearing accessible name. The DE
dictionary stays at parity (the existing locale checks enforce it).

## 4. Tests

Each watched red before its fix:

- **Domain:** `PlanColor` — valid presets and lowercase hex; refused uppercase, 3-digit, `rgb()`,
  named CSS, `default`. Every element kind, wall, opening and zone accepts a colour.
- **DTO / migration / writer:** V15 parses all four families; V14 still refuses hex and non-item
  colours; 14→15 migrates; `writtenSchema` — preset on item → 14, any hex → 15, wall/room/path colour
  → 15, reset → downgrade.
- **Zone persistence:** colour survives rename, move and lock through the repository stack;
  `observeZone` changes with colour and not for an uncoloured zone.
- **Equality:** `sameGeometryDocument` detects a colour change on a wall, an opening and an object.
- **Command:** `GroupGeometryCommand` recolouring a room records a zone receipt; undo/redo; a peer's
  colour change refuses undo.
- **Action:** single and mixed-batch recolour each push one history entry; same colour writes
  nothing; recolouring a wall leaves its door; refused when stale, saving, non-Select tool, Review.
- **Rendering:** per family tint/ink/wash from §2; accent wins while selected; load-bearing post solid
  in ink; room wash 18/28; patterned wall keeps hatch on the tinted ground, tile cache per ground.
- **Control:** Mixed label; `change` dispatches and `input` does not; Custom absent with `menu`;
  axe over Details and menu.
- **Existing pins that flip:** `tests/domain/spatial/itemColor.test.ts` (eligible kinds, coloured
  path refused, fill on path) and `tests/presentation/editor/itemColors.test.ts` ("does not recolor a
  path, room or wall") are rewritten to the new contract, not deleted.
- **Harness captures** of every family coloured, both schemes, and a 460 px pane.

## 5. Decisions recorded

- **ADR-0033 — A plan colour is user content on every spatial family.** Amends ADR-0031's rejected
  "custom colours" alternative: a wall's material is still a theme-drawn hatch; the colour is the
  ground under it. Records that the sidecar holds appearance, as schema 14 began, and why rooms keep
  it there (one write for a batch) rather than in frontmatter. ADR-0031 gains a pointer to it.
- `docs/development/item-colors.md` rewritten as the full contract (filename kept so links hold).
- `docs/using-item-colors.md` EN/DE; the hatch row of
  `2026-09-13-plan-drafting-tools-design.md` notes the colour ground; `CHANGELOG.md`.
- `docs/tests/cases/` gains a manual case for the native picker in a vault — unrun until run.

## 6. Delivery

Three phases on one branch, CI green between each:

1. **Value, picker, route.** `PlanColor`, schema 15 with every field, zone round-trip and the two
   traps, `planColorAppearance`, the group-operations action replacing `setColor` (single
   selection), Custom in `ElementInspector`. Items get custom colours immediately.
2. **Every family.** Eligibility, §2 drawing, mounts in `StructureInspector` and `RoomInspector`.
3. **Batch.** The control shown for multi-selections (the action already takes any size), Mixed
   state, `MultiSelectionInspector` mount and the menu slot for multi-selections.

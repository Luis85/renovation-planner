# Plan editor asset placement — design

Date: 2026-09-10, amended 2026-09-11 · Off `main` at `c6db3854`. First of two increments
connecting the Plan editor to the rest of the plugin; the second, a renovation overlay on the
canvas (per-room cost, work and status drawn on the plan), gets its own brainstorm and spec after
this one, because it will draw placements and their costs. Touches the canvas's Asset layer and
element plumbing, so it lands after — or rebases over —
`2026-09-10-plan-editor-canvas-fidelity-design.md`, which owns the canvas's drawing and is not yet
implemented.

## Why this exists

The Asset designer is done: every `AssetShape` carries a footprint, a clearance, one anchor and
one facing (`docs/requirements/Place an anchor and set a facing direction.md`, Done). The Plan
editor cannot put one anywhere. `place-asset` is declared in `ToolId`
(`src/presentation/editor/tools/editor-tool.ts`) and registered nowhere, §17's Asset layer
mounts as an `EmptyLayer`, and `docs/requirements/Asset placement.md` has no status. Until a
placement exists, an asset is a shopping-list row rather than a thing that goes somewhere, and
nothing can later point at *that* radiator.

Decisions taken with the user, in order:

1. **Placement feeds quantity by opt-in link.** A new quantity rule counts an asset's placements
   in a room; nothing creates a material without being asked.
2. **Placements live in both states**, existing and planned, like walls and objects — so "swap
   the boiler" is an existing placement removed and a planned one added.
3. **An asset is chosen through the Add menu's "Asset…" picker**, not a sidebar palette.
4. **Walls snap, they do not host.** Nothing about a wall is stored on a placement.
5. **A placement is a new spatial element kind stored as two points** and its footprint is
   derived from the library asset, never copied.

Amended 2026-09-11 after planning read the code, also with the user:

6. **Room membership is a probe point 10 mm in front of the anchor**, not the footprint centre, so
   the quantity measurement stays pure and synchronous and never reads an asset.
7. **`DeleteAsset` ignores placements.** They degrade to visible placeholders; the refusal and the
   "Placed N times" line are withdrawn.
8. **The picker is the editor's own `entity-picker` dialog**, not `AssetSuggestModal`.
9. **Two schema bumps**: the plan geometry sidecar (8 → 9) and the requirement note (3 → 4).
10. **The layers panel gains an Assets row.**

## Scope

### 1. Domain and storage

**Model** — `src/domain/spatial/SpatialElement.ts`:

- `SpatialElementKind` gains `'asset'`; `SpatialElement` gains optional `assetId`.
- `validSpatialElement`: an `'asset'` element requires a non-empty `assetId` and exactly two
  distinct points `[anchor, facingPoint]`. Every other kind is refused if it carries `assetId`,
  the same shape of rule `stair` already follows.
- A new placement sets `facingPoint` 1000 mm from the anchor. Only its direction is meaningful.

**Derivation** — new pure module `src/domain/spatial/assetPlacement.ts`:

- `placedOutline(element, shape)` → `{ footprint, clearance }` in world millimetres: the asset's
  footprint and clearance, taken relative to `shape.anchor`, rotated by
  `atan2(facingPoint − anchor) − shape.facing`, translated to the anchor.
- `membershipProbe(element)` → the point 10 mm from the anchor towards `facingPoint`.
- `backDepth(shape)` → how far the footprint reaches behind the anchor, measured against the
  asset's own facing; wall snapping uses it.
- It is the ONLY derivation of a placement's outline. Move, rotate and group transforms already
  map `points`; mapping two points preserves both position and direction, so those tools need no
  placement-specific arm.

**Storage** — placements sit in `structure.elements` and `intended.elements` of the plan
geometry sidecar, exactly where objects do. The existing/planned diff, groups, renovation
targets and evidence pins apply unchanged. The element's name defaults to the asset's name
through the existing element metadata.

**Compatibility** — a build reading a newer file reports `plan-geometry.schema-version-unsupported`
rather than a validation failure only if the version says so. The sidecar schema therefore gains
V9 (the element enum widened to `'asset'`, `assetId` declared), `writtenSchema` answers 9 only for
a file holding an asset element, and an empty 8 → 9 migration is appended.

**Every `kind === 'object'` branch** is reviewed for an `'asset'` arm; the plan lists them from a
grep. Most need none once an asset candidate carries `hitPoints`.

### 2. Placing and editing

**Starting** — the Add menu (`src/presentation/editor/add/creationCatalogue.ts`) gains
**Asset…**. It opens the editor's existing `entity-picker` dialog over the runtime's cached
`assetOptions`. The chosen asset's shape is read through a new editor query over the asset
geometry sidecar. An asset whose shape is absent, still awaiting a scale, or unreadable does not
start the tool; a notice says why.

**The `place-asset` tool** — registered against the declared `ToolId`:

- A preview footprint follows the pointer; each click places one copy; Escape ends the tool.
- **Snap**: when the pointer is within snap tolerance of a wall, the placement faces away from
  that wall and its footprint's back edge sits on the wall's face (centre line offset by half the
  thickness, plus `backDepth`). Otherwise it is free and keeps the asset's own facing. The
  existing snap toggle turns this off.
- **Keyboard path**: typed X/Y coordinates in the tool's task form, as `place-object` has.
- **Which state**: existing `structure`, through `RenovationCommand`, as `place-object` writes.
  A planned placement is made through the renovation flow elements already use.
- **Undo**: one `CommandHistory` entry per placement. The baseline is re-read before every
  placement, because `RenovationCommand` checks the version it was built from.
- **No pre-placement rotation**; the existing Rotate handle and "Rotate by…" apply afterwards.
- **`EditorSurface.vue` (399 of 400 lines) and `runtime.ts` (400 of 400) gain nothing**: the tool
  is registered beside the element tools in `elements/spatialEditing.ts`.

**Drawing** — the Asset layer stops being an `EmptyLayer`:

- Footprint outline plus a small facing tick per placement.
- Clearance as a faint dashed outline **only while selected or hovered**.
- A missing asset draws as a marked placeholder at its anchor.
- Every colour is an Obsidian CSS variable (SDD §84; the build refuses a literal).
- Hit-testing, marquee, Alt-cycling and groups use the derived footprint as `hitPoints`.
- **Layers**: a sixth row, **Assets**, toggles the `asset` Konva layer and filters asset
  candidates out of pointer admission while hidden.

**Inspector** — `ElementInspector` gains an asset branch: the asset's name, its dimensions and
**Open in designer**; the renovation sequence objects already have; and **Add as material**
when the room has no `placement-count` material for this asset.

### 3. The `placement-count` quantity rule

`src/domain/requirement/RequirementSource.ts`:

- `QUANTITY_RULES` gains `'placement-count'`, unit `piece`.
- The source is the ordinary shape: `{ planId, targetId: <the material's room>, state, rule }`,
  so `validRequirementSource` is unchanged.
- The measurement counts `'asset'` elements in that state's structure whose `assetId` is the
  material's and whose `membershipProbe` lies inside that room. `sourceMeasurement` gains an
  optional `assetId` parameter, which all six call sites already hold.
- **Zero placements is 0 pieces**, a valid answer rather than a source error.
- A placeholder counts exactly like any placement: membership needs no asset.

**Why a probe and not the centre** — the centre needs the asset's footprint, and
`sourceMeasurement` is pure, synchronous and called from six sites that have none. A wall-snapped
anchor sits on the wall face; 10 mm along the facing is inside the room the asset faces.

**Recalculation** — a placement written through `RenovationCommand` publishes
`PlanRenovationChanged`, which `onPlanningChanged` already recalculates on. A designer edit
cannot change a count, so no subscription to `AssetDesignChanged` is added.

**Schema** — the requirement note gains V4; the mapper writes 4 only for a `placement-count`
source, and a 3 → 4 discriminator migration is appended.

**Add as material** opens the existing Materials form pre-filled — this asset, this room, the
current perspective's state, `placement-count` — and saves through the existing requirement
command on confirmation. Nothing is created unasked.

### 4. Deleted and missing assets, errors

**Deleting a placed asset** changes nothing in `DeleteAsset`. Placements are never rewritten by
an asset delete; they become missing-asset placeholders. Refusing was measured against the shared
`deleteWithReferences` flow and would dead-end it: with no requirements that flow dispatches at
once and reads `reference.referents-exist` as a stale read. Rewriting placements is one write per
plan across many sidecars with no crash journal (the ADR-0019 gap). A "Used in" line for
placements in the Asset library is a later increment.

**Missing-asset placeholder** (deleted, or its geometry unreadable):

- Drawn as a marked symbol at the anchor; selectable, movable, deletable.
- The Inspector says why and offers **Replace asset…** — the picker, repointing this one
  placement in one undoable command.
- `placement-count` still counts it, so the shopping list does not quietly shrink.
- An unavailable library while the editor is open reads as every placement missing, never as no
  placements.

**Errors** — place, move and replace are each one command through the editor dispatcher. A
failed write rejects the command, leaves the canvas as it was and reports through the
dispatcher's existing error surface; never a raw message.

## Out of scope

- Mirroring, and a placement anchor distinct from the asset's anchor — both questions stay with
  `docs/requirements/Asset placement.md`, which inherits them undecided.
- Hosting on walls (moving with a wall, "Move along wall").
- Rotating the preview before a click.
- A sidebar asset palette and drag-and-drop.
- Per-placement numbered material markers; the per-room markers are unchanged.
- Placement counts in the Asset library or its delete dialog.
- The renovation overlay — the next increment.

## Testing

**Node** (pure):

- `assetPlacement`: rotation and translation for an off-origin anchor, a non-zero asset facing,
  with and without clearance; `backDepth`; `membershipProbe`; and the load-bearing property —
  rotating the two stored points about any pivot yields the same footprint as rotating the
  derived one.
- `validSpatialElement`: `'asset'` with one or three points, coincident points, or no `assetId`
  refused; `assetId` on another kind refused.
- `placement-count`: inside; a wall-snapped placement on a shared wall counted only in the room it
  faces; existing versus planned; another asset's placements ignored; zero.
- Sidecar V9 and requirement V4: round-trip, `writtenSchema` minimality, and the latest-version
  pins.

**Application**: recalculation of a `placement-count` material after a placement is written.

**jsdom**: the tool (preview, click, Escape, wall snap, typed coordinates, one undo entry per
placement, a second placement not conflicting); the Asset layer (footprint, clearance only when
selected, placeholder); the Assets layer row; the Inspector (Add as material opens the pre-filled
form, Replace asset…); the picker's notice for an unusable shape; axe over the new Inspector
branch.

**Harness**: the fixture plan gains placements, one missing; `harness-shot` in both schemes and at
`--width=460`.

**Manual**: `docs/tests/cases/Place an asset on a plan.md`, written and recorded as not run until
walked in a vault.

Every invariant stated in a comment gets a test watched failing first. `check:fast` between
edits; `npm run check` once before each commit.

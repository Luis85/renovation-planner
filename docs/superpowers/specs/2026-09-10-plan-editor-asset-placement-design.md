# Plan editor asset placement — design

Date: 2026-09-10 · Off `main` at `c6db3854`. First of two increments connecting the Plan editor
to the rest of the plugin; the second, a renovation overlay on the canvas (per-room cost, work
and status drawn on the plan), gets its own brainstorm and spec after this one, because it will
draw placements and their costs. Touches the canvas's Asset layer and element plumbing, so it
lands after — or rebases over — `2026-09-10-plan-editor-canvas-fidelity-design.md`, which owns
the canvas's drawing and is not yet implemented.

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
- It is the ONLY derivation of a placement's outline. `spatialElementFootprint`
  (`src/domain/spatial/stairGeometry.ts`) routes the `'asset'` arm through it, given an
  asset-shape lookup its callers pass in.
- Move, rotate and group transforms already map `points`; mapping two points preserves both
  position and direction, so those tools need no placement-specific arm.

**Storage** — placements sit in `structure.elements` and `intended.elements` of the plan
geometry sidecar, exactly where objects do. The existing/planned diff, groups, renovation
targets and evidence pins apply unchanged. The element's name defaults to the asset's name
through the existing element metadata.

**Compatibility** — an older build would refuse a sidecar containing `'asset'` as invalid. The
sidecar's schema version rises by one with an empty upward migration, so an older build reports
the newer version rather than corruption. Planning confirms the migration runner's behaviour and
wording.

**Every `kind === 'object'` branch** (about twenty across `src/presentation/editor/` and
`src/domain/`) is reviewed for an `'asset'` arm; planning lists them from a grep, and a
finds-something-at-all case keeps that list honest.

### 2. Placing and editing

**Starting** — the Add menu (`src/presentation/editor/add/creationCatalogue.ts`) gains
**Asset…**, opening `src/presentation/modals/AssetSuggestModal.ts` with its placeholder taken as
a parameter rather than hard-coded to the designer command. Candidates come from `ListAssets`
plus `ListAssetOutlines`. Choosing an asset whose outline is `unscaled`, `none` or `refused`
does not start the tool; a notice says why.

**The `place-asset` tool** — registered against the declared `ToolId`:

- A preview footprint follows the pointer; each click places one copy; Escape ends the tool.
- **Snap**: an anchor within snap tolerance of a wall face projects onto that face
  (`projectOntoWall` offset by half the thickness) and faces away from the wall. Otherwise it is
  free and keeps the asset's own facing. The existing snap toggle turns this off.
- **Keyboard path**: typed X/Y coordinates in the tool's task form, as `place-object` has.
- **Which state**: the same rule `place-object` follows today; planning confirms it.
- **Undo**: one `CommandHistory` entry per placement.
- **No pre-placement rotation**; the existing Rotate handle and "Rotate by…" apply afterwards.
- **`EditorSurface.vue` is at 399 of 400 lines**: the tool takes its input through the
  `EditorTool` interface and adds nothing to that file.

**Drawing** — the Asset layer stops being an `EmptyLayer`:

- Footprint outline plus a small facing tick per placement.
- Clearance as a faint dashed outline **only while selected or hovered**.
- A missing asset draws as a marked placeholder at its anchor.
- Every colour is an Obsidian CSS variable (SDD §84; the build refuses a literal).
- Hit-testing, marquee, Alt-cycling and groups use the derived footprint.

**Inspector** — `ElementInspector` gains an asset branch: the asset's name, its dimensions and
**Open in designer**; the renovation sequence objects already have; and **Add as material**
when the room has no `placement-count` material for this asset.

### 3. The `placement-count` quantity rule

`src/domain/requirement/RequirementSource.ts`:

- `QUANTITY_RULES` gains `'placement-count'`, unit `piece`.
- The source is the ordinary shape: `{ planId, targetId: <the material's room>, state, rule }`,
  so `validRequirementSource` is unchanged.
- The measurement counts `'asset'` elements in that state's structure whose `assetId` is the
  material's and which belong to that room. `sourceMeasurement` gains an `assetId` parameter.
- **Zero placements is 0 pieces**, a valid answer rather than a source error.
- **Belonging is the derived footprint's centre**, not the anchor: a wall-snapped anchor sits on
  the room's edge and would count in both neighbours or neither. A placeholder with no outline
  falls back to its anchor.

**Recalculation** — placing, moving and deleting publish `PlanStructureChanged`, which
`src/application/event-handlers/requirement/onPlanningChanged.ts` already recalculates on. A
designer footprint edit can move a centre across a room edge, so the cascade also recalculates
`placement-count` materials on the asset shape's update event (planning confirms its name;
`onAssetUpdated.ts` exists).

**Add as material** opens the existing Materials form pre-filled — this asset, this room, the
current perspective's state, `placement-count` — and saves through the existing requirement
command on confirmation. Nothing is created unasked.

### 4. Deleted and missing assets, errors

**Deleting a placed asset** — a new query `ListPlacementsReferencing(assetId)` reads every plan
sidecar through the project index.

- `DeleteAsset` with **no resolution** (the script and migration path) refuses while placements
  exist, as it does for requirements.
- The delete dialog shows "Placed N times on M plans" beside the requirement count. **Whatever
  resolution is chosen, placements are never rewritten** — they become missing-asset
  placeholders. Rewriting them is one write per plan across many sidecars with no crash journal
  (the ADR-0019 gap); a visible placeholder is honest and needs no cross-file write.

**Missing-asset placeholder** (deleted, or its geometry `refused`):

- Drawn as a marked symbol at the anchor; selectable, movable, deletable.
- The Inspector says why, mapped from the `ListAssetOutlines` `refused` code or the absence of
  the asset, and offers **Replace asset…** — the picker, repointing this one placement in one
  undoable command.
- `placement-count` still counts it (by anchor), so the shopping list does not quietly shrink.
- An unavailable library while the editor is open reads as every placement missing, never as no
  placements.

**Errors** — place, move and replace are each one sidecar write. A failed write rejects the
command, leaves the canvas as it was and reports through `notifyError`; never a raw message.

## Out of scope

- Mirroring, and a placement anchor distinct from the asset's anchor — both questions stay with
  `docs/requirements/Asset placement.md`, which inherits them undecided.
- Hosting on walls (moving with a wall, "Move along wall").
- Rotating the preview before a click.
- A sidebar asset palette and drag-and-drop.
- Per-placement numbered material markers; the per-room markers are unchanged.
- The renovation overlay — the next increment.

## Testing

**Node** (pure):

- `assetPlacement`: rotation and translation for an off-origin anchor, a non-zero asset facing,
  with and without clearance; and the load-bearing property — moving, rotating and
  group-rotating the two stored points yields the same footprint as transforming the derived one.
- `validSpatialElement`: `'asset'` with one or three points, coincident points, or no `assetId`
  refused; `assetId` on another kind refused.
- `placement-count`: centre inside; a wall-snapped placement on a shared edge counted in exactly
  one room; existing versus planned; placeholder by anchor; zero.
- Sidecar schema bump: migration round-trip; an older schema refuses as newer, not as corrupt.

**Application** (`createRepositoryStack` / `openFixtureVault`): `ListPlacementsReferencing`
across two projects; `DeleteAsset` refusing without a resolution and leaving placements with
one; recalculation after place, move, delete and an asset footprint update.

**jsdom**: the tool (preview, click, Escape, wall snap, typed coordinates, one undo entry per
placement); the Asset layer (footprint, clearance only when selected, placeholder); the Inspector
(Add as material opens the pre-filled form, Replace asset…); the picker's notice for an unusable
outline; axe over the new Inspector branch.

**Harness**: the fixture plan gains three placements, one missing; `harness-shot` in both schemes
and at `--width=460`.

**Manual**: `docs/tests/cases/Place an asset on a plan.md`, written and recorded as not run until
walked in a vault.

Every invariant stated in a comment gets a test watched failing first. `check:fast` between
edits; `npm run check` once before each commit.

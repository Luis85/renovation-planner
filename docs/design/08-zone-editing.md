# Design Slice 8: Zone Editing

## Purpose

Slice 6 built the editor tool framework (`EditorTool`, `UndoableCommand`,
`CommandHistory`, transaction boundaries, Transformer normalization, `SnapService`)
without wiring it to any concrete interaction. Slice 7 used that framework to build
calibration. This slice is the second and more demanding concrete consumer: it turns
the framework into the interaction set the SDD calls Increment 6 — a user can draw a
polygon zone, select it, move it, reshape it vertex by vertex, and delete it, with
every one of those actions safely undoable.

This slice is also the first place polygon geometry (as opposed to the two-point line
calibration uses) has to survive real pointer input without becoming corrupt. It is
where SDD §26's validation rules stop being a paragraph of intent and become the
actual boundary a `Zone`'s geometry cannot cross without being rejected.

## Scope

### In scope

- `DrawPolygonTool`: a concrete `EditorTool` that accumulates vertices from pointer
  input and closes them into a `CreateZoneCommand`.
- `SelectTool`, first built here against `Zone`: hit-testing, selection state, and the
  vertex/body handles rendered in the `InteractionLayer` for a selected zone.
- Whole-zone move (drag the body) as one `ReversibleMoveZoneCommand` (slice 6's
  `UndoableCommand` adapter wrapping slice 3's plain `MoveSpatialObjectCommand`) per
  drag gesture.
- Single-vertex reshape (drag a vertex handle) as one new `UndoableCommand`,
  `MoveSpatialObjectVertexCommand`, per vertex-drag gesture.
- Zone deletion as one new `UndoableCommand`, `ReversibleDeleteZoneCommand` —
  wrapping slice 3's plain `DeleteZoneCommand` the same way slice 6's
  `ReversibleMoveZoneCommand` wraps `MoveSpatialObjectCommand` — whose `undo()`
  resurrects the exact deleted entity (same ID, same geometry).
- Geometry validation at the point geometry is about to become a command input:
  minimum vertex count, finite/non-NaN coordinates, world-unit coordinates, and a
  well-formed viewport transform — per SDD §26's required (non-"Future") rules.
- Explicit deferral of self-intersection detection, winding normalization, polygon
  repair (§26 "Future"), boolean polygon operations via `clipper2-ts` (§27), and an
  `rbush` spatial index for hit-testing (§28) — all correctness in this slice is
  achieved without any of them.

### Out of scope (covered by other slices)

- The calibration tool and the world/screen transform it produces — slice 7.
- `EditorTool`, `UndoableCommand`, `CommandHistory`, the transaction-boundary rule,
  Konva Transformer normalization, `SnapService` — slice 6 (consumed here, not
  redefined).
- The `Zone` entity itself, its schema, and the plain (non-undoable)
  `CreateZoneCommand` / `MoveSpatialObjectCommand` / `DeleteZoneCommand`
  implementations — slice 3. This slice wraps `DeleteZoneCommand` in an
  `UndoableCommand` the same way it wraps `MoveSpatialObjectCommand`; it does not
  reimplement zone deletion from scratch.
- Repository mechanics, the plan geometry sidecar format, and the
  Markdown-plus-sidecar consistency rule — slice 4. This slice only triggers those
  paths via commands.
- Deletion reference-integrity checking (PRD §64: "Referenced by: N Work Packages...").
  No domain module references `Zone` yet at this point in the build (Requirement and
  Work Package arrive in slices 9–10) — deferred to whichever of those slices
  introduces the first entity that can reference a Zone.
- Configurable/custom zone types (PRD §84) and post-creation metadata editing (rename,
  Markdown links, custom fields) — these flow through the generic Inspector
  edit-to-command pipeline slice 6 already provides; no new architecture is needed
  here to support them.
- Spatial queries over zones (Epic 4) — these read derived data slice 9's quantity
  engine and/or a later query layer produce; not an editing concern.

## Dependencies

- **Slice 2 (Core Primitives)** — `Polygon`, `Point`, geometry operations
  (point-in-polygon, area, perimeter), `Result<T,E>`, `GeometryError`.
- **Slice 3 (Domain Foundation)** — `Zone` entity, `CreateZoneCommand`,
  `MoveSpatialObjectCommand`, `DeleteZoneCommand` as plain `Command<TInput,TResult>`
  implementations; this slice wraps the latter two in slice 6's `UndoableCommand`
  adapters rather than modifying them.
- **Slice 4 (Persistence & Repository Layer)** — `ZoneRepository`, the plan geometry
  sidecar, and the Markdown+sidecar transaction rule (SDD §42).
- **Slice 5 (Canvas Rendering & Editor Shell)** — `ZoneLayer`, `InteractionLayer`,
  `worldToScreen()` / `screenToWorld()`.
- **Slice 6 (Editor Tool Framework)** — `EditorTool`, `EditorContext`,
  `UndoableCommand`, `CommandHistory`, `SnapService`, Transformer normalization, and
  the `ReversibleMoveZoneCommand` adapter this slice's whole-zone-move gesture
  constructs one instance of per drag.
- **Slice 7 (Calibration)** — sibling, not a hard dependency. A `Plan` need not be
  calibrated before a zone can be drawn on it (the two slices can be built in either
  order per the slice map); `screenToWorld()` always produces *some* well-formed world
  point, calibrated or not. What this slice requires is only that the transform is
  well-formed, not that it is calibrated.

## Design

### Drawing a zone — `DrawPolygonTool`

A concrete `EditorTool` with an internal vertex buffer and three states: idle,
drawing, closing.

```text
activate()      → buffer = []
pointerDown()   → world = event.worldPoint; snapped = snapService.snapPoint(world)
                  if snapped is within closing tolerance of buffer[0] and buffer.length >= 3:
                      closePolygon()
                  else:
                      buffer.push(snapped); render vertex + edge preview
pointerMove()   → render a rubber-band preview edge from buffer.last to pointer
                  (InteractionLayer only, per §19 — no domain state touched)
cancel()        → buffer = []; clear preview; no command dispatched
```

`closePolygon()` is the only place this tool talks to the domain:

```text
polygonResult = Polygon.create(buffer)          # slice 2 smart constructor
if polygonResult is Err:
    show inline validation message; stay in drawing state; buffer is NOT cleared
else:
    dispatch CreateZoneCommand({ planId, zoneType, polygon: polygonResult.value })
    on success: buffer = []; selection := new zone id
    on failure: show error; buffer is NOT cleared
```

Keeping the buffer intact on failure means a rejected close never discards the user's
in-progress work — they can keep placing vertices or press cancel deliberately.

Vertex removal mid-draw (e.g. "undo last point" before the shape is closed) is a
reasonable UX affordance but is not required by the SDD and is left to implementation
discretion; it does not appear in the Definition of Done below.

### Selecting a zone — `SelectTool`

First concrete implementation of `SelectTool` (SDD §57), scoped to `Zone` because
`Zone` is the only spatial object type that exists in the domain at this point in the
build (`Asset` arrives in slice 10). Hit-testing is deliberately written against a
generic "spatial objects on the active plan" list so slice 10 can extend the candidate
set later without a parallel select mechanism.

```text
pointerDown() → world = event.worldPoint
                candidates = activePlan.spatialObjects   # linear scan, see below
                hit = first candidate (in reverse z-order) whose Polygon contains world
                if hit: selection.set(hit.id)
                else:   selection.clear()
```

Hit-testing is a linear scan using Core's point-in-polygon test (slice 2), evaluated
topmost-first so visual stacking order matches selection order on overlapping zones.
This is correct at any plan size; it is simply not the fastest approach on a plan with
many hundreds of zones. See "Deferred: spatial index" below.

A selected zone renders, in the `InteractionLayer` (transient only, per §19):

- a body-drag handle (the whole shape, for moving it), and
- one draggable handle per vertex (for reshaping it).

Clicking empty canvas clears the selection. The Inspector reacts to selection through
the pipeline slice 6 already defines (§59: Selection → Inspector Query → Inspector DTO
→ Vue UI) — not redefined here.

### Moving a zone

Dragging the body handle only updates a transient Konva preview while the pointer
moves; domain geometry is untouched mid-drag (§20: normalize before persistence).
`MoveSpatialObjectCommand` (slice 3) takes a full replacement `geometry: Polygon`, not
a delta — "move" collapses to the same whole-geometry-replacement operation slice 3
already defined, matching slice 3's own reasoning for using one command for both move
and resize. On `pointerDown`, this slice captures the zone's current `Polygon` as the
inverse snapshot; on `pointerUp`:

1. Compute the total world-space delta via `screenToWorld()`, and translate every
   vertex of the captured original polygon by it to produce the candidate final
   polygon.
2. Run the candidate polygon's points through `SnapService` (`snapToGrid` /
   `snapToVertex` / `snapToEdge`).
3. Re-validate the translated polygon (translation cannot change vertex count, but the
   result is still passed back through `Polygon.create()` — see Validation below —
   because snap adjustment is arithmetic that must not be trusted blindly).
4. Build one `ReversibleMoveZoneCommand` (slice 6) — the same adapter pattern this
   slice's `ReversibleDeleteZoneCommand` follows — with `forward: { zoneId, geometry:
   candidatePolygon }` and `inverse: { zoneId, geometry: originalPolygon }`, and run it
   through `CommandHistory.run()`.

If `pointerUp` fires with a near-zero delta (a click, not a drag), this is a pure
selection, not a move: no command is dispatched and nothing is pushed onto
`CommandHistory`. This matters — a no-op move must not pollute the undo stack.

`MoveSpatialObjectCommand` itself stays exactly as slice 3 defined it — a plain
`Command<MoveSpatialObjectInput, Result<{ zone: Zone }, ReferenceError | GeometryError
| PersistenceError>>`, never modified to implement `UndoableCommand` directly. This
slice is where it is first driven by real pointer input, wrapped in
`ReversibleMoveZoneCommand` for `CommandHistory` compliance — one drag, one command,
one history entry, per the transaction-boundary rule (§31).

### Editing a single vertex

Only available while a zone is selected and its vertex handles are showing. Dragging
one vertex handle:

1. Updates only the affected edge pair as a transient preview while the pointer moves.
2. On `pointerUp`, converts the handle's final position through `screenToWorld()` and
   `SnapService`, and builds the candidate point list (the polygon's existing points
   with just that one index replaced).
3. Re-validates through `Polygon.create()` on the candidate list. On failure (e.g. the
   transform produced a non-finite point), the handle snaps back to its last valid
   position and no command is dispatched.
4. On success, dispatches `MoveSpatialObjectVertexCommand({ objectId, vertexIndex,
   toPoint })` — a new `UndoableCommand` this slice introduces, alongside `Move`/
   `Delete` in the `spatial-object` command family. `undo()` restores that one vertex's
   prior coordinate; the other vertices are untouched.

Inserting a new vertex mid-edge or removing a vertex (changing the vertex count) is
out of scope — this slice only repositions existing vertices. Nothing here blocks
adding that later as an extension of the same command family.

### Deleting a zone

`ReversibleDeleteZoneCommand` is the first delete-type `UndoableCommand` in the
codebase. Its `execute()` is a thin wrapper around slice 3's plain `DeleteZoneCommand`
(SDD §29 names the general operation `DeleteSpatialObjectCommand`; slice 3 already
named its concrete, Zone-only command `DeleteZoneCommand` — the same "general SDD
name in principle, concrete entity name in this codebase" choice slice 3 made for
`MoveSpatialObjectCommand`, so this slice follows suit rather than introducing a
second, competing delete command under the SDD's general name). Its `undo()` is the
one place in this slice where "undo" means more than replaying an inverse delta
through that same wrapped command — deletion has no natural "delete the opposite
thing" inverse, so `undo()` bypasses the command layer entirely and restores the
snapshot directly through the repository:

```text
execute(): result := deleteZoneCommand.execute({ zoneId })   // slice 3's plain command
           if result.isErr(): return result
           snapshot := full copy of the Zone entity + its sidecar geometry entry,
                       captured BEFORE calling execute() above
           clear selection if it pointed at this zone
           return result

undo():    re-insert the captured snapshot verbatim — same ID, same zone type,
           same points, same schema version — via zoneRepository.save() directly,
           NOT via CreateZoneCommand (which would mint a fresh ID and publish
           ZoneCreated, misrepresenting a restore as a new zone)
```

Undo must resurrect the same entity, not create a new one with a fresh ID. This is a
requirement this slice places on slice 4's repository contract: `save()` must be an
idempotent upsert keyed by entity ID, not insert-only — a command's `undo()` cannot go
through a path that mints new identity.

### Geometry validation (SDD §26)

Two layers, both required, neither optional:

- **Tool-level (fast feedback).** `DrawPolygonTool`, the move handler, and the
  vertex-edit handler all call `Polygon.create()` before they ever construct a command
  input, so a user sees a rejection immediately and no invalid command is dispatched.
- **Domain-level (authoritative).** `Zone`'s own geometry-replacing operation
  re-validates through the same `Polygon.create()` invariant regardless of caller. A
  command handler is not a trusted caller by convention (§3.3 Domain First) — the
  entity protects its own invariant even if a future caller skips the tool layer
  entirely (a script, a migration, a different tool).

What is checked, matching §26's required list exactly:

| Rule | Where enforced |
| --- | --- |
| ≥ 3 vertices | `Polygon.create()` rejects 0, 1, 2 points |
| finite coordinates, no NaN, no Infinity | `Polygon.create()` checks every point |
| valid unit | `DrawPolygonTool` and every zone-editing handler read only `event.worldPoint` (slice 6), never `event.screenPoint` — `Point` (world mm) and `ScreenPoint` (slice 5) are distinct, incompatible types, so passing a screen coordinate to `Polygon.create()` is a compile error, not a runtime bug (slice 6's `EditorPointerEvent`) |
| valid transform | `worldToScreen`/`screenToWorld` (slice 5) do not themselves return a `Result` — a degenerate viewport (e.g. zero zoom) producing a non-finite point is instead caught by `Polygon.create()`'s own finite-coordinate check, the same backstop that catches any other bad input. This slice relies on that backstop rather than adding a second one. |

What is explicitly **not** checked, per §26's own "Future" list, and why that is safe
for this slice's correctness requirement:

- **Self-intersection detection** — a user can draw a bowtie-shaped polygon; it is
  accepted, stored, rendered, and its area/perimeter are computed on it as-is (Core's
  formulas do not require a simple polygon to return *a* number, just not necessarily
  the number a human expects). Increment 6's success criterion is "create and safely
  modify," not "prevent every geometrically awkward shape."
- **Winding normalization** — a zone is stored in whatever winding order it was drawn.
- **Polygon repair** — no automatic correction is attempted.

None of these three block correct create/select/move/edit-vertex/delete behavior; they
are quality-of-result concerns the SDD itself defers.

### Deferred: boolean polygon operations (§27)

No `clipper2-ts` adapter is built in this slice. Nothing in draw, select, move,
vertex-edit, or delete requires union/intersection/difference/offset — all of it runs
on Core's existing point-in-polygon, area, and perimeter primitives (slice 2). When a
future feature needs boolean ops, they arrive through an Infrastructure/Core adapter
per §27 with no Clipper-specific type crossing into Domain or Application; this
slice's `Zone` entity and its commands are not expected to change shape to
accommodate that adapter's eventual arrival.

### Deferred: spatial index (§28)

No `rbush` index is built in this slice. `SelectTool`'s hit-testing is the linear scan
described above — correct at any plan size, just not the fastest at very large ones.
The SDD frames the index purely as an optimization ("correctness must not depend on
it"); this slice takes that literally and ships correct behavior without it. Nothing
in the hit-test design (a plain "candidates for this plan" list) forecloses dropping
an `rbush`-backed candidate prefilter in front of it later.

## Interfaces & Contracts

```typescript
// presentation/editor/tools/DrawPolygonTool.ts
class DrawPolygonTool implements EditorTool {
  readonly id: ToolId = 'draw-polygon';

  activate(context: EditorContext): void;
  deactivate(): void;
  pointerDown(event: EditorPointerEvent): void;
  pointerMove(event: EditorPointerEvent): void;
  pointerUp(event: EditorPointerEvent): void;
  cancel(): void;
}

// presentation/editor/tools/SelectTool.ts
class SelectTool implements EditorTool {
  readonly id: ToolId = 'select';
  // pointerDown hit-tests activePlan spatial objects; pointerMove/pointerUp
  // distinguish click-to-select from drag-to-move/drag-vertex.
}
```

```typescript
// application/commands/zone/CreateZone.ts (slice 3, consumed here verbatim —
// geometry is already validated by the time DrawPolygonTool builds this input,
// see Design/Validation)
interface CreateZoneInput {
  planId: PlanId;
  name: string;
  zoneType: ZoneType;
  geometry: Polygon;
  domainNoteLink?: string;
}
class CreateZoneCommand implements Command<CreateZoneInput, Result<{ zone: Zone }, ValidationError | ReferenceError | GeometryError | PersistenceError>> {
  execute(input: CreateZoneInput): Promise<Result<{ zone: Zone }, ValidationError | ReferenceError | GeometryError | PersistenceError>>;
}

// application/commands/zone/MoveSpatialObject.ts (slice 3, consumed here
// verbatim — a plain Command taking a full replacement geometry, not a delta;
// this slice wraps it in slice 6's ReversibleMoveZoneCommand adapter rather
// than making it implement UndoableCommand directly)
interface MoveSpatialObjectInput { zoneId: ZoneId; geometry: Polygon }
class MoveSpatialObjectCommand
  implements Command<MoveSpatialObjectInput, Result<{ zone: Zone }, ReferenceError | GeometryError | PersistenceError>> { /* … */ }

// application/commands/spatial-object/MoveSpatialObjectVertexCommand.ts (new)
interface MoveSpatialObjectVertexInput {
  objectId: SpatialObjectId;
  vertexIndex: number;
  toPoint: Point;              // world mm, already Polygon.create()-validated
}
class MoveSpatialObjectVertexCommand implements UndoableCommand {
  constructor(input: MoveSpatialObjectVertexInput);
  execute(): Promise<Result<void, ReferenceError | GeometryError | PersistenceError>>;
  undo(): Promise<Result<void, ReferenceError | GeometryError | PersistenceError>>; // restores this vertex's prior point only
}

// application/commands/zone/ReversibleDeleteZoneCommand.ts (new) — wraps slice 3's
// plain DeleteZoneCommand for execute(); undo() bypasses the command layer (see Design)
class ReversibleDeleteZoneCommand implements UndoableCommand {
  constructor(
    private readonly deleteCommand: Command<DeleteZoneInput, Result<{ zoneId: ZoneId }, ReferenceError | PersistenceError>>,
    private readonly zoneRepository: ZoneRepository, // undo()'s direct restore path only
  );
  execute(): Promise<Result<void, ReferenceError | PersistenceError>>; // snapshots, then delegates to deleteCommand
  undo(): Promise<Result<void, PersistenceError>>; // re-inserts snapshot verbatim, same ID
}
```

```typescript
// core/geometry/polygon.ts (slice 2, consumed here)
function createPolygon(points: readonly Point[]): Result<Polygon, GeometryError>;

// domain/zone/zone.ts (slice 3; this slice assumes/extends this method if not
// already present, as the authoritative re-validation layer)
class Zone {
  withGeometry(polygon: Polygon): Result<Zone, GeometryError>;
}
```

Tools never call `ZoneRepository` or any Obsidian API directly (§58) — every path
above ends at `context.commandDispatcher.dispatch(...)`, consistent with the layer
dependency rule (Presentation → Application → Domain).

## Persistence Impact

- **Create**: writes a new Markdown note (zone metadata: id, zone type, schema
  version) and appends one entry (`id`, `type: "polygon"`, `points`) to the plan's
  geometry sidecar (§39–40). Both writes are one logical transaction per §42 — this
  slice triggers that path via `CreateZoneCommand`; it does not redefine it.
- **Move / vertex edit**: rewrites only the sidecar's `points` array for that object's
  entry. The Markdown note is not touched — a drag or a vertex nudge must not churn
  the note's file mtime or frontmatter on every gesture.
- **Delete**: removes the Markdown note and the sidecar entry together. Undo requires
  the repository's `save()` to be an ID-keyed upsert (see Design) so the resurrected
  zone is the same entity, not a new one with the same visible content.
- No new persistent schema is introduced by this slice — it uses the `Zone` entity
  schema and the geometry sidecar schema exactly as slice 3/4 defined them.

## Testing Strategy

- **Unit (Core/domain, no Obsidian/Vue/Konva)**:
  - `Polygon.create()` boundary table: 0/1/2/3 points, a point with `NaN`, a point
    with `Infinity`, a well-formed polygon.
  - Point-in-polygon hit test: inside, outside, on an edge, on a vertex.
  - `Zone.withGeometry()` rejects what `Polygon.create()` rejects, independent of any
    tool-level check (proves the domain does not trust its caller).
  - Every command's `execute()` → `undo()` pair is a true inverse: state after
    `undo()` is identical to state before `execute()`.
- **Application tests (in-memory repositories, per §71)**:
  `CreateZoneCommand → InMemoryZoneRepository → assertions`; `ReversibleMoveZoneCommand`
  and `MoveSpatialObjectVertexCommand` roundtrips; `ReversibleDeleteZoneCommand`
  roundtrip asserting the resurrected zone has the same ID, not a new one.
- **Repository contract tests (§72)**: extend the shared suite (reused, not
  duplicated) with zone-geometry sidecar cases — add entry, update entry, remove
  entry — run against both `InMemory` and the Obsidian-backed repository.
- **Component tests (Vue, §73)**: `DrawPolygonTool` driven by simulated pointer
  sequences produces the expected vertex buffer and dispatches exactly one
  `CreateZoneCommand` on close; `SelectTool` hit-testing against a fixture of
  overlapping zones resolves ties by z-order; Inspector shows the selected zone's
  Core-derived length/area (not a Quantity/Cost figure — that is slice 9).
- **Canvas tests (§74)**: Transformer normalization (slice 6) exercised for the first
  time on a non-rectangular shape — confirm normalized command input never carries
  `scaleX`/`scaleY` (§20).
- **E2E (PRD §101)**: create zone → persist/reload; select → move → undo; select →
  edit vertex → undo; select → delete → undo.
- **Explicitly not tested here** (nothing to test — not built): self-intersection
  rejection, `clipper2-ts` adapter behavior, `rbush` index performance.

## Definition of Done

1. Drawing ≥ 3 vertices and closing the shape produces a persisted `Zone` — Markdown
   note plus sidecar geometry entry — that survives a plugin unload/reload.
2. Attempting to close a polygon with fewer than 3 vertices, or with any non-finite
   coordinate, is rejected before `CreateZoneCommand` is ever dispatched; no invalid
   geometry reaches the sidecar.
3. Clicking an existing zone selects it and shows its vertex handles; clicking empty
   canvas clears the selection.
4. Dragging a selected zone's body — regardless of how many `pointermove` events
   fired — produces exactly one `ReversibleMoveZoneCommand` and one `CommandHistory`
   entry; pressing undo restores the exact prior point set.
5. Dragging one vertex handle produces exactly one `MoveSpatialObjectVertexCommand`
   per gesture; undo restores that vertex's exact prior coordinate without altering
   any other vertex.
6. Deleting a selected zone removes both its Markdown note and its sidecar geometry
   entry; **pressing undo immediately afterward restores the zone exactly** — same
   ID, same zone type, byte-identical geometry — verified by comparing pre-delete and
   post-undo state in a test.
7. All of the above passes with `clipper2-ts` and `rbush` absent from the dependency
   graph entirely — zero boolean-geometry calls, zero spatial-index lookups, on any of
   the six paths above.
8. Vitest coverage exists for the §26 validation boundary table and for every
   command's `execute()`/`undo()` pair listed in Testing Strategy.

## References

- SDD §16 Spatial Rendering Architecture, §19 Interaction Layer, §20 Selection and
  Transformation, §21 Snapping Architecture, §22 Geometry Core, §23 World Coordinate
  System, §24 Viewport Transform.
- SDD §26 Geometry Validation (required rules and deferred "Future" list — this
  slice's central reference).
- SDD §27 Advanced Polygon Operations (`clipper2-ts`) — explicitly deferred.
- SDD §28 Spatial Index (`rbush`) — explicitly deferred, "optimization only."
- SDD §29 Command Architecture, §30 Undoable Editor Commands, §31 Transaction
  Boundary.
- SDD §39 Sidecar Files, §40 Plan Sidecar Schema, §42 Persistence Consistency.
- SDD §56 Editor Tool Architecture, §57 Initial Editor Tools, §58 Editor Context, §59
  Inspector Architecture.
- SDD §64 Error Model, §65 Result Pattern, §66 Error Boundary.
- SDD §91 Increment 6 — Zone Editing (success criterion this slice satisfies).
- SDD §92 Architecture Completion Criteria, items 5, 8, 10, 11, 12.
- SDD ADR-002 (JSON sidecar for plan geometry), ADR-006 (plain TypeScript domain),
  ADR-007 (command-based mutations), ADR-009 (world coordinates in millimeters).
- PRD §8 Core Entities (Zone), §15 Epic 4 — Zones & Spatial Objects, §59 Entity
  Relationship Rules, §63 Reference Integrity, §64 Deletion Semantics (deferred
  aspect — see Out of scope), §68 Undo/Redo Architecture, §85 Command Model, §101
  E2E Tests.
- `docs/design/README.md` — slice map and shared conventions.

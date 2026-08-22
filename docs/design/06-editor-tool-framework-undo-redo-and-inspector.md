# Design Slice 6: Editor Tool Framework, Undo/Redo & Inspector

## Purpose

Slice 5 renders persisted domain geometry read-only. This slice turns the canvas into an
editor: a shared framework that converts pointer gestures into domain commands, one
undo-stack entry per gesture, and a selection-driven Inspector panel — built once so
every concrete tool (Calibration in slice 7, Zone Editing in slice 8, and future tools)
reuses the same gesture-to-command pipeline instead of each tool reinventing undo
semantics, Transformer normalization, or snapping.

Nothing in this slice draws a shape or edits a zone. It defines the machinery a
concrete tool plugs into.

## Scope

### In scope

- The `EditorTool` interface and the tool-switching lifecycle (one active tool at a
  time; clean `deactivate()`/`activate()` on switch).
- `EditorContext`: the controlled surface a tool receives (viewport, selection, snap
  service, command dispatcher, render state, active plan) and nothing else.
- `UndoableCommand` and `CommandHistory` (undo/redo stacks), as the editor-gesture
  extension of slice 3's plain `Command<TInput, TResult>`.
- The transaction boundary rule, enforced structurally: one gesture → one command → one
  history entry → one persistence operation.
- `SelectionStore`: selection expressed as domain IDs, never Konva node references.
- The Transformer normalization pipeline: `scaleX`/`scaleY` → true domain geometry,
  before that geometry ever reaches a command.
- `SnapService` as a single editor-level service (`snapPoint`, `snapRotation`,
  `snapResize`, `snapToGrid`, `snapToVertex`, `snapToEdge`).
- Inspector architecture: selection → query → DTO → Vue UI → edit → command.
- The initial tool roster (`SelectTool`, `PanTool`, `DrawPolygonTool`, `PlaceAssetTool`,
  `MeasureTool`, `AnnotationTool`) named as conformance targets for this framework —
  what each demands of it, not how each draws.

### Out of scope (covered by other slices)

- The read-only Konva stage, layers, and viewport pan/zoom rendering — slice 5.
- `DrawPolygonTool`'s and `SelectTool`'s actual zone-editing behavior, vertex editing,
  and `CreateZoneCommand`/`MoveSpatialObjectCommand` business logic — slice 8.
- Calibration's own tool logic and `CalibratePlanCommand` — slice 7.
- Repository writes, sidecar schema, and Zod validation behind a command handler —
  slice 4.
- Domain entities and their command handlers' business rules — slice 3.
- Event-driven recalculation (`ZoneGeometryChanged` → `RequirementRecalculated` →
  `CostEstimateChanged`) — slice 9.

## Dependencies

- Slice 5 (Canvas Rendering & Editor Shell) — Konva stage/layers and the
  `worldToScreen`/`screenToWorld` viewport transform this slice's `EditorContext` reads.
- Slice 4 (Persistence & Repository Layer) — the repository writes a command handler
  performs; tools never see repositories, only the command dispatcher.
- Slice 3 (Domain Foundation) — the plain `Command<TInput, TResult>` contract and the
  Zone entity that editor commands wrap.
- ADR-003 (Konva as Canvas Renderer) — Transformer `scaleX`/`scaleY` normalization.
- ADR-005 (Pinia for Presentation State) — selection as IDs, stores as non-canonical.
- ADR-007 (Command-Based Mutations) — the undoable-command contract this slice
  implements.
- ADR-008 (Event-Aware Architecture) — commands built here are the events' origin
  point, though event handling itself is slice 9.
- ADR-009 (World Coordinates in Millimeters) — the units domain geometry must be in
  once normalized.

## Design

### Tool lifecycle

Exactly one `EditorTool` is active at a time, owned by `EditorStore` (the Pinia store
slice 5 scaffolds; this slice defines its tool-switching and history responsibilities).
Switching tools always calls, in order: the outgoing tool's `cancel()` (if a gesture is
mid-flight) then `deactivate()`, then the incoming tool's `activate(context)`. A tool
must leave no transient render state behind when deactivated.

`EditorPointerEvent` carries world-space coordinates already passed through
`screenToWorld()` (never raw screen pixels — ADR-009), plus button/modifier state and
an optional hit-tested target ID. Tools never read Konva's native event directly.

`cancel()` exists so a gesture (drag, in-progress polygon, active resize) can be
abandoned — typically on `Escape` or on tool switch — by discarding transient render
state, with no command ever dispatched.

### EditorContext — the controlled surface

Per SDD §58, `EditorContext` is the entire API a tool gets. It deliberately excludes
repositories, the event bus, and raw Konva node access:

```text
EditorContext
├── viewport         read-only: worldToScreen/screenToWorld, current pan/zoom
├── selection         SelectionStore accessor (get/set/clear domain IDs)
├── snapService        the shared SnapService instance
├── commandDispatcher  the single choke point into the domain
├── renderState        transient visuals: hover, preview, marquee, snap guides
└── activePlan         read-only reference to the open Plan (id, calibration, units)
```

`viewport` is read-only for every tool except `PanTool`, which mutates pan/zoom
directly through an explicit `setPan`/`setZoom` API rather than a command — camera
position is ephemeral UI state (SDD §15), not a domain change, so it is never
undoable and never dispatched as a command. (SDD is silent on this point; treating
pan/zoom as outside the undo stack is this slice's assumption, consistent with §15
listing "drag state" and "active tool" as ephemeral, not domain, state.)

`activePlan` gives a tool the current plan ID and calibration without a repository
call — it reads the already-loaded Pinia working copy, matching ADR-005 (Pinia holds
derived/working copies, never canonical data, but tools may read it).

### Undoable commands and command history

Slice 3 defines the plain application command:

```typescript
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}
```

Editor gestures need a reversible form. Per SDD §30:

```typescript
interface UndoableCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}
```

An `UndoableCommand` is a thin adapter around a slice-3 domain command, capturing
enough state at gesture end to compute an inverse:

```typescript
class ReversibleMoveZoneCommand implements UndoableCommand {
  constructor(
    private readonly moveCommand: Command<MoveSpatialObjectInput, void>,
    private readonly forward: MoveSpatialObjectInput,   // captured at pointerUp
    private readonly inverse: MoveSpatialObjectInput,    // captured at pointerDown
  ) {}

  execute(): Promise<void> {
    return this.moveCommand.execute(this.forward);
  }

  undo(): Promise<void> {
    return this.moveCommand.execute(this.inverse);
  }
}
```

`CommandHistory` holds the stacks (SDD §30):

```text
CommandHistory
  undoStack: UndoableCommand[]
  redoStack: UndoableCommand[]

  run(command)   → result = await command.execute()
                 → if result.isErr(): return result — undoStack/redoStack untouched
                 → push command to undoStack, clear redoStack, return result
  undo()         → pop undoStack, command.undo(), push to redoStack
  redo()         → pop redoStack, command.execute(), push to undoStack
```

Every `UndoableCommand.execute()` resolves to a `Result`, per ADR-007/SDD §29 — it
never rejects for an expected domain or persistence failure (only an unexpected
technical fault throws, per SDD §65). "After `execute()` resolves" is therefore not
enough to gate the stacks on: a resolved `Result.err` (a handler-level validation
error, a persistence failure from slice 4) must be inspected explicitly and is never
pushed to `undoStack` — `run()` checks `isErr()` before touching either stack, not
just after the promise settles.

`CommandHistory` is scoped per open Plan and lives in `EditorStore`; it is not
persisted (SDD §15 — ephemeral) and does not survive a plugin reload or switching
plans. Stack depth is unbounded in this design; the SDD does not specify a cap, so an
explicit depth limit is an assumption left for whichever slice tunes memory behavior,
not required here.

### Transaction boundary

SDD §31's rule, generalized beyond the one example it gives:

```text
pointerDown  → capture "before" state (no command, no history entry)
pointerMove* → update renderState only (preview shape, snap guide) — never dispatch
pointerUp    → build ONE UndoableCommand from before/after state
             → CommandHistory.run(command)
             →   command.execute()
             →     domain command handler (slice 3)
             →       repository write (slice 4)   ← ONE persistence operation
```

The anti-pattern this rule forbids: a command dispatch inside `pointerMove`. A
100-move drag must still produce exactly one command execution and one history entry,
matching ADR-007's "one user intent, one logical transaction." This is the load-bearing
rule this slice's Definition of Done and tests check directly.

The same boundary applies to Inspector edits (see below): a field commits on
blur/enter/change-complete, not per keystroke.

### Selection and Transformer normalization

`SelectionStore` holds only domain IDs (ADR-005):

```typescript
interface SelectionStore {
  selectedIds: readonly DomainId[];
  select(ids: DomainId[]): void;
  clear(): void;
  isSelected(id: DomainId): boolean;
}
```

No Konva node, ref, or shape ever appears in this store. The presentation layer (owned
by slice 5's render-model lookup) separately maps a selected domain ID to the Konva
node it renders as, purely to attach a `Konva.Transformer` for visual handles — that
lookup is a rendering concern, not editor state.

Konva's Transformer reports resize/rotate results as `scaleX`/`scaleY` multipliers on
the node, not true width/height (ADR-003). Per SDD §20, the pipeline before any
command input is:

```text
Konva Transform (x, y, rotation, scaleX, scaleY)
      ↓
Normalize Transform  (baseWidth * scaleX, baseHeight * scaleY → true mm dimensions;
                       reset node's scaleX/scaleY to 1 after reading)
      ↓
Domain Geometry (Polygon / BoundingBox, world millimeters)
      ↓
Command input (e.g. ResizeSpatialObjectCommand's width/height fields)
```

This normalization is a pure function — `normalizeTransformerResult(transform,
baseGeometry): DomainGeometry` — taking plain numbers in and out, so it is unit-tested
without instantiating a real Konva node or stage. `scaleX`/`scaleY` must never appear
in a command's input type or in any persisted entity (ADR-003, ADR-009); the
normalization function is the only place that reads them, and it runs synchronously in
the Transformer's `transformend` handler, before `pointerUp` builds the command.

### SnapService

Implemented once as an editor-level service (SDD §21), not per-tool:

```typescript
interface SnapService {
  snapPoint(point: Point, candidates: SnapCandidates): Point;
  snapRotation(angleRadians: number): number;
  snapResize(box: BoundingBox, handle: TransformerHandle): BoundingBox;
  snapToGrid(point: Point): Point;
  snapToVertex(point: Point, candidates: readonly Point[]): Point | null;
  snapToEdge(point: Point, candidates: readonly LineSegment[]): Point | null;
}
```

Any tool that needs snapping calls `context.snapService` during both `pointerMove`
(to compute the snapped preview point written to render state) and `pointerUp` (to
compute the final committed point) — always the same function, so the preview a user
sees during a drag is guaranteed to match what gets committed; no separate
preview-only snap math is allowed to drift from the committed-value snap math.

`snapToVertex`/`snapToEdge` need nearby geometry to snap against; the service reads
candidate points/edges the calling tool supplies (sourced from the active plan's
already-loaded zones via `EditorContext.activePlan`, never a direct repository query).
Grid spacing and snap tolerance are editor preferences (SDD §15 — settings, not
persistent domain data). Snap guides themselves are transient-only render output
(SDD §19), drawn from `renderState` and never persisted.

### Inspector

Per SDD §59:

```text
Selection → Inspector Query → Inspector DTO → Vue UI → edit → Command
```

`InspectorStore` (Pinia) derives its current DTO from `SelectionStore` plus a
read-only application-layer query (not a repository call) against the selected
entity/entities:

- Empty selection → no DTO, Inspector panel shows nothing to edit.
- Single selection → an entity-specific DTO (e.g., a `ZoneInspectorDTO` carrying name,
  computed area, construction section, and other zone-specific fields).
- Multi-selection → this slice defines only the DTO contract's shape for it (a
  reduced/common-fields DTO, or "disabled" when selected entities are of different
  types); the actual bulk-edit UX is left to whichever slice needs it (most likely
  slice 8), since the SDD does not specify multi-select Inspector behavior. Flagged
  as an assumption, not a decision this slice locks in.

Edits become commands through the same single choke point tools use — the Inspector
does not get its own separate dispatch path. A field edit (e.g., renaming a zone) is
captured on blur/enter, not per keystroke, then wrapped the same way a pointer gesture
is: one `UndoableCommand`, e.g. `UpdateZonePropertiesCommand`-shaped, pushed through
`CommandHistory.run()`. This means an Inspector edit is undoable exactly like a canvas
drag, and `InspectorStore` needs access to the same `CommandHistory`/dispatcher
instance `EditorContext` hands to tools (wired at the composition root, slice 1).

### Initial tool roster — framework fitness, not tool logic

SDD §57 names six tools this framework must support. Each is listed here only for what
it demands of the framework above; the tools themselves belong to slices 7, 8, and
later feature work:

| Tool | What it needs from this framework |
| --- | --- |
| `SelectTool` | selection get/set, Transformer attach/detach on selected node(s), normalization on `transformend`, move via drag → `MoveSpatialObjectCommand` |
| `PanTool` | direct viewport mutation, no command, no history entry (ephemeral camera state) |
| `DrawPolygonTool` | multi-click vertex accumulation via `renderState` (transient preview polygon), one `CreateZoneCommand`-shaped command on completion |
| `PlaceAssetTool` | single click → one placement command; snapping via `SnapService` |
| `MeasureTool` | read-only overlay using `viewport`/`snapService`; may not dispatch any command at all if a measurement is purely informational and not persisted — an assumption, since SDD §15's ephemeral list does not explicitly name "measurement," but nothing in the SDD describes a persisted measurement entity either |
| `AnnotationTool` | click/drag → one annotation-placement command |

`WallTool`, `OpeningTool`, `PathTool`, `BooleanTool` are explicitly future (SDD §57)
and are not designed against here; the fitness check this slice cares about is that
`EditorTool`/`EditorContext` need no structural change to add them later — no
tool-specific branching belongs inside `ToolManager` or `EditorContext` itself.

## Interfaces & Contracts

```typescript
// presentation/editor/viewport/screen-point.ts — deliberately NOT exported
// from core/geometry (slice 2 never sees a pixel). A screen coordinate is a
// distinct, incompatible type from Point (always world millimeters), so a
// tool cannot pass a screen pixel where domain geometry is expected and have
// it type-check: the brand makes them structurally different, not just
// differently named.
interface ScreenPoint { readonly x: number; readonly y: number; readonly __brand: 'ScreenPoint'; }

// presentation/editor/tools/editor-tool.ts
type ToolId = 'select' | 'pan' | 'draw-polygon' | 'place-asset' | 'measure' | 'annotation';

interface EditorPointerEvent {
  worldPoint: Point;          // world mm — already through screenToWorld(); this
                               // is what every domain/geometry call must consume
  screenPoint: ScreenPoint;   // raw pixels — for rendering-layer use only
                               // (e.g. positioning an on-screen tooltip); passing
                               // this to Polygon.create() or any Core geometry
                               // function is a compile error, not a runtime bug
  button: 'primary' | 'secondary' | 'auxiliary';
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  targetId: DomainId | null;  // hit-tested render-model target, if any
}

interface EditorTool {
  readonly id: ToolId;
  activate(context: EditorContext): void;
  deactivate(): void;
  pointerDown(event: EditorPointerEvent): void;
  pointerMove(event: EditorPointerEvent): void;
  pointerUp(event: EditorPointerEvent): void;
  cancel(): void;
}

// presentation/editor/tools/editor-context.ts — this is the actual home of
// worldToScreen/screenToWorld (slice 2 explicitly excludes pixels from Core;
// slice 7 only supplies the calibration input — pixelsPerWorldUnit — that
// parameterizes these, it does not define them). Bound to the live pan/zoom
// state slice 5's Konva stage maintains.
interface EditorContext {
  readonly viewport: {
    worldToScreen(p: Point): ScreenPoint;
    screenToWorld(p: ScreenPoint): Point;
    setPan(delta: Vector): void;   // PanTool only; not a command
    setZoom(factor: number, origin: ScreenPoint): void;
  };
  readonly selection: SelectionStore;
  readonly snapService: SnapService;
  readonly commandDispatcher: { run(command: UndoableCommand): Promise<void> };
  readonly renderState: RenderState;
  readonly activePlan: { id: DomainId; calibration: PlanCalibration; units: 'mm' };
}

// presentation/editor/selection/selection-store.ts
interface SelectionStore {
  readonly selectedIds: readonly DomainId[];
  select(ids: DomainId[]): void;
  clear(): void;
  isSelected(id: DomainId): boolean;
}

// application ports consumed here, defined in slice 3
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}

// presentation/editor/tools/undoable-command.ts
interface UndoableCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

interface CommandHistory {
  run(command: UndoableCommand): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  clear(): void;
}

// presentation/editor/snapping/snap-service.ts
interface SnapService {
  snapPoint(point: Point, candidates: SnapCandidates): Point;
  snapRotation(angleRadians: number): number;
  snapResize(box: BoundingBox, handle: TransformerHandle): BoundingBox;
  snapToGrid(point: Point): Point;
  snapToVertex(point: Point, candidates: readonly Point[]): Point | null;
  snapToEdge(point: Point, candidates: readonly LineSegment[]): Point | null;
}

// presentation/editor/selection/normalize-transform.ts
function normalizeTransformerResult(
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  baseGeometry: BoundingBox,
): BoundingBox; // world millimeters; scaleX/scaleY never appear past this call

// presentation/editor/inspector/inspector-store.ts
type InspectorDto =
  | { kind: 'empty' }
  | { kind: 'zone'; id: DomainId; name: string; areaMm2: number /* ...zone-specific fields */ }
  | { kind: 'multiple'; ids: readonly DomainId[] }; // shape only; behavior left open, see Design

interface InspectorStore {
  readonly dto: InspectorDto;
  commit(edit: Record<string, unknown>): Promise<void>; // → UndoableCommand → CommandHistory.run
}
```

File layout (per SDD §77, `src/presentation/editor/`):

```text
presentation/editor/
├── canvas/       (slice 5 — stage/layers, out of scope here)
├── layers/       (slice 5 — out of scope here)
├── tools/        editor-tool.ts, editor-context.ts, tool-manager.ts, undoable-command.ts,
│                 command-history.ts, [tool files added by slices 7/8+]
├── snapping/     snap-service.ts
├── selection/    selection-store.ts, normalize-transform.ts
└── inspector/    inspector-store.ts, inspector queries
```

## Persistence Impact

None new. This slice introduces no repositories, no sidecar fields, and no schema.
Its entire job is ensuring that domain commands — defined in slice 3, persisted by
handlers built in slice 4 — are invoked exactly once per completed user gesture or
committed Inspector edit, via `CommandHistory` and the transaction boundary rule.

Everything this slice adds to Pinia (`SelectionStore`, `EditorStore`'s active tool and
`CommandHistory` stacks, `InspectorStore`'s current DTO) is ephemeral presentation
state per ADR-005 and SDD §15: none of it is canonical, none of it is written to the
Vault directly, and all of it is lost on reload — including the undo/redo stacks,
which are not persisted across a plugin reload or a Plan switch. This is an explicit
assumption, since the SDD does not state whether undo history should survive a reload;
treating it as ephemeral is the simpler default consistent with "Pinia is not the
persistent source of truth" and is the only state on §15's ephemeral list that dragging
and tool-switching directly touch.

## Testing Strategy

- **`CommandHistory` unit tests** — push/undo/redo/clear against fake `UndoableCommand`
  doubles; assert a new `run()` after an `undo()` clears the redo stack; assert a
  command whose `execute()` **resolves to `Result.err`** (not a rejected promise —
  this is the case that matters, since domain/persistence failures never reject) is
  never pushed to `undoStack`, and that `run()` returns that same `Result.err` to its
  caller. No Konva, no Obsidian.
- **`normalizeTransformerResult` unit tests** — table-driven over plain
  `{x, y, rotation, scaleX, scaleY}` + base geometry inputs; assert the output never
  contains a `scaleX`/`scaleY` field and that `scaleX: 2, scaleY: 1` on a 1000×500mm
  base box normalizes to a 2000×500mm box.
- **`SnapService` unit tests** — each method (`snapToGrid`, `snapPoint`,
  `snapToVertex`, `snapToEdge`, `snapResize`, `snapRotation`) as a pure function over
  domain geometry fixtures, independent of any live canvas.
- **Gesture-to-command integration test** (component-level, per SDD §73–74's Vue/Konva
  test approach) — simulate `pointerDown` → N × `pointerMove` → `pointerUp` against a
  test-double `EditorTool`; assert exactly one `CommandHistory.run()` call and exactly
  one handler invocation, regardless of N.
- **Architecture/contract test** — assert `EditorContext`'s type surface exposes no
  repository or Obsidian Vault API (extends SDD §76's architecture test rules).
- **`ScreenPoint`/`Point` type-safety check** — a compile-time-only test file (e.g.
  `// @ts-expect-error`) asserting that `Polygon.create(event.screenPoint)` and
  `Zone.withGeometry({ points: [event.screenPoint] })` fail to type-check, while the
  `event.worldPoint` equivalents compile. This is what makes the screen/world
  distinction a real guarantee rather than a naming convention a future edit could
  quietly erode.
- **Inspector commit test** — simulate several keystrokes into a bound field, then
  blur; assert exactly one command dispatch, not one per keystroke.

## Definition of Done

1. `EditorTool` and a working `ToolManager` exist; switching the active tool calls the
   outgoing tool's `deactivate()` and the incoming tool's `activate(context)` exactly
   once each, and calls `cancel()` first if a gesture was in progress.
2. A simulated full gesture (`pointerDown` → several `pointerMove` → `pointerUp`)
   against a test-double tool produces exactly one `UndoableCommand` execution, one
   `CommandHistory` entry, and (through slice 4's handler) one persistence write — not
   one write per `pointerMove`.
3. Undoing that entry restores prior domain state; redoing reapplies it; dispatching a
   new command after an undo clears the redo stack.
4. A simulated Transformer resize/rotate never allows a `scaleX`/`scaleY` value to
   reach a command's input type or a persisted entity — asserted directly in the
   normalization test, not just implied by code review.
5. A command whose `execute()` resolves to `Result.err` (simulated validation or
   persistence failure) is never pushed to `undoStack`, produces no redo-stack
   entry, and `CommandHistory.run()` returns the same `Result.err` to its caller —
   asserted against a resolved error `Result`, not a rejected promise.
5. `SelectionStore`'s type contains only domain IDs; no Konva node/ref type is
   reachable from it, checked by the architecture/contract test.
6. `SnapService` is a standalone, injectable implementation of all six SDD §21 methods,
   unit-tested without a live canvas.
7. Selecting a fixture entity produces an Inspector DTO; committing an edited field
   dispatches exactly one command through the same `CommandHistory` tools use.
8. `EditorContext`'s type surface contains no repository or Obsidian Vault API.
9. No tool-specific branching exists inside `ToolManager` or `EditorContext` — adding a
   future tool (e.g. `WallTool`) requires only a new `EditorTool` implementation, not a
   framework change.

## References

- SDD §14 (State Management), §15 (Persistent vs Ephemeral State) — Pinia store roles
  and the ephemeral-state list this slice's stores fall under.
- SDD §19 (Interaction Layer) — transient-only render output (selection handles, snap
  guides, previews, transform controls).
- SDD §20 (Selection and Transformation) — the Konva Transform → Normalize → Domain
  Geometry → Command pipeline.
- SDD §21 (Snapping Architecture) — the `SnapService` method set.
- SDD §29 (Command Architecture) — the plain `Command<TInput, TResult>` this slice
  extends, not redefines.
- SDD §30 (Undoable Editor Commands) — `UndoableCommand` and `CommandHistory`.
- SDD §31 (Transaction Boundary) — one gesture, one command, one history entry, one
  persistence operation.
- SDD §56 (Editor Tool Architecture) — the `EditorTool` interface.
- SDD §57 (Initial Editor Tools) — the six-tool roster and the four future tools.
- SDD §58 (Editor Context) — the controlled surface tools receive.
- SDD §59 (Inspector Architecture) — selection → query → DTO → UI → command.
- SDD §77 (Proposed Repository Structure) — `presentation/editor/` subfolder layout.
- ADR-003 — Konva as Canvas Renderer (Transformer `scaleX`/`scaleY` normalization).
- ADR-005 — Pinia for Presentation State (selection as IDs, non-canonical stores).
- ADR-007 — Command-Based Mutations (the undoable-command contract).
- ADR-008 — Event-Aware Architecture (commands as the origin point for events handled
  in slice 9).
- ADR-009 — World Coordinates in Millimeters (units normalized geometry must be in).

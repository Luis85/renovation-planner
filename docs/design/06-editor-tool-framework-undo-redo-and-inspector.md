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
- `ReversibleMoveZoneCommand`, the first concrete adapter over a slice-3 command — a
  deliverable of this slice, not merely an illustration, since slice 8 constructs one
  per drag gesture and would otherwise have to author the adapter pattern itself.
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

- Slice 2 (Core Primitives) — `Point`, `EntityId`, `Result` (with its `ok`/`err`/
  `isOk`/`isErr` functions), and `AppError`; every `Result`-returning signature in this
  slice (`UndoableCommand`, `CommandHistory`, `InspectorStore.commit`) resolves to
  `Result<void, AppError>` from slice 2, not a bespoke error type of its own.
- Slice 5 (Canvas Rendering & Editor Shell) — Konva stage/layers, and the `ScreenPoint`
  type plus the `worldToScreen`/`screenToWorld` pair, all **imported** from
  `presentation/editor/viewport/` where slice 5 declares them. This slice declares none
  of the three: a second structurally identical `ScreenPoint` would satisfy every
  signature below while guaranteeing nothing, which is the one failure mode the brand
  exists to prevent.
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
└── activePlan         read-only reference to the open Plan (id, nullable calibration)
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

Editor gestures need a reversible form. Per SDD §30, adapted to this codebase's
`Result`-returning commands (SDD §30's own sketch predates slice 3's correction that
commands resolve a `Result`, never a bare value — see the note on `run()`/`undo()`/
`redo()` below). `UndoableCommand` is declared once, in **Interfaces & Contracts** —
two `execute()`/`undo()` methods, each resolving `Promise<Result<void, AppError>>`. It is
not repeated here: this document had three types written out twice apiece, and the copies
had already drifted (one `readonly` present in one copy only), so every shared type in
this slice is declared in that one block and referenced from the prose.

An `UndoableCommand` is a thin adapter around a slice-3 domain command, capturing
enough state at gesture end to compute an inverse. The adapter discards the wrapped
command's success payload (`{ zone }`) and passes a failed `Result` through unchanged,
since `UndoableCommand`'s callers (`CommandHistory`) only need to know whether the
stacks should be touched, not the returned entity:

```typescript
class ReversibleMoveZoneCommand implements UndoableCommand {
  // Whether this adapter has written at all. The first execute() is the user's gesture
  // and carries no expectation; every operation after it is conditional. What it is
  // conditional ON is not this adapter's own last write but the ledger's — see
  // "The expectation is the history's, not the adapter's" below.
  private hasWritten = false;

  constructor(
    private readonly moveCommand: Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | PersistenceError>>,
    private readonly ledger: WriteLedger,               // from EditorContext, shared with CommandHistory
    private readonly forward: MoveSpatialObjectInput,   // captured at pointerUp
    private readonly inverse: MoveSpatialObjectInput,    // captured at pointerDown
  ) {}

  async execute(): Promise<Result<void, AppError>> {
    // The first execute() is the user's gesture and carries no expectation; every
    // later one is a redo and expects what the history last wrote.
    return this.dispatch(this.forward);
  }

  async undo(): Promise<Result<void, AppError>> {
    return this.dispatch(this.inverse);
  }

  private async dispatch(input: MoveSpatialObjectInput): Promise<Result<void, AppError>> {
    const expected = this.hasWritten ? this.ledger.lastWritten(input.zoneId) : null;
    const result = await this.moveCommand.execute(
      expected === null ? input : { ...input, expected },
    );
    if (isErr(result)) return result;
    this.hasWritten = true;
    this.ledger.record(input.zoneId, result.value.zone.version); // read for one field, then discarded
    return ok(undefined);
  }
}
```

### An inverse is conditional on the write it inverts

`undo()` above passes an expectation rather than replaying the captured input plainly,
and that is a rule for every adapter, not a detail of this one:

> **A reversible adapter presents, on every operation after its first, the revision this
> editor's own history last wrote for the entity it is touching.**

The reasoning is the difference between what a forward gesture means and what an inverse
means. A user dragging a shape is looking at it and asserting where it should now be; if
another tab moved it a moment ago, that assertion still stands, so a first `execute()`
carries no expectation and is last-writer-wins. `undo()` asserts something else entirely
— *put this back to how it was, because nothing has happened since* — and that premise is
false the instant another writer touches the Zone. Replaying the captured "before"
polygon unconditionally does not undo A's move; it silently discards B's.

Serialization does not cover this, and it is worth being explicit about why, because it
looks like it should. Slice 4's per-plan and per-entity queues make writes *ordered*;
ordering says B's write and A's undo do not interleave, and says nothing about whether
B's write happened. Only a comparison against a specific prior state can distinguish
"unchanged since I wrote it" from "changed, in order, by someone else."

Redo has the same premise and gets the same treatment by construction: `execute()` and
`undo()` share one `dispatch`, so redo expects what undo left, undo expects what the
gesture wrote, and the chain never re-reads to find a revision — re-reading to discover
what to expect is the check-then-act this design refuses everywhere.

### The expectation is the history's, not the adapter's

The rule says *this editor's own history last wrote*, and the word doing the work is
**history**. An earlier draft of this design said *this adapter's own previous write*,
which is wrong, and wrong in a way that only shows up once two commands touch one entity
— which is the ordinary case, not an exotic one:

```text
move zone Z     execute() → no expectation → writes V1   (adapter A remembers V1)
rename zone Z   execute() → no expectation → writes V2   (adapter B remembers V2)
undo rename     expects V2, holds          → writes V3   (adapter B remembers V3)
undo move       expects V1 … against V3    → REFUSED
```

Nothing foreign happened. Every write was this plugin's, in order, and the last one is
the state the user is looking at — yet adapter A's private memory has gone stale, the
undo is refused as a revision conflict, and per the failed-undo rule above the command
stays on `undoStack`, where **every retry fails identically**. A user who moves a zone,
renames it, and presses undo twice reaches an undo that can never succeed.

The premise the expectation encodes is "nothing has happened since", and a per-adapter
field cannot evaluate it: an adapter knows what *it* wrote and is blind to its siblings.
The history is not blind — it dispatched all of them. So the memory moves there:

```text
WriteLedger  (application layer; one instance per CommandHistory, same lifetime)
  lastWritten(id: EntityId): EntityVersion | null
  record(id: EntityId, version: EntityVersion): void
```

It advances on exactly one event — a write this history dispatched and that succeeded —
so it distinguishes the two cases the adapter could not tell apart:

- **A sibling command in this history wrote in between.** The ledger advanced, the
  expectation presented is current, and the undo applies. The walked example above
  becomes `undo move → expects V3 → writes V4`.
- **Anyone else wrote in between** — another tab, a hand edit, a sync. The ledger did
  *not* advance, the expectation it hands over is stale against the file, and the write
  is refused. Exactly the protection this section exists to buy, unchanged.

The adapter therefore keeps one boolean (has it written yet — the first-gesture
exemption) and reads the version from the ledger it was handed. `WriteLedger` reaches
tools the same way everything else does, as one more field on `EditorContext`, wired at
the composition root against the same `CommandHistory` instance; a tool never constructs
one. It holds a bounded map keyed by the entities this session has touched and nothing
else — no entity state, no cache, nothing readable as a source of truth.

The **entity**, not the command, is the key. A command touching several entities records
one version per entity and expects each of them; a ledger keyed by command would be the
per-adapter field again with more steps.

This is why the adapter reads the wrapped command's payload at all, and why that payload
is `{ zone: Loaded<Zone> }` rather than `{ zone: Zone }`. The version lives on `Loaded<T>`
and nowhere else (slice 3), so a command that returned a bare entity would leave the
ledger with no version to record and nothing to do but re-read for one — the
check-then-act the contract exists to remove. The adapter still returns `ok(undefined)`
to `CommandHistory`, which needs only success or failure; the payload is read for exactly
one field on the way past.

A refused inverse surfaces as `zone.revision-conflict` (or `zone.external-modification`,
if the note was changed outside the plugin — slice 3 distinguishes them), and
`CommandHistory` already does the right thing with it: a failed `undo()` leaves the
command on `undoStack`, so the user is told the undo did not apply rather than being
shown a stack that has quietly lost its meaning.

Slice 3's `MoveSpatialObjectInput` carries the optional field this needs:

```typescript
interface MoveSpatialObjectInput {
  zoneId: ZoneId;
  geometry: Polygon;
  // Absent: the handler saves with the version its own load returned — a fresh gesture,
  // last-writer-wins. Present: the handler passes it to ZoneRepository.save as
  // `expected`, so a foreign write since refuses the operation instead of overwriting
  // it. The whole EntityVersion, so the refusal covers a hand edit too, not only a
  // plugin writer.
  expected?: EntityVersion;
}
```

The default is absence, so slice 3's own callers and slice 8's create/draw path are
unaffected by the field existing — the same additive shape `DeleteZoneInput.resolution`
takes in slice 10.

`CommandHistory` holds the stacks (SDD §30):

```text
CommandHistory
  undoStack: UndoableCommand[]
  redoStack: UndoableCommand[]

  run(command)   → result = await command.execute()
                 → if isErr(result): return result — undoStack/redoStack untouched
                 → push command to undoStack, clear redoStack, return result
  undo()         → peek undoStack (do not pop yet)
                 → result = await command.undo()
                 → if isErr(result): return result — command stays on undoStack,
                   not moved to redoStack
                 → pop undoStack, push command to redoStack, return result
  redo()         → peek redoStack (do not pop yet)
                 → result = await command.execute()
                 → if isErr(result): return result — command stays on redoStack,
                   not moved to undoStack
                 → pop redoStack, push command to undoStack, return result
```

Every `UndoableCommand.execute()` and `.undo()` resolves to a `Result`, per
ADR-007/SDD §29 — neither ever rejects for an expected domain or persistence
failure (only an unexpected technical fault throws, per SDD §65), and per
slice 4's repository contract a failed write is a no-op: it never partially
applies. "After the promise resolves" is therefore not enough to gate the
stacks on: a resolved, failed `Result` (a handler-level validation error, a
persistence failure from slice 4) must be inspected explicitly at all three
operations, not just `run()`. A failed `undo()` leaves the Vault in the same
state it was in before the undo was attempted — i.e. still reflecting the
command as applied — so the command must stay on `undoStack`, available to
retry; moving it to `redoStack` would record it as "available to redo" when
it was never undone. Symmetrically, a failed `redo()` leaves the command
un-replayed, so it stays on `redoStack` rather than moving to `undoStack`.
Neither stack is popped until the corresponding operation is confirmed to
have succeeded.

**`CommandHistory` serializes its own operations.** `run`, `undo` and `redo` queue
against one another so that at most one is executing at any moment, and the stacks are
mutated in the order the calls arrived rather than the order they happened to finish.
This is not defensive coding around a rare interleaving — it is the only thing making
the stack's order mean anything. Two commands can genuinely be in flight at once (an
Inspector commit and a canvas gesture dispatch independently, per slice 13), and a
command does not finish when its write lands: it goes on to await its event cascade,
which slice 10 runs to completion inside the same dispatch. A command with a short
cascade can therefore resolve before an earlier one with a long cascade, and an
unserialized `run()` would push them in that order — leaving Undo pointed at the wrong
edit. Slice 4's per-plan write lock does not help here: it is released when the write
completes, long before the cascade does.

Serializing here rather than at the dispatcher is what makes the guarantee hold for
`undo()` and `redo()` too, and `CommandHistory` is already scoped per open Plan, so the
queue needs no key: one instance, one Plan, one order. Slice 13's `withSaveStateTracking`
wraps this and is unaffected — a queued call is still an outstanding call, so its
`pendingCount` counts it exactly as before.

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

`SelectionStore` holds only domain IDs (ADR-005): a `readonly selectedIds` array of
`EntityId<string>`, plus `select`, `clear` and `isSelected`. Declared in
**Interfaces & Contracts**, with `presentation/editor/selection/selection-store.ts` as
its home; the `readonly` on `selectedIds` is load-bearing and part of that declaration.

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
Domain Geometry (BoundingBox, world millimeters)
      ↓
Command input (MoveSpatialObjectCommand's full replacement `geometry: Polygon`)
```

The last step names `MoveSpatialObjectCommand`, not §29's `ResizeSpatialObjectCommand`:
slice 3 collapses move and resize into one whole-geometry-replacement command on the
reasoning that "move vs. resize" is a UI-level distinction (which handle the user
dragged), and slice 8 builds resize on that same collapse. No
`ResizeSpatialObjectCommand` exists in this codebase, so a normalized `BoundingBox` is
converted to the replacement `Polygon` at the call site rather than fed to a
width/height command input.

This normalization is a pure function — `normalizeTransformerResult(transform,
baseGeometry): BoundingBox` — taking plain numbers in and out, so it is unit-tested
without instantiating a real Konva node or stage. `scaleX`/`scaleY` must never appear
in a command's input type or in any persisted entity (ADR-003, ADR-009); the
normalization function is the only place that reads them, and it runs synchronously in
the Transformer's `transformend` handler, before `pointerUp` builds the command.

### SnapService

Implemented once as an editor-level service (SDD §21), not per-tool. Its six methods —
`snapPoint`, `snapRotation`, `snapResize`, `snapToGrid`, `snapToVertex`, `snapToEdge` —
are declared in **Interfaces & Contracts**, at
`presentation/editor/snapping/snap-service.ts`.

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
read-only application-layer query against the selected entity/entities — **a query, not
a repository call**. This is not a stylistic preference: `EditorContext` deliberately
excludes repositories (§58), and an Inspector that reached one directly would be the
same layer violation a tool doing so would be, just in a panel instead of on a canvas.
Anything the Inspector needs to *read* — including a reference count before offering a
Delete action (slice 15's worked example) — arrives as a query result, never as a
repository handle the presentation layer holds.

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
is: one `UndoableCommand` wrapping whichever plain command owns that entity's
properties, pushed through `CommandHistory.run()`. This means an Inspector edit is
undoable exactly like a canvas drag, and `InspectorStore` needs access to the same
`CommandHistory`/dispatcher instance `EditorContext` hands to tools (wired at the
composition root, slice 1).

**The DTO is a cached read, so something has to invalidate it.** `InspectorStore.dto`
holds the result a query resolved when the selection last changed — not a live view of
the entity. Every command that mutates the selected entity therefore leaves that snapshot
behind: this slice's own Inspector commit (rename a Zone, and the panel still shows the
old name), a canvas gesture that moves the selected Zone (slice 8), and anything a
cascade writes downstream of either (slice 10's Requirement recalculation). Without an
invalidation the panel is correct only until the first edit and then silently wrong until
the user reselects or reopens the view, which is the same defect a stale canvas would be,
one panel over.

Re-running the query is thus an operation on the store — `refresh()` below — and the
caller that invokes it is the post-command funnel, never each edit site: slice 8's
`withEditorStateRefresh` wraps the same three `CommandHistory` operations and re-queries
`ProjectStore` and this store together, in one queued step. This slice declares the
operation because it owns the store; slice 8 owns the call, because it is where the first
mutation reaching the Inspector from outside the Inspector lands.

**No concrete property-update command exists yet, and this slice does not invent one.**
Slice 3's catalogue covers create, geometry-change and delete, not "rename a Zone" or
"change its zone type"; those arrive with slice 8, which owns post-creation metadata
editing, as one more plain `Command` wrapped by the adapter above. What this slice
fixes is the shape — one commit, one `UndoableCommand`, one history entry — not the
command list. Naming a `UpdateZonePropertiesCommand` here as though it existed would be
a forward reference to a thing no slice delivers.

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
// Imported, not declared here — slice 5 owns presentation/editor/viewport/.
// A screen coordinate is a distinct, incompatible type from Point (always world
// millimeters), so a tool cannot pass a screen pixel where domain geometry is
// expected and have it type-check: the brand makes them structurally different,
// not just differently named. That guarantee holds only while exactly one
// ScreenPoint exists in the codebase.
import type { Point, ScreenPoint } from '@presentation/editor/viewport/Viewport';

// presentation/editor/tools/editor-tool.ts
// 'calibrate' is included because slice 7's CalibrateTool is a real EditorTool and
// this union is what its `id` must satisfy. SDD §57's roster does not name it (it
// treats calibration as its own workflow), but a tool that cannot name itself here
// is a compile error, not a documentation nuance.
type ToolId =
  | 'select' | 'pan' | 'draw-polygon' | 'place-asset' | 'measure' | 'annotation'
  | 'calibrate';

interface EditorPointerEvent {
  worldPoint: Point;          // world mm — already through screenToWorld(); this
                               // is what every domain/geometry call must consume
  screenPoint: ScreenPoint;   // raw pixels — for rendering-layer use only
                               // (e.g. positioning an on-screen tooltip); passing
                               // this to createPolygon() or any Core geometry
                               // function is a compile error, not a runtime bug
  button: 'primary' | 'secondary' | 'auxiliary';
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  targetId: EntityId<string> | null;  // hit-tested render-model target, if any
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

// presentation/editor/tools/editor-context.ts — a thin, viewport-bound FACADE
// over slice 5's worldToScreen/screenToWorld, not their home: it binds them to
// the live pan/zoom state slice 5's Konva stage maintains so a tool never has
// to pass a Viewport and a dpr by hand. Slice 5 owns the math; calibration
// (slice 7) parameterizes neither — §24's transform is translation, zoom,
// rotation and device pixel ratio, and calibration is none of them.
interface EditorContext {
  readonly viewport: {
    worldToScreen(p: Point): ScreenPoint;
    screenToWorld(p: ScreenPoint): Point;
    setPan(delta: Vector): void;   // PanTool only; not a command
    setZoom(factor: number, origin: ScreenPoint): void;
  };
  readonly selection: SelectionStore;
  readonly snapService: SnapService;
  readonly commandDispatcher: { run(command: UndoableCommand): Promise<Result<void, AppError>> };
  // What this editor's own history has written, per entity — the expectation a
  // reversible adapter presents on every operation after its first. Wired against the
  // same CommandHistory instance as commandDispatcher; see "The expectation is the
  // history's, not the adapter's". A tool never reads it directly; its adapters do.
  readonly writeLedger: WriteLedger;
  readonly renderState: RenderState;
  // calibration is nullable: a Plan renders and is editable before it is calibrated
  // (slice 5's placeholder scale), so a tool that assumes a value here would break on
  // every freshly imported plan. `Calibration` is slice 3's type name; there is no
  // separate `PlanCalibration`.
  readonly activePlan: { id: PlanId; calibration: Calibration | null };
}

// presentation/editor/selection/selection-store.ts
interface SelectionStore {
  readonly selectedIds: readonly EntityId<string>[];
  select(ids: readonly EntityId<string>[]): void;
  clear(): void;
  isSelected(id: EntityId<string>): boolean;
}

// application ports consumed here, defined in slice 3
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}

// presentation/editor/tools/undoable-command.ts
interface UndoableCommand {
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;
}

interface CommandHistory {
  run(command: UndoableCommand): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;
  redo(): Promise<Result<void, AppError>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  clear(): void;
}

// application/editor/WriteLedger.ts — what THIS history has written, per entity.
// One instance per CommandHistory, same lifetime, reached by adapters through
// EditorContext. Advances on a successful write this history dispatched and on
// nothing else, which is what lets an expectation tell a sibling command apart
// from a foreign writer. See Design → "The expectation is the history's, not the
// adapter's".
interface WriteLedger {
  lastWritten(id: EntityId<string>): EntityVersion | null;
  record(id: EntityId<string>, version: EntityVersion): void;
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
  | { kind: 'zone'; id: ZoneId; name: string; areaMm2: number /* ...zone-specific fields */ }
  | { kind: 'multiple'; ids: readonly EntityId<string>[] }; // shape only; behavior left open, see Design

interface InspectorStore {
  readonly dto: InspectorDto;
  commit(edit: Record<string, unknown>): Promise<Result<void, AppError>>; // → UndoableCommand → CommandHistory.run
  // Re-runs the inspector query for the CURRENT selection and replaces `dto` with what
  // it resolves — the invalidation half of the cached read above. A no-op on an empty
  // selection, and it never changes what is selected: a refresh is a re-read, and a
  // re-read that moved the selection would fight the user's next click. Returns void
  // rather than a Result on purpose — its only caller is slice 8's post-command
  // decorator, which must not turn a failed re-read into a failed write; a failed
  // re-query leaves the previous DTO in place and surfaces through slice 17's rules for
  // a failed hydrating read, exactly as ProjectStore's own re-hydration does.
  refresh(): Promise<void>;
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
  command whose `execute()` **resolves to a failed `Result`** (not a rejected promise —
  this is the case that matters, since domain/persistence failures never reject) is
  never pushed to `undoStack`, and that `run()` returns that same failed `Result` to its
  caller. A further pair of tests makes a double's `.undo()` and `.execute()` (as
  called by `redo()`) each resolve to a failed `Result` in turn, and asserts the command
  stays on its original stack in both cases — `undo()`'s failure leaves it on
  `undoStack`, not moved to `redoStack`; `redo()`'s failure leaves it on `redoStack`,
  not moved to `undoStack`. No Konva, no Obsidian.
- **`WriteLedger` expectation tests** — two cases, and the first is the one an earlier
  draft of this design got wrong. **In order, same entity:** move zone Z, rename zone Z,
  undo the rename, undo the move; assert the last undo *succeeds* and that the zone's
  geometry is back at its pre-move value. Watched failing with the ledger replaced by a
  per-adapter field, which is where it refuses with `zone.revision-conflict` and then
  refuses identically on every retry. **Foreign write, same entity:** move zone Z, write
  the zone through a second repository handle without going through this history, then
  undo the move; assert it is refused and the foreign write survives intact. Both cases
  must be in the suite: the first alone is satisfied by an adapter that presents no
  expectation at all, which would pass it while discarding the foreign write.
- **`normalizeTransformerResult` unit tests** — table-driven over plain
  `{x, y, rotation, scaleX, scaleY}` + base geometry inputs; assert the output never
  contains a `scaleX`/`scaleY` field and that `scaleX: 2, scaleY: 1` on a 1000×500mm
  base box normalizes to a 2000×500mm box.
- **`SnapService` unit tests** — each method (`snapToGrid`, `snapPoint`,
  `snapToVertex`, `snapToEdge`, `snapResize`, `snapRotation`) as a pure function over
  domain geometry fixtures, independent of any live canvas.
- **`CommandHistory` serialization test** — dispatch two commands without awaiting the
  first, where the second's fake resolves faster than the first; assert `undoStack` holds
  them in dispatch order and that the second's `execute()` does not begin until the
  first's has resolved. A test whose two fakes resolve in dispatch order anyway would
  pass against an unserialized implementation, so the timing has to be inverted
  deliberately.
- **Gesture-to-command integration test** (component-level, per SDD §73–74's Vue/Konva
  test approach) — simulate `pointerDown` → N × `pointerMove` → `pointerUp` against a
  test-double `EditorTool`; assert exactly one `CommandHistory.run()` call and exactly
  one handler invocation, regardless of N.
- **Architecture/contract test** — assert `EditorContext`'s type surface exposes no
  repository or Obsidian Vault API (extends SDD §76's architecture test rules).
- **`ScreenPoint`/`Point` type-safety check** — a compile-time-only test file (e.g.
  `// @ts-expect-error`) asserting that `createPolygon([event.screenPoint])` and
  `Zone.withGeometry({ points: [event.screenPoint] })` fail to type-check, while the
  `event.worldPoint` equivalents compile. This is what makes the screen/world
  distinction a real guarantee rather than a naming convention a future edit could
  quietly erode.
- **Inspector commit test** — simulate several keystrokes into a bound field, then
  blur; assert exactly one command dispatch, not one per keystroke.
- **Inspector refresh test** — with a fixture entity selected and the query's next
  answer changed, `refresh()` replaces `dto` with the new answer and leaves
  `SelectionStore` untouched; on an empty selection it resolves without calling the
  query at all; and a query that resolves a failed `Result` leaves the previous `dto`
  in place rather than blanking the panel. The caller that invokes it — and the
  assertion that a committed edit actually reaches the panel — is slice 8's, where the
  decorator lives.

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
4. Two commands dispatched back-to-back without awaiting the first — the second with a
   deliberately shorter event cascade, so it would otherwise resolve first — appear on
   `undoStack` in dispatch order, not completion order. Asserted with a fake whose
   cascade duration is controllable, since the bug this rules out only appears when
   completion order and dispatch order disagree.
5. Undo survives an intervening command of this history on the same entity, and refuses
   an intervening write from anywhere else: move → rename → undo rename → undo move
   applies, while move → foreign write → undo move is refused with
   `zone.revision-conflict` and leaves the foreign write intact. Both asserted, since
   either alone is passed by a design that is wrong in the other direction, and the
   expectation is read from `WriteLedger` rather than from a per-adapter field.
6. A simulated Transformer resize/rotate never allows a `scaleX`/`scaleY` value to
   reach a command's input type or a persisted entity — asserted directly in the
   normalization test, not just implied by code review.
7. A command whose `execute()` resolves to a failed `Result` (simulated validation or
   persistence failure) is never pushed to `undoStack`, produces no redo-stack
   entry, and `CommandHistory.run()` returns that same failed `Result` to its caller —
   asserted against a resolved error `Result`, not a rejected promise. A command
   whose `.undo()` resolves to a failed `Result` stays on `undoStack` rather than moving
   to `redoStack`; a command whose `.execute()` resolves to a failed `Result` when called
   by `redo()` stays on `redoStack` rather than moving to `undoStack`.
8. `SelectionStore`'s type contains only domain IDs; no Konva node/ref type is
   reachable from it, checked by the architecture/contract test.
9. `SnapService` is a standalone, injectable implementation of all six SDD §21 methods,
   unit-tested without a live canvas.
10. Selecting a fixture entity produces an Inspector DTO sourced from an application
   query — not a repository call — and committing an edited field dispatches exactly one
   command through the same `CommandHistory` tools use.
11. `EditorContext`'s type surface contains no repository or Obsidian Vault API.
12. No tool-specific branching exists inside `ToolManager` or `EditorContext` — adding a
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

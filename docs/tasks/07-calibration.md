---
type: Task
parent: "[[Plan editor and canvas]]"
order: 30
dependsOn:
  - "[[06-editor-tool-framework-undo-redo-and-inspector]]"
status: Done
started: 2026-08-25
finished: 2026-08-25
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 7: Calibration

## Purpose

This is the first concrete `EditorTool` built on slice 6's framework. It delivers the
one thing every later measurement, zone, requirement, and cost calculation depends on:
what a Plan's world-unit coordinates actually *mean* relative to its background image.

Before calibration, a Plan's background image renders, but its size in world units is
an arbitrary placeholder — nothing on it is a real measurement. Calibration is the act
that fixes that: the user marks two points a known real-world distance apart, and the
plugin derives the scale that makes every subsequent world-unit coordinate for that
Plan a real millimeter value.

This is also the literal target of SDD Increment 5: *"Imported plan can produce
real-world measurements."*

## Scope

### In scope

- `CalibrateTool`, a concrete `EditorTool` (slice 6): a two-point pick gesture over the
  background image.
- `Calibration`, a plan-scoped value object (Point A, Point B, known real-world
  distance, derived scale) and its validation rules.
- `ReversibleCalibratePlanCommand`, the undoable application command that turns a
  completed gesture plus a supplied distance into a persisted `Calibration`
  (**replaces** slice 3's plain, non-undoable `CalibratePlanCommand`, which was deleted
  in this slice's review pass — see Design).
- Deriving the scale factor from the two points and the known distance, and the precise
  (and deliberately narrow) place it lands: the background's world extent, **not** the
  viewport transform — see "What calibration establishes".
- The pre-calibration default every fresh Plan renders under, since that default is
  exactly what the first calibration corrects.
- Recalibration semantics — an explicit, reasoned decision, flagged below, since the
  SDD does not specify it — including the confirmation a recalibration over existing
  geometry requires before it is dispatched.
- Validation of calibration inputs against slice 2's `Result`/error conventions.

### Out of scope (covered by other slices)

- `Point`, `distance()`, other Geometry Core primitives, `Result<T,E>`, and the base
  error categories — slice 2.
- The `Plan` entity's other fields (name, background reference, layers), its schema,
  and its ID — slice 3.
- The geometry sidecar file format, Plan repository, schema versioning, and migration
  mechanics — slice 4 (ADR-002, ADR-011).
- Konva scene structure, the background layer's rendering, pan/zoom, and the
  `worldToScreen`/`screenToWorld` transform itself (and the `ScreenPoint` type) — slice
  5. Calibration's own output, `pixelsPerWorldUnit`, feeds that slice's
  `BackgroundRenderModel.worldScale`, not the transform.
- `EditorTool`, `EditorContext`, `Command`/`UndoableCommand`, command history/undo
  stacks — slice 6.
- Polygon drawing, zone vertex editing — slice 8. Also `withEditorStateRefresh`, the
  decorator that re-queries the editor's working state after a command lands: a rescale
  changes every Zone's geometry, so this slice needs it too, but it belongs where the
  first mutation that adds and removes rendered entities is. Built before slice 8, a
  recalibration's rescale is correct on disk and stale on screen until the Plan Editor is
  reopened — worth knowing when picking the order, since the slice map allows either.
- Requirement/cost recalculation triggered by a geometry change — slice 9.

PRD Epic 3 ("Calibration & Measurement") also lists distance measurement, area
calculation, perimeter, and measurement annotation as features, and SDD §57 names a
separate `MeasureTool` and `AnnotationTool`. Neither is in scope for any slice in the
map — they are not part of the architectural foundation this breakdown covers, and are
left as feature work built on this slice and slice 8 once both exist.

## Dependencies

- **Slice 2 (Core Primitives)** — `Point`, `distance()`, `Result<T,E>`, the error
  category taxonomy, and unit conversion (SDD §22–23; ADR-009).
- **Slice 3 (Domain Foundation)** — the `Plan` entity and its module (SDD §7.2, §78).
  `Calibration` is added as one of `Plan`'s own fields, not a new entity.
- **Slice 4 (Persistence & Repository Layer)** — the Plan geometry sidecar and its
  repository (SDD §39–47; ADR-002, ADR-011). This slice extends that sidecar's schema
  by one field; it does not touch how sidecars are located, written, or migrated.
- **Slice 5 (Canvas Rendering & Editor Shell)** — the `worldToScreen`/`screenToWorld`
  transform and the `ScreenPoint` type (SDD §24), the background layer that renders a
  Plan's image, and the pre-calibration placeholder scale this slice corrects (SDD
  §16–19). What this slice supplies is `BackgroundRenderModel.worldScale`; it neither
  defines nor parameterizes the viewport transform.
- **Slice 6 (Editor Tool Framework, Undo/Redo & Inspector)** — `EditorTool`,
  `EditorContext`, `Command`/`UndoableCommand`, `CommandHistory` (SDD §56–59, §29–31).
- **Slice 15 (Modals & Confirmation Dialogs)** — `ConfirmDialog` and `DialogStore`,
  which `CalibrateTool` opens before dispatching a recalibration over existing
  geometry (see "Confirming a recalibration"). A build dependency for that branch
  only: a first calibration, which is all Increment 5 requires, dispatches without
  a dialog and needs nothing from slice 15.
- **Slice 10 (Assets, Requirements & the End-to-End Loop)** — not a build dependency
  (slice 10 arrives much later, in Increment 7): this slice only publishes
  `ZoneGeometryChanged` on every spatial object it rescales — a slice-3 event that
  already exists independent of who subscribes to it. Slice 10's
  `onZoneGeometryChanged` subscriber is what later gives that publish a downstream
  effect (`markStale` → recalculation); this slice does not call into slice 10's
  code, and would publish the identical event even if slice 10 never existed.
- **ADR-007** (Command-Based Mutations), **ADR-009** (World Coordinates in
  Millimeters), **ADR-002** / **ADR-011** (geometry sidecar).

## Design

### What calibration establishes

ADR-009 draws a sharp line: the viewport transform (`worldToScreen`/`screenToWorld`)
accounts for **translation, zoom, rotation, and device pixel ratio** — nothing else.
Calibration is described separately: *"a plan's calibration ... is what establishes
the mapping between its background image and world coordinates."* These are two
different jobs:

```text
Viewport Transform (slice 5, §24)  — ephemeral, per-session, never persisted
  world  ↔  screen pixels          — pan, zoom, rotation, DPR

Calibration (this slice, §25)      — persisted, per-Plan, changes rarely
  background image  →  what world units mean for this Plan
```

Calibration does **not** add a parameter to `worldToScreen`/`screenToWorld`. It fixes,
once, what a "world unit" means for a given Plan's background — after which the
existing transform can treat world units as genuine millimeters without knowing
calibration exists at all.

### The uncalibrated default

Slice 5's background layer needs *some* world-unit size for a freshly imported image
before any calibration has happened (Increment 4 renders the background before
Increment 5 exists). This slice defines that default precisely, since it is what the
first calibration corrects:

```text
Uncalibrated Plan: 1 background-image pixel = 1 world unit (mm)
```

This is a placeholder, not a measurement — `Plan.calibration` is `null` until the user
completes calibration, and any zone drawn or measured before that point is not a real
measurement. This follows §3.7 Progressive Complexity: a workable default now, refined
by an explicit user action.

### The calibration gesture

`CalibrateTool` is a two-click `EditorTool`:

```typescript
class CalibrateTool implements EditorTool {
  readonly id: ToolId = "calibrate";   // slice 6's ToolId union includes this member
  private pointA: Point | null = null;

  pointerDown(event: EditorPointerEvent): void {
    const point = event.worldPoint; // already through screenToWorld() — SDD's own
                                     // EditorPointerEvent field, not recomputed here
    if (this.pointA === null) {
      this.pointA = point;
      return; // first point placed; wait for the second click
    }
    this.complete(this.pointA, point);
  }

  pointerMove(event: EditorPointerEvent): void {
    // optional: render a live preview segment from pointA to the cursor
  }

  pointerUp(): void {}

  cancel(): void {
    this.pointA = null; // clears a pending first point; no command dispatched
  }
}
```

Both points come from `event.worldPoint` — already converted through
`context.viewport.screenToWorld()` before the tool ever sees the event — never raw
screen pixels, per ADR-009's rule that editor tools must not perform ad-hoc pixel
math. Once the
second point is placed, the tool hands off to the inspector/UI (§59's
`Selection → Inspector Query → Inspector DTO → Vue UI` pattern) to prompt for the known
real-world distance; the presentation layer converts that from the Plan's display unit
into world units (mm) using slice 2's unit conversion before it ever reaches a command.
Only then is `ReversibleCalibratePlanCommand` dispatched.

### Deriving the scale

Given the two points (in current world units) and the known distance:

```text
measuredDistance = distance(pointA, pointB)      // slice 2 primitive
scaleCorrection  = knownDistance / measuredDistance
newPixelsPerWorldUnit = previousPixelsPerWorldUnit / scaleCorrection
                        (previousPixelsPerWorldUnit defaults to 1, uncalibrated)
```

`scaleCorrection` is also exactly the factor by which every existing world-unit
coordinate for this Plan must be rescaled to stay consistent with the corrected scale
— see Recalibration below. First calibration and recalibration are the same operation;
first calibration is just the case where `previousPixelsPerWorldUnit` is the default
`1` and there is (typically) no existing geometry yet to rescale.

`pixelsPerWorldUnit` has exactly two jobs, and neither is parameterizing
`worldToScreen()`:

1. It is what slice 5's `BackgroundRenderModel.worldScale` is derived from — how many
   world millimetres one source pixel of this Plan's background covers. Before
   calibration that is the placeholder `1`; after, it is this value's reciprocal.
2. It is the value `ReversibleCalibratePlanCommand` reads back to compute
   `scaleCorrection` on the next recalibration, plus an audit trail a UI can show as
   "1 world unit ≈ N image px".

Because recalibration also rescales every stored coordinate (see Recalibration below),
world units stay genuine millimetres everywhere downstream, and the viewport transform
— whose components §24 fixes as translation, zoom, rotation and device pixel ratio —
never learns that calibration exists. Slices 2, 5 and 6 each state the same boundary
from their own side.

### Validation

Per §26 Geometry Validation, applied to calibration's inputs specifically:

- `pointA` and `pointB` must be distinct (`measuredDistance > 0`); coincident points
  make the scale undefined.
- `knownDistance` must be a finite, positive number — not `0`, not negative, not
  `NaN`, not `Infinity`.
- The derived `pixelsPerWorldUnit` is itself checked finite and positive as a defensive
  floor against pathological floating-point input.

All three are expected, nameable business failures — reported through `Result<T,E>`
(§65), never thrown. Slice 3's own command table already names this failure mode
`CalculationError` (`pointA` = `pointB`, division by zero) for `CalibratePlanCommand`;
this slice's three distinct cases are that same slice-2 `CalculationError`
(`BaseError<'Calculation'>`), narrowed by `code`, not a bespoke type of their own —
a bespoke `{ kind: ... }` shape would be incompatible with the `AppError` union every
other slice's error routing (slices 11, 16, 17) is built against:

```typescript
type CalibrationErrorCode =
  | "calibration.coincident-points"
  | "calibration.invalid-distance"
  | "calibration.degenerate-scale";

// CalculationError = BaseError<'Calculation'> (slice 2); narrowing TCode is
// structurally still a CalculationError, not a new, incompatible type.
type CalibrationError = BaseError<"Calculation", CalibrationErrorCode>;
```

### Recalibration

> **Open Question / Assumption — what happens to existing geometry on recalibration?**
>
> Neither the SDD (§25) nor the PRD (§82) says what recalibrating an already-calibrated
> Plan should do to geometry drawn under the old scale. Two options:
>
> 1. **Calibration only affects future measurements.** Existing Zones' stored
>    coordinates are left untouched; only the scale used for new geometry changes.
> 2. **Recalibration rescales existing geometry.** Every persisted world-unit
>    coordinate for that Plan (background size, Zone vertices, the calibration's own
>    points) is multiplied by `scaleCorrection` as part of the same transaction.
>
> **Decision: option 2.** Recalibration is a correction to a previously wrong scale,
> not a new, independent measurement basis — the user's mental model is "my kitchen is
> actually 4.2 m wide," not "redefine what a millimeter means going forward." Option 1
> would leave a Zone's stored millimeters silently meaning something different than
> what the user now believes, violating ADR-009's own premise that "a wall is
> genuinely 5400 mm long." Because the rescale is a uniform multiplicative scale
> applied consistently to the background's own world-unit size *and* every Zone's
> coordinates, anchored at world origin, visual alignment between Zones and the
> background image is preserved — nothing appears to shift on screen; only what the
> numbers mean in millimeters changes.
>
> This has real consequences worth flagging: recalibrating a Plan with existing Zones
> is a larger-blast-radius operation than a first calibration (it touches every spatial
> object in that Plan, and downstream Requirements derived from their area are now
> stale). So it is confirmed explicitly, never applied as a silent side effect — see
> "Confirming a recalibration" below, which wires that to slice 15's `ConfirmDialog`
> rather than leaving it as an intention.
>
> Increment 5's own success criterion only requires calibrating a freshly imported
> plan with no existing geometry, where this decision is a no-op. It is documented here
> because slice 8 (Zone Editing) starts producing exactly the geometry this decision
> governs, and the architecture should not paint itself into a corner before then.

### Confirming a recalibration

`CalibrateTool` dispatches immediately when the Plan has no spatial objects — the
common case, and the only one Increment 5 requires. When the Plan already has geometry,
the tool asks first, through slice 15's `ConfirmDialog`:

```text
CalibrateTool, after the known distance is supplied
  ↓
does the Plan have any spatial objects?
  no  → dispatch ReversibleCalibratePlanCommand directly. There is nothing drawn
        for the new scale to reinterpret
  yes → dialogStore.openDialog({ kind: 'confirm', danger: true, … })
          — names the count of objects that will be rescaled
  ↓
'cancel' → dispatch nothing. Escape and the cancel button are the same answer
          (slice 15), and match this tool's own cancel() semantics
'confirm' → dispatch ReversibleCalibratePlanCommand
```

**The gate is the object count alone — not whether this is the first calibration.**
Slice 8 is explicit that a Zone can be drawn on an uncalibrated Plan (`screenToWorld`
produces well-formed world points calibrated or not), so `calibration === null` with
existing geometry is an ordinary state, not a contradiction. And the command does not
treat that state specially: it derives `scaleCorrection` against a
`previousPixelsPerWorldUnit` that defaults to `1` and rescales every spatial object
uniformly, exactly as a recalibration does. A first calibration over existing geometry
is therefore the same large-blast-radius operation under a different name, and gating
on "is this the first one" would skip the dialog for precisely the case that most needs
it — silently reinterpreting every Zone the user drew before calibrating. What makes
the question real is that objects will be rescaled, which is what the gate asks.

Two things this deliberately does **not** do. It does not make the command conditional
— `ReversibleCalibratePlanCommand` still rescales uniformly whether or not a dialog
preceded it, because a script, a migration, or an undo/redo replay never opens one, and
a command that trusted a caller's confirmation would be trusting the one thing that is
absent exactly when it matters. And it does not confirm the *undo*: undo reverses a
change the user just confirmed, and asking again would make the reversal harder than
the action.

This is a `ConfirmDialog`, not a `DeleteReferenceDialog`: the question is binary
(proceed or not), nothing is being deleted, and there are no referents to enumerate —
which is exactly slice 15's stated split between its two dialog kinds. `danger: true`
because the operation is not reversible by simply recalibrating back: floating-point
rescale is not exactly round-tripping, so undo (which restores the snapshot) is the
recovery path, not a second calibration.

`ReversibleCalibratePlanCommand` implements this uniformly — it does not need to
special-case "first calibration" versus "recalibration". It is named distinctly from
slice 3's plain `CalibratePlanCommand` (rather than redeclaring that name with a
different shape, the mistake slice 8 had to correct for `DeleteZoneCommand`/
`MoveSpatialObjectCommand`): slice 3's version only sets `Plan.calibration` far enough
to make `Plan` a complete, testable entity; this slice's version supersedes its
`execute()` body — a real domain command still living under `application/commands/
plan/`, not a Presentation-layer wrapper — to add the rescale-every-spatial-object
behavior recalibration needs, while keeping the same `CalibratePlanInput` shape and
the `PlanCalibrated`/`ZoneGeometryChanged` events slice 3 already established (not
`RequirementInvalidated` — that event belongs to slice 10's `Requirement` module, and
this slice reaches the same downstream effect the way slice 10 already wires it: by
publishing the `ZoneGeometryChanged` slice 10's own subscriber already listens for,
never by publishing a Requirement-domain event Plan-calibration code has no business
naming):

`CalibratePlanInput` is slice 3's, consumed unchanged and **not restated here** —
`{ planId, pointA, pointB, knownDistance }`, with `knownDistance` in world millimetres
like every other length (ADR-009). It was written out twice in this document, and the two
copies had already drifted on exactly that unit note, which is the one part of the shape a
reader cannot infer from the field names.

```typescript
class ReversibleCalibratePlanCommand implements UndoableCommand {
  async execute(): Promise<Result<void, ReferenceError | ValidationError | CalibrationError | PersistenceError>> {
    // 1. load Plan (+ its spatial objects) via repositories (slice 3/4)
    // 2. validate inputs, derive scaleCorrection (see above)
    // 3. rescale Plan.calibration's own points, background sizing, and every
    //    spatial object's geometry by scaleCorrection — one persistence write
    // 4. emit PlanCalibrated (§32 event pattern); for every spatial object
    //    that was rescaled, also emit ZoneGeometryChanged for that object —
    //    the same event slice 8's move/vertex-edit commands already emit,
    //    which slice 10's existing onZoneGeometryChanged subscriber picks up
    //    to markStale() and recalculate every Requirement on that Zone.
    //    Recalibration does not publish RequirementInvalidated itself or
    //    invoke slice 9's engine directly — it reuses slice 10's cascade
    //    rather than duplicating it.
  }

  // A snapshot inverse: it takes slice 6's SNAPSHOT-INVERSE CONTRACT whole rather than
  // re-deriving its obligations. What follows is that contract applied to this command,
  // including obligation 4 — a change event is re-emitted, a lifecycle event would not be.
  async undo(): Promise<Result<void, PersistenceError>> {
    // 0. present the sidecar EntityVersion that execute()'s own write returned, so the
    //    restore refuses — plan-geometry.revision-conflict for another writer,
    //    plan-geometry.external-modification for someone editing the .rpgeo file by
    //    hand, which ADR-011 registers the extension to make possible — if anything
    //    touched this plan's geometry in between. This is slice 6's rule for inverses, and the
    //    per-plan mutate lock is NOT a substitute for it: the lock orders this undo
    //    against a concurrent Zone move, and ordering is exactly what makes the hazard
    //    reachable — the move lands first, in order, and then this undo overwrites it.
    //    Two ways it would corrupt the file, both silent: restoring the pre-calibration
    //    polygon for a Zone somebody moved since, and dividing coordinates that were
    //    authored against the NEW scale by a correction they were never scaled by.
    //    A snapshot inverse is only valid against the state it was computed for.
    // 1. restore the previous Calibration and reverse the rescale (divide by
    //    scaleCorrection), from a snapshot taken before execute() — bypasses the
    //    command layer directly through the repository, the same reasoning
    //    slice 8's ReversibleDeleteZoneCommand.undo() uses (no natural "recalibrate
    //    to the opposite scale" inverse call to make instead). Redo is the same shape
    //    in the other direction: it expects the version the undo wrote.
    // 2. emit ZoneGeometryChanged for every object it just un-rescaled — the same
    //    event, for the same objects, that execute() emitted. Restoring the
    //    coordinates is only half the inverse: execute()'s events drove slice 10
    //    to recalculate every Requirement against the rescaled areas, and an undo
    //    that skipped them would leave those quantities and costs describing
    //    geometry that no longer exists, marked "current". Bypassing the command
    //    layer for the WRITE does not license bypassing it for the CASCADE.
    //    This is obligation 4's re-emit half, and it is not in tension with slice 8's
    //    delete-undo publishing nothing: the geometry genuinely changed in both
    //    directions, so ZoneGeometryChanged is TRUE both times, where a ZoneCreated on a
    //    restore would be false. Change events are replayed; lifecycle events are not.
  }
}
```

One `execute()` call is one logical transaction — one domain change, one undo entry,
one persistence write — per §31 Transaction Boundary, exactly like slice 6's
`ReversibleMoveZoneCommand`.

That single write is why the sidecar's version covers the whole file rather than one
entry per object: this command rewrites the whole document in one `mutate`, and a
per-object version would be describing a granularity the write does not have. It also
means the refusal is all-or-nothing, which is the honest outcome — a calibration undo
that restored the objects nobody touched and skipped the rest would leave the plan half
at one scale and half at another, which is worse than refusing and telling the user.

### Forward compatibility

PRD §82 names "multiple control points" as future work beyond the two-point minimum.
Nothing here forecloses it: `Calibration` is named for the concept, not
`TwoPointCalibration`, and the derivation is isolated in one place
(`deriveCalibration`) rather than inlined into the tool or the command. Extending it to
more control points later is a change to that one function's internals, not to the
tool/command contracts.

## Interfaces & Contracts

```typescript
// domain/plan/calibration.ts — part of the plan module (SDD §78)

interface Calibration {
  readonly pointA: Point;              // world units, at time of calibration
  readonly pointB: Point;              // world units, at time of calibration
  readonly knownDistance: number;      // world units (mm)
  readonly pixelsPerWorldUnit: number; // informational; see Design
}

function deriveCalibration(
  pointA: Point,
  pointB: Point,
  knownDistance: number,
  previous: Calibration | null
): Result<{ calibration: Calibration; scaleCorrection: number }, CalibrationError>;
```

```typescript
// Plan (slice 3) gains one field:
interface Plan {
  // ...fields owned by slice 3: id, name, background, layers, etc.
  readonly calibration: Calibration | null; // null = not yet calibrated
}
```

```typescript
// application/commands/plan/reversible-calibrate-plan-command.ts (SDD §29, §85:
// CalibratePlan; named ReversibleCalibratePlanCommand here — see Design — to avoid
// colliding with slice 3's plain, non-undoable CalibratePlanCommand)

// As built: `application/commands/plan/ReversibleCalibratePlan.ts`, matching its
// application-layer sibling (`ReversibleSetPlanBackground.ts`). The class carries the
// transaction and the snapshot inverse; slice 6's `UndoableCommand` interface lives in
// presentation/, which application cannot name — `CalibrateTool` satisfies it with the
// zero-arg gesture wrapper it assembles around `execute(input)` / `undo()`.

// CalibratePlanInput — slice 3's, consumed unchanged, not redefined here.
// `{ planId, pointA, pointB, knownDistance }`, knownDistance in world millimetres.

class ReversibleCalibratePlanCommand {
  execute(): Promise<Result<void, ReferenceError | ValidationError | CalibrationError | PersistenceError>>;
  // Narrower than execute() on purpose, and this is the authoritative signature: undo
  // restores a snapshot and reverses a multiplication it already computed. It derives no
  // calibration, so no CalibrationError is reachable — its only failure is the write, or
  // the version check refusing it. The two refusal codes live on `ValidationError`
  // (`revisionConflict` / `externalModification`, application/ports/versioning.ts), not
  // PersistenceError as this section first claimed — the vocabulary of §36's ports wins.
  undo(): Promise<Result<void, PersistenceError | ValidationError>>;
}
```

```typescript
// presentation/editor/tools/calibrate-tool.ts

class CalibrateTool implements EditorTool {
  readonly id: ToolId; // "calibrate"
  activate(context: EditorContext): void;
  deactivate(): void;
  pointerDown(event: EditorPointerEvent): void;
  pointerMove(event: EditorPointerEvent): void;
  pointerUp(event: EditorPointerEvent): void;
  cancel(): void;
}
```

`CalibrateTool` depends only on `EditorContext` (viewport, command dispatcher) exactly
as slice 6 specifies — it must not call the Plan repository directly (SDD §58).

## Persistence Impact

`Calibration` is stored inside the Plan's own geometry sidecar (ADR-002/ADR-011), as a
new top-level field alongside `objects` — extending SDD §40's schema additively:

```json
{
  "schemaVersion": 1,
  "planId": "plan-01JABB3C5D7E9F1G3H5J7K9M1N",
  "unit": "mm",
  "calibration": {
    "pointA": { "x": 3248, "y": 960 },
    "pointB": { "x": 3248, "y": 4160 },
    "knownDistance": 3200,
    "pixelsPerWorldUnit": 0.25
  },
  "objects": []
}
```

**The persisted points are post-rescale, which is why they are 3200 apart.** The user
picked (812, 240) and (812, 1040) — 800 world units apart under the placeholder scale —
and said the real distance is 3200 mm, giving `scaleCorrection = 3200 / 800 = 4` and
`pixelsPerWorldUnit = 1 / 4`. Step 3 of `execute()` multiplies every world-unit
coordinate for the Plan by `scaleCorrection`, and the calibration's own points are on
that list, so what lands in the file is the picked points already corrected. A persisted
calibration therefore always satisfies `distance(pointA, pointB) === knownDistance`;
points that disagree with their own `knownDistance` are the pre-rescale values, which is
a fixture that never existed at rest. Asserted directly rather than left to the reader —
see Testing Strategy.

> **Assumption:** the PRD lists `scale` among `Plan`'s properties (§8) but does not say
> which persisted file holds it — Markdown frontmatter (ADR-001) or the geometry
> sidecar (ADR-002). This slice places it in the sidecar: ADR-002 already frames
> "points ... transforms" as data that "does not map cleanly onto YAML frontmatter,"
> and recalibration must rewrite calibration and rescaled spatial-object geometry
> together as one write (§42) — trivial when both live in the one JSON file the Plan
> repository already treats as a single write, awkward if split across two files and
> two write paths. This should be confirmed, not silently assumed, when slice 3/4 are
> actually implemented.

- `calibration` is **already a nullable field of slice 4's `PlanGeometrySchemaV1`** —
  declared there, unfilled, precisely so this slice does not have to amend a schema.
  This matters more than it looks: Zod strips unknown keys by default, so a field
  "added additively" without touching the schema would be silently discarded on every
  read. A sidecar written before this slice ran parses with `calibration: null`, and no
  version bump is needed because no v1 sidecar without the key ever shipped. A future
  *breaking* format change goes through slice 4's versioning/migration (§44–45), not
  through ad hoc handling here.
- Recalibration writes `calibration` and every rescaled spatial object's `objects[]`
  entry in the same sidecar write — one file, one Vault operation, naturally atomic.
- No new Markdown frontmatter keys are introduced by this slice.

### What the review pass changed: "supersedes" had to become "replaces"

This section said "supersedes its `execute()` body" and the code did not do it. A new
class was added and slice 3's was left exported, tested and reachable — two live
calibration writers with contradictory semantics, of which the older one:

- persisted a calibration whose own points did **not** measure their `knownDistance`,
  which is the invariant DoD box 7 on this page asserts;
- rescaled **no** existing geometry, which is option 1 of the recalibration question this
  page explicitly decided against;
- wrote the sidecar **unconditionally**, through the plan repository's `syncCalibration`,
  bumping the revision and silently invalidating any pending calibration undo.

Nothing chose between them, so the review pass deleted the older path outright:
`CalibratePlanCommand`, `Plan.calibrate` and `createCalibration` (the duplicate
derivation — `deriveCalibration(a, b, d, null)` with the points left un-rescaled).
`CalibratePlanInput` moved onto the command that still holds it. `Plan.withCalibration`
and `validateCalibration` stay: they are the READ path, where `planFromPersistence`
merges the sidecar's value into the entity and re-validates it.

**And `syncCalibration` went with them**, which the same review found to be a lost update
no gate could see. Calibration does not live in the plan note, so a calibration landing
in the sidecar does not move the note's revision — a `Plan` read *before* one still
passed `checkExpectedVersion` afterwards, and the next rename wrote its stale calibration
(or `null`) back over the new one while the rescaled coordinates stayed. Two writers of
one field, only one of which has a version to check against, is the defect; the
repository now owns the sidecar's **lifecycle** and none of its content, and
`PlanGeometrySidecar` is the single writer of `calibration`. A note update no longer
opens the sidecar at all, so a plan whose geometry file went missing can still be
renamed.

The first pass had also added a test pinning that clobber as intended behaviour
("saving a plan whose calibration is null clears a sidecar calibration that exists").
Covering a branch is not the same as asking whether the branch should exist.

## Testing Strategy

Unit — domain, no Obsidian/Vue/Konva (ADR-006):

- `deriveCalibration` on valid inputs returns the expected `pixelsPerWorldUnit` and
  `scaleCorrection`.
- Rejects coincident points (`CalibrationError` code `calibration.coincident-points`).
- Rejects `knownDistance` of `0`, negative, `NaN`, and `Infinity`
  (`CalibrationError` code `calibration.invalid-distance`) — §26.
- Rescaling a polygon by `scaleCorrection` scales its vertices linearly and its area
  (slice 2's `area()`) by `scaleCorrection²`.
- Recalibrating twice in sequence (`s1` then `s2`) produces the same end state as
  calibrating once directly against the true reference, within floating-point
  tolerance — proves the "same formula for first calibration and recalibration" claim.

Application (§71):

- `ReversibleCalibratePlanCommand` on a Plan with no spatial objects updates only
  `Plan.calibration`.
- After any successful `execute()`, the persisted calibration satisfies
  `distance(pointA, pointB) === knownDistance` — the rescale applies to the
  calibration's own points, not only to the geometry around them. Asserted on the saved
  value rather than the input, since the input is exactly where the two disagree.
- `ReversibleCalibratePlanCommand` on a Plan with existing Zones rescales every Zone's
  geometry in the same transaction; a failure partway through leaves previously valid
  data intact (§42).
- `undo()` restores both the previous `Calibration` and any rescaled geometry, and
  re-publishes `ZoneGeometryChanged` for every object it un-rescaled — undo is not
  exempt from re-triggering slice 10's cascade, since the restored geometry is just as
  much a real geometry change as the recalibration that produced it. Asserted through
  to the **Requirement**, not just the event: with slice 10's subscriber attached, a
  calibrate-then-undo round trip leaves every Requirement's persisted quantity and cost
  back at its pre-calibration figures. An undo that restored coordinates but skipped
  the cascade passes a geometry-only assertion while leaving those figures describing
  areas that no longer exist, marked `"current"` — which is the whole defect.
- A successful recalibration that touched existing spatial objects emits
  `PlanCalibrated` and one `ZoneGeometryChanged` per affected object (§32 pattern),
  which a test asserts drives slice 10's `onZoneGeometryChanged` subscriber end to
  end (`markStale` → `RequirementInvalidated` → recalculation) rather than only
  checking that the event was published; a first calibration with no existing objects
  emits only `PlanCalibrated`.

Component/Canvas (§73–74, reusing that slice's harness):

- A two-click gesture on `CalibrateTool` reads both clicks' `event.worldPoint` (produced
  upstream by a mocked `EditorContext.viewport.screenToWorld`, never recomputed by the
  tool itself), and dispatches `ReversibleCalibratePlanCommand` only once a valid
  distance is supplied.
- `cancel()` after the first click clears the pending point without dispatching
  anything.
- **Recalibration confirmation**, four cases against a `DialogStore` double: a Plan
  with no spatial objects dispatches with **no** dialog opened; a Plan with existing
  objects opens exactly one `ConfirmDialog` before dispatching, and the descriptor
  names the affected object count; answering `'cancel'` dispatches nothing at all; and
  — the case the gate was originally wrong about — a Plan with `calibration === null`
  **and** existing objects still opens the dialog, since a first calibration rescales
  that geometry exactly as a recalibration does. Asserted on the dispatcher spy, not
  only on the dialog: a tool that opened the dialog and dispatched regardless would
  pass a dialog-only assertion.

Repository contract (§72, reused from slice 4): a `Calibration` round-trips through
the sidecar unchanged.

## Definition of Done

- [x] `Calibration` and its validation live in the `plan` domain module (§78),
      self-contained: value object, errors, no framework dependency (ADR-006).
- [x] `CalibrateTool` implements slice 6's `EditorTool` exactly, reads only
      `event.worldPoint` (never `event.screenPoint`, never its own pixel math), and
      never calls `screenToWorld()` itself — that conversion already happened before
      the event reached the tool (ADR-009).
- [x] Undoing a calibration refuses when anything changed the plan's sidecar in between
      — `plan-geometry.revision-conflict` for another writer, and
      `plan-geometry.external-modification` for a hand edit that left the revision
      alone. Asserted by moving a Zone between the calibration and its undo, and
      separately by editing the `.rpgeo` file out of band, checking each time that both
      the intervening change and the calibration survive intact.
- [x] `ReversibleCalibratePlanCommand` implements slice 6's `UndoableCommand`; one
      `execute()` call is one persistence write and one undo/redo history entry (§31).
      *(The interface is satisfied by `CalibrateTool`'s gesture wrapper around
      `execute(input)`/`undo()` — an application class cannot name presentation's
      `UndoableCommand`. See Interfaces & Contracts.)*
- [x] Marking two distinct points on an imported plan's background and supplying a
      known real-world distance produces a `Plan` with a correctly derived,
      persisted `Calibration` — SDD Increment 5's success criterion, verified by a
      passing test, not just by inspection.
- [x] Coincident points and non-finite/non-positive distances are rejected via
      `Result`, never thrown (§26, §65).
- [x] A persisted `Calibration` measures its own `knownDistance`: the saved `pointA`
      and `pointB` are `scaleCorrection` apart from the picked ones, so
      `distance(pointA, pointB) === knownDistance` on read-back — including for the
      sidecar example above, which is a fixture people copy.
- [x] Recalibrating a Plan that already has persisted Zones rescales those Zones'
      geometry in the same transaction as the calibration update, with a passing
      test proving it — not just documented as intent.
- [ ] *(Requires slice 15; not part of Increment 5.* A Plan with spatial objects is by
      definition not a first calibration, and Increment 5's success criterion is the
      first one. The slice map records the same split — slice 7 depends on "6; 15 for the
      recalibration branch" — so shipping Increment 5 does not mean shipping this box
      unticked and hoping nobody notices.*)
      `CalibrateTool` opens slice 15's `ConfirmDialog` before dispatching **any**
      calibration over a Plan that has spatial objects — first-time or repeat, since
      the command rescales existing geometry either way — and dispatches nothing on
      cancel; only a Plan with no objects skips the dialog. Asserted on the command
      dispatcher, so a tool that asks and then proceeds regardless fails this rather
      than passing it by opening a dialog. `ReversibleCalibratePlanCommand` itself is
      unchanged by this: it rescales uniformly whether or not a dialog preceded it,
      since a script, a migration, and an undo/redo replay never open one.
- [ ] *(Requires slice 10; asserted at event-publication level until then.* This slice
      publishes `ZoneGeometryChanged` and its tests assert exactly that publication;
      what no test can yet drive is the subscriber on the other end, because slice 10
      does not exist. When it arrives, extend the calibrate/undo tests to run its
      `onZoneGeometryChanged` subscriber end to end (`markStale` → recalculation) and
      to assert the undo round trip through to the persisted Requirement figures.*)
      Recalibration publishes `ZoneGeometryChanged` (never `RequirementInvalidated`
      directly) for every rescaled object — proven by a test that this reaches slice
      10's `onZoneGeometryChanged` subscriber end to end, not just that some event
      fired.
- [ ] *(Requires slice 10; same deferral as above.)* `undo()` on a calibration command
      restores both the previous `Calibration` and any geometry it had rescaled, and
      re-publishes `ZoneGeometryChanged` for every object it un-rescaled — asserted
      through to the Requirement, so a calibrate-then-undo round trip leaves every
      quantity and cost back at its pre-calibration figures rather than describing
      areas that no longer exist. *(The restore and the re-publish ARE tested; only the
      through-to-the-Requirement leg waits for slice 10.)*
- [x] All calibration unit and application tests run with Obsidian, Vue, and Konva
      absent from the test environment.

*(Closed by slice 15, 2026-08-26: `registerEditorTools` registers `CalibrateTool`, the
toolbar names it, the composition root hands the editor a `calibratePlan` factory, and the
two prompts this tool declares are a `ConfirmDialog` and a `FormDialog` over
`KnownDistanceForm`. A user can calibrate a plan. This note previously read "also deferred
with slice 8's toolbar: nothing in the composition root registers `CalibrateTool` yet" —
and slice 8 landed with a toolbar and without the tool, so the deferral outlived the slice
it was pinned to. A capability proven by tests and registered nowhere is invisible to every
gate, because nothing about the code is wrong.)*

## References

- SDD §22 Geometry Core, §23 World Coordinate System, §24 Viewport Transform
  (reference only — slice 2)
- SDD §25 Calibration
- SDD §26 Geometry Validation
- SDD §29 Command Architecture (`CalibratePlanCommand`), §30 Undoable Editor Commands,
  §31 Transaction Boundary
- SDD §32 Event Architecture
- SDD §39–41 Sidecar Files / Plan Sidecar Schema / Persistence Boundary, §42
  Persistence Consistency, §44–45 Schema Versioning/Migration (reference only — slice 4)
- SDD §56 Editor Tool Architecture, §58 Editor Context, §59 Inspector Architecture
  (reference only — slice 6)
- SDD §64 Error Model, §65 Result Pattern (reference only — slice 2)
- SDD §57 Initial Editor Tools (`MeasureTool`, `AnnotationTool` — out of scope)
- SDD §78 Internal Module Pattern (shared convention)
- SDD §91 Increment 5 — Calibration
- PRD §8 Core Entities (Plan: scale)
- PRD §14 Epic 3 — Calibration & Measurement
- PRD §82 Plan Calibration Model
- PRD §85 Command Model (`CalibratePlan`)
- ADR-002 — JSON Sidecar for Plan Geometry
- ADR-007 — Command-Based Mutations
- ADR-009 — World Coordinates in Millimeters
- ADR-011 — Project-Scoped Geometry Sidecar Folder and Dedicated File Extension

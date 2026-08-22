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
  (supersedes slice 3's plain, non-undoable `CalibratePlanCommand` — see Design).
- Deriving the scale factor from the two points and the known distance, and the
  precise (and limited) way that feeds `worldToScreen()` / `screenToWorld()`.
- The pre-calibration default every fresh Plan renders under, since that default is
  exactly what the first calibration corrects.
- Recalibration semantics — an explicit, reasoned decision, flagged below, since the
  SDD does not specify it.
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
  5. This slice only supplies calibration's own output, `pixelsPerWorldUnit`, as one of
  that transform's inputs; it does not define the transform.
- `EditorTool`, `EditorContext`, `Command`/`UndoableCommand`, command history/undo
  stacks — slice 6.
- Polygon drawing, zone vertex editing — slice 8.
- Requirement/cost recalculation triggered by a geometry change — slice 9.

PRD Epic 3 ("Calibration & Measurement") also lists distance measurement, area
calculation, perimeter, and measurement annotation as features, and SDD §57 names a
separate `MeasureTool` and `AnnotationTool`. Neither appears in any of the 12 slices'
primary sections — they are not part of the architectural foundation this breakdown
covers and are left as feature work built on this slice and slice 8 once both exist.

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
  Plan's image, and the pre-calibration default scale this slice corrects (SDD §16–19).
  This slice supplies `pixelsPerWorldUnit` as an input to that transform; it does not
  define the transform.
- **Slice 6 (Editor Tool Framework, Undo/Redo & Inspector)** — `EditorTool`,
  `EditorContext`, `Command`/`UndoableCommand`, `CommandHistory` (SDD §56–59, §29–31).
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
Viewport Transform (slice 2/§24)   — ephemeral, per-session, never persisted
  world  ↔  screen pixels          — pan, zoom, rotation, DPR

Calibration (this slice)           — persisted, per-Plan, changes rarely
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
  readonly id: ToolId = "calibrate";
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

`pixelsPerWorldUnit` itself is not consumed by the viewport transform at render time —
it is informational (audit trail, a "1 world unit ≈ N image px" display) and the value
`ReversibleCalibratePlanCommand` reads back to compute `scaleCorrection` on the next
recalibration.

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
> stale). The Presentation layer should treat "recalibrate a Plan that already has
> geometry" as needing explicit user confirmation, not a silent side effect — but that
> UI decision belongs to a later slice, not this one.
>
> Increment 5's own success criterion only requires calibrating a freshly imported
> plan with no existing geometry, where this decision is a no-op. It is documented here
> because slice 8 (Zone Editing) starts producing exactly the geometry this decision
> governs, and the architecture should not paint itself into a corner before then.

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

```typescript
interface CalibratePlanInput {
  planId: PlanId;
  pointA: Point;
  pointB: Point;
  knownDistance: number; // world units (mm)
}

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

  async undo(): Promise<Result<void, PersistenceError>> {
    // restore the previous Calibration and reverse the rescale (divide by
    // scaleCorrection), from a snapshot taken before execute() — bypasses the
    // command layer directly through the repository, the same reasoning
    // slice 8's ReversibleDeleteZoneCommand.undo() uses (no natural "recalibrate
    // to the opposite scale" inverse call to make instead)
  }
}
```

One `execute()` call is one logical transaction — one domain change, one undo entry,
one persistence write — per §31 Transaction Boundary, exactly like `MoveZoneCommand`.

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

interface CalibratePlanInput {
  planId: PlanId;
  pointA: Point;
  pointB: Point;
  knownDistance: number;
}

class ReversibleCalibratePlanCommand implements UndoableCommand {
  execute(): Promise<Result<void, ReferenceError | ValidationError | CalibrationError | PersistenceError>>;
  undo(): Promise<Result<void, PersistenceError>>;
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
  "planId": "plan-ground-floor",
  "unit": "mm",
  "calibration": {
    "pointA": { "x": 812, "y": 240 },
    "pointB": { "x": 812, "y": 1180 },
    "knownDistance": 3200,
    "pixelsPerWorldUnit": 0.29375
  },
  "objects": []
}
```

> **Assumption:** the PRD lists `scale` among `Plan`'s properties (§8) but does not say
> which persisted file holds it — Markdown frontmatter (ADR-001) or the geometry
> sidecar (ADR-002). This slice places it in the sidecar: ADR-002 already frames
> "points ... transforms" as data that "does not map cleanly onto YAML frontmatter,"
> and recalibration must rewrite calibration and rescaled spatial-object geometry
> together as one write (§42) — trivial when both live in the one JSON file the Plan
> repository already treats as a single write, awkward if split across two files and
> two write paths. This should be confirmed, not silently assumed, when slice 3/4 are
> actually implemented.

- Adding `calibration` is additive to the existing sidecar schema: a sidecar written
  before this slice existed parses with `calibration: null`. A future breaking format
  change goes through slice 4's schema versioning/migration (§44–45), not through ad
  hoc handling here.
- Recalibration writes `calibration` and every rescaled spatial object's `objects[]`
  entry in the same sidecar write — one file, one Vault operation, naturally atomic.
- No new Markdown frontmatter keys are introduced by this slice.

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
- `ReversibleCalibratePlanCommand` on a Plan with existing Zones rescales every Zone's
  geometry in the same transaction; a failure partway through leaves previously valid
  data intact (§42).
- `undo()` restores both the previous `Calibration` and any rescaled geometry, and
  re-publishes `ZoneGeometryChanged` for every object it un-rescaled — undo is not
  exempt from re-triggering slice 10's cascade, since the restored geometry is just as
  much a real geometry change as the recalibration that produced it.
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

Repository contract (§72, reused from slice 4): a `Calibration` round-trips through
the sidecar unchanged.

## Definition of Done

- [ ] `Calibration` and its validation live in the `plan` domain module (§78),
      self-contained: value object, errors, no framework dependency (ADR-006).
- [ ] `CalibrateTool` implements slice 6's `EditorTool` exactly, reads only
      `event.worldPoint` (never `event.screenPoint`, never its own pixel math), and
      never calls `screenToWorld()` itself — that conversion already happened before
      the event reached the tool (ADR-009).
- [ ] `ReversibleCalibratePlanCommand` implements slice 6's `UndoableCommand`; one
      `execute()` call is one persistence write and one undo/redo history entry (§31).
- [ ] Marking two distinct points on an imported plan's background and supplying a
      known real-world distance produces a `Plan` with a correctly derived,
      persisted `Calibration` — SDD Increment 5's success criterion, verified by a
      passing test, not just by inspection.
- [ ] Coincident points and non-finite/non-positive distances are rejected via
      `Result`, never thrown (§26, §65).
- [ ] Recalibrating a Plan that already has persisted Zones rescales those Zones'
      geometry in the same transaction as the calibration update, with a passing
      test proving it — not just documented as intent.
- [ ] Recalibration publishes `ZoneGeometryChanged` (never `RequirementInvalidated`
      directly) for every rescaled object — proven by a test that this reaches slice
      10's `onZoneGeometryChanged` subscriber end to end, not just that some event
      fired.
- [ ] `undo()` on a calibration command restores both the previous `Calibration` and
      any geometry it had rescaled, and re-publishes `ZoneGeometryChanged` for every
      object it un-rescaled.
- [ ] All calibration unit and application tests run with Obsidian, Vue, and Konva
      absent from the test environment.

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
- ADR-011 — Configurable Geometry Sidecar Folder and Dedicated File Extension

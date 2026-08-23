# Design Slice 2: Core Primitives

## Purpose

Deliver the framework-free building blocks every other layer sits on: geometry
primitives, the world coordinate convention, stable entity identity, the
`Result<T, E>` pattern, the error-category type hierarchy, and the generic
in-process event bus. Nothing in this slice knows what a `Zone` or a `Project`
is — it is the vocabulary those concepts will be written in, once slice 3
introduces them.

This is the load-bearing half of the SDD's Increment 2 ("Domain can be
instantiated and tested without Obsidian", §91): before any entity can exist,
`core/` must compile, run, and be unit-testable with zero dependency on
`vue`, `pinia`, `konva`, `obsidian`, or the DOM (§3.4, ADR-006). Everything
downstream — domain entities (slice 3), persistence DTOs (slice 4), the
render model (slice 5), the cost/quantity engine (slice 9) — is built out of
the types defined here.

## Scope

### In scope

- `core/geometry/` — `Point`, `Vector`, `LineSegment`, `BoundingBox`,
  `Polyline`, `Polygon`, `Transform`, and the operations named in §22:
  distance, length, area, perimeter, centroid, bounding box, point-in-polygon,
  segment intersection, projection, translation, rotation, scale conversion.
- `core/units/` — the world coordinate convention (1 world unit = 1 mm,
  §23, ADR-009) as a documented, checkable fact rather than tribal knowledge.
- `core/identity/` — the generic stable-ID mechanism (§82): a branded
  `EntityId<TBrand>` type and an ID-generation function, independent of any
  concrete entity kind.
- `core/result/` — the `Result<T, E>` discriminated union and its
  constructors/guards (§65).
- `core/errors/` — the base shape shared by the eight error categories named
  in §64 (`DomainError`, `ValidationError`, `PersistenceError`,
  `GeometryError`, `ImportError`, `MigrationError`, `ReferenceError`,
  `CalculationError`) as a type hierarchy only.
- `core/events/` — the `EventBus` mechanism itself (`publish`/`subscribe`)
  and `Disposable`, as generic pub/sub machinery with no concrete event
  types (§33).

### Out of scope (covered by other slices)

- **`core/money/`** — decimal-safe `Money` arithmetic (§49, ADR-010) is
  cost-domain-specific and belongs to slice 9.
- **Concrete domain events** (`ProjectCreated`, `ZoneCreated`, …, §34) — the
  catalog is noted here to exist; the concrete union and payload shapes are
  introduced alongside their owning entities in slice 3.
- **Applying** geometry validation at the editing boundary — where a tool
  calls `createPolygon` mid-gesture, what a user sees when it rejects, and
  the §26 rules deferred as "Future" (self-intersection, winding, repair) —
  slice 8. The `createPolygon` smart constructor itself is *in* this slice
  (see "Validity, and the one function that enforces it"), because it is the
  only place §26's three required rules can be stated once for every caller.
- **Advanced polygon operations** (`clipper2-ts` union/intersection/
  difference/offset, §27) and the **spatial index** (`rbush`, §28) — both
  explicitly deferred per the SDD and the slice map's "Explicitly deferred"
  list, not scheduled into any slice.
- **Viewport transform** (`worldToScreen`/`screenToWorld`, pixel↔world
  mapping, §24) — slice 5, built on this slice's `Point`/`Transform`. Core's
  `Transform` and `scale` operate purely within world units; they never see
  a pixel, and never define the `ScreenPoint` type that represents one.
- **Calibration** (§25, the two-point/known-distance derivation and its
  persistence) — slice 7. Calibration is *not* a parameter of the viewport
  transform: §24 lists that transform's components as translation, zoom,
  rotation and device pixel ratio, and calibration is none of them. What
  calibration fixes is what a world unit means for one Plan's background —
  slice 7's own design.
- **Konva/rendering** (§16–19) — slice 5.
- **Persistence** (repositories, Zod schemas, sidecar format, §35–47) —
  slice 4.
- **Error boundary wiring** (logging, diagnostics, user-facing message
  mapping, §67–68, the bottom half of §66) — slice 11. This slice defines the
  typed shape that flows through that pipeline, not the pipeline.
- **Any concrete domain entity** (`Project`, `Plan`, `Zone`, …) — slice 3.

## Dependencies

- **Slice 1** (Plugin Bootstrap & Composition Root) — only in the sense that
  the build/lint/test harness this slice's code compiles and runs under
  already exists. `core/` itself has no runtime dependency on `plugin/`, and
  the dependency direction is enforced the other way: `plugin/` may reach
  `core/`, never the reverse.
- **ADR-006** (Plain TypeScript Domain) — the governing constraint: `core/`
  may not import `vue`, `pinia`, `konva`, `vue-konva`, `obsidian`, or DOM
  globals. Already enforced in this repository's `eslint.config.mjs`
  (`forbidden('core', …)` and the `no-restricted-globals` block for
  `core/**` and `domain/**`).
- **ADR-009** (World Coordinates in Millimeters) — fixes the geometry
  module's unit convention.
- No dependency on any later slice. `core/` is the one layer every other
  slice depends on and that depends on nothing in this breakdown.

## Design

### Layout

```text
core/
├── geometry/
│   ├── Point.ts
│   ├── Vector.ts
│   ├── LineSegment.ts
│   ├── BoundingBox.ts
│   ├── Polyline.ts
│   ├── Polygon.ts
│   ├── Transform.ts
│   └── operations.ts        # pure functions over the above
├── units/
│   └── WorldUnit.ts          # the 1-unit-=-1mm convention
├── identity/
│   ├── EntityId.ts
│   └── generateId.ts
├── result/
│   └── Result.ts
├── errors/
│   └── AppError.ts           # base shape + the 8 categories
├── events/
│   ├── EventBus.ts
│   └── Disposable.ts
└── money/                    # slice 9 — not this slice
```

This is the `core/` subtree of §7.1/§77, minus `money/`.

### Geometry primitives

Every geometry type is a plain, `readonly` value object — no mutating
methods, no identity, no behavior attached to the data (§81: prefer readonly
data). Operations are exported pure functions grouped by the shape they act
on, not class methods: geometry correctness has to be independently,
deterministically unit-testable (§92.12), and free functions over immutable
data are the cheapest way to get that.

```text
Point        { x, y }                       — a location, in world units (mm)
Vector       { dx, dy }                     — a displacement/direction, not a location
LineSegment  { start: Point, end: Point }   — bounded, not an infinite line
BoundingBox  { min: Point, max: Point }
Polyline     { points: Point[] }            — open; not implicitly closed
Polygon      { points: Point[] }            — closed; last→first edge is implicit,
                                               not a repeated closing point
Transform    { translation: Vector,
               rotationRadians: number,
               scale: number }              — uniform scale only (see below)
```

`Polygon` does not repeat its first point as a closing point — the edge from
the last vertex back to the first is implicit. This is the same "derived,
not duplicated" principle as §3.6: storing a redundant closing coordinate is
exactly the kind of data that can drift from the vertices it's supposed to
equal.

`Transform` carries a single scalar `scale`, not independent `scaleX`/`scaleY`
— §22 lists "scale conversion" as one operation, not two, and a full
non-uniform affine matrix is not something any cited SDD section asks core
geometry to support. (Konva's own `scaleX`/`scaleY` output is a *rendering*
artifact that must be normalized before it reaches domain geometry at all —
that normalization is §20's concern, owned by slice 6, not this one.)

### Validity, and the one function that enforces it

The `Polygon` **interface** is deliberately unvalidated: a 1-point or 0-point
polygon is representable at the type level on purpose, because a
`DrawPolygonTool` (slice 8) legitimately holds a not-yet-valid point buffer
while the user is still placing vertices.

Validity is enforced by one exported **smart constructor**, and it lives here:

```typescript
createPolygon(points: readonly Point[]): Result<Polygon, GeometryError>
```

It implements §26's three *required* rules — ≥3 vertices, finite
coordinates, no `NaN`/`Infinity` — and nothing else. It lives in `core/`
rather than in slice 8 for the reason §26's own framing implies: the rules
are about what a polygon *is*, not about what a pointer gesture may produce,
and both a domain entity (`Zone.withGeometry`, slice 3) and an editor tool
(slice 8) must reach the same answer without either trusting the other. A
rule stated in the editing layer would be a rule a migration, a script, or a
second tool could bypass.

**"Three" is a collapse of four of §26's six required bullets**, not the whole list.
§26 asks for ≥3 vertices, finite coordinates, no `NaN`, no `Infinity`, `valid unit` and
`valid transform`; the first four are properties of a point list and are what
`createPolygon` checks (finite/`NaN`/`Infinity` being one predicate, hence "three
rules"). The last two are **not** properties of a point list — a `Point[]` carries
neither a unit nor a transform — so a smart constructor over one structurally cannot
check them, and this slice refines §26 by assigning them elsewhere rather than by
leaving them unowned: slice 8's "Geometry validation (SDD §26)" table owns the editor
boundary, and slice 4's schema validation owns the persistence boundary that §26's own
"validate before persistence" framing is actually about. `docs/design/README.md`'s
shared-vocabulary entry states the split once; this paragraph is why it exists.

What this slice does **not** own is §26's "Future" list (self-intersection
detection, winding normalization, polygon repair) or the question of what a
user sees when a construction is rejected — both are slice 8's, and slice 8
is where `createPolygon` gets its first real caller.

Separately, what core is responsible for is not pretending an operation on a
degenerate shape produced a meaningful number. Operations that are
mathematically undefined for some inputs return `Result<T, GeometryError>`
instead of throwing or silently returning `0`/`NaN`; operations that are
always defined return their value directly:

| Always defined (direct return) | Undefined on some inputs (`Result`) |
| --- | --- |
| `distance`, `length` | `area`, `perimeter`, `centroid` — need ≥3 points |
| `translate`, `rotate`, `scale`, `applyTransform` | `boundingBoxOf` — undefined on an empty point set |
| | `contains` — needs a valid polygon |
| | `intersect`, `project` — undefined for a zero-length segment |

This is the one place this slice actively uses two of its own other pieces
together: geometry operations are exactly where "expected business failure,
not a bug" (§65) shows up concretely, on inputs the editor can legitimately
produce mid-interaction.

`area` returns the unsigned magnitude (shoelace formula). Signed area /
winding-order normalization is explicitly future work per §26 and is not
this slice's concern. `centroid` is the polygon's area-weighted centroid,
**not** the arithmetic mean of its vertices — the two differ for any
non-regular polygon and the wrong one is a believable, silent bug.

### World coordinate system

```text
1 world unit = 1 millimeter
```

Domain geometry — every `Point`, every persisted `Polygon` — is expressed in
this unit, never in canvas pixels (§23, ADR-009). `core/units/` exists to
hold this as one documented fact rather than a convention every consumer has
to independently remember; it does not perform any pixel↔mm conversion
(that centralized conversion, `worldToScreen`/`screenToWorld`, is §24 and
belongs to slice 5 at the viewport boundary), and it does not hold the
measurement vocabulary a cost figure is priced in (`UnitKind`,
`MeasurementUnit`, `Quantity` — slice 9, which adds them to this same
directory when it lands).

`Point.x`/`Point.y` remain plain `number` rather than a branded
`Millimeters` numeric type: the SDD's own geometry examples (§22, §38) use
plain coordinates, and a branded primitive number buys compile-time
protection only where every arithmetic operation is routed through helper
functions — which the shoelace/centroid formulas above are not. The
convention is enforced by construction (nothing in `core/` ever divides by
a pixel ratio) rather than by the type checker.

### Entity identity

Persistent entities use stable IDs independent of filename or title (§82).
The SDD's own examples — `zone-01HXYZ` (§38), `zone-01JABC...`,
`asset-01JDEF...` (§82) — are `<prefix>-<ULID>`: Crockford-base32,
timestamp-prefixed, lexicographically sortable. This slice picks **ULID**
over UUID for that reason, not arbitrarily — sortable IDs are a direct
asset to the project index (§47, entity ID → file path) and to vault change
detection ordering (§46), both slice 4/later concerns that get this for
free if the ID format is chosen now.

`core/identity/` provides only the generic mechanism — a branded ID type
and a generator — with no knowledge of `Zone`, `Project`, or any other
entity kind:

```text
EntityId<TBrand>          — an opaque, branded string
createEntityId(prefix)    — "<prefix>-<ULID>"
```

Concrete IDs (`ZoneId`, `ProjectId`, …) are defined per entity module in
slice 3, per the module pattern in §78 (`ZoneId.ts` sits beside `Zone.ts`) —
`core/identity/` is deliberately the one piece with zero domain vocabulary,
consistent with the layer rule (`core` may not import `domain`).

### Result pattern and error model

Expected business failures use `Result<T, E>`; unexpected technical failures
may still throw and get translated at an application boundary (§65) — this
slice only defines the typed side of that split.

The eight categories in §64 share one base shape (`category` discriminant,
a `code`, a `message`, and an optional `cause` for the underlying technical
error) rather than being eight unrelated interfaces, so that application
code can narrow on `category` uniformly:

```text
AppError =
  DomainError | ValidationError | PersistenceError | GeometryError
  | ImportError | MigrationError | ReferenceError | CalculationError
```

None of these enumerate their own `code` values here — that catalog is
per-module (e.g. a `ZoneRequiresMinVertices` validation code lives in
`domain/zone/Zone.errors.ts`, per §78's `Zone.errors.ts`), not a fixed list
this slice owns.

**Naming note:** `ReferenceError` (§64's own name) shadows the ambient
JavaScript global `ReferenceError`. TypeScript allows a local type to shadow
a global name, but implementers must not accidentally `throw new
ReferenceError(...)` expecting the domain type — that expression always
resolves to the built-in. Keep the domain type as a plain data interface
(never a `class ReferenceError extends Error`), which is what the
`Result`-based design already calls for and what avoids the collision ever
mattering at the value level.

§66's Error Boundary describes the full pipeline this type sits inside:

```text
Infrastructure Exception
        ↓
Application Error Mapping
        ↓
Typed Result          ← this slice ends here
        ↓
Presentation
        ↓
User Message
```

Only the "Typed Result" stage is this slice's concern. The mapping from a
thrown infrastructure exception into one of these categories, and from a
category into a user-facing message, is application/infrastructure wiring —
slice 4 does the former at the repository boundary, slice 11 does the
latter plus logging (§67–68).

### Event bus

An in-process, no-external-infrastructure bus (§33) — `publish`/`subscribe`
as generic pub/sub machinery, with `Disposable` as the unsubscribe handle.
This slice defines *only* the mechanism; the concrete event catalog (§34:
`ProjectCreated`, `ZoneCreated`, `ZoneGeometryChanged`, …) is introduced
alongside the entities that raise them, in slice 3, exactly as the module
pattern in §78 puts `Zone.events.ts` beside `Zone.ts`. `core/events/`
therefore has no knowledge of any concrete event type and cannot import
`domain/` (enforced the same way as every other core/domain boundary).

Two design decisions §33 leaves open, made explicit here:

- **`publish` is `Promise`-aware**, not purely synchronous. §32's own event
  chain (`ZoneGeometryChanged` → `RequirementInvalidated` →
  `RequirementRecalculated` → `CostEstimateChanged`) implies handlers that
  do real recalculation work, which may itself be asynchronous; a
  synchronous-only bus would force that work outside the publish call.
- **One handler's failure does not stop the others, or the publishing
  command.** Events are published *after* a successful state change (§32);
  a subscriber throwing must not look like the command itself failed, and
  must not prevent sibling subscribers from running. A rejected handler is
  caught at the bus and surfaced for slice 11's logging to pick up, not
  re-thrown to the publisher.

Both are stated as decisions, not quotes from the SDD, because §33 is silent
on them and a bus that guessed wrong here would be an awkward thing to
change once slice 3 has event handlers relying on it.

## Interfaces & Contracts

```typescript
// core/geometry/*.ts — plain, readonly value objects
interface Vector { readonly dx: number; readonly dy: number; }
interface Point { readonly x: number; readonly y: number; }
interface LineSegment { readonly start: Point; readonly end: Point; }
interface BoundingBox { readonly min: Point; readonly max: Point; }
interface Polyline { readonly points: readonly Point[]; }
interface Polygon { readonly points: readonly Point[]; } // implicit closing edge
interface Transform {
  readonly translation: Vector;
  readonly rotationRadians: number;
  readonly scale: number; // uniform only
}
```

```typescript
// core/geometry/Polygon.ts — the one validated entry point (§26's required
// rules: >= 3 vertices, finite coordinates, no NaN/Infinity). Every caller
// that turns raw points into a Polygon goes through this; the bare interface
// stays constructible so a tool can hold a partial buffer mid-gesture.
function createPolygon(points: readonly Point[]): Result<Polygon, GeometryError>;
```

```typescript
// core/geometry/operations.ts — pure functions, no mutation.
// Signatures shown once for Point/Polygon; translate/rotate/scale repeat
// identically for LineSegment, Polyline, and BoundingBox.

function distance(a: Point, b: Point): number;
function length(shape: LineSegment | Polyline): number;

function translate<T extends Point | LineSegment | Polyline | Polygon | BoundingBox>(
  shape: T,
  by: Vector,
): T;
function rotate<T extends Point | LineSegment | Polyline | Polygon | BoundingBox>(
  shape: T,
  radians: number,
  origin: Point, // required — no implicit (0,0) default
): T;
function scale<T extends Point | LineSegment | Polyline | Polygon | BoundingBox>(
  shape: T,
  factor: number,
  origin: Point,
): T;
function applyTransform<T extends Point | LineSegment | Polyline | Polygon | BoundingBox>(
  shape: T,
  transform: Transform,
): T; // composition order: scale, then rotate, then translate

function perimeter(polygon: Polygon): Result<number, GeometryError>;
function area(polygon: Polygon): Result<number, GeometryError>; // unsigned
function centroid(polygon: Polygon): Result<Point, GeometryError>; // area-weighted
function boundingBoxOf(shape: Polyline | Polygon): Result<BoundingBox, GeometryError>;
function contains(polygon: Polygon, point: Point): Result<boolean, GeometryError>;
function intersect(a: LineSegment, b: LineSegment): Result<Point | null, GeometryError>;
function project(point: Point, onto: LineSegment): Result<Point, GeometryError>;
```

```typescript
// core/units/WorldUnit.ts
/** 1 world unit = 1 millimeter. Domain geometry is always in this unit;
 *  pixel conversion happens only at the viewport boundary (§24, slice 5). */
```

```typescript
// core/identity/EntityId.ts
type EntityId<TBrand extends string> = string & { readonly __entityBrand: TBrand };

function createEntityId<TBrand extends string>(prefix: TBrand): EntityId<TBrand>;
// -> `${prefix}-${ulid()}`, e.g. "zone-01JABC7XG3QK9F8N2M4P6R5T0W"
```

```typescript
// core/result/Result.ts
type Result<T, E> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

function ok<T>(value: T): Result<T, never>;
function err<E>(error: E): Result<never, E>;
function isOk<T, E>(result: Result<T, E>): result is Readonly<{ ok: true; value: T }>;
function isErr<T, E>(result: Result<T, E>): result is Readonly<{ ok: false; error: E }>;
```

```typescript
// core/errors/AppError.ts
type ErrorCategory =
  | 'Domain' | 'Validation' | 'Persistence' | 'Geometry'
  | 'Import' | 'Migration' | 'Reference' | 'Calculation';

interface BaseError<TCategory extends ErrorCategory, TCode extends string = string> {
  readonly category: TCategory;
  readonly code: TCode;
  readonly message: string;
  readonly cause?: unknown;
}

type DomainError = BaseError<'Domain'>;
type ValidationError = BaseError<'Validation'>;
type PersistenceError = BaseError<'Persistence'>;
type GeometryError = BaseError<'Geometry'>;
type ImportError = BaseError<'Import'>;
type MigrationError = BaseError<'Migration'>;
type ReferenceError = BaseError<'Reference'>; // shadows the JS global — see Design
type CalculationError = BaseError<'Calculation'>;

type AppError =
  | DomainError | ValidationError | PersistenceError | GeometryError
  | ImportError | MigrationError | ReferenceError | CalculationError;
```

```typescript
// core/events/EventBus.ts
interface Disposable {
  dispose(): void;
}

interface DomainEvent<TType extends string = string> {
  readonly type: TType;
}

interface EventBus {
  publish<E extends DomainEvent>(event: E): Promise<void>;
  subscribe<TType extends string>(
    type: TType,
    handler: (event: DomainEvent<TType>) => void | Promise<void>,
  ): Disposable;
}
```

`DomainEvent<TType>` is the only shape `core/events/` knows: a discriminant
`type` field, nothing else. Slice 3's concrete events extend it with their
own literal `type` and payload fields; `core/` never imports those types.

## Persistence Impact

None directly. `core/` performs no Vault reads or writes — that is the
entire point of ADR-006. But its shapes are the wire format's raw material
one layer removed:

- `Polygon`/`Point` values, already in world-unit millimeters, are exactly
  what slice 4 serializes verbatim into the plan geometry sidecar (§39–40)
  — no unit conversion happens at that boundary, because none is needed.
- `EntityId` values are what slice 4 writes as the `id` field in Markdown
  frontmatter (§38) and as object IDs inside the geometry sidecar JSON
  (§40).
- `AppError`/`Result` are the types a slice 4 repository maps thrown
  Obsidian/Vault exceptions into (§66's "Application Error Mapping" stage).
- `EventBus` is what an application-layer command (slice 3+) publishes to
  *after* a repository confirms a write succeeded (§32) — the bus itself
  never touches persistence.

## Testing Strategy

Unit tests only — every type here is pure data or a pure function, so
nothing in this slice needs a component harness, jsdom, or an Obsidian
mock. This is the base of the SDD's own test pyramid (§69) and the
concrete tests §70 asks for under "Geometry": distance, area, perimeter,
centroid, transform. (Calibration and snapping, also listed under §70's
Geometry heading, are tested in slices 7 and 6 respectively, against the
services that own them — not here.)

Required coverage, derived from the contracts above:

- **`createPolygon`**: a boundary table over 0, 1, 2 and 3 points, a point
  carrying `NaN`, a point carrying `Infinity`, and a well-formed polygon —
  asserting `isErr` with a `GeometryError` for each rejected case. This is
  §26's required list, tested once here rather than at each of slice 8's
  three call sites.
- **Geometry**: each operation against at least one hand-computed case
  (e.g. a 3-4-5 right triangle for `area`/`perimeter`/`centroid`, an axis-
  aligned square for `boundingBoxOf`), plus the degenerate-input path for
  every operation that returns `Result` — a 2-point "polygon" for
  `area`/`perimeter`/`centroid`, an empty point list for `boundingBoxOf`, a
  zero-length segment for `intersect`/`project` — asserting `isErr` with a
  `GeometryError`, not a thrown exception or a silent `0`.
  `translate`/`rotate`/`scale`/`applyTransform` are tested for correctness
  (including that `applyTransform` composes in the documented
  scale→rotate→translate order) and for **not mutating their input**.
- **Identity**: `createEntityId` produces the `<prefix>-<ULID>` shape, two
  calls never collide, and IDs generated in sequence sort in generation
  order (the ULID sortability property slice 4/§47 depends on).
- **Result**: `ok`/`err` construction, `isOk`/`isErr` narrowing actually
  narrows (a compile-time check, not just a runtime assertion) for at least
  one representative success and one representative `AppError` category.
- **Event bus**: multiple subscribers to the same `type` all receive a
  published event; `dispose()` stops further delivery to that subscriber
  only; a subscriber that throws/rejects does not prevent sibling
  subscribers from running and does not reject the `publish` call itself.

None of this requires the repository contract test suites (§72) or an
integration test vault (§75) — those exercise slice 4 and later.

## Definition of Done

- [ ] `core/geometry/`, `core/units/`, `core/identity/`, `core/result/`,
      `core/errors/`, `core/events/` exist under `src/core/` per the layout
      above, with zero imports of `vue`, `pinia`, `konva`, `vue-konva`,
      `obsidian`, or any of `window`/`document`/`navigator`/`localStorage`/
      `sessionStorage`/`fetch`/`HTMLElement`/`Element`/`customElements`
      (verified by this repository's existing `eslint.config.mjs` rules for
      `core/**`, not a new check).
- [ ] All seven primitive types and all twelve operations named in §22 are
      implemented, immutable, and produce no side effects.
- [ ] The `Result`-vs-direct-return split above is implemented exactly as
      specified: no geometry operation throws on a mathematically
      undefined input, and no always-defined operation is wrapped in
      `Result` needlessly.
- [ ] `createPolygon` enforces the four of §26's required bullets that are
      properties of a point list (counted as three rules — see Design) and is
      the only exported way to obtain a validated `Polygon`; the boundary table
      above passes. §26's `valid unit` and `valid transform` are deliberately
      **not** here — they are slice 8's and slice 4's, per Design — and §26's
      "Future" rules (self-intersection, winding, repair) are not implemented
      and not stubbed.
- [ ] `core/units/` documents the 1-unit-=-1mm convention at the one place
      new contributors will look for it; no pixel/DPI conversion exists
      anywhere under `core/`.
- [ ] `createEntityId` produces IDs matching §82's `<prefix>-<ULID>` shape
      and is demonstrably lexicographically sortable by creation order.
- [ ] `Result<T, E>` and the eight `AppError` category types compile, are
      exported from `core/result/` and `core/errors/` respectively, and each
      category is exercised by at least one construction + narrowing test.
- [ ] `EventBus`/`Disposable` are implemented with the failure-isolation and
      `Promise`-aware behavior described above, and `core/events/` contains
      no reference to any concrete event name from §34.
- [ ] Every file above can be imported and its exports exercised in a
      Vitest suite with no Obsidian, Vue, or Konva present — the Increment 2
      success criterion (§91), scoped to these primitives.
- [ ] `npm run check` passes (build, lint including the architecture
      rules, coverage-gated tests, fallow) per this repository's existing
      Definition of Done.

## References

- SDD §7.1 — Core Layer
- SDD §22 — Geometry Core
- SDD §23 — World Coordinate System
- SDD §26 — Geometry Validation (the three *required* rules, implemented here
  as `createPolygon`; the "Future" rules and the editing-boundary behaviour
  are slice 8's)
- SDD §32 — Event Architecture (context for the bus's async/failure-isolation decisions)
- SDD §33 — Event Bus
- SDD §34 — Domain Events (catalog existence only; concrete events → slice 3)
- SDD §38 — Markdown Entity Model (ID format example)
- SDD §46–47 — Vault Change Detection, Project Index (motivates ULID sortability)
- SDD §64 — Error Model
- SDD §65 — Result Pattern
- SDD §66 — Error Boundary (shape only; full wiring → slice 11)
- SDD §69–70 — Testing Strategy, Unit Tests
- SDD §77 — Proposed Repository Structure
- SDD §78 — Internal Module Pattern
- SDD §81 — TypeScript Rules
- SDD §82 — Entity IDs
- SDD §91 — MVP Technical Increments (Increment 2)
- ADR-006 — Plain TypeScript Domain
- ADR-009 — World Coordinates in Millimeters
- `docs/design/README.md` — shared conventions and the slice map

# Design Slice 3: Domain Foundation — Project, Plan, Zone

## Purpose

Slice 2 gives the plugin generic, domain-free primitives (`Result<T,E>`, base error
types, the entity ID scheme, geometry, the `EventBus`). This slice spends them on the
first three real domain entities — Project, Plan, Zone — plus the application-layer
machinery (commands, events, queries, repository ports) needed to create, mutate, and
read them, entirely in memory.

This is the architectural proof point for the whole Domain/Application split: by the
end of this slice, a renovation project with a floor plan and a room zone can be
created, calibrated, moved, and queried in a Vitest test file that never imports
`obsidian`, `vue`, `pinia`, or `konva`. That is SDD Increment 2's success criterion
("Domain can be instantiated and tested without Obsidian"), scoped to the three
entities that increment names.

Everything here is throwaway-safe by design: no Vault I/O exists yet, so nothing
persisted in this slice needs a migration when Slice 4 introduces real repositories.

## Scope

### In scope

- The `Project`, `Plan`, and `Zone` entities: properties, invariants, and identity, as
  plain, framework-free TypeScript classes/factories.
- Domain modules `domain/project/`, `domain/plan/`, `domain/zone/`, following the
  module pattern (SDD §78), minus the persistence-facing pieces (see "Persistence
  Impact").
- Six concrete, non-undoable commands: `CreateProjectCommand`, `CreatePlanCommand`,
  `CalibratePlanCommand`, `CreateZoneCommand`, `MoveSpatialObjectCommand` (as it applies
  to a Zone), `DeleteZoneCommand` — each implementing `Command<TInput, TResult>` (SDD
  §29).
- Six domain events these commands emit: `ProjectCreated`, `PlanCreated`,
  `PlanCalibrated`, `ZoneCreated`, `ZoneGeometryChanged`, `ZoneDeleted` (SDD §34),
  published through Slice 2's `EventBus`.
- Three read-only queries: `GetProject`, `GetPlan`, `GetZone` (SDD §35), written
  against repository *interfaces* only.
- `ProjectRepository`, `PlanRepository`, `ZoneRepository` ports (SDD §36), and an
  `InMemory*Repository` implementation of each, sufficient to back the commands,
  queries, and this slice's own tests.
- A shared repository contract test suite per entity (SDD §72), run here against the
  in-memory implementations, written so Slice 4 can run the identical suite against
  the Obsidian-backed ones without modification.

### Out of scope (covered by other slices)

- Any other domain entity — Site, Spatial Object as a general base type, Construction
  Section, Asset, Requirement, Trade, Work Package, Task, Cost, Procurement, Supplier,
  Quote, Schedule, Document, Risk, Decision. These arrive with their own slices (9, 10,
  and PRD-epic feature work beyond this repo's slice map).
- Persistence of Project/Plan/Zone to the Obsidian Vault — frontmatter mapping, Zod
  schemas for the persisted DTO shape, JSON geometry sidecars, the Vault change
  pipeline, the Project Index. All of that is Slice 4 (SDD §35–47; ADR-002, ADR-011).
- Undo/redo — the `UndoableCommand` interface, `CommandHistory`, undo/redo stacks (SDD
  §30–31). This slice's commands are plain execute-only `Command<TInput, TResult>`;
  wrapping a subset of them for editor-gesture undo is Slice 6.
- Canvas rendering, Konva, viewport transforms, and any editor tool UI (Slices 5, 6,
  8) — this slice never renders a Zone's geometry, it only stores and validates it.
- The interactive calibration workflow (picking two points on a rendered background,
  live preview) — that UI is Slice 7. This slice only provides the domain command
  `CalibratePlanCommand` that the workflow will eventually call.
- Geometry validity beyond what Slice 2's `createPolygon` smart constructor already
  enforces (≥3 vertices, finite coordinates, no `NaN`/`Infinity` — SDD §26). Advanced
  polygon operations (`clipper2-ts`) and the spatial index (`rbush`) are explicitly
  deferred per the SDD and the slice map's "Explicitly deferred" list.
- `Money`'s own arithmetic and the measurement-unit vocabulary — Slice 9. This slice
  consumes `Money` as an opaque value type for `Project.budget`/`contingency` and never
  performs arithmetic on it, so it does not need Slice 9 to exist to be built; the
  budget fields simply stay `null` in every test fixture until it does.

## Dependencies

- **Slice 2 (Core Primitives)** — `Result<T,E>` and its `ok`/`err`/`isOk`/`isErr`
  functions, the base error hierarchy (SDD §64: `ValidationError`, `ReferenceError`,
  `GeometryError`, `CalculationError`, and friends), the entity ID scheme (branded
  `ProjectId`/`PlanId`/`ZoneId` strings, SDD §82), geometry primitives (`Point`,
  `Polygon`, `createPolygon`), and the generic, in-process `EventBus` (SDD §33). This
  slice only consumes those types — it does not redefine them.
- **Slice 9 (Quantity & Cost Engine)** — `Money` (ADR-010), referenced by type only.
  Slice 2 explicitly excludes `core/money/` from its own scope, so `Money` is slice 9's;
  see Out of scope for why that is not a build-order dependency.
- **ADR-001** (Markdown as Canonical Metadata Storage) — the reason `Zone` carries an
  optional domain-note link even though no note exists to link to until Slice 4.
- **ADR-006** (Plain TypeScript Domain) — every file in this slice's `domain/` and
  `application/` folders must be importable and testable with zero `obsidian`, `vue`,
  `pinia`, or `konva` in the module graph.
- **ADR-007** (Command-Based Mutations) — the `Command<TInput,TResult>` shape, and the
  explicit note that the `UndoableCommand` variant is a Slice 6 concern layered on top,
  not required here.
- **ADR-008** (Event-Aware Architecture) — commands publish events after a successful
  state change only, through the in-process `EventBus`.
- **ADR-009** (World Coordinates in Millimeters) — `Zone.geometry` and
  `Plan.calibration` both operate in world millimeters, never canvas pixels.
- **ADR-010** (Decimal Money Arithmetic) — `Project.budget` / `Project.contingency`
  use `Money`, never a raw `number`.
- **Slice 1 (Plugin Bootstrap & Composition Root)** — not a compile-time dependency
  (this slice's code has no Obsidian plugin to bootstrap into yet), but it is where
  Slice 4 will eventually wire these commands/queries/repositories to the running
  plugin. Nothing in this slice needs Slice 1 to exist to be built or tested.

## Design

### Entity relationships

```text
Project  1 ── n  Plan  1 ── n  Zone
  (root)         (belongs to           (belongs to exactly
                  exactly one           one Plan; may link
                  Project)              to a domain note)
```

Per PRD §59 (Entity Relationship Rules): "A Plan belongs to exactly one Project" and
"A Spatial Object belongs to one Plan and may link to a domain note." Zone is this
slice's only concrete Spatial Object (the general `spatial-object` domain module does
not exist yet — see Out of Scope), so that rule is realized here as: a Zone belongs to
exactly one Plan and may carry an optional, purely-navigational link to a Markdown
note (never identity — SDD §83).

**Denormalization decision:** SDD §36's own `ZoneRepository` example interface
includes `listByProject(projectId)`, i.e. zones are queried directly by project, not
only by plan. Rather than joining through Plan on every such query, `Zone` stores both
`planId` (its authoritative parent, immutable) and `projectId` (denormalized from
`plan.projectId` at creation time, also immutable — no command in this catalog moves a
Plan between Projects, so there's nothing to keep in sync later). `CreateZoneCommand`
is the single place this denormalization is populated; `Zone` itself does not know its
Plan and cannot re-derive `projectId`, so this is an application-layer invariant, not
an entity invariant.

**"Linked plans" is not a stored field.** PRD §8 lists "linked plans" as a Project
property, but nothing in this slice's command set ever adds a Plan to a Project after
the fact — `CreatePlanCommand` sets `Plan.projectId` once, and that's the one place
the relationship exists. Storing a mirrored `planIds` array on `Project` would be a
second source of truth that Slice 4's persistence layer would then have to keep
consistent across two Markdown notes. Instead, "linked plans" is resolved by querying
`PlanRepository.listByProject(projectId)` — the `Project` entity itself has no
`planIds` field. `GetProject`, as specified, returns the entity only, not a joined
list of Plans; a `ListPlansForProject`-shaped query, if a later slice's UI needs it, is
new surface built on the same `PlanRepository.listByProject`, not part of this slice.

### Entities

**Project** (root; PRD §8):

| Property | Type | Notes |
| --- | --- | --- |
| `id` | `ProjectId` | assigned at creation, immutable |
| `name` | `string` | required, non-empty (trimmed) |
| `description` | `string \| null` | free text |
| `status` | `ProjectStatus` | see note below |
| `start` | `Date \| null` | |
| `targetCompletion` | `Date \| null` | if both set, must be ≥ `start` |
| `budget` | `Money \| null` | ADR-010 |
| `contingency` | `Money \| null` | modeled as an absolute reserve amount, same currency as `budget` — the PRD lists it as a sibling field to budget with no stated formula, so this slice does not assume a percentage-of-budget relationship |
| `locationDescription` | `string \| null` | free text |

`ProjectStatus` values are bound to the Renovation Lifecycle stages the PRD defines
elsewhere (§35: `IDEA → SURVEY → DESIGN → ESTIMATE → PROCUREMENT → READY → EXECUTION →
INSPECTION → COMPLETE → AS_BUILT`). **Assumption:** the PRD names this lifecycle in a
section separate from Project's property list and never explicitly says it *is*
`Project.status`; this slice adopts that binding as the only lifecycle-shaped enum the
source material offers, defaulting new projects to `IDEA`. If a later slice needs a
different or additional status axis (e.g. per-Construction-Section phase), that's a
non-breaking addition, not a contradiction of this one.

**Plan** (PRD §8):

| Property | Type | Notes |
| --- | --- | --- |
| `id` | `PlanId` | immutable |
| `projectId` | `ProjectId` | immutable, set at creation |
| `name` | `string` | required, non-empty |
| `background` | `PlanBackgroundRef \| null` | a reference (Vault-relative path, `kind: 'image' \| 'pdf'`, and a page number for PDFs), not the raw image — file access is Slice 5, persistence is Slice 4. Named to match the type slice 5 declares and slice 4 persists; there is one background-reference type, not three |
| `calibration` | `Calibration \| null` | `{ pointA: Point, pointB: Point, knownDistance: number, pixelsPerWorldUnit: number }`; `null` until `CalibratePlanCommand` runs |
| `layers` | `readonly string[]` | ordered, unique names; visibility/rendering is Slice 5 |

The PRD lists "scale" and "coordinate system" as properties separate from a
calibration concept it doesn't name at the entity level. This slice folds both into
`calibration`: per ADR-009, a Plan's coordinate system is always "world millimeters,
established by calibration," so there is no independent `coordinateSystem` field, and
`pixelsPerWorldUnit` (SDD §25's own term for what the PRD calls "scale") is
calibration's derived output, not an independently settable field. This is a design
decision made to resolve that PRD ambiguity, not a value taken from the source
material.

This slice defines `Calibration` and a plain (non-undoable) `CalibratePlanCommand`
only far enough to make `Plan` a complete, testable in-memory entity. Slice 7
(Calibration) owns the type in full: the interactive `CalibrateTool`, recalibration
semantics, and upgrading `CalibratePlanCommand` to `UndoableCommand` once slice 6's
undo/redo exists — the same pattern slice 8 uses for the Zone commands below.

**Zone** (PRD §8):

| Property | Type | Notes |
| --- | --- | --- |
| `id` | `ZoneId` | immutable |
| `planId` | `PlanId` | immutable, set at creation |
| `projectId` | `ProjectId` | immutable, denormalized from `plan.projectId` at creation (see above) |
| `name` | `string` | required, non-empty |
| `zoneType` | `ZoneType` | `Room \| Garden \| Terrace \| Driveway \| Roof \| ConstructionArea \| Custom` — PRD §15's zone examples; **assumption:** the PRD gives examples, not a closed enum, so this is this slice's best-effort closure, with `Custom` as the escape hatch |
| `status` | `ZoneStatus` | `Planned \| InProgress \| Complete`; **assumption:** SDD §38's example frontmatter shows only `status: planned`, so `InProgress`/`Complete` are inferred, not sourced |
| `geometry` | `Polygon` | Slice 2 primitive, world millimeters (ADR-009); constructed only via `createPolygon`, which enforces ≥3 vertices, finite, no `NaN`/`Infinity` (SDD §26) |
| `domainNoteLink` | `string \| null` | opaque Markdown link/path; navigation only, never identity (SDD §83) |

Zone exposes derived `area()` and `perimeter()` computed on demand from `geometry` via
Slice 2's `Polygon` operations (PRD §8: "A Zone owns geometry and can expose derived
length and area") — these are **not** stored fields, so there is nothing to keep in
sync when geometry changes. Both return `Result<number, GeometryError>`, matching the
signature of the Slice 2 operations they delegate to. A `Zone`'s geometry came through
`createPolygon`, so in practice neither can fail; returning the delegate's own shape
rather than unwrapping it here means no caller has to trust a `Zone`-only exception to
that rule, and adding a future `Zone` factory path would not silently turn an
unwrapping into a crash.

All three entities are immutable value-shaped objects (readonly properties; SDD §81's
"readonly data where practical"). A mutation produces a new instance through a
`with*`-style method that re-validates invariants and returns a `Result`, e.g.
`zone.withGeometry(newPolygon): Result<Zone, GeometryError>`. Commands persist the
returned instance; nothing mutates an entity in place.

### Module layout

Per SDD §78's module pattern, adapted to this slice's scope — `<Entity>.schema.ts`
(the Zod schema for the *persisted* DTO) is deferred to Slice 4, since no persisted
shape exists yet to validate against:

```text
domain/project/
├── Project.ts
├── ProjectId.ts
├── ProjectStatus.ts
├── Project.errors.ts
└── Project.events.ts

domain/plan/
├── Plan.ts
├── PlanId.ts
├── Calibration.ts
├── Plan.errors.ts
└── Plan.events.ts

domain/zone/
├── Zone.ts
├── ZoneId.ts
├── ZoneType.ts
├── ZoneStatus.ts
├── Zone.errors.ts
└── Zone.events.ts

application/commands/project/
└── CreateProject.ts

application/commands/plan/
├── CreatePlan.ts
└── CalibratePlan.ts

application/commands/zone/
├── CreateZone.ts
├── MoveSpatialObject.ts
└── DeleteZone.ts

application/queries/
├── GetProject.ts
├── GetPlan.ts
└── GetZone.ts

application/ports/
├── ProjectRepository.ts
├── PlanRepository.ts
└── ZoneRepository.ts
```

`InMemory*Repository` implementations live under
`infrastructure/persistence/in-memory/` — they are not test-only scaffolding to be
deleted once Slice 4 lands. SDD §72 explicitly expects contract test suites reusable
across "InMemory repositories" and "Obsidian repositories," which only works if both
implementations persist as first-class, permanently-maintained code.

### Command → event mapping

Six commands, six events, one-to-one on the success path:

| Command | Input (essentials) | Event on success | Failure modes (SDD §64 categories) |
| --- | --- | --- | --- |
| `CreateProjectCommand` | `name`, optional `description`/`status`/dates/`budget`/`contingency`/`locationDescription` | `ProjectCreated` | `ValidationError`, `PersistenceError` |
| `CreatePlanCommand` | `projectId`, `name`, optional `background`/`layers` | `PlanCreated` | `ValidationError`, `ReferenceError` (project not found), `PersistenceError` |
| `CalibratePlanCommand` | `planId`, `pointA`, `pointB`, `knownDistance` | `PlanCalibrated` | `ReferenceError` (plan not found), `ValidationError` (distance ≤ 0), `CalculationError` (`pointA` = `pointB`, division by zero), `PersistenceError` |
| `CreateZoneCommand` | `planId`, `name`, `zoneType`, `geometry`, optional `domainNoteLink` | `ZoneCreated` | `ReferenceError` (plan not found), `ValidationError`, `GeometryError`, `PersistenceError` |
| `MoveSpatialObjectCommand` | `zoneId`, `geometry` (full replacement) | `ZoneGeometryChanged` | `ReferenceError` (zone not found), `GeometryError`, `PersistenceError` |
| `DeleteZoneCommand` | `zoneId` | `ZoneDeleted` | `ReferenceError` (zone not found), `PersistenceError` |

Every command's repository call (`save`/`delete`) returns `Result<void, PersistenceError>`
(see `ZoneRepository`/`PlanRepository`/`ProjectRepository` below), and every command
inspects that result and returns it — without publishing an event or reporting
success — before doing anything else. A failed in-memory write can't actually happen
in this slice's own `InMemory*Repository`, but the interface commits to this shape now
so Slice 4's real, fallible Obsidian-backed repositories are a drop-in swap, not an
interface change that would otherwise force every caller in this file to be revisited.

`MoveSpatialObjectCommand` takes its name from SDD §29's example list. In this slice
it operates on `Zone` only, because Zone is the only concrete spatial object that
exists; the general `spatial-object` domain module (which would let this command
target Walls, Doors, etc.) is not part of this slice's scope. It always replaces the
whole geometry rather than applying a delta — "move" vs. "resize" is a UI/tool-level
distinction (Slices 6/8: which handle the user dragged), collapsing to the same
domain operation here. `ResizeSpatialObjectCommand` from the same SDD list is not
introduced by this slice — no editor gesture needs it yet (slice 8 covers Zone
resize via the same "move vs. resize is UI-level" collapse `MoveSpatialObjectCommand`
already uses). `DeleteZoneCommand`, by the same "Zone-only, general SDD name kept
where the concrete entity name reads just as well" choice, is this slice's plain,
non-undoable version of the SDD's `DeleteSpatialObjectCommand` (`ZoneDeleted` on
success); slice 8 wraps it in an `UndoableCommand` once slice 6's undo/redo exists,
the same upgrade `CalibratePlanCommand` gets from slice 7.

Every command follows the same shape: load referenced parent/target entities via
repository ports, validate, construct/derive the new entity state via the entity's own
factory or `with*` method (which enforces invariants and returns `Result`), persist
via `repository.save`, then — **only on success** — publish exactly one event via the
injected `EventBus`. A failed command never calls `save` and never publishes.

## Interfaces & Contracts

```typescript
// Shared command shape (SDD §29) — no UndoableCommand here (that's Slice 6).
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}

// Shared query shape (SDD §35) — read-only, no event emission.
interface Query<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}
```

```typescript
// domain/project/Project.ts
class Project {
  private constructor(
    readonly id: ProjectId,
    readonly name: string,
    readonly description: string | null,
    readonly status: ProjectStatus,
    readonly start: Date | null,
    readonly targetCompletion: Date | null,
    readonly budget: Money | null,
    readonly contingency: Money | null,
    readonly locationDescription: string | null,
  ) {}

  static create(props: CreateProjectProps): Result<Project, ValidationError> { /* … */ }
}
```

```typescript
// domain/plan/Plan.ts
class Plan {
  private constructor(
    readonly id: PlanId,
    readonly projectId: ProjectId,
    readonly name: string,
    readonly background: PlanBackgroundRef | null,
    readonly calibration: Calibration | null,
    readonly layers: readonly string[],
  ) {}

  static create(props: CreatePlanProps): Result<Plan, ValidationError>;
  withCalibration(calibration: Calibration): Result<Plan, ValidationError | CalculationError>;
}
```

```typescript
// domain/zone/Zone.ts
class Zone {
  private constructor(
    readonly id: ZoneId,
    readonly planId: PlanId,
    readonly projectId: ProjectId,
    readonly name: string,
    readonly zoneType: ZoneType,
    readonly status: ZoneStatus,
    readonly geometry: Polygon,
    readonly domainNoteLink: string | null,
    // No version field. Concurrency bookkeeping travels beside the entity in
    // `Loaded<Zone>`, not inside it — see "Writes are conditional". A draft put
    // `revision` here, which reads naturally until the version grows a second half
    // that is a content digest: an infrastructure artefact on a domain object, in the
    // layer that may not name infrastructure at all. Project and Plan carry none
    // either, for the same reason.
  ) {}

  static create(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError>;
  withGeometry(geometry: Polygon): Result<Zone, GeometryError>;

  area(): Result<number, GeometryError>;      // mm², delegates to Polygon
  perimeter(): Result<number, GeometryError>; // mm, delegates to Polygon
}
```

```typescript
// application/commands/zone/CreateZone.ts — representative full example
interface CreateZoneInput {
  planId: PlanId;
  name: string;
  zoneType: ZoneType;
  geometry: Polygon;
  domainNoteLink?: string;
}

class CreateZoneCommand
  implements Command<CreateZoneInput, Result<{ zone: Loaded<Zone> }, ValidationError | ReferenceError | GeometryError | PersistenceError>>
{
  constructor(
    private readonly zones: ZoneRepository,
    private readonly plans: PlanRepository,
    private readonly events: EventBus,
  ) {}

  async execute(input: CreateZoneInput) {
    // Every repository method resolves a Result (see ports below), so a read is
    // inspected the same way a write is: `ok(null)` means "no such Plan",
    // `isErr` means the read itself failed. Conflating the two would report a
    // Vault failure as a missing parent.
    const planResult = await this.plans.getById(input.planId);
    if (isErr(planResult)) return planResult;
    if (planResult.value === null) {
      return err(referenceError('zone.plan-not-found', `Plan ${input.planId} not found`));
    }

    const zoneResult = Zone.create({ ...input, projectId: planResult.value.projectId });
    if (isErr(zoneResult)) return zoneResult;

    const zone = zoneResult.value;
    // 'absent': this is a create, so a Zone already holding this ID is a conflict,
    // not something to overwrite (see "Writes are conditional").
    const saveResult = await this.zones.save(zone, 'absent');
    if (isErr(saveResult)) return saveResult; // never publish or report success on a failed write

    await this.events.publish(zoneCreated({
      zoneId: zone.id,
      planId: zone.planId,
      projectId: zone.projectId,
    }));
    return ok({ zone });
  }
}
```

Two spellings in that example are load-bearing rather than stylistic, and are the
shared vocabulary every other slice's examples follow (`docs/design/README.md`):

- `isErr(result)` / `ok(...)` / `err(...)` are slice 2's free functions. `Result` is a
  plain discriminated union with an `.ok` field — it has no `.isErr()` method and no
  `Result.ok(...)` namespace to call.
- `referenceError(...)` / `zoneCreated(...)` are factory functions returning plain
  data. Slice 2's error categories and events are interfaces, never classes: writing
  `new ReferenceError(...)` would construct JavaScript's own global `ReferenceError`,
  which is exactly the collision slice 2's naming note warns about.

```typescript
// application/commands/zone/MoveSpatialObject.ts — signature only; every
// command below follows CreateZoneCommand's pattern above: check each
// repository call's Result and return early on failure before publishing.
// `expected` is optional and absent in this slice: a fresh gesture asserts where the
// shape should now be and is last-writer-wins, so the handler saves with the version its
// own load returned. Slice 6's undo/redo supplies it — an inverse claims "nothing has
// happened since", which is a claim only a compare-and-swap can check — and the handler
// passes it straight through to `save`. The field arrives without changing this slice's
// behaviour, exactly as `DeleteZoneInput.resolution` does.
//
// It is the whole `EntityVersion`, not a bare revision number. A number alone expresses
// only "no plugin wrote this", so an inverse carrying one would be conditional on
// exactly the half of the contract that a hand edit slips past — the case the token
// exists for. The two travel together everywhere or the pair means nothing.
interface MoveSpatialObjectInput {
  zoneId: ZoneId;
  geometry: Polygon;
  expected?: EntityVersion;
}
// The payload is `{ zone: Loaded<Zone> }`, not `{ zone: Zone }` — every command that
// writes returns what the repository returned, version included. This is not
// decoration: slice 6's adapters make each operation conditional on the version their
// OWN previous write produced, and a payload that dropped it would leave them re-reading
// to find one, which is the check-then-act the whole contract exists to remove. The rule
// is "a write hands back what it wrote", and it applies to every command below.
class MoveSpatialObjectCommand
  implements Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | PersistenceError>> { /* … */ }

// application/commands/zone/DeleteZone.ts
// Slice 10 widens this input with an optional reference `resolution` once Requirement
// exists to reference a Zone — the deferral slice 8 makes explicit. Absent (the only
// possibility in this slice, where nothing references a Zone) means "refuse if
// referents exist", so the field arrives without changing this slice's behaviour.
// `expected`, like MoveSpatialObjectInput's, is absent for a user-initiated delete (the
// handler deletes with the version its own load returned) and supplied by slice 8's
// undo-a-creation, which must refuse if the Zone changed after it was created.
interface DeleteZoneInput { zoneId: ZoneId; expected?: EntityVersion }
class DeleteZoneCommand
  implements Command<DeleteZoneInput, Result<{ zoneId: ZoneId }, ReferenceError | PersistenceError>> { /* … */ }

// application/commands/plan/CalibratePlan.ts — plain command for this slice;
// Slice 7 upgrades this to UndoableCommand once slice 6's undo/redo exists.
interface CalibratePlanInput {
  planId: PlanId;
  pointA: Point;
  pointB: Point;
  knownDistance: number;
}
class CalibratePlanCommand
  implements Command<CalibratePlanInput, Result<{ plan: Plan }, ReferenceError | ValidationError | CalculationError | PersistenceError>> { /* … */ }
```

```typescript
// domain/zone/Zone.events.ts — representative; Project/Plan events follow the same shape.
// The discriminant field is `type`, because that is what slice 2's DomainEvent<TType>
// declares and what EventBus.subscribe(type, handler) matches on. A `name` field here
// would compile as a structurally different type the bus could never dispatch.
interface ZoneEventPayload { readonly zoneId: ZoneId; readonly planId: PlanId; readonly projectId: ProjectId }

interface ZoneCreated extends DomainEvent<'ZoneCreated'> { readonly payload: ZoneEventPayload }
interface ZoneGeometryChanged extends DomainEvent<'ZoneGeometryChanged'> { readonly payload: ZoneEventPayload }
interface ZoneDeleted extends DomainEvent<'ZoneDeleted'> { readonly payload: ZoneEventPayload }

// Each ships a factory beside it, for the same reason the errors do: these are plain
// data, never classes, so there is nothing to `new`.
function zoneCreated(payload: ZoneEventPayload): ZoneCreated;
```

```typescript
// application/ports/ZoneRepository.ts — SDD §36 shows every method returning a bare
// value or Promise<void>, but Slice 4's real Obsidian-backed implementation can fail
// on EVERY method: a read is a Vault file read plus a Zod parse, not a Map lookup.
// So the Result wrapper goes on reads as well as writes, declared once here. This is
// the whole point of declaring the port in this slice rather than in Slice 4: a
// signature Slice 4 has to widen is a signature every caller in this file has to be
// revisited for, which is precisely the churn the port exists to prevent.
//
// "Not found" is `ok(null)`, never an error — a missing entity is a legitimate answer
// to a lookup, while `isErr` means the lookup itself did not happen. A command that
// wants a missing parent to be a failure raises its own ReferenceError (see
// CreateZoneCommand above); the repository does not decide that for it.
// Every read returns the entity WITH the version the reader observed, and every
// mutating method takes the version the caller expects to still be current — see
// "Writes are conditional" below. All three types are declared once and shared by
// every entity port in the codebase.

// Opaque, minted by the repository, never parsed or compared by anything above
// infrastructure. Slice 4 derives it from the plugin-owned frontmatter it read.
type ObservationToken = string & { readonly __brand: 'ObservationToken' };

interface EntityVersion {
  readonly revision: number;          // persisted in the note; bumped by plugin writes
  readonly observed: ObservationToken; // what the bytes looked like when THIS read ran
}

// Reads hand back a pair, not a bare entity: the version is the store's bookkeeping
// ABOUT the entity, not part of it, and a domain object carrying a content digest
// would put an infrastructure detail inside the pure layer. `null` is still the whole
// answer for "not found" — there is no version of an entity that is not there.
interface Loaded<T> { readonly entity: T; readonly version: EntityVersion }

type Expected = EntityVersion | 'absent';

interface ZoneRepository {
  getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, PersistenceError>>;
  save(zone: Zone, expected: Expected): Promise<Result<Loaded<Zone>, PersistenceError | ValidationError>>;
  delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
  listByProject(projectId: ProjectId): Promise<Result<Loaded<Zone>[], PersistenceError>>;
  listByPlan(planId: PlanId): Promise<Result<Loaded<Zone>[], PersistenceError>>;
}

// application/ports/PlanRepository.ts — extended by analogy with ZoneRepository;
// SDD only gives the Zone example, so listByProject here is this slice's own
// consistent extension, not a sourced requirement.
interface PlanRepository {
  getById(id: PlanId): Promise<Result<Loaded<Plan> | null, PersistenceError>>;
  save(plan: Plan, expected: Expected): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>>;
  delete(id: PlanId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
  listByProject(projectId: ProjectId): Promise<Result<Loaded<Plan>[], PersistenceError>>;
}

// application/ports/ProjectRepository.ts — root aggregate, so listAll rather than
// listByX. listAll has no consumer until slice 14's ListProjects query; it is declared
// now because the port is declared once, not grown one caller at a time.
interface ProjectRepository {
  getById(id: ProjectId): Promise<Result<Loaded<Project> | null, PersistenceError>>;
  save(project: Project, expected: Expected): Promise<Result<Loaded<Project>, PersistenceError | ValidationError>>;
  delete(id: ProjectId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
  listAll(): Promise<Result<Loaded<Project>[], PersistenceError>>;
}
```

### Writes are conditional

Every read hands the caller an `EntityVersion` alongside the entity, and every mutating
method takes the version the caller expects to still be current. The repository compares
and writes as **one** operation, serialized per entity ID, and refuses with a
`ValidationError` when what it finds does not match. `save` returns the entity with the
version it just wrote, so a caller that writes twice never has to re-read to find out
what it did. `'absent'` means "insert, and fail if something is already there", which is
what makes restoring a deleted entity safe rather than a blind overwrite of whatever now
holds that ID.

This is declared here, in the port, for exactly the reason the `Result` wrapper is: a
signature Slice 4 has to widen is one every caller has to be revisited for. It is not an
Obsidian detail — an `InMemory*Repository` implements the same compare, and the contract
suite (§72) tests both against it.

Why it is needed at all, given commands are dispatched one at a time within a view: a
command history is view-local (slice 6) and two Plan Editors can be open at once, so
"read, decide, write" is never safe across them — a snapshot-restoring undo is the
sharpest case, but any read-modify-write has it. Making the comparison part of the write
is the only place it can be made atomic; a caller cannot achieve it from outside no
matter how carefully it re-reads.

### The revision only sees writers that bump it

`revision` is a plugin-owned field, so comparing it detects a writer that went through a
repository and nothing else. ADR-001 makes every entity a Markdown note the user is
invited to edit, and a note edited in Obsidian's own editor comes back with its prose or
its frontmatter changed and its `revision` **untouched** — so a caller's stale expectation
still matches, the compare passes, and the plugin overwrites the edit it was supposed to
notice. Sync inherits the same hole: a file synced from another device carries whatever
`revision` that device's *plugin* last wrote, which is bumped if a command made the
change and unchanged if a person did. An earlier draft of this section listed hand edits
and sync among the cases the revision comparison protects. It does not protect them, and
naming a hazard is not covering it.

So an `EntityVersion` carries two things and the atomic write makes **two** comparisons:

```text
inside the serialized compare-and-write, per entity ID:

  1. expected.revision   vs  the stored revision
         differs → ValidationError <entity>.revision-conflict
         "another writer moved this since you read it"

  2. expected.observed   vs  a token minted from what it just read
         differs → ValidationError <entity>.external-modification
         "something that is not this plugin changed this note"
```

`observed` is minted by the repository from the plugin-owned frontmatter at the moment of
a read, and handed out with that read. It is the caller's, not the repository's — and
that distinction is the whole mechanism, not a detail of where the value is stored. A
draft of this section kept ONE current digest per entity inside the repository, refreshed
on every read and write. That is not an expectation, because anybody's read moves it: A
reads, the note is hand-edited, a status-bar query or a second tab reads, and the shared
baseline now matches the hand-edited disk. A's stale save then passes both comparisons and
eats the edit — the exact defect the digest was added to prevent, reintroduced by making
it shared. A value that says "what *this* reader saw" cannot be stored anywhere but with
that reader.

Five things about it are worth stating rather than leaving to be discovered:

- **The digest covers the plugin-owned frontmatter keys, not the note.** Slice 4 leaves
  the body untouched on every write and never parses it (§38) — it is the user's. A
  plugin write that refused because the user typed a sentence under the frontmatter would
  make the plugin unusable, and would be refusing over something it cannot lose.
- **Unknown frontmatter keys are outside the digest too**, for the same reason and by the
  same rule slice 4 already follows: it preserves keys this version does not declare, so
  it must not conflict over them either.
- **`'absent'` carries no token.** The comparison there is existence, and a reader who
  found nothing observed nothing.
- **The token is opaque above `infrastructure/`.** Nothing in `application/` or
  `domain/` parses, orders or compares one — it is threaded from the read that produced
  it to the write that presents it, and only slice 4 knows it is a digest. Changing how
  it is computed is then a change to one function, not to a contract.
- **Both halves are needed, and the pair is what makes the two errors separable.** A
  matching revision with a differing token is precisely "no plugin wrote this, but it
  changed" — an external edit. A differing revision is a plugin writer. The digest alone
  would detect both and be able to name neither.

The two errors are distinct codes because the recovery differs, and a UI that could only
say "conflict" would have to guess: a `revision-conflict` is resolved by re-reading and
retrying, while an `external-modification` means the user's own edit is on disk and the
question to put to them is whose version wins (slices 11 and 15 own that surface).

### What this costs the callers, and why it is still right

Threading a version from a read to a write is more ceremony than passing an entity around,
and it is worth being explicit that the ceremony is the feature. A caller that cannot
produce a version is a caller that never read the thing it is about to overwrite, and that
is the case worth making noisy rather than convenient. The two shapes it takes:

- **A command that loads, decides and writes** carries the `Loaded<T>` it read and passes
  `loaded.version` to `save`. Nothing is stored between calls.
- **An `UndoableCommand`** (slice 6) keeps the version its own last successful write
  returned, and presents that on the next operation — the rule that makes an inverse
  conditional on the write it inverts.

A read-only caller ignores `.version` entirely. Queries (below) return `Loaded<T>` rather
than unwrapping, so a query result can be handed to a write without a second read; a
presentation-layer consumer that wants the entity takes `.entity` and never sees the rest.

One thing deliberately does **not** get a version: a targeted single-field marker like
`markStale` (slice 10), which moves one field in one direction and cannot lose
information by being applied twice.

**The plan geometry sidecar is not the second one.** A draft exempted it on the grounds
that slice 4's per-plan `PlanGeometryStore.mutate` lock already guards `objects[]`. That
is the mistake this whole section is about, stated one more time: a lock makes writes
*ordered*, and ordering says a move and a later undo do not interleave — not that the
move did not happen. Slice 7's calibration undo is the case that proves it, since it
restores pre-calibration geometry for every object in the file and would silently discard
a Zone another editor moved in between.

So the sidecar carries an `EntityVersion` too — **the same type, not an analogous one**.
Its `revision` is one integer for the whole file, bumped by every `mutate`; its
`observed` is a token minted per read from the file's contents. A first attempt gave it
only the counter, under the name `generation`, which repeats the first mistake at one
remove: a counter is plugin-owned, so a `.rpgeo` file hand-edited or synced from a device
where a person edited it comes back at the same generation with different geometry, and
an undo comparing integers sees a match and restores over it. ADR-011 makes these files
visible and openable in Obsidian *on purpose* — hand-editing them is a supported thing to
do, not an edge case — so a sidecar expectation without a content token is exactly as
false as a note expectation without one.

One version for the file rather than one per object, because a sidecar write rewrites the
whole document; per-object versions would describe a granularity the write does not have.
And one *type* rather than a parallel vocabulary, because two near-identical version
shapes is where the next exception hides — the reason `revision` is the field name here
even though "generation" reads more naturally for a file.

A `mutate` that does not care — an ordinary Zone save appending its own object entry —
passes no expectation and is last-writer-wins, exactly as a forward gesture is. Only a
caller claiming "nothing has changed since I read this" has to prove it.

`save()` is an **ID-keyed upsert**, not insert-only, on every implementation. Slice 8's
`ReversibleDeleteZoneCommand.undo()` restores a deleted entity by writing its captured
snapshot back through `save()`, and a restore that minted a new ID would not be an undo.
This is part of the port's contract, so it is asserted in the shared contract suite
below rather than left as an assumption slice 8 discovers.

```typescript
// application/queries/GetZone.ts — representative; GetProject/GetPlan follow the same
// shape. A query PASSES THROUGH the repository's "not found is ok(null)" answer rather
// than converting it into a ReferenceError: a caller asking "is there a Zone with this
// id" is asking a question, not asserting there must be one. Slice 14's empty-state
// selectors depend on being able to tell "no such entity" (ok(null)) apart from "the
// read failed" (isErr) — collapsing both into one error type makes that impossible.
// It returns `Loaded<Zone>` rather than unwrapping to the entity, so a caller that
// loads in order to write has the version already and never reads twice. A caller that
// only renders takes `.entity` and ignores the rest.
interface GetZoneInput { zoneId: ZoneId }
class GetZone implements Query<GetZoneInput, Result<Loaded<Zone> | null, PersistenceError>> {
  constructor(private readonly zones: ZoneRepository) {}
  async execute({ zoneId }: GetZoneInput) {
    return this.zones.getById(zoneId);
  }
}
```

```typescript
// infrastructure/persistence/in-memory/InMemoryZoneRepository.ts
class InMemoryZoneRepository implements ZoneRepository {
  // Entity and version stored together; nothing outside gets one without the other.
  private readonly store = new Map<ZoneId, Loaded<Zone>>();

  async getById(id: ZoneId) { return ok(this.store.get(id) ?? null); }

  // Implements the same conditional contract as the Obsidian one — an in-memory
  // repository that skipped the compare would let the contract suite (§72) pass
  // against an implementation that cannot hold the invariant. `observed` is a counter
  // here rather than a digest: the contract is "a token that changes when the stored
  // bytes change from any cause", and how it is derived is each implementation's own
  // business. The counter advances on an out-of-band `poke()` this fake exposes for
  // exactly one purpose — letting the contract suite simulate the hand edit that
  // slice 4's implementation detects for real.
  async save(zone: Zone, expected: Expected) {
    const current = this.store.get(zone.id);
    const conflict = this.check(zone.id, current, expected);
    if (conflict) return err(conflict);
    const written: Loaded<Zone> = {
      entity: zone,
      version: {
        revision: (current?.version.revision ?? 0) + 1,
        observed: this.mint(),
      },
    };
    this.store.set(zone.id, written);
    return ok(written);
  }

  async delete(id: ZoneId, expected: EntityVersion) {
    const conflict = this.check(id, this.store.get(id), expected);
    if (conflict) return err(conflict);
    this.store.delete(id);
    return ok(undefined);
  }

  // One comparison, used by both mutating methods — the property is "every write is
  // conditional", and a second copy of the compare is a second chance to get it wrong.
  private check(id: ZoneId, current: Loaded<Zone> | undefined, expected: Expected) {
    if (expected === 'absent') {
      return current === undefined ? null : revisionConflict('zone', id);
    }
    if (current === undefined || current.version.revision !== expected.revision) {
      return revisionConflict('zone', id);
    }
    // Revision matches but the bytes moved: not a plugin writer. Distinct error,
    // because the caller's recovery differs — see above.
    if (current.version.observed !== expected.observed) {
      return externalModification('zone', id);
    }
    return null;
  }

  async listByProject(projectId: ProjectId) {
    return ok([...this.store.values()].filter((z) => z.entity.projectId === projectId));
  }
  async listByPlan(planId: PlanId) {
    return ok([...this.store.values()].filter((z) => z.entity.planId === planId));
  }
}
```

An in-memory implementation can never actually produce `isErr` on any of these. It
returns `Result` anyway because the port, not the implementation, is the contract — and
because the alternative (a narrower in-memory signature) would let a command compile
against the fake while failing against the real one, which is the exact drift the shared
contract suite below exists to catch.

## Persistence Impact

None yet — proven via in-memory repository; see Slice 4. No Markdown note, YAML
frontmatter, JSON geometry sidecar, or Vault file is read or written by anything in
this slice. `InMemory*Repository` is a `Map`-backed stand-in for the ports Slice 4's
`ObsidianProjectRepository` / `ObsidianPlanRepository` / `ObsidianZoneRepository` will
implement against the same `application/ports/*Repository` interfaces defined here —
so nothing in `application/` (commands, queries) changes when Slice 4 lands; only the
repository implementation swaps at the composition root.

## Testing Strategy

- **Entity unit tests** — `Project.create`, `Plan.create`/`withCalibration`,
  `Zone.create`/`withGeometry` each tested for: valid construction succeeds; empty
  name is rejected (`ValidationError`); `Project`'s `targetCompletion` before `start`
  is rejected; `Zone`'s geometry with <3 vertices or non-finite coordinates is
  rejected (`GeometryError`, delegating to Slice 2's `createPolygon`);
  `Calibration` with `pointA === pointB` or `knownDistance <= 0` is
  rejected.
- **Command tests**, per SDD §71's pattern (`Command → InMemoryRepository →
  Assertions`) — for each of the six commands: the success path returns `ok(...)`
  with the expected entity, persists it (retrievable via the same in-memory
  repository's `getById`), and publishes exactly one event of the correct type and
  payload; every domain-validation failure path (bad input, missing parent) returns
  a failed `Result` with the correct SDD §64 error category and performs **no** `save` and
  **no** `publish` (asserted via a spy `EventBus` and by re-querying the repository).
- **Repository-failure propagation tests** — for each command that calls `save`/
  `delete`, wrap the in-memory repository with a decorator whose `save`/`delete`
  resolves `err(persistenceError(...))`, and assert the command returns that same
  error, publishes **no** event, and the repository's own store is left as the decorator
  produced it (not silently treated as success). This is the regression test for a save
  failure being discarded and success reported anyway. A second decorator does the same
  for `getById`, since reads are equally fallible under the port above — asserting the
  command surfaces the read failure rather than mistaking it for a missing parent.
- **Query tests** — `GetProject`/`GetPlan`/`GetZone` return `ok(entity)` for an entity
  seeded directly into the repository (independent of any command), `ok(null)` for a
  missing id, and pass a repository `isErr` straight through — proving the queries are
  repository-agnostic and that the two "no entity came back" cases stay distinguishable.
- **Repository contract tests** (SDD §72) — one shared suite per entity, named
  `zoneRepositoryContract(makeRepository: () => ZoneRepository)` and living at
  `tests/contracts/zone-repository.contract.ts` (the naming slice 12's harness fixes for
  every contract suite), exercising `getById`/`save`/`delete`/`listByProject`/
  `listByPlan` against whatever instance is passed in — including that `save` upserts by
  ID rather than inserting, the property slice 8's undo depends on. This slice runs each
  suite against its `InMemory*Repository`; Slice 4 imports the identical suite and runs
  it against the Obsidian-backed implementation, unmodified.
- **Environment** — the entire suite runs under Vitest in a plain Node environment.
  No `obsidian`, `vue`, `pinia`, `konva`, or DOM API may appear anywhere in the
  `domain/` or `application/` code exercised by these tests (enforced by the ESLint
  `no-restricted-imports` rule from ADR-006 / SDD §76, and verifiable by running the
  suite with the `obsidian` module absent from `node_modules`).

## Definition of Done

- [ ] `Project`, `Plan`, `Zone` entities exist under `domain/project/`, `domain/plan/`,
      `domain/zone/` (SDD §78 pattern, `.schema.ts` deferred to Slice 4), each as
      immutable objects constructed via a `Result`-returning factory that enforces its
      invariants.
- [ ] `CreateProjectCommand`, `CreatePlanCommand`, `CalibratePlanCommand`,
      `CreateZoneCommand`, `MoveSpatialObjectCommand`, `DeleteZoneCommand` all
      implement `Command<TInput, TResult>` (SDD §29) — none implement
      `UndoableCommand`.
- [ ] `ProjectCreated`, `PlanCreated`, `PlanCalibrated`, `ZoneCreated`,
      `ZoneGeometryChanged`, `ZoneDeleted` are defined and are published through
      Slice 2's `EventBus` on, and only on, each corresponding command's success path.
- [ ] Every command inspects every `Result` a repository hands back — reads as well as
      writes — and returns it unpublished on failure. A failing repository call can
      never be reported as success, produce an event, or be mistaken for `ok(null)`.
- [ ] `GetProject`, `GetPlan`, `GetZone` are implemented against the repository *port*
      types only, with no reference to any concrete repository implementation, and
      return `Result<T | null, PersistenceError>` — "not found" is `ok(null)`.
- [ ] `ProjectRepository`, `PlanRepository`, `ZoneRepository` ports are defined in
      `application/ports/`, with every method `Result`-returning, each with a passing
      `InMemory*Repository` implementation and a shared repository contract test suite
      that is written to be reusable, unmodified, by Slice 4 — no method signature
      changes when Slice 4 lands.
- [ ] Every error and event value in this slice is built by a factory function
      returning plain data; `new` appears nowhere in an error or event construction,
      and no file declares `class ReferenceError`.
- [ ] A project can be created, a plan created under it and calibrated, and a zone
      created under the plan, moved, and deleted — all in a single Vitest file, using
      only `InMemory*Repository` instances, with zero Obsidian API surface touched.
      This is the concrete, scoped-down form of Increment 2's success criterion.
- [ ] Every command's failure paths are covered by a test asserting a failed `Result` with
      the correct SDD §64 error category, no repository mutation, and no event
      published.
- [ ] The dependency-direction lint rule (ADR-006, SDD §76) passes for every file
      introduced in this slice.

## References

- SDD §7.2 (Domain Layer) — module contents (entities, value objects, domain
  services, domain events, business rules, schemas).
- SDD §22 (Geometry Core) and §23 (World Coordinate System) — `Polygon`/`Point` and
  world-millimeter units consumed, not redefined, here.
- SDD §25 (Calibration) — the two-point/known-distance model behind
  `Calibration`/`CalibratePlanCommand`.
- SDD §26 (Geometry Validation) — the minimum polygon validity this slice relies on
  from Slice 2; self-intersection/repair explicitly deferred.
- SDD §29 (Command Architecture) — the `Command<TInput, TResult>` interface and
  example command names this slice implements a subset of.
- SDD §30–31 (Undoable Editor Commands; Transaction Boundary) — cited only to draw
  the boundary excluding `UndoableCommand` from this slice.
- SDD §32–33 (Event Architecture; Event Bus) — commands emit events post-success,
  published through the in-process bus.
- SDD §34 (Domain Events) — the six events this slice's commands emit, drawn from the
  initial catalog.
- SDD §35 (Query Architecture) — `GetProject`, `GetPlan`, `GetZone` as named examples.
- SDD §36 (Repository Pattern) — the `ZoneRepository` interface shape adopted
  verbatim, and extended by analogy for `PlanRepository`.
- SDD §64–65 (Error Model; Result Pattern) — the error categories
  (`ValidationError`, `ReferenceError`, `GeometryError`, `CalculationError`) and
  `Result<T,E>` usage for expected business failures.
- SDD §71–72 (Application Tests; Repository Contract Tests) — the
  command/in-memory-repository test pattern and the shared contract-suite
  requirement this slice's tests are built to satisfy.
- SDD §76 (Architecture Test Rules) — the enforced layer dependency rule.
- SDD §78 (Internal Module Pattern) — per-entity module folder shape, adapted here.
- SDD §80 (Naming Conventions) — singular entity nouns, verb+object commands,
  past-tense events, `Get`/`List`/`Find` queries.
- SDD §81 (TypeScript Rules) — `strict: true`, no `any`, readonly data where
  practical.
- SDD §82–83 (Entity IDs; Entity References) — the ID scheme and the rule that
  Markdown links are navigation, never identity (`Zone.domainNoteLink`).
- SDD §91 (MVP Technical Increments), Increment 2 — "Domain can be instantiated and
  tested without Obsidian," the success criterion this slice satisfies for
  Project/Plan/Zone.
- PRD §8 (Core Entities) — Project, Plan, Zone property lists.
- PRD §15 (Epic 4 — Zones & Spatial Objects) — the zone-type examples used to close
  `ZoneType`.
- PRD §34 (Spatial Object Model) — context for why `MoveSpatialObjectCommand` is
  scoped to Zone only in this slice.
- PRD §35 (Renovation Lifecycle) — the stage list adopted for `ProjectStatus`.
- PRD §59 (Entity Relationship Rules) — "A Plan belongs to exactly one Project," "A
  Spatial Object belongs to one Plan and may link to a domain note."
- PRD §60 (Identity Model) — stable IDs independent of filename/title/path.
- ADR-001 (Markdown as Canonical Metadata Storage).
- ADR-006 (Plain TypeScript Domain).
- ADR-007 (Command-Based Mutations).
- ADR-008 (Event-Aware Architecture).
- ADR-009 (World Coordinates in Millimeters).
- ADR-010 (Decimal Money Arithmetic).

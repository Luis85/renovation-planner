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
- Geometry validity beyond what Slice 2's `Polygon`/`Point` constructors already
  enforce (≥3 vertices, finite coordinates, no `NaN`/`Infinity` — SDD §26). Advanced
  polygon operations (`clipper2-ts`) and the spatial index (`rbush`) are explicitly
  deferred per the SDD and the slice map's "Explicitly deferred" list.

## Dependencies

- **Slice 2 (Core Primitives)** — `Result<T,E>`, the base error hierarchy (SDD §64:
  `ValidationError`, `ReferenceError`, `GeometryError`, `CalculationError`, and
  friends), the entity ID scheme (branded `ProjectId`/`PlanId`/`ZoneId` strings, SDD
  §82), geometry primitives (`Point`, `Polygon`), `Money` (ADR-010), and the generic,
  in-process `EventBus` (SDD §33). This slice only consumes those types — it does not
  redefine them.
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
| `background` | `BackgroundImageRef \| null` | a reference (path/link + pixel dimensions), not the raw image — file access is Slice 4/5 |
| `calibration` | `Calibration \| null` | `{ pointA: Point, pointB: Point, knownRealWorldDistanceMm: number, scale: number }`; `null` until `CalibratePlanCommand` runs |
| `layers` | `readonly string[]` | ordered, unique names; visibility/rendering is Slice 5 |

The PRD lists "scale" and "coordinate system" as properties separate from a
calibration concept it doesn't name at the entity level. This slice folds both into
`calibration`: per ADR-009, a Plan's coordinate system is always "world millimeters,
established by calibration," so there is no independent `coordinateSystem` field, and
`scale` is calibration's derived output (world millimeters per background pixel), not
an independently settable field. This is a design decision made to resolve that PRD
ambiguity, not a value taken from the source material.

**Zone** (PRD §8):

| Property | Type | Notes |
| --- | --- | --- |
| `id` | `ZoneId` | immutable |
| `planId` | `PlanId` | immutable, set at creation |
| `projectId` | `ProjectId` | immutable, denormalized from `plan.projectId` at creation (see above) |
| `name` | `string` | required, non-empty |
| `zoneType` | `ZoneType` | `Room \| Garden \| Terrace \| Driveway \| Roof \| ConstructionArea \| Custom` — PRD §15's zone examples; **assumption:** the PRD gives examples, not a closed enum, so this is this slice's best-effort closure, with `Custom` as the escape hatch |
| `status` | `ZoneStatus` | `Planned \| InProgress \| Complete`; **assumption:** SDD §38's example frontmatter shows only `status: planned`, so `InProgress`/`Complete` are inferred, not sourced |
| `geometry` | `Polygon` | Slice 2 primitive, world millimeters (ADR-009); ≥3 vertices, finite, no `NaN`/`Infinity` (SDD §26) |
| `domainNoteLink` | `string \| null` | opaque Markdown link/path; navigation only, never identity (SDD §83) |

Zone exposes derived `area()` and `perimeter()` methods computed on demand from
`geometry` via Slice 2's `Polygon` operations (PRD §8: "A Zone owns geometry and can
expose derived length and area") — these are **not** stored fields, so there is
nothing to keep in sync when geometry changes.

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
| `CreateProjectCommand` | `name`, optional `description`/`status`/dates/`budget`/`contingency`/`locationDescription` | `ProjectCreated` | `ValidationError` |
| `CreatePlanCommand` | `projectId`, `name`, optional `background`/`layers` | `PlanCreated` | `ValidationError`, `ReferenceError` (project not found) |
| `CalibratePlanCommand` | `planId`, `pointA`, `pointB`, `knownRealWorldDistanceMm` | `PlanCalibrated` | `ReferenceError` (plan not found), `ValidationError` (distance ≤ 0), `CalculationError` (`pointA` = `pointB`, division by zero) |
| `CreateZoneCommand` | `planId`, `name`, `zoneType`, `geometry`, optional `domainNoteLink` | `ZoneCreated` | `ReferenceError` (plan not found), `ValidationError`, `GeometryError` |
| `MoveSpatialObjectCommand` | `zoneId`, `geometry` (full replacement) | `ZoneGeometryChanged` | `ReferenceError` (zone not found), `GeometryError` |
| `DeleteZoneCommand` | `zoneId` | `ZoneDeleted` | `ReferenceError` (zone not found) |

`MoveSpatialObjectCommand` takes its name from SDD §29's example list. In this slice
it operates on `Zone` only, because Zone is the only concrete spatial object that
exists; the general `spatial-object` domain module (which would let this command
target Walls, Doors, etc.) is not part of this slice's scope. It always replaces the
whole geometry rather than applying a delta — "move" vs. "resize" is a UI/tool-level
distinction (Slices 6/8: which handle the user dragged), collapsing to the same
domain operation here. `ResizeSpatialObjectCommand`/`DeleteSpatialObjectCommand` from
the same SDD list are not introduced by this slice; `DeleteZoneCommand` covers the one
concrete deletion this slice needs (`ZoneDeleted`).

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
    readonly background: BackgroundImageRef | null,
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
  ) {}

  static create(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError>;
  withGeometry(geometry: Polygon): Result<Zone, GeometryError>;

  area(): number;      // mm², delegates to Polygon
  perimeter(): number; // mm, delegates to Polygon
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
  implements Command<CreateZoneInput, Result<{ zone: Zone }, ValidationError | ReferenceError | GeometryError>>
{
  constructor(
    private readonly zones: ZoneRepository,
    private readonly plans: PlanRepository,
    private readonly events: EventBus,
  ) {}

  async execute(input: CreateZoneInput) {
    const plan = await this.plans.getById(input.planId);
    if (!plan) return Result.err(new ReferenceError(`Plan ${input.planId} not found`));

    const zoneResult = Zone.create({ ...input, projectId: plan.projectId });
    if (zoneResult.isErr()) return zoneResult;

    const zone = zoneResult.value;
    await this.zones.save(zone);
    await this.events.publish(
      new ZoneCreated({ zoneId: zone.id, planId: zone.planId, projectId: zone.projectId }),
    );
    return Result.ok({ zone });
  }
}
```

```typescript
// application/commands/zone/MoveSpatialObject.ts — signature only
interface MoveSpatialObjectInput { zoneId: ZoneId; geometry: Polygon }
class MoveSpatialObjectCommand
  implements Command<MoveSpatialObjectInput, Result<{ zone: Zone }, ReferenceError | GeometryError>> { /* … */ }

// application/commands/zone/DeleteZone.ts
interface DeleteZoneInput { zoneId: ZoneId }
class DeleteZoneCommand
  implements Command<DeleteZoneInput, Result<{ zoneId: ZoneId }, ReferenceError>> { /* … */ }

// application/commands/plan/CalibratePlan.ts
interface CalibratePlanInput {
  planId: PlanId;
  pointA: Point;
  pointB: Point;
  knownRealWorldDistanceMm: number;
}
class CalibratePlanCommand
  implements Command<CalibratePlanInput, Result<{ plan: Plan }, ReferenceError | ValidationError | CalculationError>> { /* … */ }
```

```typescript
// domain/zone/Zone.events.ts — representative; Project/Plan events follow the same shape
interface ZoneCreated { readonly name: 'ZoneCreated'; readonly payload: { zoneId: ZoneId; planId: PlanId; projectId: ProjectId } }
interface ZoneGeometryChanged { readonly name: 'ZoneGeometryChanged'; readonly payload: { zoneId: ZoneId; planId: PlanId; projectId: ProjectId } }
interface ZoneDeleted { readonly name: 'ZoneDeleted'; readonly payload: { zoneId: ZoneId; planId: PlanId; projectId: ProjectId } }
```

```typescript
// application/ports/ZoneRepository.ts (SDD §36, verbatim shape)
interface ZoneRepository {
  getById(id: ZoneId): Promise<Zone | null>;
  save(zone: Zone): Promise<void>;
  delete(id: ZoneId): Promise<void>;
  listByProject(projectId: ProjectId): Promise<Zone[]>;
}

// application/ports/PlanRepository.ts — extended by analogy with ZoneRepository;
// SDD only gives the Zone example, so listByProject here is this slice's own
// consistent extension, not a sourced requirement.
interface PlanRepository {
  getById(id: PlanId): Promise<Plan | null>;
  save(plan: Plan): Promise<void>;
  delete(id: PlanId): Promise<void>;
  listByProject(projectId: ProjectId): Promise<Plan[]>;
}

// application/ports/ProjectRepository.ts — root aggregate, no listByX
interface ProjectRepository {
  getById(id: ProjectId): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: ProjectId): Promise<void>;
}
```

```typescript
// application/queries/GetZone.ts — representative; GetProject/GetPlan follow the same shape
interface GetZoneInput { zoneId: ZoneId }
class GetZone implements Query<GetZoneInput, Result<Zone, ReferenceError>> {
  constructor(private readonly zones: ZoneRepository) {}
  async execute({ zoneId }: GetZoneInput) {
    const zone = await this.zones.getById(zoneId);
    return zone ? Result.ok(zone) : Result.err(new ReferenceError(`Zone ${zoneId} not found`));
  }
}
```

```typescript
// infrastructure/persistence/in-memory/InMemoryZoneRepository.ts
class InMemoryZoneRepository implements ZoneRepository {
  private readonly store = new Map<ZoneId, Zone>();
  async getById(id: ZoneId) { return this.store.get(id) ?? null; }
  async save(zone: Zone) { this.store.set(zone.id, zone); }
  async delete(id: ZoneId) { this.store.delete(id); }
  async listByProject(projectId: ProjectId) {
    return [...this.store.values()].filter((z) => z.projectId === projectId);
  }
}
```

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
  rejected (`GeometryError`, delegating to Slice 2's `Polygon` construction);
  `Calibration` with `pointA === pointB` or `knownRealWorldDistanceMm <= 0` is
  rejected.
- **Command tests**, per SDD §71's pattern (`Command → InMemoryRepository →
  Assertions`) — for each of the six commands: the success path returns `Result.ok`
  with the expected entity, persists it (retrievable via the same in-memory
  repository's `getById`), and publishes exactly one event of the correct type and
  payload; every failure path returns `Result.err` with the correct SDD §64 error
  category and performs **no** `save` and **no** `publish` (asserted via a spy
  `EventBus` and by re-querying the repository).
- **Query tests** — `GetProject`/`GetPlan`/`GetZone` return `Result.ok` for an entity
  seeded directly into the repository (independent of any command) and
  `Result.err(ReferenceError)` for a missing id, proving the queries are
  repository-agnostic.
- **Repository contract tests** (SDD §72) — one shared suite per entity (e.g.
  `zoneRepositoryContractTests(makeRepository: () => ZoneRepository)`) exercising
  `getById`/`save`/`delete`/`listByProject` against whatever instance is passed in.
  This slice runs each suite against its `InMemory*Repository`; Slice 4 imports the
  identical suite and runs it against the Obsidian-backed implementation, unmodified.
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
- [ ] `GetProject`, `GetPlan`, `GetZone` are implemented against the repository *port*
      types only, with no reference to any concrete repository implementation.
- [ ] `ProjectRepository`, `PlanRepository`, `ZoneRepository` ports are defined in
      `application/ports/`, each with a passing `InMemory*Repository` implementation
      and a shared repository contract test suite that is written to be reusable,
      unmodified, by Slice 4.
- [ ] A project can be created, a plan created under it and calibrated, and a zone
      created under the plan, moved, and deleted — all in a single Vitest file, using
      only `InMemory*Repository` instances, with zero Obsidian API surface touched.
      This is the concrete, scoped-down form of Increment 2's success criterion.
- [ ] Every command's failure paths are covered by a test asserting `Result.err` with
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

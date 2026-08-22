# Design Slice 4: Persistence & Repository Layer

## Purpose

Slice 3 produced a Project/Plan/Zone domain model that runs entirely in memory,
independent of Obsidian. This slice gives that model a durable home in the Vault: it
turns "an in-memory `Zone` instance" into "a `Zone` a user can close Obsidian on,
reopen a week later, and get back unchanged."

It is the architectural seam the SDD calls out explicitly (§2, §41): everything above
this slice — commands, queries, Vue, Pinia, Konva — must be able to change persistence
technology without knowing it happened. Concretely, this slice delivers:

- repository ports and their `InMemory*` / `Obsidian*` implementations for Project,
  Plan, and Zone;
- explicit DTOs and Zod schemas that stand between raw frontmatter/JSON and domain
  entities, each carrying a schema version;
- the plan geometry sidecar (format, location, and how a spatial entity's save spans
  both a Markdown note and a sidecar as one logical write);
- a migration registry that makes future schema changes additive, not disruptive;
- a Vault change detection pipeline and a rebuildable Project Index, so the plugin
  never has to walk the whole Vault to answer "where does entity X live?"

This is the SDD's Increment 3. Its success criterion is exact and testable:

> Project, Plan, and Zone survive unload/reload.

## Scope

### In scope

- `ProjectRepository`, `PlanRepository`, `ZoneRepository` ports (application layer)
  and their `InMemory*` and `Obsidian*` implementations (infrastructure layer).
- Persistence DTOs (`ProjectFrontmatterDTO`, `PlanFrontmatterDTO`,
  `ZoneFrontmatterDTO`) and mappers between frontmatter, DTO, and domain entity —
  raw frontmatter never leaves the Obsidian repository implementations (§37).
- The plan geometry sidecar: JSON schema, one file per plan (§39–40), stored per
  ADR-011 — a configurable flat folder (default `docs/geometry`), filename keyed by
  the plan's stable ID, a dedicated registered file extension.
- Zod schema validation and schema versioning for both the Markdown frontmatter
  shapes and the sidecar JSON shape (§43–44).
- The migration registry/runner shape (`migration/project`, `migration/entities`,
  `migration/geometry`) and its contract: deterministic, tested, idempotent where
  practical (§45).
- Vault change detection (create/modify/rename/delete) feeding an incremental,
  rebuildable Project Index (§46–47).
- Read-side queries `GetProject`, `GetPlan`, `GetZone`, backed by the index and the
  repositories (§35).
- The persistence-consistency handling for a Zone's split across a Markdown note and
  a geometry sidecar entry (§42).

### Out of scope (covered by other slices)

- Project/Plan/Zone business rules, invariants, and value objects — Slice 3.
- Konva/canvas rendering of geometry read out of the sidecar — Slice 5.
- Command/query wiring into Vue components and Pinia stores — Slices 5–6.
- Calibration fields on Plan (reference points, scale) — Slice 7; this slice's Plan
  frontmatter carries only the fields needed to identify and locate a plan.
- Undo/redo around persistence writes — Slice 6 (§29–31); this slice defines *what*
  a save does, not how it becomes one undo step.
- Repositories, DTOs, and sidecar entries for any entity beyond Project, Plan, and
  Zone. Asset, Requirement, Construction Section, and later entities reuse this same
  repository/DTO/schema-version/migration pattern — each gets its own module-scoped
  repository and schema when its slice is built, not a new persistence architecture.
- Diagnostics UI / error surfacing conventions in general (Slice 11); this slice only
  produces the typed errors that feed it.

## Dependencies

- **Slice 3 — Domain Foundation: Project, Plan, Zone** — this slice persists exactly
  the entities and IDs (`ProjectId`, `PlanId`, `ZoneId`) that slice defines. It does
  not add fields or rules to those entities.
- **Core primitives (Slice 2)** — `Result<T, E>`, the `PersistenceError` /
  `ValidationError` / `MigrationError` categories (§64–66), and the identity module
  (§82–83) are reused as-is, not redefined here.
- **ADR-001** — Markdown/frontmatter is the persistence format for entity metadata;
  this slice is the "explicit mapping" and "schema validation" work ADR-001's
  Consequences section calls out as required follow-through.
- **ADR-002 as revised by ADR-011** — one JSON sidecar per plan (ADR-002's core
  decision, unchanged) stored in a configurable ID-keyed folder with a dedicated
  extension (ADR-011's revision of ADR-002's colocation example). This slice
  implements ADR-011's location, not ADR-002's original `Ground Floor.geometry.json`
  example.
- **Plugin settings and composition root (Slice 1)** — this slice adds one new
  setting, the geometry sidecar folder (ADR-011), to the settings surface Slice 1
  established, and requires a `registerExtensions()` call at plugin load for the
  sidecar's custom extension. It does not redesign the composition root; it registers
  into it.

## Design

### Layering recap for this slice

```text
Application            ports: ProjectRepository, PlanRepository, ZoneRepository,
                               ProjectIndex (read side used by queries + repos)
        ↓ (implemented by)
Infrastructure          ObsidianProjectRepository, ObsidianPlanRepository,
                        ObsidianZoneRepository, PlanGeometryStore,
                        VaultChangeAdapter, ProjectIndexBuilder
```

Repositories are the *only* code that touches `Vault`, `FileManager`, or
`MetadataCache`. Everything above the repository ports — commands, queries, Vue,
Pinia — depends only on the ports, per the layer dependency rule (SDD §8, ADR-006).

### The mapping pipeline (§37, §43)

Every read and write funnels through the same four stages, in both directions:

```text
Markdown / Frontmatter  (or Sidecar JSON)
        ↕
Zod schema parse  →  Persistence DTO   (versioned, still shape-of-storage)
        ↕
Mapper
        ↕
Domain Entity     (Slice 3's Project / Plan / Zone)
```

A repository never hands raw `frontmatter: Record<string, unknown>` or a raw parsed
JSON object to anything outside itself. If Zod parsing fails, the repository returns
a `Result` failure carrying a `ValidationError` (or `PersistenceError` for a Vault I/O
failure) — it never lets invalid data construct a domain entity (§43,
Completion Criterion 8).

### Frontmatter shape (§38)

Project, Plan, and Zone each get a `type` discriminator and a `schema-version`,
following the SDD's Zone example directly:

```yaml
---
type: renovation-zone
schema-version: 1

id: zone-01HXYZ
project: project-01HABC
plan: plan-ground-floor

name: Bathroom
zone-type: room
status: planned
---
```

Project and Plan follow the same shape with their own field sets:

```yaml
---
type: renovation-project
schema-version: 1
id: project-01HABC
name: Riverside Renovation
status: planning
---
```

```yaml
---
type: renovation-plan
schema-version: 1
id: plan-ground-floor
project: project-01HABC
name: Ground Floor
background: attachments/ground-floor-plan.pdf
---
```

The note body is never parsed by the plugin (§38) — it is free-form and belongs to
the user.

Filenames are human-chosen (derived from the entity's name at creation time,
deduplicated on collision) and live under the plugin's existing "default folder"
setting (§14–15, Slice 1). Filename is never identity (§83) — every read resolves
`id` → path through the Project Index, never the reverse.

### The geometry sidecar (§39–40, ADR-011)

One sidecar per **plan**, not per spatial object. Location follows ADR-011, not
ADR-002's colocation example:

```text
docs/geometry/                     ← configurable folder, default shown
├── 01JPLANGF0000000000000001.rpgeo
├── 01JPLANFF0000000000000002.rpgeo
└── 01JPLANGD0000000000000003.rpgeo
```

- Flat list, one file per plan, named by the plan's stable ID — never by the plan's
  display name or its note's path.
- The extension is `rpgeo` (ADR-011), registered via `registerExtensions(["rpgeo"],
  viewType)` at plugin load so the file explorer treats it as a first-class file, not
  an unsupported attachment.
- Because the sidecar's path cannot be derived from the plan note's path (ADR-011),
  resolving it **always** goes through the Project Index's `planId → sidecar path`
  entry. There is no path-derivation fallback.

Sidecar content (§40):

```json
{
  "schemaVersion": 1,
  "planId": "plan-ground-floor",
  "objects": [
    {
      "id": "zone-bathroom",
      "type": "polygon",
      "points": []
    }
  ]
}
```

`objects[]` is keyed by spatial-object ID, `type` discriminates the geometry shape
(`polygon` today; Zone is the only spatial-object type this slice populates — future
entities, e.g. placed Assets, add their own `type` variant to the same array rather
than a new sidecar).

### Persistence consistency for a Zone (§42)

A Zone's state spans two files: its Markdown note (identity + metadata) and one
entry inside its plan's sidecar (geometry). `ObsidianZoneRepository.save()` treats
both writes as one logical transaction:

```text
1. Validate the incoming Zone → { frontmatter DTO, geometry entry } — fully, before
   any disk I/O. A validation failure aborts here; nothing is written.
2. Read the plan's current sidecar (via Project Index → sidecar path).
3. Write the zone's Markdown frontmatter (FileManager.processFrontMatter — body
   untouched).
4. Upsert this zone's entry into the sidecar's objects[] and write the sidecar back.
5. If step 4 fails after step 3 succeeded: attempt to restore the frontmatter this
   repository just overwrote to its pre-write snapshot, and return a
   PersistenceError. This is a compensating write, not a database transaction —
   Obsidian's Vault API has no multi-file atomicity — so the repository logs when
   the compensating write itself fails, rather than claiming consistency it cannot
   guarantee.
6. On success, upsert the Project Index entry for this zone synchronously (§47) —
   the index is not left to catch up asynchronously via the vault-change pipeline.
```

`delete(zoneId)` is the mirror: remove the sidecar entry, delete the note, then
remove the index entry — in an order that, on partial failure, prefers leaving an
orphaned-but-harmless sidecar entry over a dangling index pointing at a deleted note.

Plan creation/deletion owns the sidecar's *existence* (create an empty sidecar when a
Plan is created; delete it when a Plan is deleted) but never touches `objects[]`
content — only `ObsidianZoneRepository` (and later, other spatial-object
repositories) writes individual entries.

### Schema versioning and migration (§44–45)

Every persisted shape — each entity's frontmatter and the sidecar — carries its own
`schema-version` / `schemaVersion` field, versioned independently. A migration
registry maps `(entity kind, from version)` to a pure function producing the next
version, chained up to latest before Zod validates the final shape:

```text
infrastructure/persistence/migration/
├── MigrationRunner.ts
├── project/
│   └── project.migrations.ts
├── entities/
│   ├── plan/
│   │   └── plan.migrations.ts
│   └── zone/
│       └── zone.migrations.ts
└── geometry/
    └── plan/
        └── plan-geometry.migrations.ts
```

At schema version 1 for every shape, there is nothing to migrate *from* yet — but
the machinery is built and proven now, not deferred, per §45's requirement that
migrations be deterministic and tested and per Completion Criterion 9 ("schema
migrations can be introduced without redesign"). This slice proves the runner with a
synthetic `v0 → v1` fixture migration exercised only in tests (see Testing
Strategy); no real v0 format ever shipped.

Migrations are pure functions over plain objects (`unknown → unknown`), run before
Zod parses the target version, so a migration only needs to reshape data — it never
needs to know how to validate it.

### Vault change detection → Project Index (§46–47)

```text
Obsidian Event (vault.on / metadataCache.on)
      ↓
VaultChangeAdapter        normalizes create/modify/rename/delete, debounced
      ↓
Entity Resolver           is this path one of ours? (frontmatter `type`, or the
                           registered sidecar extension) — otherwise ignored
      ↓
Validation                Zod parse; failures become a diagnostic, not a crash
      ↓
Project Index Update      incremental add/update/move/remove
      ↓
(event bus)                ProjectIndexUpdated — Slices 5–6 subscribe from here
```

The Project Index is the single answer to "where is entity X" so that no code path
ever re-scans the Vault to find one file (§47):

```text
entity ID          → file path
entity type        → entity IDs
project ID         → entity IDs
plan ID            → spatial-object IDs                (Zone today; extensible)
plan ID            → geometry sidecar path              (ADR-011 requires this —
                                                          the path is not derivable)
```

The index is pure derived data: rebuildable from Vault contents alone, at plugin
load and as a recovery path if it is ever suspected to have drifted (Completion
Criterion 14). A full rebuild and the same sequence of incremental
`VaultChangeAdapter` updates must converge to the same index — that equivalence is
part of this slice's test suite, not just an assertion.

Writes originating from this plugin's own repositories update the index
synchronously at save time (see above); the Vault-change pipeline is the sole path
for index updates caused by anything else — manual edits, sync, another device, a
future import. Because the plugin's own writes also raise Obsidian's `modify` event,
the Entity Resolver treats a change that already matches the index (same content, or
within a short echo window) as a no-op rather than reprocessing it.

A malformed note or sidecar (fails Zod validation) is recorded as a diagnostic and
excluded from the index rather than aborting the scan — one broken file must not
take down the rest of the vault's data (Completion Criterion 13).

### Read-side queries (§35)

`GetProject`, `GetPlan`, and `GetZone` are thin application-layer queries: given an
ID, resolve it via the repository (which itself resolves path via the index, then
reads-validates-maps). No cross-entity aggregation happens in this slice — queries
like `GetProjectBudget` or `GetAssetsForZone` are later slices' concern once there is
more than one entity type to aggregate across.

## Interfaces & Contracts

Repository ports (`application/ports/`), following the SDD's own example directly and
extending it to Project and Plan:

```typescript
interface ProjectRepository {
  getById(id: ProjectId): Promise<Result<Project | null, PersistenceError>>;
  save(project: Project): Promise<Result<void, PersistenceError | ValidationError>>;
  delete(id: ProjectId): Promise<Result<void, PersistenceError>>;
  listAll(): Promise<Result<Project[], PersistenceError>>;
}

interface PlanRepository {
  getById(id: PlanId): Promise<Result<Plan | null, PersistenceError>>;
  save(plan: Plan): Promise<Result<void, PersistenceError | ValidationError>>;
  delete(id: PlanId): Promise<Result<void, PersistenceError>>;
  listByProject(projectId: ProjectId): Promise<Result<Plan[], PersistenceError>>;
}

interface ZoneRepository {
  getById(id: ZoneId): Promise<Result<Zone | null, PersistenceError>>;
  save(zone: Zone): Promise<Result<void, PersistenceError | ValidationError>>;
  delete(id: ZoneId): Promise<Result<void, PersistenceError>>;
  listByProject(projectId: ProjectId): Promise<Result<Zone[], PersistenceError>>;
  listByPlan(planId: PlanId): Promise<Result<Zone[], PersistenceError>>;
}
```

Each has an `InMemory*Repository` (a `Map` keyed by ID — reused unchanged from
Slice 3's own tests) and an `Obsidian*Repository`. Both satisfy the same repository
contract test suite (§72):

```typescript
// tests/contracts/zoneRepository.contract.ts
export function zoneRepositoryContract(makeRepo: () => ZoneRepository) {
  describe("ZoneRepository contract", () => {
    it("returns null for an unknown id", async () => { /* ... */ });
    it("round-trips a saved zone through getById", async () => { /* ... */ });
    it("lists zones by plan", async () => { /* ... */ });
    it("removes a zone on delete", async () => { /* ... */ });
  });
}

// run against both implementations:
zoneRepositoryContract(() => new InMemoryZoneRepository());
zoneRepositoryContract(() => new ObsidianZoneRepository(/* fixture vault */));
```

Persistence DTOs and schemas (versioned; example shown for Zone, Project/Plan
follow the same shape):

```typescript
const ZoneFrontmatterSchemaV1 = z.object({
  type: z.literal("renovation-zone"),
  "schema-version": z.literal(1),
  id: z.string(),
  project: z.string(),
  plan: z.string(),
  name: z.string(),
  "zone-type": z.string(),
  status: z.enum(["planned", "in-progress", "done"]),
});
type ZoneFrontmatterDTO = z.infer<typeof ZoneFrontmatterSchemaV1>;

const SpatialObjectGeometrySchemaV1 = z.object({
  id: z.string(),
  type: z.literal("polygon"),
  points: z.array(z.tuple([z.number(), z.number()])),
});

const PlanGeometrySchemaV1 = z.object({
  schemaVersion: z.literal(1),
  planId: z.string(),
  objects: z.array(SpatialObjectGeometrySchemaV1),
});
type PlanGeometryDTO = z.infer<typeof PlanGeometrySchemaV1>;
```

Mapper (frontmatter DTO + geometry entry ↔ domain entity — never partial):

```typescript
interface ZoneMapper {
  toDomain(frontmatter: ZoneFrontmatterDTO, geometry: SpatialObjectGeometryDTO): Zone;
  toPersistence(zone: Zone): {
    frontmatter: ZoneFrontmatterDTO;
    geometry: SpatialObjectGeometryDTO;
  };
}
```

Geometry sidecar I/O, shared by `ObsidianPlanRepository` (lifecycle: create/delete
the file) and `ObsidianZoneRepository` (content: upsert/remove one entry):

```typescript
interface PlanGeometryStore {
  create(planId: PlanId): Promise<Result<void, PersistenceError>>;
  read(planId: PlanId): Promise<Result<PlanGeometryDTO, PersistenceError | ValidationError>>;
  write(planId: PlanId, dto: PlanGeometryDTO): Promise<Result<void, PersistenceError>>;
  delete(planId: PlanId): Promise<Result<void, PersistenceError>>;
}
```

Project Index port (application layer; read side used by repositories and queries,
write side used by repositories and the Vault change pipeline):

```typescript
interface ProjectIndex {
  getPath(id: EntityId): string | undefined;
  getGeometrySidecarPath(planId: PlanId): string | undefined;
  getIdsByType(type: EntityType): EntityId[];
  getIdsByProject(projectId: ProjectId): EntityId[];
  getSpatialObjectIdsByPlan(planId: PlanId): EntityId[];

  upsert(entry: ProjectIndexEntry): void;
  remove(id: EntityId): void;
  rebuild(entries: ProjectIndexEntry[]): void; // full replace, used after a scan
}

interface ProjectIndexEntry {
  id: EntityId;
  type: EntityType;
  path: string;
  projectId?: ProjectId;
  planId?: PlanId;
}
```

Migration registry (infrastructure):

```typescript
interface Migration<TFrom = unknown, TTo = unknown> {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(input: TFrom): TTo;
}

interface MigrationRunner {
  register(kind: string, migration: Migration): void;
  migrateToLatest(kind: string, raw: unknown, fromVersion: number): unknown;
}
```

Queries (application layer):

```typescript
interface GetProjectQuery {
  execute(id: ProjectId): Promise<Result<Project | null, PersistenceError>>;
}
interface GetPlanQuery {
  execute(id: PlanId): Promise<Result<Plan | null, PersistenceError>>;
}
interface GetZoneQuery {
  execute(id: ZoneId): Promise<Result<Zone | null, PersistenceError>>;
}
```

## Persistence Impact

- **Reads:** on plugin load, `ProjectIndexBuilder` scans the configured default
  folder(s) for Project/Plan/Zone notes (via `MetadataCache`, not raw file parsing)
  and the configured geometry folder for sidecars, populating the Project Index.
  Every `getById` after that is a single file read, not a scan.
- **Writes:** `ObsidianProjectRepository`/`ObsidianPlanRepository` write Markdown
  frontmatter via `FileManager.processFrontMatter` (note body untouched).
  `ObsidianZoneRepository.save` additionally reads-modifies-writes one entry in its
  plan's geometry sidecar, per the consistency sequence above.
- **New setting:** `geometrySidecarFolder`, default `docs/geometry` (ADR-011), added
  to the plugin's existing settings surface.
- **New Vault registration:** one custom file extension for geometry sidecars,
  registered via `registerExtensions()` at plugin load, so sidecar files are visible
  and manageable in Obsidian's file explorer rather than treated as an unsupported
  attachment.
- **No writes during pointer movement or other high-frequency interaction** — that
  rule belongs to the editor (§62, Slice 5–6); this slice's repositories are called
  once per completed command, never per frame.

## Testing Strategy

- **Repository contract tests (§72):** one shared suite per entity
  (`projectRepositoryContract`, `planRepositoryContract`, `zoneRepositoryContract`),
  run against both the `InMemory*` and `Obsidian*` implementation of that entity.
  Passing identically on both is the proof that swapping persistence technology
  never required a caller-visible change.
- **Schema validation unit tests:** valid and invalid fixtures for each frontmatter
  shape and the sidecar shape — missing `schema-version`, wrong discriminator,
  out-of-range enum, malformed geometry points (NaN/Infinity/non-finite, tying into
  §26's geometry-validation rules) — asserting the invalid cases never reach a
  mapper.
- **Migration tests:** a synthetic `v0 → v1` fixture per migratable kind, asserting
  the migration is deterministic (same input → same output) and idempotent
  (re-running it on already-migrated data is a no-op or a validated error, never
  silent corruption).
- **Persistence consistency tests:** simulate a Zone save where the sidecar write
  fails after the frontmatter write succeeds; assert a `PersistenceError` is
  returned and the frontmatter is restored to its prior valid content (or, if the
  compensating write itself fails, that this is surfaced rather than swallowed).
- **Vault change detection tests:** simulate `create`/`modify`/`rename`/`delete`
  sequences against a fixture vault and assert the Project Index converges to the
  same state as a full rebuild from the same fixture vault's final contents.
- **Fixture vaults (§75):** `tests/vault/valid-project` (happy path index build +
  reload), `tests/vault/broken-references` and `tests/vault/legacy-schema` (a
  malformed note must not abort loading the rest of the vault), `tests/vault/large-project`
  (index build stays a single scan, not repeated rescans).
- **End-to-end reload test:** create a Project, Plan, and Zone through the
  repositories, discard all in-memory state (simulating unload), rebuild the index
  and re-read all three through the same repositories — asserting field-for-field
  equality. This is the direct, automated proof of Increment 3's success criterion.

## Definition of Done

1. `ProjectRepository`, `PlanRepository`, `ZoneRepository` ports exist in
   `application/ports/`; `InMemory*` and `Obsidian*` implementations exist for all
   three.
2. The same contract test suite passes against both implementations for all three
   entities (§72) — no test is written twice, no test is skipped for one side.
3. Zod schemas exist and are versioned (`schema-version: 1` / `schemaVersion: 1`)
   for Project, Plan, and Zone frontmatter and for the plan geometry sidecar; no
   repository or mapper accepts un-validated input, and no raw frontmatter or raw
   sidecar JSON object is passed to application or domain code (§37, Completion
   Criterion 8).
4. Geometry sidecars are written to the configured folder (default `docs/geometry`)
   as a flat list keyed by plan ID, with the registered custom extension; no code
   path derives a sidecar's path from the plan note's path — every resolution goes
   through the Project Index (ADR-011).
5. Saving a Zone updates its frontmatter and its geometry sidecar entry as one
   logical operation; a test proves a mid-sequence failure surfaces a
   `PersistenceError` and does not leave the frontmatter silently pointing at
   discarded geometry (§42).
6. The migration registry/runner exists under
   `infrastructure/persistence/migration/{project,entities,geometry}` and is
   exercised by at least one synthetic migration test proving determinism and
   idempotency, even though no real prior schema version exists yet (§45,
   Completion Criterion 9).
7. `VaultChangeAdapter` reacts to create/modify/rename/delete and updates the
   Project Index incrementally; a test proves a full rebuild and the incremental
   path converge to the same index for the same fixture vault.
8. The Project Index answers all five lookups (entity ID → path, entity type → IDs,
   project ID → entity IDs, plan ID → spatial-object IDs, plan ID → geometry
   sidecar path) and is fully rebuildable from Vault contents with the in-memory
   index discarded (Completion Criterion 14).
9. `GetProject`, `GetPlan`, `GetZone` are implemented against the Obsidian
   repositories and used by the end-to-end reload test.
10. The end-to-end reload test — create Project/Plan/Zone, discard in-memory state,
    rebuild the index, re-read through the same repositories, assert equality —
    passes. This is Increment 3's success criterion made concrete: **Project, Plan,
    and Zone survive full unload/reload.**
11. A malformed note or sidecar in a fixture vault (`tests/vault/broken-references`,
    `tests/vault/legacy-schema`) is reported as a diagnostic and excluded from the
    index without aborting the load of the rest of the vault (Completion
    Criterion 13).

## References

- SDD §35 Query Architecture
- SDD §36 Repository Pattern
- SDD §37 Obsidian Repository Layer
- SDD §38 Markdown Entity Model
- SDD §39 Sidecar Files
- SDD §40 Plan Sidecar Schema
- SDD §41 Persistence Boundary
- SDD §42 Persistence Consistency
- SDD §43 Schema Validation
- SDD §44 Schema Versioning
- SDD §45 Migration Architecture
- SDD §46 Vault Change Detection
- SDD §47 Project Index
- SDD §7.2 (Domain Layer module list), §8 (Dependency Rule), §14–15 (settings /
  persistent state), §26 (geometry validation, referenced by sidecar validation
  tests), §29 (Command Architecture — commands call repositories, not Vault APIs
  directly), §64–66 (Error Model / Result Pattern / Error Boundary), §72 (Repository
  Contract Tests), §75 (Integration Test Vault fixtures), §82–83 (Entity IDs &
  References), §92 (Architecture Completion Criteria, points 8, 9, 13, 14)
- ADR-001: Markdown as Canonical Metadata Storage
- ADR-002: JSON Sidecar for Plan Geometry — the "one sidecar per plan" decision this
  slice implements
- ADR-011: Configurable Geometry Sidecar Folder and Dedicated File Extension —
  **supersedes ADR-002's colocation example** (`Ground Floor.geometry.json` next to
  `Ground Floor.md`). This slice implements ADR-011's location (configurable folder,
  default `docs/geometry`, flat list keyed by plan ID, dedicated registered
  extension), not ADR-002's original example.
- PRD §8 Core Entities (Project, Plan, Zone property lists this slice's frontmatter
  shapes are derived from)

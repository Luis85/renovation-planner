---
type: Task
parent: "[[Foundation and composition root]]"
order: 40
dependsOn:
  - "[[03-domain-foundation-project-plan-zone]]"
status: Done
started: 2026-08-24
finished: 2026-08-24
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
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

- The `Obsidian*` implementations (infrastructure layer) of the `ProjectRepository`,
  `PlanRepository`, and `ZoneRepository` ports. The ports themselves and their
  `InMemory*` implementations are Slice 3's, reused **without a signature change** —
  see "Repository ports are Slice 3's, unchanged" below.
- Persistence DTOs (`ProjectFrontmatterDTO`, `PlanFrontmatterDTO`,
  `ZoneFrontmatterDTO`) and mappers between frontmatter, DTO, and domain entity —
  raw frontmatter never leaves the Obsidian repository implementations (§37).
- The plan geometry sidecar: JSON schema, one file per plan (§39–40), stored per
  ADR-011 — a `Geometry/` folder inside the project's own folder, filename keyed by
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
- Deriving, validating, or rescaling geometry against a `Calibration` — Slice 7. This
  slice declares the sidecar's nullable `calibration` field (so there is one versioned
  sidecar schema, not one Slice 7 has to amend) and round-trips whatever value it is
  given; it computes nothing.
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
  decision, unchanged) stored in an ID-keyed `Geometry/` folder inside the project's
  own folder, with a dedicated extension (ADR-011's revision of ADR-002's colocation
  example). This slice implements ADR-011's location, not ADR-002's original
  `Ground Floor.geometry.json` example.
- **Plugin settings and composition root (Slice 1)** — this slice adds the project
  folder to the settings surface Slice 1 established, and requires a
  `registerExtensions()` call at plugin load for the sidecar's custom extension. There
  is **no** separate geometry-folder setting: ADR-011 derives the sidecar folder from
  the project folder. It does not redesign the composition root; it registers into it.

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

Every `id`, and every field referencing one, is a `<prefix>-<ULID>` value produced by
Slice 2's `createEntityId` (§82) — never a slug derived from the entity's name. The
examples below use full ULIDs rather than the SDD's own abbreviated `zone-01HXYZ`
illustration precisely because a shortened, readable-looking ID is how a slug creeps
back in: `plan-ground-floor` would look like a perfectly good value right up until two
plans are both named "Ground Floor".

```yaml
---
type: renovation-zone
schema-version: 1

id: zone-01JABC7XG3QK9F8N2M4P6R5T0W
project: project-01JAB9Q2WE4RT6YU8IO0PA1SD2
plan: plan-01JABB3C5D7E9F1G3H5J7K9M1N

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
id: project-01JAB9Q2WE4RT6YU8IO0PA1SD2
name: Riverside Renovation
status: idea
---
```

```yaml
---
type: renovation-plan
schema-version: 1
id: plan-01JABB3C5D7E9F1G3H5J7K9M1N
project: project-01JAB9Q2WE4RT6YU8IO0PA1SD2
name: Ground Floor
background-path: attachments/ground-floor-plan.pdf
background-kind: pdf
background-page: 1
layers:
  - Walls
  - Fixtures
---
```

Two things the persisted vocabulary has to agree with the domain on, since the mapper
is the only thing standing between them:

- **`status` values are the domain enums, kebab-cased.** A Project's `status` is one of
  Slice 3's `ProjectStatus` lifecycle stages (`idea`, `survey`, `design`, `estimate`,
  `procurement`, `ready`, `execution`, `inspection`, `complete`, `as-built`) — not a
  free-text word like `planning`. A Zone's is `planned` / `in-progress` / `complete`,
  matching Slice 3's `ZoneStatus` three-for-three. A persisted vocabulary that is
  *nearly* the domain's (`done` where the domain says `Complete`) is worse than one
  that is openly different: it maps by coincidence until someone adds a fourth value.
- **`background` is a reference, not a path.** Slice 3's `Plan.background` is a
  `PlanBackgroundRef` (path, kind, optional page), so it persists as three flat
  frontmatter keys rather than one string — a bare path would silently lose which PDF
  page the Plan was calibrated against.

`calibration` is deliberately **not** in this frontmatter: it lives in the plan's
geometry sidecar, per Slice 7's own reasoning that recalibration must rewrite the
calibration and every rescaled object's geometry as one write. This slice's
`PlanGeometrySchemaV1` below carries the field; Slice 7 fills it in.

The note body is never parsed by the plugin (§38) — it is free-form and belongs to
the user.

Filenames are human-chosen (derived from the entity's name at creation time,
deduplicated on collision) and live under the **project folder** setting. Slice 1
established the settings surface and the `settingsFrom` trust boundary but declares only
`units` — "a field arrives when a feature reads it" — so this slice is where that field
arrives. It is the **only** location field this slice adds: ADR-011 derives the geometry
folder from it rather than declaring a second setting. Filename is never identity
(§83) — every read resolves `id` → path through the Project Index, never the reverse.

### The geometry sidecar (§39–40, ADR-011)

One sidecar per **plan**, not per spatial object. Location follows ADR-011, not
ADR-002's colocation example: a `Geometry/` folder inside the project's own folder,
a sibling of the note folders.

```text
Renovation/Kitchen Refit/                ← the project folder (the one setting)
├── Project.md
├── Plans/
│   ├── Ground Floor.md
│   └── First Floor.md
└── Geometry/
    ├── plan-01JABB3C5D7E9F1G3H5J7K9M1N.rpgeo
    ├── plan-01JABC4D6E8F0G2H4J6K8M0N2P.rpgeo
    └── plan-01JABD5E7F9G1H3J5K7M9N1P3Q.rpgeo
```

- One file per plan, named by the plan's stable ID **including its `plan-`
  prefix** — the same string the note's `id` field and the sidecar's own `planId` field
  carry, so the three are comparable without a strip-or-add step that only one of the
  three code paths remembers. Never named by the plan's display name or its note's path.
- The extension is `rpgeo` (ADR-011), registered via `registerExtensions(["rpgeo"],
  viewType)` at plugin load so the file explorer treats it as a first-class file, not
  an unsupported attachment.
- `Geometry/` is **not** a setting. The subfolder name is fixed inside a project the
  same way `Plans/` is; what a user chooses is where the project folder is, one level up
  (ADR-011). There is no geometry-folder field to write, so there is no folder-change
  migration either — the ninety-line move-then-write-then-rebuild protocol an earlier
  version of this slice carried died with the setting it protected.
- Resolving a sidecar **always** goes through the Project Index's `planId → sidecar path`
  entry. The path is derivable in principle now (project folder + `Geometry/` + plan ID),
  but derivation is a repair path for a damaged index, not a second lookup for normal
  reads — one answer to "where is this plan's geometry", per ADR-011.

### Open: moving a project folder is not designed here

The hazard the deleted folder-change protocol addressed did not disappear; it moved one
level up, and got bigger. Changing the **project folder** setting while data exists
orphans notes *and* geometry together: the running index keeps working, so nothing looks
wrong, and on the next load `ProjectIndexBuilder` scans a tree the project is not in and
every entity reads as missing while the files sit intact where nothing looks.

This slice does not design that move, and says so rather than leaving a protocol behind
that no longer matches what it would have to move. Two things the deleted version got
right are worth carrying into whichever slice does:

- **The setting is the record of where the data is**, so it is written *after* the files
  have moved and the index has been rebuilt, and a failure at any step rolls back all
  three. A marker written before the move and cleared only on a completed move or a
  verified-complete rollback is what covers a process exit, which no rollback can.
- **A whole-tree move needs a claim no per-entity lock can make** — "nothing may be
  written anywhere right now". That is why `PlanGeometryStore` no longer declares
  `withGlobalBarrier`: its one caller was the folder migration, and an exported method
  with no caller is what `npm run analyze` exists to refuse. It comes back with the
  operation that needs it, covering notes as well as sidecars.

Sidecar content (§40, with the `unit` field ADR-009 requires — the SDD's own §40
example omits it, which is exactly the gap ADR-009 closes):

```json
{
  "schemaVersion": 1,
  "planId": "plan-01JABB3C5D7E9F1G3H5J7K9M1N",
  "unit": "mm",
  "calibration": null,
  "objects": [
    {
      "id": "zone-01JABC7XG3QK9F8N2M4P6R5T0W",
      "type": "polygon",
      "points": [[0, 0], [2400, 0], [2400, 1800], [0, 1800]]
    }
  ]
}
```

The example polygon carries four real vertices rather than an empty array: `points: []`
would be a shape `createPolygon` rejects (§26), and an illustrative example of a
persisted object that could never legally be persisted is the kind of thing an
implementer copies. `calibration` is `null` until Slice 7 writes it.

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
2. Read the plan's current sidecar (via Project Index → sidecar path), AND read this
   zone's note to capture the restore snapshot step 5 needs: for an existing note,
   its current frontmatter; for a note that does not exist yet, the fact that this
   save is an INSERT. Which of the two it is decides how step 5 compensates, so it
   is established here, before anything is written — never inferred afterwards, when
   the note exists either way and the two cases are indistinguishable.
2b. Compare, before writing anything — slice 3's conditional-write contract, and the
    reason step 2's read and step 3's write must sit inside one serialized section
    rather than being two independent calls. Against the frontmatter step 2 just read:
      - `expected` (a number) against the stored `revision`; a difference is a
        `ValidationError` `<entity>.revision-conflict`.
      - `expected === 'absent'` against the note's existence; a note already there is
        the same error. This is what makes slice 8's restore-a-deleted-Zone an insert
        rather than a blind overwrite.
      - `expected.observed` — the token the CALLER received from the read it is acting
        on — against a token freshly minted from the plugin-owned frontmatter keys just
        read; a difference is a `ValidationError` `<entity>.external-modification`.
        Unknown keys and the body are outside the token, exactly as they are outside
        every write below. The token is a digest here; that is this implementation's
        business and nothing above `infrastructure/` knows it (slice 3).
    Either failure aborts here, with nothing written. On success the entity is written
    with `revision + 1`, and `save` returns the `Loaded<T>` carrying the new revision
    and a token minted from what it just wrote — so the caller's next write has an
    expectation without re-reading.
3. Write the zone's Markdown frontmatter (FileManager.processFrontMatter — body
   untouched), creating the note if this is an insert.
4. Upsert this zone's entry into the sidecar's objects[] and write the sidecar back.
5. If step 4 fails after step 3 succeeded, compensate according to what step 2
   recorded, and return a PersistenceError either way:
     - UPDATE — restore the frontmatter this repository just overwrote to its
       step-2 snapshot. The note keeps its body, its unknown keys, and its prior
       geometry entry, exactly as if the save had never run.
     - INSERT — delete the note this repository just created. There is no snapshot
       to restore, and leaving it would produce a live Zone note with no geometry
       entry: the same failure mode note-first delete ordering exists to prevent
       (below), reached from the other direction. Restoring "the pre-write
       frontmatter" of a note that had none is not a no-op — it is what silently
       leaves that orphan behind.
   This is a compensating write, not a database transaction — Obsidian's Vault API
   has no multi-file atomicity — so the repository logs when the compensating write
   itself fails, rather than claiming consistency it cannot guarantee.
6. On success, upsert the Project Index entry for this zone synchronously (§47) —
   the index is not left to catch up asynchronously via the vault-change pipeline.
```

Steps 2 through 5 run inside a **per-entity-ID** queue, for the reason slice 3 gives:
a comparison the caller could make from outside is check-then-act, and only a
comparison the write cannot be separated from is a compare-and-swap. This is a second
queue, not the per-`planId` sidecar lock below — that one serializes writers to one
shared file, this one serializes writers to one entity — and a Zone save takes both.
They nest in one order, entity then plan, everywhere; taking them in either order at
different call sites is the deadlock this states the ordering to avoid.

The compensation in step 5 is inside the queue, not after it. A restore that ran outside
would be a second write racing the writer that acquired the queue next, and it would
undo that writer's work rather than this one's — the failure this whole sequence exists
to prevent, reintroduced by the cleanup.

`delete(zoneId)` is the mirror, and it compensates the same way `save()` does: it makes
step 2b's comparison against the same read, and refuses the same two ways.

```text
1. Read the full Zone (note + its sidecar entry) as a restore snapshot, before any
   deletion. This repository holds it for step 4; it is not the caller's snapshot.
2. Delete the note.
3. Remove this zone's entry from the plan's sidecar and write the sidecar back.
4. If step 3 fails after step 2 succeeded: attempt to restore the note from the
   step-1 snapshot, and return a PersistenceError. As in save(), this is a
   compensating write, not a transaction — if the compensation itself fails, that is
   logged rather than papered over.
5. On success, remove the Project Index entry synchronously.
```

Note-first ordering is deliberate: removing the sidecar entry first would risk leaving a
*live* Zone note with no geometry, a worse and more confusing failure mode than the
transient inconsistency above.

**The compensating write in step 4 is what makes a failed delete undoable**, and it is
the reason `delete()` cannot simply leave an orphaned sidecar entry and call it
harmless. A caller's `Result` is its only signal: slice 6's `CommandHistory.run()`
leaves both stacks untouched on a failed `Result`, so a `delete()` that returned a
`PersistenceError` *after* the note was already gone would destroy the note and leave no
undo entry for it — the one outcome the undo stack exists to prevent. Compensating makes
the failure honest: either the Zone is deleted and the command is on the undo stack, or
nothing was deleted and there is nothing to undo. There is no third state a caller has
to reason about.

Plan creation/deletion owns the sidecar's *existence* (create an empty sidecar when a
Plan is created; delete it when a Plan is deleted) but never touches `objects[]`
content — only `ObsidianZoneRepository` (and later, other spatial-object
repositories) writes individual entries.

That two-file lifecycle needs the same compensated ordering as a Zone's, for the same
reason — a Plan note and its sidecar are two writes with no atomicity between them:

```text
ObsidianPlanRepository.save() — insert:
1. Write the sidecar first, with an empty objects[] (and calibration: null).
2. Write the Plan note's frontmatter, creating the note.
3. If step 2 fails after step 1 succeeded: delete the sidecar just created, and
   return a PersistenceError. Sidecar-first is deliberate here, the mirror of
   note-first for delete: a Plan note that exists without its sidecar is the worse
   failure — every ObsidianZoneRepository.save() against that Plan then fails at
   step 2 above, so the Plan looks live but cannot hold geometry — while an orphan
   sidecar with no note is inert, unreferenced by the Project Index, and reclaimed
   by the same cleanup that handles any other orphan.
4. On success, upsert the Plan's Project Index entry synchronously — BOTH the note
   path and geometrySidecarPath, in one entry — exactly as a Zone save does (step 6
   above) and as this repository's own delete() does in reverse. This step is not
   optional bookkeeping: until it runs, GetPlan cannot resolve the new Plan and
   ObsidianZoneRepository.save() cannot find its sidecar, so navigating to the Plan
   or drawing the first Zone fails for as long as the debounced vault-change
   pipeline takes to notice the new files. This repository is also the only code
   that knows the sidecar's path at this moment, and ADR-011 forbids re-deriving it.

ObsidianPlanRepository.save() — update: the Plan note's frontmatter only. An update
never creates or deletes the sidecar, so there is no second write to compensate — but
it still upserts the index entry on success, carrying geometrySidecarPath through
unchanged. Writing an entry that dropped the field would clear the mapping and break
every Zone operation on a Plan whose only change was its title.

ObsidianPlanRepository.delete():
1. Read both the Plan note's frontmatter and its sidecar as a restore snapshot.
2. Delete the note.
3. Delete the sidecar.
4. If step 3 fails after step 2 succeeded: restore the note from the step-1
   snapshot, and return a PersistenceError — the same reasoning as a Zone's
   delete(), and the same reason it cannot shrug off the orphan: a caller whose
   Result is an error must be able to trust that nothing was deleted.
5. On success, remove the Plan's Project Index entry (and its sidecar-path mapping)
   synchronously.
```

A Plan delete does not iterate its Zones' notes: deleting a Plan with existing Zones
is a reference-integrity decision (PRD §64), made before this repository is called,
not a cascade this layer performs on its own (slice 11's Data Safety rule 5).

### Sidecar writes are serialized per plan (§42)

Both sequences above are a **read-modify-write of one whole file**: they read the plan's
entire sidecar, change one entry in `objects[]`, and write all of it back. That makes
concurrent writes against the same plan a lost-update hazard, not merely an ordering
question:

```text
save(zoneA)  reads sidecar  ─┐
save(zoneB)  reads sidecar  ─┤ both see objects[] without A' or B'
save(zoneA)  writes  A'     ─┤
save(zoneB)  writes  B'     ─┘ built on B's stale read — A' is silently gone
```

Concurrency here is real, not theoretical. Slice 13 works through the case directly: an
Inspector field commit and a canvas gesture each call the dispatcher independently, so
two commands can be in flight against one Plan Editor at once. Slice 13's `pendingCount`
correctly stops the *indicator* misreporting that, but an indicator cannot prevent a lost
write — that has to be prevented here, in the only code that touches the file.

`PlanGeometryStore` therefore serializes per `planId`: a plan's read-modify-write runs to
completion before the next one for that plan begins, queued rather than rejected. Plans
do not contend with each other, so two Plan Editors stay independent. Serializing at the
store — not at the dispatcher — is what makes the guarantee hold for *every* writer,
including the vault-change pipeline and any future spatial-object repository, rather than
only for commands that happened to go through one editor's dispatcher.

**Considered and declined for this slice: caching the parsed sidecar, and coalescing
queued mutations.** Both are real optimizations over the shape above, which re-reads,
re-parses, re-serializes and rewrites a whole file for every single-zone change, and
both are declined now with a named trigger rather than left unmentioned.

*A cache* would hold the parsed `PlanGeometryDTO` per open plan and skip the read. It is
declined because it makes the store a second authority over the file's contents, and the
file is one a user can open and edit in Obsidian — this is a **registered, visible file
type** (ADR-011), which is the whole reason `EntityVersion` carries an observation token
rather than a revision alone. A cache would therefore need invalidation from the
vault-change pipeline to be correct, and the vault-change pipeline is debounced, so the
window where the cache is confidently wrong is exactly the window a hand edit lands in.
That is a lost update wearing a performance improvement, and the current shape's
`mutate()` reads inside the lock precisely so it cannot happen.

*Coalescing* would merge several queued mutations for one plan into a single
read-modify-write. It is declined because each mutation returns the `EntityVersion` its
own write produced, and that return value is load-bearing: slice 6's expectation chain
and slice 7's calibration undo are both built on "the version my write produced".
Coalescing N mutations into one write means N callers sharing one version, and working
out which of them may legitimately claim it is a new contract, not an optimization.

The trigger for either is a **measured** cost: a plan whose sidecar is large enough that
one read-modify-write is visible in a drag, which needs a real vault to observe and
`npm run perf` to argue about — neither of which exists yet. Until then the correct
version of a slow thing beats a fast thing with an unwritten invalidation rule.

**What this does not buy: undo-stack ordering.** It is tempting to conclude that
serialized writes mean commands complete in dispatch order, so slice 6's undo stack
records them in the order the user performed them. That is false, and the reason is
worth stating so nobody re-derives it: the lock is released when the sidecar write
completes, but the command is not finished then. It goes on to publish
`ZoneGeometryChanged`, and slice 10 awaits that whole recalculation cascade inside the
same dispatch. A command touching one Requirement can therefore finish its cascade and
resolve before an earlier command still recalculating twenty, and `CommandHistory.run()`
pushes in resolution order — so Undo would target the wrong edit.

Serializing the storage primitive prevents lost updates. Ordering the undo stack is a
different guarantee at a different level, and slice 6 provides it by serializing
`CommandHistory`'s own operations per Plan. Both are needed; neither substitutes for the
other.

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

### Repository ports are Slice 3's, unchanged

Slice 3 declares `ProjectRepository`, `PlanRepository`, and `ZoneRepository` in
`application/ports/`, with every method — reads included — returning a `Result`, and
"not found" expressed as `ok(null)`. This slice **implements** those ports; it does not
restate, widen, or narrow a single signature. That is the load-bearing half of Slice 3's
own reasoning for declaring them a slice early: a port this slice had to widen is a port
every command and query written against it has to be revisited for, and the swap this
slice exists to prove ("everything above can change persistence technology without
knowing it happened", §41) would not have been proven at all.

The one thing this slice adds is that the `isErr` branch stops being hypothetical. An
`InMemoryZoneRepository.getById` can never fail; `ObsidianZoneRepository.getById` reads
a file, resolves a path through the index, and runs a Zod parse, any of which can. Slice
3's commands already handle that branch, so nothing in `application/` changes here.

The `InMemory*Repository` implementations are likewise Slice 3's, reused as-is. They are
permanent code, not test scaffolding to delete once the Obsidian ones exist (§72).

```typescript
// tests/contracts/zone-repository.contract.ts — Slice 3's suite, imported verbatim
export function zoneRepositoryContract(makeRepository: () => ZoneRepository) {
  describe("ZoneRepository contract", () => {
    it("resolves ok(null) for an unknown id", async () => { /* ... */ });
    it("round-trips a saved zone through getById", async () => { /* ... */ });
    it("upserts by id rather than inserting a duplicate", async () => { /* ... */ });
    it("lists zones by plan", async () => { /* ... */ });
    it("removes a zone on delete", async () => { /* ... */ });
  });
}

// This slice adds the second call site; the suite body is not edited to accommodate it:
zoneRepositoryContract(() => new InMemoryZoneRepository());                  // slice 3
zoneRepositoryContract(() => new ObsidianZoneRepository(/* fixture vault */)); // this slice
```

Persistence DTOs and schemas (versioned; example shown for Zone, Project/Plan
follow the same shape):

```typescript
const ZoneFrontmatterSchemaV1 = z.object({
  type: z.literal("renovation-zone"),
  "schema-version": z.literal(1),
  id: z.string(),
  // Slice 3's conditional-write contract needs this to survive a disk round-trip, and
  // Zod strips what it does not declare — so an undeclared `revision` would be dropped
  // on read, leaving no value for a caller to present back as `expected` and no way to
  // detect a concurrent write at all. It is declared on EVERY note-backed entity
  // schema, not just this one: a port-wide contract with a per-entity gap is not a
  // contract. It is persistence bookkeeping, so the mapper lifts it into
  // `Loaded<Zone>.version` rather than onto the domain entity, which has no such field.
  //
  // Non-negative rather than positive: a note written before this field existed, or
  // hand-created by a user, reads as 0 and takes the insert path. A hand-edited value
  // is not trusted to be meaningful — it is only ever compared for equality, never
  // used as a source of ordering, and the observation token catches the hand edit
  // regardless of what the number says.
  revision: z.number().int().nonnegative().catch(0),
  project: z.string(),
  plan: z.string(),
  name: z.string(),
  "zone-type": z.string(),
  // Exactly Slice 3's ZoneStatus, kebab-cased — three values, not a near-match set.
  status: z.enum(["planned", "in-progress", "complete"]),
});
type ZoneFrontmatterDTO = z.infer<typeof ZoneFrontmatterSchemaV1>;

const SpatialObjectGeometrySchemaV1 = z.object({
  id: z.string(),
  type: z.literal("polygon"),
  points: z.array(z.tuple([z.number(), z.number()])),
});
type SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV1>;

// Slice 7 fills this in; declared here so the sidecar has one schema, versioned once.
const CalibrationSchemaV1 = z.object({
  pointA: z.object({ x: z.number(), y: z.number() }),
  pointB: z.object({ x: z.number(), y: z.number() }),
  knownDistance: z.number().finite().positive(),
  pixelsPerWorldUnit: z.number().finite().positive(),
});

const PlanGeometrySchemaV1 = z.object({
  schemaVersion: z.literal(1),
  planId: z.string(),
  // The whole file's counter, persisted for the same reason each note persists one:
  // slice 7's calibration undo restores every object in this document and must be able
  // to refuse if anything moved since. One integer for the file, because a sidecar write
  // rewrites the whole document — a per-object version would claim a granularity the
  // write does not have. Named `revision` rather than `generation` so the sidecar and
  // the notes share ONE version type rather than two that differ only in a field name.
  // Same `.catch(0)` reasoning as above. The other half of the version, `observed`, is
  // minted per read and never persisted — a token recording what a reader saw is not a
  // property of the file.
  revision: z.number().int().nonnegative().catch(0),
  unit: z.literal("mm"), // ADR-009: mandatory, not merely recommended — a sidecar
                         // missing this field, or carrying any other value, fails
                         // validation and is never loaded, rather than being
                         // silently interpreted as millimeters.
  calibration: CalibrationSchemaV1.nullable(),
  objects: z.array(SpatialObjectGeometrySchemaV1),
});
type PlanGeometryDTO = z.infer<typeof PlanGeometrySchemaV1>;
```

`calibration` is declared as a nullable field of **v1** rather than added by Slice 7 as
a v2 change. Slice 7 lands before any release, so there is no shipped v1 sidecar without
the key to migrate; and a Zod object strips unknown keys by default, so a field Slice 7
"added additively" without touching this schema would be silently discarded on every
read. The one place that ambiguity gets resolved is here, in the schema itself.

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
  // Returns the version alongside the DTO for the same reason getById does: a token
  // meaning "what THIS reader saw" cannot be stored anywhere but with that reader, and
  // a read that did not hand one back would leave every caller unable to write
  // conditionally at all.
  read(planId: PlanId): Promise<Result<{ dto: PlanGeometryDTO; version: EntityVersion }, PersistenceError | ValidationError>>;
  delete(planId: PlanId): Promise<Result<void, PersistenceError>>;

  // There is deliberately NO `write(planId, dto)`. An earlier version of this port had
  // one, with a comment beneath it forbidding the read()+write() composition it is the
  // only way to perform — a method whose own documentation says not to call it, kept
  // "available" for a caller that does not exist. create/mutate/delete cover every use
  // in these slices. A public method with no
  // caller and a documented prohibition is not an escape hatch, it is the lost update
  // waiting for the first person who reads the signature and not the paragraph. If a
  // whole-file replacement is ever genuinely needed, it arrives as a named operation
  // with its own conditional-write contract, not as a bare setter.
  //
  // `read()` stays: hydration needs it, and it hands back the version a conditional
  // write is built from.

  // The read-modify-write of one plan's sidecar, run under that plan's own lock.
  // Every content change goes through THIS — there is no read-then-write pair to
  // compose an alternative out of, which is the point.
  //
  // `expected` is slice 3's conditional-write contract applied to the file this store
  // owns — the SAME EntityVersion the note-backed ports take, both halves. Omitted, the
  // change applies to whatever is current: an ordinary Zone save appending its own
  // entry, last-writer-wins like any forward gesture. Supplied, the mutate refuses
  // unless the file is still at that version, which is what an inverse needs — slice 7's
  // calibration undo restores every object's pre-calibration coordinates, and the LOCK
  // does not make that safe. The lock orders this undo against a concurrent Zone move;
  // ordering is what puts the move on disk first and then lets the undo overwrite it.
  //
  // `revision` alone would not be enough, for the reason it is not enough on a note: a
  // .rpgeo file is registered as a visible, openable file type on purpose (ADR-011), so
  // a hand edit or a synced file carrying a person's change comes back at the SAME
  // revision with different geometry. `observed` is what catches that; refusals are
  // `plan-geometry.revision-conflict` and `plan-geometry.external-modification`.
  //
  // The returned version is what a caller presents next, so a caller that mutates twice
  // never re-reads to find an expectation.
  mutate(
    planId: PlanId,
    change: (dto: PlanGeometryDTO) => PlanGeometryDTO,
    expected?: EntityVersion,
  ): Promise<Result<{ version: EntityVersion }, PersistenceError | ValidationError>>;

  // There is deliberately NO `withGlobalBarrier`. An earlier version of this port
  // declared one — drain every per-plan queue and hold them all — for the sidecar
  // folder migration, and ADR-011's revision removed the setting that migration
  // protected, leaving an exported method with no caller. Per-plan locks still
  // cannot express "no plan may be written right now"; it comes back with the
  // operation that needs it (see "Open: moving a project folder is not designed
  // here"), covering notes as well as sidecars.
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
  // Plan entries only: the path of this Plan's geometry sidecar. This is what
  // getGeometrySidecarPath() reads, and the only way the mapping is ever written
  // — see "The sidecar path is a field on the Plan's entry" below.
  geometrySidecarPath?: string;
}
```

**The sidecar path is a field on the Plan's entry, not an entry of its own.** A sidecar
has no entity ID — it is a file belonging to a Plan, not an entity in the model — so it
cannot be indexed the way a note is, and `upsert`/`rebuild` take entries keyed by
`EntityId`. Carrying the path on the Plan's own entry is what gives
`getGeometrySidecarPath` something to read: `ObsidianPlanRepository` sets it in the same
`upsert` that records the Plan note's path (it has just created or resolved the sidecar,
so it is the only code that knows the path), and `rebuild` recovers it by **joining the
two halves of the scan it already performs** — it reads the project's `Geometry/` folder
for sidecars as well as its note folders (see Persistence Impact), and every validated
`PlanGeometryDTO` carries the `planId` its file belongs to, so each sidecar's own path
attaches to that Plan's entry.

**The filename is the fast path, and the contents are what confirm it.** What ADR-011
forbids is deriving a sidecar's path from the **plan note's** path — that is the
colocation model it replaced, and the reason resolution goes through the index. It says
nothing against reading a sidecar's own filename, which ADR-011 itself fixes as the
plan's stable ID and this section's own convention above repeats. So the rebuild does
not read and Zod-parse every file's full contents to learn something the directory
listing already told it: on a vault with hundreds of plans that is hundreds of whole-file
reads and schema validations, at the one moment `onLayoutReady` is competing with
workspace restoration.

The join is therefore: take the `planId` from the filename, attach the path to that
Plan's entry, and **verify** against the contents — but the verification is where the
cost is, so it is not a full parse of every file either. It is one comparison of the
sidecar's own `planId` field against the filename, on the read the Plan's first Zone
access performs anyway. A mismatch is not a Plan without geometry: it is a broken index
entry, surfaced as a diagnostic (slice 11) and never silently preferred in either
direction, because a hand-renamed sidecar and a hand-edited `planId` field are both
things a user can do to a visible, registered file type.

What this does not weaken: a sidecar whose filename is not a plan ID at all is skipped
with a diagnostic rather than guessed at, and the index still holds the authoritative
`planId → path` entry — nothing outside `rebuild` ever derives a path from anything.

There is deliberately no sidecar reference in the Plan's frontmatter to read instead.
Adding one would put the same fact in two writable places — a note a user can edit and
a folder setting they can change — with no rule for which wins when they disagree, and
§3.6's derived-data-over-duplicate-data preference points the other way. The sidecar
already knows which Plan it belongs to; nothing is gained by having the Plan also claim
to know where its sidecar is.

Without this field the port had a getter no writer could satisfy, and since path
derivation is explicitly forbidden (ADR-011), every Zone read and write on that Plan
would resolve to `undefined`.

A non-Plan entry leaves it absent, and a Plan entry missing it is a broken index rather
than a Plan without geometry: an empty sidecar still exists and still has a path (slice
4 creates one with every Plan), so `undefined` here means the mapping was lost, not that
there is nothing to point at.

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

Queries (application layer) — Slice 3's `GetProject`/`GetPlan`/`GetZone`, re-pointed at
the Obsidian repositories at the composition root and otherwise untouched, plus the one
list query the canvas needs:

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

// New here, not in slice 3: the Plan Editor (slice 5) hydrates a whole plan's zones in
// one call, and §80's naming convention makes that a Find, not a Get. It wraps
// ZoneRepository.listByPlan and adds nothing — declared in this slice because this is
// where the repository method it wraps gets its first real implementation.
interface FindZonesByPlanQuery {
  execute(planId: PlanId): Promise<Result<Zone[], PersistenceError>>;
}
```

## Persistence Impact

- **Reads:** `ProjectIndexBuilder` scans the project folder for Project/Plan/Zone notes
  (via `MetadataCache`, not raw file parsing) and its `Geometry/` subfolder for sidecars,
  populating the Project Index. Every `getById` after that
  is a single file read, not a scan. **This runs from
  `app.workspace.onLayoutReady`, not from `onload`** — slice 1's bootstrap rule, and it
  is load-bearing twice here: a vault-wide scan in `onload` competes with workspace
  restoration on the main thread, and `MetadataCache` is incomplete until layout-ready,
  so a scan that ran earlier would build a partial index that looks complete.
- **Writes:** `ObsidianProjectRepository`/`ObsidianPlanRepository` write Markdown
  frontmatter via `FileManager.processFrontMatter` (note body untouched).
  `ObsidianZoneRepository.save` additionally reads-modifies-writes one entry in its
  plan's geometry sidecar, per the consistency sequence above.
- **New setting:** the project folder for entity notes — added to the settings surface
  Slice 1 established, and read and written through `settingsFrom` like `units`, since
  `data.json` is a trust boundary and a folder path is user-editable text.
- **Known prerequisite for shared catalogues, added 2026-08-26 and not built here.** Both
  halves of this pipeline are scoped to **one** root: `collectNotes` skips any file whose
  path does not start with the project folder, and `VaultChangeAdapter` returns early on
  the same test. §59 as amended makes the [[Asset]], [[Supplier]] and [[Trade]]
  catalogues shared, living in a **library folder** resolved from its own plugin setting
  (§83) rather than from any project folder — so a library that is a separate root is
  invisible to the index *and* to the change pipeline, and a library note would never be
  resolvable or observed.

  **It bites in every valid configuration, not eventually.** An earlier version of this
  paragraph said it did not bite while the library defaulted inside the project root —
  which was wrong, and wrong against the very amendment that created it: §83 now *forbids*
  the library folder and a project folder from being equal or containing one another
  (a project folder holding the library would delete every project's catalogues with it),
  and §36 draws the project folder as `Renovation/Kitchen Refit/`, not the `Renovation/`
  parent. So the library is **never** inside the scanned root. There is no grace period.

  **Whoever next touches this pipeline owes it a decision** — scanning and watching a list
  of roots is the obvious shape — and slice 10's shared-asset queries cannot work until it
  is made. Recorded here rather than fixed in the slice that discovered it, because this
  file owns the index. **That decision is taken, and the list of roots built, in
  [18 — A Project Owns Its Folder](18-a-project-owns-its-folder.md)**, which needs the same
  list for its own reason and so pays for both at once.
  User-supplied paths pass through `normalizePath` before any Vault call. There is no
  second location field: ADR-011 puts geometry in `Geometry/` inside this folder, so the
  sidecar path is derived rather than configured, and changing this one setting while
  data exists is the open question above rather than a sequence this slice specifies.
  **This is the setting that makes slice 1's unrecovered rule bite.** A path is not a
  preference: with `root.settings === null` — `data.json` present but unreadable — a
  default folder is a *different* location, so an index built on it reports the user's
  projects as missing and every write lands in a parallel tree beside their real one.
  This slice is where slice 1's "compose no repositories, no index, no query services
  while settings are unrecovered" stops being a rule about nothing, and its own tests
  assert that the root wires none of the three in that state rather than wiring them
  against defaults.
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
  mapper. This is also where §26's `valid unit` and `valid transform` are enforced,
  and it is the **only** place they can be: slice 8's answers to those two bullets are
  a compile-time type distinction and a downstream finite-coordinate backstop, and
  neither survives contact with a file a user hand-edited. Concretely, the sidecar and
  frontmatter schemas reject a unit outside the persisted vocabulary and a calibration
  or viewport transform whose scale is zero, negative or non-finite, with the same
  invalid fixtures as every other schema rule. See `docs/requirements/Architecture and Software Design.md`'s
  shared-vocabulary entry for the split, and slice 2's Design for why `createPolygon`
  cannot take these two.
- **Migration tests:** a synthetic `v0 → v1` fixture per migratable kind, asserting
  the migration is deterministic (same input → same output) and idempotent
  (re-running it on already-migrated data is a no-op or a validated error, never
  silent corruption).
- **Persistence consistency tests:** simulate a Zone save where the sidecar write
  fails after the frontmatter write succeeds; assert a `PersistenceError` is
  returned and the frontmatter is restored to its prior valid content (or, if the
  compensating write itself fails, that this is surfaced rather than swallowed). The
  mirror case for `delete()`: sidecar removal fails after the note is deleted; assert
  the note is restored, so no caller is handed a failed `Result` for an operation that
  half-happened.
- **Conditional-write tests**, run against the Obsidian repositories and the in-memory
  ones through the shared contract suite, since the whole point of declaring the
  contract in the port is that both honour it: a `save` with a stale `expected` returns
  `<entity>.revision-conflict` and leaves the note byte-identical; a `save` with
  `'absent'` against an existing note returns the same and writes nothing; a `delete`
  with a stale `expected` leaves the entity in place; and a successful `save` returns
  the entity carrying `revision + 1`.
- **External-modification test:** read an entity through the repository, rewrite the
  note's frontmatter *outside* the repository (as a hand edit or a synced file would),
  then `save` with the revision that read returned — the value that still matches, which
  is exactly why the revision comparison cannot catch this. Assert
  `<entity>.external-modification` and that the out-of-band content survives. Reverting
  the digest comparison must turn this test red while every conditional-write test above
  stays green; that is the only evidence that the second comparison is doing work the
  first one was already claimed to do.
- **Digest-scope tests**, both directions, because a digest drawn too wide fails closed
  and looks correct: appending prose to the note body, and adding a frontmatter key this
  version does not declare, each leave a subsequent `save` succeeding, with the body and
  the unknown key preserved in what it wrote.
- **Interleaved-reader test**, which is the one a shared baseline passes and a per-read
  token fails: A reads, the note is changed out of band, a SECOND read runs (a query, a
  status bar, another tab), and then A saves with the version its own read returned.
  Assert `external-modification`. An implementation that keeps one current digest per
  entity has had it refreshed by the second read and lets A's write through — so this
  test is the only one that distinguishes the two designs, and it is the design the
  first draft of this slice had.
- **Round-trip tests for the version fields themselves:** a Zone written and re-read
  returns the `revision` it was written with (asserted against the Zod-parsed DTO, since
  an undeclared key is stripped silently rather than failing), and a sidecar written and
  re-read returns its own `revision`. A note with no `revision` key at all — hand-created,
  or written by a version before the field existed — reads as 0 and takes the insert
  path rather than failing validation.
- **Sidecar version tests:** a `mutate` with no `expected` applies to whatever is current
  and returns the bumped version; one with a stale revision returns
  `plan-geometry.revision-conflict` and leaves the file byte-identical; one whose
  revision matches but whose file was edited out of band returns
  `plan-geometry.external-modification`; and two concurrent `mutate` calls under the
  per-plan lock both land, since ordering is not what a version is for. The
  external-modification case is the one a counter-only implementation passes silently,
  so it is watched failing with the token comparison removed.
- **Insert-specific compensation test:** the same sidecar-write failure, but on a
  save that *creates* a new Zone note rather than updating one. Assert the note does
  not exist afterwards — a restore-the-snapshot compensation would pass the update
  test above while leaving exactly the orphan (a live note with no geometry entry)
  this case exists to prevent, so the insert path needs its own assertion and cannot
  be folded into the update one.
- **Plan lifecycle compensation tests:** a Plan insert whose note write fails after
  the sidecar was created — assert the sidecar is gone and a `PersistenceError` is
  returned; and a Plan delete whose sidecar removal fails after the note was deleted
  — assert the note is restored. Both mirror the Zone cases and both must be
  asserted directly, since a Plan's two writes have the same lack of atomicity and
  the failure is only visible on the path that failed.
- **Immediate-usability test:** save a new Plan, then — with the vault-change pipeline
  disabled or not yet fired — assert `GetPlan` resolves it and
  `ObsidianZoneRepository.save()` finds its sidecar and writes a Zone. This is what
  the synchronous index upsert on the insert path buys, and a test that let the
  debounced pipeline run first would pass without it.
- **Sidecar-mapping round trip:** assert `getGeometrySidecarPath(planId)` returns the
  path after a `save()`-driven `upsert`, after a `rebuild()` from a Vault scan, and
  after an update-only `save()` that changed just the Plan's title (the case where an
  entry written without `geometrySidecarPath` would silently clear the mapping). The
  `rebuild()` case runs against a fixture where the sidecar's **filename does not
  match** what any derivation rule would produce, so a builder that quietly derived the
  path instead of joining on the DTO's `planId` fails rather than passing by accident.
- **Sidecar location test:** with the project folder set to something other than its
  default, a Zone save writes its plan's sidecar to `<project folder>/Geometry/` under
  the plan's full ID — asserted by reading the vault, not by reading back through the
  index, which would pass against a store that wrote anywhere and remembered where.
  A second project with its own folder gets its own `Geometry/`, and neither project's
  scan sees the other's sidecars.
- **Concurrent-write test:** issue two `save()` calls for different Zones on the same
  Plan without awaiting the first, and assert both entries are present in the sidecar
  afterwards. Written against the repository, not a dispatcher — the guarantee has to
  hold for the vault-change pipeline and future spatial-object repositories too, so a
  test that passed only because the caller happened to serialize would be testing the
  caller.
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

1. `Obsidian*` implementations exist for all three of Slice 3's repository ports, and
   **no port signature changed** to accommodate them — `git diff` on
   `application/ports/` across this slice is empty, and nothing in
   `application/commands/` or `application/queries/` was edited to compile against them.
2. The same contract test suite — Slice 3's file, imported, not copied — passes against
   both implementations for all three entities (§72), including the upsert-by-ID case
   Slice 8's undo depends on. No test is written twice, no test is skipped for one side.
3. Zod schemas exist and are versioned (`schema-version: 1` / `schemaVersion: 1`)
   for Project, Plan, and Zone frontmatter and for the plan geometry sidecar; no
   repository or mapper accepts un-validated input, and no raw frontmatter or raw
   sidecar JSON object is passed to application or domain code (§37, Completion
   Criterion 8). `PlanGeometrySchemaV1` requires `unit: "mm"` (ADR-009); a sidecar
   missing that field, or carrying any other value, fails validation and is never
   loaded — a test proves this explicitly, not just that the field exists in the
   schema.
4. Geometry sidecars are written to `Geometry/` inside the project's own folder, keyed
   by plan ID, with the registered custom extension (ADR-011); there is no
   geometry-folder setting, and every resolution goes through the Project Index rather
   than deriving a path at the call site.
5. Saving a Zone updates its frontmatter and its geometry sidecar entry as one
   logical operation; a test proves a mid-sequence failure surfaces a
   `PersistenceError` and does not leave the frontmatter silently pointing at
   discarded geometry (§42).
5a. Every mutating repository method honours slice 3's conditional-write contract, on
    the Obsidian implementations and the in-memory ones alike: a stale `expected`
    refuses with `<entity>.revision-conflict` and writes nothing, `'absent'` against an
    existing entity refuses the same way, and a successful `save` returns the entity
    at `revision + 1`.
5b. A change made to an entity note outside this plugin refuses the next `save` with
    `<entity>.external-modification`, with the out-of-band content intact — and
    reverting the digest comparison turns that test red while leaving item 5a green.
    Note-body prose and undeclared frontmatter keys are outside the digest: a save
    after either still succeeds, and preserves both.
5c. Every note-backed entity schema declares `revision`, and so does the sidecar schema —
    one version type across both, surviving a write/read round-trip; a note or sidecar
    lacking the field reads as 0 rather than failing. Without this the conditional-write contract
    cannot work at all — Zod strips undeclared keys, so the value a caller must present
    back would never come off disk.
5d. `PlanGeometryStore.mutate` honours an optional `expected` version: absent, it applies
    to current state; stale, it refuses and writes nothing. BOTH halves are checked — a
    `.rpgeo` file hand-edited without touching its `revision` refuses with
    `plan-geometry.external-modification`, which is the case a counter-only expectation
    passes and the one ADR-011 makes likely by registering the extension as openable.
    Slice 7's calibration undo is the caller that supplies an expectation.
6. Deleting a Zone compensates symmetrically: a test in which sidecar removal fails
   after the note is deleted asserts the note is restored and a `PersistenceError` is
   returned — so a failed delete leaves nothing deleted, and a caller's failed
   `Result` never means "partly done, and no longer undoable."
6a. A Zone save that *inserts* a note and then fails its sidecar write deletes that
    note rather than restoring a snapshot it never had — asserted by its own test,
    separate from the update-path case in item 5, since restoring nothing would leave
    a live note with no geometry and still pass item 5.
6b. `ObsidianPlanRepository` compensates its own two-file lifecycle: an insert writes
    the sidecar before the note and deletes the sidecar if the note write fails; a
    delete removes the note before the sidecar and restores the note if the sidecar
    removal fails. Both directions are covered by tests, so a failed Plan create or
    delete never exposes a live Plan without its sidecar.
6c. A newly saved Plan is usable immediately, without waiting for the vault-change
    pipeline: `GetPlan` resolves it and a Zone can be saved against it, because the
    insert path upserts the Project Index entry — note path **and**
    `geometrySidecarPath` — synchronously on success.
6d. `getGeometrySidecarPath(planId)` is populated by every writer that can populate
    it: `ObsidianPlanRepository.save()` on insert and on update, and `rebuild()` from
    a Vault scan, which joins each scanned sidecar to its Plan entry on the
    `PlanGeometryDTO`'s own `planId` — never on the filename, and never from a
    frontmatter field (there is none). The port has no read whose mapping nothing
    writes, and no caller derives a sidecar path from a note path (ADR-011).
6e. The settings schema declares **one** folder field, the project folder. A
    geometry-folder setting is absent, not defaulted — asserted against the settings
    definitions themselves, since a field nothing reads is invisible to every other
    test here and would quietly reintroduce the placement decision ADR-011 removed.
7. Two concurrent `save()` calls for different Zones on the same Plan both survive: a
   test issues them without awaiting the first, then asserts the sidecar contains both
   entries. Serialization lives in `PlanGeometryStore.mutate`, so the test drives the
   repositories rather than a dispatcher, and no caller-side sequencing is what makes
   it pass.
8. The migration registry/runner exists under
   `infrastructure/persistence/migration/{project,entities,geometry}` and is
   exercised by at least one synthetic migration test proving determinism and
   idempotency, even though no real prior schema version exists yet (§45,
   Completion Criterion 9).
9. `VaultChangeAdapter` reacts to create/modify/rename/delete and updates the
   Project Index incrementally; a test proves a full rebuild and the incremental
   path converge to the same index for the same fixture vault.
10. The Project Index answers all five lookups (entity ID → path, entity type → IDs,
   project ID → entity IDs, plan ID → spatial-object IDs, plan ID → geometry
   sidecar path) and is fully rebuildable from Vault contents with the in-memory
   index discarded (Completion Criterion 14).
11. `GetProject`, `GetPlan`, `GetZone`, and `FindZonesByPlan` resolve against the
   Obsidian repositories and are used by the end-to-end reload test; a missing entity
   resolves `ok(null)`/`ok([])`, and only a genuine read failure resolves `isErr`.
12. The end-to-end reload test — create Project/Plan/Zone, discard in-memory state,
    rebuild the index, re-read through the same repositories, assert equality —
    passes. This is Increment 3's success criterion made concrete: **Project, Plan,
    and Zone survive full unload/reload.**
13. A malformed note or sidecar in a fixture vault (`tests/vault/broken-references`,
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
- ADR-011: Project-Scoped Geometry Sidecar Folder and Dedicated File Extension —
  **supersedes ADR-002's colocation example** (`Ground Floor.geometry.json` next to
  `Ground Floor.md`). This slice implements ADR-011's location (`Geometry/` inside the
  project's own folder, keyed by plan ID, dedicated registered extension), not
  ADR-002's original example.
- PRD §8 Core Entities (Project, Plan, Zone property lists this slice's frontmatter
  shapes are derived from)

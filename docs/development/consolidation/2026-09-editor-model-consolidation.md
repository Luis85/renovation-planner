# Editor model consolidation (WP0)

**Baseline:** `main` at `04a8ca5f`, inspected 2026-09-02.
**Branch commit:** `b4243162` (`claude/plan-editor-foundation-read-path`) — this file's own inventory
was measured at this commit, one commit past the round-trip instrument.
**Instrument:** `tests/infrastructure/persistence/editorRoundTrip.test.ts`.
**Decisions:** ADR-0016 (Room/Zone), ADR-0017 (Plan/Floor). Five ADRs deferred (§6).

## 1. Inventory

Every file returned by the `ls`/`grep` commands the task brief names, one row each.

### 1.1 Domain

| Layer | Item | File | Editor role |
|---|---|---|---|
| entity | `Project` | `src/domain/project/Project.ts` | the Renovation project the floor belongs to; `ProjectStore.hydrate` reads it via `GetProject` for the context bar and currency |
| value object | `ProjectId` | `src/domain/project/ProjectId.ts` | branded id carried unchanged into `ProjectSummaryDto`/`FloorDto.projectId` |
| value object | `ProjectStatus` | `src/domain/project/ProjectStatus.ts` | lifecycle stage; not read by this increment's shell (out of scope, §12) |
| error catalog | `Project.errors.ts` | `src/domain/project/Project.errors.ts` | `project.*` codes; surfaces through `toUserMessage` if `GetProject` refuses |
| events | `Project.events.ts` | `src/domain/project/Project.events.ts` | `ProjectCreated`; not consumed by the read path this increment builds |
| entity | `Plan` | `src/domain/plan/Plan.ts` | the Floor; read by `GetPlan` → `PlanDto` → `FloorDto` (ADR-0017) |
| value object | `PlanId` | `src/domain/plan/PlanId.ts` | branded id, the `FloorDto.id` |
| value object | `Calibration` | `src/domain/plan/Calibration.ts` | `Plan.calibration`; drives the status bar's scale-state key (spec §5.7) |
| value object | `PlanBackgroundRef` | `src/domain/plan/PlanBackgroundRef.ts` | `Plan.background`; drives the `reference` layer row's `available`/`supported-empty` state (spec §5.3) |
| error catalog | `Plan.errors.ts` | `src/domain/plan/Plan.errors.ts` | `plan.*` codes |
| events | `Plan.events.ts` | `src/domain/plan/Plan.events.ts` | `PlanCreated`, `PlanCalibrated`, `PlanBackgroundChanged`; the last drives the Plan Editor's stale-on-change re-hydrate (unchanged by this increment) |
| entity | `Zone` | `src/domain/zone/Zone.ts` | the Room/Area; read by `FindZonesByPlan`/`GetZone`/`GetZoneInspector` → `SpatialRecordDto` (ADR-0016) |
| value object | `ZoneId` | `src/domain/zone/ZoneId.ts` | branded id, the `SpatialRecordDto.id` and the Room's identity end to end |
| value object | `ZoneType` | `src/domain/zone/ZoneType.ts` | seven-member union; `'Room'` is the ADR-0016 discriminator, every other value presents as Area |
| value object | `ZoneStatus` | `src/domain/zone/ZoneStatus.ts` | `Planned`/`InProgress`/`Complete`; a progress axis — see gap #3, never Existing/Planned |
| error catalog | `Zone.errors.ts` | `src/domain/zone/Zone.errors.ts` | `zone.*` codes |
| events | `Zone.events.ts` | `src/domain/zone/Zone.events.ts` | `ZoneCreated`, `ZoneGeometryChanged`, `ZoneDeleted`; the retirement watcher (spec §6.5) reacts to hydration, not to these directly |
| entity | `Asset` | `src/domain/asset/Asset.ts` | the catalogue item behind a Requirement; not read by this increment's shell, reached only through the unchanged Requirements panel |
| value object | `AssetId` | `src/domain/asset/AssetId.ts` | branded id |
| value object | `AssetCategory` | `src/domain/asset/AssetCategory.ts` | catalogue vocabulary; out of scope for the read path |
| error catalog | `Asset.errors.ts` | `src/domain/asset/Asset.errors.ts` | `asset.*` codes |
| events | `Asset.events.ts` | `src/domain/asset/Asset.events.ts` | `AssetCreated`/etc., keyed on `assetId` alone since slice 19 (no `projectId`) |
| entity | `Requirement` | `src/domain/requirement/Requirement.ts` | the cost/quantity link a Zone carries; read by the existing `GetRequirementsForZone` → `RequirementInspectorDTO`, unchanged by this increment |
| value object | `RequirementId` | `src/domain/requirement/RequirementId.ts` | branded id |
| value object | `RequirementOrigin` | `src/domain/requirement/RequirementOrigin.ts` | discriminated union naming which `ZoneId` a Requirement originates from |
| error catalog | `Requirement.errors.ts` | `src/domain/requirement/Requirement.errors.ts` | `requirement.*` codes |
| events | `Requirement.events.ts` | `src/domain/requirement/Requirement.events.ts` | cost-changed events; drive the recalculation cascade, unrelated to this increment's read path |

### 1.2 Persistence — DTOs, mappers, repositories

| Layer | Item | File | Editor role |
|---|---|---|---|
| DTO | `ProjectFrontmatterSchemaV1` | `src/infrastructure/persistence/dto/projectFrontmatter.ts` | project-note schema v1; keys measured in §2 |
| DTO | `PlanFrontmatterSchemaV1` | `src/infrastructure/persistence/dto/planFrontmatter.ts` | plan-note schema v1; keys measured in §2 |
| DTO | `ZoneFrontmatterSchemaV1` | `src/infrastructure/persistence/dto/zoneFrontmatter.ts` | zone-note schema v1; keys measured in §2 |
| DTO | `AssetFrontmatterSchemaV1` | `src/infrastructure/persistence/dto/assetFrontmatter.ts` | asset-note schema v1; not read by this increment |
| DTO | `RequirementFrontmatterSchemaV1` | `src/infrastructure/persistence/dto/requirementFrontmatter.ts` | requirement-note schema v1; feeds the unchanged Requirements panel |
| DTO | `PlanGeometrySchemaV1` / `SpatialObjectGeometrySchemaV1` / `CalibrationSchemaV1` | `src/infrastructure/persistence/dto/planGeometry.ts` | the `.rpgeo` sidecar — one polygon per zone id, calibration; `SpatialRecordDto.points`/`areaMm2` and `FloorDto`'s calibration state derive from it |
| DTO helper | `kebabEnum`/`toKebab`/`fromKebab` | `src/infrastructure/persistence/dto/kebab.ts` | the one casing bridge; `zone-type: room` is `toKebab('Room')` — see gap #5 |
| mapper | `projectMapper` | `src/infrastructure/persistence/mappers/projectMapper.ts` | note ⇄ `Project`; the currency the round-trip test asserts round-trips through `currencyOf` |
| mapper | `planMapper` | `src/infrastructure/persistence/mappers/planMapper.ts` | note+sidecar ⇄ `Plan`; supplies `background`/`calibration` |
| mapper | `zoneMapper` | `src/infrastructure/persistence/mappers/zoneMapper.ts` | note+sidecar ⇄ `Zone`; `zoneToPersistence` is where `zone-type` is kebab-cased (gap #5) |
| mapper | `assetMapper` | `src/infrastructure/persistence/mappers/assetMapper.ts` | note ⇄ `Asset`; unused by this increment |
| mapper | `requirementMapper` | `src/infrastructure/persistence/mappers/requirementMapper.ts` | note ⇄ `Requirement`; unused by this increment's read path proper, feeds the unchanged Requirements panel |
| mapper helper | `parsePersisted` | `src/infrastructure/persistence/mappers/parse.ts` | the one Zod-parse door every mapper reads through (SDD §43) |
| repository | `ObsidianProjectRepository` | `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts` | backs `GetProject`; the round-trip test drives it directly |
| repository | `ObsidianPlanRepository` | `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` | backs `GetPlan`; merges `Plan.calibration` from the sidecar |
| repository | `ObsidianZoneRepository` | `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` | backs `FindZonesByPlan`/`GetZone`/`GetZoneInspector` |
| repository | `ObsidianAssetRepository` | `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts` | backs `ListAssets`; unused by this increment's shell |
| repository | `ObsidianRequirementRepository` | `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts` | backs `GetRequirementsForZone`; unchanged |
| sidecar repository | `ObsidianPlanGeometrySidecar` | `src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts` | the `.rpgeo` reader/writer; owns `calibration` and per-zone geometry |
| sidecar composition | `PlanGeometryStore` | `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` | ensures the `Geometry/` folder and composes the sidecar file per plan |
| index port impl | `IndexLibraryOverlaps` | `src/infrastructure/obsidian/repositories/IndexLibraryOverlaps.ts` | §83 library-overlap marker; unrelated to this increment's read path |
| concurrency | `KeyedQueues.ts` | `src/infrastructure/obsidian/repositories/KeyedQueues.ts` | per-entity/per-plan mutual exclusion every repository save takes; read path is unaffected (no write here) |
| composition | `NoteVaultDeps.ts` | `src/infrastructure/obsidian/repositories/NoteVaultDeps.ts` | the shared bundle (`Vault`, `MetadataCache`, index, ledger, migration runner) every repository above is built from |
| write helper | `noteEntityWrite.ts` | `src/infrastructure/obsidian/repositories/noteEntityWrite.ts` | shared insert/update helper; not exercised by the read path |
| I/O | `noteIo.ts` | `src/infrastructure/obsidian/repositories/noteIo.ts` | `frontmatterOf`, folder ensure, the echo-window read; every repository's read goes through it |
| path derivation | `paths.ts` | `src/infrastructure/obsidian/repositories/paths.ts` | `projectFolderOf` and friends (ADR-0013); not consulted by a pure read |
| overlap predicate | `foldersOverlap.ts` | `src/infrastructure/obsidian/repositories/foldersOverlap.ts` | §19/§83 folder-collision guard; unrelated to this increment |
| version compare | `digest.ts` | `src/infrastructure/obsidian/repositories/digest.ts` | `observeFrontmatter`, the per-schema digest every mapper's caller uses to build `EntityVersion` |
| version compare | `versionCheck.ts` | `src/infrastructure/obsidian/repositories/versionCheck.ts` | `checkExpectedVersion`; a write-path concern, not exercised by this increment's queries |

### 1.3 Application — commands and queries

| Layer | Item | File | Editor role |
|---|---|---|---|
| command | `CreatePlan` | `src/application/commands/plan/CreatePlan.ts` | out of scope this increment (writes nothing new, §1) |
| command | `ReversibleCalibratePlan` | `src/application/commands/plan/ReversibleCalibratePlan.ts` | backs the layer catalogue's "Set scale" action (spec §5.3), unchanged |
| command | `ReversibleSetPlanBackground` | `src/application/commands/plan/ReversibleSetPlanBackground.ts` | not invoked by this increment (no background-setting UI here) |
| command | `SetPlanBackground` | `src/application/commands/plan/SetPlanBackground.ts` | plain form behind the reversible adapter above |
| command port | `loadPlan.ts` | `src/application/commands/plan/loadPlan.ts` | shared load-before-write helper other Plan commands use |
| command port | `savePlan.ts` | `src/application/commands/plan/savePlan.ts` | shared save-and-publish helper other Plan commands use |
| command | `CreateZone` | `src/application/commands/zone/CreateZone.ts` | backs Add → Room (`draw-polygon`), unchanged by this increment |
| command | `DeleteZone` | `src/application/commands/zone/DeleteZone.ts` | backs the Room Inspector's Delete button, unchanged |
| command | `MoveSpatialObject` | `src/application/commands/zone/MoveSpatialObject.ts` | backs `SelectTool`'s drag, unrelated to the read path |
| command port | `loadZone.ts` | `src/application/commands/zone/loadZone.ts` | shared load-before-write helper |
| command | `restore-zone.ts` | `src/application/commands/zone/restore-zone.ts` | undo-path zone restoration; unrelated to the read path |
| command | `reversible-create-zone-command.ts` | `src/application/commands/zone/reversible-create-zone-command.ts` | undo/redo wrapper around `CreateZone`; feeds `PlanEditorCommandServices` |
| command | `reversible-delete-zone-command.ts` | `src/application/commands/zone/reversible-delete-zone-command.ts` | undo/redo wrapper around `DeleteZone` |
| query | `FindZonesByPlan` | `src/application/queries/FindZonesByPlan.ts` | the canvas/list zone source; read by `ZoneScene`, and by the new `SpatialRecordDto` mapping (spec §3) |
| query | `GetDiagnosticsSnapshot` | `src/application/queries/GetDiagnosticsSnapshot.ts` | not part of the read path; diagnostics only |
| query | `GetPlan` | `src/application/queries/GetPlan.ts` | the Floor read; feeds `PlanDto`/`FloorDto` |
| query | `GetProject` | `src/application/queries/GetProject.ts` | the new `PlanEditorQueryServices.getProject` this increment wires (spec §3) |
| query | `GetRequirementsForZone` | `src/application/queries/GetRequirementsForZone.ts` | backs the existing unchanged Requirements panel; `RequirementInspectorDTO` is declared here |
| query | `GetZone` | `src/application/queries/GetZone.ts` | single-zone read; not the increment's primary path (`FindZonesByPlan` is) but shares the entity |
| query | `GetZoneInspector` | `src/application/queries/GetZoneInspector.ts` | backs `RoomOverviewDto`'s area/geometry half |
| query | `ListAssets` | `src/application/queries/ListAssets.ts` | catalogue read; unused by this increment |
| query | `ListPlansByProject` | `src/application/queries/ListPlansByProject.ts` | backs the Renovation Project view's plan list, not the Plan Editor itself |
| query | `ListProjects` | `src/application/queries/ListProjects.ts` | backs the Renovation Project view's project list, not the Plan Editor itself |
| query | `ListReassignmentTargets` | `src/application/queries/ListReassignmentTargets.ts` | delete-flow reassignment picker; unrelated to the read path |
| query | `ListRequirementsReferencing` | `src/application/queries/ListRequirementsReferencing.ts` | delete-flow reference read; unrelated to the read path |
| shared shape | `Query.ts` | `src/application/queries/Query.ts` | the `Query<TInput, TResult>` interface every query above implements |
| DTO | `reassignmentTypes.ts` | `src/application/queries/reassignmentTypes.ts` | `ReassignmentTargetDto`; unrelated to the read path |

## 2. Mapping matrix

| Homeowner term | Read model (presentation) | Domain | Persisted key(s) | Classification |
|---|---|---|---|---|
| Renovation project | `ProjectSummaryDto` (existing) / `PlanEditorQueryServices.getProject` (this increment, spec §3) | `Project` | project note: `type`, `schema-version`, `id`, `revision`, `name`, `status`, `currency` (also `description`, `start`, `target-completion` — persisted but not part of this increment's context bar) | retain |
| Floor | `FloorDto` (ADR-0017) | `Plan` | plan note: `type`, `schema-version`, `id`, `revision`, `project`, `name`, `background-path`, `background-kind`, `background-page`, `layers`; sidecar: `calibration` | adapt |
| Room | `SpatialRecordDto` kind=`room` (ADR-0016) | `Zone` (`zoneType === 'Room'`) | zone note: `type`, `schema-version`, `id`, `revision`, `project`, `plan`, `name`, `zone-type` (kebab, e.g. `room` — gap #5), `status` (kebab); sidecar entry by `id`: `type`, `points` | adapt |
| Area | `SpatialRecordDto` kind=`area` | `Zone` (every other `ZoneType`) | same as Room | adapt |
| Existing state | — | — | — | gap, ADR-EPW deferred |
| Planned state | — (NOT `ZoneStatus`) | — | — | conflict recorded: `ZoneStatus` (`Planned`/`InProgress`/`Complete`) is a progress axis (gap #3), never an Existing/Planned/Work state |
| Work | — | — | — | gap |
| Material | `RequirementInspectorDTO` | `Asset` + `Requirement` | asset note, requirement note | partial equivalence |
| Cost | `Requirement.estimatedCost` | `Requirement` | requirement note | partial; never floor-aggregated here (`FloorSummaryDto.estimatedCost` is always `unavailable` this increment, spec §3) |
| Documents / photos / notes | — | — | — | gap |

## 3. Round-trip matrix

One row per field `tests/infrastructure/persistence/editorRoundTrip.test.ts` asserts, all six
`it` cases cited by their exact names. The sixth arrived with the Add Room increment and differs
in kind from the other five: it builds its Zone through the REAL `CreateZoneCommand` rather than
through the file's `makeZone` fixture, so it is the one row-set that says the CREATION path and
the read path agree about one record.

| Field | Canonical store | Schema version | Test case |
|---|---|---|---|
| `Project.id` | project note `id` | v1 | `reads back the project fields the context bar shows` |
| `Project.name` | project note `name` | v1 | `reads back the project fields the context bar shows` |
| `Project.currency` | project note `currency` | v1 | `reads back the project fields the context bar shows` |
| `EntityVersion.revision` (project) | project note `revision` | v1 | `reads back the project fields the context bar shows` |
| `Plan.id` | plan note `id` | v1 | `reads back the plan fields the floor summary shows` |
| `Plan.projectId` | plan note `project` | v1 | `reads back the plan fields the floor summary shows` |
| `Plan.name` | plan note `name` | v1 | `reads back the plan fields the floor summary shows` |
| `Plan.background` (asserted `null`) | plan note `background-path`/`background-kind`/`background-page` | v1 | `reads back the plan fields the floor summary shows` |
| `Plan.calibration` (asserted `null`) | geometry sidecar `calibration` | v1 | `reads back the plan fields the floor summary shows` |
| `Zone.id` | zone note `id` | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.planId` | zone note `plan` | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.projectId` | zone note `project` | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.name` | zone note `name` | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.zoneType` (domain label `'Room'`) | zone note `zone-type` (persisted `'room'`, kebab) | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.status` (asserted `'Planned'`) | zone note `status` (persisted `'planned'`, kebab) | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.geometry.points` (four vertices) | geometry sidecar object `points` | v1 | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| `Zone.area()` (15,120,000 mm²) | derived from `points`, never stored | — | `reads back the zone as one logical record: note fields plus sidecar geometry` |
| zone note `type`, `schema-version`, `id`, `zone-type` (kebab), `name`; absence of `kind`/`room` keys | zone note | v1 | `persists the zone note with the v1 keys the spec names, and nothing homeowner-facing` |
| `Zone.id` (minted by `CreateZoneCommand`, not by a fixture) | zone note `id`; sidecar entry key | v1 | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| `Zone.name` (`'Kitchen'`, the visible name a form wrote) | zone note `name` | v1 | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| `Zone.zoneType` (`'Room'`, decided by Add → Room rather than by a field the user chose) | zone note `zone-type` (persisted `'room'`, kebab) | v1 | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| `Zone.geometry.points` (the rectangle's four corners, clockwise from the min corner) | geometry sidecar object `points` | v1 | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| `Zone.area()` (15,960,000 mm² for 4.2 m × 3.8 m) | derived from `points`, never stored | — | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| absence of `width`, `depth` and `room` keys — a rectangle is stored as a POLYGON, and nothing in frontmatter says otherwise | zone note | v1 | `round-trips a rectangle created through CreateZoneCommand as a polygon under one id` |
| user-authored body text below frontmatter | zone note body (unversioned prose, user-owned) | n/a | `keeps a user-authored body across a plugin save` |
| `Zone.name` after a re-save (`'Kitchen (renamed)'`) | zone note `name` | v1 | `keeps a user-authored body across a plugin save` |

## 4. Gap register

| # | Finding | Severity | Affected data | Classification |
|---|---|---|---|---|
| 1 | `Zone.domainNoteLink` exists on the entity (`src/domain/zone/Zone.ts`, `CreateZoneProps`) and on `CreateZoneInput` (`src/application/commands/zone/CreateZone.ts`), absent from `ZoneFrontmatterSchemaV1` and `zoneMapper` | low | none today | intentional-until-used; decide with ADR-RL |
| 2 | Sidecar entries (`SpatialObjectGeometrySchemaV1`) carry only `id`/`type`/`points`; no subtype/layer/state | low | all plans | extend later; ADR-SO |
| 3 | `ZoneStatus` (`Planned`/`InProgress`/`Complete`, `src/domain/zone/ZoneStatus.ts`) is a progress axis | high if misused | all zones | never presented as Existing/Planned; ADR-EPW |
| 4 | Project note persists no budget/contingency/location | low | all projects | out of scope |
| 5 | `zoneMapper.zoneToPersistence` writes `toKebab(zone.zoneType)`: the domain value `'Room'` persists as `'zone-type': 'room'`, and `ZoneFrontmatterSchemaV1`'s `kebabEnum` reads it back to the domain label on load. Measured against the real mapper in Task 3 (`tests/infrastructure/persistence/editorRoundTrip.test.ts`'s fourth case), which failed on a first draft asserting `'Room'` and was corrected to `'room'`. ADR-0016's Context section already spelled `zone-type: room` correctly (`docs/development/adrs/0016-a-room-classified-zone-presents-as-room.md`); only the implementation plan document's Task 3 test code (`docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`, `toBe('Room')`) had spelled it `'Room'` | low | none — the mapper is correct and already shipped | intentional; the note key is kebab, the domain label is the mapper's job to restore |
| 6 | No room KIND on `Zone`. M03 asks the renovator to "choose a room type", and interaction spec §69 lists Kitchen, Living room, Bedroom, Bathroom, Other — but `ZoneType` is the Room/Area classifier (ADR-0016) and Add → Room has already fixed it to `'Room'`. The Add Room increment presents the type question as a row of NAME suggestions instead (`editor.room.suggestion.*`, six of them), so what is persisted is the visible name and nothing else — which is exactly what that increment's own task requires ("Confirmation persists the visible name, not a translation key or internal type"). Design spec §2.4 | low | none today — no reader would exist for the field either | deferred, ADR-RK. A kind stored now would be a label nothing queries |

## 5. Compatibility decision

No schema version moves. Every fixture under `tests/vault/` and `tests/fixtures/` is
preserved unchanged. No migration step is registered. The migration-contract task is
discharged for this increment by this paragraph and by the round-trip instrument.

## 6. Deferred ADRs, with triggers

| ADR | Question | First consumer | Trigger |
|---|---|---|---|
| HI | Property → Building → Floor persistence | Navigate PBI | two buildings, or floor alignment (ADR-0017) |
| EPW | Existing / Planned / Work representation | Feature C | the first Existing or Planned record |
| SO | polygon-only sidecar → walls/openings | Feature B walls | the first non-polygon spatial object |
| RL | one relationship mechanism spatial ↔ vault records | Feature C/D | the first Work item or evidence link |
| SV | additive change at v1 vs version bump | first key that moves or changes meaning | see CLAUDE.md's "still empty BY A DECISION" |
| RK | a room KIND beside `ZoneType` — a stored classifier (kitchen, bathroom, …) distinct from the Room/Area split | the first query BY kind | per-kind cost defaults, per-kind material lists, or a room filter. Until one exists, the suggestion buttons set a NAME and the kind is unmodelled (gap #6) |

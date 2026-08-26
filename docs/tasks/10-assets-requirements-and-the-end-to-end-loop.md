---
type: Task
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 20
dependsOn:
  - "[[04-persistence-and-repository-layer]]"
  - "[[08-zone-editing]]"
  - "[[09-quantity-and-cost-engine]]"
status: Active
started: 2026-08-25
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 10: Assets, Requirements & the End-to-End Loop

## Purpose

This slice adds the last two domain entities the MVP architecture needs — `Asset`
and `Requirement` — and wires them to Zone geometry (slice 8), the Quantity &
Cost Engine (slice 9), and the Inspector (slice 6) through the persistence
pattern slice 4 established. It introduces no new architectural mechanism of its
own: no new rendering layer, no new state-management pattern, no new persistence
strategy. Its entire job is integration — proving that the pieces built in
slices 2–9 actually compose into the loop the SDD's §90 MVP Architecture Slice
diagram draws and §91 Increment 7 names:

```text
Zone Geometry → Area → Requirement → Cost
```

This is the closing slice of the architecture-only phase (together with the
cross-cutting slices 11–12). Once it is done, every entity and mechanism the
rest of the PRD's epics need — Trade, Work Package, Task, Supplier, Procurement,
and so on — has a proven template to follow. Nothing past this point requires
new architecture; it is feature development on a foundation that already works
end to end.

## Scope

### In scope

- The `Asset` domain entity: a reusable catalog item (material, furniture,
  fixture, plant, equipment, building element, or custom), following the exact
  module/command/event/repository pattern slice 3 established for
  Project/Plan/Zone.
- The `Requirement` domain entity: the link between a Zone's geometry, an
  assigned Asset, a calculated quantity, and a calculated cost — with both
  quantity and cost independently overridable via slice 9's `DerivedValue<T>`.
- The command and event sequence that ties Zone geometry edits to Requirement
  recalculation to cost re-estimation, over the Event Bus (slice 2/3):
  `ZoneGeometryChanged → RequirementInvalidated → RequirementRecalculated →
  CostEstimateChanged`.
- Wiring slice 9's Quantity Engine (area → measured quantity → required
  quantity → waste → purchase quantity) and Cost Pipeline (quantity → unit
  price → estimated cost) to real `Zone` and `Asset` data, for the **area**
  requirement rule only.
- Extending slice 4's repository pattern with `AssetRepository` and
  `RequirementRepository` (+ Obsidian and in-memory implementations), and
  extending slice 6's Inspector with a Requirements panel for the selected
  Zone.
- `ReversibleAssignAssetCommand`: the undoable adapter the Inspector actually
  dispatches (PRD §68), over the plain, idempotent `AssignAssetCommand`.
- The read model for a Requirement whose **Asset** is gone — `missingTarget` on the
  Inspector DTO — since `delete-anyway` is what creates that state and the Requirements
  panel is the surface that would otherwise fail to build the row at all.
- Extending the Project Index (SDD §47) with the lookups this slice's event
  handler needs to find affected Requirements without a Vault scan.
- **`ReferenceLock`, the `SequenceMarker` and its load-time recovery** — the
  two-level lock hierarchy, the durable marker written before a multi-entity
  sequence's first mutation, and the recovery pass that reads one at load. Listed
  here because it is a substantial, testable piece of this slice rather than an
  implementation detail of the delete flow: it is what makes "a failed resolution
  leaves the Vault as it was" true across a process exit, and slice 8's
  `ReversibleDeleteZoneCommand.undo()` takes the same contract. Its own design is
  under "Deletion & reference integrity"; its persistence is in **Persistence
  Impact**.

### Out of scope (covered by other slices)

- Zone editing mechanics, geometry validation, the polygon/vertex tools, and
  undo/redo command history itself — slice 8 and slice 6. This slice only
  consumes the `ZoneGeometryChanged` event they already emit.
- The Quantity Engine, Cost Pipeline, `Money`, and `DerivedValue<T>` internals
  — rounding rules, unit conversion, decimal arithmetic (ADR-010) — slice 9.
  This slice calls that engine; it does not re-implement or extend it.
- The repository/persistence base pattern, Markdown↔DTO mapping, Zod
  validation machinery, Vault change detection — slice 4. This slice only
  instantiates that pattern for two new entity types.
- Every entity beyond Asset and Requirement: Trade, Work Package, Task,
  Construction Section, Supplier, Quote, Procurement Item, Document, Risk,
  Decision (PRD Epics 5, 8–20). These are feature work built on this slice's
  template, not part of it.
- **Asset placement as a spatial object.** Epic 6 also describes "asset
  placement," "geometry-linked asset," and a "searchable asset catalog" —
  placing an Asset instance on the canvas (e.g., a window icon at a point) with
  its own position and a count-based automatic quantity. Increment 7's
  deliverables list only "Asset, Requirement, area-based requirement
  calculation, unit price, estimated cost" — no placement tool. In this slice
  an Asset is a catalog note referenced by ID; it owns no geometry and is not a
  `SpatialObject`. Placement is later feature work built on `PlaceAssetTool`
  (SDD §57), which already exists as a named future tool.
- **Discount, shipping, tax, contingency, and cost aggregation.** SDD §51's
  Cost Pipeline has five stages after quantity; this slice wires only Quantity
  × Unit Price → Estimated Cost. Discount/shipping/tax remain identity (no-op)
  stages in slice 9 until Epic 7's remaining features turn them on.
  Quoted/Committed/Actual cost types (PRD §11) and a general-purpose `cost/`
  domain module (SDD §7.2) are not introduced here — this slice's estimated
  cost lives directly on `Requirement`.
- `Asset.supplier` is a plain string field, not a reference to a real
  `Supplier` entity — that entity is Epic 11 (Suppliers & Quotes) and is
  explicitly deferred.
- **A project-level list of Requirements**, and with it any *browsable* in-plugin surface for
  the Requirements that `delete-anyway` on a **Zone** strands. Not that nothing reaches them:
  a stranded Requirement is a §63 *deleted object* reference failure, and the
  *Validation and vault health* Feature (`docs/requirements/Validation and vault health.md`,
  MVP horizon, not yet assigned to a slice) is what answers "what is broken and where" — with
  slice 11's content-free `DiagnosticsSnapshot.validationIssues` reporting *that* an entity has
  an issue in the meantime. What this slice defers is the navigable list, not the detection. Every surface this map builds
  is scoped to a selection or a Plan: the Requirements panel hangs off a selected Zone,
  and a Zone-less Requirement has no Zone to select. The list that would reach it is
  project-scoped content in the Renovation Project view, which slice 14 explicitly
  defers as feature work ("the Renovation Project view's *populated* content"), or a
  Bases view over `Requirements/`, which the slice map defers with SDD §13. This slice
  therefore declares no `ListOrphanedRequirements` query: a query no surface calls is a
  dead export `npm run analyze` fails on, and the repository's own rule is that a thing
  arrives with its first real use. What the state costs the user, and what the MVP does
  offer instead — along with the two other ways out that were refused — is stated under
  "Deletion & reference integrity".

## Dependencies

| Slice | What this slice takes from it |
| --- | --- |
| 2 — Core Primitives | `area(polygon)` (a `Result`), `Result<T, E>` and its guards, identity/ID scheme, Event Bus base |
| 3 — Domain Foundation | The entity/command/event module pattern, applied to Zone; `ZoneId`, `ProjectId` |
| 4 — Persistence & Repository | Repository interface shape, Markdown↔DTO↔domain mapping, Zod schema pattern, Project Index |
| 6 — Editor Tool Framework, Undo/Redo & Inspector | Command dispatch from UI, `UndoableCommand`, Inspector Query → DTO → Vue pattern |
| 8 — Zone Editing | The concrete commands that mutate a Zone's geometry and emit `ZoneGeometryChanged`; `withEditorStateRefresh`, the post-command decorator that re-queries the Inspector — this slice adds figures to that panel and no refresh mechanism of its own |
| 9 — Quantity & Cost Engine | `Money`, `Quantity`, `MeasurementUnit`/`UnitKind`/`UNIT_KIND`, `DerivedValue<T>`, the Quantity Engine pipeline, the Cost Pipeline |

This slice does not introduce a new SDD ADR; it applies ADR-006 (plain
TypeScript domain), ADR-007 (command-based mutations), ADR-008 (event-aware
architecture), ADR-009 (world coordinates in mm), and ADR-010 (decimal money)
to two new entities.

### Carried forward from the slice 8 review pass (2026-08-25)

A code review of merged slice 8 changed the event and undo machinery this
slice subscribes to. Read these before writing the cascade.

- **`ZoneGeometryChanged` now fans out CONCURRENTLY, and on BOTH halves of a
  recalibration.** `ReversibleCalibratePlanCommand` used to `await` one publish per
  rescaled object in a loop; it publishes them through `Promise.all` now, and `undo()`
  announces the same set `execute()` did. So a recalibration of an N-zone plan invokes
  `onZoneGeometryChanged` N times concurrently, twice over. The handler above writes a
  stale marker per Requirement before recalculating — those writes go through the
  repository's per-entity queue, which serializes them, but nothing serializes the
  HANDLERS. Anything the cascade accumulates outside a repository (a counter, a batch, a
  notification tally) has to be written for concurrent entry.
- **Publishing a zone event now also re-hydrates every Plan Editor leaf showing that
  plan.** `ZoneCreated`, `ZoneGeometryChanged` and `ZoneDeleted` are in
  `planChangeSource`'s `PLAN_CHANGE_EVENTS` list. That is what fixed a second leaf drawing
  stale geometry; it also means an event this slice publishes carries a vault-read cost per
  open leaf, which matters most for exactly the cascade above.
- **The zone event stream is ASYMMETRIC over undo/redo, and this slice is the first
  subscriber that can decide what to do about it.** `create -> undo -> redo -> undo` emits
  one `ZoneCreated` and TWO `ZoneDeleted`: the redo restores through
  `ZoneRepository.save` and publishes nothing, because the sibling delete adapter argues
  at length that a restore is not a creation. Any handler that COUNTS or MIRRORS the
  lifecycle drifts permanently, and after a redo believes a zone that exists does not.
  The review pass deliberately left this unresolved rather than settle an event contract
  silently — `reversible-create-zone-command.ts`'s header states it where the code is.
  Whatever this slice needs, decide it explicitly and change both adapters together.
- **`WriteLedger`'s rule is "every write records, every delete FORGETS".** A deleted note
  has no revision to remember, and a stale entry outliving the note it described gets
  presented as an expectation by whatever touches that id next — which is precisely the
  cascade-aware delete this slice adds. `WriteLedger.forget(id)` exists for it.
- **`restoreZone` is the ONE `'absent'` restore**, shared by both reversible adapters.
  This slice's widening — the snapshot growing into "the Zone plus everything the delete
  touched", and `undo()` becoming a compensated multi-write sequence — changes that
  precondition in one place instead of two. The two copies it replaced had already drifted
  on whether they refreshed their own snapshot afterwards.
- **`SelectTool.SpatialObjectCandidate` is the Assets extension point** it was written to
  be, and `spatialObjects()` is materialised ONCE per gesture now rather than twice, so
  widening the candidate set costs one traversal per click, not two.

### Waiting for this slice, from slice 15 (2026-08-26)

Slice 15's dialog framework is built and mounted in both view roots. `DeleteReferenceDialog`
and `EntityPickerDialog` exist, are unit-tested, and have **no production caller** — because
their caller is this slice's Inspector delete flow, and the queries it reads
(`ListRequirementsReferencing`, `ListReassignmentTargets`) and the command input it carries
(`resolution`, `resolvedReferents`, and a `reference.set-changed` refusal) are this slice's to
define. Slice 15 deliberately did not declare those shapes: a second derivation of contracts
this slice owns is what its own "Out of scope" section forbids.

Slice 15's Definition of Done items 6, 8 and 8a — including the stale-count, consented-set
and bounded-retry tests, written out in full in that document's Testing Strategy — are the
closing task here. Open `dialogStore.openDialog({ kind: 'delete-reference', … })` from the
Inspector's Delete action; **do not build a second dialog.** What to know before doing it:

- `openDialog` THROWS if a dialog is already open — sequential, never stacked. The Reassign
  branch works because the store clears `current` before the awaiting caller resumes, so
  opening the picker the instant the first promise resolves is correct and nesting is not.
- The result type is derived from the descriptor's `kind`. Switch on `result.action` for
  `delete-reference`; a bare `'cancel'` string is what the other kinds resolve, and reading
  `.action` off one yields `undefined`.
- Every user-facing string is resolved by the CALLER through `t()` before the descriptor is
  built — `entityLabel` and every `ReferenceRow.label` included. Nothing under
  `presentation/dialogs/` resolves a key on its own behalf, and lint does not catch a literal
  at those positions; it rests on review.
- The dialog renders the rows it is handed and recomputes nothing. The command's own re-check
  is what enforces reference integrity, because a script or a migration never opens a dialog.
- `presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/` or the
  event bus — an ESLint block with a meta-test. The query call belongs on this slice's side of
  the seam, not inside the dialog.

## Design

### Asset

A catalog item, independent of any Zone or Plan. Properties (PRD §8 "Asset",
Epic 6):

```typescript
type AssetCategory =
  | "material" | "furniture" | "fixture"
  | "plant" | "equipment" | "building-element" | "custom";

interface Asset {
  readonly id: AssetId;            // "asset-01JDEF..." — SDD §82
  // No projectId. The catalogue is shared across every project (§59, amended
  // 2026-08-26); Requirement below keeps its own, because a USE belongs to the
  // project that made it even when the definition does not.
  name: string;
  category: AssetCategory;
  supplier?: string;               // free text this slice; Supplier entity is Epic 11
  sku?: string;
  unit: MeasurementUnit;           // slice 9's concrete symbol type; its UnitKind
                                    //   (slice 9's UNIT_KIND map) is SDD §48's dimension
  unitCost: Money;                 // ADR-010
  wasteFactorDefault: Decimal;     // fraction in [0, 1], default 0 — see "Unit conversion" 
  notes?: string;
}
```

Module shape follows §78's pattern exactly:

```text
domain/asset/
├── Asset.ts
├── AssetId.ts
├── AssetCategory.ts
├── Asset.schema.ts
├── Asset.errors.ts
└── Asset.events.ts
```

Commands: `CreateAsset`, `UpdateAsset`, `DeleteAsset` (§29 names
`CreateAssetCommand` explicitly; Update/Delete follow Zone's established CRUD
symmetry). Events: `AssetCreated`, `AssetUpdated`, `AssetDeleted` — §34's
initial catalog names `AssetCreated` explicitly; `AssetUpdated`/`AssetDeleted`
extend it the same way Zone's catalog was extended with `ZoneDeleted` beyond
what any single list enumerates.

An Asset is never itself derived data — nothing about its own fields is
calculated from geometry. It is the input, not the output, of this slice's
pipeline.

### Requirement

The entity that turns "a Zone has this much area" and "this Asset costs this
much per unit" into "here is how much of it we need, and what it costs."
Properties (PRD §32 "Quantity & Requirement Domain"):

```typescript
type RequirementOrigin =
  | { kind: "zone"; zoneId: ZoneId };
  // future, later epics: { kind: "work-package"; workPackageId: WorkPackageId }
  //                       { kind: "asset"; assetId: AssetId }  — PRD §59

interface Requirement {
  readonly id: RequirementId;           // "requirement-01J..." — extends SDD §82's scheme
  readonly projectId: ProjectId;
  readonly assetId: AssetId;            // "required asset"
  readonly origin: RequirementOrigin;   // "source geometry" — a reference, not a copy (§3.6)
  unit: MeasurementUnit;                // copied from Asset.unit at creation
  wasteFactor: Decimal;                 // fraction in [0, 1], defaulted from Asset.wasteFactorDefault, editable per-requirement
  quantity: DerivedValue<Quantity>;     // "calculated quantity" + "manual override"
  estimatedCost: DerivedValue<Money>;
  recalculationStatus: "current" | "stale"; // persisted — see "Event cascade" below
                                        // No version field on the entity: a Requirement
                                        // travels as Loaded<Requirement>, like every
                                        // other entity, and `revision` persists in the
                                        // frontmatter for the mapper to lift into that
                                        // version. Slice 3 says why the two are not the
                                        // same place. Not a schema version either way.
  requiredDate?: string;                // ISO date, optional — schema completeness only, unused by this slice's loop
}
```

`origin` is a reference (`ZoneId`), not a copy of the polygon, per SDD §3.6
("Derived Data over Duplicate Data" — values that can be reliably recalculated
should not be duplicated unless required for overrides or snapshots). The
Zone's geometry stays the single source of truth for area; the Requirement
only caches the *output* of running that geometry through the engine, and only
because `DerivedValue<T>` needs a `calculated` side to persist so overrides
have something to fall back to, and so a plain-Markdown reader (SDD §92 #7)
can see the last known figures without the plugin running.

`wasteFactor` lives on the Requirement, not only on the Asset, because the
same tile can need 10% waste in a simple rectangular room and 15% in an
irregular one — PRD §32 lists it as a Requirement property distinct from the
Asset's own default. `AssignAsset` seeds it from `Asset.wasteFactorDefault`;
after that it is a plain editable field, not itself a `DerivedValue`.

Module shape:

```text
domain/requirement/
├── Requirement.ts
├── RequirementId.ts
├── RequirementOrigin.ts
├── Requirement.schema.ts
├── Requirement.errors.ts
└── Requirement.events.ts
```

### The derivation pipeline

This slice maps SDD §50's Quantity Engine pipeline onto real data, for the
**area** requirement rule only (Increment 7's stated scope):

```text
Zone.geometry (Polygon)              ← slice 8
        ↓ area(zone.geometry)        ← slice 2 (a Result; an isErr here is a
                                        CalculationError on the Requirement, not a crash)
Measured Quantity (mm² → Asset.unit) ← slice 9 unit conversion
        ↓ Requirement Rule = area (identity, area-kind Assets only)
Required Quantity
        ↓ applyWaste(required, Requirement.wasteFactor × 100)   ← slice 9
        ↓ applyPackaging(wasted, undefined)                     ← slice 9, no-op
Purchase Quantity  ==  Requirement.quantity.calculated
```

The packaging stage is present but supplied `undefined`, so it passes the quantity
through unchanged. It is shown rather than omitted because slice 9's pipeline has five
stages and this slice runs all five — silently dropping one would make "Purchase
Quantity" mean something different here than it does there. A real lot size arrives with
a material catalog (Epic 11), not with this slice.

**The area rule is dimensionally valid only for an area-kind Asset.** A Zone's polygon
area is an area; treating it as an identity input for a length (`m`) or volume (`m3`)
Asset would silently divide/multiply nothing and just relabel an area figure — a real
quantity would need the Zone's perimeter (for `m`) or area × a height/depth this slice
has no input for (for `m3`), neither of which this slice derives. `AssignAssetCommand`
therefore rejects the assignment with a `ValidationError`.

The check is on the **dimension**, not the symbol — `UNIT_KIND[asset.unit] !== 'area'`,
using slice 9's map, rather than `asset.unit !== 'm2'`. Today those are the same test,
because `m2` is the only area unit; a hard-coded `'m2'` would silently start rejecting
valid assignments the day `ft2` is added, and would do it by returning a plausible
validation error rather than failing loudly. The picker (`ListAssets`, below) still
lists every project Asset unfiltered; the command is what enforces the rule.

**There is no same-project check between a Zone and an Asset, and its absence is the
point.** An earlier version of this slice refused `zone.projectId !== asset.projectId`
as a `ValidationError`, on the reasoning that such a Requirement would leak one
project's unit costs into another's estimates and could never be surfaced by
`ListAssets(projectId)`. §59 as amended (2026-08-26) removes both halves: an [[Asset]]
belongs to no project, so there is no second `projectId` to compare, and the picker
lists the whole shared library rather than one project's slice of it. Pairing any Zone
with any Asset is now **correct**, not a leak — that is what sharing a catalogue means.

What survives is the half that was never about projects: the `UNIT_KIND` area check. A
Zone's area is not an identity input for a `piece` or `hour` Asset, and that is as true
of a shared catalogue as of a per-project one.

The Requirement still resolves to exactly one project — the Zone's. Nothing about
sharing the definition shares its *use*
([[Work belongs to one project, catalogues belong to the vault]]).

**Sharing did create one new way for a pairing to be wrong, and it is about money rather
than ownership.** A [[Project]] denominates every [[Money]] value in it in its own
currency (§72), and two projects may legitimately disagree; the shared definition they
both reference holds one price. So an Asset priced in EUR can now be assigned to a Zone
in a GBP project, which it could not be while catalogues were project-scoped.

**That is caught at recalculation, not at assignment, and deliberately on the seam that
already exists.** [[A mismatched unit or currency is an error, not a coercion]] is
enforced by the cost pipeline, so `RecalculateRequirement` fails for that pair and the
Requirement stays `recalculationStatus: "stale"` — never cleared, surfaced by the
Inspector, and explicitly not allowed to block its siblings (see the cascade's error
branch, which already says *one Asset's bad currency/unit must not block the others*).
`AssignAssetCommand` keeps loading exactly two entities. Checking at assign time would
mean reading the Project as well, for feedback the recalculation path already gives, and
a project's currency is a setting the user may change afterwards — which would put the
check on the wrong side of the fact it depends on.

**What turns that stale Requirement into a usable one is a per-project price override,
and this slice does not define one.** [[Asset library]]'s definition of done requires it —
a project records its own price beside the shared default rather than replacing it
(§89) — and neither the schema nor the UI path for it is here. Until it is, an Asset
priced in another project's currency can be assigned but not costed. That is a **named
gap, not an oversight**: stated so the slice adding the override knows what it unblocks,
and so nobody reads the accepting behaviour above as meaning every pairing yields a
number.

The UI cannot be the guard for what remains, either. A picker that offers only area-kind
Assets makes a bad pairing *unreachable through the Inspector*, which is exactly the
kind of "it can't happen from the UI" reasoning that leaves a script, a migration, or a
later epic's caller free to do it. The command owns the invariant, per §3.3's
Domain-First rule that a handler is not a trusted caller.

This paragraph used to make that argument about the project check, which was the
stronger case for it and is now gone. It is kept, repointed at the `UNIT_KIND` check,
because the reasoning was never about *which* invariant — a rule enforced only where the
UI happens to call it is not enforced.

**Unit conversion at this boundary, not a shared convention.** `Requirement.wasteFactor`
is a fraction in `[0, 1]` (`0.10` meaning "10% waste") because that is the natural range
for the Inspector to validate and edit. Slice 9's `applyWaste(required, wastePercent)`
takes whole percentage points (`10`, not `0.10`) and computes `1 + wastePercent / 100` —
its own worked example is `wastePercent = 10 → ×1.10`. Passing `Requirement.wasteFactor`
straight through unconverted would compute `1 + 0.10/100 = 1.001`, silently
understating every quantity and cost by roughly two orders of magnitude. This slice's
`AssignAsset`/`RecalculateRequirement` handlers are the one place that conversion
(`wasteFactor × 100`) happens; nowhere else needs to know the two layers use different
scales.

The range is closed at `1`, not half-open: 100% waste (buy twice what you measure) is a
real answer for an awkward cut pattern, and there is no reason the domain should reject
it. Anything above `1` is rejected as far likelier to be a percentage entered where a
fraction was expected.

and SDD §51's Cost Pipeline, with discount/shipping/tax as no-op stages this
slice does not populate:

```text
Requirement.quantity effective (override ?? calculated)
        ↓ × Asset.unitCost
Estimated Cost  ==  Requirement.estimatedCost.calculated
```

Piece/hour/day/fixed/`m`/`m3`-unit assets structurally pass through the same engine
(slice 9 already supports all seven units) but have no geometry-derived
Requirement Rule wired in this slice: piece/hour/day/fixed would need a manual
quantity (future work), and `m`/`m3` would need a perimeter or a height/depth input
this slice's `Zone` does not carry (also future work) — `AssignAssetCommand` rejects
all six of them for now, not just piece/hour/day/fixed, since accepting an `m`/`m3`
Asset without a real derivation rule would be exactly the silent-mislabeling bug
this rule exists to prevent.

### Event cascade

Slice 8's geometry-mutating gestures — body drag, vertex drag — both resolve to slice
3's `MoveSpatialObjectCommand`, which emits `ZoneGeometryChanged` after a successful
save (§34). (§29 also names a `ResizeSpatialObjectCommand`; slices 3 and 8 collapse
resize into the same whole-geometry replacement, so no such command exists here.) This
slice adds one application-layer event handler that reacts to that event:

```typescript
// application/event-handlers/requirement/onZoneGeometryChanged.ts
eventBus.subscribe("ZoneGeometryChanged", async (event: ZoneGeometryChanged) => {
  // listByZone returns Result<Loaded<Requirement>[], PersistenceError>, like every
  // port method in this codebase (README shared vocabulary). A failed LIST is not a
  // failed recalculation of nothing — it is "we do not know which Requirements this
  // affects", so nothing may be marked stale and nothing may be reported as current.
  // There is no Requirement to hang a durable marker on either, which is what makes
  // this the one branch in the cascade that has to be loud without one.
  const listed = await requirementRepository.listByZone(event.zoneId);
  if (isErr(listed)) {
    logger.error('requirement.list-by-zone.failed', { zoneId: event.zoneId, cause: listed.error });
    notifyCascadeAborted(event.zoneId);   // slice 13 toast, per slice 17
    return;
  }

  for (const requirement of listed.value) {
    // Persist the stale marker BEFORE attempting recalculation — this is the
    // durable fact "this Requirement's numbers are no longer trustworthy,"
    // and it must survive a recalculation failure, not just a successful one.
    const staleResult = await requirementRepository.markStale(requirement.id);
    if (isErr(staleResult)) {
      // Do not proceed to recalculate — that could leave outdated values under a
      // status still read as "current" by whatever last successfully saved it.
      // This branch is NOT silent: the durable marker is what justifies staying
      // quiet about a background failure (slice 17), and it is exactly what did
      // not land, so this one is surfaced as well as logged. The reading itself
      // is kept honest without this write by the input snapshot below, which the
      // read model compares — a marker that could not be written is not the only
      // thing standing between the user and an obsolete number.
      logger.error('requirement.stale-marker.failed', {
        requirementId: requirement.id,
        cause: staleResult.error,
      });
      notifyStaleMarkerFailed(requirement.id);   // slice 13 toast, per slice 17
      continue;
    }
    await eventBus.publish(requirementInvalidated({ requirementId: requirement.id }));

    const result = await recalculateRequirement.execute({ requirementId: requirement.id });
    if (isErr(result)) {
      // Do not silently continue as if this Requirement is current. Log via
      // Slice 11's Error Boundary and move on to the next Requirement in this
      // Zone — one Asset's bad currency/unit must not block the others from
      // recalculating. `recalculationStatus` stays "stale" (never cleared),
      // so the Inspector (Slice 6) surfaces it and a later manual retry or
      // reconciliation pass can pick it up; no event fires for this failure
      // since `RequirementRecalculated` would misrepresent what happened.
      logger.error('requirement.recalculation.failed', {
        requirementId: requirement.id,
        cause: result.error,
      });
      continue;
    }
    // On success, RecalculateRequirementCommand clears the stale marker as
    // part of the same save that persists the new quantity (§42-style single
    // logical write), then publishes RequirementRecalculated itself.
  }
});
```

**The `for` loop above is the shape, not the schedule.** Read as written it is 2N
sequential awaited vault writes — `markStale` then a recalculation save, per Requirement,
one after another — inside the dispatch of the gesture that moved the Zone. At the scale
this plugin is for that is the difference between a drag that ends and a drag that
appears to hang: eighty Requirements is a hundred and sixty round-trips to disk, done
strictly one at a time.

Nothing requires that. Each Requirement's pair is **independent of every other's**: the
lock hierarchy below gives an ordinary Requirement write a level-2 lock on that
Requirement and nothing else, so two pairs cannot contend, cannot deadlock, and cannot
observe each other. The writes are IO-bound, so the win is real rather than theoretical.
So the cascade runs the pairs with **bounded concurrency** — a small fixed limit, not an
unbounded fan-out, because the shared resource being saturated is the user's disk and the
Obsidian adapter in front of it, and five hundred simultaneous writes is a worse answer
than sequential rather than a better one.

Three properties the concurrent form must keep, each of which the sequential form gets by
accident and which are therefore the things to assert:

- **Per-Requirement failure isolation, unchanged.** A failed `markStale` skips its own
  recalculation and nothing else's; a failed recalculation leaves its own Requirement
  stale and nothing else's. Neither aborts the cascade. This is already the sequential
  behaviour — both branches `continue` — so concurrency does not change the semantics, it
  changes only how long they take.
- **`markStale` still precedes its own recalculation.** The ordering that matters is
  *within* a pair, never *between* pairs. Nothing in the design ever depended on
  Requirement A being marked before Requirement B.
- **Undo ordering is not affected**, and this is the part worth checking rather than
  assuming, because the cascade is awaited inside the dispatch. Slice 4 warns that a
  command finishing a one-Requirement cascade can resolve before an earlier command still
  recalculating twenty, so `CommandHistory.run()` would push in resolution order — but
  slice 4 also states the fix, and it is not here: slice 6 serializes `CommandHistory`'s
  own operations per Plan. Making this cascade faster changes *how much* the two
  durations differ and not *whether* they can, so it neither creates that hazard nor
  relies on having removed it.

`Requirement.recalculationStatus: "current" | "stale"` is a persisted field, not
a derived one — it is precisely the flag that must survive a failed recalculation
so the Inspector never presents a stale value as current. It is set to `"stale"`
synchronously (see above) before recalculation is attempted, and only cleared back
to `"current"` by `RecalculateRequirementCommand`'s own successful save. A crashed
or failed recalculation therefore always leaves a Requirement visibly `"stale"`,
never silently `"current"` with outdated numbers.

**The marker cannot be the only thing holding that guarantee, because the marker is a
write.** `markStale()` fails in exactly the circumstances where the numbers most need
questioning, and a design that answers "the flag makes stale values impossible" with a
flag that could not be written is answering with the thing that broke. The same hole is
open on a crash between the geometry write and the marker write, which no error path
covers at all. So the Requirement also persists **what it was calculated from** — the
two inputs that live outside it:

```text
calculatedFrom: { zoneArea: Quantity; unitCost: Money; assetUnit: MeasurementUnit }
```

All three are written by `RecalculateRequirementCommand` in the same save as the figures
they produced, so they are always written when writes are working, never when they are
not. The read model compares them against the Zone and Asset it has already loaded, and
reports `"stale"` on any mismatch regardless of the persisted flag.

`assetUnit` is in that record because the Asset's unit is an input to the figures in the
strongest sense available — it fixes their *dimension*, not merely their magnitude. Area
and unit cost can both be byte-identical across a unit change (a `45.00 EUR` Asset
switched from `m2` to `m` keeps its price, and the Zone's area does not move), so a
two-field snapshot compares equal and reports `"current"` over a quantity that is no
longer dimensionally meaningful — the one reading this backstop exists to make
impossible. It is deliberately not inferred from `Requirement.unit`: that field tracks
the Requirement's *current* Asset (reassign rewrites it), so comparing it against the
Asset would compare a value to a copy of itself and agree in exactly the case that
matters.

*Considered and declined: recompute-and-compare on the outputs instead of snapshotting
the inputs.* Recomputing the pipeline at read time and comparing against the stored
figures needs no new persisted fields, and it catches strictly more — including a figure
someone hand-edited in the note, which an input snapshot cannot see because the inputs
still match. Declined for three reasons that hold together rather than separately. It
puts the cost engine on the **read path**, so every Requirement row rendered costs a
pipeline run, and the read model is what the Inspector builds on every selection. It
cannot distinguish "stale" from "overridden" without knowing the override rules too, so
the comparison would have to reimplement the branch it is checking. And a snapshot is
human-readable **provenance** in the note itself — `calculated-from-area: "12.0"` tells a
person opening the file in a plain editor what the number came from, which is §3.2's whole
premise and something a recomputation leaves nowhere. The hand-edited-figure case is
therefore genuinely uncovered, and it is uncovered on purpose: a user who edits
`cost-calculated` by hand has edited the plugin's own cache of its own arithmetic, and the
plugin's answer is to overwrite it on the next recalculation rather than to police it.

The direction of that backstop is the whole of its contract, and it is deliberately
one-way: it can move a reading from `"current"` to `"stale"`, never the reverse. A
persisted `"stale"` stays stale even if the inputs happen to match again, because the
marker means "a recalculation was owed and is not known to have completed" — which
matching inputs do not disprove. So this adds no second authority over what
`recalculationStatus` means; it removes the case where the first one is silently absent.

Comparison happens on the persisted, already-rounded values — the read side recomputes
the area through the same pipeline step and rounding rule that produced the stored one
(slice 9), rather than comparing a raw geometric area against a rounded record. A
comparison at a finer precision than the pipeline itself uses would report drift the
pipeline could not have produced, and every Requirement would read as permanently stale.

**A second subscriber, on `AssetUpdated`, is required for the same reason.** A
Requirement's cost is a function of the Zone's geometry *and* the Asset's `unitCost` and
`wasteFactorDefault`; the cascade above covers only the first input. Without the second,
editing a catalog price leaves every linked Requirement holding its old persisted
`estimatedCost.calculated` while still marked `"current"` — a stale number presented as
current, which is precisely what `recalculationStatus` exists to make impossible. The
handler is the same shape, over `listByAsset` (already on the repository) instead of
`listByZone`:

```typescript
// application/event-handlers/requirement/onAssetUpdated.ts
// Identical markStale-then-recalculate sequence, including the abort-on-failed-marker
// rule above — the only difference is which repository lookup finds the affected
// Requirements. It is a separate file rather than a shared one because the two events
// carry different payloads; the sequence itself is small enough that sharing it would
// cost more indirection than it saves.
eventBus.subscribe("AssetUpdated", async (event: AssetUpdated) => {
  const listed = await requirementRepository.listByAsset(event.assetId);
  if (isErr(listed)) {
    logger.error('requirement.list-by-asset.failed', { assetId: event.assetId, cause: listed.error });
    notifyCascadeAborted(event.assetId);
    return;
  }
  /* for (const requirement of listed.value) — markStale → RequirementInvalidated →
     recalculate, exactly as above, including the abort-on-failed-marker rule */
});
```

`UpdateAssetCommand` publishes `AssetUpdated` on every successful save, including edits
that cannot change a cost (a `name` or `notes` change) — deciding at the *publisher*
whether an edit matters would put field knowledge in a second place, and it would go
wrong silently the first time the pipeline started reading one more field.

**The handler still does not rewrite a Requirement it does not have to**, and the check
costs no new coupling, which is what makes this worth doing rather than pricing as
acceptable. Unconditional cascade means `markStale` plus a recalculation save per linked
Requirement — two writes each — so renaming an Asset that eighty Requirements reference
is a hundred and sixty vault writes and a visible freeze, for a change to a string
nothing computes with. So, per Requirement, before `markStale`:

```typescript
// The Requirement's own record of what its figures were computed FROM. If the
// updated Asset still matches it, the figures are still correct by construction —
// there is nothing to mark stale and nothing to recalculate.
if (unchangedAgainst(requirement.calculatedFrom, event.asset)) continue;
```

The objection this would normally attract — "now a second place knows which Asset fields
the pipeline reads" — does not apply, because `calculatedFrom` is not a second place. It
is the **first and only** declaration of exactly those inputs, it already exists, it is
already written by `RecalculateRequirementCommand` in the same save as the figures, and
the read model already compares against it to catch a `markStale` that never landed. A
pipeline that started reading one more Asset field would have to add it to
`calculatedFrom` or the read-model backstop would silently stop working — so the
forcing function is already there and already load-bearing. Comparing against it here
reuses that, rather than duplicating it.

What this deliberately does not do is skip the *lookup*. `listByAsset` still runs, and
every linked Requirement is still examined. The saving is in the writes, which is where
the cost is; an eighty-Requirement rename becomes eighty comparisons and zero writes.

**One Asset edit is refused rather than cascaded: a unit change that leaves the `area`
kind while Requirements still reference it.** `AssignAssetCommand` rejects a non-area
Asset outright, so a `m2 → m` edit on a referenced Asset would manufacture, by update,
precisely the link the assignment path refuses to create — an invariant enforced where
things are made and abandoned where they are changed, which is the same shape as the
two rules already corrected above. Recalculating cannot rescue it either: there is no
correct quantity to recalculate *to*, because a Zone's area is not a length. So
`UpdateAssetCommand` acquires that Asset's reference lock (below), then asks
`listByAsset`, and if any Requirement references the Asset and
`UNIT_KIND[next] !== UNIT_KIND[current]`, it returns a `ValidationError` naming the
referencing count and writes nothing. Changes *within* a kind stay allowed and cascade
normally, as does any unit change on an Asset nothing references yet.

**The lock is held from before `listByAsset` through the save, not just around the
check.** Otherwise this is a check-and-write with a gap in it: an update observing zero
referents can be overtaken by an `AssignAssetCommand` that creates one, and the save
then lands a non-area unit under a live Requirement — the very state the guard exists
to refuse, reached by getting the timing right rather than by bypassing anything. It is
the same shape as the delete sequence's window below, and it needs the same answer,
because a guard that only *usually* holds is not an invariant.

That guard and `calculatedFrom.assetUnit` are not redundant: the guard is the invariant
and stops the state being reachable through the command, while the snapshot is the
backstop for the paths a command cannot police — a migration, a hand-edited note, or a
future area unit where the kind matches and the magnitude does not. Slice 11's Data
Safety rules put the authority in the domain and the detection in the read model; this
is that split, applied to one field.

`RecalculateRequirementCommand` (named in SDD §29) re-fetches the current Zone
and Asset, re-runs the pipeline above, saves the Requirement (quantity, cost, and
`recalculationStatus: "current"` together, one write), and publishes
`RequirementRecalculated`. A second handler runs the Cost Pipeline off the
freshly recalculated quantity and publishes `CostEstimateChanged`:

```text
ZoneGeometryChanged
     ↓ (this slice's handler)
RequirementInvalidated
     ↓
RecalculateRequirementCommand → RequirementRecalculated
     ↓ (this slice's handler)
Cost Pipeline → CostEstimateChanged
```

This is the exact chain SDD §32 illustrates. A note on reconciling it with
§34's "initial catalog": §34 does not separately list `RequirementInvalidated`
or `CostEstimateChanged`; it lists a generic `CostChanged`. §34 is explicitly
an *initial* catalog, and §32's own worked example already names these two
events — this slice treats `RequirementInvalidated` as the concrete transient
notification the chain needs, and `CostEstimateChanged` as the
Requirement-scoped specialization of `CostChanged` for the one cost type
(Estimated) this slice produces. Later epics that add Quoted/Committed/Actual
costs can add their own `*Changed` events under the same pattern without
revisiting this one.

**And they get a shared payload shape to add them under, reserved here rather than
discovered later.** An open family of `*Changed` events with nothing in common is fine
for a publisher and wrong for the subscriber this family is obviously heading toward: a
budget rollup wants "any cost on this Project moved", and against four unrelated event
types that is four subscriptions plus four payload readers, which is four places to
forget the fifth cost type. So every member of the family carries the same three fields:

```typescript
// The common half of every cost event. Not a base CLASS — a domain event is data
// (README shared vocabulary), so this is a payload shape the concrete events spread.
interface CostChangePayload {
  readonly costType: 'estimated';        // widened by the epic that adds Quoted/etc.
  readonly scope: { kind: 'requirement'; id: RequirementId };  // widened likewise
  readonly currency: CurrencyCode;
}
```

`CostEstimateChanged`'s payload is that plus its own `previous`/`current` `Money`. This
slice adds no rollup subscriber and no generic `CostChanged` event — there is one cost
type, so a generic event today would have exactly one publisher and one member, which is
the abstraction the SDD's §34/§32 split is already unclear enough about. What is bought
now is only that the fields a rollup needs in order to *discriminate* exist from the
first event, so adding the second cost type is a widened union rather than a migration of
the first one's payload.

`costType` is also where a resolved PRD contradiction lands. The PRD gives two
disagreeing Forecast formulas over these types (PRD §28 against PRD §33), settled in
[`docs/entities/Cost item.md`](../entities/Cost%20item.md): `committed` means *not yet
invoiced*. A rollup subscriber that summed a `committed` event carrying the full commitment
would double-count anything already invoiced — which is exactly the discrimination this
field exists to make possible, and the reason to name the decision here rather than leaving
the next reader to re-derive it.

Because the Event Bus is in-process and promise-aware (§33), the whole cascade
runs to completion, synchronously awaited, inside the same command dispatch
that changed the Zone's geometry, and every `publish()` in it is itself
awaited — including `RequirementInvalidated` — so a subscriber doing
asynchronous work (a UI update, a log write) is guaranteed to finish before
`RecalculateRequirementCommand` starts, keeping the promised event order
deterministic and testable.

`RequirementInvalidated` is a transient *notification* (useful for a UI
"recalculating…" affordance) — but `Requirement.recalculationStatus` is not
transient: it is exactly the persisted fact that survives the notification,
in case recalculation itself fails. The two are deliberately different
things: without a persisted marker, a failed recalculation would leave a
Requirement showing an old quantity/cost with nothing distinguishing it from
a correctly current one — the bug this design specifically closes.

### Override semantics

`Requirement.quantity` and `Requirement.estimatedCost` are independently
overridable — a user might know the real cut quantity differs from the area
calculation, or might have negotiated a price the pipeline can't model, without
the two being coupled:

- `SetRequirementQuantityOverrideCommand` sets/clears `quantity.override`.
  Setting or clearing it re-runs the Cost Pipeline against the new *effective*
  quantity (so `estimatedCost.calculated` stays correct even while a cost
  override may currently be hiding it), and publishes `CostEstimateChanged`
  only if the *effective* cost actually changed.
- `SetRequirementCostOverrideCommand` sets/clears `estimatedCost.override`
  directly and publishes `CostEstimateChanged` immediately — no geometry or
  quantity involved, so `RequirementInvalidated`/`RequirementRecalculated` do
  not fire for this path.

Both commands are the SDD §52 concept applied twice: `effective = override ??
calculated`, and "the UI must distinguish calculated from overridden values"
for each field independently.

### Undo/redo interaction

Per §31 (Transaction Boundary), one user intent is one logical transaction and
one undo-history entry — that entry belongs to the Zone-geometry command
(slice 8), not to the Requirement. This slice does not add a separate undo
entry for cascaded recalculation: because the cascade is a pure function of
current Zone geometry and Asset data, undoing the geometry-editing command
restores the prior geometry and — by re-emitting `ZoneGeometryChanged` through
the same handler on `undo()` — deterministically re-derives the prior
Requirement values as a side effect. Overrides are unaffected by an unrelated
Zone's undo/redo, since they live on the Requirement and are only touched by
their own commands. Those commands do get their own entries: setting or
clearing an override is a user intent like any other, dispatched through the
adapters below, so it is one entry and it is reversible — §31 says one intent
is one entry, not that only geometry earns one.

### Inspector integration

The Inspector already resolves `Selection → Inspector Query → Inspector DTO →
Vue UI` (§59). This slice adds a Requirements panel to a Zone's inspector view,
backed by one new query and reusing the asset catalog:

```typescript
function GetRequirementsForZone(zoneId: ZoneId): Promise<Result<RequirementInspectorDTO[], PersistenceError>>;
function ListAssets(): Promise<Result<Asset[], PersistenceError>>; // the "assign asset" picker — the whole shared library (§59)

// Used by slice 15's delete-confirmation flow. The Inspector needs the referents
// before offering Delete, and §58/§59 route that through a query, never a repository
// handle the presentation layer holds. It returns IDs rather than a count because the
// caller owes the command the exact set the user consented to, not just how many there
// were (see "A resolution consents to a specific set of referents"); the dialog's row
// renders `.length`.
//
// GROUPED BY PROJECT, because an Asset is shared across every project (§59, amended
// 2026-08-26) and a bare total would read as "in the project I am looking at". A Zone
// target always yields exactly one group — a Zone belongs to one Plan, which belongs to
// one Project — so the shape costs that case nothing and tells the truth about the other.
// The exact-set property is unchanged: the union of the groups IS the set the user
// consented to.
function ListRequirementsReferencing(
  target: { kind: 'zone'; zoneId: ZoneId } | { kind: 'asset'; assetId: AssetId },
): Promise<Result<readonly ReferencingProject[], PersistenceError>>;

interface ReferencingProject {
  projectId: ProjectId;
  // The dialog shows a name; resolving it here keeps the presentation layer from
  // holding a repository to look one up, which is the same §58/§59 rule as above.
  projectName: string;
  requirementIds: readonly RequirementId[];
}

interface RequirementInspectorDTO {
  requirementId: RequirementId;
  assetId: AssetId;
  // null when the Asset this Requirement references no longer exists — the state
  // `delete-anyway` deliberately creates. Typed `string` it could not be built at
  // all, so the query would have to fail or drop the row, and the stale warning
  // this DTO exists to carry would be unreachable for exactly the Requirements
  // that most need it. The row renders from assetId plus missingTarget instead.
  assetName: string | null;
  // Which end of the reference is gone. Only the Asset end is representable here, and
  // deliberately so: every query that builds this DTO is scoped to a Zone, so a
  // Requirement whose Zone is gone never reaches a row at all. A 'zone' member would be
  // a value no query can produce and no component can be tested against — the union
  // gains it in the same edit as the project-level surface that can (see Out of scope).
  missingTarget: 'asset' | null;
  unit: MeasurementUnit;
  wasteFactor: Decimal;
  quantity: { calculated: Quantity; override: Quantity | null; effective: Quantity };
  cost: { calculated: Money; override: Money | null; effective: Money };
  // The whole point of persisting recalculationStatus is that the Inspector can warn
  // when a figure is no longer trustworthy. This DTO is the only thing backing the
  // Requirements panel, so omitting the field here would make the persisted marker
  // unreachable by the surface designed to render it — the marker would survive a
  // reload and then be invisible, which is indistinguishable from not having it.
  // Reported "stale" when the persisted marker says so, when calculatedFrom does not
  // match the loaded Zone and Asset, or when missingTarget is set — the query never
  // reports "current" for a figure it cannot re-derive.
  recalculationStatus: 'current' | 'stale';
}
```

For the selected Zone, the panel lists one row per Requirement: Asset name,
effective quantity (with a visible "overridden" badge and the calculated
figure still shown when `override !== null`), and effective cost (same
treatment). A missing target renders from `assetId` with the reason shown rather than a
name (see `delete-anyway` above). An "Assign Asset" control dispatches
`ReversibleAssignAssetCommand`; a quantity field and a cost field, each with a "reset to
calculated" affordance, dispatch `ReversibleSetRequirementQuantityOverrideCommand` and
`ReversibleSetRequirementCostOverrideCommand`. Both fields are editable because §52 makes
the two independently overridable and this panel is the only surface either has — a
`SetRequirementQuantityOverrideCommand` that no control dispatches would be a command
with no caller, which is the same defect as a query with no reader. Edits become commands,
per §59 — the Inspector never writes to a Requirement directly.

**Every edit from this panel goes through an adapter, without exception.** Slice 6's
Inspector commit path is `CommandHistory.run()`, which accepts an `UndoableCommand` and
nothing else, so a plain `Command` cannot be dispatched from here at all — a control wired
to one either bypasses command history or cannot be wired. That applies to the overrides
exactly as it does to assignment: a negotiated price a user typed in is an edit like any
other, and PRD §68's list is examples ("ChangePropertyCommand" among them), not an
enumeration that excludes what it does not name.

`ReversibleSetRequirementQuantityOverrideCommand` and
`ReversibleSetRequirementCostOverrideCommand` are the same shape over their two plain
commands, and what each captures is **the whole Requirement as it was before the edit**,
restored through the repository on undo — the same snapshot-and-restore the delete
resolutions already use, not a saved copy of the one field being set.

Capturing only the field would be the obvious version and it is wrong for the quantity
adapter specifically: `SetRequirementQuantityOverrideCommand` re-runs the Cost Pipeline
against the new *effective* quantity, so an override edit writes `estimatedCost.calculated`
as well as the field it is named after. An undo that put back only `quantity.override`
would leave a calculated cost derived from a quantity that no longer exists — a figure
nothing in the pipeline could have produced, and one no badge would flag, since
`calculatedFrom` records the Zone area and unit price rather than the override. Restoring
the entity puts both back at once and makes the pair a true inverse, which is what slice 8
requires of every `execute()`/`undo()`.

**Restoring the whole entity is right for consistency and wrong for concurrency unless
undo checks first.** A command history is view-local (slice 6: one per open Plan
Editor), and the reference lock deliberately does not cover ordinary Requirement writes,
so another tab can edit the same Requirement between this command's `execute()` and its
`undo()` — setting a cost override, or having a recalculation land on it. Writing the
pre-edit snapshot back wholesale would erase that work silently, and the wider the
snapshot the more it erases: the very breadth that makes the undo a true inverse of
*this* command is what makes it a clobber of everyone else's.

So undo is conditional on the entity still being what this command left — and the check
and the write have to be **one operation**, not a comparison followed by a save. This is
slice 3's contract, and a `Requirement` takes it unchanged rather than growing a parallel
one: a persisted `revision`, an `observed` token minted per read, and a save that
compares both inside the write:

```typescript
// application/ports — the only shape that makes "check, then restore" safe
save(requirement: Requirement, expected: Expected):
  Promise<Result<Loaded<Requirement>, PersistenceError | ValidationError>>;
  // 'requirement.revision-conflict' when the stored revision is not expected.revision;
  // 'requirement.external-modification' when the revision matches but the bytes moved,
  // i.e. somebody hand-edited the note. The repository serializes per RequirementId,
  // so its own read-compare-write cannot be interleaved.
```

Undo passes the version its own `execute()` produced. Equal means nothing else has
touched the Requirement and the restore lands; different means a later edit exists that
the snapshot does not know about, and the save refuses — undo returns the conflict, the
command stays on `undoStack` (slice 6's stack-retention rule), nothing is lost, and the
user is told their undo is out of date rather than having it silently take someone
else's edit with it.

**The first version of this check read, compared, and then wrote as three steps**, which
narrows the window rather than closing it: ordinary Requirement writes deliberately share
no lock, so another tab can save between the comparison and the restore, and the restore
then clobbers exactly the edit the comparison was there to protect. That is the same
lesson the delete sequence records a few sections down — a race between two commands is
not removable by re-reading inside one of them — arrived at a second time, from the
other side. Comparison has to happen where the write happens.

That also overrides the earlier preference for comparing whole entities rather than a
version. Comparing the entity answers a slightly better question, but it cannot be made
atomic without doing it inside the write. What the write can compare cheaply is a
version — and slice 3's is two values rather than one precisely because the counter
alone answers too narrow a question, missing every writer that is not this plugin. A
better question asked non-atomically loses to a narrower one asked atomically; the fix
is to widen the atomic question, not to go back outside the write.

Every writer passes an expected version, not only undo: a caller that fetched a
Requirement, computed from it, and saves without one is issuing a blind last-write-wins,
which is the same lost update from a different direction. And every snapshot-restoring
undo in this slice takes this path — the delete resolutions' `affectedBefore` restore
included, since it has strictly more entities to clobber, each with its own version.

**Every conditional write, not only `save`.** `delete` takes an `expected` too: an
assignment undo removes the Requirement its `execute()` created, and a CAS on `save`
does nothing to stop that delete taking a later override or recalculation with it. And
any command that hands work to an undo owes that undo the revisions **it** produced —
see `affectedAfter` on the delete resolutions' payload — because pre-state revisions are
already stale by the time the command returns, having been superseded by the command's
own writes. An undo left to discover the current revision by reading is back to
check-then-act.

Why this is a `Requirement` concern and not a general one, stated so the scope is a
decision rather than an oversight: the geometry-bearing undos are already covered by a
different mechanism. Slice 8's zone-move undo writes through `PlanGeometryStore.mutate`,
which is a read-modify-write under that plan's own lock (slice 4), so it cannot lose an
update; and its zone-*delete* undo restores an entity that, being deleted, nobody could
have edited in the meantime. `Requirement`s are plain Markdown notes with neither
protection — no per-plan mutate lock, and very much still present while being undone —
which is exactly why they need their own. `markStale` needs no revision either: it sets
one field in one direction, and the design already forbids anything moving it back
except a successful recalculation.

The snapshot is taken on the first `execute()` only; redo re-applies the recorded new value
rather than re-reading what undo just wrote — the same rule the assignment adapter follows,
for the same reason. And `null` is a value in it, not an absence: "reset to calculated" *is*
`override = null`, so undoing a reset restores the number the user had typed, and undoing a
first-ever override restores `null` rather than leaving the new figure in place. An adapter
that read a captured `null` as "there was nothing here" would make the reset affordance the
one edit in this panel that cannot be taken back.

Neither override touches `calculated` or `calculatedFrom`, so neither marks the
Requirement stale: an override is a user's answer sitting beside a derived figure, not a
claim about the derivation. `CostEstimateChanged` still fires, because the effective cost
did change.

**Assignment's adapter carries something the override adapters do not** — PRD §68 names
`AssignAssetCommand` undoable, and the funnel above already forces the wrapper, but what
it has to remember is not a previous value.
`ReversibleAssignAssetCommand` needs one fact the Requirement alone does not carry:
whether this call created it or found an existing one. `AssignAssetCommand` is
idempotent by design, so both outcomes return a Requirement, and an `undo()` that
deleted unconditionally would destroy a link — with whatever overrides had been set on
it — that the user's gesture never created. Undo deletes only what execute created, and
is a no-op otherwise.

### Who knows whether a Requirement was created

That fact is **returned by the command**, as `AssignAssetResult.created`. The adapter
cannot derive it, and an adapter that tried — by reading the repository before
dispatching, say — would be wrong precisely when it matters. Two Plan Editor tabs
assigning the same Asset to the same Zone both look first, both see nothing, and then
the reference lock serializes their wrapped commands: the first creates the Requirement,
the second's idempotent path finds it and returns it. Both adapters concluded "I created
this" from a read taken before either write, so the second tab's undo deletes the first
tab's assignment — a link the user of that tab made deliberately, gone because someone
else pressed undo in another view.

Only the command can answer, because only the command holds both endpoint locks at the
instant it decides, and the answer is true exactly for the window in which it was
decided. This is the same rule the reference lock exists to enforce, applied to a
*return value* rather than a write: a fact established under a lock has to be reported
out of the locked region, not re-derived outside it, or the lock protected the decision
and not the conclusion drawn from it.

Redo restores that Requirement under its original ID rather than re-running assignment,
for the reason slice 8 spells out for creation: `CommandHistory.redo()` calls `execute()`
again, and a fresh identity would strand every later command that captured the old one.
This adapter and slice 8's `ReversibleCreateZoneCommand` are the same shape over
different plain commands.

**Preserving the ID is not the same as skipping the checks, and redo must still run
them.** The gap between an undo and its redo is ordinary editing time, and the undo
itself is what opens it: with the Requirement gone, the Asset is unreferenced, so the
unit guard above — which only refuses while referents exist — correctly permits changing
it from `m2` to `m`. A redo that re-saved the snapshot blindly would then recreate a
Requirement whose quantity is an area against an Asset measured in length, through
nothing but assign → undo → edit → redo, with no step in that sequence doing anything
wrong. Deleting either endpoint in the same window has the same shape and produces a
dangling reference instead.

So redo re-acquires both endpoint locks and re-runs `AssignAssetCommand`'s checks — both
endpoints resolve and the Asset is still area-kind — against the
current world, and carries over only the ID. It can therefore fail, which is correct and
already handled: slice 6's `redo()` inspects the resolved `Result` and leaves the command
on `redoStack` when it errors, so a refused redo neither half-applies nor vanishes from
the history. Nothing about "the user already did this once" makes a link valid against
entities that have since changed underneath it.

### Deletion & reference integrity

Deleting a Zone or an Asset that a Requirement still references must not silently
cascade-delete the Requirement (PRD §63–64). The check happens in **two places, for two
different reasons**, and keeping them apart is what makes the flow work:

- **Before the dialog**, the Inspector asks `ListRequirementsReferencing` (the query
  above) so slice 15's `DeleteReferenceDialog` can show the user what they are about to
  affect. This is a read for display. It goes through a query, never a repository handle
  held by presentation code — §58/§59, and slice 6's Inspector rule. The caller keeps
  the IDs, not just the count, because it owes them back to the command as the record
  of what was consented to.
- **Inside the command**, `DeleteZoneCommand` (slice 3, extended here) and
  `DeleteAssetCommand` (this slice) re-check and refuse a bare delete that would orphan
  referents, returning a `ReferenceError` naming them. This is the enforcement, and it
  has to be in the command because a script, a migration, or a future caller that never
  opened a dialog must not be able to walk past it (§87 rule 5, slice 11). The re-check
  is also what catches the set *moving* between the two reads — the display read is
  advisory and stale by construction, so the command compares what it finds against
  `resolvedReferents` rather than trusting either count.

The dialog's resolution reaches the command as data, which means a command input has to
carry it. **This slice is what adds those fields**, because this slice introduces the first
entity that can reference a Zone — exactly the deferral slice 8 makes ("deferred to
whichever of those slices introduces the first entity that can reference a Zone"). Slice
3's `DeleteZoneInput` is widened by **three** optional fields, and `DeleteAssetInput` is
declared with all three from the start:

```typescript
type ReferenceResolution = 'remove-references' | 'reassign' | 'delete-anyway';

// application/commands/zone/DeleteZone.ts — slice 3's file and slice 3's interface.
// Its existing members are NOT restated here: `zoneId`, and `expected?: EntityVersion`,
// which is load-bearing (slice 8's undo-a-creation supplies it so the delete refuses if
// the Zone changed after it was created). An earlier draft of this block did restate
// the interface and dropped `expected` in the process, silently un-specifying that
// undo — which is why what follows is the diff and not a copy.
//
// Added to DeleteZoneInput by this slice, all optional, so every existing caller still
// compiles and a caller that omits them gets the safe behaviour — refuse if referents
// exist:
//
//   resolution?: ReferenceResolution
//   reassignTo?: ZoneId               required when resolution is 'reassign'; see below
//   resolvedReferents?: readonly RequirementId[]
//                                     the exact referents the user was shown when they
//                                     chose `resolution`; required whenever
//                                     `resolution` is present. See "A resolution
//                                     consents to a specific set".

interface DeleteAssetInput {
  assetId: AssetId;
  resolution?: ReferenceResolution;
  reassignTo?: AssetId;
  resolvedReferents?: readonly RequirementId[];
}
```

**A resolution consents to a specific set of referents, not to a number.** The dialog
counts, the user decides, and only then does the command look the referents up for
itself — so the set it acts on is the set at dispatch time, which is not necessarily
the set that was on screen. Another view adding a Requirement inside that window is
enough: `remove-references` would then delete a Requirement the user was never shown
and never consented to losing, and the count they approved would not even have been
wrong. Slice 15's flow already guards the opposite drift (referents that vanished
before dispatch, which it re-counts and reports); this is the same race in the
direction that destroys data instead of merely confusing.

So a `resolution` is only honoured together with `resolvedReferents`, the referent IDs
as displayed. The command re-reads the live set and compares:

```text
resolution present, resolvedReferents absent  → ValidationError (a caller that
                                                 resolved without showing anything)
live set === resolvedReferents (as a set)     → proceed
live set !== resolvedReferents                → ReferenceError, code
                                                 'reference.set-changed', naming the
                                                 live count. Nothing is written.
```

The mismatch is a refusal, not a re-prompt the command issues: the command has no
dialog to open (slice 15 owns that, and this layer may not reach it). Slice 15's caller
re-counts and re-asks, exactly as it already does for the vanished-referent case, so
the user re-consents to the set that actually exists. Order matters — this check runs
before any write, in step 0 of the compensated sequence below, so a stale resolution
costs nothing to reject.

Comparison is set equality, not list or count equality: an added and a removed referent
in the same window would leave the count untouched while changing what is deleted, and
that is the case a count-based check reads as unchanged.

What each resolution means to the command, so the dialog's four buttons are four real
outcomes rather than three synonyms for "delete":

| Resolution | Command behaviour |
| --- | --- |
| *(absent)* | Refuse with a `ReferenceError` naming the referents, if any exist. This is the path a script or a migration takes. |
| `remove-references` | Delete the referencing Requirements, then the entity — one logical operation. |
| `reassign` | Validate `reassignTo`, then for every referencing Requirement: repoint its `origin`/`assetId`, mark it `"stale"`, recalculate it, and only then delete the entity. A `reassignTo` that is missing, self-referencing, resolves to nothing, or (for a **Zone**) belongs to a different Project than the Zone being deleted, or (for an **Asset**) is not of `area` kind, is a `ValidationError` and nothing is written. The project clause is Zone-only: a shared Asset has no project to differ about (§59). |
| `delete-anyway` | Delete the entity and leave the Requirements, marking each `recalculationStatus: "stale"` — they now reference something gone, which the Requirements panel shows wherever it still has a row to show it on (see below). |

**`reassign` changes a Requirement's inputs, so it owes the same cascade a geometry edit
does.** Repointing `origin` at another Zone or `assetId` at another Asset replaces exactly
the two values every figure on that Requirement was derived from — the source area and the
unit price. There are three ways those inputs can change: the Zone's polygon moves
(`ZoneGeometryChanged`), the Asset's price is edited (`AssetUpdated`), and the reference
itself is repointed. The first two mark the Requirement stale and recalculate it; the third
did neither, which left one of the three paths quietly exempt from the invariant the other
two exist to hold.

The read model does not save it, though it softens the symptom and the distinction is
worth being exact about: `calculatedFrom` records the `zoneArea`, `unitCost` and
`assetUnit` a figure was produced from, so a panel loading a reassigned Requirement
compares them against its *new* target, finds a mismatch, and reports `"stale"` — one
of the two guarantees already holds. The other two do not. The persisted marker still reads `"current"`, which is the
state the round that added `recalculationStatus` set out to make impossible, and — the
part no backstop covers — **nothing ever recalculates it**: no geometry changed and no
Asset was edited, so neither subscriber fires, and the Requirement keeps the old Zone's
area and the old Asset's price until something unrelated happens to touch one of them. A
reassign onto a target with a coincidentally identical area even matches `calculatedFrom`
and reads `"current"` while being right by accident.

So the resolution does per Requirement what the other two input changes already do, in the
order the failed-marker rule fixed: repoint and `markStale` first, persisted together, then
recalculate. Recalculation runs **inline**, inside the command, the same way
`AssignAssetCommand` triggers it — which is what lets slice 8's post-command refresh find
finished numbers rather than racing a cascade, and what keeps the whole reassignment one
undoable unit. A failed recalculation does not fail the delete: the marker is already
persisted, so the Requirement stays visibly `"stale"` and the failure is logged — slice
17's background-cascade case, reached the same way it always is. A failed repoint or a
failed `markStale` is a different matter and does fail it, compensating from
`affectedBefore` like any other write in the sequence, because those two are what the stale
guarantee rests on.

Undo needs nothing new for this. `affectedBefore` holds each Requirement's full
pre-resolution state — old reference, old figures, old `calculatedFrom`, old marker — so
restoring it puts back numbers that were correct for the old target rather than
recalculating toward it.

**`delete-anyway` owes the Requirements it strands a way to be seen, and this slice can
pay only half of that.** PRD §64 requires the action, so retaining them is not optional —
but "leave them marked stale" is only a
real answer if the marked Requirement can still be reached and read, and by default
neither holds. A Requirement whose Asset is gone cannot fill `assetName: string`, so the
one query backing the Requirements panel could not build its row at all; a Requirement
whose Zone is gone is not reachable from that panel in the first place, because the panel
is scoped to a selected Zone and there is no longer one to select. The warning would be
persisted, correct, and invisible — the same defect as not marking it, arrived at from
the read side.

**The Asset-side half is fixed here; the Zone-side half is not, and saying so is the
point.** `RequirementInspectorDTO` represents a missing Asset explicitly (`assetName:
string | null` plus `missingTarget`, below), so a Requirement whose Asset is gone renders
as a row that says what is wrong instead of failing to be built. Slice 17's table routes
it as a persisted badge rather than a toast, because it is a state the user chose and
must later resolve, not an event that just happened.

A Requirement whose **Zone** is gone gets no such row, because there is no panel to put
it on: every read surface in this map is scoped to a selection or a Plan, and its
selection no longer exists. A query alone would not change that: a
`ListOrphanedRequirements(projectId)` declared here would have no caller anywhere in the
map — a dead export `npm run analyze` fails on rather than a way for a user to find
anything. The surface that would consume it is project-scoped content that slice 14 and
the slice map both defer as feature work, so the query arrives with it, per this
repository's rule that a thing arrives with its first real use.

What the MVP does deliver for that state, stated as narrowly as it is true:

- The Requirement note stays in `Requirements/`, with `recalculation-status: stale` and
  its now-dangling `origin-zone` ID intact. Per ADR-0001 the note *is* the record, so it is
  findable through Obsidian's own search and graph — not through a plugin surface, but
  not lost either, and not silently rewritten.
- `onAssetUpdated` still reaches it (it is found by `listByAsset`, not by Zone), fails to
  re-derive against the missing Zone, and leaves it `"stale"` — slice 17's `ReferenceError`
  case (b). Detection, in PRD §63's sense, happens; presentation is what is missing.
- Nothing in this slice deletes it, repoints it, or drops it from a query it belongs to.

**Two other ways out were considered and refused, recorded here so neither is re-proposed
as the fix.** *Refusing `delete-anyway` on a Zone until a surface exists* trades an invisible
outcome for a missing one: PRD §64 names the action as one of the four resolutions, so
withholding it is the larger defect. *Routing the orphans into slice 11's
`DiagnosticsSnapshot`* stays available as a detection aid but is not the answer: the snapshot
is content-free by SDD §68 — IDs only, no names, no costs — so a user reading it could see
that something dangles without learning what it was or what it cost. That is a bug-report
artifact, not a recovery surface.

The gap is therefore stated rather than closed with a query nothing calls, and it closes with
the first surface that lists Requirements across a Project — the Renovation Project view's
populated content, or a Bases view over `Requirements/` (SDD §13, deferred).
`ListOrphanedRequirements`, or whatever query that surface needs, arrives in the same change
as the surface.

**A resolution mutates several entities, so it needs compensation and a snapshot.**
Every non-absent resolution is N Requirement writes followed by one entity delete, and
naming that "one logical operation" does not make it one. Any write in the middle can
fail, and the partial states are all bad in the same specific way: `remove-references`
can permanently delete some Requirements while the Zone survives; `reassign` can split
referents between the old target and the new; `delete-anyway` can mark some stale and
not others. Worse, the command returns an error, so `CommandHistory.run()` records no
undo entry for a mutation that did partly happen — the same failure this slice's sibling
already fixed for the note-plus-sidecar case, reappearing one level up because the blast
radius grew.

The resolution therefore runs as a compensated sequence, the same shape slice 4 uses
inside a repository:

```text
0. Acquire the reference locks (see below) and hold them through step 3: the entity
   being deleted, and — when the resolution is `reassign` — the reassignment target as
   well, taken as one sorted acquisition. Both IDs are known from the input, which is
   what lets the set be taken at once rather than one lock at a time. Then validate the
   resolution's own input (`reassignTo` resolves, is not the entity being deleted, for a
   Zone shares the deleted Zone's `projectId`, and for an Asset is of `area` kind) — before any
   write, so a rejected reassignment has nothing to compensate. Validating *after*
   acquiring is deliberate: `reassignTo` resolving is a fact about an entity another tab
   could be deleting, and a check made outside the lock is one the lock does not keep
   true.
1. Under the level-1 locks, read every referencing Requirement in full →
   `affectedBefore` snapshot, then acquire the level-2 lock on each as one sorted batch
   and hold them through step 4. Reading first and locking second is safe here and only
   here: the level-1 lock already prevents the *set* from changing, so what step 2 is
   protecting against is a concurrent edit to a member of a set that can no longer grow.
   Compare its
   IDs against `resolvedReferents` as a set; on any difference, return
   `reference.set-changed` and stop here — still before any write, so a resolution
   consented to against a set that has since moved costs nothing to refuse. This
   reuses the read step 4 needs anyway rather than adding a second lookup.
2. Apply the resolution to each in turn, recording which have been written. For
   `reassign` that is more than one write per Requirement — repoint + markStale, then a
   recalculation whose failure is logged and left stale rather than aborting the
   sequence — and the snapshot covers all of them, since it is the whole entity as it
   was before any of this ran.
3. Delete the entity.
4. On any failure in 2 or 3: restore every Requirement already written, from
   `affectedBefore`, presenting the version step 2 recorded for each — so the rollback
   is as conditional as the write it undoes. Then return the error. A failing
   compensation is logged through the `Logger` (slice 1's port, slice 11's rules) rather
   than swallowed, AND left recorded in the sequence marker below for recovery at next
   load, because a log entry is not a recovery: the repository cannot promise multi-file
   atomicity and does not pretend to.
5. On success, return `affectedBefore` in the command's payload. It is not
   bookkeeping: it is what makes the delete undoable (see below).
```

**The set check and the delete need one lock between them, not just correct ordering.**
Step 1's comparison establishes what references exist at step 1; the entity does not go
away until step 3. In that window another Plan Editor tab can dispatch
`AssignAssetCommand` and create a Requirement that is in neither `affectedBefore` nor
the resolution's writes — so `remove-references` deletes the ones it knew about, step 3
deletes the entity, and the new Requirement is left pointing at something gone. The
`resolvedReferents` check does not catch it: that comparison already passed, correctly,
before the Requirement existed.

Re-checking again just before step 3 would only narrow the window, not close it — the
race is between two commands, so no amount of re-reading inside one of them removes it.
So reference creation and entity deletion are serialized per entity, the same shape
slice 4 uses for sidecar writes per `planId` ("queued rather than rejected", so
unrelated entities never contend):

```text
ReferenceLock — application-layer, keyed by EntityId, in two levels:
  level 1  a ZoneId or an AssetId — who may create a reference, or delete a referent
  level 2  a RequirementId — who may write that Requirement
Levels are always taken 1 then 2, each as one sorted batch. See the hierarchy below.

Any ordinary Requirement write (recalculation, override edit, markStale)
  → holds that Requirement's level-2 lock for its own write, and nothing else.
    One lock, no level-1 lock ever, so such a writer cannot be in a wait cycle

DeleteZoneCommand / DeleteAssetCommand
  → hold the level-1 lock on the entity being deleted, from step 0 through the
    compensation in step 4, PLUS the level-1 lock on
    the reassignment target when the resolution is `reassign` — repointing a
    Requirement at that target creates a reference to it, so a target deleted
    concurrently leaves the same dangling reference the delete is resolving away

AssignAssetCommand (and reassign, which also creates references)
  → hold the lock on BOTH endpoints it links — the Zone and the Asset — for the
    duration of the create, since either one being deleted concurrently is the
    same hazard

UpdateAssetCommand, when the edit changes the Asset's unit
  → hold the lock on that Asset from before listByAsset through the save, so the
    "no referents, therefore this unit change is safe" conclusion cannot be
    falsified by a concurrent assignment before the write lands

ReversibleAssignAssetCommand.execute() on redo
  → holds both endpoint locks, exactly as a first assignment does; a redo creates
    a reference like any other create (see below)
```

The lock is a mutual-exclusion set over *everything that can make the reference graph
disagree with an invariant someone is about to rely on*: creating a reference, deleting
a referenced entity, and changing a referenced entity's unit. It is not a general
Requirement mutex — see the scoping note at the end of this section.

**Several of those acquirers take more than one lock, so the order is fixed and each
level's set is taken at once.** (Level 1 is what this section is about; the level-2
Requirement locks and why they exist are below.) `AssignAssetCommand` holds the Zone's and the Asset's; a delete whose
resolution is `reassign` holds the deleted entity's *and* the reassignment target's,
because repointing a Requirement at that target creates a reference to it — the same
hazard, from the other side, that makes assignment take both. Nothing about "hold both"
says in which order, and unordered acquisition is a deadlock: one tab reassigning Z1's
requirements to Z2 while another reassigns Z2's to Z1 can each take its own source and
then wait forever on the other's. Neither tab is doing anything wrong; the mechanism is.

```text
Acquiring more than one ReferenceLock:

  take the whole set in ONE acquisition, sorted ascending by the EntityId's
  string value — ULIDs, so the order is total, stable, and computable by every
  caller without coordination

  never acquire a lock while already holding one outside that set
```

A total order over the resources plus one acquisition point is the standard cure, and
both halves are load-bearing. Sorting alone is not enough if a command can take a first
lock, learn something, and then take a second — that is the same wait-for cycle with more
steps. So every acquirer must know its full set before it takes anything, and each does:
`AssignAssetCommand` has both endpoints in its input, and a delete's reassignment target
arrives in `DeleteZoneInput.resolution`, before step 0. A resolution that named a target
the command discovered mid-sequence would break this rule, which is a reason not to add
one rather than a limitation to work around.

`UpdateAssetCommand` and a plain (non-reassigning) delete take a single level-1 lock and
are unaffected — an ordering rule over one element is just that element.

The rule holds against slice 4's queues for the same reason it holds here: they are
acquired in a fixed order too (a `ReferenceLock` first, then slice 4's per-entity and
per-plan queues inside the writes it guards), never the reverse. A repository write that
reached back for a `ReferenceLock` would close the cycle across layers — and **lint does
not catch that one**: `infrastructure/` may import from `application/`, because that is
how it reaches the ports it implements (`eslint.config.mjs` bans only `presentation` and
`plugin` there). The layer rule buys the direction of the port dependency, not the
absence of this cycle. What holds it is the convention stated here plus review: a
repository takes no lock it did not declare, and `ReferenceLock` is not among them.

Held from step 0 rather than only around step 3, so the set the user consented to is the
set that is still true when the entity goes — and through step 4, so the compensation is
covered by the same exclusion the writes it undoes were. It is released before undo can run:
`undo()` is a separate dispatch that re-acquires, so a held lock never outlives the
command that took it.

This is deliberately a lock over *reference creation*, not over Requirement writes in
general. A recalculation, an override edit, or a `markStale` on an existing Requirement
cannot turn a correct reference set into a stale one — only creating a new reference
can — so serializing those too would cost contention for no invariant.

**Why not one general write mutex instead of two levels**, since that is the obvious
simplification and a mutex scoped narrowly to reference-graph mutations demonstrably does
*not* work — it fails to cover the compensation case in the next section, so the honest
alternative is a mutex over every Requirement write:

- Contention "at human editing rates" is the weak version of the argument, and it is
  worth not leaning on: a human types slowly, but this plugin's writes are not
  human-paced. The cascade above deliberately runs its per-Requirement pairs
  concurrently, and a general write mutex would put every one of them back in a single
  queue *and* put the user's next Inspector edit behind all of them. The two decisions
  are one decision: a wider mutex is only simpler if the cascade stays sequential, and
  the cascade being sequential is the freeze this slice is already fixing.
- It would also make the two-level structure necessary anyway rather than removing it.
  The delete sequence must hold exclusion over an entity *and* over a set of
  Requirements discovered under that exclusion; one mutex covering both is one lock held
  across a read, a decision, N writes and a compensation — which is the general mutex in
  name and a global stop-the-world in behaviour.

What the wider mutex would genuinely buy is that nobody has to check a new command
against a hierarchy rule. That cost is real and is paid by stating the rule as a rule:
**a level-2 holder never reaches back for a level-1 lock**, and every new sequence is
checked against it. Reconsider if a second rule ever has to be added to keep the
hierarchy sound — one rule is cheaper than a mutex, two probably are not.

### The compensation needs its own exclusion, and its own recovery

That scoping note is about the *reference* invariant, and it does not carry to the
compensation. Once step 2 has rewritten Requirement R1, another tab is free to edit R1 —
an override, a recalculation, nothing reference-related — and then step 3 fails. The
rollback presents the version step 2 wrote, R1 has moved past it, and the restore
refuses. The command returns an error having applied part of its resolution, with no undo
entry, and the sequence's own promise — a failure leaves the Vault as it was — is false.
Logging it does not make it true.

Two mechanisms, because they answer different failures:

**A per-Requirement lock over the touched set.** The resolution holds a lock on each
Requirement in `affectedBefore` from step 2 through the compensation, and every ordinary
Requirement writer takes that Requirement's lock for the duration of its own write. This
is not the general mutex refused above: contention is per Requirement, so a recalculation
on an unrelated one never waits.

This does **not** fit the single-acquisition rule stated above, and pretending it does
would be worse than saying so. That rule requires every acquirer to know its full set
before taking anything, and this one cannot: which Requirements are touched is the answer
to a read that is only trustworthy once the entity is already locked. Locking the set
requires knowing it; knowing it requires the lock. So the rule is refined rather than
satisfied — into a **two-level hierarchy**:

```text
level 1 — entity locks     (the deleted entity, any reassignment target)
level 2 — Requirement locks (every entity in affectedBefore)

each level acquired as ONE sorted batch, ascending by EntityId
levels always in that order, never the reverse, never interleaved
```

Two levels, each internally sorted, acquired in a fixed order is deadlock-free by the
same resource-ordering argument as before — the wait-for graph still cannot cycle, since
no holder of a level-2 lock ever waits for a level-1 lock, and within a level everyone
takes the same sorted batch. The single-acquisition rule was the one-level case of this;
it stays exactly right for `AssignAssetCommand` and `UpdateAssetCommand`, which touch
level 1 only. An ordinary Requirement writer touches level 2 only, takes one lock, and so
can never be in a cycle at all.

What the hierarchy forbids is the thing that would break it: a level-2 holder reaching
back for a level-1 lock. Nothing in this design does — reference creation is decided
before any Requirement is locked — and it is the rule to check any new command against.

**A sequence marker, for the failure a lock cannot answer.** A lock keeps other writers
out; it does nothing about the compensating write failing on I/O, or the process exiting
mid-sequence — and a compensation that can itself fail needs an answer, not a log line.
So the sequence records a durable marker, on the reasoning no rollback can answer:
no rollback survives a process exit.

So step 0 acquires level 1, step 1 reads under it and then acquires level 2, and step 2
onward runs holding both.

### Compensated multi-entity sequences

The delete resolution is not the only sequence of this shape, and writing its discipline
into its own section is what let the mirror image ship without any of it: slice 8's
`ReversibleDeleteZoneCommand.undo()` is the *same* sequence run backwards — N+1 writes,
across N+1 files, with a compensation — and it had endpoint locks and nothing else. So
the rules are stated here once, as a contract every such sequence takes, rather than
per sequence:

1. **Both lock levels, per the hierarchy above.** Level 1 for the entity and any other
   endpoint whose existence or unit the sequence relies on; level 2 for every Requirement
   it will write. Endpoint locks alone do not exclude ordinary Requirement writers, so a
   sequence holding only those can have its own compensation refused by a concurrent
   override edit — which is precisely the failure this section was added to close on the
   forward path.
2. **Locks held through the compensation**, not released at the last forward write. A
   rollback racing the writer who acquired the locks next undoes that writer's work
   rather than its own.
3. **A durable marker, written before the first mutation and carrying everything a cold
   process would need**, since the process that would have rolled back is exactly the one
   that is gone:

```typescript
type SequenceMarker = {
  kind: 'delete-resolution' | 'delete-undo';
  entityId: ZoneId | AssetId;
  // The deleted entity in full, plus the version it was deleted at. A first draft
  // recorded only the ID, which cannot recover the case it was written for: once step 3
  // has deleted the entity, "roll back" means putting it back, and an ID is not a Zone.
  // Recovery restores it with 'absent'.
  entitySnapshot: Loaded<Zone> | Loaded<Asset>;
  entityDeleted: boolean;              // did step 3 complete?
  affectedBefore: readonly Loaded<Requirement>[];
  // Appended after each completed write, so recovery can tell which writes landed
  // rather than inferring it.
  //
  // This is the SAME ARRAY the command returns as `affectedAfter`, not a second one
  // with the same shape. An earlier draft had two — one durable, one in-memory — and
  // proposed a test asserting they agreed, which is the tell: a test policing two
  // records of one fact is cheaper to delete than to keep, and it only fails after the
  // divergence has already shipped somewhere the test does not look. The sequence has
  // exactly one writer of "what this sequence did" (itself, appending after each write),
  // and on success it hands that array to its own result. Their LIFETIMES differ — the
  // marker is cleared, the payload travels on to undo — but a lifetime is a property of
  // the holder, not a reason for a second copy.
  progress: readonly SequenceProgress[];
};

type SequenceProgress =
  | { id: RequirementId; outcome: 'written'; version: EntityVersion }
  | { id: RequirementId; outcome: 'deleted' };   // remove-references: expect absence
```

**Where the marker lives, and what happens to it across versions.** It is plugin-local
operational state, not project data, so it lives in **the plugin's own data, and
deliberately not `data.json`'s settings object** — `settingsFrom` drops any key this version does not declare (slice 1's trust
boundary), which would silently discard an outstanding recovery, and a marker is not a
preference a user should find in their settings file. It carries its own
`schemaVersion`, like every other persisted shape in this plugin (§44).

Its migration story is the one shape in the codebase that is allowed to be short, and
saying why is the point: **a marker that a newer version cannot read is discarded, not
migrated.** Two reasons, and both have to hold. It is short-lived by construction — it
exists only between the first mutation of one interrupted sequence and that sequence's
completion or recovery — so the window in which an upgrade can find one at all is the
window in which the plugin was closed mid-delete and then updated. And attempting to
recover from a marker whose shape this version does not understand is worse than
discarding it: recovery *writes*, so a misread `progress` entry restores the wrong
content over a Requirement. Discarding it leaves the vault in the partially-resolved
state the marker described, which is exactly the state slice 11's diagnostics are for —
so the discard is surfaced as a diagnostic naming the entity, never dropped silently.

4. **Recovery is conditional, and has a third outcome.** At load, a marker means a
   sequence was interrupted. For each entry in `progress`, restore that Requirement from
   `affectedBefore`, presenting the version `progress` recorded — and if
   `entityDeleted`, restore the entity from `entitySnapshot` with `'absent'`. Where a
   conditional restore refuses, recovery does **not** force it: the crash may have been
   followed by a sync landing someone else's change, and unconditionally overwriting it
   would be the lost update this whole design exists to prevent. It surfaces a
   diagnostic instead (slice 11), because a crash plus an external change is genuinely
   ambiguous and the user is the one who can resolve it. The marker clears when every
   entry is either restored or surfaced.

Recovery is also idempotent, because it has to be: a crash can land between a Requirement
write and the `progress` append, so an entry may be missing for a write that happened, and
an entry may be present for one that did not. Restoring from `affectedBefore` is
idempotent in both directions — a Requirement already at its before-state is written back
to the same content — so neither gap corrupts anything; the versions in `progress` are
what make the *conditional* part meaningful, not what make the restore correct.

This is deliberately not a transaction log, and it does not try to be. It carries exactly
what a cold start needs to undo one interrupted sequence, and it is written by the two
sequences that have this shape rather than by every write.

Step 5 is the half that is easy to miss. Restoring the entity alone does not undo a
resolution — a Zone brought back with its Requirements still deleted, or still repointed
at another Asset, is not the state the user had before pressing Delete, and slice 8
requires every `execute()`/`undo()` pair to be a true inverse. So the snapshot the
command already had to take for step 4 is handed onward for undo to use, and
`ReversibleDeleteZoneCommand` restores the entity *and* every entity in `affectedBefore`.

That restore is N+1 writes, so it is compensated the same way this sequence is — slice 8
defines its ordering (the entity first, the exact reverse of the order here) and its
compensation (each entity's current state read before it is overwritten, and replayed if
a later write fails). Undo is where a partial failure is easiest to miss, because the
command returns an error and stays on `undoStack` as if nothing had happened.

```typescript
type DeleteWithReferencesResult = {
  deletedId: ZoneId | AssetId;
  // Full pre-resolution state, for undo to restore. Loaded<> rather than bare entities:
  // the versions these were READ at are not the versions undo presents (see below), but
  // dropping them here would make the payload the one place an entity travels without
  // its version, and a shape that is nearly uniform is where the exception hides.
  affectedBefore: readonly Loaded<Requirement>[];
  // What THIS command left behind, per affected Requirement — the expectation undo must
  // present. Without it undo has only pre-resolution versions, which the resolution's
  // own writes already superseded: every restore would conflict against the command's
  // own effect, and re-reading to find the current one is the check-then-act this
  // design refuses everywhere else.
  //
  // This IS the sequence marker's `progress` array, handed on rather than rebuilt — one
  // writer, one record. See the marker's own declaration above.
  affectedAfter: readonly SequenceProgress[];
};
```

`affectedAfter` carries `'deleted'` rather than omitting the entry, because "this
Requirement is gone and I am the one who deleted it" and "I never touched it" are
different claims and undo needs to distinguish them: the first restores from
`affectedBefore`, the second touches nothing.

Restoring a `'deleted'` entry uses `save(requirement, 'absent')` — slice 3's absence
sentinel — so "there should be nothing here" is checked *inside* the write. A numeric
revision cannot express that (the entity has none; it does not exist), and reading for
absence and then inserting would reopen the window this payload exists to close: a
Requirement that reappeared under the same ID between the delete and the undo is
someone else's, and the insert must fail rather than overwrite it.

`reassignTo` is where PRD §64's own gap shows through: it names "Reassign" as an action
but never says how a target is picked. Slice 15's dialog resolves *that* the user chose
Reassign and carries no target, so a second step supplies one — and leaving that step
unowned would ship a fourth button with nothing behind it, exactly as the background
import did.

**This slice owns the candidate list; slice 15 owns the picking.** The split follows
the same line as the delete dialog itself: eligibility is a domain question, and a
dialog that computed it would be a second place the rules live.

```typescript
// application/queries — the eligible targets, already filtered by every rule the
// command would otherwise reject the choice for, so the picker cannot offer one that
// fails validation.
function ListReassignmentTargets(
  target: { kind: 'zone'; zoneId: ZoneId } | { kind: 'asset'; assetId: AssetId },
): Promise<Result<readonly ReassignmentTargetDto[], PersistenceError>>;
// Zone case:  every other Zone in the same Project.
// Asset case: every other area-kind Asset in the shared library — NOT filtered by
//             project, because an Asset belongs to none (§59, amended 2026-08-26).
// Both exclude the entity being deleted — the self-reference the command refuses.
interface ReassignmentTargetDto { id: ZoneId | AssetId; label: string }
```

The picker itself is slice 15's `EntityPickerDialog`: one more `DialogDescriptor` kind
taking `{ title, candidates: readonly { id: string; label: string }[] }` and resolving
to `{ id } | 'cancel'`. It renders what it is handed and knows nothing about Zones,
Assets or projects — the same contract `DeleteReferenceDialog` already has for its
reference rows.

An empty candidate list is a real outcome, not an edge case to ignore: a Project with
one Zone, or one area-kind Asset, has nothing to reassign to. The caller checks the
list before opening anything and reports that Reassign is unavailable rather than
opening a picker with no options — a dialog whose only possible action is Cancel is a
dead end presented as a choice.

Validation still runs in the command regardless of where the target came from, for the
reason below.

What the command does **not** delegate to that picker is validating what it is
handed. An Asset `reassignTo` goes through **both** of `AssignAssetCommand`'s checks —
the same `UNIT_KIND` area check — for the identical reason: a Zone's area is not an
identity input for a `piece` or `hour` Asset, and a rule enforced on one of the two
paths that can create the link is a rule a user reaches around by deleting an Asset
instead of assigning one. Both paths read the same `UNIT_KIND` map rather than each
comparing against a literal `'m2'`.

**The project check on `reassignTo` is now Zone-only, and that asymmetry is the point.**
It used to bind both kinds as `target.projectId === deleted.projectId`. For a **Zone**
it still does, unchanged and for its original reason: repointing a Requirement's
`origin` at a Zone in another Project leaves the Requirement holding the deleted Zone's
`projectId` while its origin names geometry another Project owns, so its area is
computed from a Zone that Project's own queries will never list it under.

For an **Asset** the check is gone, because neither operand exists: an Asset has no
`projectId` (§59, amended 2026-08-26), and reassigning Requirements from one shared
definition to another crosses no boundary. So the two halves have swapped which kind
they are conditional on — `UNIT_KIND` was always Asset-only, and the project check is
now Zone-only. Neither is "both kinds" any more, which is worth stating because the
previous version's whole point was that one of them was.

## Interfaces & Contracts

```typescript
// Imported from slice 9 — genuinely consumed, not restated. The names below are
// referenced so the signatures in this file read, but none of them is declared here:
//   MeasurementUnit, UnitKind, UNIT_KIND, Quantity, Money, DerivedValue<T>,
//   effectiveValue<T>
// (An earlier draft re-declared Money and a differently-named `effective()` under a
// "consumed, not redefined" comment. A second declaration is a second answer.)

// application/ports — every method Result-returning, reads included, exactly the port
// shape Slice 3 fixed and Slice 4 implemented without widening. These are real
// Obsidian-backed repositories: a read is a file read plus a Zod parse, so it can fail
// just as a write can. "Not found" is ok(null); isErr means the read did not happen.
// Conditional on the same terms as every other entity port — `Loaded<T>`, `Expected`
// and `EntityVersion` are slice 3's, unchanged. An earlier draft left Assets alone
// while generalising Project, Plan, Zone and Requirement, which is not a smaller
// version of the contract but a hole in it: two concurrent UpdateAssetCommands would
// silently lose one edit, and worse, an ordinary non-unit edit loaded before a
// concurrent DeleteAssetCommand would save afterwards and RESURRECT the Asset — with
// its Requirements already removed or reassigned by the delete's resolution, so the
// recreated Asset is one nothing points at and no dialog will ever mention again.
// The reference lock does not cover it: that lock serializes reference CREATION
// against deletion, and a plain field edit creates no reference.
interface AssetRepository {
  getById(id: AssetId): Promise<Result<Loaded<Asset> | null, PersistenceError>>;
  save(asset: Asset, expected: Expected): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>>;
  delete(id: AssetId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
  // No listByProject: an Asset belongs to no project (§59, amended 2026-08-26). The
  // catalogue is shared across every project and lives in the library folder, so the
  // only listing there is of the whole library.
  listAll(): Promise<Result<Loaded<Asset>[], PersistenceError>>;
}

interface RequirementRepository {
  getById(id: RequirementId): Promise<Result<Loaded<Requirement> | null, PersistenceError>>;
  // Compare-and-swap on slice 3's terms: the stored revision against
  // `expected.revision`, and the bytes against `expected.observed` — the token THIS
  // caller's read handed back, so a Requirement hand-edited between the read and the
  // write is caught even though a hand edit bumps no revision. Refuses with
  // 'requirement.revision-conflict' or 'requirement.external-modification', serialized
  // per RequirementId so the compare and the write are one operation. `'absent'` means
  // "insert, and fail if anything already holds this ID" — what makes restoring a
  // deleted Requirement atomic, since a version cannot express "there should be
  // nothing here" and reading for absence then inserting is the check-then-act this
  // contract exists to remove.
  save(requirement: Requirement, expected: Expected): Promise<Result<Loaded<Requirement>, PersistenceError | ValidationError>>;
  // Conditional for the same reason save() is, and it is NOT covered by save()'s CAS:
  // an assignment undo deletes the Requirement it created, and another tab may have
  // set an override or landed a recalculation on it since.
  delete(id: RequirementId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
  listByZone(zoneId: ZoneId): Promise<Result<Loaded<Requirement>[], PersistenceError>>;
  listByAsset(assetId: AssetId): Promise<Result<Loaded<Requirement>[], PersistenceError>>;
  // Sets recalculationStatus: "stale" and persists it — one targeted-property
  // write, not a full save() of a (possibly not-yet-recalculated) Requirement.
  markStale(id: RequirementId): Promise<Result<void, PersistenceError>>;
}

// application/commands/asset
// No projectId: the definition is shared, so there is no project to attribute it to.
interface CreateAssetInput { name: string; category: AssetCategory;
  unit: MeasurementUnit; unitCost: Money; wasteFactorDefault?: Decimal; supplier?: string; sku?: string; notes?: string; }
type CreateAssetCommand = Command<CreateAssetInput, Result<Asset, ValidationError | PersistenceError>>;

// application/commands/requirement — every command's error union includes
// PersistenceError: each calls AssetRepository/RequirementRepository, whose reads and
// writes alike can fail (see the ports above), and per Slice 3's rule that a Result
// must be inspected and returned, not discarded, before publishing any event or
// reporting success.
interface AssignAssetInput { zoneId: ZoneId; assetId: AssetId; }
// `created` is reported BY the command, not inferred by its caller: the command is the
// only thing holding both endpoint locks at the moment it decides, so it is the only
// thing that can answer truthfully. See "Who knows whether a Requirement was created".
interface AssignAssetResult { requirement: Requirement; created: boolean; }
type AssignAssetCommand = Command<AssignAssetInput, Result<AssignAssetResult, ValidationError | DomainError | ReferenceError | PersistenceError>>;
// idempotent: if a Requirement already links this (zoneId, assetId), returns the existing one.
// ValidationError if the Asset's unit is not area-kind. There is no longer a project
// check: an Asset has no projectId to compare the Zone's against, and pairing any Zone
// with any Asset is now correct rather than a leak. See "The derivation pipeline" above

// application/commands/requirement/ReversibleAssignAssetCommand.ts — the adapter the
// Inspector's "Assign Asset" control actually dispatches. PRD §68 names
// AssignAssetCommand undoable, and the Inspector commit path is CommandHistory.run()
// (slice 6), which takes an UndoableCommand: a plain Command cannot be dispatched
// there at all. Same family as slice 8's ReversibleCreateZoneCommand, and it lives
// beside the command it wraps for the same reason — undo and redo both need the
// repository, not just the plain command.
class ReversibleAssignAssetCommand implements UndoableCommand {
  constructor(
    private readonly assignCommand: Command<AssignAssetInput, Result<AssignAssetResult, ValidationError | DomainError | ReferenceError | PersistenceError>>,
    private readonly requirementRepository: RequirementRepository,
    private readonly input: AssignAssetInput,
  );
  // First call dispatches assignCommand and records its whole AssignAssetResult —
  // the Requirement AND the command's own `created` flag. The flag is read from the
  // result, never inferred from a read the adapter took itself: AssignAssetCommand is
  // idempotent, so the two outcomes are indistinguishable from the Requirement alone,
  // and an undo that deleted a pre-existing Requirement would destroy a link (and its
  // overrides) the user never made in this gesture. See "Who knows whether a
  // Requirement was created" for why two concurrent tabs make inference actively
  // wrong rather than merely awkward.
  //
  // Redo restores the recorded snapshot UNDER ITS ORIGINAL ID, but it is a
  // create like any other and revalidates before saving: it re-acquires both
  // endpoint locks, re-reads the current Zone and Asset, and re-runs exactly the
  // checks AssignAssetCommand runs — both endpoints still exist and the Asset's unit
  // is still area-kind — failing with the same errors
  // if any no longer holds. Only the ID is carried over from the snapshot; the
  // validity is re-established against the world as it is now.
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;   // deletes only what execute() created; a
                                             // no-op when it found one already there.
                                             // The delete is conditional on the
                                             // revision execute() produced, so an
                                             // override or recalculation landed since
                                             // is a conflict, not a casualty.
}

interface RecalculateRequirementInput { requirementId: RequirementId; }
type RecalculateRequirementCommand = Command<RecalculateRequirementInput, Result<Requirement, CalculationError | ReferenceError | PersistenceError>>;

interface SetRequirementQuantityOverrideInput { requirementId: RequirementId; quantity: number | null; }
type SetRequirementQuantityOverrideCommand = Command<SetRequirementQuantityOverrideInput, Result<Requirement, DomainError | ReferenceError | PersistenceError>>;

interface SetRequirementCostOverrideInput { requirementId: RequirementId; cost: Money | null; }
type SetRequirementCostOverrideCommand = Command<SetRequirementCostOverrideInput, Result<Requirement, DomainError | ReferenceError | PersistenceError>>;

// The two adapters the override fields actually dispatch — neither plain command above
// can reach CommandHistory.run(), which is the Inspector's only commit path (slice 6).
// Declared as a pair rather than one generic over the value type: they differ only in
// what `T` is, and a shared adapter would have to be told how to read and write the
// field, which is more machinery than the second small class it replaces.
//
// Each captures the whole pre-edit Requirement on its FIRST execute and restores it on
// undo — not just the override field, because the quantity command also re-runs the Cost
// Pipeline and a field-only restore would leave estimatedCost.calculated derived from a
// quantity that no longer exists. `null` is a value inside that snapshot, not an absence:
// "reset to calculated" sets the override to null, so undoing a reset restores the figure
// the user typed and undoing a first-ever override restores null. Treating null as
// "nothing to restore" would leave the reset affordance as the one edit in this panel
// that undo cannot take back — silently, since every other test in the family passes.
class ReversibleSetRequirementQuantityOverrideCommand implements UndoableCommand {
  constructor(
    private readonly setCommand: SetRequirementQuantityOverrideCommand,
    private readonly requirementRepository: RequirementRepository,
    private readonly input: SetRequirementQuantityOverrideInput,
  );
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;
}

class ReversibleSetRequirementCostOverrideCommand implements UndoableCommand {
  constructor(
    private readonly setCommand: SetRequirementCostOverrideCommand,
    private readonly requirementRepository: RequirementRepository,
    private readonly input: SetRequirementCostOverrideInput,
  );
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;
}

// application/queries
// Rows for a Requirement whose Asset is gone come back with assetName: null,
// missingTarget: 'asset' and recalculationStatus "stale", never "current" — the query
// neither fails nor drops them. There is deliberately no project-wide sibling to this
// query for the Zone-less case: see "Deletion & reference integrity" and Out of scope.
function GetRequirementsForZone(zoneId: ZoneId): Promise<Result<RequirementInspectorDTO[], PersistenceError>>;
function ListAssets(): Promise<Result<Asset[], PersistenceError>>;
function ListRequirementsReferencing(
  target: { kind: 'zone'; zoneId: ZoneId } | { kind: 'asset'; assetId: AssetId },
): Promise<Result<readonly ReferencingProject[], PersistenceError>>;
// Grouped, as declared under Queries above — the two declarations are one contract and
// must not drift. The delete flow still dispatches a FLAT set: the dialog renders a row
// per group, and the caller passes
// `groups.flatMap(g => g.requirementIds)` as `resolvedReferents`. Grouping is how the
// set is SHOWN; the set the user consents to is its union, unchanged.
```

```text
domain/asset/                          domain/requirement/
├── Asset.ts                           ├── Requirement.ts
├── AssetId.ts                         ├── RequirementId.ts
├── AssetCategory.ts                   ├── RequirementOrigin.ts
├── Asset.schema.ts                    ├── Requirement.schema.ts
├── Asset.errors.ts                    ├── Requirement.errors.ts
└── Asset.events.ts                    └── Requirement.events.ts

application/commands/asset/            application/commands/requirement/
├── CreateAsset.ts                     ├── AssignAsset.ts
├── UpdateAsset.ts                     ├── ReversibleAssignAssetCommand.ts
└── DeleteAsset.ts                     ├── RecalculateRequirement.ts
                                       ├── SetRequirementQuantityOverride.ts
                                       ├── SetRequirementCostOverride.ts
                                       ├── ReversibleSetRequirementQuantityOverride.ts
                                       ├── ReversibleSetRequirementCostOverride.ts
                                       └── DeleteRequirement.ts

application/event-handlers/requirement/
├── onZoneGeometryChanged.ts    (→ RequirementInvalidated → RecalculateRequirement)
├── onAssetUpdated.ts            (same, for every Requirement linked to that Asset)
└── onRequirementRecalculated.ts (→ Cost Pipeline → CostEstimateChanged)
```

Domain events this slice adds to §34's catalog: `AssetCreated`, `AssetUpdated`,
`AssetDeleted`, `RequirementCreated`, `RequirementInvalidated`,
`RequirementRecalculated`, `CostEstimateChanged`. Every one of them has either a
subscriber in this slice or a stated reason to have none: `AssetUpdated` drives the
recalculation cascade above, `RequirementRecalculated` drives the cost pipeline, and
`AssetCreated`/`AssetDeleted`/`RequirementCreated` are published for later epics and
for the Vault-change pipeline, with nothing in this slice's loop depending on them.
An event published with no subscriber and no reason is how the `AssetUpdated` gap got
in; naming the split here is what stops the next one.

## Persistence Impact

New Vault folders (PRD §36): `Requirements/` inside the project folder, and `Assets/`
inside the **library folder** — a plugin setting (§83), one per vault, because the
catalogue belongs to no project (§59, amended 2026-08-26).

**That storage location is not indexed or observed yet, and this slice depends on it
being both.** Slice 4's `collectNotes` skips any file outside the project folder and
`VaultChangeAdapter` returns early on the same test, so a library that is a separate root
is invisible to the Project Index and to the vault-change pipeline — which would make a
library Asset unresolvable, and would let `ListRequirementsReferencing` miss another
project's Requirements, so an Asset update or delete could silently miss live referents.
It does not bite while there is one `projectFolder` and the library defaults inside it.
The decision belongs to slice 4, which owns the index and now records it; this note names
it because an implementer starting here would otherwise meet it as a bug.
Both are note-based entities per PRD §37, following slice 4's
Markdown-frontmatter-plus-Zod-schema pattern with `schema-version: 1`. Neither
owns a geometry sidecar — Requirement references a Zone by ID rather than
storing geometry (§3.6).

```yaml
# <library folder>/Assets/Porcelain Terrace Tile.md
---
type: renovation-asset
schema-version: 1

id: asset-01JDEF7Q3K

name: Porcelain Terrace Tile
category: material
supplier: "Acme Tile Co."
sku: PTT-600x600-GREY
unit: m2
unit-cost: "45.00"
currency: EUR
waste-factor-default: "0.10"
---

Grey outdoor porcelain, 20mm, slip-rated.
```

```yaml
# Requirements/Bathroom - Porcelain Terrace Tile.md
---
type: renovation-requirement
schema-version: 1

id: requirement-01JG2K9F4M7N9P1Q3R5S7T9V1W
project: project-01JAB9Q2WE4RT6YU8IO0PA1SD2
asset: asset-01JDEF7Q3K5M7N9P1Q3R5S7T9V1
origin-kind: zone
origin-zone: zone-01JABC7XG3QK9F8N2M4P6R5T0W

unit: m2
waste-factor: "0.10"

quantity-calculated: "13.2"
quantity-override: null

cost-calculated: "594.00"
cost-override: "550.00"
currency: EUR

calculated-from-area: "12.0"
calculated-from-unit-cost: "45.00"
calculated-from-asset-unit: m2

recalculation-status: current
required-date: null
---
```

`recalculation-status` is **persisted, not derived**, and this is the frontmatter field
that makes the design above true rather than aspirational. The whole stale-marker
argument — mark stale durably *before* attempting recalculation, so a failure can never
leave outdated numbers reading as current — depends on the marker outliving the process
that set it. A `Requirement` schema without the field would lose it on the next
hydration and show the cached `quantity-calculated`/`cost-calculated` as current, which
is precisely the state `markStale` exists to prevent. It round-trips through the mapper
and the Zod schema like any other field, and is covered by the contract suite below.

`calculated-from-area`, `calculated-from-unit-cost` and `calculated-from-asset-unit` are
the same argument carried one step further: they record the **three** inputs that live
outside this note, so a reader can tell that the stored figures are obsolete even when
the marker never got written (see "The marker cannot be the only thing holding that
guarantee" above). They are written only by `RecalculateRequirementCommand`, in the same
save as the figures they explain, and the two decimal ones are quoted strings for the
same ADR-010 reason as everything else in this block.

The unit is the one of the three that is easiest to leave out and the one whose absence
is hardest to notice, so it is worth saying why it is here. `calculatedFrom` is declared
in the read model as `{ zoneArea, unitCost, assetUnit }` precisely so a load can ask "is
the Asset's unit still the unit these figures were computed against?" — the check that
catches an `m2 → m` change when `markStale` failed or the process died before it ran. A
schema persisting only the first two answers that question with nothing: the field exists
in memory, is populated on every recalculation, and is gone the moment the plugin
reloads, which is exactly the window the backstop was for. The read model would then have
to either reject the note or quietly drop the comparison, and dropping it is the one that
ships. It is the raw `MeasurementUnit` symbol, unquoted — a vocabulary value like
`status` or `currency`, not a decimal — and it round-trips through the DTO, the schema
and the mapper like every other field, with its own round-trip assertion in the contract
suite rather than an inherited one.

Every decimal-valued field is persisted as a **quoted string**, not a YAML float.
ADR-010 exists because native floating point silently loses money, and a YAML parser
producing `594.0000000000001` from `594.00` would reintroduce exactly that at the one
boundary the plugin does not control — the file a user can hand-edit. `Decimal` parses a
string exactly; the mapper is the only place the conversion happens. It stays readable
to a human either way, which is the §3.2 property that matters.

Both `*-calculated` fields are persisted deliberately (not recomputed on every load) —
this is the exception §3.6 itself names: values needed "for overrides or historical
snapshots." Reading either note outside Obsidian still shows a meaningful last-known
figure (SDD §92 #7).

The Project Index (§47) gains two new lookups this slice's event handler
depends on, extending its existing "plan ID → spatial objects" responsibility:

```text
zone ID  → requirement IDs   (used by onZoneGeometryChanged)
asset ID → requirement IDs   (used by reference-integrity checks on Asset delete)
```

Both are rebuildable from the Vault like the rest of the index (§47, §92 #14)
— nothing here is canonical state, only a cache over the Requirement notes'
own `origin-zone`/`asset` fields.

No new migration category is needed yet: `RequirementOrigin` is already a
discriminated union, so later epics adding `work-package`/`asset` origin kinds
are additive, not breaking.

**The sequence marker is the one thing this slice persists that is not a note**, and it
is easy to leave out of this section because it is not project data — which is exactly
why it belongs here. It is plugin-local operational state: it lives in the plugin's own
data, **not** in `data.json`'s settings object (`settingsFrom` drops keys this version
does not declare, which would discard an outstanding recovery), carries its own
`schemaVersion` like every other persisted shape, and is excluded from anything that
exports or shares a project — a half-finished delete is not part of the Markdown-native
record (§3.2). Unlike every note above it is **short-lived by construction**, existing
only between one interrupted sequence's first mutation and its recovery, and a marker a
newer version cannot read is discarded with a diagnostic rather than migrated. The
reasoning for that, which is the one place this plugin declines to migrate a persisted
shape, is at the marker's own declaration under "Compensated multi-entity sequences".

## Testing Strategy

- **Unit (domain).** Asset validation (unit cost ≥ 0, `wasteFactorDefault` and
  `wasteFactor` in `[0, 1]`, category is one of the seven allowed values).
  Requirement factory rules (origin must reference a resolvable Zone).
  `DerivedValue` effective-value resolution reused at the Requirement level for
  both `quantity` and `estimatedCost` independently (§70 "Quantity" +
  "manual overrides").
- **Unit (pipeline wiring).** Given a fixed Zone area and Asset unit
  cost/waste factor, the Quantity Engine and Cost Pipeline calls produce the
  exact expected `quantity.calculated` and `estimatedCost.calculated` —
  deterministic, no Obsidian/Vue/Konva involved (§92 #1–3, #12).
- **Application (in-memory repositories, §71).** `AssignAssetCommand` creates
  exactly one Requirement and is idempotent on a repeated call for the same
  (zone, asset) pair. `AssignAssetCommand` against an Asset whose `unit` is
  `m`, `m3`, `piece`, `hour`, `day`, or `fixed` resolves a `ValidationError`
  and creates no Requirement — table-driven over all six rejected units, not just
  one. `AssignAssetCommand` given Zones from two different Projects and one shared Asset
  **succeeds both times**, each Requirement carrying its own Zone's `projectId` — driven
  through the command with two fixture Projects. It replaces a test that required the
  opposite; written as a success rather than deleted, so that reintroducing the old
  refusal fails something. A currency mismatch is **not** rejected here: it surfaces as a
  failed recalculation, per **A mismatched unit or currency is an error, not a
  coercion**, on the seam the cascade's error branch already describes. A test publishes
  `ZoneGeometryChanged` directly on an
  in-memory Event Bus and asserts the full cascade fires in order —
  `RequirementInvalidated` → `RequirementRecalculated` → `CostEstimateChanged`
  — exactly once each, with the Requirement's persisted `calculated` values
  updated. Separate tests confirm `SetRequirementQuantityOverrideCommand` and
  `SetRequirementCostOverrideCommand` each publish `CostEstimateChanged` only
  when the effective cost actually changes. A further test makes
  `requirementRepository.markStale` resolve a failed `Result` on an in-memory
  repository configured to fail, and asserts the cascade stops there: no
  `RequirementInvalidated` is published and `recalculateRequirement` is never
  invoked for that Requirement. That test continues past the cascade, because
  stopping is only half the requirement: the Zone's area is then changed, all
  in-memory state is discarded, and `GetRequirementsForZone` must report the
  Requirement `"stale"` — from the `calculatedFrom` mismatch, since the marker
  write is exactly what failed. A test that asserted only "no recalculation
  happened" passes against a design that silently shows the old number as current.
  The `AssetUpdated` handler is driven by the same
  table: publishing it after a `unitCost` change recalculates every Requirement
  `listByAsset` returns, and none is left `"current"` at the old price.
- **Application — undoable assignment.** `ReversibleAssignAssetCommand` on a
  (zone, asset) pair with no existing Requirement: `undo()` removes it;
  `execute()` again (redo) brings it back **under the same RequirementId**, asserted
  against the first execute's ID. On a pair that already has a Requirement — the
  idempotent path — `undo()` leaves it in place, with any overrides on it untouched.
  The second case is the one a naive adapter fails, and it fails invisibly, since a
  test that only ever assigns to a fresh Zone never reaches it.
- **Application — undoable overrides.** Each adapter driven over the three transitions its
  snapshot has to tell apart: `null → value`, `value → value'`, and `value → null` (the
  reset affordance). Undo restores the left-hand side in all three, and the third is what
  separates a correct adapter from one reading a captured `null` as "there was nothing
  here". Asserted by comparing the **full** pre-edit and post-undo Requirement, not the
  override field alone — the quantity adapter's whole reason for snapshotting the entity
  is `estimatedCost.calculated`, which a field-level assertion never looks at. Redo
  re-applies the recorded value rather than re-reading the field, asserted by undoing and
  redoing twice: a snapshot-on-every-execute adapter drifts on the second round while
  looking right on the first.
- **Application — reassignment recalculates.** A Requirement on a 10 m² Zone, reassigned
  to a 20 m² Zone, ends with the persisted figures the new area produces and a marker
  that never reads `"current"` beside the old ones; the Asset case is the same test over
  two `unitCost`s. Asserted against the repository rather than the DTO, because
  `calculatedFrom` makes the read model say `"stale"` even when nothing recalculated —
  which is the difference between the symptom being hidden and the bug being fixed. Two
  failure cases beside it: a failing `markStale` compensates the whole resolution, and a
  failing recalculation does not (repointed, stale, logged, delete completed).
- **Application — dangling references.** After `delete-anyway` on an Asset,
  `GetRequirementsForZone` returns the row with `assetName: null`,
  `missingTarget: 'asset'` and `recalculationStatus: 'stale'` rather than failing or
  omitting it. Asserted as a row returned, not as an error absent — a query that dropped
  the row would also "not fail". After `delete-anyway` on a **Zone**, the assertion is
  what survives rather than what renders: the Requirement still loads through
  `requirementRepository.getById` with its dangling `origin` reference and
  `recalculationStatus: 'stale'` intact, and an `AssetUpdated` cascade over it leaves it
  stale rather than deleting, repointing, or failing the whole cascade. There is no
  query to assert on for that case, and a test written against one would be asserting a
  surface this slice deliberately does not build.
- **Repository contract (§72).** A shared `AssetRepository` and
  `RequirementRepository` contract suite runs against both in-memory and
  Obsidian implementations: round-trip through the Markdown mapping, and
  rejection of malformed frontmatter (negative `unit-cost`, unknown
  `category`, an `origin-zone` that doesn't parse as an ID) before it reaches
  the domain (§43). The round-trip explicitly includes
  `recalculation-status: stale`: save a stale Requirement, discard all in-memory
  state, re-read it, and assert it is still `"stale"`. A marker that survives
  `markStale()` but not a reload is the same defect as no marker at all, and only a
  reload test distinguishes the two. All three `calculated-from-*` fields round-trip in
  the same test — the two decimals as quoted strings, `calculated-from-asset-unit` as a
  bare `MeasurementUnit` symbol — since they are what keeps that reading honest when the
  marker write is the thing that failed. The unit needs its own assertion rather than an
  inherited one: it is the field whose loss is invisible (the read model keeps working
  and simply stops catching unit changes), and it is the one a schema is likeliest to
  omit, since the other two are obviously numeric and it is not.
- **Vue component (§73).** The Inspector's Requirements panel: renders
  calculated values with no badge when no override is set; renders the
  override with a distinct visual treatment and still shows the calculated
  value for comparison when one is set (§52); the "assign asset" picker
  dispatches `ReversibleAssignAssetCommand`; the cost field's reset control dispatches
  `ReversibleSetRequirementCostOverrideCommand(..., null)`, and the quantity field's the
  quantity adapter. Asserted on what reaches `CommandHistory.run()`, since that is the
  difference the funnel rule is about — a control wired to the plain command dispatches
  something that looks identical at the repository and never lands in undo history.
- **Integration test vault (§75).** Add an `asset-and-requirement` fixture
  under `tests/vault/` — one Project, one Plan, one calibrated Zone with a
  known area, one Asset with known unit cost and waste factor, and one
  Requirement linking them — as the golden fixture the end-to-end scenario
  below runs against, and as a base later feature-epic tests can extend.
- **End-to-end (top of §69's pyramid).** A headless test walks the full
  Definition of Done scenario below and asserts the final state at each step,
  including surviving a repository reload.

## Definition of Done

- [ ] `Asset` and `Requirement` each follow the exact module pattern from §78
      (entity, ID, category/origin type, schema, errors, events), matching the
      shape slice 3 established for Zone.
- [ ] `domain/asset/**` and `domain/requirement/**` import nothing from
      `vue`, `pinia`, `konva`, or `obsidian` (ADR-006, enforced by the lint
      rules from slice 1/12).
- [ ] `AssetRepository` and `RequirementRepository` have in-memory and
      Obsidian implementations passing one shared contract test suite (§72).
- [ ] Requirement notes persist under the project's `Requirements/`, and Asset notes
      under the **library folder's** `Assets/` — one per vault, resolved from the plugin
      setting (§83), never from the project folder — each
      with `schema-version: 1`, validated through Zod on read (§43); invalid
      frontmatter is rejected before it reaches the domain, not silently
      coerced.
- [ ] `AssignAssetCommand` creates a `Requirement` whose `quantity.calculated`
      and `estimatedCost.calculated` are correct on first creation, without
      requiring a subsequent Zone edit.
- [ ] `AssignAssetCommand` rejects an Asset whose unit is not of `area` kind with a
      `ValidationError` and creates no Requirement — a Zone's area is not a valid
      identity input for a length, volume, piece, hour, day, or fixed-unit Asset. The
      check reads slice 9's `UNIT_KIND` map, not a literal `'m2'` comparison.
- [ ] `AssignAssetCommand` **accepts** any Zone with any area-kind Asset **whose currency
      matches the Zone's Project**, regardless of which project the Zone is in — asserted
      by driving the command directly with Zones from two different Projects against one
      Asset. The catalogue is shared (§59), so this pairing is correct rather than a leak;
      the Requirements it creates each carry their own Zone's `projectId`. This criterion
      replaces one requiring the opposite, and is written as a positive assertion on
      purpose — a deleted refusal leaves no test behind, and nothing would then notice the
      guard being reintroduced.
- [ ] A Requirement pairing a Zone with an Asset priced in **another currency** is created
      by `AssignAssetCommand` and then **fails to recalculate**, staying
      `recalculationStatus: "stale"` while its sibling Requirements on the same Zone
      recalculate normally. Asserted end to end rather than at the command, because that
      is where the check lives: ownership stopped being a reason a pairing can be wrong,
      currency became one, and the seam catching it is the cost pipeline's existing one.
      The per-project price override that would make such a Requirement costable is not in
      this slice — see "Sharing did create one new way for a pairing to be wrong".
- [ ] `ListRequirementsReferencing` on an Asset returns referents **grouped by project**,
      covered by a fixture where one Asset is referenced from two Projects; the delete
      dialog renders a row per project. A bare total is refused by this test, because it
      reads as "in the project I am looking at" while a shared asset's references are not.
- [ ] `reassignTo` on an **Asset** delete accepts a target regardless of project, and on
      a **Zone** delete still refuses one whose `projectId` differs from the deleted
      Zone's. Both halves asserted, since the asymmetry is the thing a later reader is
      most likely to "tidy" back into symmetry.
- [ ] The event chain `ZoneGeometryChanged → RequirementInvalidated →
      RequirementRecalculated → CostEstimateChanged` is covered by an
      application-layer test asserting event order (§32, §71).
- [ ] The same chain runs from `AssetUpdated`: changing an Asset's `unitCost` updates
      every linked Requirement's `estimatedCost.calculated` and leaves none marked
      `"current"` with a figure computed from the old price — covered by a test that
      edits a price and asserts the Requirement's persisted cost changed, not merely
      that the event fired.
- [ ] A failed `requirementRepository.markStale` write aborts the cascade for
      that Requirement before `RequirementInvalidated` publishes or
      recalculation runs, covered by a test against a repository configured
      to fail — and is surfaced to the user, not only logged, since the durable
      marker that lets a background failure stay quiet is the write that failed.
- [ ] After that failed marker write, the Requirement still reads `"stale"` once its
      Zone's area has changed and all in-memory state has been discarded — from the
      `calculatedFrom` mismatch, with the persisted flag still saying `"current"`. This
      is the assertion that the guarantee does not rest on the write that can fail.
- [ ] `calculatedFrom` never moves a reading the other way: a Requirement persisted as
      `"stale"` whose inputs happen to match again still reads `"stale"`.
- [ ] `UpdateAssetCommand` refuses a unit change that crosses `UNIT_KIND` while any
      Requirement references the Asset — `ValidationError`, nothing written, no
      `AssetUpdated` published — while a same-kind unit change, and any unit change on
      an unreferenced Asset, still succeeds and cascades. This is the update-path half
      of the invariant `AssignAssetCommand` enforces at creation, and it holds the
      Asset's reference lock from before `listByAsset` through the save, so a
      concurrent assignment cannot falsify the check between the two.
- [ ] With that guard bypassed (a hand-edited note or a migration), a Requirement whose
      Asset unit changed kind still reads `"stale"` even though its `zoneArea` and
      `unitCost` are byte-identical — the `calculatedFrom.assetUnit` mismatch is what
      catches it, and a two-field snapshot would report `"current"` here. Asserted
      **after a reload**, not against an in-memory Requirement: `assetUnit` is only a
      backstop if it survives to disk, and the version of this test that skips the round
      trip passes against a schema that never persisted the field.
- [ ] Every Asset write is conditional on the same terms as every other entity's: two
      `UpdateAssetCommand`s from stale reads cannot both land, and an Asset edit loaded
      before a concurrent `DeleteAssetCommand` refuses rather than resurrecting the
      Asset after the delete removed or reassigned its Requirements. The resurrection
      case gets its own test — it is the one the reference lock does not cover, since a
      field edit creates no reference for that lock to serialize against.
- [ ] `ReversibleAssignAssetCommand` is what the Inspector dispatches: undo removes a
      Requirement this gesture created, redo restores it under the same
      `RequirementId`, and undo on the idempotent path — where the Requirement already
      existed — deletes nothing and preserves its overrides. Redo restores the ID but
      not the validity: it re-acquires both endpoint locks and re-runs
      `AssignAssetCommand`'s existence, project and unit-kind checks against the
      current entities, refusing rather than recreating a link that is no longer legal.
- [ ] The adapter reads `created` from `AssignAssetResult`, never from its own
      pre-dispatch read: two adapters assigning the same (zone, asset) concurrently see
      `created: true` and `created: false` respectively, and the second's undo deletes
      nothing. Driven by interleaving two adapters against one repository — an adapter
      that inferred creation from a read taken before dispatch fails this and passes
      every single-tab test.
- [ ] A Requirement left dangling by `delete-anyway` on its **Asset** is still readable:
      `GetRequirementsForZone` returns the row with `assetName: null`,
      `missingTarget: 'asset'` and `"stale"`. The query neither fails nor silently omits
      the row.
- [ ] A Requirement left dangling by `delete-anyway` on its **Zone** survives intact —
      note still present, `origin` still naming the deleted Zone, `"stale"` still set,
      and an `AssetUpdated` cascade over it leaving all three that way. This slice builds
      no surface that lists it (see Out of scope), so this is the checkable half of that
      state: not that a user can find it, only that the plugin has not quietly altered or
      dropped it.
- [ ] The Requirements panel shows the result of a command while the Zone stays
      selected, for all three writers this slice adds: assigning an Asset makes the new
      row appear, a Zone-geometry commit leaves the recalculated quantity and cost on
      screen, and a cost override leaves the overridden figure and its badge on screen —
      each with no reselect and no view reopen. Asserted through the dispatch, on the
      panel's DTO, so it fails if slice 8's `withEditorStateRefresh` stops refreshing the
      Inspector; asserting only that the Vault holds the new figure would pass against
      the stale panel this checks for.
- [ ] Both `Requirement.quantity` and `Requirement.estimatedCost` are
      `DerivedValue<T>`, and the Inspector visibly distinguishes calculated
      from overridden for each independently (§52).
- [ ] `recalculationStatus` is persisted as `recalculation-status` in the Requirement
      note, exposed on `RequirementInspectorDTO`, and survives a full reload: a
      Requirement marked `"stale"` by a failed recalculation still reads `"stale"` after
      the in-memory state is discarded and rebuilt, and the Inspector renders its badge
      from the DTO rather than recomputing it.
- [ ] Every decimal-valued field round-trips through the Markdown mapping without loss:
      a Requirement whose calculated cost is `594.005` reads back as exactly `594.005`,
      asserted on the `Decimal` value, never on a coerced `number`. This is the test
      that fails if a persisted decimal is ever written as a YAML float.
- [ ] Undoing the Zone-geometry command that triggered a recalculation also
      restores the Requirement's prior calculated quantity and cost, without
      a separate undo-history entry for the Requirement itself (§30–31).
- [ ] Deleting a Zone or Asset with a live Requirement and **no** `resolution` refuses
      with a `ReferenceError` naming the referents, instead of cascading silently — the
      path a script or migration takes.
- [ ] A `resolution` supplied without `resolvedReferents` is a `ValidationError`, and a
      `resolution` whose `resolvedReferents` no longer match the live set returns
      `reference.set-changed` with nothing written — asserted with a Requirement added
      between the read and the dispatch, so `remove-references` cannot delete a referent
      the user was never shown. Set equality, not count: a test that swaps one referent
      for another (count unchanged) must still refuse.
- [ ] An `AssignAssetCommand` dispatched *during* a delete resolution — after its set
      check has passed and before the entity is deleted — cannot leave a dangling
      Requirement: the reference lock makes the two serialize, so either the assignment
      completes first (and the delete then refuses with `reference.set-changed`) or it
      waits and fails to resolve an entity that is gone. Asserted by interleaving the
      two commands without awaiting the first, not by reasoning about ordering — a test
      that awaited the delete before assigning would pass without any lock at all.
- [ ] An `AssignAssetCommand` dispatched *during* a unit-changing `UpdateAssetCommand`
      — after its `listByAsset` returned empty and before its save — cannot leave a
      Requirement linked to a non-area Asset: the same lock serializes them, so either
      the update lands first (and the assignment then refuses on unit kind) or the
      assignment lands first (and the update then refuses on referents). Interleaved
      without awaiting, for the same reason as above.
- [ ] Two multi-lock commands whose lock sets are the same two entities in opposite
      orders both complete: Zone Z1's requirements reassigned to Z2 while Z2's are
      reassigned to Z1, dispatched interleaved without awaiting either. Under
      first-come-first-served acquisition this hangs; under the sorted single
      acquisition one waits for the other and both finish. Asserted with a bounded
      timeout, so a deadlock fails the test rather than hanging the suite — and the
      test is watched failing with the sort removed, since a passing deadlock test that
      never deadlocked is evidence of nothing.
- [ ] Each level's set is taken in one acquisition, and levels only ever go 1 → 2:
      checked at the lock itself — it raises on a second request within a level from a
      holder, and on any level-1 request from a level-2 holder — rather than by driving
      the commands that exist today, so both hold for commands not yet written.
- [ ] A resolution's compensation is not blocked by a concurrent edit: with an ordinary
      override edit dispatched against an affected Requirement *after* step 2 rewrote it
      and *before* step 3 fails, the rollback still restores every Requirement and the
      command's failure leaves the Vault as it was. Interleaved without awaiting — a test
      that let the resolution finish first would pass with no level-2 lock at all.
- [ ] A resolution interrupted by a process exit is recovered at next load from its
      marker, **including an exit after step 3 has deleted the entity** — the case the
      marker exists for and the one a marker carrying only an ID cannot serve, since
      rolling back then means putting the entity back and an ID is not a Zone. Simulated
      by leaving a marker behind, since the process that would have rolled back is gone —
      which is exactly the case a lock cannot cover.
- [ ] Recovery is conditional and idempotent: a Requirement changed out of band while the
      process was dead is NOT overwritten — recovery surfaces a diagnostic and leaves it
      — and running recovery twice over the same marker produces the same Vault as
      running it once. The idempotence case is not decoration: a crash can land between a
      Requirement write and its `progress` append, so an entry can be missing for a write
      that happened and present for one that did not, and both must be survivable.
- [ ] `progress` and the payload's `affectedAfter` are the **same array**, not two of one
      shape — asserted by reference identity on a completed resolution, which is a
      stronger and shorter check than comparing two independently built records. The
      comparison test this replaces was the design smell: two descriptions of what a
      sequence did can disagree, and the disagreement would only surface during a
      recovery, so the fix is one writer rather than a test policing two.
- [ ] The sequence marker persists to the plugin's own data (never `data.json`'s settings
      object, which drops undeclared keys), carries a `schemaVersion`, and a marker this
      version cannot read is **discarded with a diagnostic** rather than migrated or
      silently dropped — asserted with a fixture marker at an unknown version, checking
      that no Requirement is written and that slice 11 receives the diagnostic.
- [ ] `ReversibleAssignAssetCommand`'s redo revalidates: after assign → undo → change
      the now-unreferenced Asset from `m2` to `m`, the redo resolves a
      `ValidationError` and creates nothing, rather than restoring a Requirement whose
      area quantity now describes a length-unit Asset. Same for redo after either
      endpoint is deleted. The command stays on `redoStack` (slice 6), so the history
      is not corrupted by the refusal.
- [ ] Each of `remove-references`, `reassign` and `delete-anyway` produces its own
      distinct outcome, covered by a test per resolution: references deleted, references
      repointed at `reassignTo`, and references left behind marked `"stale"`
      respectively. A dialog whose three non-cancel buttons all did the same thing would
      pass a test that only exercised one of them.
- [ ] A resolution that fails partway — the third of five Requirement writes, and
      separately the final entity delete — restores every Requirement already written
      and returns the error, leaving the Vault as it was before the command ran. Covered
      per resolution, since `remove-references` and `reassign` fail differently.
- [ ] Undo after a successful resolution restores the deleted entity **and** every
      Requirement the resolution touched, from `affectedBefore` — asserted by comparing
      full pre-delete and post-undo state, not just the entity's own fields.
- [ ] An undo that fails part-way — the second of several restores — leaves the Vault
      exactly as the delete left it and the command on `undoStack`, per slice 8's
      compensated restore. The mirror of the execute-side case above, and the one that
      only becomes testable here, where `affectedBefore` first holds more than the
      deleted entity itself.
- [ ] `reassign` recalculates. Reassigning a Requirement from a 10 m² Zone to a 20 m²
      one leaves it holding the **new** target's figures and a persisted
      `recalculationStatus` that is not `"current"`-with-old-numbers at any point a reader
      could observe; same for an Asset reassign across two different `unitCost`s. Asserted
      on the persisted entity, not on the DTO: `calculatedFrom` makes the *panel* read
      `"stale"` either way, so a DTO-level test passes against a resolution that never
      recalculated at all.
- [ ] A recalculation that fails during `reassign` leaves that Requirement repointed and
      persisted `"stale"`, logs, and still completes the delete — while a failed repoint
      or a failed `markStale` compensates and fails it. The two halves are asserted
      separately, since one policy applied to both would be wrong in one direction or the
      other.
- [ ] `reassign` with a `reassignTo` that is missing, self-referencing, unresolvable, an
      Asset whose unit is not of `area` kind, or a **Zone** in a different Project than
      the Zone being deleted resolves a `ValidationError`, writes nothing, and deletes
      nothing — the unit check reading slice 9's `UNIT_KIND`, so this path and
      `AssignAssetCommand` cannot disagree about what a valid link is.
      **Each check is now kind-specific, and in opposite directions**: the unit half is
      Asset-only, and the project half is Zone-only, because a shared Asset has no
      project to differ about (§59). The previous version required the project check on
      *both* kinds, so a reader restoring symmetry here would be reintroducing a refusal
      the amendment removed — asserted in both directions for that reason.
- [ ] Both override fields dispatch their reversible adapter through
      `CommandHistory.run()` — no plain override command reaches the panel — and undo
      restores the full pre-edit Requirement in each of the three cases that differ:
      overriding a calculated figure (undo → `null`), changing an existing override
      (undo → the earlier number), and resetting to calculated (undo → the number that was
      cleared). The third is the one an adapter treating `null` as "nothing to restore"
      fails while passing the first two, and the comparison covers `estimatedCost` as well
      as the field edited, since a quantity override rewrites both.
- [ ] A snapshot-restoring undo refuses rather than clobbers when the entity moved
      underneath it: edit a Requirement through a second adapter (or land a
      recalculation on it) between the first command's `execute()` and its `undo()`,
      then undo — assert a conflict `ValidationError`, that the second edit is still
      present, and that the command stayed on `undoStack`. Asserted for the override
      adapters and for the delete resolutions' `affectedBefore` restore, which has more
      entities to lose.
- [ ] That refusal is atomic, not merely checked: `RequirementRepository.save` takes an
      `Expected` and refuses on mismatch, serialized per `RequirementId`. Driven by a
      repository double that lands a competing write *between* a caller's read and its
      save — the interleaving a compare-then-write implementation loses to, and the only
      one that distinguishes a real compare-and-swap from a narrowed window.
- [ ] Every `save` **and `delete`** call site passes an `Expected`; none writes or
      removes blind. Checked by the type (neither has a one-argument overload), so a
      last-write-wins caller cannot compile rather than being caught by review.
- [ ] A Requirement hand-edited between a caller's read and its save refuses with
      `requirement.external-modification`, even though the hand edit left `revision`
      untouched — the half of the expectation a bare revision number cannot carry, and
      the reason every input that defers an expectation names `EntityVersion` rather
      than a number.
- [ ] An assignment undo whose Requirement was edited by another tab since `execute()`
      returns `requirement.revision-conflict` and deletes nothing — the case a CAS on
      `save` alone does not cover, since undo's write here is a delete.
- [ ] A delete resolution returns `affectedAfter` revisions for every Requirement it
      wrote and `'deleted'` for every one it removed, and its undo restores using
      those — not the pre-resolution revisions, which the command's own writes already
      superseded. Asserted by undoing a successful resolution with no concurrent edit
      at all: an undo passing pre-state revisions conflicts against the command's own
      effect and fails this without any race being involved.
- [ ] The full loop runs and is tested without Obsidian, Vue, or Konva loaded
      (§92 #1–3).

**End-to-end scenario** (the concrete proof of Increment 7's success
criterion — "Zone Geometry → Area → Requirement → Cost works end to end"):

1. Given a Project with a calibrated Zone "Bathroom" of area **10.0 m²**, and
   an Asset "Porcelain Tile" (`unit: m2`, `unitCost: 45.00 EUR`,
   `wasteFactorDefault: 0.10`).
2. Select the Zone. Its Inspector shows an empty Requirements panel.
3. Assign the Asset to the Zone. `AssignAssetCommand` creates a Requirement
   (`wasteFactor` defaulted to `0.10`), which triggers
   `RecalculateRequirementCommand` inline:
   `applyWaste(10.0, 0.10 × 100) = 10.0 × 1.10 = 11.0 m²`, then the Cost Pipeline:
   `estimatedCost.calculated = 11.0 × 45.00 = 495.00 EUR`. The Inspector shows
   **11.0 m² / 495.00 EUR**, both marked calculated.
4. Edit the Zone's polygon (slice 8) so its area becomes **12.0 m²** and
   commit the change. `ZoneGeometryChanged` fires → `RequirementInvalidated`
   → recalculation → `quantity.calculated = 12.0 × 1.10 = 13.2 m²` →
   `estimatedCost.calculated = 13.2 × 45.00 = 594.00 EUR` → `CostEstimateChanged`.
   The still-open Inspector shows **13.2 m² / 594.00 EUR** without being reopened
   or reselected — through slice 8's `withEditorStateRefresh`, which re-queries
   `GetRequirementsForZone` for the still-selected Zone in the same queued step as
   the write, *not* through a presentation-layer subscriber on `CostEstimateChanged`.
   This slice runs its cascade to completion inside the dispatch precisely so that
   one post-command re-query is enough: by the time `run()` resolves, the recalculated
   quantity and cost are already persisted, so the panel re-reads them rather than
   racing them. A subscriber would be the wrong mechanism here for slice 8's reason —
   the undo paths deliberately publish nothing — and a second one would make the panel
   refresh twice per command.
5. Override the cost to **550.00 EUR** (a negotiated price). The Inspector
   dispatches `ReversibleSetRequirementCostOverrideCommand` — through
   `CommandHistory.run()` like every other edit in the panel, so the override is undoable
   and the reset affordance restores 550.00 rather than clearing it a second time;
   `estimatedCost.override = 550.00`; `CostEstimateChanged` fires again. The Inspector now
   shows **550.00 EUR**, badged as overridden, with 594.00 EUR still visible as the
   underlying calculated figure, and `recalculationStatus` still `"current"` — an override
   is not a claim about the derivation.
6. Reload the plugin (disable/enable, or restart Obsidian). The
   `ObsidianRequirementRepository` reads the Requirement note back from
   Markdown; `estimatedCost.override` is still `550.00 EUR`.
7. The Inspector, reopened on the same Zone, shows **550.00 EUR**, still
   badged as overridden — the override survived a reload, and the loop from
   raw geometry to a user-adjustable, persisted cost is proven closed.

## References

**SDD** (`docs/sdds/obsidian-renovation-planner-SDD.md`):
- §3.6 Derived Data over Duplicate Data; §3.7 Progressive Complexity
- §7.2 Domain Layer (`asset/`, `requirement/` modules)
- §22 Geometry Core (`Polygon` area)
- §29 Command Architecture (`CreateAssetCommand`, `AssignAssetCommand`,
  `CreateRequirementCommand`, `RecalculateRequirementCommand`)
- §30–31 Undoable Editor Commands, Transaction Boundary
- §32–34 Event Architecture, Event Bus, Domain Events (the exact
  `ZoneGeometryChanged → RequirementInvalidated → RequirementRecalculated →
  CostEstimateChanged` chain and the initial event catalog)
- §35 Query Architecture (`GetAssetsForZone`, `GetRequirementsForWorkPackage`
  — this slice's `GetRequirementsForZone`/`ListAssets` extend the same
  pattern)
- §36–47 Repository Pattern, Obsidian Repository Layer, Markdown Entity
  Model, Schema Validation/Versioning, Project Index
- §48–52 Cost Engine, Money, Quantity Engine, Cost Pipeline, Manual Overrides
  (consumed from slice 9, not redesigned here)
- §55 Asset Handling (imported *file* assets — a distinct concept from this
  slice's catalog `Asset` entity; noted to avoid confusion)
- §58–59 Editor Context, Inspector Architecture
- §63–68 Error Model, Result Pattern, Error Boundary
- §69–76 Testing Strategy, Unit/Application/Repository/Component/Canvas Tests,
  Integration Test Vault, Architecture Test Rules
- §77–83 Repository Structure, Internal Module Pattern, Public Boundaries,
  Naming Conventions, TypeScript Rules, Entity IDs, Entity References
- §89 ADR-006, ADR-007, ADR-008, ADR-009, ADR-010
- **§90 MVP Architecture Slice** — the diagram this slice completes (Domain
  box's `Asset`/`Requirement` leaves)
- **§91 Increment 7 — Assets & Requirements** — the increment this slice
  delivers in full: Asset, Requirement, area-based requirement calculation,
  unit price, estimated cost; success criterion "Zone Geometry → Area →
  Requirement → Cost works end to end"
- **§92 Architecture Completion Criteria** — this slice, together with
  slices 11–12, is where these are ultimately satisfied; in particular #1–3
  (domain runs without Obsidian/Vue/Konva), #4 (commands/queries), #8 (runtime
  validation), #10 (real-world coordinates), #11 (undo/redo participation),
  #12 (deterministic cost/geometry unit tests), #14 (rebuildable index), #15
  (new views reuse application/domain layers)

**PRD** (`docs/prds/obsidian-renovation-planner.md`):
- §7 Spatial Domain (geometry types, world coordinates)
- §8 Core Entities — "Asset"
- §9–11 Cost Model, Cost Hierarchy, Cost Types
- §17 Epic 6 — Asset Library
- §18 Epic 7 — Cost & Budget Engine
- §32 Quantity & Requirement Domain (Requirement's property list, and the
  Asset/Requirement/Procurement Item/Cost Item/Installed Quantity distinction
  this slice preserves)
- §33 Financial Lifecycle
- §36–38 Vault Data Model, Persistence Strategy, Geometry Persistence
- §58–59 Canonical Relationship Model, Entity Relationship Rules
- §60–64 Identity Model, Schema Versioning, Migration Requirements, Reference
  Integrity, Deletion Semantics
- §68 Undo/Redo Architecture (names `AssignAssetCommand` as undoable)

**Design slices**: 02, 03, 04, 06, 08, 09 (dependencies, see table above).

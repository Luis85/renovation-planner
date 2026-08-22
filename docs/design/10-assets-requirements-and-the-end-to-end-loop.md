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
- **A project-level list of Requirements**, and with it any in-plugin surface for the
  Requirements that `delete-anyway` on a **Zone** strands. Every surface this map builds
  is scoped to a selection or a Plan: the Requirements panel hangs off a selected Zone,
  and a Zone-less Requirement has no Zone to select. The list that would reach it is
  project-scoped content in the Renovation Project view, which slice 14 explicitly
  defers as feature work ("the Renovation Project view's *populated* content"), or a
  Bases view over `Requirements/`, which the slice map defers with SDD §13. This slice
  therefore declares no `ListOrphanedRequirements` query: a query no surface calls is a
  dead export `npm run analyze` fails on, and the repository's own rule is that a thing
  arrives with its first real use. What the state costs the user, and what the MVP does
  offer instead, is stated under "Deletion & reference integrity" and recorded in
  `docs/issues/Zone-less requirements have no in-plugin surface.md`.

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
  readonly projectId: ProjectId;
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
  const requirements = await requirementRepository.listByZone(event.zoneId);
  for (const requirement of requirements) {
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
calculatedFrom: { zoneArea: Quantity; unitCost: Money }
```

Both are written by `RecalculateRequirementCommand` in the same save as the figures they
produced, so they are always written when writes are working, never when they are not.
The read model compares them against the Zone and Asset it has already loaded, and
reports `"stale"` on any mismatch regardless of the persisted flag.

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
  const requirements = await requirementRepository.listByAsset(event.assetId);
  /* … markStale → RequirementInvalidated → recalculate, exactly as above … */
});
```

`UpdateAssetCommand` publishes `AssetUpdated` on every successful save, including edits
that cannot change a cost (a `name` or `notes` change). Recalculating a few Requirements
unnecessarily is cheap and always correct; diffing the Asset to decide whether to fire
would be a second place that has to know which fields the pipeline reads, and would go
wrong silently the first time the pipeline started reading one more.

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
function ListAssets(projectId: ProjectId): Promise<Result<Asset[], PersistenceError>>; // the "assign asset" picker

// Used by slice 15's delete-confirmation flow. The Inspector needs a reference count
// before offering Delete, and §58/§59 route that through a query, never a repository
// handle the presentation layer holds.
function CountRequirementsReferencing(
  target: { kind: 'zone'; zoneId: ZoneId } | { kind: 'asset'; assetId: AssetId },
): Promise<Result<number, PersistenceError>>;

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
`ReversibleAssignAssetCommand` wraps it with one piece of state the plain command's
payload cannot supply: whether this call created the Requirement or found an existing
one. `AssignAssetCommand` is idempotent by design, so both return a Requirement, and an
`undo()` that deleted unconditionally would destroy a link — with whatever overrides had
been set on it — that the user's gesture never created. Undo deletes only what execute
created, and is a no-op otherwise.

Redo restores that Requirement under its original ID rather than re-running assignment,
for the reason slice 8 spells out for creation: `CommandHistory.redo()` calls `execute()`
again, and a fresh identity would strand every later command that captured the old one.
This adapter and slice 8's `ReversibleCreateZoneCommand` are the same shape over
different plain commands.

### Deletion & reference integrity

Deleting a Zone or an Asset that a Requirement still references must not silently
cascade-delete the Requirement (PRD §63–64). The check happens in **two places, for two
different reasons**, and keeping them apart is what makes the flow work:

- **Before the dialog**, the Inspector asks `CountRequirementsReferencing` (the query
  above) so slice 15's `DeleteReferenceDialog` can show the user what they are about to
  affect. This is a read for display. It goes through a query, never a repository handle
  held by presentation code — §58/§59, and slice 6's Inspector rule.
- **Inside the command**, `DeleteZoneCommand` (slice 3, extended here) and
  `DeleteAssetCommand` (this slice) re-check and refuse a bare delete that would orphan
  referents, returning a `ReferenceError` naming them. This is the enforcement, and it
  has to be in the command because a script, a migration, or a future caller that never
  opened a dialog must not be able to walk past it (§87 rule 5, slice 11).

The dialog's resolution reaches the command as data, which means a command input has to
carry it. **This slice is what adds that field**, because this slice introduces the first
entity that can reference a Zone — exactly the deferral slice 8 makes ("deferred to
whichever of those slices introduces the first entity that can reference a Zone"). Slice
3's `DeleteZoneInput` is widened by one optional field, and `DeleteAssetInput` is
declared with it from the start:

```typescript
type ReferenceResolution = 'remove-references' | 'reassign' | 'delete-anyway';

// slice 3's input, widened here — optional, so every existing caller still compiles
// and a caller that omits it gets the safe behaviour: refuse if referents exist.
interface DeleteZoneInput {
  zoneId: ZoneId;
  resolution?: ReferenceResolution;
  reassignTo?: ZoneId;   // required when resolution is 'reassign'; see below
}

interface DeleteAssetInput {
  assetId: AssetId;
  resolution?: ReferenceResolution;
  reassignTo?: AssetId;
}
```

What each resolution means to the command, so the dialog's four buttons are four real
outcomes rather than three synonyms for "delete":

| Resolution | Command behaviour |
| --- | --- |
| *(absent)* | Refuse with a `ReferenceError` naming the referents, if any exist. This is the path a script or a migration takes. |
| `remove-references` | Delete the referencing Requirements, then the entity — one logical operation. |
| `reassign` | Validate `reassignTo`, then for every referencing Requirement: repoint its `origin`/`assetId`, mark it `"stale"`, recalculate it, and only then delete the entity. A `reassignTo` that is missing, self-referencing, resolves to nothing, or (for an Asset) is not of `area` kind is a `ValidationError` and nothing is written. |
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
worth being exact about: `calculatedFrom` records the `zoneArea` and `unitCost` a figure
was produced from, so a panel loading a reassigned Requirement compares them against its
*new* target, finds a mismatch, and reports `"stale"` — one of the two guarantees already
holds. The other two do not. The persisted marker still reads `"current"`, which is the
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

The gap is recorded in `docs/issues/Zone-less requirements have no in-plugin surface.md`
rather than closed with a query nothing calls.

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
0. Validate the resolution's own input (`reassignTo` resolves, is not the entity being
   deleted, and for an Asset is of `area` kind) — before any write, so a rejected
   reassignment has nothing to compensate.
1. Read every referencing Requirement in full → `affectedBefore` snapshot.
2. Apply the resolution to each in turn, recording which have been written. For
   `reassign` that is more than one write per Requirement — repoint + markStale, then a
   recalculation whose failure is logged and left stale rather than aborting the
   sequence — and the snapshot covers all of them, since it is the whole entity as it
   was before any of this ran.
3. Delete the entity.
4. On any failure in 2 or 3: restore every Requirement already written, from
   `affectedBefore`, then return the error. A failing compensation is logged through
   the `Logger` (slice 1's port, slice 11's rules) rather than swallowed — the
   repository cannot promise multi-file atomicity and does not pretend to.
5. On success, return `affectedBefore` in the command's payload. It is not
   bookkeeping: it is what makes the delete undoable (see below).
```

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
  affectedBefore: readonly Requirement[]; // full pre-resolution state, for undo
};
```

`reassignTo` is where PRD §64's own gap shows through: it names "Reassign" as an action
but never says how a target is picked. Slice 15 is explicit that its dialog resolves
*that* the user chose Reassign and carries no target. Sourcing one is a follow-up step
the caller performs before dispatching — a second picker — and neither the SDD nor the
PRD specifies it, so this slice defines the command's contract for receiving a target
without designing the UI that supplies it.

What the command does **not** delegate to that unbuilt picker is validating what it is
handed. An Asset `reassignTo` goes through the same `UNIT_KIND` area check
`AssignAssetCommand` applies, for the identical reason: a Zone's area is not an identity
input for a `piece` or `hour` Asset, and a rule enforced on one of the two paths that can
create the link is a rule a user reaches around by deleting an Asset instead of assigning
one. Both paths read the same map rather than each comparing against a literal `'m2'`.

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
interface AssetRepository {
  getById(id: AssetId): Promise<Result<Asset | null, PersistenceError>>;
  save(asset: Asset): Promise<Result<void, PersistenceError | ValidationError>>;
  delete(id: AssetId): Promise<Result<void, PersistenceError>>;
  listByProject(projectId: ProjectId): Promise<Result<Asset[], PersistenceError>>;
}

interface RequirementRepository {
  getById(id: RequirementId): Promise<Result<Requirement | null, PersistenceError>>;
  save(requirement: Requirement): Promise<Result<void, PersistenceError | ValidationError>>;
  delete(id: RequirementId): Promise<Result<void, PersistenceError>>;
  listByZone(zoneId: ZoneId): Promise<Result<Requirement[], PersistenceError>>;
  listByAsset(assetId: AssetId): Promise<Result<Requirement[], PersistenceError>>;
  // Sets recalculationStatus: "stale" and persists it — one targeted-property
  // write, not a full save() of a (possibly not-yet-recalculated) Requirement.
  markStale(id: RequirementId): Promise<Result<void, PersistenceError>>;
}

// application/commands/asset
interface CreateAssetInput { projectId: ProjectId; name: string; category: AssetCategory;
  unit: MeasurementUnit; unitCost: Money; wasteFactorDefault?: Decimal; supplier?: string; sku?: string; notes?: string; }
type CreateAssetCommand = Command<CreateAssetInput, Result<Asset, ValidationError | PersistenceError>>;

// application/commands/requirement — every command's error union includes
// PersistenceError: each calls AssetRepository/RequirementRepository, whose reads and
// writes alike can fail (see the ports above), and per Slice 3's rule that a Result
// must be inspected and returned, not discarded, before publishing any event or
// reporting success.
interface AssignAssetInput { zoneId: ZoneId; assetId: AssetId; }
type AssignAssetCommand = Command<AssignAssetInput, Result<Requirement, ValidationError | DomainError | ReferenceError | PersistenceError>>;
// idempotent: if a Requirement already links this (zoneId, assetId), returns the existing one;
// ValidationError if the Asset's unit is not "m2" — see "The derivation pipeline" above

// application/commands/requirement/ReversibleAssignAssetCommand.ts — the adapter the
// Inspector's "Assign Asset" control actually dispatches. PRD §68 names
// AssignAssetCommand undoable, and the Inspector commit path is CommandHistory.run()
// (slice 6), which takes an UndoableCommand: a plain Command cannot be dispatched
// there at all. Same family as slice 8's ReversibleCreateZoneCommand, and it lives
// beside the command it wraps for the same reason — undo and redo both need the
// repository, not just the plain command.
class ReversibleAssignAssetCommand implements UndoableCommand {
  constructor(
    private readonly assignCommand: Command<AssignAssetInput, Result<Requirement, ValidationError | DomainError | ReferenceError | PersistenceError>>,
    private readonly requirementRepository: RequirementRepository,
    private readonly input: AssignAssetInput,
  );
  // First call dispatches assignCommand and records BOTH the Requirement and whether
  // this call created it or found an existing one — AssignAssetCommand is idempotent,
  // so the two are indistinguishable from its payload alone, and an undo that deleted
  // a pre-existing Requirement would destroy a link (and its overrides) the user never
  // made in this gesture. Every later call (i.e. redo) re-saves the recorded snapshot
  // under its original ID instead of re-assigning, so the ID survives undo/redo.
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;   // deletes only what execute() created; a
                                             // no-op when it found one already there
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
function ListAssets(projectId: ProjectId): Promise<Result<Asset[], PersistenceError>>;
function CountRequirementsReferencing(
  target: { kind: 'zone'; zoneId: ZoneId } | { kind: 'asset'; assetId: AssetId },
): Promise<Result<number, PersistenceError>>;
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

New Vault folders (already named in PRD §36): `Assets/`, `Requirements/`.
Both are note-based entities per PRD §37, following slice 4's
Markdown-frontmatter-plus-Zod-schema pattern with `schema-version: 1`. Neither
owns a geometry sidecar — Requirement references a Zone by ID rather than
storing geometry (§3.6).

```yaml
# Assets/Porcelain Terrace Tile.md
---
type: renovation-asset
schema-version: 1

id: asset-01JDEF7Q3K
project: project-01HABC

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

`calculated-from-area` and `calculated-from-unit-cost` are the same argument carried one
step further: they record the two inputs that live outside this note, so a reader can
tell that the stored figures are obsolete even when the marker never got written (see
"The marker cannot be the only thing holding that guarantee" above). They are written
only by `RecalculateRequirementCommand`, in the same save as the figures they explain,
and they are decimals-as-quoted-strings for the same ADR-010 reason as everything else
in this block.

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
  one. A test publishes `ZoneGeometryChanged` directly on an
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
  reload test distinguishes the two. `calculated-from-area` and
  `calculated-from-unit-cost` round-trip in the same test, as quoted decimals — they
  are what keeps that reading honest when the marker write is the thing that failed.
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
- [ ] Asset and Requirement notes persist under `Assets/` and `Requirements/`
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
- [ ] `ReversibleAssignAssetCommand` is what the Inspector dispatches: undo removes a
      Requirement this gesture created, redo restores it under the same
      `RequirementId`, and undo on the idempotent path — where the Requirement already
      existed — deletes nothing and preserves its overrides.
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
- [ ] `reassign` with a `reassignTo` that is missing, self-referencing, unresolvable, or
      an Asset whose unit is not of `area` kind resolves a `ValidationError`, writes
      nothing, and deletes nothing — the unit check reading slice 9's `UNIT_KIND`, the
      same map `AssignAssetCommand` reads, so the two paths that can create a link cannot
      disagree about what a valid one is.
- [ ] Both override fields dispatch their reversible adapter through
      `CommandHistory.run()` — no plain override command reaches the panel — and undo
      restores the full pre-edit Requirement in each of the three cases that differ:
      overriding a calculated figure (undo → `null`), changing an existing override
      (undo → the earlier number), and resetting to calculated (undo → the number that was
      cleared). The third is the one an adapter treating `null` as "nothing to restore"
      fails while passing the first two, and the comparison covers `estimatedCost` as well
      as the field edited, since a quantity override rewrites both.
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

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

## Dependencies

| Slice | What this slice takes from it |
| --- | --- |
| 2 — Core Primitives | `Polygon.area()`, `Result<T, E>`, identity/ID scheme, Event Bus base |
| 3 — Domain Foundation | The entity/command/event module pattern, applied to Zone; `ZoneId`, `ProjectId` |
| 4 — Persistence & Repository | Repository interface shape, Markdown↔DTO↔domain mapping, Zod schema pattern, Project Index |
| 6 — Editor Tool Framework, Undo/Redo & Inspector | Command dispatch from UI, `UndoableCommand`, Inspector Query → DTO → Vue pattern |
| 8 — Zone Editing | The concrete commands that mutate a Zone's geometry and emit `ZoneGeometryChanged` |
| 9 — Quantity & Cost Engine | `Money`, `DerivedValue<T>`, the Quantity Engine pipeline, the Cost Pipeline |

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
  unit: Unit;                      // "piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed" — SDD §48
  unitCost: Money;                 // ADR-010
  wasteFactorDefault: number;      // 0..1, default 0
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
  unit: Unit;                           // copied from Asset.unit at creation
  wasteFactor: number;                  // 0..1, defaulted from Asset.wasteFactorDefault, editable per-requirement
  quantity: DerivedValue<number>;       // "calculated quantity" + "manual override"
  estimatedCost: DerivedValue<Money>;
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
        ↓ Polygon.area()             ← slice 2
Measured Quantity (mm² → Asset.unit) ← slice 9 unit conversion
        ↓ Requirement Rule = area (identity for area/length/volume-based assets)
Required Quantity
        ↓ × (1 + Requirement.wasteFactor)
Purchase Quantity  ==  Requirement.quantity.calculated
```

and SDD §51's Cost Pipeline, with discount/shipping/tax as no-op stages this
slice does not populate:

```text
Requirement.quantity effective (override ?? calculated)
        ↓ × Asset.unitCost
Estimated Cost  ==  Requirement.estimatedCost.calculated
```

Piece/hour/day/fixed-unit assets structurally pass through the same engine
(slice 9 already supports all seven units) but have no geometry-derived
Requirement Rule wired in this slice — a piece-count Requirement would need a
manual quantity, which is future work, not this slice's success criterion.

### Event cascade

Slice 8's geometry-mutating commands (SDD §29's `MoveSpatialObjectCommand` /
`ResizeSpatialObjectCommand` pattern, applied to Zone) already emit
`ZoneGeometryChanged` after a successful save (§34). This slice adds one
application-layer event handler that reacts to it:

```typescript
// application/event-handlers/requirement/onZoneGeometryChanged.ts
eventBus.subscribe("ZoneGeometryChanged", async (event: ZoneGeometryChanged) => {
  const requirements = await requirementRepository.listByZone(event.zoneId);
  for (const requirement of requirements) {
    eventBus.publish(new RequirementInvalidated(requirement.id));
    await recalculateRequirement.execute({ requirementId: requirement.id });
  }
});
```

`RecalculateRequirementCommand` (named in SDD §29) re-fetches the current Zone
and Asset, re-runs the pipeline above, saves the Requirement, and publishes
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
that changed the Zone's geometry. `RequirementInvalidated` is therefore never
observed at rest — no persisted `status: "stale"` field exists; it is a
transient signal only (useful for a UI "recalculating…" affordance), and
staying out of persisted state is deliberate, not an oversight (Progressive
Complexity, §3.7).

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
their own commands.

### Inspector integration

The Inspector already resolves `Selection → Inspector Query → Inspector DTO →
Vue UI` (§59). This slice adds a Requirements panel to a Zone's inspector view,
backed by one new query and reusing the asset catalog:

```typescript
function GetRequirementsForZone(zoneId: ZoneId): Promise<RequirementInspectorDTO[]>;
function ListAssets(projectId: ProjectId): Promise<Asset[]>; // populates the "assign asset" picker

interface RequirementInspectorDTO {
  requirementId: RequirementId;
  assetId: AssetId;
  assetName: string;
  unit: Unit;
  wasteFactor: number;
  quantity: { calculated: number; override: number | null; effective: number };
  cost: { calculated: Money; override: Money | null; effective: Money };
}
```

For the selected Zone, the panel lists one row per Requirement: Asset name,
effective quantity (with a visible "overridden" badge and the calculated
figure still shown when `override !== null`), and effective cost (same
treatment). An "Assign Asset" control dispatches `AssignAssetCommand`; a cost
field with a "reset to calculated" affordance dispatches
`SetRequirementCostOverrideCommand`. Edits become commands, per §59 — the
Inspector never writes to a Requirement directly.

### Deletion & reference integrity

Deleting a Zone or an Asset that a Requirement still references must not
silently cascade-delete the Requirement (PRD §63–64). `DeleteZoneCommand`
(slice 8) and `DeleteAssetCommand` (this slice) both check
`requirementRepository.listByZone`/`listByAsset` first and surface the
reference count through the same Cancel/Remove-References/Reassign/Delete-Anyway
flow PRD §64 describes for every entity — no new mechanism, just this slice's
entities participating in it.

## Interfaces & Contracts

```typescript
// core, from slice 9 — consumed, not redefined here
type Unit = "piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed";
interface Money { readonly amount: Decimal; readonly currency: string; }
interface DerivedValue<T> { readonly calculated: T; readonly override?: T; }
function effective<T>(v: DerivedValue<T>): T { return v.override ?? v.calculated; }

// domain/asset
interface AssetRepository {
  getById(id: AssetId): Promise<Asset | null>;
  save(asset: Asset): Promise<void>;
  delete(id: AssetId): Promise<void>;
  listByProject(projectId: ProjectId): Promise<Asset[]>;
}

// domain/requirement
interface RequirementRepository {
  getById(id: RequirementId): Promise<Requirement | null>;
  save(requirement: Requirement): Promise<void>;
  delete(id: RequirementId): Promise<void>;
  listByZone(zoneId: ZoneId): Promise<Requirement[]>;
  listByAsset(assetId: AssetId): Promise<Requirement[]>;
}

// application/commands/asset
interface CreateAssetInput { projectId: ProjectId; name: string; category: AssetCategory;
  unit: Unit; unitCost: Money; wasteFactorDefault?: number; supplier?: string; sku?: string; notes?: string; }
type CreateAssetCommand = Command<CreateAssetInput, Result<Asset, ValidationError>>;

// application/commands/requirement
interface AssignAssetInput { zoneId: ZoneId; assetId: AssetId; }
type AssignAssetCommand = Command<AssignAssetInput, Result<Requirement, DomainError>>;
// idempotent: if a Requirement already links this (zoneId, assetId), returns the existing one

interface RecalculateRequirementInput { requirementId: RequirementId; }
type RecalculateRequirementCommand = Command<RecalculateRequirementInput, Result<Requirement, CalculationError>>;

interface SetRequirementQuantityOverrideInput { requirementId: RequirementId; quantity: number | null; }
type SetRequirementQuantityOverrideCommand = Command<SetRequirementQuantityOverrideInput, Result<Requirement, DomainError>>;

interface SetRequirementCostOverrideInput { requirementId: RequirementId; cost: Money | null; }
type SetRequirementCostOverrideCommand = Command<SetRequirementCostOverrideInput, Result<Requirement, DomainError>>;

// application/queries
function GetRequirementsForZone(zoneId: ZoneId): Promise<RequirementInspectorDTO[]>;
function ListAssets(projectId: ProjectId): Promise<Asset[]>;
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
├── UpdateAsset.ts                     ├── RecalculateRequirement.ts
└── DeleteAsset.ts                     ├── SetRequirementQuantityOverride.ts
                                       ├── SetRequirementCostOverride.ts
                                       └── DeleteRequirement.ts

application/event-handlers/requirement/
├── onZoneGeometryChanged.ts    (→ RequirementInvalidated → RecalculateRequirement)
└── onRequirementRecalculated.ts (→ Cost Pipeline → CostEstimateChanged)
```

Domain events this slice adds to §34's catalog: `AssetCreated`, `AssetUpdated`,
`AssetDeleted`, `RequirementCreated`, `RequirementInvalidated`,
`RequirementRecalculated`, `CostEstimateChanged`.

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
unit-cost: 45.00
currency: EUR
waste-factor-default: 0.10
---

Grey outdoor porcelain, 20mm, slip-rated.
```

```yaml
# Requirements/Bathroom - Porcelain Terrace Tile.md
---
type: renovation-requirement
schema-version: 1

id: requirement-01JG2K9F4M
project: project-01HABC
asset: asset-01JDEF7Q3K
origin-kind: zone
origin-zone: zone-01HXYZ

unit: m2
waste-factor: 0.10

quantity-calculated: 13.2
quantity-override: null

cost-calculated: 594.00
cost-override: 550.00
currency: EUR

required-date: null
---
```

Both `*-calculated` fields are persisted deliberately (not recomputed on every
load) — this is the exception §3.6 itself names: values needed "for overrides
or historical snapshots." Reading either note outside Obsidian still shows a
meaningful last-known figure (SDD §92 #7).

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
  `wasteFactor` in `[0, 1)`, category is one of the seven allowed values).
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
  (zone, asset) pair. A test publishes `ZoneGeometryChanged` directly on an
  in-memory Event Bus and asserts the full cascade fires in order —
  `RequirementInvalidated` → `RequirementRecalculated` → `CostEstimateChanged`
  — exactly once each, with the Requirement's persisted `calculated` values
  updated. Separate tests confirm `SetRequirementQuantityOverrideCommand` and
  `SetRequirementCostOverrideCommand` each publish `CostEstimateChanged` only
  when the effective cost actually changes.
- **Repository contract (§72).** A shared `AssetRepository` and
  `RequirementRepository` contract suite runs against both in-memory and
  Obsidian implementations: round-trip through the Markdown mapping, and
  rejection of malformed frontmatter (negative `unit-cost`, unknown
  `category`, an `origin-zone` that doesn't parse as an ID) before it reaches
  the domain (§43).
- **Vue component (§73).** The Inspector's Requirements panel: renders
  calculated values with no badge when no override is set; renders the
  override with a distinct visual treatment and still shows the calculated
  value for comparison when one is set (§52); the "assign asset" picker
  dispatches `AssignAssetCommand`; the cost field's reset control dispatches
  `SetRequirementCostOverrideCommand(..., null)`.
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
- [ ] The event chain `ZoneGeometryChanged → RequirementInvalidated →
      RequirementRecalculated → CostEstimateChanged` is covered by an
      application-layer test asserting event order (§32, §71).
- [ ] Both `Requirement.quantity` and `Requirement.estimatedCost` are
      `DerivedValue<T>`, and the Inspector visibly distinguishes calculated
      from overridden for each independently (§52).
- [ ] Undoing the Zone-geometry command that triggered a recalculation also
      restores the Requirement's prior calculated quantity and cost, without
      a separate undo-history entry for the Requirement itself (§30–31).
- [ ] Deleting a Zone or Asset with a live Requirement surfaces the
      reference-integrity flow (PRD §63–64) instead of cascading silently.
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
   `quantity.calculated = 10.0 × 1.10 = 11.0 m²`, then the Cost Pipeline:
   `estimatedCost.calculated = 11.0 × 45.00 = 495.00 EUR`. The Inspector shows
   **11.0 m² / 495.00 EUR**, both marked calculated.
4. Edit the Zone's polygon (slice 8) so its area becomes **12.0 m²** and
   commit the change. `ZoneGeometryChanged` fires → `RequirementInvalidated`
   → recalculation → `quantity.calculated = 12.0 × 1.10 = 13.2 m²` →
   `estimatedCost.calculated = 13.2 × 45.00 = 594.00 EUR` → `CostEstimateChanged`.
   The still-open Inspector reactively updates to **13.2 m² / 594.00 EUR**
   without being reopened.
5. Override the cost to **550.00 EUR** (a negotiated price). The Inspector
   dispatches `SetRequirementCostOverrideCommand`; `estimatedCost.override =
   550.00`; `CostEstimateChanged` fires again. The Inspector now shows
   **550.00 EUR**, badged as overridden, with 594.00 EUR still visible as the
   underlying calculated figure.
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

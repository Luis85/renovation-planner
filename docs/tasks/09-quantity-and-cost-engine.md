---
type: Task
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 10
dependsOn:
  - "[[02-core-primitives]]"
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
# Design Slice 9: Quantity & Cost Engine

## Purpose

Deliver the Quantity Engine and Cost Pipeline as a pure, framework-free computational
core: given a raw geometric measurement (a number with a unit), compute a purchase
quantity and an estimated cost using decimal arithmetic — never native floats — throughout.

This is its own bounded slice because it has no dependency on any renovation domain
entity. It does not know what a Zone, an Asset, or a Requirement is — it consumes plain
`Quantity`/`Money` values and returns plain `Quantity`/`Money` values. That
independence is deliberate and load-bearing: SDD §8 names `Cost Engine → Pinia` as an
explicitly *invalid* dependency, and §48 calls the Cost Engine an "independent domain
service." Building it before slice 10 (which wires it to Zone/Asset/Requirement) means
the arithmetic is proven correct — with decimal.js, not native floats — before any
domain or UI code depends on it.

It delivers the calculation half of Increment 7 (SDD §91): "area-based requirement
calculation, unit price, estimated cost." Slice 10 delivers the other half — the Asset
and Requirement entities, and the `Zone Geometry → Area → Requirement → Cost` wiring.

## Scope

### In scope

- The `Money` value type and decimal-based arithmetic (add, multiply, percentage,
  rounding, currency-safety checks) — SDD §49, ADR-010.
- The two unit vocabularies: `UnitKind` (SDD §48's seven dimensions: piece, length,
  area, volume, hour, day, fixed) and `MeasurementUnit` (the concrete symbol a price and
  a quantity are expressed in), plus the mapping between them.
- The Quantity Engine pipeline: Geometry → Measured Quantity → Requirement Rule →
  Required Quantity → Waste → Purchase Quantity — SDD §50.
- The Cost Pipeline: Requirement (quantity) → Unit Price → Discount → Shipping → Tax →
  Estimated Cost — SDD §51, as a pure function composition over `Money`.
- The `DerivedValue<T>` generic type, the `override ?? calculated` effective-value
  rule, and the constraint that engine output must expose enough structure for a
  later-built UI to distinguish calculated from overridden values — SDD §52.
- Typed, non-throwing failure handling for expected calculation failures (currency
  mismatch, division by zero coverage rate, negative quantity) via
  `Result<T, CalculationError>` — SDD §64–65.
- Packaging/lot-size rounding as a pure function parameter (`PackagingRule`), since SDD
  §70 lists "packaging" as a required Quantity unit test — the pipeline must accept and
  apply a lot size, even before any real material catalog exists to supply one.

### Out of scope (covered by other slices)

- The `Asset`, `Requirement`, and `CostItem` domain entities, and how a real
  Requirement's rule/waste/packaging configuration is read and passed into this engine
  — slice 10.
- How a `Measured Quantity` is obtained from an actual drawn Zone polygon (that's
  `core/geometry` area/perimeter operations plus the Zone entity) — slices 3 and 8.
  This slice starts from a plain geometry measurement, not a Zone.
- Sourcing real unit prices, discount rules, shipping costs, or packaging lot sizes
  from a material/supplier catalog — no such catalog exists yet; that is a slice 10 (or
  later, Suppliers/Quotes epic) wiring concern. This slice only guarantees the pipeline
  *accepts* those values and computes correctly once supplied.
- Rendering `DerivedValue<T>` in the Inspector, or the UI affordance for entering an
  override — slice 6 (Inspector) and later feature work. This slice only guarantees
  the data shape supports it.
- Persisting computed costs or overrides to the Vault — slice 4 / slice 10.

## Dependencies

- Slice 2 (Core Primitives) — the `core/` module skeleton, the `Result<T,E>` pattern,
  and the shared error hierarchy (in particular `CalculationError`) are assumed to
  already exist.
- ADR-010 (Decimal Money Arithmetic) — `decimal.js`, `Money { amount, currency }`.
- ADR-006 (Plain TypeScript Domain) — this engine has zero Obsidian/Vue/Konva imports.
- ADR-009 (World Coordinates in Millimeters) — geometry measurements arrive in
  millimeters/mm²; this slice owns the conversion to display/pricing units (m, m²).
- No dependency on slices 3–8: no Zone, Plan, or Inspector code is required to build or
  test this slice.

### Carried forward from the slice 8 review pass (2026-08-25)

A code review of merged slice 8 changed things this slice builds on. Each is a
pitfall that was already shipped once, not a hypothetical.

- **One spelling of "is this negative": `lessThan(0)`, never `Decimal.isNegative()`.**
  decimal.js reports negative ZERO as negative, so `new Decimal(0).mul(-1)` was refused
  as a negative rate. `quantityEngine.negativeQuantity` already knew this and wrote it
  down; `costPipeline.negativePercent`, `applyWaste` and `applyRequirementRule`'s
  coverage-rate guard did not, so one directory held two answers to one question. All of
  them use `lessThan(0)` now, and every stage this slice adds must too — the difference
  only ever shows on a value a user could legitimately supply.
- **The Inspector already converts mm2 to m2, and it is a SECOND owner of a conversion
  this slice defines.** `InspectorPanel.vue` does `areaMm2 / 1_000_000` in binary float
  with a hard-coded unit label, against an `InspectorDto` that carries a raw storage unit
  into a template. `toDisplayValue` dispatches on `MeasurementUnit` with `Decimal`
  precisely so a second area unit is one case in one switch — and `MeasurementUnit`
  already names `ft2` as the anticipated one. The day it lands, the domain switch grows a
  case and that template keeps dividing by a million. **This was deliberately NOT fixed in
  the review pass**: the fix is to make `GetZoneInspector` hand back a `Quantity` (value +
  unit) so the panel formats and does not convert, which is this slice's boundary to move
  rather than a polish edit. `docs/requirements/Switch the measurement unit in the plan
  editor.md` makes it load-bearing rather than tidy.
- **`PlanDto` carries `calibration` now.** The presentation layer can read a plan's real
  scale, which is what turns a raw millimetre measurement into a trustworthy one.

## Design

### Module placement

```text
core/
├── money/        ← Money type, decimal arithmetic, rounding, currency safety
├── units/        ← UnitKind, MeasurementUnit, Quantity, mm→display-unit conversion
│                    (added alongside slice 2's WorldUnit.ts, which stays untouched)
└── derived/      ← DerivedValue<T> and effectiveValue<T> (new folder, see below)

domain/
└── cost/         ← QuantityEngine, CostPipeline (pure domain services;
                     depend only on core/, per the layer dependency rule)
```

`Money` and `UnitKind` are generic technical concepts (Core Layer, SDD §7.1) — nothing
about them is renovation-specific. The Quantity Engine and Cost Pipeline *are*
domain-specific business rules (waste factors, requirement rules, discount/tax
ordering), so they live in `domain/cost/` per §7.2, as a domain service with no
entities of its own. `DerivedValue<T>` is placed in `core/` rather than `domain/cost/` because it is not
cost-specific — it is a generic calculated-vs-overridden wrapper that later feature work
(schedule estimates, quote comparisons) is expected to reuse. It gets its own
`core/derived/` folder rather than joining `core/result/`: it is not a `Result`, shares
none of its constructors or guards, and filing it there would make "what is in
`core/result/`" a question with two answers.

### Money

`Money` is never a raw `number`. Every arithmetic operation is a pure function over
`decimal.js` `Decimal` values, exposed only through the `Money` module — call sites
never import `decimal.js` directly or call `Number()` on an `amount`.

```text
Money.of(value, currency)        → construct (from string, to avoid float parsing loss)
Money.zero(currency)             → additive identity
add(a: Money, b: Money)          → Result<Money, CalculationError>  (currency must match)
subtract(a: Money, b: Money)     → Result<Money, CalculationError>
scale(a: Money, factor: Decimal) → Money                             (unit price × quantity)
percentageOf(a: Money, pct: Decimal) → Money   (a × pct/100 — the PART, not the total)
round(a: Money)                  → Money  (to the currency's minor-unit precision)
compare(a: Money, b: Money)      → Result<-1 | 0 | 1, CalculationError>
```

Rules:

- `add`/`subtract`/`compare` on mismatched currencies resolve `err(calculationError(…))`
  — never silently coerced, never `NaN`.
- **A `Money` is SIGNED, and `subtract` answers a negative difference as a value.** The
  `Result` on `add`/`subtract`/`compare` is for the currency mismatch and nothing else.
  This is recorded here because it was briefly the opposite: a review pass after this
  slice shipped made `Money` non-negative at both doors and reported a negative difference
  as `money.negative-result`, and that was reversed. It answered a real defect — `subtract`
  minted an amount `createMoney` refused to read back — by narrowing the producer when the
  reader was the wrong half, and it made the important case an error, since
  [`Reporting and project cockpit.md`](../requirements/Reporting%20and%20project%20cockpit.md)'s
  "am I over budget" is a difference whose sign is the answer. What survives is the
  round-trip property: **anything the module produces, `createMoney` reads back**, now over
  the signed set, with a signed ZERO the one spelling both doors refuse.
- **Non-negativity is a per-FIELD rule, enforced where the field is validated.** A unit
  price, a shipping charge and a surcharge are refused below zero on `computeEstimatedCost`'s
  input (`cost.negative-amount`), beside the negative quantity and the discount bound; a
  `Project`'s `budget` and `contingency` are refused by `Project.create`
  (`project.negative-amount`). Slice 10's `unitCost >= 0` and slice 16's form rules are the
  same shape and were always written that way. So the pipeline still cannot produce a
  negative estimate — that is a guarantee over ITS inputs, not a property of the value type.
- **Rounding mode is `ROUND_HALF_UP`, applied once where a `Money` value is finalized as
  pipeline output** — here, the final `Estimated Cost` step; see **Definition of Done**
  for a worked example. Both halves are **ADR-010's** decision, not this slice's, and
  the ADR carries the reasoning and the rejected alternative (`ROUND_HALF_EVEN`). An
  earlier version of this document was the only place either was written down, which
  made a decision with consequences findable only by whoever already knew which slice to
  open — while ADR-010 restated SDD §49 without deciding anything.
- What this slice adds is the application: intermediate pipeline values are never
  rounded to the currency's minor unit between stages, so waste/discount/tax stacking
  cannot compound *that* rounding error one step at a time — the currency's minor unit
  (2 decimal places for USD/EUR) is what "finalized" rounds to, once, at the end. That is
  narrower than "full `decimal.js` precision", which an earlier version of this bullet
  claimed and which decimal.js does not provide: every operation still rounds to a
  configured number of significant digits — `MONEY_PRECISION` on `core/money/Money.ts`'s
  private `Decimal.clone`, set to 34 (IEEE 754 decimal128's precision). Wide enough that
  nothing in this slice's own worked example below comes near it, but not "full" in the
  sense that decimal.js never rounds at all — `tests/core/money/moneyArithmetic.test.ts`
  proves the residual with a 37-significant-digit exact product that does not survive.

### Unit kinds and Quantity

Two vocabularies, deliberately distinct, both defined here:

```typescript
// The DIMENSION — SDD §48's list, verbatim. What kind of thing is being counted.
type UnitKind = "piece" | "length" | "area" | "volume" | "hour" | "day" | "fixed";

// The concrete SYMBOL a quantity is expressed and priced in, and what an Asset
// persists (slice 10). Not in §48 — §48 gives dimensions, not units of measure —
// so this is this slice's own addition, named apart so the two cannot be confused.
type MeasurementUnit = "piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed";

const UNIT_KIND: Readonly<Record<MeasurementUnit, UnitKind>> = {
  piece: "piece", m: "length", m2: "area", m3: "volume",
  hour: "hour", day: "day", fixed: "fixed",
};

interface Quantity {
  readonly value: Decimal;
  readonly unit: MeasurementUnit;
}
```

Keeping both is what lets slice 10 state its rule as "a Zone's area is only a valid
input for an *area*-kind Asset" (`UNIT_KIND[asset.unit] === "area"`) rather than
hard-coding the string `"m2"` — a check that would silently stop working the day a
second area unit (`ft2`) is added.

`m`/`m2`/`m3` quantities entering this engine are already converted from the mm-based
world coordinate system (ADR-009, SDD §22–23) — that conversion is this engine's
responsibility, applied once, at the `Geometry → Measured Quantity` step. `piece`,
`hour`, `day`, and `fixed` pass through unconverted (`fixed` is a single lump-sum
quantity of 1).

### Quantity Engine pipeline (SDD §50)

Four pure, independently testable stages, composed in order:

```text
Geometry               (mm / mm², from core/geometry — out of this slice's scope)
   ↓  toMeasuredQuantity(raw, unit)
Measured Quantity       (Quantity, in display units)
   ↓  applyRequirementRule(measured, rule)
Required Quantity       (Quantity)
   ↓  applyWaste(required, wastePercent)
[intermediate — waste-adjusted Required Quantity]
   ↓  applyPackaging(wasted, packagingRule?)
Purchase Quantity       (Quantity)
```

- `RequirementRule` is a plain data/function shape — e.g. `{ coverageRate: Decimal }`
  meaning "1 unit of the asset covers `coverageRate` of the measured quantity's unit" —
  *not* the `Requirement` domain entity. Slice 10 reads a real `Requirement` entity's
  configuration and builds this plain rule to hand to the engine.
- `applyWaste(required, wastePercent)` multiplies by `1 + wastePercent / 100`.
  `wastePercent = 0` is the identity operation.
- `applyPackaging(quantity, packagingRule?)` is optional — the engine supports it
  structurally (per SDD §70's "packaging" unit test) but `packagingRule` may be
  `undefined` when no source material catalog exists yet to supply lot size / minimum
  order data (a slice 10+ concern). When present:
  `{ lotSize: Decimal, minimumOrder?: Decimal }` — purchase quantity rounds *up* to the
  next whole multiple of `lotSize`, then up again to `minimumOrder` if still below it.
  When absent, the wasted quantity passes through unchanged.

### Cost Pipeline (SDD §51)

```text
Requirement Quantity     (Purchase Quantity, from the Quantity Engine)
   ↓  scale(unitPrice, quantity.value)
Line Subtotal             (Money)
   ↓  subtract(subtotal, percentageOf(subtotal, discount?.percent ?? 0))
After Discount             (Money)
   ↓  add(afterDiscount, shipping ?? zero(currency))
After Shipping             (Money)
   ↓  add(afterShipping, surcharge ?? zero(currency))
After Surcharge            (Money)
   ↓  add(afterSurcharge, percentageOf(afterSurcharge, taxRate ?? 0))
   ↓  round(...)
Estimated Cost             (Money)
```

`percentageOf` returns the *part*, never the adjusted total — discount subtracts it, tax
adds it. One function that "applies a percentage" for both would need an unstated sign
convention, and getting that convention backwards produces a plausible number rather
than an error: the worked example below would come out as `$16.76` (the tax alone)
instead of `$219.88`, and nothing in the types would object.

`computeEstimatedCost(input): Result<DerivedValue<Money>, CalculationError>` is the
single exported entry point — a `DerivedValue`, not a bare `Money`, for the same reason
`runQuantityEngine` returns one: §52 requires the output to carry both sides so a UI can
distinguish calculated from overridden. The intermediate steps above are private
composition, not separately exported, so callers cannot skip stages or reorder them. Order is fixed by §51 and is
not configurable: tax is computed over the post-shipping total (shipping is taxable),
discount is computed before shipping is added (shipping is not discounted). `unitPrice`
must share `quantity.unit`'s pricing basis and `discount`/`shipping`/`surcharge`/`estimatedCost`
must share `unitPrice.currency`; a mismatch is a `CalculationError`, not a thrown
exception.

**`surcharge` is this pipeline's one addition to §51's stage list, and it is ADR-012's decision
rather than this slice's.** PRD §74 names six price components; §51 places three, which left
`surcharge` and `deposit` stored by the requirements and applied by nothing — the same shape of
omission ADR-010 closed for rounding, and with the same failure mode, since an additive term
placed before or after tax by whichever call site reaches it first produces a plausible number
rather than an error. ADR-012 puts a surcharge where shipping already is (additive, taxable, not
discountable), and places the other two components *outside* the chain: contingency is held beside
the estimate so the buffer stays reportable, and a deposit is a payment against a commitment
rather than a component of a price. So this pipeline reads `surcharge` and does not read
`contingency` or `deposit` — a placement in both cases, not an omission.

### DerivedValue<T> and manual overrides (SDD §52)

```typescript
interface DerivedValue<T> {
  readonly calculated: T;
  readonly override?: T;
}

function effectiveValue<T>(dv: DerivedValue<T>): T {
  return dv.override ?? dv.calculated;
}
```

Constraints this slice's output must satisfy (implementation of the override UI itself
is out of scope — see **Scope**):

- Every pipeline value a user could plausibly want to hand-adjust — Purchase Quantity,
  Unit Price, Estimated Cost — is produced wrapped in `DerivedValue<T>`, never as a bare
  `Quantity`/`Money`. The engine only ever writes `calculated`; nothing at this layer
  ever populates `override` (that is a user action, captured and persisted by slice 10
  and the Inspector built in slice 6).
- When a `DerivedValue<T>` feeds into a later pipeline stage as input (e.g. a
  user-overridden Purchase Quantity feeding the Cost Pipeline), the stage consumes its
  **effective value** (`override ?? calculated`), never `calculated` directly. This is
  how a single override at any point in the pipeline flows forward through every
  downstream stage without the engine needing to know an override happened.
- The output shape must carry enough information (both `calculated` and `override`,
  not just the resolved effective value) for a later-built UI to visibly distinguish
  the two — this slice guarantees the *data* supports that distinction; it does not
  render anything.

## Interfaces & Contracts

```typescript
// core/money
type CurrencyCode = string; // ISO 4217, e.g. "USD"

interface Money {
  readonly amount: Decimal;
  readonly currency: CurrencyCode;
}

function of(value: string | number | Decimal, currency: CurrencyCode): Money;
function zero(currency: CurrencyCode): Money;
function add(a: Money, b: Money): Result<Money, CalculationError>;
function subtract(a: Money, b: Money): Result<Money, CalculationError>;
function scale(a: Money, factor: Decimal): Money;
function percentageOf(a: Money, percent: Decimal): Money; // the part (a × pct/100), not the total
function round(a: Money): Money;
function compare(a: Money, b: Money): Result<-1 | 0 | 1, CalculationError>;

// core/units — two vocabularies, deliberately distinct (see Design → Unit kinds and Quantity)
type UnitKind = "piece" | "length" | "area" | "volume" | "hour" | "day" | "fixed";
type MeasurementUnit = "piece" | "m" | "m2" | "m3" | "hour" | "day" | "fixed";
const UNIT_KIND: Readonly<Record<MeasurementUnit, UnitKind>>;

interface Quantity {
  readonly value: Decimal;
  readonly unit: MeasurementUnit;
}

// core/derived (new in this slice — deliberately not core/result)
interface DerivedValue<T> {
  readonly calculated: T;
  readonly override?: T;
}
function effectiveValue<T>(dv: DerivedValue<T>): T;

// domain/cost — Quantity Engine
interface RequirementRule {
  readonly coverageRate: Decimal; // measured-quantity units covered per 1 purchase unit
}
interface PackagingRule {
  readonly lotSize: Decimal;
  readonly minimumOrder?: Decimal;
}

function toMeasuredQuantity(
  rawValue: Decimal,
  unit: MeasurementUnit
): Result<Quantity, CalculationError>;
function applyRequirementRule(
  measured: Quantity,
  rule: RequirementRule
): Result<Quantity, CalculationError>;
function applyWaste(
  required: Quantity,
  wastePercent: Decimal
): Result<Quantity, CalculationError>;
function applyPackaging(
  quantity: Quantity,
  packaging?: PackagingRule
): Result<Quantity, CalculationError>;

function runQuantityEngine(
  rawValue: Decimal,
  unit: MeasurementUnit,
  rule: RequirementRule,
  wastePercent: Decimal,
  packaging?: PackagingRule
): Result<DerivedValue<Quantity>, CalculationError>;

// domain/cost — Cost Pipeline
interface DiscountRule {
  readonly percent: Decimal;
}
interface CostPipelineInput {
  readonly quantity: Quantity; // effective Purchase Quantity
  readonly unitPrice: Money;
  readonly discount?: DiscountRule;
  readonly shipping?: Money;
  readonly surcharge?: Money; // ADR-012 — additive with shipping, before tax
  readonly taxRate?: Decimal; // percent
}

function computeEstimatedCost(
  input: CostPipelineInput
): Result<DerivedValue<Money>, CalculationError>;
```

**`toMeasuredQuantity` and `applyPackaging` deviate from the bare-`Quantity` return the
Definition of Done below was checked against**, and the two deviations have different
histories. `toMeasuredQuantity` was changed deliberately, after this slice shipped: it
was the one exported stage still able to hand back a negative `Quantity` — a corrupted or
negative raw measurement passed straight through — while `applyRequirementRule` and
`applyWaste` already refused one on the way in, so the "no exported stage returns a
negative `Quantity`" guarantee `quantityEngine.ts`'s own header now states held for every
door but this one. Wrapping it in `Result<Quantity, CalculationError>` was what closed it.
`applyPackaging`'s `Result` return, by contrast, was never a change — it was already the
shipped signature (it validates its own `PackagingRule`, rejecting a non-positive
`lotSize`/`minimumOrder` as `quantity.invalid-packaging`) when this document was first
written; the bare `Quantity` above was simply never corrected. Both checkmarks in the
Definition of Done still describe what they verified — the worked example, the currency
and negative-quantity guarantees — only the two literal return types shown above have
since moved to match the code they were meant to describe.

`CalculationError` is one of the categories already established in the shared error
model (SDD §64); this slice does not introduce a new error category.

**One question this pipeline does not answer, named so the rollup that inherits it can find
the answer.** This slice produces `Estimated Cost` and nothing else — `Actual`,
`Committed` and `Invoiced` are cost types it does not model. The PRD states two
disagreeing Forecast formulas over those types (PRD §28 against PRD §33), settled in
[`docs/entities/Cost item.md`](../entities/Cost%20item.md): `Committed` means *not yet
invoiced*, so a rollup summing commitments and actuals cannot count an invoiced commitment
twice. Nothing here has to act on that — there is one cost type — but the rollup is built
on this pipeline's output, and the entity that carries the cost type is where the decision
lives rather than whichever epic gets there first.

## Persistence Impact

None — this is a pure computational engine; slice 10 wires its output into persisted
`Requirement`/`CostItem` entities. Nothing in this slice reads or writes the Vault,
and no function here has a side effect.

## Testing Strategy

Every function in this slice is pure (`(input) → output`, no I/O, no framework), so the
entire test suite is unit tests over plain values — no in-memory repositories, no Vue
component harness, no Konva stage. This directly implements SDD §70's **Money** and
**Quantity** unit test groups:

- **Money**: addition, tax, discounts, rounding, currency safety.
  - Addition: `Money.of("0.10", "USD") + Money.of("0.20", "USD")` equals
    `Money.of("0.30", "USD")` exactly (assert on the decimal string/`.equals()`, never
    on a coerced `number` — this is the case that native float addition gets wrong).
  - Currency safety: `add(Money.of("10", "USD"), Money.of("10", "EUR"))` returns
    a `CalculationError` via `err(...)`, not a thrown exception and not silent USD/EUR
    mixing.
  - Rounding: boundary cases around `.005`/`.125` confirm `ROUND_HALF_UP` behavior
    deterministically (see worked example below).
- **Quantity**: length requirements, area requirements, waste, packaging, manual
  overrides.
  - Waste at `0%` is the identity function.
  - `applyPackaging` with no `PackagingRule` passes the quantity through unchanged
    (covers the "no catalog data yet" path slice 10 will exercise first).
  - `applyPackaging` with a lot size rounds up to the next whole lot and enforces a
    minimum order when both are supplied.
  - `effectiveValue` resolves to `override` when present, `calculated` otherwise, and a
    `DerivedValue` produced by `runQuantityEngine` feeds its effective value (not its
    `calculated` value) into `computeEstimatedCost` when a caller supplies an override.
- Assertions compare `Decimal`/`Money` values via their own `.equals()`/string
  representation — never via `===` or `toNumber()` — so a regression to native
  float arithmetic anywhere in the pipeline is caught by the test itself, not just by
  the worked examples below.

## Definition of Done

- [x] `Money.of("0.10","USD")` added to `Money.of("0.20","USD")` produces exactly
      `Money.of("0.30","USD")` — verified without ever converting to a native `number`
      mid-calculation (demonstrates the ADR-010 rationale: `0.1 + 0.2 !== 0.3` in
      native floats, but is exact here).
- [x] Adding `Money` values of different currencies resolves a `CalculationError` in
      every arithmetic function that takes two `Money` operands (add, subtract,
      compare).
- [x] End-to-end worked example, Quantity Engine → Cost Pipeline, produces the
      following exact values (all in `decimal.js`, asserted as such):
      - Geometry input: `12,345,678 mm²` → Measured Quantity: `12.345678 m²`.
      - Requirement Rule (1:1 coverage) → Required Quantity: `12.345678 m²`.
      - Waste `10%` → wasted quantity: `13.5802458 m²`.
      - Packaging (`lotSize = 2.5 m²`, no minimum) → Purchase Quantity:
        `15 m²` (`13.5802458 / 2.5 = 5.432...`, rounded up to 6 lots × 2.5).
      - Unit Price `$12.50/m²` → Line Subtotal: `$187.50`.
      - Discount `5%` → After Discount: `$178.125` (exact, not yet rounded to the minor
        unit).
      - Shipping `$25.00` flat → After Shipping: `$203.125`.
      - Tax `8.25%` → `$219.8828125`, rounded `ROUND_HALF_UP` to the currency's
        2 decimal places → **Estimated Cost: `$219.88`**.
- [x] Overriding the Purchase Quantity `DerivedValue` (e.g. `calculated: 15 m²`,
      `override: 18 m²`) changes the Cost Pipeline's result deterministically
      (`18 × $12.50 = $225.00` subtotal onward) — proving effective-value resolution
      flows forward through the pipeline, not just at the point of override.
- [x] `applyPackaging` with `packaging: undefined` returns the waste-adjusted quantity
      unchanged (no error, no silent default lot size).
- [x] `surcharge` omitted leaves the post-shipping total unchanged, and a supplied
      `surcharge` is added **before** tax is computed (ADR-012). Asserted with a case where
      the two orders differ, so a reordering cannot pass silently: on the worked example
      above, a `$25.00` surcharge gives `($203.125 + $25.00) × 1.0825 = $246.9453125`, while
      applying it after tax would give `$203.125 × 1.0825 + $25.00 = $244.8828125` — a
      `$2.0625` difference, which is the tax on the surcharge.
- [x] All SDD §70 Money and Quantity unit test bullets (addition, tax, discounts,
      rounding, currency safety, length requirements, area requirements, waste,
      packaging, manual overrides) have a corresponding passing `vitest` test.
- [x] No file under `core/money`, `core/units`, `core/derived`, or `domain/cost`
      imports from `obsidian`, `vue`, `pinia`, or `konva`. This needs no new check and
      no manual verification: slice 1 committed the per-directory
      `no-restricted-imports` bans for `core/**` and `domain/**` before any file existed
      to violate them, so `npm run lint` already fails on it. (A `grep` would be the
      wrong instrument anyway — it cannot see an import reached through a re-export.)

## References

- SDD §48 — Cost Engine (the seven `UnitKind` dimensions; `MeasurementUnit` is this
  slice's own addition on top, not sourced from §48)
- SDD §49 — Money
- SDD §50 — Quantity Engine
- SDD §51 — Cost Pipeline
- SDD §52 — Manual Overrides
- SDD §22 — Geometry Core (source of raw geometric measurements, out of this slice)
- SDD §23 — World Coordinate System (mm-based input this slice converts from)
- SDD §64 — Error Model (`CalculationError`)
- SDD §65 — Result Pattern (`Result<T,E>` for expected failures)
- SDD §70 — Unit Tests (Money, Quantity groups)
- SDD §91 — Increment 7: Assets & Requirements (calculation half of the success
  criteria; entity half is slice 10)
- ADR-006 — Plain TypeScript Domain
- ADR-009 — World Coordinates in Millimeters
- ADR-010 — Decimal Money Arithmetic

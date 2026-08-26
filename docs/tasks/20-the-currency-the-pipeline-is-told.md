---
type: Task
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 50
dependsOn:
  - "[[19-the-asset-catalogue-leaves-the-project]]"
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 20: The Currency the Pipeline Is Told, and the Per-Project Price Override

## Purpose

Slice 19 shares the [[Asset]] catalogue and closes with a hole it names rather than fills: an
EUR-priced asset can be assigned to a Zone in a GBP project, and the estimate that comes out is
arithmetically correct, denominated in EUR, and indistinguishable from a right answer.

This slice closes it, and it does so by executing a design somebody else already did.
[[The cost pipeline is told the currency it must produce]] is an Issue carrying a proposal, three
verified blockers, three withdrawn attempts, and an explicit *Revisit when*: **"the override
lands and a project can supply its own price for a shared definition."** That is this slice. The
Issue's own last line asks the question this slice must answer — whether a supplied override
*replaces* the proposed refusal or merely *satisfies* it.

It also closes [[Asset library]]'s open definition-of-done item: *"A project can record its own
price against a shared definition"* — which no slice has defined and which
[[Asset]] says outright is a slice question.

**Read the Issue before this document.** It records what was tried and withdrawn, and a reader
who does not know that will try the same three things in the same order.

## Scope

### In scope

- **`Project.currency`** — the first blocker, and a schema bump on `Project`.
- **`AssetPriceOverride`** — a per-(project, asset) entity, so a project can disagree with a
  shared price without editing it.
- **`CostPipelineInput.expectedCurrency`** and the refusal in `computeEstimatedCost`, settling
  the Issue's open sub-question of whether it is optional.
- **Currency in the derivation's provenance** — the second blocker: nothing today invalidates a
  Requirement when a project's currency changes.
- **A decision about a Requirement whose price cannot be denominated** — the third blocker:
  `Requirement.estimatedCost` is not optional, so such a Requirement has no value to be
  constructed with.
- The stated precedence between this override and `Requirement.estimatedCost.override`.
- The Inspector showing both overrides beside what each replaced (§89).

### Out of scope

- **Currency conversion.** Refused outright and elsewhere: this product has no exchange rate and
  no date to read one at. [[Asset]] records the refusal; nothing here reopens it.
- **`Quote` lines**, which are the V1 answer and would beat both overrides. [[Asset]] is explicit
  that the override is the MVP answer *because* a Quote is not one.
- Tax, discount and shipping components of the pipeline. They are §51's and are no-ops today.
- Supplier and Trade catalogues.

## Dependencies

Slice 19. The override is per-(project, asset) and is meaningless while an asset belongs to one
project; the currency question does not exist until a catalogue is shared.

## The three blockers, and how each is cleared

The Issue verified all three against the tree. They are restated here only as the work items they
become — the reasoning lives in the Issue and is not duplicated.

### 1. A `Project` has no currency

```yaml
# Project.md
currency: EUR
```

`Project.currency` as a required field with a default, ISO-4217-shaped (`/^[A-Z]{3}$/`, the
pattern `assetFrontmatter` already uses for `currency`). `LATEST_VERSIONS.project` goes to 2 with
a real migration step, and **this one is a real migration rather than a redefinition**, because
unlike slice 19's Asset schema the Project schema's shape is load-bearing for existing developer
vaults and the migration runner has never executed a non-empty chain in production. Its v1→v2
step supplies the plugin's default currency.

**Which means the plugin settings gain `defaultCurrency`** — §83 lists it under Plugin Settings
already, beside default units and default folders, and it is the value a new project starts from.
It is a default with a project counterpart, which is exactly the test
[[Settings and configuration]] states for which settings are defaults.

### 2. Nothing invalidates on a currency change

`CalculatedFrom` snapshots `zoneArea`, `unitCost` and `assetUnit`. `unitCost` is a `Money` and
carries a currency, so the provenance **already holds one** — what is missing is a comparison
against the project's.

`assetMatchesCalculatedFrom` is the one declaration of which fields the pipeline reads, and its
own comment says a pipeline that starts reading another field must add it there or the staleness
backstop stops working. This slice is that event twice over:

- The comparison takes the **effective** unit cost, not `asset.unitCost` — otherwise a Requirement
  under a price override reports a permanent false mismatch and reads `"stale"` forever.
- A `projectCurrency` field joins the snapshot, so a project whose currency changed leaves every
  Requirement in it reading `"stale"` on the next read, from the mismatch, exactly as an asset
  price change already does.

**The backstop is what does this work, not a subscriber.** There is no `ProjectUpdated` cascade
and this slice does not add one: the provenance comparison is a read-time check that survives a
reload and a discarded in-memory state, which is the property slice 10 chose it for. The narrow
claim: a currency change makes Requirements read `"stale"`, it does **not** recalculate them —
nothing is recalculated until something dispatches.

### 3. `Requirement.estimatedCost` is not optional

This is the blocker with no obvious answer, and the Issue deliberately leaves it open:
*"Refusing before creation, a missing/error estimate representation, and requiring the override up
front are all still on the table; naming an outcome here would be re-making the mistake this
Issue exists to record."*

**The decision this slice takes is: require the override up front, and refuse without it.**

`AssignAssetCommand` reads the effective unit cost — the project's override if one exists, the
asset's default otherwise. If its currency does not match the project's, the command refuses with
a `ValidationError` naming both currencies and creates nothing. No Requirement is constructed, so
`estimatedCost` never needs a value it cannot have, and `DerivedValue<Money>` does not change
shape.

Three reasons, and the third is the one that answers the Issue's *Revisit when*:

- It is the only one of the three options that changes no existing type. A missing/error estimate
  representation touches `DerivedValue`, the mapper, the DTO, the panel and every reader.
- The refusal is **actionable**: the user is told to set a price for this asset in this project,
  and there is now a place to do it. That was not true when the Issue was written, which is
  precisely why it could not decide.
- **A supplied override satisfies the refusal rather than replacing it.** The Issue asks which;
  this is the answer. The pipeline's check stands for every caller, and the override is how a
  project passes it.

**This is not the withdrawn "refuse at `AssignAssetCommand`" attempt, and the difference matters.**
That one was rejected because *a project's currency is a setting the user may change afterwards,
so the refusal sits on the wrong side of the fact it depends on.* It still would be, if it were
the only check. It is not: the pipeline's `expectedCurrency` is the invariant, blocker 2's
provenance field is what catches a currency changed later, and the command's refusal is a
**third** thing — early feedback at the moment a user acts, in front of a check that also holds
without it. The withdrawn version had the command as the sole guard.

## Design

### `expectedCurrency`, and whether it is optional

```ts
interface CostPipelineInput {
	readonly quantity: Quantity;
	readonly unitPrice: Money;
	readonly expectedCurrency: Currency;   // required
	readonly pricedPer?: MeasurementUnit;
	// … discount, shipping, surcharge, taxRate
}
```

**Required.** The Issue keeps both sides and says the question is only decidable once a Project
has a currency to require; this slice supplies one, so it decides.

`pricedPer?` is the optional precedent and the argument for symmetry, and it is the wrong
precedent here. `pricedPer` omitted means *no basis check runs* and the result is the same number
either way. `expectedCurrency` omitted would mean *no currency check runs* and the result is a
well-formed number that no later check distinguishes from a correct one — which is the exact
failure mode the mismatch rule exists to prevent. **An invariant a caller can omit is one a caller
can silently bypass**, and the cost of requiring it is one line at each call site.

The Issue notes the only callers today are `tests/domain/cost/costPipeline.test.ts`. That is still
true, plus `deriveRequirementFigures`, which is the one place slice 10 wires the pipeline to real
data — so "no production call site changes with it" is now false, and one does.

The refusal is a `CalculationError` raised **before any arithmetic**, so a mismatch cannot produce
a partially computed figure.

### `AssetPriceOverride`

A note per (project, asset), in the project's own folder — it is *work*, not catalogue, and
[[Work belongs to one project, catalogues belong to the vault]] puts every consequence of using a
shared definition in the project that raised it:

```yaml
# Renovation/Kitchen Refit/Asset Prices/Porcelain Terrace Tile.md
type: renovation-asset-price
schema-version: 1
id: assetprice-01JABC…
revision: 3
project: project-01JAB…
asset: asset-01JAB…
unit-cost: "39.50"
currency: EUR
```

An entity rather than a map on the Project note, and the reason is the codebase's own shape: every
persisted thing here is one note with an `id`, a `revision` and a conditional write. A map would
give the collection one revision for every entry, so two projects' concurrent price edits would
be one lost update — and `save` taking an `Expected` is checked *by the type*, which a map field
would quietly satisfy while meaning something weaker.

It follows the slice 3 module pattern exactly (entity, id, schema, errors, events, in-memory and
Obsidian repositories, one shared contract test), which is what slice 10 established the template
for and what makes this the cheap part of the slice.

**Uniqueness is on the pair.** Two override notes for one (project, asset) is a state nothing
structurally prevents — ids are ULIDs — so the repository's lookup is by pair and a second one is
a diagnostic plus last-writer-wins, the same shape `warnOnDuplicate` already uses for duplicate
ids in the index. Deliberately not a refusal: the notes are user-editable markdown, and refusing
to read a catalogue because a user duplicated a note is worse than reading one of them and saying
so.

### The precedence, stated once

There are two overrides on one figure and they are **not** on the same side of the derivation:

```text
effectiveUnitCost = priceOverride(project, asset)?.unitCost ?? asset.unitCost      ← an INPUT
effectiveCost     = requirement.estimatedCost.override
                    ?? f(quantity, effectiveUnitCost)                              ← the OUTPUT
```

The price override replaces an input, so it changes what `estimatedCost.calculated` *means*. The
requirement override replaces the output, so it wins over whatever the derivation produced. They
cannot conflict, because neither can express the other's question.

Both satisfy [[A manual override is stored as an override, beside what it replaced]] independently:
the shared default stays visible beside the project's price, and the calculated figure stays
visible beside the requirement's override.

**Which means the Inspector shows three numbers in the worst case**, and that is a stated design
requirement rather than something to discover while building the panel: the asset's shared
default, this project's price, and the requirement's own figure — each labelled with what it is
and which of them is in force.

### Where the override reaches the pipeline

`deriveRequirementFigures` takes `unitCost` today. It keeps taking exactly one, and the
*resolution* of which one happens above it, in `AssignAssetCommand` and
`RecalculateRequirementCommand` — the two callers slice 10 deliberately routed through one
derivation.

That is the seam that matters: **the derivation stays a pure function of the figures it is given**,
and the override is a lookup its callers perform. A derivation that reached for a repository would
be a second answer to "what does this Requirement cost", which is the defect shape this codebase
keeps deleting.

Both callers gain the `AssetPriceOverride` repository as a dependency. The Issue predicted this
and named it as a consequence worth stating *because an earlier draft claimed no new dependency
was needed, which made the design look cheaper than it is.*

### The cascade

`AssetPriceOverrideChanged` invalidates every Requirement **in that project** referencing that
asset — the same cascade `AssetUpdated` runs, narrowed by project. It reuses
`RecalculateRequirementCommand` and adds a subscriber, not a mechanism.

Narrowing by project is the whole difference and it is worth stating: an `AssetUpdated` cascade
touches every project, because the shared default changed for all of them. A price override
changed touches one.

## Interfaces & Contracts

```ts
// domain/project/Project.ts
readonly currency: Currency;

// domain/asset-price/AssetPriceOverride.ts — the slice 3 module pattern
export class AssetPriceOverride { readonly id; readonly projectId; readonly assetId; readonly unitCost: Money; }

// application/ports/AssetPriceOverrideRepository.ts
getForPair(projectId: ProjectId, assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>>;
listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>>;
save(o: AssetPriceOverride, expected: Expected): …
delete(id: AssetPriceOverrideId, expected: EntityVersion): …

// domain/cost/costPipeline.ts
readonly expectedCurrency: Currency;   // required — see the design section

// domain/requirement/Requirement.ts — provenance gains the second operand
interface CalculatedFrom { zoneArea; unitCost; assetUnit; projectCurrency: Currency; }
```

## Persistence Impact

- `Project` gains `currency:`, `LATEST_VERSIONS.project` → 2, with a real v1→v2 step.
- `Requirement` gains `project-currency` inside its persisted `calculated-from`,
  `LATEST_VERSIONS.requirement` → 2. Its v1→v2 step **cannot** invent the value — the project's
  currency at the time of the original calculation is not recoverable — so it writes the project's
  *current* currency, which makes every migrated Requirement read `"current"` rather than
  `"stale"`. **That is a deliberate under-report and it is named here**: the alternative is
  marking every existing Requirement stale on upgrade, which is a vault-wide false alarm about
  figures that are almost certainly right.
- New folder `Asset Prices/` inside the project folder, and a fifth entry in `ENTITY_TYPES`.

## Testing Strategy

- **The pipeline refusal** — a `CalculationError` before arithmetic, driven with a mismatched
  pair, asserting nothing was computed. And the passing direction, so the test is not green
  because the pipeline refuses everything.
- **`expectedCurrency` is required** — checked by the type, in
  `tests/presentation/editor/type-safety.test-d.ts`'s manner: an input omitting it must not
  compile. A `// @ts-expect-error` that goes unenforced is just a comment, so it lives in the one
  file `vue-tsc --noEmit` covers.
- **The override satisfies the refusal** — assign refuses, then a price override in the project's
  currency is created, then the same assign succeeds and the Requirement's `estimatedCost` is in
  the project's currency. This is the Issue's *Revisit when* question, asserted end to end.
- **The precedence** — a Requirement with both overrides live, asserting the requirement override
  is in force and that changing the price override moves `calculated` and not the effective
  figure. A test with only one override at a time passes against either precedence.
- **The staleness backstop, both new arms** — a Requirement under a price override reads
  `"current"` (the false-mismatch regression), and a Requirement whose project currency changed
  reads `"stale"` **after a reload**, since `projectCurrency` is only a backstop if it survives to
  disk. Slice 10's `assetUnit` criterion is the template and its lesson applies unchanged.
- **The narrowed cascade** — a price override changed in project A leaves project B's Requirements
  on the same asset untouched. A single-project fixture passes against a cascade that ignores the
  narrowing entirely.
- **The duplicate-pair diagnostic** — two override notes for one pair, asserting the `warn` call
  and that a price is still returned.
- **The Project migration** — a v1 note gaining the plugin's default currency.
- **The Requirement migration** — asserting the under-report above is what happens, because it is
  a decision and a test is what stops the next reader from "fixing" it.

**Coverage.** Branches are the metric to watch — 98.02 against a floor of 98, about 0.4 of a
branch of headroom. This slice is branch-heavy: the `??` in `effectiveUnitCost`, the pipeline
refusal's two sides, the command refusal's two sides, the duplicate-pair fork, and two migration
steps. **This is the slice most likely to fail the coverage gate**, and the mitigation is that
every one of those arms is named above and has a test beside it in the same commit. Plan the test
with the code.

## Staying green

1. **`Project.currency`, `defaultCurrency`, and both migrations.** No behaviour depends on it yet.
2. **The `AssetPriceOverride` module**, its two repositories and the shared contract test — built
   and wired, called by nothing. The same shape slice 15 used for its two unreached dialogs, and
   for the same reason: the caller is the next commit.
3. **`expectedCurrency` required, `projectCurrency` in the provenance, and both call sites
   updated** — atomic, because a required field is a compile error at every caller.
4. **The command refusal, the cascade subscriber and the Inspector's three figures.**

## Definition of Done

- [ ] `Project.currency` exists, is ISO-4217-shaped, defaults from a new `defaultCurrency` plugin
      setting, and a v1 Project note migrates to it — the first non-empty chain the migration
      runner has executed outside a synthetic fixture.
- [ ] `CostPipelineInput.expectedCurrency` is **required**, and `computeEstimatedCost` refuses a
      mismatch with a `CalculationError` **before any arithmetic** — asserted on both directions,
      and the requiredness asserted by the compiler in the one type-checked test file, since a
      `// @ts-expect-error` nothing enforces is just a comment.
- [ ] `AssetPriceOverride` follows §78's module pattern and has in-memory and Obsidian
      repositories passing one shared contract test, like every other entity.
- [ ] The effective unit cost is `override ?? asset.unitCost`, resolved by the two commands and
      **not** inside `deriveRequirementFigures` — checked by that function still taking exactly one
      `unitCost` and holding no repository. A derivation that reached for one would be a second
      answer to what a Requirement costs.
- [ ] `assetMatchesCalculatedFrom` compares against the **effective** cost: a Requirement under a
      price override reads `"current"`, not a permanent false `"stale"`. This is the regression a
      naive edit produces and it gets its own test.
- [ ] `calculatedFrom` carries `projectCurrency`, and a Requirement whose project currency changed
      reads `"stale"` **after a reload**. **Narrow claim**: it reads stale, it is not recalculated
      — nothing recalculates until something dispatches, and no `ProjectUpdated` cascade is added.
- [ ] `AssignAssetCommand` refuses a pairing whose effective price is not in the project's
      currency, names both currencies, and creates nothing — **and the same assign succeeds once a
      price override in the project's currency exists.** That pair of tests is the answer to
      [[The cost pipeline is told the currency it must produce]]'s closing question: an override
      **satisfies** the refusal rather than replacing it.
- [ ] Both overrides are live on one Requirement and the stated precedence holds: the requirement
      override is in force, and changing the price override moves `calculated` without moving the
      effective figure. A test with one override at a time passes against either precedence, so
      the both-live fixture is the check.
- [ ] The Inspector shows the shared default, the project's price and the requirement's figure,
      each labelled and with the one in force marked (§52, §89).
- [ ] `AssetPriceOverrideChanged` cascades **only within its project**, asserted with the same
      asset referenced from two projects. A single-project fixture passes against no narrowing at
      all.
- [ ] Two override notes for one (project, asset) produce a diagnostic and still return a price —
      last-writer-wins, the shape `warnOnDuplicate` already uses. Deliberately not a refusal: the
      notes are user-editable markdown.
- [ ] The Requirement v1→v2 migration writes the project's **current** currency into the
      provenance, so migrated Requirements read `"current"` — asserted, because it is a deliberate
      under-report and a test is what stops the next reader correcting it into a vault-wide false
      alarm.
- [ ] [[The cost pipeline is told the currency it must produce]] is closed, with its outcome
      recorded in the note rather than only in this document — it carries the reasoning, and an
      Issue that stays New after its question is answered is worse than one never filed.
- [ ] [[Asset library]]'s definition-of-done item — *"A project can record its own price against a
      shared definition"* — is met, and that epic says so.
- [ ] `npm run check` passes, and `vitest.config.ts` records a fresh measurement.

## Genuinely undecided, and left so

- **Where a user creates a price override.** There is no Asset surface at all — slice 10 records
  that nothing anywhere selects an Asset for a user to delete, and the same is true of editing
  one. The entity, the command and the query are built here; the affordance belongs to whichever
  slice first gives the catalogue a screen. Until then the override is reachable through the
  sample seed and through a hand-written note, and **the refusal in `AssignAssetCommand` is
  therefore a dead end for a real user** in a two-currency vault. That is the honest state of it
  and it is the strongest argument for scheduling the catalogue UI next.
- **Whether a project's currency may be changed once Requirements exist.** This slice makes the
  consequence visible (everything reads `"stale"`) and does not refuse the change. Refusing it is
  a product decision nobody has asked for.

## References

**Issue**: [[The cost pipeline is told the currency it must produce]] — the proposal, the three
blockers, the three withdrawn attempts, and the *Revisit when* this slice satisfies. **Read it
first.**

**PRD**: §72 Currency Model; §75 Quantity Semantics; §83 Configuration Model (default currency);
§88 Derived Data; §89 Manual Overrides.

**Business rules**: [[A manual override is stored as an override, beside what it replaced]] — the
shape both overrides take · [[A mismatched unit or currency is an error, not a coercion]] — the
rule, and the Issue explains why it could not fire here ·
[[Each cost type has exactly one source of record]] ·
[[Money is rounded once, where the pipeline finalizes it]].

**Requirements**: [[Asset library]] — the open definition-of-done item this closes ·
[[Cost and budget engine]] · [[Settings and configuration]].

**Slices**: [09](09-quantity-and-cost-engine.md) — `CostPipelineInput` as it stands, the baseline
this changes and **not** a contract it violates ·
[10](10-assets-requirements-and-the-end-to-end-loop.md) — *Sharing did create one new way for a
pairing to be wrong* · [19](19-the-asset-catalogue-leaves-the-project.md) — what opened the hole.

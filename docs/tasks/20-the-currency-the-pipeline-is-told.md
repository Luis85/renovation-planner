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
pattern `assetFrontmatter` already uses for `currency`). The project schema goes to 2 through a
real v1→v2 step registered in `PROJECT_MIGRATIONS` — the version is derived from the steps
(`MigrationRunner.latestVersions`), so the step IS the bump — and **this one is a real migration
rather than a redefinition**, because
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

**Corrected by Amendment 1 below.**
The block below wrote `Currency` as though the type existed — it did not, and `core/money`
had to mint it — and it wrote `CalculatedFrom` as gaining a field that it does **not** gain.
Both are corrected here rather than left to be discovered, since a contract block is what an
implementer transcribes.

```ts
// core/money/Money.ts — INVENTED by this increment; there was no `Currency` type
declare const currencyBrand: unique symbol;
export type Currency = string & { readonly [currencyBrand]: true };
export function parseCurrency(raw: unknown): Result<Currency, ValidationError>;  // untrusted input
export function currencyOf(code: string): Currency;                             // program literal; THROWS

// domain/project/Project.ts
readonly currency: Currency;

// domain/cost/costPipeline.ts
readonly expectedCurrency: Currency;   // required — see the design section

// domain/requirement/Requirement.ts — UNCHANGED. `calculatedFrom.unitCost.currency` already
// IS the project's currency at calculation time, once the pipeline's invariant holds, so no
// `projectCurrency` field is added and no Requirement migration is registered.
interface CalculatedFrom { zoneArea; unitCost; assetUnit; }

// ————— the override increment's, NOT this one's —————
// domain/asset-price/AssetPriceOverride.ts — the slice 3 module pattern
export class AssetPriceOverride { readonly id; readonly projectId; readonly assetId; readonly unitCost: Money; }

// application/ports/AssetPriceOverrideRepository.ts
getForPair(projectId: ProjectId, assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>>;
listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>>;
save(o: AssetPriceOverride, expected: Expected): …
delete(id: AssetPriceOverrideId, expected: EntityVersion): …
```

## Persistence Impact

**Amended by Amendment 1 below: NONE of the three bullets shipped as written.** The Project
schema stays at version 1 and gains an optional key instead (item 3); the Requirement bullet is
WITHDRAWN as unnecessary rather than deferred, because the value it exists to persist is
already in the note (item 6); and the `Asset Prices/` folder belongs to the override increment
(item 7). The bullets are left standing rather than rewritten, because what they say was
DESIGNED is the record the amendment is an amendment to.

- `Project` gains `currency:`, and a real v1→v2 step in `PROJECT_MIGRATIONS` takes the project
  schema to 2.
- `Requirement` gains `project-currency` inside its persisted `calculated-from`,
  and a v1→v2 step in `REQUIREMENT_MIGRATIONS` takes that schema to 2. Its step **cannot**
  invent the value — the project's
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

**Read Amendment 1 below before this list.** The slice was split: this list was written
for one increment carrying both the currency invariant and the per-project price override,
and the override is now its own. Every item below says which. Three of them are
**withdrawn** rather than deferred — a withdrawn item left looking merely unticked is one
the next reader re-adds as an oversight, which is the whole reason the annotations are
inline rather than only in the amendment.

- [x] **PARTLY — the migration clause is WITHDRAWN, see Amendment 1 item 3.** `Project.currency`
      exists, is ISO-4217-shaped and defaults from a new `defaultCurrency` plugin setting. It does
      **not** arrive through a migration: `ProjectFrontmatterSchemaV1` gains an optional key and
      `projectFromPersistence` supplies the default, `PROJECT_MIGRATIONS` stays empty, and the
      clause promising *"the first non-empty chain the migration runner has executed outside a
      synthetic fixture"* is withdrawn. The runner stays unproven on a real chain.
- [x] `CostPipelineInput.expectedCurrency` is **required**, and `computeEstimatedCost` refuses a
      mismatch with a `CalculationError` **before any arithmetic** — asserted on both directions,
      and the requiredness asserted by the compiler in the one type-checked test file, since a
      `// @ts-expect-error` nothing enforces is just a comment.
      (`tests/domain/cost/currencyInvariant.test.ts`, `tests/domain/cost/costPipelineInput.test-d.ts`.)
- [x] **MET by the override increment, see Amendment 4.** `AssetPriceOverride` follows §78's
      module pattern — entity, id, errors, events, Zod schema, mapper — and its in-memory and
      Obsidian repositories pass one shared contract test
      (`tests/contracts/asset-price-override-repository.contract.ts`), like every other entity.
      It is `renovation-asset-price`, and registering a new kind touches several lists at once.
      **One of them fails SILENTLY when forgotten and the rest do not**: `digest.ts`'s `SCHEMAS`
      falls through to the UNION of every schema's keys rather than refusing to compile, so an
      unregistered kind digests foreign keys into its observation token and a user editing one of
      them has the note's next save refused as an external modification. That is what happened
      here, and what the test could not see is in Amendment 4 item 7. Its notes are named by their
      own id under `Asset Prices/` —
      **not** by the asset's name, see Amendment 4 item 4.
- [x] **MET by the override increment, see Amendment 4, and the second half held.** The effective
      unit cost is `override ?? asset.unitCost`, resolved in `resolveEffectiveUnitCost` by the two
      commands — `AssignAsset` and `RecalculateRequirement`, the same pair that already read the
      project for its currency — and **not** inside `deriveRequirementFigures`, which still takes
      exactly one `unitCost` and holds no repository — which is the check, and it is NOT
      "its diff is empty": the module changed, because the override is a second writer of the
      field `assetMatchesCalculatedFrom` compares and that comparison moved from the rendered
      amount to `sameMoney`.
- [x] **MET by the override increment, see Amendment 4.** `assetMatchesCalculatedFrom` compares
      against the **effective** cost, so a Requirement under a price override reads `"current"`
      rather than a permanent false `"stale"`. The defect could not exist until an override did,
      which is why this increment pinned the untouched predicate with a regression test rather
      than saying "we did not touch it" — and that pin is what the override increment had to move
      deliberately.
- [x] **MET BY ANOTHER ROUTE; the `projectCurrency` field is WITHDRAWN as unnecessary, see
      Amendment 1 item 6.** A Requirement whose project currency changed reads `"stale"` **after a
      reload**. `calculatedFrom` does **not** carry `projectCurrency` and gains no field: the
      requirement note's single `currency:` key already IS the project's currency at calculation
      time once the pipeline's invariant holds, so `inputsStillMatch` compares
      `project.currency === recordedFrom.unitCost.currency` and needs nothing persisted that was
      not already there. **Narrow claim, unchanged**: it reads stale, it is not recalculated —
      nothing recalculates until something dispatches, and no `ProjectUpdated` cascade is added.
- [ ] **AMENDED — the pre-check is WITHDRAWN, see Amendment 1 item 4; the override half is the
      override increment's.** `AssignAssetCommand` adds no guard of its own. It PROPAGATES the
      pipeline's `cost.currency-mismatch`, because it builds the Requirement's figures through
      `deriveRequirementFigures`, which is that pipeline — so a mismatched pairing already refuses
      and creates nothing. The copy **cannot name both currencies**: `toUserMessage` takes no
      params, so the sentence names the wrong relationship and the two codes live in the
      developer-English `message`. The *"same assign succeeds once a price override exists"* half
      is the override increment's, and it is where the Issue's closing question gets its end-to-end
      assertion — the ANSWER is recorded in the Issue now regardless. **That half is MET**, by
      `tests/application/commands/requirement/overrideSatisfiesRefusal.test.ts`: the same command
      instance refuses, an override in the project's currency is written, and the same assign then
      succeeds. [[The cost pipeline is told the currency it must produce]] is **closed** on it.
- [x] **MET by the override increment, see Amendment 4.** Both overrides are live on one
      Requirement and the stated precedence holds — and getting there needed a pre-existing domain
      defect fixed: `Requirement.withRecalculation` dropped both overrides on every full
      recalculation while its sibling `withCalculatedCost` preserved them, so no precedence case
      could pass against real production code. The COST half of that fix stands; the QUANTITY half
      was reverted and is a recorded residual, see Amendment 4.
- [x] **MET by the override increment, see Amendment 4.** `UnitCostFigures.vue` shows the shared
      default, the project's price and the requirement's own recorded figure, each labelled and
      with the one in force marked (§52, §89) — the mark being a translated WORD in a badge, so
      it carries no colour to be the only channel. **Narrow
      claim**: no instrument here has DRAWN it. The container had no pinned Chromium, so the
      three-figure block in a row that already carried two is verified by `npm run test-build` in
      a vault and by nothing else.
- [x] **MET by the override increment, see Amendment 4.** `AssetPriceOverrideChanged` cascades
      **only within its project** — `onAssetPriceOverrideChanged` filters on the payload's
      `projectId` before it recalculates, mutation-checked by deleting the filter and watching two
      narrowing cases redden. The cascade is **unconditional within** that project, which is a
      recorded residual rather than a promise: it has no skip test, so pricing an asset at exactly
      its catalogue price rewrites every matching Requirement without moving a figure.
- [x] **MET by the override increment, see Amendment 4.** Two override notes for one
      (project, asset) produce a diagnostic and still return a price — last writer wins by id,
      deliberately not a refusal, so a hand-made duplicate never hides a note the user can see on
      disk. Both readers share one `winnersBy`, and the case that pins it saves its two notes in
      the OPPOSITE order to their ids, because a fixture whose save order matched its id order
      passes against a naive `new Map(list.map(...))` too.
- [ ] **WITHDRAWN as unnecessary, not deferred — see Amendment 1 item 6.** The Requirement v1→v2
      migration writing the project's **current** currency into the provenance was a remedy for a
      value the document believed unrecoverable. It is recoverable, so there is no step, no key and
      no under-report to assert. **Nothing in a later increment should re-add this**: adding the
      field would create a second answer to a question the note already answers.
- [x] **ANSWERED here, and CLOSED by the override increment.**
      [[The cost pipeline is told the currency it must produce]] carries its answer — *an override
      **satisfies** the refusal rather than replacing it* — recorded in the note rather than only
      here. Its `status` stayed `New` through this increment with a *Revisit when* naming the
      override increment, because the second half of what it describes was unwritten. It is `Done`
      now, on the two things it named: the witness pair green, and a user able to reach the
      affordance. An Issue answered and left open is not the failure this item was guarding
      against; an Issue whose answer lives only in a slice document is.
- [x] **MET by the override increment, and the epic is ticked.** [[Asset library]]'s
      definition-of-done item — *"A project can record its own price against a shared
      definition"* — is closed by the price section on the project detail state, and that epic
      says so in its own words rather than being left to be inferred from this increment having
      happened.
- [x] `npm run check` passes, and `vitest.config.ts` records a fresh measurement — 5950/5994
      statements, 2956/3010 branches, 1534/1548 functions, 5285/5313 lines
      (99.26 / 98.20 / 99.09 / 99.47). **NOTHING RATCHETS**: rounded down those are the floors
      already in force, as slices 5, 11, 13, 15, 16, 18 and 19 also measured.

### Amendment 1 (2026-09-01): the slice is split, and this half has landed

Dated at the writing rather than at the design, which is 2026-08-31: the increment ran across
midnight and its last commits carry the later date. The design delta is
[`docs/superpowers/specs/2026-08-31-the-currency-the-pipeline-is-told-design.md`](../superpowers/specs/2026-08-31-the-currency-the-pipeline-is-told-design.md),
which is the authority for the reasoning behind every item here. This section exists because a
reader opens **this** document, and a withdrawal recorded only in a spec is a withdrawal the next
author re-adds as an oversight.

1. **The slice is split, and this increment is the first half — the currency invariant.** The
   per-project price override is its own increment. The reason is this document's own *Genuinely
   undecided* section: the affordance *"belongs to whichever slice first gives the catalogue a
   screen"*, and that screen is being built separately, so the override lands **with** its
   affordance rather than several commits before it. This half closes the correctness hole on its
   own — an EUR-priced asset can no longer yield an estimate inside a GBP project.

2. **`Currency` did not exist, and it is branded on the way OUT rather than on the way in.** This
   document's `Interfaces & Contracts` wrote `Currency` as though the type were there;
   `Money.currency` was a bare `string`, validated by a pattern inside `createMoney` and `of`.
   `core/money` mints it now. **The brand goes on the RESULT**: `createMoney`, `of` and
   `currencyOf` already refused a non-conforming code, so branding what they return states a fact
   rather than adding a hope, and it moves none of the 142 currency literals in `tests/`. Branding
   the INPUT was the more coherent shape and was measured before being rejected: 142 call sites
   plus every fixture, for a guarantee the validating constructors already give. **State the claim
   narrowly** — it stops a caller passing a bare string; it cannot stop one passing the wrong
   *validated* currency, which is exactly what the pipeline's refusal is for.

   Two doors, not one: `parseCurrency(raw: unknown): Result<Currency, ValidationError>` for
   untrusted input (`data.json`, note frontmatter) and `currencyOf(code: string): Currency`, which
   **throws**, for program literals. That is the split `createMoney`/`of` already had, applied to a
   second value type — a `Result`-returning door would force an unreachable error arm at every
   module-level literal that needs a currency.

3. **No Project schema bump, and `PROJECT_MIGRATIONS` stays empty BY A DECISION.**
   `ProjectFrontmatterSchemaV1` stays at version 1 and gains an optional `currency`, slice 19's
   Asset pattern; `projectFromPersistence` takes a `defaultCurrency` and applies it when the key is
   absent. Migrations here run on **read**, so neither shape rewrites a vault and the distinction
   this document called load-bearing is smaller than it reads — and the step's value would have to
   come from `defaultCurrency`, which a pure `migrate(input)` cannot see without turning
   `MIGRATION_SET` into a builder, which is the one table whose single-ness is an asserted
   property.

   **The Definition-of-Done clause promising *"the first non-empty chain the migration runner has
   executed outside a synthetic fixture"* is WITHDRAWN, not ticked.** The cost is named rather than
   hidden: the runner remains unproven on a real chain, and that risk moves to the first schema
   change that cannot be a redefinition — which should be **scheduled** deliberately rather than
   discovered.

   The consequence is behaviour rather than a footnote: a project note with no `currency:` key
   **follows the setting**, and keeps following it until something saves that note. For a
   single-currency vault that is the feature. For a two-currency vault it is a footgun, because
   changing `defaultCurrency` silently re-denominates every project that never stated one — pinned
   as a test rather than described, so that a later reader who "fixes" the floating fails a case.

4. **One refusal, in the pipeline. `AssignAssetCommand`'s pre-check is WITHDRAWN.**
   `computeEstimatedCost` refuses a mismatch before any arithmetic with a `CalculationError` coded
   `cost.currency-mismatch`; `AssignAssetCommand` propagates it and adds no guard of its own,
   because it builds its figures through `deriveRequirementFigures`, which **is** that pipeline. A
   second refusal buys wording and not protection, and pays for it with two codes, two categories
   and two surfaces for one failure. *"Two expressions of one question, three lines apart, drift
   immediately."*

   **The wording is bought smaller than this document wanted.** `toUserMessage(language, error)`
   takes no params — `t` gained a third parameter in slice 19 and `toUserMessage` did not — so the
   user-facing sentence **cannot name the two currencies**. It names the wrong *relationship*
   instead, and both codes live in the developer-English `message` for the log line. Widening
   `toUserMessage` is a deliberate change to the one seam where an `AppError` becomes copy, and it
   does not belong inside a currency increment.

   What both commands DID gain is a `ProjectRepository` — not the `AssetPriceOverride` repository
   this document predicted, since there is no override yet. `AssignAsset` and
   `RecalculateRequirement` each read the project and pass `expectedCurrency`;
   `deriveRequirementFigures` keeps taking exactly the figures it is given and holds no repository.

5. **`Project.create` gains a coherence rule this document does not mention** — an ADDITION rather
   than a withdrawal. `Project` already carried two currencies before this increment (`budget` and
   `contingency`, both `Money | null`, neither persisted), so `Project.currency` would have been a
   *third* answer to "what currency is this project in". The constructor refuses a `budget` or
   `contingency` whose currency is not the project's, beside `negativeAmount` and for that
   function's own stated reason: the constructor is private, so the entity is the one place every
   path passes, and a Zod refinement would be a second answer to the same question.

6. **`CalculatedFrom` is UNCHANGED. The `projectCurrency` field, the Requirement v1→v2 step and
   the deliberate under-report are WITHDRAWN AS UNNECESSARY, not deferred.**

   This document argued that *"the project's currency at the time of the original calculation is
   not recoverable"*, and built four things on that claim: a provenance field, a persisted
   `project-currency` key, a migration step, and a deliberate under-report so that migrated
   Requirements read `"current"` rather than `"stale"`. **The claim was about the DOMAIN and was
   made without reading the NOTE.** `RequirementFrontmatterSchemaV1` declares a single `currency`
   key which `requirementMapper` hands to `cost-calculated`, `cost-override` **and**
   `calculated-from-unit-cost` alike — so `calculatedFrom.unitCost.currency` **is** the project's
   currency at calculation time, once item 4's invariant holds. Nothing had to be added, persisted
   or migrated.

   **And the version that reads the note is *truer* than either candidate this document weighed.**
   It flags exactly the Requirements really denominated in something other than their project's
   currency, and leaves every other reading `"current"`. The two options here were a vault-wide
   false alarm (mark everything stale) and a vault-wide false reassurance (the under-report). This
   is neither.

   **Do not re-add the field.** It would be a second answer to a question the note already answers.

   The comparison is also SPLIT by which question each caller asks, which one shared predicate had
   conflated:
   - **`assetMatchesCalculatedFrom`** — the cascade-skip test, used by `onAssetUpdated` — is
     **untouched**. Its question is about the ASSET, and it already compares
     `asset.unitCost.currency`, so a re-denominated asset already invalidates. Adding a project
     read here would cost one read per project across a shared asset's whole fan-out to answer a
     question nobody asked. Pinned by a regression test rather than left as *"we did not touch
     it"*.
   - **`inputsStillMatch`** in `GetRequirementsForZone` — the read-model backstop — gains exactly
     one comparison, and the query gains a `ProjectRepository`. One read per call; the zone
     supplies the `projectId`.

7. **Deferred to the override increment, by name, so that a closed increment's history does not
   swallow them:** `AssetPriceOverride`, its id, schema, errors, events and both repositories with
   one shared contract test; `AssetPriceOverrideChanged` and its project-narrowed cascade; the
   duplicate-pair diagnostic and its last-writer-wins, deliberately not a refusal; the
   `Asset Prices/` folder and a sixth `ENTITY_TYPES` entry; the Inspector's three figures, each
   labelled with the one in force marked (§52, §89); where a user creates an override, which waits
   on the catalogue screen; and **the effective-cost correction to `assetMatchesCalculatedFrom`**,
   which is a defect only once an override exists and is therefore that increment's
   Definition-of-Done item rather than a gap in this one.

### Amendment 2 (2026-09-01): five measurements that made a written sentence false, and six minors left standing

Recorded separately from Amendment 1 because none of these is a scope decision. Each is something
the increment measured that corrects this document, its plan, or both.

- **The constant is `MINOR_UNIT_PLACES`, not `MINOR_UNITS`.** The design delta named it twice and
  the plan three times, and no such constant exists. Corrected in both at `0c6bcec`, before it
  could reach an implementer transcribing a symbol that would not resolve. It matters beyond the
  typo because it is what BOUNDS the settings vocabulary: `Money.round` finalizes at two decimal
  places, so `CURRENCIES` is the currencies with two minor units (`CHF`, `EUR`, `GBP`, `USD`) — a
  list decided by that constant rather than by taste. **It bounds the DEFAULT and not a
  hand-written note**: an asset note's own `currency: JPY` still passes `/^[A-Z]{3}$/` and still
  rounds at two places. Pre-existing, out of scope here, and recorded so it stops being invisible.

- **The plan's claim that its first task *"removes two branches and adds none"* undercounts by
  one.** `parseCurrency`'s `typeof raw !== 'string'` arm is genuinely NEW — the checks it replaced
  took a `string` parameter and could never see a non-string. It is tested in the same commit, so
  the constraint that motivated the claim held; the framing was wrong, and a framing that
  undercounts a new arm is exactly what hides one in a slack metric.

- **`project.currency-mismatch` gets no locale copy, and that is deliberate rather than a gap.**
  No caller sets `budget` or `contingency` on `CreateProjectInput`, so item 5's coherence refusal
  is UNROUTABLE from any surface — exactly as its sibling `project.negative-amount` already is,
  which `toUserMessage.test.ts` records in its MINTED table. `cost.currency-mismatch`, which a user
  CAN reach, has copy in both locales. Written down because an absence with a reason and an
  absence without one read identically.

- **There is a THIRD pipeline caller this document and its plan never named.**
  `SetRequirementQuantityOverride` calls `computeEstimatedCost` directly. It passes its own
  `unitPrice` as `expectedCurrency`, so the guard there **cannot fire** — judged correct on review
  rather than left as an oversight, because that call re-prices a *snapshot* rather than live
  inputs, and reading the project there would lock the user out entirely, since
  `RecalculateRequirementCommand` refuses on the same mismatch. **The residue is real and is pinned
  by a test**: a project note with no `currency:` key takes the plugin's `defaultCurrency`
  (item 3), so changing that setting re-denominates every legacy project — after which this
  override path writes an estimate the invariant does not reach. **It is not the only such
  door, and the unnamed one is less guarded**: `SetRequirementCostOverrideCommand.write` writes
  `estimatedCost.override` — the estimate `effectiveValue` actually renders — from a
  caller-supplied `Money`, with no currency comparison at all, and `Requirement` performs none
  either; the same scenario reproduces there through `RequirementRow.vue`'s cost override, which
  mints its `Money` in the row's own — possibly stale — currency, and it can additionally accept
  a genuinely foreign currency from any application-layer caller. Neither is guarded, for the
  same reason: "recalculate first" is not a remedy once recalculate refuses too. The hazard
  beneath both — `requirementMapper` writes one `currency` key for all three money fields, so a
  foreign override is silently re-denominated on reload — is pre-existing and belongs to
  whichever increment reconciles a Requirement's currency against its Project's.

- **`isStaleReading`'s `projectCurrency === null` arm does not discriminate under mutation, and it
  stays.** Removing it changes no behaviour: a null project currency cannot equal a recorded one,
  so `inputsStillMatch`'s own tail conjunct already yields `stale`. It stays because without it
  `projectCurrency` is `Currency | null` at a call site that requires `Currency` — **its job is
  narrowing a TYPE, where its zone and asset siblings prevent a crash.** Not the dead-branch shape
  this repository deletes, which was unreachable; this one is reachable. *Uniformity is a reason,
  and it is not the same reason as necessity* — so the two reasons are written down separately
  rather than the arm being defended as consistent with its neighbours.

**Three more are not corrections at all — the branch shipping something better or narrower than
the design said, recorded so a later reader does not read the divergence as drift.**

- **`parseCurrency` is not the door the spec assigned it.** Decision 1 says it is "the one door"
  for the two boundaries that begin with untrusted text, `settingsFrom` and the project
  frontmatter schema. Neither uses it. `settingsFrom`'s `currencyFrom` is a `CURRENCIES.find`
  instead — narrower than `parseCurrency`, and deliberately so: the question there is not "is
  this a well-formed code" but "is this one of the codes this pane offers," which is what keeps
  a hand-edited `JPY` in `data.json` out of `round`, where `parseCurrency` would have let it
  through. The project frontmatter schema uses a zod `.regex(/^[A-Z]{3}$/).nullable().catch(null)`
  with `currencyOf` in the mapper instead — also correct, because `.catch(null)` is what lets an
  absent key take the project's default rather than refusing the whole note, which `parseCurrency`
  returning a `Result` cannot express at a zod boundary. `parseCurrency`'s only production caller
  is `createMoney`. Both shipped choices are better than routing through the door the spec named.
- **The brand-assignability test covered two of three constructors.** `currency.test.ts` asserted
  `of` and `zero` produce a `Money` whose `currency` satisfies the brand; `createMoney`'s result
  was asserted nowhere against it. Closed in the same pass with one added case.
- **`.fallowrc.json`'s enumeration justification is half fiction.** Its comment says the seven
  `*.test-d.ts` files are named one at a time rather than globbed because a glob "would absorb one
  whose tsconfig `include` entry had been forgotten." There is no per-file `include` entry to
  forget: `tsconfig.json`'s `include` is `tests/**/*.ts`, already a glob that reaches every one of
  them automatically, so nothing about adding a file there requires a second edit anywhere. The
  general half still stands on its own — "a glob absorbs the next file and tells nobody" is a real
  reason to enumerate, because it forces a reviewable decision each time one is added — so the
  enumeration is still the right call, for one real reason and one dead one. Recorded so the next
  editor does not re-derive the dead half and re-justify the same choice for a reason that is not
  true.

**Six minors were deferred rather than fixed, and they are listed here because the only other
place they exist is an execution ledger under `.superpowers/`, which is a working artefact rather
than a document anybody opens twice.** None is a scope decision and none blocks anything; each is
small enough that the next author to be in the file should take it, and invisible enough that
nobody will find it otherwise.

- **`RecalculateRequirement` collapses a failed project READ and an absent project into one
  code** (`requirement.project-gone`), where `AssignAsset` — the sibling written in the same
  task — propagates the read error unchanged and reserves `requirement.project-not-found` for the
  absent case. The branches are separate and the developer message survives, so this is the
  milder form of a class `CLAUDE.md` already records three times; what it costs is that a user
  whose vault could not be read is told their project is gone.
- **`makeDeleteZoneCommand`'s `projects` default is a fake HARSHER than the real thing** — inert
  today because nothing reaches it, and armed for the first caller that does.
- **`RecalculateRequirementCommand` now sits at exactly five positional parameters.** The next
  collaborator it gains forces the deps-object conversion; taking it early is cheaper than taking
  it under a change that needed the parameter.
- **`overridePort` is duplicated verbatim in two test files.** Invited by the task brief rather
  than a defect of the work; dedup when a third caller appears.
- **`.fallowrc.json`'s comment still says `tsconfig.json` "names each one directly"**, and the
  `include` is a glob. Pre-existing, passed over by this increment's edit to that file.
- **The provenance of `tests/build/tsconfig-emit.test.ts` is UNRESOLVED.** It appeared untracked
  in the working tree during the pipeline task; the implementer that committed the
  `tsconfig.json` change it checks states it authored neither, and no agent dispatched for this
  increment was writable at the time. The content is sound and was verified before being
  committed at `10f4454`. The risk recorded is not the file, which reads correctly, but the
  not-knowing — written down rather than explained away.

**One sentence in *Genuinely undecided* is now differently true.** It said *"the refusal in
`AssignAssetCommand` is therefore a dead end for a real user"*. There is no refusal in
`AssignAssetCommand` any more (Amendment 1 item 4) — the pipeline's is what a user meets — and it
is still a dead end for a user in a two-currency vault, because the override does not exist yet.
What this increment adds against that is the project's currency on the detail row (§85's
informational-row shape), so a user meeting the refusal can at least see which currency the
project is in without opening the note. That is a smaller thing than an affordance and is not
claimed as one.

### Amendment 3 (2026-09-01): the read named a different project than the write

Found by a review bot on PR 60, against the merge commit, and reproduced before it was accepted.

**What was wrong.** `GetRequirementsForZone` resolved the project currency from the QUERIED
ZONE's project, once per call. `RecalculateRequirementCommand` resolves it from
`requirement.projectId`. Those are two independent frontmatter keys — `requirementMapper` reads
`project` and `origin-zone` with no cross-check, and `Requirement.create` validates only the
origin KIND — so a hand-edited note parts them, and the Inspector then reported `current` for a
figure the command refuses as `cost.currency-mismatch`. `AssignAsset` writes them consistently
(it takes the Requirement's project FROM the Zone), so nothing this plugin creates is affected;
the exposure is a hand edit or a note arriving through sync.

**Not a design decision reversed.** The one-read shape came with a comment arguing it from an
invariant nothing enforces — *"one project backs every row this call can return"* — which is
this repository's own recurring shape: a rule stated in a docblock is a rule some door is not
following.

**What shipped.** The currency is resolved from `loaded.entity.projectId`, memoized per
`execute` in a `Map<ProjectId, Currency | null>`, so the read and the write name the same field
and cannot disagree, while the ordinary case stays at one project read. The reviewer's
alternative — treat a project/zone ownership mismatch as stale — was declined: it neutralises
the symptom and leaves two derivations of one fact in place to drift again.

**Tests.** One case asserts the PAIR (the row reads `stale` AND recalculate refuses), watched
failing at `expected 'current' to be 'stale'`. One pins the memo on the CALL COUNT, because a row
renders identically whether the memo works or not; mutation-checked at 2 reads against 1.
`propagates a failed zone read while resolving the project currency` named a path that no longer
exists and was REPLACED by the project-read arm, not deleted; `propagates a failed origin-zone
read` lost the call-count override whose only reason was the doubled zone read this removes.

**Still not enforced, and deliberately.** Nothing makes `requirement.projectId` agree with its
origin Zone's project at the domain or persistence layer. Closing that is a validation change
with its own refusal code and locale copy, which is not a review-round line; what this amendment
buys is that the two SURFACES no longer disagree about the data as it stands.

### Amendment 4 (2026-09-02): the second half — the per-project price override — has landed

**It is Amendment FOUR and the design delta that scheduled it says "Amendment 3".** Amendment 3
was written between the two, against a review-bot finding on the first half's merge commit, so the
ordinal in
[`docs/superpowers/specs/2026-09-01-the-per-project-price-override-design.md`](../superpowers/specs/2026-09-01-the-per-project-price-override-design.md)'s
*Amendments owed* is stale rather than wrong about anything else. Read that spec for the reasoning
behind every decision here; this section exists because a reader opens **this** document, and a
withdrawal recorded only in a spec is a withdrawal the next author re-adds as an oversight.

Every item Amendment 1 item 7 deferred is now ticked or amended **inline in the Definition of Done
above, by name**, so none has to be inferred from this increment having happened. What follows is
what changed about the DESIGN, and then what is left standing.

1. **The affordance's deferral is WITHDRAWN, not carried.** Amendment 1 item 7 deferred *"where a
   user creates an override, which waits on the catalogue screen"*, and *Genuinely undecided*
   below said the same. It did not wait, and the wait turned out never to have been necessary:
   pricing an asset **for a project** is a project's gesture, the project detail state has existed
   since design slice 21, and the catalogue is shared across projects — so a catalogue screen has
   no project to scope the price to and would have had to grow a project picker to become the
   surface this needs. The override ships **with** its affordance, in one increment, which is what
   makes the Issue closable rather than merely answerable.

2. **The port's four methods are five: `listByAsset` joins them.** Not symmetry — it is what
   `DeleteAssetCommand` needs. An asset's overrides are scoped by the ASSET across every project,
   which no project-scoped read can enumerate, and deleting a catalogue entry that leaves priced
   pairings behind leaves rows nothing can ever clear. The cleanup runs **after**
   `runDeleteResolution` and outside its compensated sequence: `resolvedReferents` stays
   `RequirementId[]` (an override is not a referent), `SEQUENCE_MARKER_SCHEMA_VERSION` is
   untouched, and both failure arms fall through, so a failed cleanup cannot fail the delete —
   it warns instead.

3. **The coherence rule exists, and it lives on `SetAssetPriceOverrideCommand` rather than on
   `AssetPriceOverride.create`.** An override must be in the project's currency; the command reads
   the project and refuses a mismatch before it writes. **Do not move it to the entity**, which is
   the tidier-looking answer and is the reason this item is written down: the entity's constructor
   is also the HYDRATION path, and the notes are user-editable, so a rule enforced there makes
   every already-drifted note *unreadable* — a note the user can see on disk that the plugin
   cannot show them. The asymmetry with Amendment 1 item 5, where the coherence rule for `budget`
   and `contingency` IS on `Project.create`, is deliberate and has a reason: those two are fields
   of the project's own note, so the entity is the one place every path passes; a project's
   currency is a DIFFERENT entity's fact, which a constructor cannot read.

4. **The note is named by its own id.** `Asset Prices/<AssetPriceOverrideId>.md`, so the
   illustrative `Asset Prices/Porcelain Terrace Tile.md` in the design delta is **not** what
   ships. An override is a relationship rather than a thing with a name of its own, and a
   name derived from either endpoint goes stale the moment that endpoint is renamed.

5. **`Requirement.withRecalculation` carried a pre-existing defect this increment could not
   route around, and half the fix was then REVERTED.** It dropped BOTH overrides on every full
   recalculation while `withCalculatedCost` beside it preserved them, so every automatic cascade
   in the shipped app — price change, geometry change, the unreadable and gone fallbacks —
   silently discarded a user's negotiated override, and the precedence criterion above could not
   pass against real production code. The COST half is fixed and stands. The QUANTITY half was
   fixed and then reverted, because `deriveRequirementFigures` computes the estimate from the
   CALCULATED quantity: preserving a quantity override without re-pricing from the effective one
   leaves a row showing 9 m² beside a cost derived from 12 m², which is worse than the lossy but
   consistent behaviour it replaced. The remedy's shape is known and named where the code is —
   mirror `SetRequirementQuantityOverride`'s effective-quantity re-pricing — and it is **pinned as
   an INVERTED test** rather than described, so whoever takes it reddens a case and reads the note
   instead of finding a paragraph that went quietly stale.

6. **What the increment measured that this document's plan predicted differently**, recorded
   because each was decided by a measurement rather than by taste:
   - The overrides read was memoised per PAIR and is memoised per **PROJECT**. `getForPair`
     hydrates the whole project's overrides and filters, so a pair-keyed memo was N×M hydrations
     per Inspector refresh where a project-keyed one is 1×M — strictly worse at every N>1 and
     equal at N=1. Fixing it cost a `max-params` conversion to a deps object, which is 20
     construction sites and the bulk of that diff.
   - Two of that change's existing cases had to move, and both moves are INSTRUMENT-only: a
     project-keyed memo holding one pair's answer also reads one list, so a call count alone
     stopped discriminating and the case asserts per-row values beside it; and a refusal injected
     at `getForPair` did not weaken, it FAILED, because nothing calls that method any more.
   - `asset-price.entity-invalid` is a `Persistence` error and not a `Validation` one:
     `readNoteBackedEntity` re-wraps the mapper's `ValidationError`. Read from the raise site
     rather than from the category the name suggests.

7. **A new entity kind was missing from `digest.ts`'s `SCHEMAS`, and the TEST had its own
   hand-written list that could not notice.** `ownedKeysFor` answers
   `OWNED_KEYS_BY_TYPE[type] ?? EVERY_OWNED_KEY`, so an unregistered kind owns the UNION of every
   schema's keys: a user adding `name:` or `description:` to an override note has it digested into
   the observation token, and editing that key then refuses the note's next save as an external
   modification — for a key the asset-price schema does not declare and `writeOwnedFrontmatter`
   never writes. That is precisely the defect `digest.ts`'s own docblock describes and says was
   fixed for zones in slice 16. **Nothing went red because the test's `byType` was a THIRD
   hand-written list**, transcribed from neither `ENTITY_TYPES` nor `SCHEMAS` and covering the
   five kinds that existed when it was written — so registering the sixth entry alone would have
   left the next kind exposed identically. `byType` is DERIVED from `ENTITY_TYPES` against a
   `Record<EntityType, …>` now: a kind that array names and the map does not is a compile error,
   and a kind whose `SCHEMAS` entry is missing falls through to the union at runtime and reddens
   the foreign-key case. **Fix the instrument in the same commit as the defect it could not see**,
   or the fix is one kind wide.

8. **`npm run check` passes on the override increment, measured on a quiet clean tree at the
   documents commit: exit 0, 317 test files, 4445 tests, coverage 99.24 / 98.17 / 99.11 / 99.49
   (statements / branches / functions / lines).** **NOTHING RATCHETS**: rounded down those are the
   floors already in force, which is what slices 5, 11, 13, 15, 16, 18 and 19 also measured. Read
   the exit code and not the summary — fallow prints `● Duplicates (2 clone groups)` and
   `✗ 27 lines (0.0%) duplicated across 4 files` in that same green run, because the duplicates
   section REPORTS and the health section GATES, and this increment already lost a review round to
   reading those two as one verdict (item 6's sibling lesson, and the whole of `CLAUDE.md`'s new
   first bullet).

## What the override increment left standing

Recorded here rather than only in the design delta, and with the reason each was not fixed, so
that the next author does not re-derive the same three candidate remedies. **Four of these are
PRE-EXISTING and are named as such**, because a residual met later without that label reads as
this increment's defect.

- **Setting a price is not undoable.** `ProjectDetail` has no `CommandHistory` — `CreatePlanCommand`
  dispatches directly on that same surface — so the price commands do too. Consistent with the
  surface rather than with the Inspector's overrides, which are undoable because the plan editor
  has a stack. The remedy is a stack on the project surface, which is an increment rather than a
  line.
- **A project's currency can move under existing overrides.** There is no `UpdateProject` command,
  but a project note with no `currency:` key follows the `defaultCurrency` setting (Amendment 1
  item 3), so changing that setting re-denominates the project and strands its overrides. The
  requirements read `"stale"` through the backstop; the section shows a price in a currency the
  project no longer prices in, with nothing saying so. The cheapest honest remedy is named so it
  is not redesigned: a marker on that row, derived per read from the two currencies, never stored.
- **A hand-edited price note can disagree with the project's currency**, and is **read and shown**
  — which is item 3's rule holding, not a hole in it. Refusing at the READ was the alternative and
  is rejected: it makes a note the user can see on disk invisible to the plugin, which is the same
  trade the duplicate-pair rule already refuses. The assign it feeds refuses at the pipeline, and
  that message names the wrong relationship for the first half's own recorded reason.
- **PRE-EXISTING — an out-of-band price change refreshes the views and recalculates nothing.** A
  price note hand-edited, synced, or deleted in the file explorer reaches `VaultChangeAdapter`,
  which upserts the index and publishes `ProjectIndexEntryChanged` and no domain event; the
  cascade subscribes to `AssetPriceOverrideChanged`, which only the two commands raise. It is
  **symmetrical with `registerOnAssetUpdated`**, and nothing anywhere subscribes a cascade to the
  index event, so a library price edited by hand moves no requirement in any project today either
  — the shared catalogue being the larger half of the same gap. What the user sees is a row
  reporting itself `stale`, because the backstop reads the effective cost. Recovery is clear-then-
  set, two gestures that both publish; **re-setting the same value is not one**, because the
  command writes and announces nothing when the submitted price already holds, and after an
  out-of-band edit the section shows exactly that value.
- **PRE-EXISTING in shape — a price note whose `project` key is corrupted is priced from the
  catalogue, silently.** `buildProjectIndexEntries` indexes it by TYPE under no project, and every
  project-scoped repository intersects `getIdsByProject` with the type set, so it is never
  hydrated. Measured against the siblings before it was deferred: `ObsidianZoneRepository` and
  `ObsidianPlanRepository` narrow identically. **The CONSEQUENCE is what differs and is worth
  carrying**: a zone or plan lost that way is a VISIBLE ABSENCE, while a price override is a
  silently wrong figure. What bounds it today: an existing requirement reads `stale`, because the
  recorded and effective costs part; a new assign in a different currency refuses at the pipeline.
  The genuinely silent window is a same-currency project, a corrupted key, and a NEW assign — and
  the section cannot show the row either, so the user cannot clear it from the surface. Three
  fixes were weighed; the correct one is a diagnostic at `buildProjectIndexEntries` for a note
  declaring a project-scoped type with no project, which serves plan, zone and asset-price
  uniformly and is an index-pipeline change every consumer inherits.
- **PRE-EXISTING since slice 10 — a quantity override is dropped on every full recalculation.**
  Item 5 above; pinned by an inverted case.
- **The narrowed cascade is UNCONDITIONAL within its project.** `onAssetPriceOverrideChanged` has
  no skip test where `onAssetUpdated` has one, so pricing an asset at exactly its catalogue price,
  or clearing one that equalled it, rewrites every matching Requirement although no figure moves.
  The consequence is churn — revision bumps and a slower gesture — not a wrong figure. Both
  candidate fixes are partial and both are written down: a handler-side skip test needs a
  required-member widening of a deps type THREE handlers share, and a command-side one cannot work
  for `ClearAssetPriceOverrideCommand`, which deliberately holds no `assets` so the orphan row
  stays clearable.
- **`projectPricesChangeSource` narrows nothing itself, and its index arm cannot.** The source
  REPORTS the project a change is about and each caller decides — the price section narrows, the
  Plan Editor holds a plan id and ignores the argument. The index-event arm reports `null`, meaning
  *cannot say, refresh anyway*, because `ProjectIndexEntryChangedPayload` carries `entityId` and
  `entityType` and no project id. So a price-related index event still wakes unrelated projects'
  panes. Narrowing it means an index lookup per event or a wider payload — an index-pipeline change
  again, inside an increment about prices.
- **The index-entry path is asserted AT THE SOURCE, not end to end.** That a synced price note
  reaches the bus is `VaultChangeAdapter`'s own tested behaviour, and that the source forwards it
  is this increment's; nothing joins the two halves into one case.
- **`AssetPriceRow`'s `draftToken` rests on a rule `useFieldCommit` states in comments and in no
  type** — that it drops a submitted draft exactly when no keystroke landed while it was in
  flight. If that changes, the row's release goes wrong silently and only three cases catch it.
  The fuller answer is the composable reporting its own cleanliness, which is a change to
  something eight other fields use.
- **PRE-EXISTING and unchanged — `SetRequirementQuantityOverride` and
  `SetRequirementCostOverrideCommand` are still unguarded on currency.** Amendment 2 records both
  and its account is unaltered by this increment: neither door was touched here.
- **`tests/presentation/editor/units.test.ts` builds an unannotated context literal under
  `as symbol`** — the one injection site in that chain where a future required member is skipped
  silently rather than reported by the compiler. Pre-existing, correctly untouched, and named here
  because the compiler is the instrument the rest of that chain relies on.
- **The migration runner is still unproven on a real chain.** `ASSET_PRICE_MIGRATIONS` is a
  SEVENTH empty table, and this increment's schema work was another redefinition rather than a
  version bump — Amendment 1 item 3's withdrawal, extended by one more entity. The risk still
  lands on the first schema change that cannot be a redefinition, and that change should be
  SCHEDULED with the proof in mind.
- **Nothing has DRAWN the Inspector's three-figure block.** The container held no pinned Chromium,
  and the project surface's captures were taken with a substitute build that prints its own
  approximate caveat, so the layout of a three-figure block in a row that already carried two is
  verified by `npm run test-build` in a vault and by nothing here.

## Genuinely undecided, and left so

- **~~Where a user creates a price override.~~ DECIDED by the override increment, see Amendment 4
  item 1 — the paragraph below is kept as written because the reasoning it got wrong is worth
  seeing.** There is no Asset surface at all — slice 10 records
  that nothing anywhere selects an Asset for a user to delete, and the same is true of editing
  one. The entity, the command and the query are built here; the affordance belongs to whichever
  slice first gives the catalogue a screen. Until then the override is reachable through the
  sample seed and through a hand-written note, and **the refusal in `AssignAssetCommand` is
  therefore a dead end for a real user** in a two-currency vault. That is the honest state of it
  and it is the strongest argument for scheduling the catalogue UI next.

  **Why that was wrong.** The wait was on the wrong screen. Pricing a shared asset *for a project*
  is a project's gesture, and the project detail state already existed; a catalogue screen shows
  an asset with no project in hand and would have needed a project picker to host this at all.
  The affordance shipped on the project surface, in the same increment as the entity — which is
  what let [[The cost pipeline is told the currency it must produce]] close rather than merely be
  answered again.
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

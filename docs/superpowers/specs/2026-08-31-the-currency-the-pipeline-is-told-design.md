# Slice 20, first half: the currency the pipeline is told

**This is a delta, not a design.** The design is
[`docs/tasks/20-the-currency-the-pipeline-is-told.md`](../../tasks/20-the-currency-the-pipeline-is-told.md),
which carries Purpose, Scope, the three blockers, Design, Interfaces & Contracts, Persistence
Impact, Testing Strategy, Staying green and a Definition of Done. Restating any of it here would
be the second derivation this project keeps deleting, and the two would disagree the day one is
edited. Read that document and
[[The cost pipeline is told the currency it must produce]] first; the Issue records what was
tried and withdrawn, and a reader who does not know that will try the same three things in the
same order.

What follows is only what is **new or now false**: five measurements that moved, five decisions
the task document could not take or took differently, the split this increment makes, and the
amendments both documents are owed.

## The split, stated first because everything below assumes it

Slice 20 as written is one increment carrying two things: **the currency invariant** and **the
per-project price override**. This increment is the first only.

The reason is the task document's own *Genuinely undecided* section: *"the affordance belongs to
whichever slice first gives the catalogue a screen ... the refusal in `AssignAssetCommand` is
therefore a dead end for a real user."* That screen is being built right now, on
`claude/asset-designer-first-increment-eh5fxq` — Task A10 is a create dialog, B8 an asset
inspector, B9 a picker. So the override is scheduled to land *with* its affordance rather than
several commits before it, and this increment closes the correctness hole on its own.

What this increment does **not** build, each named again in **Amendments owed** below so it cannot
be lost: `AssetPriceOverride` and its two repositories, `AssetPriceOverrideChanged` and its
project-narrowed cascade, the Inspector's three figures, and the effective-cost correction to
`assetMatchesCalculatedFrom`.

That last one is the item most likely to be dropped, so it gets its own sentence. The task
document's Definition of Done item — *"`assetMatchesCalculatedFrom` compares against the
**effective** cost: a Requirement under a price override reads `current`, not a permanent false
`stale`"* — describes a defect that **cannot exist until an override does**. It is not deferred
work on this increment's surface; it is a Definition-of-Done item belonging to the override
increment, and writing it there is the whole of what stops it vanishing into a closed slice's
history.

## Measurements

Taken on `main` at `16f395e`, 2026-08-31, one signature at a time rather than as a set. Three of
these change the work.

| Task document claim | Measured |
| --- | --- |
| `expectedCurrency: Currency`, `Project.currency: Currency` | **There is no `Currency` type.** `Money.currency` is `string` (`core/money/Money.ts:75`), validated by `CURRENCY_PATTERN` in `createMoney` (`:100`) and `of` (`:188`). The type has to be invented. |
| the provenance *"already holds one"* | True, and **so does the note**. `RequirementFrontmatterSchemaV1` declares a single `currency` key (`dto/requirementFrontmatter.ts:41`) and `requirementMapper` hands it to `cost-calculated`, `cost-override` **and** `calculated-from-unit-cost` alike (`:129-133`). |
| *"Both callers gain the `AssetPriceOverride` repository as a dependency"* | With the override deferred, the dependency that actually arrives is a **`ProjectRepository`**: neither `AssignAsset.ts` nor `RecalculateRequirement.ts` holds one, and both take `projectId` from the zone or the requirement. `GetRequirementsForZone` holds `requirements`, `zones`, `assets` and no projects either. |
| `PROJECT_MIGRATIONS`, `REQUIREMENT_MIGRATIONS` | Both empty, as are all six. A v1→v2 step really would be the first non-empty chain the runner has executed outside a synthetic fixture. |
| `Money` is *"a signed quantity"*, non-negativity per field | True, **and `Project` already carries two currencies the document does not mention**: `budget: Money \| null` and `contingency: Money \| null` (`domain/project/Project.ts:15-16`), neither persisted — `ProjectFrontmatterSchemaV1` declares nine keys and neither of these is among them. |
| `inputsStillMatch` is the read-model backstop | True, and it **already compares `asset.unitCost.currency`** (`queries/GetRequirementsForZone.ts:73`). An asset re-denominated already reads stale today. |

Two figures measured because they decided a choice rather than illustrating one:

- **2** currency literals in `src/`, **142** in `tests/`. This is what makes branding `Money`'s
  *output* free and branding its *input* the bulk of a diff.
- **`Migration.migrate(input: unknown): unknown`** is pure and `MIGRATION_SET` is a module-level
  `const`. A step supplying the plugin's `defaultCurrency` cannot reach it without making that
  table a builder — the one table CLAUDE.md keeps single so that two importers cannot drift.

## Decision 1: `Currency` is branded on the way out, not on the way in

`core/money` gains a branded `Currency` and `parseCurrency(raw): Result<Currency, ValidationError>`.
`createMoney`, `of` and `zero` keep their `string` parameters and their existing pattern check;
their **return** type gains `currency: Currency`.

That is honest rather than convenient: those three constructors already refuse a non-conforming
code, so everything reachable through a `Money` has passed the pattern, and the brand states a
fact rather than adding a hope. It also moves none of the 142 test literals.

`parseCurrency` is the one door for the two boundaries that begin with untrusted text —
`settingsFrom` and the project frontmatter schema. `Project.currency` and
`CostPipelineInput.expectedCurrency` are `Currency`, so a caller must obtain one from somewhere
that validated it.

**Stated narrowly, because a brand invites a wider claim than it holds:** this stops a caller
passing a *bare* string, and it does not stop one passing the wrong validated currency. Nothing
type-shaped can; the pipeline's refusal is what catches that, and it is why the refusal exists.

The rejected alternative was branding both directions, so no unvalidated string reaches `Money`
at all. It is the more coherent shape, and it buys a guarantee the validating constructors already
give, for roughly 142 call sites plus every fixture — which would have been the bulk of this
increment's diff, in the increment least able to afford attention elsewhere (see **Testing**).

## Decision 2: no schema bump, and the currency floats until the note is saved

The task document specifies a real v1→v2 step, *"and **this one is a real migration** rather than
a redefinition, because unlike slice 19's Asset schema the Project schema's shape is load-bearing
for existing developer vaults."*

**This increment takes the redefinition.** `ProjectFrontmatterSchemaV1` stays at version 1 and
gains an optional `currency` (`.regex(/^[A-Z]{3}$/).nullable().catch(null)`, slice 19's Asset
pattern); `projectFromPersistence` gains a `defaultCurrency` parameter and applies it when the key
is absent. `PROJECT_MIGRATIONS` stays empty.

Two reasons, and the second is the one that mattered:

- Migrations here run on **read** — `migrateNote`, plus CLAUDE.md's own narrowing that no save path
  calls it — so neither option rewrites a vault. The load-bearing distinction the document draws
  between a migration and a redefinition is smaller than it reads: both answer an absent key at
  read time.
- The step's value would have to come from `defaultCurrency`, which a pure `migrate(input)` cannot
  see. Reaching it means `MIGRATION_SET` becomes `createMigrationSet(settings)`, which is a
  structural change to the table whose single-ness is an asserted property, in service of a
  version number.

**The consequence is behaviour, not a footnote, and it is the whole remedy this increment ships
for a mismatch:** a project note with no `currency:` key **follows the setting**, and keeps
following it until something saves that note, at which point `projectToPersistence` writes the
value and it stops floating. For a single-currency vault that is the feature — set
`defaultCurrency` once and every un-stated project agrees. For a vault with two currencies it is a
footgun, because changing the setting silently re-denominates every project that never stated one,
and Decision 5's backstop is what makes that visible rather than silent.

It is pinned as a test rather than described, so that a later reader who "fixes" the floating fails
a case instead of making this section quietly wrong.

**What is given up, named because the document valued it:** the migration runner stays unproven on
a real chain. That risk is not removed, only postponed to the first schema change that cannot be a
redefinition — and that change should be scheduled deliberately rather than discovered.

## Decision 3: one refusal, in the pipeline

The task document specifies two — `computeEstimatedCost` refusing a mismatch as a
`CalculationError` before any arithmetic, **and** `AssignAssetCommand` pre-checking and refusing
as a `ValidationError` naming both currencies, argued as *"early feedback at the moment a user
acts, in front of a check that also holds without it."*

**One refusal ships:** `computeEstimatedCost` refuses before any arithmetic with a
`CalculationError` coded `cost.currency-mismatch`; `AssignAssetCommand` propagates it and adds no
guard of its own.

`AssignAssetCommand` already fails when the pipeline refuses — it builds the Requirement's figures
through `deriveRequirementFigures`, which is that pipeline — so the second refusal buys wording,
not protection, and pays for it with two codes, two categories and two surfaces for one failure,
which slice 17's policy table then answers for twice. CLAUDE.md's *"two expressions of one
question, three lines apart, drift immediately"* cuts against it, and this codebase has already
paid for the general shape.

**The wording is bought a different way, and it is bought smaller than the document wanted.**
`toUserMessage(language, error)` takes no params — measured; `t(language, key, params?)` gained its
third parameter in slice 19 and `toUserMessage` did not — so the user-facing sentence **cannot name
the two currencies** without widening the one place an `AppError` becomes copy. It names the wrong
*relationship* instead ("this asset's price is not in this project's currency"), and the two values
live in the developer-English `message` for the log line. Widening `toUserMessage` is a deliberate
change to that seam and does not belong inside a currency slice.

The resolution stays with the caller and the check stays with the pipeline: `AssignAsset` and
`RecalculateRequirement` each read the project and pass `expectedCurrency`, while
`deriveRequirementFigures` keeps taking exactly the figures it is given and holds no repository. A
derivation that reached for one would be a second answer to what a Requirement costs.

## Decision 4: the coherence rule the task document does not mention

`Project.create` refuses a `budget` or `contingency` whose currency is not the project's, beside
`negativeAmount` and for the reason that function's own docblock gives: the constructor is
private, so the entity is the one place every path passes, and a Zod refinement would be a second
answer to the same question.

Without it, `Project.currency` is a *third* currency on an entity that already carries two, and
"what currency is this project in" has as many answers as it has fields. Neither field is
persisted, so the rule costs one guard and no schema — and when the frontmatter grows them, the
schema states the shape and this constructor keeps stating the rule.

## Decision 5: the staleness backstop needs no new field, and the two comparisons are two questions

The task document adds `projectCurrency` to `CalculatedFrom`, a `project-currency` key inside the
persisted `calculated-from`, a `REQUIREMENT_MIGRATIONS` v1→v2 step, and a **deliberate
under-report** — the step writing the project's *current* currency so that every migrated
Requirement reads `current` rather than `stale`, since *"the project's currency at the time of the
original calculation is not recoverable."*

**It is recoverable.** The requirement note's single `currency:` key *is*
`calculatedFrom.unitCost.currency` (see **Measurements**), and once Decision 3's invariant holds, that is
by construction the project's currency at calculation time. So: `CalculatedFrom` unchanged, no
schema key, no `REQUIREMENT_MIGRATIONS` step, no under-report, and one Definition-of-Done item and
one Persistence-Impact bullet dissolve rather than being deferred.

The remaining comparison is split by which question each caller asks — and the two callers were
never a shared predicate to begin with. `inputsStillMatch` hand-spelled the same three asset
comparisons `assetMatchesCalculatedFrom` already made, rather than calling it, so "the shared
predicate" describing them was a false claim about the code: they were two copies, not one
function with two callers. The final pass makes them one:

- **The cascade-skip test** — `assetMatchesCalculatedFrom`, used by `onAssetUpdated` — is
  **unchanged**. It already compares `asset.unitCost.currency`, so an asset re-denominated already
  invalidates. Adding a project read here costs one read per project across a shared asset's whole
  fan-out, to answer a question that is not about the asset.
- **The read-model backstop** — `inputsStillMatch` in `GetRequirementsForZone` — now **calls**
  `assetMatchesCalculatedFrom` for the asset half instead of restating it, and gains exactly one
  comparison beside it, `project.currency === recordedFrom.unitCost.currency`, and the query gains
  a `ProjectRepository`. One read per call; the zone supplies the `projectId`.

**What this reads on upgrade is better than either option the document weighed**, which is the
argument for it rather than its cheapness: `stale` for exactly the Requirements really denominated
in something other than their project's currency, and `current` for every other. The document's own
two candidates were a vault-wide false alarm and a vault-wide false reassurance.

**Narrow claim, unchanged from the document:** it reads stale, it is **not** recalculated. Nothing
recalculates until something dispatches, and no `ProjectUpdated` cascade is added.

## The two surfaces

**`defaultCurrency` is a settings row with a control**, and the control is a dropdown over a short
list rather than a text field. Two reasons, the second measured:

- `setControlValue` writes through `saveSettings` on every change, so a text field persists every
  half-typed prefix and `settingsFrom` drops each one back to the default. This is not the
  `libraryFolder` case — nothing moves and nothing is stranded — so a control is legal here; it is
  simply a poor one.
- `MINOR_UNIT_PLACES` finalizes `round` at **two** places (`Money.ts:152`, whose own comment says
  *"every currency this plugin prices in today (USD/EUR/…) has two"*). A zero-minor-unit currency
  rounds wrong. The list is currencies with two minor units, and that constraint is written where
  the list is rather than in this document.

`settingsFrom`'s existing drop-unknown-values behaviour then covers a hand-edited `data.json` for
free, exactly as it does for units — which is the test [[Settings and configuration]] states for
which settings are defaults, met without a new mechanism.

**The project detail state draws the currency beside the lifecycle status** — read-only, one line,
one locale key, no command. It exists so that a user meeting the refusal can see which currency the
project is in without opening the note, and it takes the informational-row shape `libraryFolder`
already established rather than inventing a `SetProjectCurrency` command whose consequence — every
Requirement in the project reading stale — deserves its own increment.

`cost.currency-mismatch` gets copy in both locales. The German must say **Objekt** and not
*Material*, and must leave *Vault* untranslated; `tests/presentation/i18n/strings.test.ts` checks
exactly those two terms and nothing else about the language.

## Testing, and the gate most likely to fail

Beyond the task document's Testing Strategy, minus every item Decision 5 dissolves:

- **The pipeline refusal, both directions**, asserting nothing was computed on the refusing side —
  so the test is not green because the pipeline refuses everything.
- **`expectedCurrency` is required, asserted by the compiler**, in a `.test-d.ts` inside
  `tsconfig.json`'s `include`. A `@ts-expect-error` nothing enforces is a comment.
- **`parseCurrency` both arms**, and that a `Money` from `of`/`zero`/`createMoney` satisfies
  `Currency` — the assignability half of Decision 1, which is the claim a brand actually makes.
- **The coherence guard on both fields**, and the passing direction for each.
- **The mapper's default**: absent key takes `defaultCurrency`, a present key is honoured over it,
  and a round trip writes the value back.
- **The floating currency pinned as behaviour** — absent key, changed setting, different currency —
  so Decision 2's cost fails a case rather than going quietly stale.
- **The backstop's two arms**, the stale one asserted **after a reload**, since a comparison against
  a persisted value is only a backstop if it survives to disk.
- **A regression guard that the cascade-skip test still invalidates a re-denominated asset**, since
  Decision 5 deliberately left `assetMatchesCalculatedFrom` alone and "we didn't touch it" is not evidence.

**Coverage is the risk, and it is the reason to plan each test with its code.** CLAUDE.md measures
branches at 98.02 against a floor of 98 — about one covered unit — and functions at 99.05 against
99. This increment adds branch pairs at `parseCurrency`, the mapper's `??`, the refusal, and the
coherence guard. There is no room to add an arm now and cover it later, and an arm in a slack
metric hides completely: read `coverage-final.json` for the changed files rather than the summary
line, which is the instrument that can see one arm.

## Amendments owed

**To [`docs/tasks/20`](../../tasks/20-the-currency-the-pipeline-is-told.md)** — dated, in the
document, because a list of exceptions kept in two places disagrees with itself:

1. The slice is split; this increment is the currency invariant, and the override is its own.
2. `Currency` did not exist and is branded on output only (Decision 1).
3. No Project schema bump and no `PROJECT_MIGRATIONS` step; the mapper defaults, and the currency
   floats until the note is saved (Decision 2). The Definition-of-Done item promising *"the first
   non-empty chain the migration runner has executed"* is **withdrawn**, not ticked.
4. One refusal, in the pipeline; `AssignAssetCommand`'s pre-check is **withdrawn**, and the copy
   cannot name both currencies because `toUserMessage` takes no params (Decision 3).
5. `Project.create` gains the budget/contingency coherence rule the document does not mention
   (Decision 4).
6. `CalculatedFrom` is unchanged and no Requirement migration is registered; the `project-currency`
   key, the v1→v2 step and the deliberate under-report are **withdrawn as unnecessary** rather than
   deferred (Decision 5). Their Definition-of-Done and Persistence-Impact entries go with them.
7. Deferred to the override increment, by name: `AssetPriceOverride` and its repositories,
   `AssetPriceOverrideChanged` and its project-narrowed cascade, the Inspector's three figures, the
   duplicate-pair diagnostic, the `Asset Prices/` folder and the sixth `ENTITY_TYPES` entry, and
   the **effective-cost correction to `assetMatchesCalculatedFrom`** — which is a defect only once
   an override exists.

**To [[The cost pipeline is told the currency it must produce]]**: its closing question is
answered — *an override **satisfies** the refusal rather than replacing it*, because the pipeline's
check stands for every caller and the override is how a project passes it — and that answer is
recorded in the note. The note stays open with a *Revisit when* naming the override increment,
rather than being closed over code nobody has written.

**To [[Asset library]]**: its open definition-of-done item — *"A project can record its own price
against a shared definition"* — is **not** met by this increment and the epic should not say it is.
It belongs to the override increment.

## What this does not change

- **No currency conversion.** Refused outright elsewhere; nothing here reopens it.
- **No refusal on changing a project's currency.** The consequence becomes visible (Decision 5) and the
  change is not refused. Refusing it is a product decision nobody has asked for.
- **No `Quote` lines, and no tax, discount or shipping work.** §51's, and no-ops today.
- **A hand-written asset note with `currency: JPY`** passes `/^[A-Z]{3}$/` and rounds at two
  places. **Pre-existing** — `dto/assetFrontmatter.ts:28` has carried that pattern since slice 10
  and `MINOR_UNIT_PLACES` has been two since slice 9 — and out of scope here. Recorded so that it stops
  being invisible; the settings list is narrowed to two-minor-unit currencies, which bounds the
  *default* and not a hand-edited note.

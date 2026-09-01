# Slice 20, second half: the per-project price override

**This is a delta, not a design.** The design is
[`docs/tasks/20-the-currency-the-pipeline-is-told.md`](../../tasks/20-the-currency-the-pipeline-is-told.md),
which carries Purpose, Scope, the `AssetPriceOverride` shape, the precedence, the cascade, the
Testing Strategy and a Definition of Done — and whose **Amendment 1 item 7** enumerates this
increment by name. Restating any of it here would be the second derivation this project keeps
deleting, and the two would disagree the day one is edited.

Read that document and [[The cost pipeline is told the currency it must produce]] first. The Issue
records three withdrawn attempts, and a reader who does not know that will try the same three in
the same order.

What follows is only what is **new, now decidable, or now false**: the affordance the task document
could not place, four decisions it does not take, one port method its contract block omits, one
correction that is this increment's Definition-of-Done item, and the residuals.

## What this increment is

The first half — the pipeline's refusal, `Project.currency`, the `defaultCurrency` setting and the
staleness backstop — landed on 2026-09-01. It closed the correctness hole and opened a usability
one, which the Issue states plainly:

> In a two-currency vault the refusal is therefore a **dead end**, with no way to price a shared
> asset in the project's own currency.

This increment is the way out of that dead end. Its close condition is the Issue's own, and it is a
witness rather than an assertion: **an assign that refuses on a currency mismatch, then a price
override in the project's currency, then the *same* assign succeeding.**

## Decision 1: the affordance is a project-detail section, not the catalogue screen

Amendment 1 item 7 defers *"where a user creates an override, which waits on the catalogue screen"*.
That deferral is **withdrawn**, and the reason is that the wait is no longer necessary — three facts
measured on `main` at `8c9e1e4`:

- **`ListAssets` is already vault-wide and unfiltered.** Its own docblock: *"since design slice 19
  there is no project to narrow by either: one library serves every project."* It takes no argument.
  The picker a catalogue screen would have supplied already exists as a query.
- **Design slice 21 built a project-scoped surface.** `ProjectDetail.vue` draws one project and its
  plans, with `ProjectDetailState.vue` owning the store and the dialog.
- **An override is project-wide, so a project-scoped surface is where it belongs.** This is the
  stronger half of the argument and it is not about cost. The override is per-(project, asset);
  every requirement in the project referencing that asset moves with it. A control that edits a
  project-wide fact must sit on a surface whose subject is the project.

That last point is also why the **Inspector's requirement row was rejected** as the home, though it
is where the refusal is actually hit and would have been the cheaper edit. `RequirementRow.vue`
already carries two override controls, and both are requirement-scoped. A third control that looked
identical and silently repriced every other requirement in the project would be the two-questions-
that-merely-look-alike defect this repository has already paid for twice, expressed in a template.

**The section lists the whole catalogue, prices optional.** Every asset in the library, one row:
the shared default, this project's price or a dash, and the control that sets or clears one. No
picker, no add flow — the list is the form, and the empty state is *the library has no assets yet*.
The rejected alternative was a sparse list of overrides plus a picker dialog; it scales better past
a large catalogue and it hides the comparison against the shared default until a row exists, which
is the comparison [[A manual override is stored as an override, beside what it replaced]] asks for.
**Recorded as the trigger rather than as a closed question:** a vault whose library outgrows one
readable list is when the sparse-plus-picker shape becomes right, and nothing here forecloses it.

## Decision 2: the coherence rule is the COMMAND's, not the entity's

**Corrected after review.** The first draft put it on `AssetPriceOverride.create`, taking the
project's currency and refusing a `unitCost` denominated in anything else — on the reasoning that
the constructor is private, so the entity is the one place every path passes, which is what
Amendment 1 item 5 says about `Project.create`'s budget/contingency rule.

That reasoning does not transfer, and a review bot found the contradiction it produced. The
difference is **whose fact the currency is**. `Project.create` compares two of its OWN fields.
Here the project's currency belongs to another entity, so the rule can only be enforced by
TELLING the constructor — and the constructor is on the hydration path too. Follow it through and
the spec contradicts itself:

- Every persisted override is rebuilt through `create`, so the mapper must supply a currency.
- Supply the **project's**, and a note that has drifted from it is REFUSED at the read — so a
  stranded override becomes invisible rather than visible-and-wrong, which is the opposite of what
  this document's own residuals promise, and it silently hides a note the user can see on disk.
- Supply the **override's own**, and the check is tautological on every read: it can never fire.

So the rule moves to `SetAssetPriceOverrideCommand` (Decision 2a), which is where a user's intent
actually arrives, and `AssetPriceOverride.create` keeps only what it can own alone: a unit cost
may not be negative. Hydration constructs through the same `create`, unconditionally, and a
mismatched note is **read, shown and refused by the pipeline** — which is what makes both of this
document's residuals true rather than aspirational.

**It is still not a second expression of the pipeline's refusal**, and that distinction survives
the move intact. The pipeline asks *may this figure be computed*, and it is not invoked at all
when a price is set; this asks *is this override capable of ever being used*. Without it, setting
a GBP price on a EUR project succeeds silently and the user discovers it at the next assign, which
is the failure this whole increment exists to end. It is not the guard Amendment 1 item 4 withdrew:
that one duplicated a check on the very path it sat in front of.

**The general shape, and it is this repository's own:** a rule that reads as belonging to an entity
belongs there only if the entity holds every fact it compares. When one of them is another
entity's, "the constructor is the one place every path passes" stops being an argument for the
entity and becomes an argument against it, because hydration is one of those paths.

## Decision 2a: the two commands, named

The first draft named neither, and said only "the affordance" and "the create path" — which a
review bot reported as unschedulable, correctly: the surface has no operation to dispatch, and a
direct repository write would not drive the cascade.

- **`SetAssetPriceOverrideCommand`** — upsert on the **pair**, not on an id. "Set the price for
  this asset in this project" is one intent whether or not a note exists, and the id is a ULID the
  caller does not hold. It checks both endpoints exist, enforces Decision 2's currency rule against
  the project it just read, saves conditionally, and publishes `AssetPriceOverrideChanged` **only
  after a successful save** — an announcement whose write failed would recalculate a project
  against a price no note holds.
- **`ClearAssetPriceOverrideCommand`** — removes it, so the catalogue default applies again. A pair
  with no override reports `cleared: false` and **announces nothing**: nothing moved, and an
  announcement for a no-op is how a project's whole requirement set gets recalculated because a
  control was clicked twice.

## Decision 2c: the pair is a uniqueness claim, so the commands hold it

Three things follow from "one override per (project, asset)", and a review round found the spec
asserting the claim while specifying none of them.

**Both commands lock the pair.** `getForPair` then `save('absent')` is check-then-act, and
`'absent'` is keyed by the entity's own id — so two concurrent sets would each read `null`, mint
different ULIDs, and both inserts would succeed. The repository's per-entity queue cannot help,
because the two ids differ. `AssignAssetCommand` already solved exactly this shape, locking both
endpoint ids as one sorted batch so that *"two tabs assigning concurrently serialize here, the
second taking the idempotent path"*; these commands take the same mechanism.

**Clearing clears the PAIR, not one note.** The read tolerates a duplicated pair and answers one
of them, deliberately, because the notes are user-editable. Clearing must be stricter: deleting
only the note the read returned leaves the other standing, so a user who pressed "use the library
price" is told it worked, watches the cascade run, and still has their own price in force.
`cleared: true` has to mean the project has no price for this asset.

**These are not in tension.** Tolerating a duplicate on READ is about not making a vault
unreadable; refusing to CREATE one and clearing all of them is about not lying to a user. The
repository stays permissive and the commands are strict, which is the same division
`warnOnDuplicate` and its callers already have.

## Decision 2b: deleting an asset deletes its price overrides

Also found by review, and it is a dangling reference this document did not consider.
`DeleteAssetCommand` gathers its referents from `requirements.listByAsset` alone
(`DeleteAsset.ts:79`), and `resolvedReferents` is typed `readonly RequirementId[]`. So an asset
carrying a price override and **no** Requirement is deleted with no referents observed, and the
override's `asset` id dangles.

The damage is worse than a stale field, because of Decision 6's join: `ListProjectAssetPrices`
builds its rows from `listAll`, so an override whose asset is gone renders in **no** row. The note
is unreachable through the UI, unlistable, and undeletable by the user who made it.

**The overrides go WITH the asset; they are not referents that refuse it.** A referent is work that would be
orphaned and that a user must decide about — the four choices
[[A delete reports what references it and offers four choices]] describes. A price for a deleted asset is not a decision:
it names nothing, no Requirement can be derived from it, and there is no other outcome to offer.
The precedent is the sibling increment's own — an asset's geometry sidecar is deleted with the
asset, for the same reason.

It goes **inside the existing delete-resolution sequence**, under the same locks and the same
compensation, rather than beside it: a delete interrupted between the overrides and the asset must
be recoverable exactly as one interrupted between the requirements and the asset already is.

## Decision 3: the port needs `listByAsset`, which the contract block omits

The task document's `AssetPriceOverrideRepository` declares `getForPair`, `listByProject`, `save`
and `delete`. Decision 5 below needs a fifth:

```ts
listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>>;
```

It is the read `onAssetUpdated` performs **once for a whole fan-out**, and it is what makes that
correction cost one query rather than one per requirement.

## Decision 4: one resolution, one function

```text
effectiveUnitCost = override(project, asset)?.unitCost ?? asset.unitCost   ← an INPUT
effectiveCost     = requirement.estimatedCost.override
                    ?? f(quantity, effectiveUnitCost)                      ← the OUTPUT
```

The precedence is the task document's and is unchanged. What it does not say is **where the `??`
lives**, and the answer is one shared `resolveEffectiveUnitCost`, not a lookup spelled out at each
of `AssignAsset` and `RecalculateRequirement`. Those two are the callers slice 10 deliberately
routed through one derivation; giving them two copies of the resolution would undo that at the
level above it. *"Two expressions of one question, three lines apart, drift immediately"* — and
this repository has paid for that four times, most recently in the increment this one continues,
where the read and the write resolved a project currency from two different fields.

`deriveRequirementFigures` stays a pure function of the figures it is given and holds no
repository, exactly as the first half left it. A derivation that reached for a repository would be
a second answer to *what does this requirement cost*.

## Decision 5: the skip-test correction, and the cheap fix that is wrong

This is Amendment 1 item 7's last clause — *"the effective-cost correction to
`assetMatchesCalculatedFrom`, which is a defect only once an override exists"* — and it is this
increment's Definition-of-Done item rather than a gap in the first half.

**The defect.** `calculatedFrom.unitCost` records what the figures were computed from, which under
an override is the *effective* cost. `assetMatchesCalculatedFrom(calculatedFrom, asset)` compares
it against `asset.unitCost` — the catalogue default. So every overridden requirement mismatches
permanently: `onAssetUpdated` never skips it, and `inputsStillMatch` reports it `"stale"` forever.
That is the false-mismatch regression the task document's Testing Strategy names.

**The cheap fix is wrong, and it is named here so that nobody has to discover it.** *"An
`AssetUpdated` cannot move a figure derived from the project's own price, so skip overridden
requirements entirely"* reads as both cheaper and truer, and it is false: measured at
`deriveRequirementFigures.ts:108-117`, the predicate compares the **unit symbol** as well as the
amount and the currency, and its own comment says why — *"an `m2 → ft2` change is exactly as
capable of invalidating them as an `m2 → m` one."* An overridden requirement whose asset's unit
changed is invalidated exactly as much as any other. The override replaces one of the three
compared fields, not the question.

So the predicate takes the **effective** cost, and the read is batched at each of its two callers —
which is what answers Amendment 1's own cost objection to touching this path, *"one read per
project across a shared asset's whole fan-out"*:

- **`onAssetUpdated`** — `listByAsset(assetId)` once, into a `Map<ProjectId, Money>`, before the
  filter at `onAssetUpdated.ts:66-68`. One extra query for the whole fan-out, whatever its size.
  The requirement carries its own `projectId`, so the per-requirement resolution is local.
- **`inputsStillMatch`** in `GetRequirementsForZone` — `getForPair`, memoised per pair, the same
  shape that query already uses for `projectCurrency` and for the same reason.

**The two callers stay two questions.** Amendment 1 item 6 split them deliberately —
`assetMatchesCalculatedFrom` asks about the asset, `inputsStillMatch` asks whether a read model may
report `"current"` — and this correction is applied to the shared predicate's *input*, not by
merging them again.

## Decision 6: one query for the section, and where the three figures come from

`ListProjectAssetPrices(projectId)` joins `ListAssets`' catalogue with `listByProject`'s overrides
and answers the rows the section renders: asset id and name, the catalogue default, this project's
override or `null` — **and, where there is one, that override's id and revision**, because clearing
or replacing it is a conditional write and a row that cannot supply an `Expected` would force the
view to re-read before every save. One query returning a DTO, rather than a view calling two and
joining them in Pinia — a join in a store is a read model nothing can test without mounting
something.

The Inspector's **three figures** (§89's *beside what it replaced*, at both levels) come from
`RequirementInspectorDTO` gaining a `unitCost: { catalogue, projectOverride, effective }` group
beside the `quantity` and `cost` groups it already carries. The row then shows the shared default,
this project's price, and the requirement's own figure, each labelled and the one in force marked.

## Decision 7: the note is named by its own id, like every other nameless entity

**This decision was taken the other way first, and the correction is the more useful record.**
An earlier draft had the Obsidian repository resolve the asset note's path through the index and
take its basename, so a user would browse `Asset Prices/Porcelain Terrace Tile.md` — which is the
task document's own illustrative path. It is not implementable, and it is not what the codebase
does:

- **`NoteWriteSpec.entryName` is `(entity: TEntity) => string`** (`noteEntityWrite.ts:63`), a pure
  function of the entity. A friendly name needs the asset's, which the override does not carry, so
  the only routes to it are denormalising an `assetName` onto the entity — drift, refused
  everywhere else here — or bypassing `saveNoteBackedEntity`, which is the shared save sequence.
- **The nearest sibling already answers it.** `ObsidianRequirementRepository`'s `requirementFileName`
  returns `` `${requirement.id}` ``, under the comment *"Filename is never identity (§83); the id
  alone keeps requirement notes findable and unambiguous."* A `Requirement` is the other nameless
  entity here, and it is nameless for the same reason: it is a relationship, not a thing with a
  name. `entryName: (asset) => asset.name` is the pattern for entities that HAVE one.

So the note is `Asset Prices/<AssetPriceOverrideId>.md`. It costs the browsability the task
document's example implies and buys the shared write path, no index read at insert, and no
fallback branch — which matters, because the spec's own coverage note counts branches and that
fallback was one of them.

**The draft was written from the task document's illustrative YAML rather than from the code's
rule for a nameless entity**, and it survived until the implementation plan tried to write the
`entryName` line. That is the plan-writing step doing its job, and it is this repository's own
recurring shape: a claim that reads as settled until somebody asks the code.

## Persistence

`<projectFolder>/Asset Prices/`, a sixth `ENTITY_TYPES` entry (`renovation-asset-price`, joining
the five at `ProjectIndex.ts:16-22`), schema version 1, and the slice 3 module pattern throughout.

The folder is the **project's**, not the library's, because
[[Work belongs to one project, catalogues belong to the vault]] puts every consequence of using a
shared definition in the project that raised it. The asset is the library's; the price this project pays for it is not.

**Uniqueness is on the pair, and a duplicate is a diagnostic rather than a refusal.** Ids are
ULIDs, so two notes for one (project, asset) is a state nothing structurally prevents. The lookup
is by pair; a second one logs and last-writer-wins, the shape `warnOnDuplicate` already uses for
duplicate ids in the index. Refusing to read a project's prices because a user duplicated a note is
worse than reading one of them and saying so — the notes are user-editable markdown.

## Testing, and the gate most likely to fail

**The witness first, because it is the Issue's close condition** and because every other case here
passes without it. It is an **application-level** test and needs no component mounted — which is
what lets it land with commit 2 below rather than waiting for the surface: assign refuses with `cost.currency-mismatch`, an override is created in the
project's currency, the same assign succeeds, and the requirement's `estimatedCost` is denominated
in the project's currency. Satisfaction demonstrated rather than asserted.

Then the cases whose absence would leave a defect that reads as working:

- **The precedence**, with both overrides live — asserting the requirement override is in force AND
  that moving the price override moves `calculated` without moving the effective figure. A test
  with one override at a time passes against either precedence.
- **The false-mismatch regression, both arms** — an overridden requirement reads `"current"` from
  the read model, and `onAssetUpdated` skips it when nothing it depends on moved.
- **The unit arm of that same correction**, which is what stops Decision 5's wrong cheap fix being
  reintroduced: an overridden requirement whose asset's unit changed is NOT skipped.
- **The narrowed cascade** — a price override changed in project A leaves project B's requirements
  on the same asset untouched. A single-project fixture passes against a cascade that ignores the
  narrowing entirely.
- **The duplicate-pair diagnostic** — two notes for one pair, asserting the `warn` call AND that a
  price is still returned. Asserting only the warning passes against a build that then refuses.
- **The create refusal** — a `unitCost` in a currency that is not the project's, refused at the
  COMMAND (Decision 2), with the companion case that a note already carrying one is still READ:
  asserting only the refusal passes against a build that also hides the stranded note.
- **The pair's uniqueness under concurrency** (Decision 2c) — two sets racing on one pair leave
  ONE override, driven as a real race rather than sequentially; and a clear over a hand-seeded
  duplicate leaves NONE. Each fails against the version without the lock.
- **The section hears about out-of-band changes** — a price note arriving by sync moves the row.
  Nothing tells it today: the two existing project change sources filter to `renovation-project`
  and `renovation-plan`, so an open pane would draw the vault it read at mount, indefinitely.
- **Deleting an asset takes its price overrides with it** (Decision 2b), including the case that
  makes it a defect rather than an untidiness: an asset with an override and NO requirement, which
  today deletes with no referents observed. Assert the override is gone, not merely that the delete
  succeeded — it succeeds either way.

**Branches are the metric to watch, and the headroom is one covered unit.** This increment is
branch-heavy: the `??`, the create refusal's two sides, the duplicate fork and the two batched
resolutions. Do not read a figure from any document as current —
run `npm run test:coverage`, and read `coverage-final.json` for the changed files rather than the
summary line, because at this margin an untested arm in a slack metric hides completely and one in
a tight metric fails the gate outright. Plan the test with the code.

## Staying green

Four commits, each passing `npm run check` on its own:

1. **The domain module, both repositories and the shared contract test** — built, wired, called by
   nothing. The shape slice 15 used for its two unreached dialogs, and for the same reason: the
   caller is the next commit.
2. **`resolveEffectiveUnitCost` in both commands, and the `assetMatchesCalculatedFrom`
   correction** — together, because the correction is only correct once something resolves an
   override, and the resolution is only safe once the predicate stops false-mismatching.
3. **`AssetPriceOverrideChanged`, its narrowed cascade, `ListProjectAssetPrices` and the DTO
   group.**
4. **The section on `ProjectDetail.vue`**, and the manual case that walks it in a vault.

The **witness lands with commit 2**, where the mechanism first exists. Commit 4 is what makes it
*reachable by a user*, and those are two different claims: the Issue's dead end is about a user
having no way to price a shared asset, so the note closes on commit 4 and not on the green test.

## Amendments owed

**To [`docs/tasks/20`](../../tasks/20-the-currency-the-pipeline-is-told.md)**, dated, in the
document, because a list of exceptions kept in two places disagrees with itself:

1. Amendment 1 item 7's deferral of *"where a user creates an override"* is **withdrawn, not
   carried**: the affordance ships here, on the project detail state, and it never needed the
   catalogue screen (Decision 1).
2. The port gains `listByAsset`; the contract block's four methods are five (Decision 3).
3. `AssetPriceOverride.create` gains a coherence rule the document does not mention (Decision 2).
4. The note is named by its own id, so the illustrative path `Asset Prices/Porcelain Terrace
   Tile.md` is **not** what ships (Decision 7). `Asset Prices/<AssetPriceOverrideId>.md` is.
5. Every Definition-of-Done item Amendment 1 item 7 deferred is ticked **or** amended here — none
   is left to be inferred from this increment having happened.

**To [[The cost pipeline is told the currency it must produce]]**: its *Revisit when* is met and
the note **closes** — but only once the witness above is green, which is that note's own
instruction: *"Until that pair is green, the answer above is a decision without an end-to-end
witness."*

**To [[Asset library]]**: its open definition-of-done item — *"A project can record its own price
against a shared definition"* — is met by this increment and the epic should say so.

## Residuals, recorded rather than fixed

- **Setting a price is not undoable.** `ProjectDetail` has no `CommandHistory` — `CreatePlanCommand`
  dispatches directly on that same surface — so the price commands do too. Consistent with the
  surface rather than with the Inspector's overrides, which are undoable because the plan editor
  has a stack. Written down because the asymmetry reads as an oversight otherwise, and because the
  remedy is a stack on the project surface, which is an increment rather than a line.
- **A project's currency can move under existing overrides.** There is no `UpdateProject` command —
  `src/application/commands/project/` holds `CreateProject.ts` and nothing else — but a project
  note with no `currency:` key follows the `defaultCurrency` setting, which the first half pinned
  as a test, so changing that setting re-denominates the project and strands its overrides. The
  requirements go `"stale"` through the backstop; the section would show a price in a currency the
  project no longer prices in, with nothing saying so. **Not fixed here**, and the cheapest honest
  remedy is named so the next author does not redesign it: a marker on that row, derived per read
  from the two currencies, never stored.
- **A hand-edited price note can disagree with the project's currency.** Decision 2's rule is on
  the COMMAND, and the notes are user-editable, so such an override is **read and shown** — which
  is deliberate, and is what the second residual's marker is for. The assign it feeds refuses at
  the pipeline; that message names the wrong relationship, because `toUserMessage` takes no params.
  That widening is the first half's recorded residual and is not reopened here. Refusing the note
  at the READ was the alternative and is rejected: it makes a note the user can see on disk
  invisible to the plugin, which is the same trade the duplicate-pair rule already refuses.

## What this does not change

- **No currency conversion.** Refused outright and elsewhere; nothing here reopens it.
- **No `Quote` lines.** [[Asset]] is explicit that the override is the MVP answer *because* a Quote
  is not one.
- **No tax, discount, shipping or surcharge work.** §51's, and no-ops today.
- **No second refusal at `AssignAssetCommand`.** Amendment 1 item 4 withdrew it and this increment
  does not re-add it: the command builds its figures through `deriveRequirementFigures`, which is
  the pipeline, so it already fails on a mismatch.
- **`CalculatedFrom` gains no field.** Amendment 1 item 6 withdrew `projectCurrency` as unnecessary
  rather than deferring it; the note already carries the value. **Do not re-add it.**

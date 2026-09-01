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

## Decision 2: a coherence rule on `create`, mirroring the first half's

`AssetPriceOverride.create` takes the project's currency and refuses a `unitCost` denominated in
anything else. The constructor is private, so the entity is the one place every path passes — which
is the reason Amendment 1 item 5 gives for `Project.create`'s own budget/contingency rule, applied
to the same question one level down.

**This is not a second expression of the pipeline's refusal**, and the distinction is what keeps it
from being the guard Amendment 1 item 4 withdrew. The pipeline asks *may this figure be computed*.
This asks *is this override capable of ever being used* — and an override in a currency the project
does not price in is a dead entry: it can only ever make the assign it was created to rescue refuse
again, with a message about a mismatch the user just created. The two questions have different
answers on different inputs, which is the test for whether a second check is duplication.

A Zod refinement was available and is refused for that function's own stated reason: it would be a
second answer to the same question, on the read side only.

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

## Decision 7: the note is named after the asset's note, and identity is still the id

An `AssetPriceOverride` has no name of its own — it is a pair — so `fileNameFor` has nothing to
derive from. The Obsidian repository resolves the asset note's path through the index it already
holds (`ProjectIndex.getPath(assetId)`) and takes its basename, falling back to the asset id when
the index has no entry.

Three things that makes true, and one it does not:

- The note a user browses is `Asset Prices/Porcelain Terrace Tile.md`, which is the task document's
  own example.
- Nothing is denormalised, so nothing drifts: the name is derived at insert and never read back.
- [[Identity is the id, never the filename, title or path]] is untouched — reads resolve through
  the index, and this only names what a write creates.
- It does **not** rename the price note when the asset is renamed. Deliberate, and the same
  behaviour every other note here has.

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
  entity.

**Branches are the metric to watch, and the headroom is one covered unit.** This increment is
branch-heavy: the `??`, the create refusal's two sides, the duplicate fork, the fallback in
Decision 7, and the two batched resolutions. Do not read a figure from any document as current —
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
4. The note's filename derives from the asset note's basename through the index (Decision 7), which
   the document's example implies and does not state.
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
  `create`, and the notes are user-editable. Such an override is read, and the assign it feeds
  refuses at the pipeline — correct, and the message names the wrong relationship, because
  `toUserMessage` takes no params. That widening is the first half's recorded residual and is not
  reopened here.

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

---
type: Task
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 40
dependsOn:
  - "[[10-assets-requirements-and-the-end-to-end-loop]]"
  - "[[15-modals-and-confirmation-dialogs]]"
  - "[[18-a-project-owns-its-folder]]"
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
# Design Slice 19: The Asset Catalogue Leaves the Project

## Purpose

Slice 10 built `Asset` as a project-owned entity: a `projectId` field, a `project:` frontmatter
key, an index entry on the project axis, notes under `<projectFolder>/Assets/`, and a command
that **refuses** a Zone and an Asset belonging to different projects. Every one of those was
correct against §59 as it read on 2026-08-25.

On 2026-08-26 the product owner amended §59, and
[[Work belongs to one project, catalogues belong to the vault]] now splits ownership in two.
Work stays project-scoped; `Asset`, `Supplier` and `Trade` are defined once in a library folder
and any project may reference any of them. The rule states its own persistence consequence:
*"A catalogue entry carries no project id at all — an absent id is the rule being kept, not a
migration that has not run."*

This slice makes that true of the code. It is a correction, not a feature — nothing a renovator
can do afterwards that they could not do before, except reference one asset from two projects.

**Slice 10's document already carries the new criteria.** `main` rewrote its Definition of Done
in the same pass that amended the rule: 47 of its 54 items are word-for-word what slice 10 built
and are ticked, and **seven are open and are exactly this slice's work**. That document is the
specification; this one is the plan for satisfying it, plus the two slice-15 items the amendment
dragged in with it.

## Scope

### In scope

- `Asset` loses `projectId`: the domain type, the Zod schema, the mapper, the index axis, and
  the folder.
- The **library folder** plugin setting (§83), its move-and-rebuild migration, and §83's overlap
  refusal in both directions.
- Every query and command that filtered or refused on an asset's project.
- `ListRequirementsReferencing` returning referents **grouped by project**, with `projectName`
  and `projectPath` — because a shared asset's references are no longer all in the project the
  user is looking at.
- Slice 15's items **6** and **6a**: the row mapping for those groups, and `t` interpolation,
  which exists because the first interpolated string in the plugin is that row's label.
- The seven open items in
  [`10-assets-requirements-and-the-end-to-end-loop.md`](10-assets-requirements-and-the-end-to-end-loop.md).

### Out of scope (covered by other slices)

- **`Supplier` and `Trade`.** The rule names three catalogues; two do not exist as entities —
  `Asset.supplier` is free text, and `Trade` is Epic 8. So this slice creates the library folder
  and puts `Assets/` in it, and **creates neither `Suppliers/` nor `Trades/`**: a folder with
  nothing that can live in it is a promise, not a structure. The setting is named for the
  library, not for assets, so those two arrive by adding a repository rather than by moving one.
- **`Project.currency`, the per-project price override, and `expectedCurrency`** — slice 20, and
  the reason they are not here is the whole of the next section.
- **An Asset delete affordance.** Slice 10's document records the gap: `DeleteAssetCommand`
  exists and *nothing anywhere selects an Asset for a user to delete*. So this slice asserts the
  two-row case against the row mapping directly and builds no end-to-end version of it. Whichever
  slice first gives an Asset a delete affordance owns that.
- The per-project folder work — slice 18, which this one depends on.

## What is LOST, and what does not replace it

`AssignAssetCommand` refuses `zone.projectId !== asset.projectId` today. Once an asset has no
project the comparison has no operands, and the refusal goes. The unit-kind check stays
untouched; it was never about ownership.

**The invariant lost is not "a cross-project link".** That link is now correct — it is what
sharing means. What is lost is a consequence nobody had written down: while catalogues were
project-scoped, **every unit cost feeding a project's estimates came from that project's own
catalogue, and was therefore in one currency by construction.** Sharing removes the construction
and nothing else supplies it. Slice 10's own Design section reaches the same conclusion
independently, under *Sharing did create one new way for a pairing to be wrong*.

**Nothing in this slice replaces it, and that is a decision rather than an omission.** The
obvious replacement — refuse a currency mismatch at `AssignAssetCommand` — was drafted three
times and withdrawn three times; [[The cost pipeline is told the currency it must produce]]
records each attempt and why. The one that matters here: *a project's currency is a setting the
user may change afterwards, so an assign-time refusal sits on the wrong side of the fact it
depends on.* The check belongs to the cost pipeline, where every future caller inherits it
instead of each one remembering, and it is unimplementable until a `Project` has a currency to
require. That is slice 20.

So between this slice and slice 20, an EUR-priced asset assigned into a GBP project produces an
estimate that is arithmetically correct and denominated in EUR, with nothing anywhere saying so.
**That window is open on purpose and is written into slice 10's criterion**, which asserts the
project pairing and explicitly settles nothing about the currency of the estimate it produces.

Two second-order consequences, both real and neither obvious:

- **`ListReassignmentTargets`'s header promises more than it can now deliver.** It reads *"so
  slice 15's picker cannot OFFER a target that fails validation."* The query is handed a
  `ReferencedTarget` — an asset id with no project — so it cannot know which projects' rules a
  candidate must satisfy. The comment is narrowed to what it still does (area-kind, not-self,
  and for a Zone target still same-project); the sentence goes rather than standing while false.
- **An asset delete now collects referents across several projects.** No mechanism breaks —
  `affectedBefore`, `resolvedReferents` and the `SequenceMarker` are all keyed by id. What breaks
  is the dialog: a flat count reads as "in the project I am looking at", which is exactly what a
  shared asset's references are not. Hence the grouped query below.

## Design

### `Asset` without a project

```ts
// domain/asset/Asset.ts — the field, the constructor arg, and the withChanges omission all go
-	readonly projectId: ProjectId;
```

`withChanges` currently reads `Partial<Omit<CreateAssetProps, 'id' | 'projectId'>>` with the
comment *"`id` and `projectId` are identity and ownership — neither is editable."* The `Omit`
loses one member and the comment loses one clause. **The clause is deleted, not rewritten to say
the field is absent** — a comment explaining why a field that does not exist is not editable is
the kind of sentence that outlives everything around it.

`AssetCreated` / `AssetUpdated` / `AssetDeleted` carry `AssetEventPayload { assetId, projectId }`.
`projectId` goes. Nothing subscribes to it — the cascade subscriber keys on `assetId` and re-reads
requirements by asset — which the compiler confirms by the payload type narrowing.

### The schema: version 1 is redefined, not bumped

`project` is removed from `AssetFrontmatterSchemaV1` and `ASSET_MIGRATIONS` **stays empty**, so
the asset schema stays at version 1. The version is DERIVED from the registered steps
(`MigrationRunner.latestVersions`), so "stays at 1" is a consequence of adding no step rather
than a constant left alone.

The justification is a fact rather than a preference: **slice 10 has never been merged to
`main`** (`git log main..HEAD` at the time of writing shows the whole slice unmerged), so
`schema-version: 1` for Asset has never been released. There is no user vault holding one. A
v1→v2 step would migrate developer vaults and this repository's own test vault and nothing else,
and it would spend a schema version on a shape nobody ever read.

**The check that keeps this honest is `tests/release/`** — the manifest/tag pairing and the
CHANGELOG section — plus `git log main..`. If either says an Asset schema reached a release, this
paragraph is wrong and the bump is mandatory. It is written as a conditional for that reason.

`z.object` is non-strict, so a developer-vault note still carrying `project:` parses fine and the
key is simply ignored. That is not good enough on its own: the rule's sentence is about the
*bytes*, not the type. So `assetFromPersistence` strips the key, and the note is rewritten
without it on its next save — with a test that a note carrying `project:` round-trips to a note
that does not.

**What that test cannot reach**, stated narrowly: a note nobody ever saves again keeps the stale
key on disk forever. There is no sweep and there will not be one — an unused frontmatter key in
a user's own markdown is inert, and a vault-wide rewrite to remove it costs more than it buys.

### The index axis

Cheaper than it looks. `ProjectIndex` already has `getIdsByType`, and `ProjectIndexEntry.projectId`
is already optional. So:

- Asset entries are upserted **without** a `projectId`, and therefore drop off
  `getIdsByProject` by construction — no filter, no exclusion list.
- `AssetRepository.listByProject(projectId)` becomes `listAll()`, over
  `getIdsByType('renovation-asset')`.

One type constraint does break, and it is the one that steers the change:

```ts
// noteEntityWrite.ts
export async function saveNoteBackedEntity<
	TEntity extends { readonly id: EntityId<string>; readonly projectId: ProjectId }
>(…)
```

Asset and Requirement share that function; Requirement keeps its project and Asset does not. The
constraint drops the `projectId` member and `NoteWriteSpec` gains
`projectId: (entity: TEntity) => ProjectId | undefined`, which the upsert passes straight through
to an already-optional field. **Two call sites, two compile errors, and no third place to
forget** — the check is `vue-tsc`.

### The library folder setting

```ts
export interface RenovationPlannerSettings {
	units: Units;
	projectFolder: string;   // slice 18: where a NEW project starts
	libraryFolder: string;   // §83: one per vault, the shared catalogues live here
}
```

Both ends through `settingsFrom`, like every other field — `data.json` is a trust boundary, and a
path that arrives empty falls back to the default on the way in **and** on the way out.
`SettingsTab` gains one more definition and needs no new branch, because `getControlValue` /
`setControlValue` are keyed generically.

The default is `Renovation/Library`, which is PRD §36's drawing. **It is only legal because slice
18 landed first**: under the pre-18 shape `Renovation` *is* the project folder and
`foldersOverlap('Renovation/Library', 'Renovation')` is true, so the default §36 draws would be
refused by the rule §83 states. After slice 18 the project folders are `Renovation/Kitchen Refit`
and friends, and the library is their sibling. This is the dependency made concrete.

### Changing it is a migration

[[Settings and configuration]] states the shape and ADR-011 already priced it as the reason to
avoid a configurable path where one can be avoided. Here it cannot: a shared library has no
project folder to derive its location from. So the cost is accepted, and this is the sequence:

1. **Validate.** Non-empty after trimming, `normalizeFolder`, then `foldersOverlap` against
   **every** project folder. Refuse on any hit, naming which project.
2. **Move.** `fileManager.renameFile` every catalogue note from the old library to the new, so
   vault links survive.
3. **Rebuild** the Project Index from the new root list.
4. **Persist** — and only now. A failure at any earlier step leaves `data.json` untouched.

**Order 4-after-2 is the whole point of calling it a migration**: persisting first leaves every
project resolving an empty library while the notes sit at the old path, which is the failure
[[Settings and configuration]] names in its own words.

The overlap check runs **in both directions**, because either path can be the one that moves:
creating a project and changing a project's folder (slice 18's two sites) test the new project
folder against the library; moving the library tests it against every project folder. All three
call `foldersOverlap`, so there is one predicate and three refusals, not three predicates.

**Partial moves are not compensated**, identically to slice 18's migration and for the same
reason: a reverse move can fail the same way and leave no coherent shape. A diagnostic names
what moved, the setting is not persisted, and this is the documented cost rather than a bug.

### Grouped references

```ts
interface ReferencingGroup {
	readonly projectId: ProjectId;
	readonly projectName: string;
	/** Only where `projectName` is not unique among the groups returned. */
	readonly projectPath?: string;
	readonly requirementIds: readonly RequirementId[];
}
```

A Zone target always yields exactly one group — a Zone belongs to one project — so the Zone flow's
existing single row is unchanged in appearance and changed in derivation. An Asset target yields
one group per project that references it.

`projectPath` exists because `Project.create` trims a name and rejects only an empty one, so **two
projects may legitimately share a name** and nothing refuses it. Without the path, two groups are
indistinguishable to the caller and slice 15 renders two identical rows for the two things the
user is choosing between. It is supplied only where the name is ambiguous, which is why it is
optional: a path shown beside every row is noise on the common case.

**The grouping is asserted on the QUERY.** Whether a group becomes a row is slice 15's rule and
slice 15's test — the boundary that document draws for itself, and the reason its item 6 asserts
the row mapping rather than a flow.

### `t` interpolation

`t(language, key)` takes two arguments and every string in `en.ts` is fixed text. The row label
above is the first string in the plugin with a value inside it, so:

```ts
export function t(language: string, key: StringKey, params?: Readonly<Record<string, string>>): string
```

One pass over the template filling `{name}` holes; an unmatched hole is left standing as
`{name}` rather than blanked, because a visible hole is a bug report and an empty string is a
silent one. `tr` forwards the third argument. Every existing two-argument call is unchanged,
which the compiler enforces by the parameter being optional.

**One key per label, never a translated fragment concatenated with a name** — word order and the
punctuation around an interpolated name are the translator's to choose, which is
[[Multilanguage]]'s rule and slice 15's own note on the same line.

`tests/presentation/i18n/strings.test.ts` already asserts that `de.ts` translates every key
`en.ts` declares. It gains the interpolation half: **any key's German translation names the same
holes as its English one**, asserted per key rather than for the two keys this slice adds. A check
enumerating these two would go stale at the next interpolated string, and the rule is about the
locale files rather than about these labels.

## Interfaces & Contracts

```ts
// application/ports/AssetRepository.ts
-	listByProject(projectId: ProjectId): Promise<Result<Loaded<Asset>[], PersistenceError>>;
+	listAll(): Promise<Result<Loaded<Asset>[], PersistenceError>>;

// application/queries/ListAssets.ts — the picker lists the vault's catalogue
-	execute(projectId: ProjectId): …
+	execute(): …

// application/queries/ListRequirementsReferencing.ts
	execute(target: ReferencedTarget): Promise<Result<readonly ReferencingGroup[], PersistenceError>>;

// presentation/read-models/planEditorQueries.ts
-	listAssets(projectId: string): …
+	listAssets(): …
```

Deleted outright: `requirement.cross-project` from `AssignAssetCommand` and from
`ReversibleAssignAssetCommand`; the asset half of `reference.cross-project-reassign` in
`DeleteAsset`. **The Zone half in `DeleteZone` stays**, and slice 10's rewritten criterion says
the asymmetry is *"the thing a later reader is most likely to tidy back into symmetry"* — which
is why both halves are asserted rather than only the changed one.

## Persistence Impact

```text
Renovation/Library/          ← the library folder, one plugin setting (§83)
└── Assets/                  ← and nothing else, until Supplier and Trade exist
Renovation/Kitchen Refit/
├── Project.md
├── Plans/  Zones/  Requirements/  Geometry/
```

An Asset note loses its `project:` key. No version bump — see the schema section, and the
condition under which that is wrong.

## Testing Strategy

The seven open criteria in slice 10's document are the specification; this is how they are
driven.

- **The removed refusal is replaced by its inverse, not by an absence.** A deleted refusal leaves
  no test behind and nothing notices the guard being reintroduced. So the test asserts that one
  Asset assigns successfully into Zones from **two different Projects**, and that each resulting
  Requirement carries its own Zone's `projectId`.
- **`ListAssets` lists the vault**, driven with assets and two projects, asserting that both
  projects' pickers offer the same list.
- **Grouping** — a fixture where one Asset is referenced from two Projects. A bare total fails it.
- **`projectPath`** — a fixture whose two Projects share one `name`. This is the case nothing
  refuses, so the fixture is the only thing that can produce it.
- **Both reassign halves** in one test file, per the asymmetry note above.
- **The overlap refusal in both directions**, each at its own call site with its own error.
- **The library move** — success, and a failure at step 2 asserting `data.json` unchanged.
- **`t` interpolation** — a filled hole, an unmatched hole surviving as `{name}`, an existing
  two-argument call unchanged, and the per-key locale-parity assertion.

**Coverage.** Branches are at 98.02 against a floor of 98 — roughly 0.4 of a branch of headroom.
The new arms here are `t`'s unmatched-hole path, `projectPath`'s present/absent fork, the library
migration's four steps, and the `NoteWriteSpec.projectId` undefined arm. Each is tested in the
commit that adds it. **Deletions help**: removing three refusals removes three branches from the
denominator as well as the numerator, so this slice is likelier than most to end level.

## Staying green

1. **`t` interpolation and the locale-parity test.** Purely additive, no caller. Green.
2. **The library folder setting, its migration, and the overlap refusal** — with `Assets/` still
   resolving to the project folder. The setting exists and is validated; nothing reads it for a
   path yet. Green.
3. **Asset loses `projectId`, and the catalogue moves in the same commit.** These cannot be
   split: the domain type, the schema, the mapper, the write spec's constraint and the folder all
   fail to compile independently, and either half alone is a released state where the rule is
   half-kept — an asset in the project folder with no project id, or one in the library still
   claiming a project. Green only at its end.
4. **The grouped query and slice 15's row mapping.** Green.

## Definition of Done

The seven items in
[`10-assets-requirements-and-the-end-to-end-loop.md`](10-assets-requirements-and-the-end-to-end-loop.md)
are this slice's criteria and are not restated here — restating them is the second derivation
this project keeps deleting, and they would disagree the day one is edited. What follows is what
this slice owes **beyond** them.

- [ ] `Asset` declares no `projectId`, `AssetEventPayload` carries none, and
      `AssetFrontmatterSchemaV1` has no `project` key — checked by the type and by
      `tests/build/` finding no `asset` module naming `ProjectId`.
- [ ] `ASSET_MIGRATIONS` is still empty and the snapshot's `schemaVersions.asset` is still 1,
      **and `git log main..` plus `tests/release/` confirm no
      Asset schema has been released.** If either says otherwise this box cannot be ticked and a
      v1→v2 migration is required instead — the criterion carries its own falsifier because the
      justification is a fact about history, not a judgement.
- [ ] A note carrying a leftover `project:` key parses, and round-trips to a note that does not.
      **Narrow claim**: a note nobody saves again keeps the key; there is no sweep.
- [ ] `saveNoteBackedEntity`'s constraint no longer requires `projectId`, and an Asset entry is
      upserted without one — asserted by `getIdsByProject` returning no asset ids for a project
      whose assets the vault holds, and `getIdsByType('renovation-asset')` returning them all.
- [ ] `libraryFolder` round-trips through `settingsFrom` in both directions, falls back to the
      default for an empty or non-string value, and an undeclared key in `data.json` is dropped.
- [ ] Changing `libraryFolder` **moves the notes, rebuilds the index, and persists only then** —
      asserted by failing the move at step 2 and checking `data.json` still holds the old value.
      A partial move reports a diagnostic naming what moved and attempts no reverse move.
- [ ] `foldersOverlap` refuses in **both** directions at all three sites §83 names — creating a
      project, changing a project's folder, moving the library — each with its own error naming
      what the user did. One predicate, three refusals.
- [ ] Only `Assets/` is created under the library folder. `Suppliers/` and `Trades/` are not,
      and the setting's own comment says why: a folder with nothing that can live in it is a
      promise, not a structure.
- [ ] `ListReassignmentTargets`'s header no longer claims the picker cannot offer a target that
      fails validation. **Checked by review, not by a gate** — a narrowed comment is not
      something lint can see, and saying so is the honest form of this item.
- [ ] `t(language, key, params?)` fills holes in one pass, leaves an unmatched hole standing, and
      leaves every existing two-argument call unchanged. `de.ts`'s translation of **any** key
      names the same holes as `en.ts`'s, asserted per key rather than for the keys added here.
- [ ] Slice 15's items 6 and 6a are ticked in **its** document, by this slice, with a dated note
      saying so — the same shape slice 10 used when it closed 8 and 8a.
- [ ] `npm run check` passes, and `vitest.config.ts` records a fresh measurement.

## References

**PRD**: §36 (amended); §59 Entity Relationship Rules (amended 2026-08-26 — the amendment this
slice implements); §72 Currency Model; §83 Configuration Model; §84 Custom Types.

**Business rules**: [[Work belongs to one project, catalogues belong to the vault]] — the rule,
including its persistence sentence ·
[[An asset's unit kind must match the dimension its requirement is derived from]] — the check
that stays · [[A mismatched unit or currency is an error, not a coercion]] — and
[[The cost pipeline is told the currency it must produce]] for why it does not reach this case.

**Requirements**: [[Asset library]] · [[Settings and configuration]] — the library folder and its
migration, in the product owner's own words · [[Multilanguage]] — the one-key-per-label rule.

**Slices**: [10](10-assets-requirements-and-the-end-to-end-loop.md) — its seven open criteria are
this slice's ·
[15](15-modals-and-confirmation-dialogs.md) — items 6 and 6a ·
[18](18-a-project-owns-its-folder.md) — the prerequisite ·
[20](20-the-currency-the-pipeline-is-told.md) — what this slice deliberately leaves open.

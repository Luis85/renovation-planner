---
type: Task
parent: "[[Foundation and composition root]]"
order: 50
dependsOn:
  - "[[04-persistence-and-repository-layer]]"
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
# Design Slice 18: A Project Owns Its Folder

## Purpose

PRD §83 puts **project folder** under Project Settings and **default folders** under Plugin
Settings. The code has one plugin setting, `projectFolder`, and every project nests directly
inside it. That was correct while a project folder was the only location a note could have.
The 2026-08-26 amendment ends that: §36 now draws two roots, and §83 forbids the library
folder and a project folder from overlapping in either direction.

Under today's shape that rule cannot be stated, let alone checked. `Renovation/` is the
project folder, so the library's own drawn default — `Renovation/Library/` — is *contained by
it*, and a literal reading of §83 refuses the default §36 draws. The disagreement is not about
paths, it is about **what the words "project folder" name**: §83 means one renovation's folder,
the code means the root every renovation shares. Slice 19 cannot state its overlap refusal
until that is settled, which is why this slice comes first.

There is a second reason, and somebody else recorded it first.
[`04-persistence-and-repository-layer.md`](04-persistence-and-repository-layer.md) carries a
prerequisite added 2026-08-26 and deliberately not built there: `collectNotes` skips any file
whose path does not start with the project folder and `VaultChangeAdapter` returns early on the
same test, so **a library that is a separate root is invisible to the Project Index and to the
vault-change pipeline**. That note hands the decision to "whoever next touches this pipeline —
scanning and watching a list of roots is the obvious shape."

It also says, in a correction to its own first draft, that **"it bites in every valid
configuration, not eventually"** — because §83 forbids the library and a project folder from
containing one another, and §36 draws the project folder as `Renovation/Kitchen Refit/` rather
than the `Renovation/` parent, so the library is *never* inside the scanned root. **There is no
grace period, and that is the same sentence as this slice's own purpose**: both halves of the
problem are the word "project folder" meaning one renovation's folder rather than the root they
share. So the index work lands here rather than becoming a fourth seam.

This slice adds no entity, no command, no rendering and no user-visible feature. It moves one
setting and rewrites what resolves a path.

## Scope

### In scope

- **ADR-0013** (corrected from "ADR-012" throughout this document — 0012 was already taken by
  slice 9's [`0012-price-component-placement-in-the-cost-pipeline.md`](../development/adrs/0012-price-component-placement-in-the-cost-pipeline.md)
  by the time this slice was written), deciding whether a project's folder is a stored field or
  is derived from where its `Project.md` note sits. Written before the code, because the two
  answers produce different schemas and the ADR is the artefact that survives the choice.
- `RenovationPlannerSettings.projectFolder` becomes the **default location for a new project**,
  and is renamed to say so. It stops being the answer to "where is this entity."
- A per-project folder, reaching every path `paths.ts` derives: `Plans/`, `Zones/`,
  `Requirements/`, `Geometry/` (ADR-011 unchanged — still derived, still never configured).
- `NoteVaultDeps.projectFolder` is removed. Five repositories cache
  `normalizeFolder(deps.projectFolder)` in their constructors; a per-project folder cannot be a
  constructor field, so folder resolution moves to the write, per entity.
- **The Project Index and the vault-change pipeline take a LIST of roots**, closing slice 4's
  recorded prerequisite. One root today, several the moment slice 19 lands.
- ~~A one-time migration for vaults holding the single-folder layout.~~ **Withdrawn.** The
  derived shape makes the existing single-folder layout a valid project folder already, so
  nothing has to move. See *The migration* below and the design document's *No migration*.
- ~~`foldersOverlap`, the pure predicate §83's rule needs, and its refusal at the two sites that
  exist in this slice (creating a project, changing a project's folder). The third site — moving
  the library — is slice 19's, and calls the same function.~~ **Corrected.** `foldersOverlap` has
  no caller in this slice: under the derived shape, changing a project's folder is a user
  dragging a folder in Obsidian's file explorer, with no command and no refusal point, and §83's
  overlap rule is library-versus-project, which does not exist until slice 19. ~~A pure export
  with no caller in `src/` fails `npm run analyze`.~~ **Corrected again — Task 9 measured this
  false too.** fallow treats a test file as an entry point, so an export with only a TEST caller
  stays live; what actually fails the gate is a new FILE nothing imports at all, reported as
  unused. `foldersOverlap` and `IndexRoots` still move to slice 19, with their caller — because
  they have no work to do in this slice, not because a gate would refuse them for lacking one.
  See `CLAUDE.md`'s slice 18 record and the design document's *The three corrections*
  (`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`).

### Out of scope (covered by other slices)

- The **library folder** setting and everything downstream of it — slice 19. This slice makes
  its overlap rule statable and its index multi-root; it does not add it.
- `Asset` losing `projectId`, and the catalogue moving — slice 19.
- `Project.currency` and the per-project price override — slice 20.
- Any UI for choosing a project's folder beyond what the settings surface already draws. Slice
  16 owns creation forms; a project's folder is chosen at creation, and until that slice exists
  the only creators are `CreateProjectCommand` and the sample seed.

## Dependencies

Slice 4 (the repositories, the index, the vault-change pipeline, the migration runner). Nothing
else. It is deliberately ahead of slice 19 and blocks it.

## Design

### The decision ADR-0013 owes

Two shapes, and the ADR picks one rather than this document doing it quietly:

**A stored field.** `Project.folder`, persisted as `folder:` in the note, schema-bumped. It is
what §83's word "setting" literally says. Its cost is ADR-011's own argument, made there against
a configurable sidecar folder: *"there is no setting left holding a path that has quietly gone
stale."* A stored folder can go stale — a user moves the folder in Obsidian's file explorer and
the field still names the old one.

**Derived from the note's location.** A project's folder is the folder its `Project.md` is in.
Nothing is stored, nothing goes stale, and moving a project in Obsidian is moving a folder —
which is exactly the property ADR-011 chose the project-scoped sidecar folder to preserve. Its
cost: §83 says "setting", and this makes it not one; and discovery has to find `Project.md`
notes before it can bound anything else, which is a real change to the index's scan order.

**The recommendation is the derived one**, on ADR-011's precedent, and the ADR has to say
explicitly why [[Identity is the id, never the filename, title or path]] does not forbid it —
that rule governs *identity*, and a folder is location, but the rule's name reads as though it
settles this and it does not.

Everything below is written against the derived shape. If the ADR chooses the stored field, the
index section is unchanged and the migration gains a step.

### Roots, and why the index takes a list

**Withdrawn — the root list is not what ships, and this heading is the last place in this
document still presenting it as though it were.** The design document replaced the list with a
DECLARED bound: a note is ours because it carries our `type` and a non-empty `id`, so the scan
and the pipeline are bounded by what a note says about itself and there is no root list to
build, register or agree on. `IndexRoots` moves to slice 19 with `foldersOverlap`. Everything
below is left as written, as the record of what was proposed — including the two corrections
already noted inside it, which correct claims made about a shape that then did not ship. The
Definition of Done further down records the same withdrawal against the items that named it.

`buildProjectIndexEntries` becomes two ordered passes over a **root list** rather than one pass
over a prefix:

```text
roots: readonly string[]      ← one per project folder, plus (slice 19) the library folder
   ↓
collectNotes(root) for each   ← unchanged inside; only the bound is per-root
   ↓
joinSidecars(root)            ← only for roots that are project folders
```

The list is built by scanning for `type: renovation-project` notes first and taking each one's
parent folder. That is one extra pass over `vault.getMarkdownFiles()` at `onLayoutReady`, and
the cost is worth naming rather than discovering: the scan already walks that list once, so this
is a second walk of the same array, not a second read of every file. `frontmatterOf` is what
costs, and it is called on the same set either way.

**Corrected.** That last sentence is false and cited §102 for a claim §102 does not support:
`collectNotes` filters by path prefix *before* calling `frontmatterOf`, so the call count is not
unchanged — a 10,000-note vault with twenty notes under `Renovation/` costs twenty calls today
and ten thousand after. The call is a `MetadataCache` map lookup plus an `EchoWindow` digest
check rather than a file read, which is why the added cost is likely acceptable, but "the same
set either way" was never true. See *The cost, named* in
[`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md).

**A note of ours under no root is skipped with a diagnostic**, the same shape `note-excluded`
already has. That is a behaviour change worth stating. Today a note outside `projectFolder` is
skipped *silently*, correctly, because everything outside the one folder is somebody else's
note. With a root list, a note carrying our `type` and a valid `id` and sitting under no root is
a different thing — an orphan — and saying nothing about it is how a project the index cannot
see looks identical to a project that does not exist.

**Withdrawn.** This diagnostic is not built. It depends on the root-list shape this document
proposed, which the design document replaced with a declared bound: every note this plugin owns
already carries `type` and `id`, so under the shape actually built there are no orphans — a note
of ours anywhere in the vault is found and indexed, and there is nothing to report. See *The
orphan diagnostic goes away, and this is the honest sentence* in
[`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md).

`VaultChangeAdapter` takes the same list and the same predicate. **One function answers "which
root is this path under", and both callers use it.** The full scan and the incremental run
disagreeing about a note is the defect `stringField` was already extracted to prevent; this is
the same shape one level up.

### What replaces `deps.projectFolder`

Five repositories resolve their folder in a constructor today. A per-project folder is not known
then, so each save resolves it from the entity being written:

- **Project**: its own folder is where its note goes. On INSERT there is no note yet, so the
  folder comes from the command input, defaulted from the plugin setting — which is the whole of
  what that setting still does.
- **Plan, Zone, Requirement**: from the owning project, through the index. Every one of these
  already carries a `projectId`, so no field is added and no lookup is invented —
  `index.getPath(projectId)` and `parentOf` give the folder, and `parentOf` already exists in
  `paths.ts` for the compensating-create path.
- **Geometry sidecars**: unchanged in rule (project folder + `Geometry/`, ADR-011), changed only
  in which string "project folder" resolves to.

`paths.ts`'s functions already take the folder as their first argument (`plansFolderFor(folder)`),
so their signatures do not move. What moves is who computes the argument.

**A project whose folder cannot be resolved is a `PersistenceError`, never a fallback to the
default.** Writing to a defaulted path when the real one is unknown is how a note lands in a
parallel tree beside the user's work — the exact failure slice 1 refused defaults for, and its
reasoning ("a setting that names a path is not a preference") applies here unchanged.

### `foldersOverlap`

**Withdrawn from this slice — not built here.** This whole subsection describes a predicate this
slice does not ship. `foldersOverlap` has no caller in this slice: under the derived shape there
is no command that changes a project's folder (a user drags a folder in Obsidian's file
explorer instead), and §83's overlap rule is library-versus-project, which slice 19 introduces.
~~A pure export with no caller in `src/` fails `npm run analyze`, so building it here would fail
the gate it exists to keep green.~~ **Corrected again — Task 9 measured this false too.** fallow
treats a test file as an entry point, so an export with only a TEST caller stays live; what
actually fails the gate is a new FILE nothing imports at all, reported as unused. `foldersOverlap`
and `IndexRoots` still move to slice 19, with their caller — because they have no work to do in
this slice (no command changes a project's folder, and no library exists yet to overlap with),
not because a gate would refuse them for lacking one. See `CLAUDE.md`'s slice 18 record and the
design document's *The three corrections*
(`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`). The subsection below
is left as written, as the record of what was proposed.

```ts
/** §83: two configured paths may be neither equal nor contain one another. */
export function foldersOverlap(a: string, b: string): boolean
```

Segment-aware after `normalizeFolder`, so `Renovation Library` is not "inside" `Renovation`:
equal, or one is the other plus `/` and more. Three arms, three tests, and the third is the one
a naive `startsWith` gets wrong — it is written first and watched failing.

It is pure and lives in `paths.ts`, the one place a path is taken apart or put together. It has
two callers here and a third in slice 19. **The refusal is at each call site, not inside the
predicate**, because the three sites produce three different errors naming three different
things a user did.

### The migration

**Withdrawn, not built — this whole section describes work that does not happen.** Under the
derived shape ADR-0013 chose, an existing vault's `Renovation/Project.md` with
`Renovation/Plans/…` beside it already *is* a valid project folder — "the folder its `Project.md`
sits in" answers `Renovation/` without moving anything — so there is nothing to move and no
migration step is registered. See *No migration* in
[`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md),
the later measurement. The section below is left as written, as the record of what was proposed
and why it turned out not to be owed.

A vault holding the single-folder layout has `Renovation/Project.md`, `Renovation/Plans/…`,
`Renovation/Zones/…` — every project sharing one folder. After this slice, each project needs
its own.

**This is a note MOVE, and the migration runner cannot do it.** `MigrationRunner` chains pure
functions over plain frontmatter objects at read time (`migrateToLatest(kind, raw, fromVersion)`);
it never touches a file. So the folder migration is its own mechanism, run once at
`onLayoutReady` before the index scan, and it is written down here rather than filed under
"migration" as though the existing machinery covered it.

The sequence, which is the same shape slice 19's library move uses:

1. Detect the old layout: a root holding `Project.md` **and** the per-kind folders directly.
2. Per project, create `<root>/<project name>/` and `fileManager.renameFile` its note and every
   entity note the index attributes to it. `renameFile` rather than `vault.rename`, because it
   is what fixes links in other notes — a user's own wikilink into a plan note must survive.
3. Rebuild the index from the new roots.
4. Only then persist the settings change.

**A partial move is possible and is not compensated**, and this is the honest sentence: a
failure at file 40 of 90 leaves 40 moved. Step 4 then does not run, the old setting stands, and
the next load meets a layout that is neither shape. So the migration reports a diagnostic naming
what it moved and stops; it attempts no reverse move, because a reverse move can fail the same
way and there is then no shape at all. This is a real cost of the decision, named rather than
designed around — the alternative is a transaction over Obsidian's file API, which does not
exist.

**A single-project vault — which is every vault this plugin has ever produced — moves in one
folder rename.** So the failure window above is the multi-project case, and there are none yet.

**Corrected.** That claim is not true: `create-sample-project` run twice seeds two projects into
the same folder, because `freshNotePath` dedupes the second `Project.md` with an id suffix, so
the second write succeeds rather than colliding. The multi-project case this paragraph called
untested and not-yet-reachable is reachable today by running one command twice. The claim was
load-bearing for the decision above not to design the partial-move failure window carefully, and
it was wrong — see the design document's *The three corrections*
(`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`).

## Interfaces & Contracts

**Corrected — this block is an undated sketch, not what ships.** The design document is
explicit: "`IndexRoots` is not declared. `foldersOverlap` is not declared. Both belong to
slice 19, which has callers for them." Neither symbol below is declared by this slice; both
are left in the block as the record of what was proposed before the design document settled
the two open decisions. See
[`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md).

```ts
// paths.ts — new, pure
export function foldersOverlap(a: string, b: string): boolean;

// ProjectIndex — the scan's bound becomes plural
interface IndexRoots {
	readonly projectFolders: readonly string[];
	readonly library?: string;
}
```

`library` is optional and unused here. It is declared now rather than in slice 19 because the
alternative is slice 19 widening a type slice 18 shipped, and the field costs nothing while
absent. **Nothing in this slice reads it**, and that is the narrow claim: the multi-root
machinery is proven with several project folders, not with a library, because there is no
library yet to prove it with.

`NoteVaultDeps.projectFolder` is deleted. That deletion is the compile-error surface this slice
is steered by: five repositories and two pipeline modules stop building at once, and each is
converted in the same commit because `vue-tsc` runs first in `npm run build`.

## Persistence Impact

No new note kind and no frontmatter change **if ADR-0013 chooses the derived shape**. If it
chooses the stored field, `Project` gains `folder:` and the project schema goes to 2 — which means
registering a real v1→v2 step in `PROJECT_MIGRATIONS`. There is no version CONSTANT to edit:
`MigrationRunner.latestVersions` derives each kind's version from the steps registered for it, so
a step ending at 2 is what makes the version 2, and a bump with no step to reach it is not
expressible.

New vault layout, per PRD §36:

```text
Renovation/                     ← the plugin setting: where a NEW project starts
├── Kitchen Refit/              ← a project folder
│   ├── Project.md
│   ├── Plans/  Zones/  Requirements/  Geometry/
└── Bathroom/
    └── …
```

## Testing Strategy

- ~~`foldersOverlap` — node, three arms plus the segment case, written before the predicate.~~
  **Withdrawn — not this slice's test to write.** `foldersOverlap` moves to slice 19, with its
  caller; see the correction under *`foldersOverlap`* above.
- The root-list scan — the existing index tests, extended to two projects. **The two-project
  fixture is the point**: every index test today has one project, and a one-project fixture
  passes against a scan that still uses a single prefix.
- ~~The orphan diagnostic — a note of ours under no root, asserted on the `warn` call. A category
  invariant checked at the logger rather than by enumerating placements.~~ **Withdrawn.** Under
  the declared bound actually built there are no orphans; see the withdrawal note under *Roots,
  and why the index takes a list* above.
- Folder resolution — driven through the repositories, asserting the PATH a note landed at, for
  two projects whose folders differ. Asserting only that the write succeeded would pass against
  a repository that wrote both into one folder.
- The unresolvable-project refusal — a `PersistenceError`, driven by removing the project's index
  entry between a caller's read and its save.
- ~~The migration — the fake vault, one project and then three, plus the partial-failure case
  asserting that the setting was NOT persisted and that the diagnostic names what moved.~~
  **Withdrawn.** No migration is built; see the withdrawal note under *The migration* above.

**Coverage.** Branches sit at 98.02 against a floor of 98 — about 0.4 of a branch of headroom
(`vitest.config.ts` carries the measurement, taken on the merged tree 2026-08-26). ~~This
slice's new arms are `foldersOverlap`'s three, the root-resolution miss, the orphan skip, and
the migration's detect and partial arms.~~ **Corrected.** Three of those four sources are
withdrawn or deferred: `foldersOverlap`'s arms move to slice 19, and the orphan skip and the
migration's arms are not built at all. What this slice's new arms actually are is the design
document's own accounting — `entityRefOf`'s misses, `freshProjectFolder`'s collision fork, and
the folder-resolution miss — see
[`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md#testing-strategy).
**Every one gets its test in the commit that adds it**, because one uncovered branch fails the
gate. That is arithmetic here, not a style preference.

## Staying green

Three commits, and the ordering is what keeps `npm run check` passing at each:

1. ~~`foldersOverlap` and the root-list types, with nobody calling them. Pure additions, fully
   tested, no behaviour change.~~ ~~**Corrected — this commit would fail the gate it was written
   to keep green.**~~ **Corrected again — Task 9 measured this false too, and the falsehood
   reaches this outer conclusion, not only the premise it was drawn from.** `foldersOverlap` has
   no caller in this slice: under the derived shape, "changing a project's folder" is a user
   dragging a folder in Obsidian's file explorer, with no command and therefore no refusal
   point, and §83's overlap rule is library-versus-project, which does not exist until
   slice 19. ~~A pure export with no caller in `src/` fails `npm run analyze`.~~ fallow treats a
   test file as an entry point, so an export with only a TEST caller stays live; what actually
   fails the gate is a new FILE nothing imports at all, reported as unused — so this commit
   would NOT have failed `npm run check`, and the struck bold clause above claiming otherwise is
   wrong for the same reason. `foldersOverlap` and `IndexRoots` still move to slice 19, with
   their caller — because they have no work to do in this slice, not because a gate would
   refuse them for lacking one — see `CLAUDE.md`'s slice 18 record and the design document's
   *The three corrections*
   (`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`).
2. **The conversion.** `NoteVaultDeps.projectFolder` deleted, five repositories and both pipeline
   modules converted, index tests extended. Atomic by necessity — the deletion is what fails the
   build, and a half-converted tree does not compile.
3. ~~The migration and the settings rename.~~ **Corrected — the migration half is withdrawn,
   not built.** See the withdrawal note under *The migration* below. Only the settings rename
   remains owed by this commit.

## Definition of Done

- [x] **ADR-0013 exists and is Accepted**, stating whether a project's folder is stored or
      derived, naming ADR-011's precedent, and saying explicitly why
      [[Identity is the id, never the filename, title or path]] does not forbid the derived
      shape — the rule reads as though it settles this and it does not.
- [ ] ~~`foldersOverlap` refuses equal paths and containment **in both directions**, and accepts
      two paths sharing a name prefix without a segment boundary (`Renovation` and
      `Renovation Library`). The third case is watched failing against a plain `startsWith`.~~
      **Deferred to slice 19, not ticked:** `foldersOverlap` has no caller in this slice.
      ~~A dead export fails `npm run analyze`~~ was the reason first given, and Task 9 measured
      it false: fallow treats a test file as an entry point, so an export with only a test
      caller stays live. `foldersOverlap` still moves to slice 19 because it has no WORK to do
      in this slice — no command changes a project's folder under the derived shape, and no
      library exists yet to overlap with — not because a gate would refuse it for lacking a
      caller. See the correction under *`foldersOverlap`* above and `CLAUDE.md`'s slice 18
      record.
- [x] ~~The Project Index scans a LIST of roots~~, covered by a fixture with **two** projects in
      **different** folders, both fully resolvable. A single-project fixture passes against the
      single-prefix scan this replaces, so the two-project fixture is the check. **Corrected:**
      there is no root list. The design document replaced it with a declared bound —
      `entityRefOf` reads `type`/`id` off a note's own frontmatter, so a project anywhere in the
      vault is found without a list of where to look — and the two-project fixture still proves
      the same thing a root list would have: `perProjectFolders.test.ts`'s "writes two projects'
      plans into two different folders" and `index.test.ts`'s "indexes a note of ours that sits
      outside the configured folder" between them exercise two projects in two different
      folders, both resolvable.
- [x] ~~`VaultChangeAdapter` watches the same list~~, asserted by modifying a note in the second
      project and observing the index update. Same reasoning: one project proves nothing here.
      **Corrected the same way**: no list, same declared bound — `pipeline.test.ts`'s "indexes a
      note of ours created outside the configured folder" drives a note in a second, unlisted
      folder through the incremental path and observes the index update.
- [x] ~~Both halves answer "which root is this path under"~~ through **one** function, checked by
      that function having exactly two callers. The defect being guarded is the full scan and
      the incremental run disagreeing about a note — what `stringField` already exists to
      prevent one level down. **Corrected:** there is no "which root" question left to answer —
      `entityRefOf` answers "is this note ours" (a declared `type` plus a non-empty `id`), not
      which of several roots a path falls under. `entityRef.test.ts`'s "is named by exactly two
      modules in `src/`, and they are the scan and the pipeline" is the check the item actually
      asks for, unchanged: one function, exactly two callers, pinned rather than assumed.
- [ ] ~~A note of this plugin's under no root is skipped **with a diagnostic**, asserted on the
      logger call. Today it is skipped silently and correctly; with a root list, silence hides
      an orphaned project.~~ **Withdrawn, not ticked:** under the declared bound actually built,
      there are no orphans — a note of ours anywhere in the vault is found and indexed — so there
      is nothing to report. See the design document.
- [x] Every entity's note lands in ITS OWN project's folder, asserted on the resulting path for
      two projects at once. `NoteVaultDeps.projectFolder` no longer exists, checked by the type.
- [x] A save that has to CHOOSE a location — an INSERT — whose project folder cannot be
      resolved returns a `PersistenceError` and writes nothing, never a write to the defaulted
      path. Driven by removing the index entry between the read and the save. **Narrowed from
      "a save" to "an insert" on this branch:** once existence resolves through the index, an
      UPDATE writes where the note already sits and resolves no folder at all, so a refusal
      there could only refuse a save that had nothing to decide — which is what `markStale` was
      doing, on notes it had just read successfully. See *A folder that cannot be resolved is a
      refusal* in the design document.
- [x] Geometry sidecars still resolve as ADR-011 specifies, now inside the per-project folder,
      asserted through `PlanGeometryStore` against two projects.
- [ ] ~~The one-time migration moves a single-folder vault to per-project folders using
      `fileManager.renameFile` (so vault links survive), rebuilds the index, and persists the
      setting **only after** the move succeeded — asserted by failing the move partway and
      checking that `data.json` still holds the old value.~~
- [ ] ~~A partial move reports a diagnostic naming every note it moved, and attempts no reverse
      move. Asserted because this is the documented cost rather than a bug: the test pins the
      behaviour, it does not argue it is desirable.~~ **Both withdrawn, not ticked:** the
      one-time folder migration and its partial-move diagnostic. The derived shape makes the
      existing single-folder layout a valid project folder already, so nothing has to move. See
      *No migration* in
      [`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md).
- [x] `npm run check` passes, and `vitest.config.ts` records a fresh measurement — floors rise
      only if a finished increment measures above them.

## Manual verification

[[A Project Owns Its Folder]] is the **canonical procedure** for this slice's walkthrough in
a real vault, expanding implementation-plan Task 10's five sketched steps into eighteen. This
document records what the runs found; the case file owns the steps themselves. It has not
been run as of this writing — its own Runs table says so.

## References

**PRD**: §36 Vault Data Model (as amended 2026-08-26); §59 Entity Relationship Rules; §83
Configuration Model — the folder split and the overlap rule; §102 Performance Budgets, for the
scan cost named above.

**ADRs**: [ADR-011](../development/adrs/0011-project-scoped-geometry-sidecar-folder-and-file-extension.md) —
its rejected alternative is this slice's argument in miniature, and its "a project moves as one
folder" consequence is what the derived shape preserves. **ADR-0013 is owed by this slice** and
now exists: [ADR-0013](../development/adrs/0013-a-project-folder-is-derived-from-its-note.md). Every "ADR-012"
above is corrected to "ADR-0013" — 0012 names
[ADR-0012](../development/adrs/0012-price-component-placement-in-the-cost-pipeline.md), slice 9's
price-component-placement ADR, which this slice never owed and did not write.

**Slices**: [04](04-persistence-and-repository-layer.md) — owns the index, and records the
multi-root prerequisite this slice closes; [19](19-the-asset-catalogue-leaves-the-project.md) —
blocked on this one.

**Business rules**: [[Work belongs to one project, catalogues belong to the vault]] ·
[[Identity is the id, never the filename, title or path]]

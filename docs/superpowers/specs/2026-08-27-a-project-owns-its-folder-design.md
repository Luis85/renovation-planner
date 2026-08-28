# Design slice 18 — A project owns its folder

**Date:** 2026-08-27
**Slice document:** [`docs/tasks/18-a-project-owns-its-folder.md`](../../tasks/18-a-project-owns-its-folder.md)
**Baseline:** `main` at `3384084` (slice 11 + slice 14 polishing pass merged).
Last recorded coverage, on the merged slice-11+14 tree: statements 99.35, branches 98.14,
functions 99.36, lines 99.58 (`vitest.config.ts`). Re-measure before relying on it — the
polishing pass merged after that entry was written and recorded no figure of its own.

## Purpose

PRD §36 draws two roots and §83 forbids the library folder and a project folder from
containing one another. Neither statement is expressible today, because the code's
`projectFolder` setting is the root *every* project shares while §83's words mean *one
renovation's* folder. Slice 19 cannot state its overlap refusal until that is settled.

Slice 4 recorded the second half of the same problem as a prerequisite it deliberately did
not build: `collectNotes` skips any file whose path does not start with the project folder
and `VaultChangeAdapter` returns early on the same test, so **a library that is a separate
root is invisible to the Project Index and to the vault-change pipeline**.

This slice makes a project own its folder, and closes that prerequisite. It adds no entity,
no command and no rendering.

## What this document changes about the slice document

The slice document is the specification and remains so. Brainstorming on 2026-08-27 settled
its two open decisions and, in doing so, found three claims in it that do not survive contact
with the code. All five are recorded here; the slice document is not rewritten, and where the
two disagree **this document is the later measurement**.

### The two decisions

1. **The ADR chooses the derived shape.** A project's folder is the folder its `Project.md`
   sits in. Nothing is stored; nothing goes stale.
2. **The Project Index is bounded by what a note DECLARES, not by where it sits.** There is no
   root list, and `IndexRoots` is not built.

### The three corrections

- **The performance sentence is wrong.** The slice document says the extra discovery pass is
  free because "`frontmatterOf` is what costs, and it is called on the same set either way."
  It is not: `collectNotes` filters by path prefix *before* calling `frontmatterOf`, so a
  10,000-note vault with twenty notes under `Renovation/` costs twenty calls today and ten
  thousand after. The call is a `MetadataCache` map lookup plus an `EchoWindow` check rather
  than a file read, so the cost is likely acceptable — but §102 is cited by that sentence and
  the claim as written is false. See *The cost, named* below.

- **`foldersOverlap` has no caller in this slice**, not the two the document names. Under the
  derived shape, "changing a project's folder" is a user dragging a folder in Obsidian's file
  explorer — there is no command and therefore no refusal point. §83's rule is
  library-versus-project, and there is no library until slice 19. A pure export with no caller
  in `src/` fails `npm run analyze`, which is why `.fallowrc.json` carries an `ignoreExports`
  entry at all. So the slice document's "Staying green" commit 1 — "`foldersOverlap` and the
  root-list types, with nobody calling them" — would fail the gate it was written to keep
  green. The predicate ships in slice 19, with its caller.

  **Corrected by Task 9's measurement, later still.** The "pure export with no caller in `src/`
  fails `npm run analyze`" sentence above is itself false, and a reviewer measured it rather than
  assuming it: fallow treats every file this repository's tests import as a live entry point, so
  an export with only a TEST caller stays invisible to the dead-export check the whole time —
  `projectFolderOf` had exactly that shape, briefly, at the end of Task 5, and `npm run analyze`
  reported nothing. Measured with `fallow list --entry-points --format json`, which is what
  breaks `npm run analyze`'s own summary line open: "235 entry points detected (203 plugin, 14
  dynamically loaded, 13 manual entry, 5 package.json)" counts 200 of the 203 "plugin" entries as
  sourced from fallow's vitest plugin, which seeds this repository's 198 `*.test.ts` files plus
  `vitest.config.ts` and the aliased `obsidian` mock module as always-used. What `npm run analyze`
  actually refuses is a new FILE nothing imports at all, reported as an unused file — a different
  rule from a dead export with a caller nobody wanted counted. **The conclusion drawn from the
  false premise, a paragraph up, is also false and is corrected here rather than left standing
  beside its corrected premise:** "the slice document's 'Staying green' commit 1 … would fail
  the gate it was written to keep green" does not hold under the corrected rule — a
  `foldersOverlap` shipped with only a test caller would have stayed invisible to
  `npm run analyze` the whole time, the same way `projectFolderOf` did. **This does not reopen
  the deferral**, which is the reason slice 19 needs to inherit correctly: `foldersOverlap` still
  ships there because it has no WORK to do in this slice — no command changes a project's folder
  under the derived shape, and no library exists yet to overlap with — not because a gate would
  have refused it for lacking a caller. See `CLAUDE.md`'s slice 18 record for the same
  measurement.

- **"A single-project vault, which is every vault this plugin has ever produced" is not
  true.** `create-sample-project` run twice seeds two projects into the same folder:
  `freshNotePath` dedupes the second `Project.md` with an id suffix, so the write succeeds.
  The multi-project case the document calls an untested failure window is reachable today by
  running one command twice. It is moot here, because no migration is built — but the sentence
  was load-bearing for the decision not to build one carefully, and it was wrong.

## ADR-0013 — a project's folder is derived

**Accepted. Derived from the note's location.**

**The number is 0013, not 0012.** The slice document says "ADR-012 is owed by this slice" and
`docs/adrs/0012-price-component-placement-in-the-cost-pipeline.md` already exists — slice 9 took
that number. Every reference to "ADR-012" in
[`docs/tasks/18-a-project-owns-its-folder.md`](../../tasks/18-a-project-owns-its-folder.md)
means this document's ADR-0013, and the slice document is corrected in the same commit that
writes the ADR, so the stale number does not go on reading as a live pointer.

A project's folder is `parentOf(<its Project.md>.path)`. Nothing is persisted, no schema
version moves, and a user who moves a project in Obsidian's file explorer has moved the
project — which is precisely the property ADR-011 chose the project-scoped sidecar folder to
preserve, and which PRD §36's 2026-08-26 amendment restates ("The project folder still moves,
backs up and deletes as one unit").

The rejected alternative is a stored `folder:` field on `Project`. It is what §83's word
"setting" literally says, and its cost is ADR-011's own argument turned against it: *"there is
no setting left holding a path that has quietly gone stale."* A stored folder goes stale the
first time a user drags the folder, and every subsequent write lands beside their work rather
than in it. It also buys nothing on discovery — finding the projects still means finding the
`Project.md` notes either way.

The ADR must record three things:

1. **ADR-011's precedent**, as above.
2. **Why [[Identity is the id, never the filename, title or path]] does not forbid this.** That
   rule governs *identity*: which project this is, which note answers to an id, what a read
   resolves through. A derived folder uses the note's path to answer a different question —
   *where do this project's other notes go* — and reads still resolve through the index by id.
   The rule's name reads as though it settles this and it does not, so the ADR says so
   explicitly rather than leaving a reader to assume the conflict was missed.
3. **A deviation from §83's wording.** §83 lists "project folder" under Project Settings. The
   derived shape makes it not a setting at all — it is a property of location. The ADR states
   the deviation plainly rather than letting the code quietly disagree with the PRD.

## The index loses its bound

Every note this plugin owns already declares `type` and `id`, and every child entity already
carries `project:` frontmatter. **The frontmatter is what makes the index correct; the prefix
never was.** And a root list would have to read every note's frontmatter to discover the roots
in the first place — paying the whole-vault cost and then re-imposing a bound on top of it.

| Site | Today | After |
|---|---|---|
| `collectNotes` | `if (!file.path.startsWith(folder + '/')) continue` | removed — frontmatter decides |
| `listSidecars` | filter by `geometryPrefix` | every `.rpgeo` in the vault |
| `joinSidecars` | prefix, then basename → plan id | basename → plan id |
| `ScanInput.projectFolder` | a field | removed |
| `VaultChangeAdapter.processPath` | prefix early-return | removed — `processNote` already runs the full test |
| `VaultChangeAdapter.processSidecar` | slices the prefix off to get the plan id | `file.basename` |
| `VaultChangeAdapter` deps `projectFolder` | a field | removed |

### One function answers "is this note ours"

The slice document's Definition of Done asks that both halves answer "which root is this path
under" through one function, guarding against the full scan and the incremental run disagreeing
about a note. That item survives in a better form, because the defect it names is already
present in a different spelling: `collectNotes` and `processNote` each hand-spell the same
"`type` is one of ours and `id` is a non-empty string" test. Two copies of one invariant — the
shape `stringField` was extracted to prevent, one level up.

```ts
/** The identity a note of ours declares, or nothing. One answer, two callers. */
export function entityRefOf(frontmatter: Record<string, unknown>):
	{ type: EntityType; id: string } | undefined;
```

Exactly two callers, checked. The "note declares no id" diagnostic stays at each caller, because
the two log under different event names (`persistence.index.note-excluded` and
`persistence.pipeline.note-excluded`) and a reader needs to know which pass excluded the note.

### The orphan diagnostic goes away, and this is the honest sentence

The slice document adds a diagnostic for a note of ours sitting under no root, on the reasoning
that "silence hides an orphaned project." Under a declared bound **there are no orphans**: a
note of ours anywhere in the vault is found and indexed. There is nothing to report, so nothing
is reported — the Definition of Done item is withdrawn rather than ticked, the way slice 11's
item 1 withdrew its wider clause rather than being ticked over a hole.

This closes slice 4's recorded prerequisite more completely than a root list closes it: slice
19's library needs no registration to be visible, because nothing is registered.

### The cost, named

`frontmatterOf` is now called for every markdown file in the vault at `onLayoutReady`, not for
the handful under one prefix. It is a `MetadataCache` map lookup plus an `EchoWindow` digest
check — not a file read, not a parse. The docblock on `buildProjectIndexEntries` says exactly
that, and does not repeat the slice document's claim that the call count is unchanged.

Three consequences worth stating rather than discovering:

- A hand-written note carrying `type: renovation-zone` anywhere in the vault is now indexed.
  That is the intended behaviour of a declared bound, and it is how vault-wide Obsidian plugins
  normally behave.
- A template note carrying a literal `id` becomes a duplicate-id finding. It already is one
  today whenever the template sits under the project folder; the population of such notes grows,
  and `warnOnDuplicate` already reports it.
- **`joinSidecars` lost its folder prefix too, and that one has a data-loss path.** A user
  copying a whole project folder as a backup — the "moves, backs up and deletes as one unit"
  property ADR-0013 celebrates — produces a second `.rpgeo` naming the same plan id, and
  `PlanGeometryStore.read`'s own-`planId` verification passes for either copy. Last-writer-wins
  is kept, for the same reason `warnOnDuplicate` keeps it for notes, but it is no longer silent:
  `warnOnDuplicateSidecar` reports it (`persistence.index.sidecar-duplicate`), found in the
  final whole-branch review rather than at the time this section was first written.
  **Superseded on this branch, and the reason is worth carrying forward.** A post-merge review
  found the incremental door — `VaultChangeAdapter.processSidecar` — had lost the same prefix
  and got no diagnostic at all, and that a warning would not have been enough for either door:
  the mapping is what every geometry WRITE resolves through, so repointing it at the copy is
  the data loss rather than a report of one. Both doors now keep the sidecar the project folder
  DERIVES (`sidecarMappingFor`, one function shared by the scan and the pipeline). The
  scan-order argument that kept last-writer-wins is exactly what deriving dissolves: the derived
  path is the same answer in either order.

## Write-time folder resolution

`NoteVaultDeps.projectFolder` is deleted. **That deletion is the compile-error surface this
slice is steered by** — five repositories and both pipeline modules stop building at once, and
`vue-tsc` runs first in `npm run build`.

Each repository's use of the cached folder is a single site on the insert path, so the
conversion is contained:

| Repository | Resolves its folder from |
|---|---|
| Project — insert | `<defaultRoot>/<fileNameFor(name)>/`, deduped with the project id on collision |
| Project — update | `parentOf(existing.path)` |
| Plan, Zone, Requirement, Asset | `parentOf(index.getPath(projectId))`, then the existing `plansFolderFor` / `zonesFolderFor` / `requirementsFolderFor` / `assetsFolderFor`, unchanged |
| Geometry sidecars | unchanged rule (ADR-011); only which string "project folder" resolves to |

`paths.ts`'s functions already take the folder as their first argument, so **no signature moves.
What moves is who computes the argument.**

The new project folder gets one pure function beside `freshNotePath`, applying the same rule one
level up:

```ts
/** Where a NEW project's folder goes: the default root, the name, the id on collision. */
export function freshProjectFolder(vault: Vault, root: string, name: string, id: string): string;
```

### Project existence moves onto the index

`ObsidianProjectRepository.saveQueued` establishes existence with
`findNoteIdInFolder(deps, vault, this.folder, project.id)` — a scan of the project folder. Under
the derived shape that is circular: the project's folder is where its note is, so searching it
for the note presumes the answer.

Existence therefore resolves through the index: `fileAt(vault, index.getPath(project.id))`. This
is **forced by the decision, not an opportunistic widening**, and it is also the more reliable
answer for the case `findNoteIdInFolder`'s own comment worries about — a note created moments
ago. `save` upserts the index synchronously before returning, so the index knows before any
`MetadataCache` does.

Plan, Zone, Requirement and Asset keep `findNoteIdInFolder` — Requirement and Asset reach it
through `noteEntityWrite`'s `spec.notesFolder` rather than directly — now bounded by their own
project's folder rather than the shared root, which is strictly narrower than today.

### A folder that cannot be resolved is a refusal

**A project whose folder cannot be resolved returns a `PersistenceError` and writes nothing.**
Never a fallback to the default root. Writing to a defaulted path when the real one is unknown
is how a note lands in a parallel tree beside the user's work — the failure slice 1 refused
defaults for, and its reasoning ("a setting that names a path is not a preference") applies
here unchanged.

### The `data.json` key does not change

The setting is renamed in its *copy* — label, description and docblock all say "where a new
project is created" — and **its stored key stays `projectFolder`**. `settingsFrom` drops keys
this version does not declare, on the way in and on the way out, so renaming the key would
silently reset every existing user's configured folder to the default. That is the same defect
the paragraph above refuses: a write landing at a defaulted path because the real one was lost.

## No migration

**Under the derived shape, today's vaults need no migration.** The existing layout is
`Renovation/Project.md` with `Renovation/Plans/…` beside it, and "the folder its `Project.md`
sits in" answers `Renovation/`. That is a *valid* project under the new shape, not a legacy one.

The only case with anything to disentangle is two projects deriving the same folder — which
`create-sample-project` run twice produces. It is untidy and it is not corrupting:

- Entity notes carry `project:` frontmatter, so the index attributes each to its own project
  whatever folder it sits in.
- Geometry sidecars are keyed by plan id, so a shared `Geometry/` folder does not collide.

So the mover is not built. What replaces it:

- `CreateProjectCommand` and `create-sample-project` derive a fresh per-project folder, so every
  project created from here on has its own.
- Existing projects keep the folder they are in and go on working.

This removes the slice's only data-destroying step, and the partial-move failure window the
slice document named as an accepted cost stops existing rather than being designed around. The
overlap that actually destroys something — a project folder containing the library, so deleting
the project takes every project's catalogues — is slice 19's site, with slice 19's predicate.

If slice 19's library move wants a file mover, it builds one where it has a caller.

## Interfaces & contracts

```ts
// buildProjectIndexEntries.ts — new, pure, exactly two callers
export function entityRefOf(frontmatter: Record<string, unknown>):
	{ type: EntityType; id: string } | undefined;

// paths.ts — new, pure
export function freshProjectFolder(vault: Vault, root: string, name: string, id: string): string;
export function projectFolderOf(index: ProjectIndex, projectId: ProjectId): string | undefined;
```

**Corrected — this is the sketch, not what shipped.** `entityRefOf`'s callers need a third
answer, not two: `not-ours` (silent, correct) and `no-id` (one of ours, undiagnosable) are told
apart by each caller re-spelling the whole test if `entityRefOf` only ever returns `undefined`
for both. What shipped is the three-arm union documented at the function itself:

```ts
export type EntityRef =
	| { kind: 'ours'; type: EntityType; id: string }
	| { kind: 'no-id' }
	| { kind: 'not-ours' };
export function entityRefOf(frontmatter: Record<string, unknown>): EntityRef;
```

```ts
// NoteVaultDeps — removed
readonly projectFolder: string;   // ← deleted; five repositories stop compiling

// ScanInput / VaultChangeAdapter deps — removed
projectFolder: string;            // ← deleted from both
```

`IndexRoots` is not declared. `foldersOverlap` is not declared. Both belong to slice 19, which
has callers for them.

## Persistence impact

**None.** No new note kind, no frontmatter key, no schema version moves, no migration step
registered. The vault layout PRD §36 draws is what new projects get:

```text
Renovation/                     ← the plugin setting: where a NEW project is created
├── Kitchen Refit/              ← a project folder — derived, never stored
│   ├── Project.md
│   ├── Plans/  Zones/  Requirements/  Geometry/
└── Bathroom/
    └── …
```

**Corrected — the note's filename is not `Project.md`.** This sketch draws `Project.md` for
every project; what ships is `freshNotePath`'s existing, unchanged rule — `<fileNameFor(name)>.md`
— so "Kitchen Refit" writes `Kitchen Refit/Kitchen Refit.md`, not `Kitchen Refit/Project.md`.
The filename was never identity (§83) and this slice does not touch it; only the FOLDER a
project's note sits in is new. The code is not changed to match this diagram — renaming the
note would move every existing project's note, which is the migration this slice explicitly
refuses to build (*No migration*, above).

An existing vault whose project folder *is* `Renovation/` stays exactly as it is and stays
correct.

## Testing strategy

**The two-project fixture is the point.** Every index test today has one project, and a
one-project fixture passes against a scan that still uses a single prefix — so it can prove
nothing here.

- **`entityRefOf`** — node. Both arms per field, and the callers checked to be exactly two.
- **Two projects in different folders** — every entity's note asserted at *its own* project's
  path. Asserting only that the write succeeded passes against a repository that wrote both
  into one folder.
- **A project in the old shared layout** still indexes and still saves. This is the "no
  migration needed" claim, pinned as behaviour rather than left as a paragraph.
- **A note of ours outside every project folder is indexed.** New behaviour; written first and
  watched failing against the prefix bound it replaces.
- **`VaultChangeAdapter`** — modify a note in the *second* project and observe the index update.
  One project proves nothing here either.
- **Sidecars** — through `PlanGeometryStore`, against two projects, with the sidecar join now
  unbounded by prefix.
- **The unresolvable-project refusal** — a `PersistenceError` and **nothing written**, driven by
  removing the project's index entry between a caller's read and its save.
- **`freshProjectFolder`** — the collision arm, which is the one a plain name-derived path gets
  wrong.
- **The setting's key** — `settingsFrom` still round-trips a user's configured `projectFolder`.
  Cheap, and it is the check under the paragraph above.
- **The setting still decides where a new project goes** — set it to a second root, create a
  project, assert the resulting folder is under that root and not under the default. Asserting
  only that the key survives would pass against a build that reads it and ignores it.

**Coverage.** Branches are the metric to watch: 98.14 against a floor of 98 at the last
recorded measurement, roughly three branches of headroom at 0.046pp each. This slice's new arms
are `entityRefOf`'s misses, `freshProjectFolder`'s collision fork, and the folder-resolution
miss. **Every one gets its test in the commit that adds it** — that is arithmetic here, not a
style preference.

## Staying green

Four commits, ordered so `npm run check` passes at each:

1. **`entityRefOf` extracted**, both callers converted to it. No behaviour change, fully tested.
2. **The bounds deleted** — the index and the vault-change adapter scan by declaration.
   Behaviour change; the two-project and outside-every-folder tests land here.
3. **The conversion** — `NoteVaultDeps.projectFolder` deleted, five repositories and both
   pipeline modules converted, project existence moved onto the index. Atomic by necessity: the
   deletion is what fails the build, and a half-converted tree does not compile.
4. **New projects get their own folder** — `CreateProjectCommand` and `create-sample-project`,
   plus the settings copy and the docblocks.

## Definition of done

- [ ] **ADR-0013 exists and is Accepted** — 0012 is taken — choosing the derived shape, naming ADR-011's
      precedent, saying explicitly why [[Identity is the id, never the filename, title or path]]
      does not forbid it, and recording the deviation from §83's word "setting".
- [ ] `entityRefOf` is the **one** answer to "is this note ours", with exactly two callers,
      checked.
- [ ] The Project Index scans the whole vault and is bounded by frontmatter. `ScanInput` no
      longer carries a folder, checked by the type.
- [ ] A note of this plugin's **outside every project folder is indexed**, asserted. The test is
      watched failing against the prefix bound.
- [ ] `VaultChangeAdapter` carries no folder either, and updates the index for a note in the
      **second** project of a two-project fixture.
- [ ] Sidecars join across the whole vault by basename, asserted through `PlanGeometryStore`
      against two projects.
- [ ] Every entity's note lands in **its own** project's folder, asserted on the resulting path
      for two projects at once. `NoteVaultDeps.projectFolder` no longer exists, checked by the
      type.
- [ ] A save whose project folder cannot be resolved returns a `PersistenceError` and writes
      nothing — never a write to the defaulted path. Driven by removing the index entry between
      the read and the save.
- [ ] A project in the **old shared layout** indexes and saves unchanged, asserted — the claim
      that no migration is owed.
- [ ] `CreateProjectCommand` and `create-sample-project` create a project in its own folder
      under the default root, deduped on collision.
- [ ] **The default projects folder is still configurable and still governs where a new project
      goes**, asserted end to end: change the setting, create a project, and its folder is under
      the NEW root. The setting keeps a job in this slice — it is the home new projects live
      under — and losing that quietly is the failure this item exists to catch.
      **Corrected by the final review.** "End to end" had one witness short: `perProjectFolders.test.ts`'s
      "takes the configured root" drives `createRepositoryStack` directly, which builds an
      `ObsidianProjectRepository` by hand and never passes through `composition-root.ts`'s
      `composeRepositories(deps, vault, settings.projectFolder)` — the actual seam that reads
      the setting. `tests/plugin/persistence-wiring.test.ts`'s "creates a project under the
      configured root through the real composition seam" now drives it through the real
      plugin, so a future edit that stopped threading the setting through the composition root
      would fail there instead of passing on a repository-level test that cannot see it.
- [ ] The stored settings key is unchanged, asserted through `settingsFrom`.
- [ ] **Withdrawn, not ticked:** the orphan diagnostic. Under a declared bound there are no
      orphans, so there is nothing to report.
- [ ] **Deferred to slice 19, not ticked:** `foldersOverlap` and the multi-root types. Neither
      has a caller in this slice. **Corrected by Task 9's measurement:** "and a dead export
      fails `npm run analyze`" was the reason first given here, and it is false — fallow counts
      a test caller as live, so an export with only one stays invisible to that check. The true
      reason to keep reading for slice 19: neither has any WORK to do in this slice, not because
      a gate would have refused either for lacking a caller. See the correction above and
      `CLAUDE.md`'s slice 18 record.
- [ ] **Withdrawn, not ticked:** the one-time folder migration and its partial-move diagnostic.
      The derived shape makes the existing layout valid; nothing has to move.
- [ ] `npm run check` passes, and `vitest.config.ts` records a fresh measurement — floors rise
      only if a finished increment measures above them.

## References

**PRD**: §36 Vault Data Model (as amended 2026-08-26); §83 Configuration Model — the folder
split and the overlap rule; §102 Performance Budgets, for the scan cost named above.

**ADRs**: [ADR-011](../../adrs/0011-project-scoped-geometry-sidecar-folder-and-file-extension.md)
— its rejected alternative is this slice's argument in miniature. **ADR-0013 is owed by this
slice**; the slice document's "ADR-012" names
[ADR-0012](../../adrs/0012-price-component-placement-in-the-cost-pipeline.md), which slice 9
already wrote.

**Slices**: [04](../../tasks/04-persistence-and-repository-layer.md) — owns the index and records
the multi-root prerequisite this slice closes;
[18](../../tasks/18-a-project-owns-its-folder.md) — the slice document this design settles;
[19](../../tasks/19-the-asset-catalogue-leaves-the-project.md) — blocked on this one, and the
owner of `foldersOverlap`.

**Business rules**: [[Work belongs to one project, catalogues belong to the vault]] ·
[[Identity is the id, never the filename, title or path]]

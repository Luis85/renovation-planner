# Slice 19: what the task document does not already carry

**This is a delta, not a design.** The design is
[`docs/tasks/19-the-asset-catalogue-leaves-the-project.md`](../../tasks/19-the-asset-catalogue-leaves-the-project.md),
which carries Purpose, Scope, Design, Interfaces & Contracts, Persistence Impact, Testing
Strategy, Staying green and a Definition of Done. Restating any of it here would be the second
derivation that document's own Definition of Done forbids — *"restating them is the second
derivation this project keeps deleting, and they would disagree the day one is edited."*

What follows is only what is **new or now false**: three measurements that moved since that
document was written, one decision it could not have taken, and the amendments it is owed.

## Measurements

Taken on `main` at `f94ce6e` (post-slice-12), 2026-08-30.

Everything the task document's `Interfaces & Contracts` section asserts is accurate today,
verified one signature at a time rather than as a set:

| Claim | Measured |
| --- | --- |
| `t(language, key)` takes two arguments | `strings.ts`, `export function t` — yes |
| `ListRequirementsReferencing.execute` answers a flat list | `readonly RequirementId[]` — yes |
| `AssetRepository.listByProject(projectId)` | `AssetRepository.ts`, the port member — yes |
| `saveNoteBackedEntity` requires `projectId` | `noteEntityWrite.ts`, the `TEntity extends` constraint — yes |
| `ASSETS_FOLDER = 'Assets'` | `paths.ts`, `ASSETS_FOLDER` — yes |
| Settings carry `units` + `projectFolder`, no `libraryFolder` | `settings.ts`, `RenovationPlannerSettings` — yes |
| `ListReassignmentTargets`'s header over-promises | still carries *"cannot OFFER a target that fails validation"* — yes |
| Slice 15 names slice 19 as where items 6 and 6a land | slice 15’s “Both land in [19]” paragraph — yes |

One correction to those snippets: they spell the repository failure type `PersistenceError`,
and the ports declare `RepositoryError`. Cosmetic in prose, and the kind of thing that gets
copied into a real signature.

**Coverage**, computed from `coverage/coverage-final.json` after a fresh `npm ci`:

```text
statements   99.24%  (5352/5393)
functions    99.05%  (1349/1362)
branches     98.08%  (2660/2712)
```

**2.24 branches of headroom** before the floor of 98 — looser than the task document's *"98.02
… roughly 0.4 of a branch"*, which was taken on an older tree. Read it as the binding
constraint on the watcher below rather than as comfort: it is two branches, and this slice
adds arms. The document's *"deletions help"* argument stands and is the reason to expect this
slice to end level rather than to plan on the headroom.

## Correction 1: the no-bump argument is stale, the conclusion survives

The task document justifies leaving `ASSET_MIGRATIONS` empty with a fact about history:

> **slice 10 has never been merged to `main`** (`git log main..HEAD` at the time of writing
> shows the whole slice unmerged), so `schema-version: 1` for Asset has never been released.

**Slice 10 is on `main` now** — `src/domain/asset/Asset.ts` and
`src/infrastructure/persistence/dto/assetFrontmatter.ts` are both in `origin/main`'s tree. The
sentence is false as written.

The conclusion is unchanged, because the *criterion* was written against a different word than
the *argument* was. The Definition of Done says **released**, and `git tag --list` answers zero
— this repository has never cut a release, so no user vault holds an Asset note at any schema
version. No bump.

This is the document's own falsifier paying out as designed: it fired on the argument and left
the conclusion standing. The prose is rewritten to the fact that is actually load-bearing —
*no release exists* — and the `git log main..` half of the criterion is dropped, because it now
measures something that is true and irrelevant.

## Correction 2: `foldersOverlap` does not exist

`grep -rn "foldersOverlap" src/ tests/` returns nothing.

CLAUDE.md reads *"`foldersOverlap` still ships in slice 19 rather than here"*, which describes a
predicate written and left uncalled. There is no predicate. This slice writes it as well as
calling it — a small change to the first commit's shape, and the reason to say so is that
"wire up the existing predicate" and "write the predicate" are different pieces of work and
only one of them was planned for.

## Decision: §83's third site has no door

§83 names three places the overlap check belongs — **creating a project**, **changing a
project's folder**, **moving the library** — and the task document's Definition of Done asks for
*"one predicate, three refusals."*

**The middle one has no operation to guard.** ADR-0013 (slice 18) made a project's folder
*derived* from where its `Project.md` sits; `src/application/commands/project/` holds
`CreateProject.ts` and nothing else; a user moves a project by dragging its folder in Obsidian's
file explorer. There is no command there, so there is nothing to refuse. That criterion cannot
be ticked as written, and §83 was written before ADR-0013 removed its subject.

It is not bookkeeping. The PRD states the consequence: deleting a project deletes its folder,
so a project folder that has come to contain the library *"would take the shared Asset, Supplier
and Trade catalogues of every project with it."* A drag can reach that state today and nothing
anywhere says so.

**The decision is to detect after the fact and warn.** Two real refusals at the two sites that
exist, plus a watcher at the door where the drag actually becomes visible. A refusal is
unavailable — the move has already happened — so the guarantee is narrowed to *the state stops
being silent*, and the Definition of Done item is rewritten to that rather than left promising
three refusals.

Two alternatives were weighed and are recorded so they are not re-proposed:

- **Two refusals, third site written down as an exposure.** Cheapest, and it keeps the whole
  coverage budget for the migration. Refused because this repository's own record is that *a
  documented residue reads as surveyed ground* — the parse-lag defect sat behind such a
  sentence for eleven slices.
- **Refuse at the index.** Treat the derived folder as the guard point and refuse to index a
  project whose folder overlaps the library. Strongest guarantee, and it makes a file-explorer
  drag able to render a project unreadable, with the remedy outside the plugin. A refusal the
  user cannot act on from inside the surface that raised it.

## The overlap watcher

`VaultChangeAdapter` is the home, and it is the only candidate: slice 16 established it as the
sole index writer for notes arriving by hand, copy or sync, and it already announces
`ProjectIndexEntryChanged` over an `EventBus`. A folder drag reaches the plugin as exactly that
— a `Project.md` at a new path with its folder re-derived beneath it.

After an index mutation that changes a project's derived folder, it asks
`foldersOverlap(derivedFolder, libraryFolder)` and reports a hit.

Three properties follow from the architecture rather than being chosen:

- **It reports through an injected `notify`, never `presentation/notices/notify`** — the layer
  ban refuses infrastructure reaching presentation. `CascadeDeps.notify` and
  `ResolutionOps.notify` are the established shape, and both carry the lesson that
  optional-for-the-suite is precisely what lets a forgetful composition root compile and say
  nothing. So it owes a wiring test beside `slice10CascadeWiring` and `sequenceNoticeWiring`,
  **watched red with the binding deleted** — and asserting the pair, since "a notice appeared"
  is equally true of a build that refuses the whole index write.
- **It reads `libraryFolder` from a supplier at check time, never from a constructor field.**
  This is slice 18's own lesson — `NoteVaultDeps.projectFolder` was deleted for it — and here
  it is load-bearing rather than tidy, because the library migration in this same slice changes
  that value mid-session.
- **Dedup is free.** Slice 13's queue folds on the `(severity, message)` pair into a `(×N)`
  suffix, so three overlapping projects raise one warning at ×3.

**Severity is `warning`**, which never auto-dismisses — the state persists until the user moves
something, so a message that expires would be a message about a condition that is still true.

## The one coupling to slice 17

This adds a **fourth** source of never-auto-dismissing `warning` notices.
`docs/tasks/17-presentation-layer-error-surfacing.md` already records as an open exposure that
the queue caps at three visible slots and that standing warnings hide every later **error** —
including its announcement, because `announce` rides `render` and `render` runs only for a
notice actually shown.

**Slice 19 adds the source and cites the exposure; slice 17 decides the policy.** Queue
preemption is that slice's table. Two branches deciding it independently is how the second
derivations this repository keeps deleting get made, and this is the single point at which the
two parallel tracks touch — named here so it is a known merge conversation rather than a
discovery.

## Amendments owed to `docs/tasks/19`

- The schema-bump justification, rewritten to *no release exists*; the `git log main..` clause
  dropped from the criterion.
- `foldersOverlap` described as written here, not as existing.
- The Design section's *"creating a project and changing a project's folder (slice 18's two
  sites)"* — slice 18 has one such site, not two.
- The Definition of Done's three-refusals item, split: two refusals, plus a watcher whose
  guarantee is detection and whose surface is a persistent warning.
- `PersistenceError` → `RepositoryError` in the `Interfaces & Contracts` snippets.

## What this does not change

The scope, the four-commit "Staying green" sequence, the seven open slice-10 criteria, slice
15's items 6 and 6a, and the deliberate currency window left open for slice 20 are all
unchanged.

**The library-folder migration stays.** A case for shipping a fixed `Renovation/Library` and
deferring the move-and-rebuild was drafted — it is the largest single piece here and the
heaviest on a 2.24-branch budget — and
[[Settings and configuration]] refuses it in the product owner's own words: the setting
*"moves the catalogues, rebuilds the index, and refuses the new value until the move has
succeeded."* Recorded so the next reader working under the same budget does not re-draft it.

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

## Correction 1: the no-bump argument is stale, and its replacement took four tries

The task document justifies leaving `ASSET_MIGRATIONS` empty with a fact about history:

> **slice 10 has never been merged to `main`** (`git log main..HEAD` at the time of writing
> shows the whole slice unmerged), so `schema-version: 1` for Asset has never been released.

**Slice 10 is on `main` now** — `src/domain/asset/Asset.ts` and
`src/infrastructure/persistence/dto/assetFrontmatter.ts` are both in `origin/main`'s tree. The
sentence is false as written.

The conclusion is unchanged. **Establishing why took four attempts, three of them wrong, and
the sequence is worth more than the answer.**

1. The task document argued *slice 10 is unmerged*. Stale — it is on `main`.
2. This file's first draft argued *no release exists*, evidenced by `git tag --list` answering
   zero. Right conclusion, worthless instrument: that command reads the clone, and this clone
   was **silently shallow**, narrowed by an earlier `--depth=1` fetch of another branch.
3. A review bot correctly attacked that instrument and offered a premise with it — that
   `CHANGELOG.md`'s dated `## [0.1.0] - 2026-08-22` means the version shipped. This file's
   second draft **adopted that premise without checking it**, and then identified `26d37b6` as
   the released commit using `git log -S` — still run against the shallow history.
4. The bot answered that `26d37b6` changes only `.gitignore` and never touched `CHANGELOG.md`
   at all. Correct: it was the shallow graft boundary, which is what makes an early commit
   appear to introduce every line it merely inherited.

**Measured on full history, and against the remote rather than the clone:**

- `## [0.1.0] - 2026-08-22` is present in `0b5d769` — *"add plugin scaffold"*, the **initial
  commit**. It is scaffold content, never a release record.
- `manifest.json` has been touched by exactly one commit in the repository's life: that same
  `0b5d769`. The version has never been bumped.
- `git ls-remote --tags origin` returns nothing, and the GitHub API reports **zero releases and
  zero tags**.

So **no release exists**, no released commit can contain the Asset schema, and `ASSET_MIGRATIONS`
stays empty. Draft 2's conclusion was right and its evidence was not; draft 3 replaced the
evidence with worse evidence and changed a correct conclusion into an incorrect one.

**`changelog.test.ts` does not say what both of us read it as saying.** It asserts that the
CHANGELOG holds one dated section matching `manifest.version` — a *format* convention the
scaffold satisfied on day one. Its comment, *"the date is what says a version shipped rather than
being planned"*, distinguishes a dated section from `[Unreleased]` **for the extractor**. It is
not evidence that a publish happened, and no test in `tests/release/` can be: publishing is the
workflow's act, and its record is a tag.

The criterion is therefore forward-looking rather than archaeological: **no release exists, so
none contains Asset v1 — and if a release is cut before this slice lands, ask that tag's tree
before ticking the box.** That is checkable by `list_releases` against the remote, which is the
one instrument here that is not a fact about somebody's clone.

**Three lessons, and the third is new.** An instrument that reads a clone cannot answer a
question about a repository. A criterion rewritten in a hurry inherits the defect it was
replacing. And — the one this round actually cost — **a reviewer can be right about the defect
and wrong about the premise it offers with it**, so adopting the whole correction is its own
failure: the bot was right twice about the instrument and wrong once about the conclusion, and
this file followed it into the error rather than checking the one claim that had changed.

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
exist, plus a watcher at **both** doors through which the drag becomes visible. A refusal is
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

**The index has TWO doors, and the first draft of this section named one of them.** It said
`VaultChangeAdapter` was "the home, and it is the only candidate", which is false and false in
a shape this repository has already paid for.

- `VaultChangeAdapter` is the incremental door — the sole index writer for notes arriving by
  hand, copy or sync while the plugin is running, already announcing `ProjectIndexEntryChanged`
  over an `EventBus`.
- `RenovationPlannerPlugin` holds the other: `index.rebuild(buildProjectIndexEntries({…}))`, the
  load-time full scan. `grep -rn "rebuild" VaultChangeAdapter.ts` returns nothing — the adapter
  never sees one.

A project folder moved **while Obsidian is closed or the plugin is disabled** reaches the plugin
only through that rebuild. No mutation is ever delivered, so a watcher on the incremental door
alone would never run — and that is the likelier path by some margin, because tidying a vault's
folders with the app shut is exactly how people reorganise. It is also precisely the state that
makes deleting a project take the shared library with it, so the door that misses it is the door
that matters most.

CLAUDE.md already carries the rule this violates, from the sidecar-mapping fix: **"One rule with
two doors is two rules unless one function holds it."** That defect had the same shape down to
the asymmetry — the join lost its folder prefix at both ends and only the full scan got a
diagnostic, while the incremental door went on misbehaving. `sidecarMappingFor` is the shape to
copy: one function, both callers, and the caller list measured by a test rather than asserted,
the way `entityRef.test.ts` pins its two.

So the check is **one predicate asked at both doors**:

- **Incremental**: after an index mutation that changes a project's derived folder, ask
  `foldersOverlap(derivedFolder, libraryFolder)` for that one entry.
- **Load-time rebuild**: sweep every project's derived folder against the library once, after
  the rebuild. Slice 13's `(severity, message)` dedup folds a multi-project hit into one notice
  at `(×N)`, so the sweep does not become a burst.

Reported by a review bot, which also caught that "the only candidate" was doing the work of an
argument in a sentence that had never been checked.

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

- The schema-bump justification, rewritten to *no release exists — verified against the remote,
  not a clone*, with the `git log main..` clause dropped and the falsifier made forward-looking:
  if a release is cut before this slice lands, ask that tag's tree.
- `foldersOverlap` described as written here, not as existing.
- The Design section's *"creating a project and changing a project's folder (slice 18's two
  sites)"* — slice 18 has one such site, not two.
- The Definition of Done's three-refusals item, split: two refusals, plus **one overlap
  predicate asked at both index doors** — the incremental adapter and the load-time rebuild —
  whose guarantee is detection and whose surface is a persistent warning.
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

## Every claim in this file was re-run

Three review rounds on this branch found the same defect three times — an instrument recorded
without being tested: `git tag --list` asked of a clone that was silently shallow,
`VaultChangeAdapter` asserted as "the only candidate" without checking the second index door,
a `grep` anchor that could not match any `ls-tree` line, and a release commit id that was really
a shallow-clone graft boundary. Three times the conclusion survived and only the evidence was
wrong; the fourth time the evidence was wrong **and took a correct conclusion down with it**,
because this file adopted a reviewer's premise along with its finding. A reader checking the
work by running the recorded command would have been misled in every one.

So on 2026-08-30 every command and every quotation in this file was executed or matched against
its source, rather than trusted. Four commands (`foldersOverlap` absent from `src/` and
`tests/`; no `rebuild` in `VaultChangeAdapter`; `commands/project/` holding only
`CreateProject.ts`; `index.rebuild(buildProjectIndexEntries(…))` present in
`RenovationPlannerPlugin`), the eight signature rows, the coverage figures, and nine attributed
quotations across CLAUDE.md, the PRD, `changelog.test.ts`, `Settings and configuration.md` and
the slice 17 and 19 task documents. **The sweep did not re-run the release-commit lookup**, which
is precisely where the fourth defect was — it read as settled because it had just been rewritten,
which is the same reason the three before it read as settled.

**One defect found, and it was in the checker.** A first pass matched quotations line by line
and reported two CLAUDE.md citations missing; both are present and correct, and wrap across
lines. Re-run with whitespace normalised, all nine matched — the fourth instrument on this
branch to be wrong about its own subject, and the first to fail in the safe direction. The only
change the sweep produced in the document itself was restoring `OPPOSITE` to the capitalisation
CLAUDE.md gives it — and a sweep whose only finding is a capitalisation, run over a file that
still held a false release-commit id, is a reminder that a checklist covers what it lists.

**What this does not make true.** Re-running a recorded command proves the command answers what
the file says it answers today. It says nothing about the claims here that are judgements rather
than measurements — that `VaultChangeAdapter` and the load-time rebuild are the *only* two index
doors, that the watcher's severity should be `warning`, or that slice 17 rather than this slice
owns queue preemption. Those are still arguments, and the three findings above were all
originally arguments that read as settled.

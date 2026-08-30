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
constraint rather than as comfort: it is two branches, and this slice adds arms. The reporting
design below ended up adding markedly fewer than the two designs it replaced — no watcher, no
session state, no transition arms, no snapshot field — which is a real budget consequence of
that simplification rather than an argument for it. The document's *"deletions help"* argument stands and is the
reason to expect this slice to end level rather than to plan on the headroom.

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

**The decision is to detect after the fact and MARK the affected project.** Two real refusals
at the two sites that have a door, plus a marker on that project's row in the Renovation
Project view. A refusal is unavailable — the move has already happened — and both an
interruptive surface and a diagnostics report turned out to be unavailable too, for reasons the
next section establishes over seven review rounds. So the guarantee is narrowed to *the
affected project says so where a user already looks*, rather than to a refusal or to anyone
being interrupted. The Definition of Done item is rewritten to that rather than left promising
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

## Reporting the overlap: a mark on the affected project's row

**Seven review rounds preceded this section.** The account of them is at the end; it teaches
more than the design does.

### What is built

`foldersOverlap(a, b)` — one predicate, written in this slice (Correction 2), with **two
refusal call sites**: creating a project, and moving the library. That is where §83 is
enforced. For the third site, which has no door, the affected project's own row says so.

- `ProjectListResult` gains `overlapping: readonly ProjectId[]`, answered inside
  `ListProjectsQuery` from a collaborator that asks `projectFolderOf(index, projectId)` for
  each listed project and `foldersOverlap` against the current `libraryFolder`. One query and
  one failure mode, rather than a second query the read model would have to combine — and
  combining is where an advisory marker would otherwise need a policy for "the list loaded but
  the markers did not".
- `ProjectSummaryDto` gains `libraryOverlap: boolean`, set in `createRenovationProjectQueries`,
  which is already where domain entities become view shapes and is the division that file's own
  docblock draws.
- `ProjectList.vue` renders a marker on a row whose flag is set, plus one `StringKey` of copy.

### Why a row rather than a report or a notice

The two surfaces tried before it both failed on a measurement, not on taste:

- **A notice cannot represent a standing condition** under slice 13's queue — text-keyed dedup,
  a three-slot cap, no expiry for `warning`, no retract door. Five rounds established that; the
  compressed account is below.
- **Diagnostics cannot be opened.** `grep -rn "GetDiagnosticsSnapshot" src/` finds the query,
  two docblocks and `guardedServices.ts` — composition only, no command, no settings entry, no
  view. `en.ts` had already recorded exactly this, as the reason a sentence pointing at a
  diagnostics report was deleted: *"an instruction the user cannot follow … a sentence that does
  nothing is the same defect."* Slice 17's row says **discoverable** marker, and I let that word
  do the work of a measurement.

The row satisfies what slice 17 actually asks for — *a marker on the affected entity* — and
every property the other two lacked falls out of it rather than being engineered:

| Hazard | Why it cannot arise here |
| --- | --- |
| Stale after the user fixes it | Derived per render from the current index and setting |
| Counting, `(×N)`, dedup | Per-row; nothing aggregates |
| Retraction | Nothing was recorded to retract |
| Slot cap, preemption | Not a notice |
| Session state, `saveSettings` lifetime | Stateless |
| Privacy (slice 11's hard rule) | A rendered list is UI, not an exportable payload |

That last row is the one to read twice. `docs/tasks/11` forbids *"a human-readable project or
zone name"* in the diagnostics snapshot because it may be copied or exported; a project list on
screen is already showing those names as its entire purpose. The rule is about the payload, not
about the word.

### What it must be, per this repository's own rules

**A mark and a word, never a colour alone** — SDD §85, and `docs/components/Save-state
indicator.md` states it more sharply: *"Both, always, never one"*, recording that a coloured dot
"works perfectly for the author who built it". The marker is therefore drawn **and** labelled.

It is also the first row-level status this project has, so it is owed an **axe scan**:
`tests/harness/accessibility.test.ts` already mounts the real Renovation Project view, and the
existing note that no action-carrying empty state was ever graded is the precedent for adding
the case with the markup rather than after it.

### What it costs

A user who never opens the Renovation Project view is not told — but that view is the plugin's
front door and its ribbon button, which is a different claim from a report with no opener. And
nothing is *interrupted*: a user who does not look at the row does not learn the state. That is
the accepted price of a site §83 gave no door to refuse at.

### The seven rounds, compressed, because the shape is the lesson

1. *"Dedup is free"* — `(×N)` counted sweep runs, not projects.
2. *Aggregate and interpolate the count* — broke on a set that changes while staying non-empty,
   because dedup is keyed on message text.
3. *Hold the set for the session* — necessary against `saveSettings` replacing the root, and
   orthogonal to (2).
4. *Drop the count, push on the transition* — folds into a still-live stale entry as `×2`.
5. *Defer preemption to slice 17* — to a policy that document does not define.
6. *Move to the diagnostics snapshot* — to a surface with no opener.
7. *…carrying `projectName`* — into a payload whose hard rule forbids exactly that.

**Five of the seven were introduced by the fix for the one before.** Two separate wrong surfaces
were each defended with a sentence quoted from a document I had not measured — *"discoverable"*
in slice 17's row, and *"the queue folds identical messages"* in slice 13's. The signal was
available from round one: **a fix that keeps needing another fix is answering the wrong
question**, and a quoted word is not a measurement.
## The coupling to slice 17, and its disappearance

**There was one, and taking the diagnostics surface removed it.** The notice design added a
fourth source of never-auto-dismissing `warning` notices, against a queue that caps at three
visible slots — so it depended on a warning-versus-warning preemption policy that slice 17 does
not define. (Its recorded exposure is that standing warnings hide every later **error**; a
fourth warning is a different question and an open one.) This slice would have been shipping a
detection guarantee that a full queue silently voided.

**Slice 19 now touches no notice surface at all**, so the two parallel tracks have no contact
point: nothing here constrains slice 17's table, and nothing in that table changes what this
slice reports. Recorded because the coupling was real when the branch opened and its absence is
a consequence of a decision rather than of the tracks never having overlapped.

What slice 19 does take FROM slice 17 is its decision procedure — the row naming a persisted,
discoverable marker as the correct surface where no interruptive one is. That is a dependency
on a document, not on a mechanism, and it runs in the direction the slice numbers already do.

## Amendments owed to `docs/tasks/19`

- The schema-bump justification, rewritten to *no release exists — verified against the remote,
  not a clone*, with the `git log main..` clause dropped and the falsifier made forward-looking:
  if a release is cut before this slice lands, ask that tag's tree.
- `foldersOverlap` described as written here, not as existing.
- The Design section's *"creating a project and changing a project's folder (slice 18's two
  sites)"* — slice 18 has one such site, not two.
- The Definition of Done's three-refusals item, split: **two refusals** at the sites that have a
  door, plus a **`libraryOverlap` marker on the affected project's row** for the site that does
  not. The guarantee is that the affected project says so where a user already looks — not a
  refusal, not a notification, not a report. This criterion has now been narrowed three times
  and re-surfaced twice; a criterion that quietly keeps its old wording is how the gap between
  promise and check reopens, which is the whole reason this list exists.
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
than measurements — that a row marker is an acceptable guarantee for §83's third site, that the
project list is the right home for it, or that two refusals plus a marker is what §83 should now
be read as asking for. Those are still arguments, and every
finding this branch took was originally an argument that read as settled. The strongest evidence
for that: the notice design survived five rounds of *fixes* before anyone asked whether it was
the right surface, and the answer took one measurement of a docblock that had been there all
along.

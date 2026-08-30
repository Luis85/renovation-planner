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
design below ended up adding markedly fewer than the notice design it replaced — no watcher, no
session state, no transition arms — which is a real budget consequence of that simplification
rather than an argument for it. The document's *"deletions help"* argument stands and is the
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

**The decision is to detect after the fact and RECORD.** Two real refusals at the two sites
that exist, plus the condition reported as a derived entry in the diagnostics snapshot. A
refusal is unavailable — the move has already happened — and an interruptive surface turned out
to be unavailable too, for reasons the next section establishes over five review rounds. So the
guarantee is narrowed twice: to *the state is discoverable*, rather than to a refusal or to
anyone being told. The Definition of Done item is rewritten to that rather than left promising
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

## Reporting the overlap: a derived diagnostic, not a notice

**This section replaced a notice design that took five review rounds to fail.** The account of
that is at the end, because the shape it teaches is worth more than the design it discarded.

### What is built

`foldersOverlap(a, b)` — one predicate, written in this slice (Correction 2), with **two
refusal call sites**: creating a project, and moving the library. Those are unchanged and are
where §83 is actually enforced.

For the third site, which has no door, `DiagnosticsSnapshot` gains one **computed** field:

```ts
	/** Projects whose derived folder overlaps the library folder (§83). Derived per read. */
	folderOverlaps: Array<{ projectId: string; projectName: string }>;
```

`GetDiagnosticsSnapshotQuery` answers it by asking `foldersOverlap` of every indexed project's
derived folder against the current `libraryFolder`. `DiagnosticsSources` gains one member
supplying those, alongside `latestSchemaVersions()` and `lastAppliedMigration()`, which are
already live-derived rather than ledger-backed. The query's own contract holds: everything is
*"answered from memory, none from a vault read"* — the project index **is** memory.

### Why this is derived rather than recorded, which is a correction

The decision was taken as *"record it into `DiagnosticsSnapshot.validationIssues`"*, and that
would have been wrong. Measured in `diagnosticsLedger.ts`: the ledger is **append-only** —
duplicates collapse on a `(kind, id, code)` triple and the cap evicts the oldest, but **nothing
is ever removed because it stopped being true**. It holds read-path *refusals*, which are facts
about reads that happened and do not become untrue. An overlap is a live *condition* that the
user can fix, and a ledger entry for it would sit there for the rest of the session under a
docblock promising *"an honest 'what is wrong right now'"*.

Deriving it in the query is what makes the stale-condition problem **unrepresentable** rather
than mitigated: fix the overlap, and the next read simply does not report it. There is no
retraction, because there was never a record.

### What this deletes

Everything the notice design needed and nothing else does:

- **No watcher at either index door.** The two-doors requirement was real *for a watcher*; a
  query computes on demand, so neither `VaultChangeAdapter` nor the load-time `index.rebuild`
  changes at all.
- **No session-scoped state**, so no `saveSettings` lifetime question and no third member of
  the root's session-collaborator argument.
- **No transition to decide**, global or per-entry — the exact hazard of asking `foldersOverlap`
  of one changed entry and clearing a flag that another project still justifies.
- **No count, no dedup, no `(×N)`, no retraction, no slot cap**, and no fourth persistent
  warning competing for three slots.
- **No interpolation here.** Item 6a still lands for slice 15's row label, which is a genuine
  per-value string.

### What it costs, stated plainly

**Nobody is told.** A user who never opens Diagnostics never learns that a folder drag put their
project around the shared library, and the PRD's harm — deleting that project takes every
project's catalogues — is real. This is the accepted price of the surface, not an oversight: §83's
third site has no door to refuse at, and five rounds established that an interruptive surface
cannot represent a standing condition under this queue. `docs/tasks/17`'s own procedure names
exactly this trade for exactly this shape: *"NO INTERRUPTIVE SURFACE. Log it and leave a
persisted, discoverable marker … for whoever looks at that entity, or at Diagnostics, next."*

A log line at each refusal still exists (slice 11, unconditional). What does not exist is anyone
being interrupted.

### The five rounds, compressed, because the shape is the lesson

Each fix was correct about the thing it fixed; none questioned the surface.

1. *"Dedup is free"* — `(×N)` counted sweep runs, not projects, because `push` increments on
   every identical push and `startPersistence()` re-runs from `saveSettings`.
2. *Aggregate the set and interpolate the count* — fixed that, and broke on a set that changes
   while staying non-empty: dedup is keyed on message **text**, so `{A}` then `{A,B}` leaves two
   contradictory warnings standing.
3. *Hold the reported set for the session* — necessary against `saveSettings` replacing the
   root, and orthogonal to (2).
4. *Drop the count, push on the transition* — and a still-live stale entry means the
   count-free warning folds into it as `×2` anyway.
5. *Defer preemption to slice 17* — which assigns policy for an **error** preempting a warning
   and says nothing about a fourth **warning**. The deferral was to a decision that does not
   exist.

**Four of the five were defects introduced by the previous fix.** A toast queue with text-keyed
dedup, a three-slot cap, no expiry for `warning` and no retract door cannot express *"this
condition is currently true"* — and every round spent building scaffolding around that was a
round not spent asking whether the surface was right. The signal was available from round one:
the fix that keeps needing another fix is usually answering the wrong question.
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
- The Definition of Done's three-refusals item, split: **two refusals** at the sites that have
  a door, plus a **derived `DiagnosticsSnapshot.folderOverlaps`** for the site that does not.
  The guarantee is discoverability, not a refusal and not a notification, and the item must say
  so — it is the second time this criterion has been narrowed, and a criterion that quietly
  keeps its old wording is how the gap between promise and check reopens.
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
than measurements — that discoverability is an acceptable guarantee for §83's third site, that
the diagnostics query is the right home for a derived condition, or that two refusals plus a
derived entry is what §83 should now be read as asking for. Those are still arguments, and every
finding this branch took was originally an argument that read as settled. The strongest evidence
for that: the notice design survived five rounds of *fixes* before anyone asked whether it was
the right surface, and the answer took one measurement of a docblock that had been there all
along.

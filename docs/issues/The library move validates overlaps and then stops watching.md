---
type: Issue
parent: "[[Asset library]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The library move validates overlaps and then stops watching

§83's refusals fire before the move begins. A project folder dragged after that is not seen,
and the destination is persisted overlapping it.

**Corrected five times in review. Kept to what is measured; the analysis around it was wrong
often enough not to be worth reconstructing.**

## What is measured

- `migrateLibraryFolder` reads `deps.projectFolders()` **once**, at step 3. It holds no
  subscription and never re-queries.
- After step 3 come the awaited rename loop (step 4), a full rebuild (step 5), and
  `deps.persist(destination)` (step 6). No validation runs in any of them.
- `persist` is asynchronous past the point of any check: `persistLibraryFolder` queues through
  `settingsWrites` and awaits `saveData` before `applySettings`.
- `RenovationPlannerPlugin` filters vault events to `TFile`, so a folder drag reaches the index
  only at the next full rebuild.

## The exposure, in the direction it actually occurs

A project folder dragged into the destination after step 3 leaves the library **containing**
that project folder, and the setting is persisted anyway. That breaks §83, which forbids either
folder containing the other.

It is **not** the catastrophic direction, and an earlier draft of this note said it was.
`foldersOverlap`'s own docblock states the consequence precisely: *"a project folder holding the
library would take every project's shared catalogues with it"* — that is
project-contains-library. Here the containment runs the other way, so deleting the project
removes its own nested folder and leaves the catalogue beside it intact.

So the cost is a violated invariant and a vault whose layout the guards would have refused, not
data loss. Worth fixing; not worth the alarm the first four drafts gave it.

## It is testable

An earlier draft said no gate could see this because the fake rename resolves synchronously.
That is wrong: `migrateLibraryFolder` injects both `renameFile` and `projectFolders`, and the
test harness takes overrides for each. A regression case returns a deferred promise from
`renameFile`, mutates the value `projectFolders` closes over while the migration is suspended,
then releases it — the same deferred-gate technique `assetOptionsRefresh.test.ts` already uses.
Any fix here should ship with one.

## What a post-rebuild check does and does not do

Placing a validation between step 5 and step 6 **narrows** the window: step 5's rebuild is a
full vault scan, so a drag during the rename loop is visible to it. It does **not close** the
race — the persist that follows is asynchronous, and a drag landing inside it is still
persisted.

If such a check is added, it should **refuse rather than warn**: a warning persists a
configuration the pre-move guards would have refused, and refusing is recoverable — the notes
sit at the destination, the user moves the offending project folder clear and re-runs **Move
library** against their current location, where `libraryDestinations` offers it and branch (a)
of the source guard permits the now-empty source. No hand-editing of `data.json`.

## What closes it

Undecided. The post-rebuild check is cheap and partial. Closing the race properly means holding
project-folder state stable across the persist, or accepting the residue and writing it down
where the code is.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 3 to 6, and `libraryDestinations`.
- `src/infrastructure/obsidian/repositories/foldersOverlap.ts` — §83 and which direction is
  destructive.
- `src/plugin/RenovationPlannerPlugin.ts` — `persistLibraryFolder`, `queueSettingsWrite`, and
  the `TFile` filter.
- PR #57, where five review rounds corrected this note in turn.

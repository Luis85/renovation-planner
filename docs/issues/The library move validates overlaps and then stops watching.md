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

§83's two refusals both fire before the move begins. A project folder dragged after that is
not seen, and the destination is persisted overlapping it.

**This note has been corrected four times in review. Everything below is measured; the design
reasoning that kept being wrong has been cut rather than patched again.**

## What is measured

- `migrateLibraryFolder` reads `deps.projectFolders()` **once**, at step 3. It holds no
  subscription and never re-queries.
- After step 3 come the awaited rename loop (step 4), a full rebuild (step 5), and
  `deps.persist(destination)` (step 6). No validation runs in any of them —
  `awk '/4\. Move, so the vault/,/^}/' … | grep foldersOverlap` reports two hits and both
  belong to `libraryDestinations`, the picker's filter, which ran earlier.
- `persist` is asynchronous past the point of any check: `persistLibraryFolder` queues through
  `settingsWrites` and awaits `saveData` before `applySettings`.
- `RenovationPlannerPlugin` filters vault events to `TFile`, so a folder drag reaches the index
  only at the next full rebuild.

## The exposure

A project folder dragged any time after step 3 leaves the library overlapping it, with the
setting persisted. §83's stated consequence is that deleting that project then takes every
project's shared catalogue with it.

## What a post-rebuild check does and does not do

Placing a validation between step 5 and step 6 **narrows** the window: step 5's rebuild is a
full vault scan, so a drag during the rename loop is visible to it. It does **not close** the
race — the persist that follows is asynchronous, and a drag landing inside it is still
persisted. Closing the race needs synchronisation spanning the persist, which is design work
rather than an added check.

Two things about that check are settled and worth keeping:

- **Refuse, do not warn.** A warning would persist the overlapping `libraryFolder`, which is
  the destructive state itself. The same asymmetry `foldersOverlap` folds case for:
  over-refusing costs a rename, under-refusing costs the catalogue.
- **A refusal is recoverable.** Notes sit at the destination and the setting names the source;
  the user moves the offending project folder clear and re-runs **Move library** against the
  notes' current location. `libraryDestinations` then offers it, and the now-empty source is
  permitted by branch (a) of the source guard. No hand-editing of `data.json`.

## Why no gate saw it

Nothing in the suite can drag a folder mid-`await`; the fake vault's rename is synchronous, so
the window does not exist to be exercised. `docs/tests/cases/Move the Library.md` does not ask a
tester to reorganise folders during a move either.

## What closes it

Undecided. The cheap step is the post-rebuild check, which narrows the window and does not
close it — worth taking on its own terms provided the note it ships with does not claim more.
Closing it properly means holding project-folder state stable across the persist, or accepting
the residue and writing it down where the code is.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 3 to 6, and `libraryDestinations`.
- `src/plugin/RenovationPlannerPlugin.ts` — `persistLibraryFolder`, `queueSettingsWrite`, and
  the `TFile` filter.
- PR #57, where four review rounds corrected this note's earlier claims in turn.

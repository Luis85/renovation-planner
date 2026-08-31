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

Design slice 19 gave §83 two refusals where there are doors. Both fire before the move begins,
and nothing looks again once it has.

## The question

`migrateLibraryFolder` validates in two steps — the destination against the source (step 2),
and against every project folder (step 3, §83's own rule) — and then step 4 awaits a
`renameFile` per catalogue note. A project folder dragged in Obsidian's file explorer during
that loop leaves the library overlapping a project folder: the exact state §83 exists to
prevent, since deleting such a project takes every project's shared catalogue with it.

Measured rather than assumed, because a grep says the opposite:

```
awk '/4\. Move, so the vault/,/^}/' src/plugin/settings/libraryMigration.ts \
  | grep -E "foldersOverlap|projectFolders\(\)"
```

reports two hits, and **both belong to `libraryDestinations`** — the picker's convenience
filter, which runs before any of this. There is no post-move check. This is why the item read
as implemented on a first pass and is worth stating: the predicate is present in the file and
absent from the path.

## What is true today

- Step 0 already refreshes the project index before *any* validation, so the pre-move answer is
  as fresh as the pipeline can make it. This item is only about the window after it.
- The two refusals are real and tested; nothing here suggests otherwise.
- `libraryDestinations` filters the picker by the same predicate, so an overlapping destination
  is not offered in the first place. Its own docblock says filtering is a convenience and never
  the guard, precisely because a folder can be dragged between choosing and applying.

## Alternatives weighed, and why they were not taken

- **Re-run the validation between step 5 and step 6.** The direct fix, and it works — a first
  draft of this note said it would be inert and was wrong. Step 5's `deps.rebuildIndex()`
  reaches `RenovationPlannerPlugin.startPersistence()`, a full vault scan that re-derives every
  project entry from the notes' *current* paths. A project folder dragged during step 4 is
  therefore visible to a check placed after that rebuild, even though the `TFile` filter means
  no event ever announced the drag. The inert version is a check placed immediately after the
  rename loop and before the rebuild; the placement is the whole difference.
- **Refusing the persist is the right action there, and it has a recovery.** A first draft
  called it "a position with no clean move"; that was wrong, and it argued toward the unsafe
  option. The state after such a refusal is: notes at the destination, setting still naming the
  source, destination overlapping project P. The user moves P clear and runs **Move library**
  again, targeting where the notes now are — `libraryDestinations` offers it once P is clear,
  and the now-empty source is explicitly permitted by branch (a) of the source guard ("there is
  nothing to move and nothing that could be stranded"), so the run relocates no notes, rebuilds
  and persists. No hand-editing of `data.json` at any point.
- **A warning instead of a refusal is strictly worse, and was the wrong suggestion.** It would
  persist a `libraryFolder` overlapping a project folder — the exact §83 state whose consequence
  is that deleting that project takes every project's shared catalogue with it. A refusal leaves
  the setting naming a folder the catalogue has left, which the paragraph above recovers from; a
  warning leaves the destructive configuration in `data.json`, which nothing recovers from. Same
  asymmetry that makes `foldersOverlap` fold case: for a guard, over-refusing costs a rename and
  under-refusing costs the catalogue.
- **Closing the `TFolder` gap does NOT close this race, and listing it here as an alternative
  was the second wrong turn.** Repathing descendant index entries cannot help a check that has
  already run: step 3 reads `deps.projectFolders()` once, `migrateLibraryFolder` holds no
  subscription, and nothing re-queries before the persist — so fresher index data arriving
  during the rename loop reaches no reader inside this function. The pipeline fix is worth doing
  for the consumers that *do* re-read, the project-row overlap marker most visibly, and belongs
  on its own merits rather than here. The one case it might have covered for this item — a drag
  that landed before the migration began — is already covered by step 0's rebuild.
- **Bound the window explicitly** — refuse to start when any project folder is unresolvable, and
  say in the documents that a concurrent drag is out of scope. Cheap and honest; it narrows the
  claim rather than closing the hole.

## Why no gate saw it

The refusals are tested at the doors that have them, and a test can only drive the sequence the
code offers. Nothing in the suite can drag a folder mid-`await`, and the fake vault's rename is
synchronous, so the window does not exist to be exercised. The manual case
(`docs/tests/cases/Move the Library.md`) does not ask a tester to reorganise folders during a
move either.

## Why it matters

- The consequence §83 names is the loss of every project's shared catalogue when one project is
  deleted. That is the most destructive outcome the slice guards against.
- It is narrow — it needs a drag inside the rename loop — but the loop is exactly as long as the
  catalogue is large, so the window grows with the vault.

## What closes it

Re-run the §83 validation between step 5's rebuild and step 6's persist, and refuse on an
overlap with its own code. Three review rounds narrowed it to that: the placement is what makes
the check effective, refusing is safe because the user can move the offending project folder
clear and re-run against the notes' current location, and a warning is not the gentler option
but the destructive one, since it persists the overlap.

What is left is the copy — the refusal has to explain a state the user has not seen before
(notes moved, setting unchanged) and name the recovery, because `settings.library-persist-failed`'s
existing sentence describes the same shape with a different remedy.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 2, 3 and 4, and `libraryDestinations`.
- `src/plugin/RenovationPlannerPlugin.ts` — the `TFile` filter on the four vault events.
- `docs/tests/cases/Move the Library.md` — steps 12 and 12b, which already record that the
  overlap marker follows a rebuild rather than the drag.
- PR #41, and `docs/superpowers/specs/2026-08-30-slice-19-asset-catalogue-leaves-the-project-design.md`.

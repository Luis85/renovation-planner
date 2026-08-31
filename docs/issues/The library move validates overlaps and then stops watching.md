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

- **Re-run the same validation after the move.** The obvious remedy, and close to inert.
  `projectFolders()` derives each folder from the project index, and `RenovationPlannerPlugin`
  filters vault events to `TFile` — so the `TFolder` Obsidian reports for a folder drag is
  dropped, `VaultChangeAdapter` never hears it, and the index keeps the old path. A post-move
  recheck would re-read the same stale answer the pre-move check already had. It would catch
  only the case where something else rebuilt the index mid-flight, which is not the reported
  scenario. **Implementing this and closing the item would change almost nothing while looking
  like a fix**, which is the specific trap worth recording.
- **Close the cause instead** — handle `TFolder` renames in the vault-change pipeline by
  repathing descendant index entries. Every index consumer inherits it, including the
  project-row overlap marker, which today only updates at a full rebuild. Correct, and larger
  than this item: it is a change to a seam five repositories and three change sources read
  through.
- **Bound the window explicitly** — refuse to start when any project folder is unresolvable,
  and say in the documents that a concurrent drag is out of scope. Cheap and honest; it
  narrows the claim rather than closing the hole.

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

Not designed here, and the decision is which of the three directions above is wanted. The
smallest honest step is the third: narrow the claim in the documents so the residue is stated
rather than implied. The real fix is the second, and it belongs to whoever next opens the
vault-change pipeline.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 2, 3 and 4, and `libraryDestinations`.
- `src/plugin/RenovationPlannerPlugin.ts` — the `TFile` filter on the four vault events.
- `docs/tests/cases/Move the Library.md` — steps 12 and 12b, which already record that the
  overlap marker follows a rebuild rather than the drag.
- PR #41, and `docs/superpowers/specs/2026-08-30-slice-19-asset-catalogue-leaves-the-project-design.md`.

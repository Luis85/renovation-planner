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
- **What such a check can actually do is narrower than refusing up front, and that is the part
  worth designing.** By the time it fires the notes have already moved, so its only action is
  to refuse the persist — which leaves the catalogue at the destination and the setting naming
  the source. That is exactly the state `settings.library-persist-failed` already documents,
  and its recorded remedy is *"setting the library folder to where they now are"* — which, in
  this case, is the overlap the check just refused. So a post-move refusal detects the problem
  and hands the user a position with no clean move in it. A warning that names the overlapping
  project may be the more honest surface than a refusal.
- **Close the cause** — handle `TFolder` renames in the vault-change pipeline by repathing
  descendant index entries. It is the only option that improves the *pre-move* check too, since
  a drag that lands between validation and the first rename is invisible to both today. Every
  index consumer inherits it, including the project-row overlap marker, which currently only
  updates at a full rebuild. Larger than this item: a change to a seam five repositories and
  three change sources read through.
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

The check itself is small and its placement is now known: between step 5's rebuild and step 6's
persist. What is not settled is what it should DO there, given that refusing leaves the user
holding a moved catalogue and a setting that cannot legally be pointed at it. Decide that
first; the code is the easy half.

The wider fix — teaching the pipeline about `TFolder` renames — is what would let the *pre-move*
check see a drag at all, and belongs to whoever next opens that seam.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 2, 3 and 4, and `libraryDestinations`.
- `src/plugin/RenovationPlannerPlugin.ts` — the `TFile` filter on the four vault events.
- `docs/tests/cases/Move the Library.md` — steps 12 and 12b, which already record that the
  overlap marker follows a rebuild rather than the drag.
- PR #41, and `docs/superpowers/specs/2026-08-30-slice-19-asset-catalogue-leaves-the-project-design.md`.

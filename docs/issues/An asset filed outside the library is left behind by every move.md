---
type: Issue
parent: "[[Asset library]]"
order: 20
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

# An asset filed outside the library is left behind by every move

Facts only. This note previously cited a decision that was never taken and never written down.

## Measured

- `catalogueNotesIn` selects with `catalogue.has(file.path) && file.path.startsWith(root)`, so
  an asset note outside the library folder is not moved.
- That matches how the repository writes: updates go where the note already sits, only inserts
  go to the library. A stray therefore never moves.
- The behaviour is pinned by `tests/plugin/settings/libraryMigration.test.ts`, *'leaves an asset
  filed outside the library where it is'*.
- Nothing reports it. A move that relocates fewer notes than the catalogue holds raises nothing.
- Since design slice 18 the index is bounded by what a note declares, and `listAll` reads the
  type axis, so a stray stays discoverable, readable and updatable. This is a split layout, not
  lost data.
- The slice plan's *Open questions* item 3 flags this and closes *"Worth stating in
  `docs/tasks/19` rather than discovering later."* It was not:
  `grep -n "outside the library" docs/tasks/19*.md` returns nothing.

## Undecided

Report the count, offer to move the strays, or stay silent. The plan's own header says the
decision was never taken.

## References

- `src/plugin/settings/libraryMigration.ts` — `catalogueNotesIn`
- `docs/superpowers/plans/2026-08-30-slice-19-asset-catalogue-leaves-the-project.md` — *Open
  questions*, item 3
- PR #57

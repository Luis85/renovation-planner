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

Facts only. Six review rounds corrected the analysis this note used to carry, so it carries
none.

## Measured

- `migrateLibraryFolder` reads `deps.projectFolders()` once, at step 3. No subscription, no
  re-query.
- Step 4 (awaited rename loop), step 5 (full rebuild) and step 6 (`deps.persist`) run no
  validation.
- `persist` is asynchronous past any check: `persistLibraryFolder` queues through
  `settingsWrites` and awaits `saveData` before `applySettings`.
- `RenovationPlannerPlugin` filters vault events to `TFile`, so a folder drag reaches the index
  only at the next full rebuild.
- A project folder dragged after step 3 leaves the library **containing** it, and the setting
  is persisted. §83 forbids either folder containing the other.
- That is not the destructive direction. `foldersOverlap`'s docblock: *"a project folder holding
  the library would take every project's shared catalogues with it"* — the reverse containment.
- The race is testable: return a deferred promise from the injected `renameFile`, mutate what
  the injected `projectFolders` closes over while suspended, release. Same technique as
  `assetOptionsRefresh.test.ts`.

## Undecided

Whether to add a validation between steps 5 and 6 (narrows the window; cannot close it, because
`persist` is async), to synchronise project-folder state across the persist, or to accept the
residue and record it where the code is.

## References

- `src/plugin/settings/libraryMigration.ts`
- `src/infrastructure/obsidian/repositories/foldersOverlap.ts`
- `src/plugin/RenovationPlannerPlugin.ts`
- PR #57

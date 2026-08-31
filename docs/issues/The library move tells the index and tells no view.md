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

# The library move tells the index and tells no view

`migrateLibraryFolder` rebuilds the project index and persists the setting. It announces
nothing, so a view that had already read holds paths the vault no longer has.

## The question

The migration holds no `EventBus` at all — `grep -E "events|publish|EventBus"` over
`src/plugin/settings/libraryMigration.ts` reports nothing. Step 5 calls `deps.rebuildIndex()`,
which refreshes the *index*; the views reading through it are told nothing and keep whatever
they last hydrated.

A Plan Editor open during a move therefore keeps Inspector DTOs naming pre-move paths.

## What is true today

- **The asset picker recovers, and only incidentally.** `createAssetCatalogueChangeSource`
  subscribes to `ProjectIndexEntryChanged`, which `VaultChangeAdapter` announces per renamed
  note — so the picker re-reads because the migration renames files, not because the migration
  says anything. Any surface not on that source stays stale.
- **It is not data loss.** Since design slice 18 the index is bounded by what a note *declares*
  rather than where it sits, so a moved asset stays discoverable, readable and updatable, and an
  update writes where the note already is.
- **It self-corrects at the next full rebuild** — `onLayoutReady`, so a reload, or a settings
  save.

## Alternatives weighed, and why they were not taken

- **Publish one event at the end of the migration.** The obvious fix, and it wants designing
  against a cost already measured on this path rather than bolted beside it: during the move
  `VaultChangeAdapter` already announces one `ProjectIndexEntryChanged` per note, and the asset
  picker's reloads had to be coalesced because N renames were producing N vault-wide scans per
  open editor. A second announcement mechanism on top is a second burst unless it is deliberate
  about arriving once, at the end.
- **Have step 5's rebuild publish `ProjectIndexRebuilt`.** Possibly sufficient, and it would
  reuse a signal every change source already handles. Open question: that event has exactly one
  publisher today (layout-ready and a settings swap), so this is a question about who should own
  publishing it rather than about adding a name.
- **Leave it to the rebuild.** Defensible while the only known stale surface is the Inspector,
  and a user who has just moved their whole catalogue is plausibly about to reload anyway. It is
  the current behaviour by omission rather than by decision, which is what this note changes.

## Why no gate saw it

Nothing asserts on what a *mounted view* holds after a migration. The migration's own suite
drives `migrateLibraryFolder` against a harness of function stubs and asserts on the renames,
the order and the persisted folder — none of which can see a Vue tree. The settings-tab suite
mounts a tab, not an editor.

## Why it matters

- The Inspector is where a user reads what an asset costs. A stale DTO there is a number
  attached to a path that no longer exists, with nothing saying so.
- The moment is badly chosen for staleness: moving the library is a deliberate, whole-catalogue
  operation, and it is exactly when a user looks to confirm it worked.

## What closes it

Not designed here. Three things want answering first: which surfaces actually hold stale state
(the Inspector is the known one; a sweep would say whether it is alone), whether
`ProjectIndexRebuilt` from step 5 is the right signal or a migration-specific event is, and
whether anything needs to distinguish "paths moved" from "entities changed" — nothing about an
asset changes in a migration except where its note sits.

## References

- `src/plugin/settings/libraryMigration.ts` — steps 5 and 6.
- `src/application/events/assetCatalogueChangeSource.ts` — the picker's own source, and the
  coalescing note in `src/presentation/editor/runtime.ts` that records the burst it costs.
- `src/infrastructure/persistence/index/VaultChangeAdapter.ts` — `announce`, the per-note
  publisher.
- PR #41.

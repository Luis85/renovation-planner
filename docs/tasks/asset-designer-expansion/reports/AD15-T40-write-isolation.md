# Task report — AD15 T40 (graphic-write isolation)

Outcome: implemented
Owner / worktree / branch: wave-7 worker / `.worktrees/ad08r` / `ad15-t40-isolation`
Base commit / candidate commit: `7edff8c4c` / see commit on `ad15-t40-isolation`
Accepted contract revision: AD15 validation matrix, row T40
Allowed scope and shared-file leases: one new test file, plus this report as the stated exception. No `src/` file was modified in the committed tree.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/application/commands/asset/designerWriteIsolation.test.ts` | The card's file: a graphic write moves no catalogue figure and no requirement figure | Yes — the one file the lease names |
| `docs/tasks/asset-designer-expansion/reports/AD15-T40-write-isolation.md` | This report | Yes — the lease's stated exception |

## What the gap actually was, and the measurement that shaped the file

Row T40 names four graphic-write kinds: geometry, detail, group, repeat. **Three of them share one
application write path**, and that is a measurement rather than a reading:

- `src/domain/asset/detailEdits.ts`, `groupEdits.ts` and `arrangeDetails.ts` export PURE
  `AssetShape -> AssetShape` functions. No port, no repository, no event bus.
- `src/presentation/designer/selection/editShape.ts`'s `createEditShape` is what the designer hands
  each of those to, and its `write` is the dispatcher `src/plugin/guardedServices.ts` builds over
  `SetAssetShapeCommand`.
- `grep -rn "SetAssetShapeCommand" src/` prints five lines: the class declaration in
  `SetAssetShape.ts`, an import and a construction in `guardedServices.ts`, and two prose mentions
  (`arrangeDetails.ts`, `DesignerArrangePanel.vue`). No second command takes a whole `AssetShape`.

So writing four near-identical cases would have bought one path measured four times. What earns a
row beside the shared one is a writer that reaches the sidecar DIFFERENTLY, and there are two:

- `SetAssetFootprintCommand` — goes through `updateAssetShape` but supplies its OWN `ShapeChange`
  and its own `unchanged`, so its candidate and its no-write decision are different code.
- `CalibrateAssetCommand` — does not go through `updateAssetShape` at all; it composes its own
  `AssetGeometryDocument` and publishes its own `AssetDesignChanged`. `updateAssetShape.ts`'s own
  docblock states that, and it is the one sidecar writer where a new author could have reached the
  note without the shared function noticing.

The file is therefore five `it.each` rows over one shared body: a geometry write
(`SetAssetFootprint`), a detail write (`addDetail`), a group write (`groupDetails`), a repeat write
(`repeatDetails`) and a calibration write (`CalibrateAsset`).

## How the file refuses to pass for the wrong reason

- The asset is the one `assignedRequirementFixture()` builds — 45.00 EUR/m², waste 0.10, unit
  `m2` — assigned to a 10 m² zone, so every figure claimed untouched is a figure that is actually
  there. Nothing compares an absent value against an absent value.
- `registerOnAssetUpdated` is wired to the fixture's own dispatching bus, so a build that announced
  `AssetUpdated` from a graphic write really would drive the recalculation cascade.
- Each row carries a `landed(document)` probe that re-reads the stored sidecar document and names
  the thing the edit was about (the footprint's points moved; `['bowl','tank','shelf']`; the group's
  members; four details after a two-copy repeat; `knownDistance` 200). **If the write silently
  no-opped, `landed` fails** — watched red under mutation 1, where the shared write path was changed
  to store the document it read instead of the one it built, and all five rows reddened on `landed`
  while `execute` still answered `'wrote'`.
- `events.clear()` immediately before the write means the published-event assertion is over exactly
  the events this write raised: `['AssetDesignChanged']` and nothing else.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| A geometry write touches no catalogue or requirement figure | Pass | Row `a geometry write (SetAssetFootprint)` | — |
| A detail write touches no catalogue or requirement figure | Pass | Row `a detail write (addDetail via SetAssetShape)` | — |
| A group write touches no catalogue or requirement figure | Pass | Row `a group write (groupDetails via SetAssetShape)` | — |
| A repeat write touches no catalogue or requirement figure | Pass | Row `a repeat write (repeatDetails via SetAssetShape)` | — |
| The one sidecar writer outside `updateAssetShape` | Pass | Row `a calibration write (CalibrateAsset, which takes no updateAssetShape)` | — |
| Every assertion watched failing | Pass | Nine mutation runs below; no assertion was left unfalsified | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/application/commands/asset/designerWriteIsolation.test.ts` | candidate, clean tree | 0 | `Test Files 1 passed (1)` / `Tests 5 passed (5)`, 1.63s |
| `npx oxlint <the file>` | candidate | 0, no findings | silent |
| `npx eslint <the file>` | candidate | 0, no findings | silent |
| `npx vue-tsc -noEmit` | candidate, whole tree | 0 | no output |
| `git status --porcelain` after every mutation restore | candidate | only `?? tests/application/commands/asset/designerWriteIsolation.test.ts` | no `src/` residue |

### Mutation runs — every assertion watched red

Each mutation was applied to the working tree, the file run alone, and the tree restored with
`git checkout -- src/`. All five rows reddened in every run unless stated.

**1 — the shared write path stores the document it READ.** (`updateAssetShape`: `{ ...document, shape: shape.value }` → `{ ...document }`; `CalibrateAsset`: `calibration: calibrated` → `calibration: document.calibration`.) This is the "write silently no-opped" case, and each row's `landed` probe caught its own:

```
AssertionError: expected [ { x: -200, y: -350 }, …(3) ] to not deeply equal [ { x: -200, y: -350 }, …(3) ]
 ❯ Object.landed tests/application/commands/asset/designerWriteIsolation.test.ts:127:49

AssertionError: expected [ 'bowl', 'tank' ] to deeply equal [ 'bowl', 'tank', 'shelf' ]
 ❯ Object.landed tests/application/commands/asset/designerWriteIsolation.test.ts:141:65

AssertionError: expected [] to deeply equal [ [ 'detail-1', 'detail-2' ] ]
 ❯ Object.landed tests/application/commands/asset/designerWriteIsolation.test.ts:148:66

AssertionError: expected [ { id: 'detail-1', …(4) }, …(1) ] to have a length of 4 but got 2
 ❯ Object.landed tests/application/commands/asset/designerWriteIsolation.test.ts:157:36

AssertionError: expected undefined to be 200 // Object.is equality
 ❯ Object.landed tests/application/commands/asset/designerWriteIsolation.test.ts:165:48

 Test Files  1 failed (1)
      Tests  5 failed (5)
```

**2 — the shared path always reports a no-write** (`if (document.shape !== null && unchanged(...))` → `if (document.shape !== null)`):

```
AssertionError: expected 'no-write' to be 'wrote' // Object.is equality

Expected: "wrote"
Received: "no-write"

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:180:41

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

(Four, not five: `CalibrateAssetCommand` has no no-write arm, which is why its own `landed` probe in
mutation 1 is what covers that row.)

**3 — the write path also edits the asset's unit cost** (`loadAssetEntity` saves `withChanges({ unitCost: … '99.00' })`; that function is on both write paths, so all five rows):

```
AssertionError: expected { Object (amount, currency) } to deeply equal { Object (amount, currency) }

- Expected
+ Received

  {
-   "amount": "45",
+   "amount": "99.00",
    "currency": "EUR",
    Symbol(Money): true,
  }

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:184:40
```

**4 — …the waste factor** (`withChanges({ wasteFactorDefault: …div(2) })`):

```
AssertionError: expected '0.05' to be '0.1' // Object.is equality

Expected: "0.1"
Received: "0.05"

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:185:61
```

**5 — …the unit** (`withChanges({ unit: 'each' })`):

```
AssertionError: expected 'each' to be 'm2' // Object.is equality

Expected: "m2"
Received: "each"

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:186:36
```

**6 — …or re-saves the note unchanged** (`await assets.save(loaded.value.entity, loaded.value.version)`), which moves no field and only the revision:

```
AssertionError: expected 2 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 2

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:187:41
```

**7 — a graphic write announces `AssetUpdated`** (both write paths publish `assetUpdated` beside `assetDesignChanged`):

```
AssertionError: expected [ Array(2) ] to deeply equal [ 'AssetDesignChanged' ]

- Expected
+ Received

  [
    "AssetDesignChanged",
+   "AssetUpdated",
  ]

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:193:66
```

Worth recording: with mutation 7 alone, the three REQUIREMENT assertions stayed green. That is
`setAssetHeight.test.ts`'s own recorded caveat met from this side — `assetMatchesCalculatedFrom`
compares price and unit, neither of which a graphic write moves, so the cascade lists every
requirement, skips every one and writes nothing. Falsifying the requirement assertions therefore
needed the cascade to be made to recalculate as well.

**8 — the cascade fires and recalculates** (mutation 7 plus `assetMatchesCalculatedFrom` returning `false`), which bumps the requirement's revision:

```
AssertionError: expected 3 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 3

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:192:36
```

**9 — the cascade recalculates to DIFFERENT figures.** Mutation 8 plus a call-counting override in
`deriveRequirementFigures` so only the cascade's own pass differs from the assignment's (a change
applied to every call is masked, because the `before` snapshot goes through the same function).
With the later call's waste factor at `0.50` the quantity moved; with its unit cost at `90.00` the
estimated cost moved:

```
AssertionError: expected '15' to be '11' // Object.is equality

Expected: "11"
Received: "15"

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:190:63
```

```
AssertionError: expected '990.00' to be '495.00' // Object.is equality

Expected: "495.00"
Received: "990.00"

 ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:191:58
```

No assertion in the file resisted falsification. One mutation ATTEMPT did not mutate and is recorded
rather than dropped: `wasteFactorDefault.plus(1)` gives 1.10, which `Asset.create` refuses, so the
guarded save never happened and the run was green — a green that said nothing about the assertion.
It was replaced by `.div(2)` (mutation 4). A mutation run that comes back green is a mutation to
check before it is a test to trust.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze`, `npm run lint`, and any bare
  `npx vitest run`.** Forbidden by the card: two other workers are on this machine and a broad run
  produces a wrong red, not a slow one. Coverage floors, `fallow`, and `eslint .` over the whole
  tree are therefore unverified for this branch and belong to the integrator on the integration SHA.
- **Coverage of the new file against the 99/99/99/98 floors.** Not measured; `test:coverage` is the
  only instrument and it is the integrator's.
- **The browser harness, `npm run harness-shot`, `npm run test-build`, and every manual case.**
  This is an application-layer node test that draws nothing; no surface changed.
- **Any `src/` behaviour change.** None was made, so there is nothing to verify. The nine mutations
  above existed only inside a run and were restored with `git checkout -- src/`; `git status
  --porcelain` after the final restore shows only the new test file.
- **A re-run under load / a serial re-run.** Not needed — the file ran in 1.6–2.5s every time, and
  no failure observed in this task was a timeout. No timeout budget was raised anywhere.
- **The real `ObsidianAssetGeometrySidecar` over a fake vault.** The file drives
  `InMemoryAssetGeometrySidecar` instead; see the next section for why that is the right instrument
  here and what it does not cover.

## Data and integration implications

Schema/migration change: none. No `src/` file changed.

Relevant renderer/export/revision consumers: the file pins what the recalculation cascade and the
Requirement read model must keep NOT seeing. A future increment that makes a graphic fact an input
to a figure — a detail count driving a quantity, a footprint area pricing a requirement — will turn
these rows red, and that is the intended alarm rather than a defect in them.

Undo/no-op/conflict/failure coverage: no-op is covered as a falsifier (mutation 2) rather than as a
subject; the reversible adapters, the version conditions and the refusal arms are each already
covered by `setAssetShape.test.ts`, `setAssetFootprint.test.ts`, `calibrateAsset.test.ts` and
`reversibleAssetDesign.test.ts`, and this file deliberately re-asserts none of them.

Identity/unit/quantity/calibration invariants: the asset's `unit`, `unitCost` and
`wasteFactorDefault`, the asset note's revision, and the Requirement's `quantity.calculated`,
`estimatedCost.calculated` and revision are the six figures held still. The calibration row holds
the same six still while the calibration itself lands.

Shared root/runtime/locales wiring still required: none.

Rollback/recovery considerations: none — a test file with no `src/` dependency beyond imports.

### One choice a reviewer should look at

The sidecar is `InMemoryAssetGeometrySidecar` rather than the real
`ObsidianAssetGeometrySidecar` over a fake vault. The reason is that the fixture supplying the
Requirement half (`assignedRequirementFixture`) is in-memory, so the asset the command's existence
check reads and the asset the cascade prices are the same in-memory entity; pulling in a second,
vault-backed stack purely to own the sidecar would have put two asset repositories in one case for
no assertion's benefit. The fake is the honest one — its own header records that an absent sidecar
reads as a valid empty document exactly as `AssetGeometryStore` does, and that its version contract
is enforced rather than decorated. **What it does not cover: the bytes.** Nothing here asserts what a
`.rpgeo` file contains, and nothing needs to — `setAssetShape.test.ts` and
`assetGeometrySidecarDetails.test.ts` drive the real store over the fake vault for that.

### One thing I looked for and did not find

No `src/` change is needed for this card, and none is proposed. Every isolation the row asks about
already holds, and the nine mutation runs are the evidence that the file can tell.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

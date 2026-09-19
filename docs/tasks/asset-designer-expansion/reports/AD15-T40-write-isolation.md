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

So writing four near-identical cases would have bought one path measured four times. Two rows sit
beside the shared one because each reaches the sidecar by a different route. **Both descriptions
were too wide in the first draft of this report and are narrowed here against the greps that
contradicted them** (review round 1, conditions 2):

- `SetAssetFootprintCommand` — goes through `updateAssetShape` but supplies its OWN `ShapeChange`
  and its own `unchanged`, so its candidate and its no-write decision are different code. It is
  **one of five** commands of that description, not one of two. `grep -rn "updateAssetShape(" src/`
  prints seven lines: the definition in `updateAssetShape.ts`, and call sites in
  `SetAssetAnchor.ts`, `SetAssetFacing.ts`, `SetAssetShape.ts`, `SetAssetClearance.ts` and
  `SetAssetFootprint.ts` twice. Excluding `SetAssetShape` (whose change is a constant and whose
  `unchanged` is `ALWAYS_CHANGED`), the five are the two footprint commands, the clearance, the
  anchor and the facing. The card names none of the other four as a graphic-write kind, so one row
  covers the shape of the category.
- `CalibrateAssetCommand` — does not go through `updateAssetShape` at all; it composes its own
  `AssetGeometryDocument` and publishes its own `AssetDesignChanged`. It is the **first** sidecar
  writer outside `updateAssetShape`, which is the claim `updateAssetShape.ts`'s own docblock makes,
  and not the only one. `grep -rn "sidecar\.write" src/` prints seven calls in five modules:
  `updateAssetShape.ts`, `CalibrateAsset.ts`, `DuplicateAsset.ts`, `SetAssetBackground.ts` (twice)
  and `ReversibleAssetDesignCommands.ts` (twice). None of the three extra modules performs a
  geometry, detail, group or repeat write — a duplication, a spec-sheet swap and two undo restores
  — so the card loses no coverage; the sentence simply may not read as if they did not exist.

Neither grep counts this report: both are scoped to `src/`.

The file is therefore five `it.each` rows over one shared body: a geometry write
(`SetAssetFootprint`), a detail write (`addDetail`), a group write (`groupDetails`), a repeat write
(`repeatDetails`) and a calibration write (`CalibrateAsset`).

## How the file refuses to pass for the wrong reason

- The asset is the one `assignedRequirementFixture()` builds — 45.00 EUR/m², waste 0.10, unit
  `m2` — assigned to a 10 m² zone, so every figure claimed untouched is a figure that is actually
  there.
- **Every catalogue and requirement read goes through `expectFound`, not `expectOk`** (review round
  1, condition 4). `getById` answers `Result<Loaded<T> | null, …>`, so `expectOk` leaves the null arm
  live and every assertion below it reads through `?.` — and if BOTH sides were absent, six
  assertions would compare `undefined` to `undefined` and pass. That is not hypothetical here: the
  flagged spelling reports `Tests 5 passed (5)` against a fixture whose catalogue reads find
  nothing, measured below. `expectFound` fails at the read instead, with the question it was asking.
- `registerOnAssetUpdated` is wired to the fixture's own dispatching bus, so a build that announced
  `AssetUpdated` from a graphic write really would drive `onAssetUpdated`. **What that does NOT
  reach is the figures**, and the file's docblock now says so: `assetMatchesCalculatedFrom` compares
  `unitCost` and `unit` only, so a graphic write leaves `changed` empty and the cascade is handed
  `[]`. `after.version.revision` is the load-bearing requirement assertion; `quantity` and
  `estimatedCost` are a narrower net, because a recalculation from unchanged inputs produces
  identical figures.
- Each row carries a `landed(document)` probe that re-reads the stored sidecar document and names
  the thing the edit was about (the footprint's stored points equal the widened outline;
  `['bowl','tank','shelf']`; the group's members; four details after a two-copy repeat;
  `knownDistance` 200). **Every one of the five is POSITIVE** (review round 1, condition 3): the
  footprint probe was `not.toEqual(SEED.footprint.points)`, which also passes when `document.shape`
  is `null` and the expression is `undefined` — so the one row able to certify a vanished design was
  the one row asserting a negative. **If the write silently no-opped, `landed` fails** — watched red
  under mutation 1, where the shared write path was changed to store the document it read instead of
  the one it built, and all five rows reddened on `landed` while `execute` still answered `'wrote'`.
- `events.clear()` immediately before the write means the published-event assertion is over exactly
  the events this write raised: `['AssetDesignChanged']` and nothing else.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| A geometry write touches no catalogue or requirement figure | Pass | Row `a geometry write (SetAssetFootprint)` | — |
| A detail write touches no catalogue or requirement figure | Pass | Row `a detail write (addDetail via SetAssetShape)` | — |
| A group write touches no catalogue or requirement figure | Pass | Row `a group write (groupDetails via SetAssetShape)` | — |
| A repeat write touches no catalogue or requirement figure | Pass | Row `a repeat write (repeatDetails via SetAssetShape)` | — |
| The first sidecar writer outside `updateAssetShape` | Pass | Row `a calibration write (CalibrateAsset, which takes no updateAssetShape)` | — |
| Every assertion watched failing | Pass | Nine mutation runs below; no assertion was left unfalsified | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/application/commands/asset/designerWriteIsolation.test.ts` | candidate, clean tree | 0 | `Test Files 1 passed (1)` / `Tests 5 passed (5)`, 1.63s |
| the same, after review round 1 | follow-up commit, clean tree | 0 | `Test Files 1 passed (1)` / `Tests 5 passed (5)`, 1.50s |
| `npx oxlint <the file>` | candidate and follow-up | 0, no findings | silent |
| `npx eslint <the file>` | candidate and follow-up | 0, no findings | silent |
| `npx vue-tsc -noEmit` | candidate and follow-up, whole tree | 0 | no output |
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

## Review round 1 — the four conditions, and the two new reds

Candidate `b787021a3` was approved conditional on four changes. All four are in the follow-up
commit; nothing in `src/` was touched, and the card's coverage is unchanged (no row added, none
removed).

1. **The docblock contradicted this report's own Finding 1.** It claimed the registered cascade
   "really would move the Requirement this file re-reads", which mutation 7 had already measured as
   false. The docblock now carries the honest version — the `assetMatchesCalculatedFrom` filter, the
   empty `changed`, the `[]` handed to `runRecalculationCascade`, and the sentence Finding 2 earns
   about which requirement assertion is load-bearing — in the shape `setAssetHeight.test.ts` already
   uses for a height. **The caveat belongs in the file a future reader opens, not only in a report
   nothing re-runs.**
2. **Two category claims narrowed to what the greps print.** Both greps were re-run after the change
   and both are scoped to `src/`, so neither counts the sentence making the claim. The full output
   is quoted in the measurement section above: seven `updateAssetShape(` lines (a category of five,
   not two) and seven `sidecar.write` calls in five modules (Calibrate is the FIRST such writer, not
   the only one).
3. **The footprint probe is positive now.** Verbatim red, and the reason the change matters — the
   same mutation, the same tree, the two spellings:

   Mutation: the shared write path produces no shape (`{ ...document, shape: null }`).

   *New spelling, `toEqual(WIDER)`:*

   ```
   AssertionError: expected undefined to deeply equal [ { x: -300, y: -450 }, …(3) ]

   - Expected:
   [
     {
       "x": -300,
       "y": -450,
     },
   …
    Test Files  1 failed (1)
         Tests  4 failed | 1 passed (5)
   ```

   *Flagged spelling, `not.toEqual(SEED.footprint.points)`, same mutation:*

   ```
    Test Files  1 failed (1)
         Tests  3 failed | 2 passed (5)
   ```

   The geometry row is one of the two that PASS under the old spelling, on a tree where the write
   produced no shape at all. That is the row this file existed to make honest.

4. **`expectFound` at all four reads.** Verbatim red, again with both spellings against one
   mutation — both catalogue reads pointed at an id that was never created:

   *House spelling, `expectFound`:*

   ```
   Error: Expected the entity to be found, got null.
    ❯ expectFound tests/helpers/domain.ts:103:9
      101|
      102|  if (value === null) {
      103|   throw new Error('Expected the entity to be found, got null.');
         |         ^
      104|  }
      105|  return value;
    ❯ tests/application/commands/asset/designerWriteIsolation.test.ts:198:24

    Test Files  1 failed (1)
         Tests  5 failed (5)
   ```

   *Flagged spelling, `expectOk` plus `?.`, same mutation:*

   ```
    Test Files  1 passed (1)
         Tests  5 passed (5)
   ```

   **Five green cases over a fixture whose catalogue reads find nothing** — the comparison of two
   blanks, reproduced rather than argued. An intermediate attempt is worth recording because it did
   NOT reproduce it: deleting the asset after `assetBefore` had been read left one side real and the
   other absent, so the assertions failed rather than passing. Both sides have to be blank for the
   hazard to appear, which is exactly why it is hard to notice.

One correction to the earlier evidence in this report: mutation 1's quoted geometry-row failure
(`expected [ … ] to not deeply equal [ … ]`) is the output of the SUPERSEDED negative probe. The
same mutation against the positive probe is quoted under condition 3 above. The other four rows'
mutation-1 output is unaffected.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze`, `npm run lint`, and any bare
  `npx vitest run`.** Forbidden by the card: two other workers are on this machine and a broad run
  produces a wrong red, not a slow one. Coverage floors, `fallow`, and `eslint .` over the whole
  tree are therefore unverified for this branch and belong to the integrator on the integration SHA.
- **Coverage of the new file against the 99/99/99/98 floors.** Not measured; `test:coverage` is the
  only instrument and it is the integrator's.
- **The browser harness, `npm run harness-shot`, `npm run test-build`, and every manual case.**
  This is an application-layer node test that draws nothing; no surface changed.
- **Any `src/` behaviour change.** None was made in either round, so there is nothing to verify. The
  mutations existed only inside a run and were restored — the `src/` ones with
  `git checkout -- src/`, the two test-file ones from a copy taken before mutating and verified
  byte-identical with `diff` afterwards, because `git checkout --` would have discarded the
  round-1 fixes along with them. `git status --porcelain` after the final restore shows only the
  test file's own modification.
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

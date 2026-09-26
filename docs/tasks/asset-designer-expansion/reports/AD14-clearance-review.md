# Task report — AD14 (protect historical plans and honest export behavior)

Outcome: **implemented, with ONE deliberately red assertion awaiting a one-line integrator wire.**
Owner / worktree / branch: wave-5 worker · `.worktrees/ad14` · `ad14-clearance-review`
Base commit / candidate commit: `044e11f52` / **`33da7438a`** — every source and test change ends
there. `c9ea7758e` is the implementation and `33da7438a` the follow-up round (a docblock count
written from the grep, and one `vue-tsc` error the capability gate introduced after the last
type-check). The commit carrying THIS paragraph touches only this report, for the reason
`RESUME.md` was corrected once already: a document cannot name a SHA it is inside.
Accepted contract revision: `r1`, applying ruling **AD14-R1**, contract **C03**'s supersession
clause, **C07**'s resize paragraph and **C11** as `r1` row 3 settles it.
Allowed scope and shared-file leases: the wave-5 AD14 row — `domain/asset/AssetShape.ts`
(integrator lease), `domain/asset/shapeEdits.ts`, `infrastructure/persistence/dto/assetGeometry.ts`
(integrator lease), the `SCHEMA_VERSION` literal in `AssetGeometryStore.ts` (integrator lease), the
asset-geometry mappers, `application/commands/asset/SetAssetClearance.ts` **and the clearance arms
the grep names**, NEW `presentation/designer/inspector/DesignerClearanceReview.vue`,
`DesignerInspector.vue` (ADDITIVE ONLY — one mount line), `styles/designer.css` (ADDITIVE ONLY),
`i18n/locales/{en,de}/assetClearanceReview.ts`, `docs/development/adrs/ADR-0034-*` (integrator
lease), and its own tests.

**Two notes on that scope, both stated rather than assumed.**

1. **`styles/designer.css` is UNCHANGED and is still at 388 lines.** The lease budgeted three of its
   twelve remaining lines for a fifth flat inspector button; none were spent. The reason is in
   `DesignerClearanceReview.vue`'s template comment and repeated under
   [Changed files](#changed-files-and-reason): the control lives inside a `.rp-designer-clearance`
   section, where the button already there (`generate-clearance`) is a
   `.rp-designer-selection-button`, and that selector's base, `:hover` and `:focus-visible` rules
   are the same treatment minus the full width and bottom margin the four panel-level actions carry.
   A fifth flat-button selector would have made this the only sectioned button dressed as a
   panel-level one.
2. **`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md` is edited and is not
   in the wave-5 row.** The dispatch brief required it and, more durably, the integrator-authored
   ADR-0034 already committed at `ae6bb2a63` names that correction as part of this change
   ("*…is corrected there*"). Flagged here rather than assumed, because this ledger has twice been
   corrected for a grant that lived only in a dispatch message.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/domain/asset/AssetShape.ts` | `clearanceNeedsReview?: boolean` on `AssetShape`; `validatePlacement` gains the third flag coherence (`asset.absent-clearance-cannot-need-review`); `validateAssetShape` normalises the flag to a definite boolean | yes |
| `src/domain/asset/shapeEdits.ts` | `scaleDesign` preserves a measured clearance and sets the flag; `mapPartOutline`'s and `withOutline`'s clearance arms and `removeClearance` clear it; new `markClearanceReviewed` | yes |
| `src/infrastructure/persistence/dto/assetGeometry.ts` | **schema v4**: `AssetShapeSchemaV4` adds `clearanceNeedsReview: z.boolean().default(false)`, `AssetGeometrySchemaV4` takes `z.literal(4)`, `raiseLegacyVersions` raises 1/2/3 → 4. `AssetGeometrySchemaV3` is exported for one assertion | yes |
| `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` | `SCHEMA_VERSION = 4` (the one literal, which the empty document and the write share) | yes |
| `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts` | the field in both mapper directions | yes |
| `src/application/commands/asset/SetAssetClearance.ts` | both arms clear the flag; `sameClearance` compares it, so a re-trace at identical coordinates is not declined as a no-op | yes |
| `src/application/commands/asset/SetAssetFootprint.ts` | `InheritedShape` names the field and `UNDESIGNED` sets it `false`; the `Pick` docblock's compile-time claim is narrowed to REQUIRED fields | yes |
| `src/presentation/designer/inspector/DesignerClearanceReview.vue` | NEW — the notice and the **Mark clearance as reviewed** action, drawn only while the flag is set | yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | one import and one mount line, after the clearance helper | yes (additive) |
| `src/presentation/i18n/locales/{en,de}/assetClearanceReview.ts` | the scaffold pair, filled: the notice, the action, and the new refusal's copy | yes |
| `docs/development/adrs/0034-…-preserves-its-clearance-and-flags-it.md` | the ADR was already written by the integrator at `ae6bb2a63`; **one claim narrowed** — it said the four-side helper clears the flag, which the implementing change could not reach | yes |
| `docs/superpowers/specs/2026-09-16-…-consolidate-design.md` | §7's *"every part — clearance and details included — is scaled about the anchor"* reworded and the amendment recorded in place | see note 2 above |
| `tests/domain/asset/shapeEdits.test.ts` | **the two fixtures the card names, AMENDED not deleted**, plus six new cases | yes |
| `tests/domain/asset/assetShape.test.ts` | the new refusal, its accept counterpart, the ordering pin, and the two exhaustive shape pins gaining the normalised field | yes |
| `tests/application/commands/asset/assetClearanceReview.test.ts` | NEW — the command layer's three different answers | yes |
| `tests/presentation/designer/designerClearanceReview.test.ts` | NEW — the control's predicate, its write, the real-inspector wiring, **and the deliberately red helper case** | yes |
| `tests/presentation/i18n/assetCapabilityClaims.test.ts` | NEW — **C11 r1 row 3's explicit capability gate, with tests** | yes |
| `tests/infrastructure/persistence/dto/assetGeometry.test.ts` | v3→v4 pins, the new field's default/refuse pair, and the v3-only strip case | forced by the schema bump this card owns |
| `tests/infrastructure/obsidian/repositories/assetGeometrySidecar{,Details}.test.ts` | the emitted version and the unsupported-future version move 3→4 and 4→5 | forced by the schema bump |
| `tests/presentation/designer/assetDimensions.test.ts` | **a THIRD regression fixture, amended not deleted** — the toilet preset's scaled clearance, found by running the suite rather than by reading the card | forced by the behaviour change |
| `tests/helpers/assetDesignHarness.ts` | `drawn()` carries the normalised flag, for the reason its own comment already gave about `groups` | forced by the normalisation |
| `tests/presentation/i18n/toUserMessage.test.ts` | one `MINTED` row for `asset.absent-clearance-cannot-need-review`, which that table's own policy requires of every minted code | forced by the new refusal |

## The clearance grep, and how the code was written from it

AD14-R1 states the clear-the-flag rule as a RULE and deliberately not as a list, and names the
instrument. Run in the implementing edit:

```
$ grep -rn "clearance" src/domain/asset/shapeEdits.ts src/application/commands/asset/
```

It printed 37 lines. Read for WRITES rather than reads or prose, they are:

| Site | What the grep printed | What the code does, and why |
|---|---|---|
| `shapeEdits.ts:142-143` | `mapPartOutline`'s `part.kind === 'clearance'` arm | **clears** — a transform aimed at the boundary IS a review |
| `shapeEdits.ts:155` | `withOutline`'s `part.kind === 'clearance'` arm | **clears** — the other path (a vertex moved, an edge bent) |
| `shapeEdits.ts:229` | `removeClearance`'s `clearancePending: false` | **clears** — and MUST: validation refuses either flag on an absent clearance |
| `shapeEdits.ts:245` | `scaleDesign`'s unconditional `about(shape.clearance)` | **the site that SETS it**, and the one behaviour this card supersedes |
| `SetAssetClearance.ts:85` | the removal arm | **clears** (required by validation) |
| `SetAssetClearance.ts:89-90` | the capture arm | **clears** |
| `SetAssetClearance.ts:32` | `sameClearance`'s `clearancePending` comparison | **compares the flag too** — otherwise an identical-coordinate re-trace is declined as a no-op and the notice never goes away |
| `SetAssetFootprint.ts:44` | `InheritedShape`'s `Pick` | **inherits** — a footprint write's subject is not the clearance |
| `SetAssetFootprint.ts:49-50` | `UNDESIGNED` | `false`, because its `clearance` is `null` |
| `CalibrateAsset.ts:60-64` | `rescaled`'s clearance arm | **touches nothing** — AD14-R1 refuses reusing `clearancePending` partly *because* "it would let a calibration clear a review", and `rescaled`'s `...shape` spread is what makes that true without a line |

**The grep printed two sites the ruling's own example list did not** — `SetAssetFootprint`
(`InheritedShape` and `UNDESIGNED`) and `sameClearance` — and **named one the ruling listed that the
grep does not reach**: the four-side helper's regeneration, which lives in
`src/presentation/designer/inspector/DesignerClearanceHelper.vue`, outside both grep paths and
outside every wave-5 row. That is the integration change request below. This is exactly why the
ruling mandated the grep over its own prose.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| **AD14-R1 part 1** — a measured clearance is preserved under a whole-object scale | met | `shapeEdits.test.ts` › *scales every part about the anchor…* (clearance points are the fixture's own) and *lands a straight design exactly…* (`[1400, 1000]`, not `[2800, 500]`); `assetDimensions.test.ts` › *scales a design with details…* | — |
| **`r1` row 2** — a PENDING clearance goes on scaling, unflagged | met | `shapeEdits.test.ts` › *goes on scaling a PENDING clearance, and flags nothing…* — and it asserts the exact literal the amended case gave up | — |
| **Set in `scaleDesign` and there alone**; both directions; isometries set nothing | met | *flags a measured clearance when the object GROWS as well as when it shrinks*; *stays up when the edit names another part…* drives `moveOutline`, `moveAnchor` and `setFacing` | The "and there alone" half is a claim over `src/` that no gate enforces; it rests on the grep above |
| **Identity scale sets nothing and clears nothing** | met | *sets no flag for an identity scale, and does not clear one already set*; *flags nothing when both typed dimensions are the ones the design already has* | — |
| **Cleared by any write whose subject is the clearance** | met **except one site** | the command table above, plus *comes down when the clearance itself is transformed, through either path* | `DesignerClearanceHelper.vue` — see the ICR |
| **Schema v4, `.default(false)` never `.catch(false)`** | met | `assetGeometry.test.ts` › *raises a version 1 document to version 4…*, *reads clearanceNeedsReview, and refuses a present non-boolean…*, *is refused by a version-3-only schema, which would otherwise strip the review flag…* | — |
| **Validation: no flag on an absent clearance; no `pending && needsReview` guard** | met | `assetShape.test.ts` › *refuses a review flag on a shape that has no clearance*, *accepts the review flag once there is a boundary to review*, *reports the pending refusal first…*. No guard was added for the unreachable pair — `validatePlacement`'s comment says so | — |
| **A `Reviewed` action drawn ONLY while the flag is set, never `:disabled`** | met | `designerClearanceReview.test.ts` › *draws nothing while the flag is down…*, *says what happened and offers the action once the flag is set* (which also asserts no `disabled` attribute) | — |
| **Real command wiring, not component existence (C12)** | met | *appears in the real inspector after a real resize, and the real press answers it* — the shape is `scaleDesign`'s own output and the mount is the real `DesignerInspector` | — |
| **Undo needs no mechanism** | met by construction | the flag rides on `AssetShape`; `assetPresetFlow.test.ts` › *takes the whole preset back with one undo* and `assetDimensions.test.ts`'s undo assertion both compare whole shapes after an undo | Nothing new was built, which was the instruction |
| **C03 supersession recorded** | met | ADR-0034 (already authored; one claim narrowed here), the spec §7 amendment, and three fixtures amended in place with their old expectations quoted | — |
| **C11 r1 row 3 — explicit capability gating, WITH TESTS** | met | `tests/presentation/i18n/assetCapabilityClaims.test.ts`, 4 cases: the instrument's own reach, both locales scanned, and the Reviewed copy pinned against certification language | It gates the shipped STRINGS, not the absence of a mechanism — see its header for the three things it deliberately does not do |
| **No shape history, no placement pinning** | met | neither was built | `r1` row 3 refuses both outright |
| **Card criterion: existing exports report unsupported geometry rather than dropping content** | **not applicable, and recorded rather than ticked** | `r1` row 4: *"There is no export subsystem … `src/` contains no PDF, print or render-to-file path"* | The capability gate above is what stands in its place |
| **Card criterion: delete/move the definition and render the frozen state** | **not applicable** | there is no frozen state to render; `Plan revisions` is a requirement note with no code | — |
| **Card criterion: rollback/recovery instructions** | met in the ADR | ADR-0034's Consequences: a v4 document is refused by a v3-only build rather than silently stripped, and no migration table is owed because v4 is additive | No downgrade path is claimed lossless; C09's rule stands |

## Every invariant watched failing, with the exact red

Each was reverted, the named test run, the red read, and the change restored.

**1. `scaleDesign` preserves and flags** — reverted the clearance line to `about(shape.clearance)`
and the flag to `shape.clearanceNeedsReview === true`. `tests/domain/asset/shapeEdits.test.ts`,
4 failed / 46 passed:

```
× scales every part about the anchor, which does not move, and carries pending flags
× flags a measured clearance when the object GROWS as well as when it shrinks
× lands a straight design exactly and scales every part about the anchor
× flags the clearance when only ONE axis moves
AssertionError: expected [ { x: -1500, y: -150 }, …(3) ] to deeply equal [ { x: -700, y: -300 }, …(3) ]
AssertionError: expected false to be true // Object.is equality
AssertionError: expected [ 2800, 500 ] to deeply equal [ 1400, 1000 ]
AssertionError: expected false to be true // Object.is equality
```

**2. The `|| shape.clearanceNeedsReview === true` arm, and it turns out to be load-bearing for more
than re-typing** — dropped it, leaving `clearanceNeedsReview: preserved && moved`. Three failed:

```
× sets no flag for an identity scale, and does not clear one already set
× lands a straight design exactly and scales every part about the anchor
× flags the clearance when only ONE axis moves
AssertionError: expected false to be true // Object.is equality   (×3)
```

The two `scaleDesignToDimensions` cases were **not** expected to redden and did. `solveScale` calls
`scaleDesign` repeatedly, one axis at a time, and a later pass can apply a factor of 1 on the axis
an earlier pass moved — so without the `||` the solve CLEARS the flag its own earlier step set. That
is a real defect the revert exposed and a fact worth carrying: the disjunction is what makes the
multi-pass solve safe, not merely what protects a user re-typing the same size.

**3. `removeClearance` clears the flag** — the revert makes the write REFUSE rather than merely
mis-record:

```
FAIL … removeClearance > removes the REVIEW flag too, which validation refuses on an absent clearance for the same reason
Error: Expected ok, got error: {"category":"Validation","code":"asset.absent-clearance-cannot-need-review",
"message":"A shape with no clearance has no boundary to review."}
```

**4. `mapPartOutline`'s and `withOutline`'s clearance arms, and `markClearanceReviewed`** — dropped
all three clears. Three failed:

```
× removes the REVIEW flag too, which validation refuses on an absent clearance for the same reason
× comes down when the clearance itself is transformed, through either path
× markClearanceReviewed answers the notice and moves not one coordinate
AssertionError: expected true to be false // Object.is equality
```

**5. `validatePlacement`'s new refusal** — replaced with `return ok(undefined)`:

```
FAIL … validateAssetShape > refuses a review flag on a shape that has no clearance
AssertionError: expected false to be 'asset.absent-clearance-cannot-need-re…' // Object.is equality
- Expected: "asset.absent-clearance-cannot-need-review"
+ Received: false
```

**6. The v4 field itself** — `AssetShapeSchemaV4` extended with `{}`. Two failed:

```
× raises a version 1 document to version 4, with no details, no groups and no review flag
× reads clearanceNeedsReview, and refuses a present non-boolean rather than defaulting it
AssertionError: expected undefined to be false // Object.is equality
AssertionError: expected undefined to be true // Object.is equality
```

**7. `.default(false)` rather than `.catch(false)`** — the one-word swap:

```
FAIL … reads clearanceNeedsReview, and refuses a present non-boolean rather than defaulting it
AssertionError: expected true to be false // Object.is equality
```

**8. `sameClearance` comparing the flag** — deleted that line:

```
FAIL … comes down even when the boundary is re-traced at the identical coordinates
AssertionError: expected true to be false // Object.is equality
```

**9. The inspector predicate** — widened `v-if="needsReview"` to `v-if="design.shape !== null"`:

```
FAIL … draws nothing while the flag is down, which is every ordinary state of this panel
AssertionError: expected true to be false // Object.is equality
 ❯ tests/presentation/designer/designerClearanceReview.test.ts:118:37
    118|   expect(control(wrapper).exists()).toBe(false);
```

**10. The C11 capability gate** — planted
`'designer.clearance.review.action': 'Freeze this design as an approved revision'`:

```
FAIL … declares no approval, freeze, revision or issued-handover claim in en
AssertionError: expected [ Array(1) ] to deeply equal []
+ [ "designer.clearance.review.action: Freeze this design as an approved revision" ]
```

**One thing that did NOT redden, and it is reported rather than quietly kept.** Removing
`'clearanceNeedsReview'` from `SetAssetFootprint`'s `InheritedShape` `Pick` AND removing
`clearanceNeedsReview: false` from `UNDESIGNED` left all five cases in
`assetClearanceReview.test.ts` GREEN — `withFootprint` spreads the stored object, so the flag rides
through whether or not the type mentions it, and a shapeless asset has a `null` clearance so the
constant's value cannot matter. Both are kept as DECLARATIONS that make the inheritance visible and
become load-bearing only if the field is ever made required; the `Pick`'s own docblock is narrowed
to say the compile-time guarantee covers REQUIRED fields only, and the test case says in place what
it pins and what it does not.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate, Windows, Node from the worktree | 0, no output | run twice: after the domain/schema half and after the whole change |
| `npx oxlint --deny-warnings src/` | candidate | 0 | |
| `npx oxlint --deny-warnings tests/presentation/designer/designerClearanceReview.test.ts` | candidate | 0, after fixing `unicorn/no-array-callback-reference` | the hook caught it on the Write |
| `npx vitest run tests/domain tests/core tests/presentation/{views,editor,components}` | candidate | see the run log | |
| `npx vitest run tests/harness tests/plugin tests/application tests/infrastructure` | candidate | **311 files / 3443 tests passed** | |
| `npx vitest run tests/presentation/{designer,i18n,library}` | candidate | **86 of 87 files passed, 1244 of 1245 tests** — the one failure is the deliberate red below | |
| `npx vitest run tests/domain tests/core` | candidate | 87 files / 1093 tests passed | |
| `npx vitest run tests/presentation/{views,components}` | candidate | 75 files / 787 tests passed | |
| `npx vitest run tests/presentation/editor` | candidate | **391 files / 3105 tests passed** | the editor draws a placed clearance (`assetShapeConfig.ts`) and reads no flag, so nothing there needed a change and nothing there broke |
| `npx vitest run tests/build` | candidate | **46 files / 1292 tests passed** | this is the directory the report first listed as unrun; it was then run. `regionsReachable.test.ts` lives under `tests/presentation/designer/` and was run separately |
| `npx vitest run tests/release` | candidate | 3 files / 19 tests passed | |
| `npx vue-tsc -noEmit` (third run, after the capability gate landed) | candidate | **exit 1 at first** — `assetCapabilityClaims.test.ts(102,25): error TS2345: Argument of type 'string \| undefined' is not assignable to parameter of type 'string'` — then 0 | the gate file was written after the previous type-check; recorded rather than quietly fixed, because it is the reason `tests/**` is type-checked at all |
| `npx vitest run tests/infrastructure/obsidian/repositories` | candidate | 40 files / 954 tests passed | after the v4 bump |
| `npx eslint <the 11 changed src files> --max-warnings 0` | candidate | 0 | the layer bans, the write boundary and both text bans, over exactly the files this branch changes |
| `npx eslint <the 8 changed/new test files> --max-warnings 0` | candidate | 0 | |
| `npx vitest run tests/presentation/designer/regionsReachable.test.ts tests/build/libraryComponentStyles.test.ts tests/build/styles.test.ts` | candidate | 3 files / 100 tests passed | the new SFC is import-reachable from `AssetDesignerView.ts`, mints no undeclared class, and `styles/designer.css` is unchanged at 388 lines |
| `npx vitest run tests/build/test-environments.test.ts tests/build/no-ssr-sfc.test.ts tests/presentation/i18n/{strings,toUserMessage}.test.ts` | candidate | 4 files / 121 tests passed | the German Sie rule, key and hole parity, and the new refusal's own row in the `MINTED` table |
| `npm run analyze` (fallow) | candidate | **exit 1 — could not run**: `coverage: failed to read coverage file … coverage/coverage-final.json` | fallow needs a coverage run, which this box forbids. Recorded as unrun rather than as passing |
| Load discipline | shared box | `Get-Process node` checked before each run; runs at 8-13 processes produced five `Test timed out in 5000ms` failures in files this branch does not touch (`entityRef.test.ts`, `strings.test.ts`, `designerToolbar.test.ts`, `designerWriteChain.test.ts`, `designerCalibration.test.ts`, `assetEntryPaths.test.ts`) — every one passed on an isolated re-run | the brief's own warning, met exactly |

**`npm run check` was NOT run**, per the dispatch brief's explicit instruction on this machine. So
`eslint .`, the coverage floors and `fallow` are all unrun here — see below.

## The deliberately RED assertion, and the integration change request

### The red

`tests/presentation/designer/designerClearanceReview.test.ts` › *the four-side helper, which is the
one clearing site AD14 cannot reach* › **`clears the review flag when it regenerates the boundary,
once the integrator adds the line`**

```
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/presentation/designer/designerClearanceReview.test.ts:108:42
    107|   expect(writes).toHaveLength(1);
    108|   expect(writes[0].clearanceNeedsReview).toBe(false);
```

**This is correct and expected. The candidate is not broken.** `vue-tsc` is clean, both linters are
clean, and every other case in every file this branch touches passes.

### The request — exact file, exact change

**File:** `src/presentation/designer/inspector/DesignerClearanceHelper.vue`, in `generate()`.

Currently:

```ts
		return validateAssetShape({
			...design,
			clearance: { points: clearanceRectangle(current, turn, setbacks) },
			clearancePending: design.footprintPending,
		});
```

must become:

```ts
		return validateAssetShape({
			...design,
			clearance: { points: clearanceRectangle(current, turn, setbacks) },
			clearancePending: design.footprintPending,
			// A write whose SUBJECT is the clearance IS the review (AD14-R1): generating a fresh
			// boundary answers the notice that was standing over the old one.
			clearanceNeedsReview: false,
		});
```

**Why it is an ICR and not a judgement call:** that file is in no wave-5 row. Its docblock would
also benefit from one sentence recording the third field it now writes, but the one line above is
what turns the assertion green.

**Blast radius if it is never applied:** a stale NOTICE, not lost data. A user who answers the
review by generating a new four-side boundary gets the correct new boundary with the review notice
still drawn over it, and pressing **Mark clearance as reviewed** clears it. Every other clearing
site named by the grep is inside this card's lease and is driven green.

## Verification not performed

**This section is not blank and cannot be, because the environment is missing two things outright.**

- **`npm run test-build` and every manual case under `docs/tests/` — NOT RUN.** There is no Obsidian
  in this environment. So nothing here has been seen in a real vault: not the new inspector block's
  appearance, not its placement relative to the clearance helper, not the notice's reading length in
  a narrow leaf, and not what a real sidecar written at schema 4 looks like on disk in a real
  library folder.
- **`npm run harness`, `npm run harness-shot`, `asset-library-shots`, `concept-shots` — NOT RUN.**
  No pinned Chromium is available and `npx playwright install chromium` is forbidden on this
  machine (it has emptied `node_modules` here before). So there is **no capture of the new block in
  either colour scheme and none at a 460 px sidebar width** — and CLAUDE.md records that the
  captures have caught ten defects the whole of `npm run check` could not, every one a measurement
  no layout engine in this repository performs: spacing, wrapping, overflow, contrast, hit size.
  The notice string is the longest single sentence in the designer inspector, which makes wrapping
  the specific risk nobody has looked at.
- **`npm run check` — NOT RUN**, per the dispatch brief. Three of its four steps are therefore
  unrun on this branch and each hides a different class of defect:
  - **`eslint .`** — the layer bans, the write boundary, `I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN`.
    Only `oxlint` ran, which has no `no-restricted-syntax` at all. The new SFC was linted by the
    edit-loop hook (which runs ESLint for `.vue`), so the Vue ruleset did see it; the changed `.ts`
    files were seen by oxlint alone.
  - **`test:coverage`** — the 99/99/99/98 floors, and more importantly `coverage-final.json` read
    for the CHANGED FILES, which is the only instrument that can see a single uncovered arm. Every
    new branch introduced here has a case written for both arms deliberately (the `preserved`,
    `moved` and `|| …=== true` conditions in `scaleDesign`; the new `validatePlacement` arms; the
    `sameClearance` comparison; the component predicate) but **this is an argument, not a
    measurement**. Somebody must run it.
  - **`analyze` (fallow)** — dead exports, duplication, dependency hygiene. It was ATTEMPTED and
    could not run: it reads `coverage/coverage-final.json`, which only `test:coverage` writes, so it
    exits 1 on this box. Two things on this branch are the kind it reports: the newly exported `AssetGeometrySchemaV3` (exported for one
    test assertion, exactly as `AssetGeometrySchemaV1` already is) and `markClearanceReviewed`
    (exported from the domain, imported by the new SFC and by its test).
- **The full suite in ONE run — NOT RUN.** It was run in seven scoped passes to keep this shared box
  under load, and every directory under `tests/` that holds a spec was covered by one of them
  (`tests/contracts` holds shared modules and `tests/vault` holds fixture data; neither contains a
  test file). What no scoped pass can tell you is whether the suite is green *together*: the
  `--no-isolate` findings this repository already records are the reason that is a real distinction,
  even though every project here keeps its isolation.
- **Cross-platform** — Windows only. Nothing was run on Linux, and nothing on any Node version but
  this worktree's.
- **A real v3→v4 upgrade in a real vault** — not performed. The migration is exercised only through
  the schema's own preprocessing in `assetGeometry.test.ts` and through the in-memory sidecar. The
  one direction the ADR calls unsafe (a v3-only build meeting a v4 file) is checked against the v3
  schema object rather than against an actual older build.

## Data and integration implications

**Schema/migration change:** asset-geometry **v3 → v4**, additive. `clearanceNeedsReview` defaults
to `false` on read, so every v1, v2 and v3 document is a valid v4 one without being rewritten;
`raiseLegacyVersions` raises 1, 2 and 3. The store EMITS 4. **No asset-geometry migration table is
owed** — `2026-09-16-asset-designer-consolidate-design.md` §6's trigger (the first NON-additive
asset-geometry schema change) still has not fired. The evidence for the bump being required rather
than tidy is `assetGeometry.test.ts` › *is refused by a version-3-only schema, which would otherwise
strip the review flag on its next write*, which asserts both halves: the refusal, and that the field
really would have been stripped had the version matched.

**Relevant renderer/export/revision consumers:** none. `r1` row 4 measured that the consumers of
asset geometry are exactly the authoring canvas, the library mark (`ListAssetOutlines` →
`AssetMark.vue`, footprint only) and plan placement (`placedOutline` → `AssetLayer.vue` /
`AssetShapes.vue` / `elementFootprint.ts` / `transformBox.ts` / `select-tool.ts`). None of them
reads a clearance's flag and none needed a change — `tests/presentation/library` and
`tests/presentation/editor` are green unchanged.

**Undo/no-op/conflict/failure coverage:** undo needs no mechanism and none was built — the flag
rides on `AssetShape`, which the reversible design commands snapshot whole. The no-op half is the
one that needed work and got it: `sameClearance` compares the flag, so a re-trace at identical
coordinates dispatches rather than being declined. `markClearanceReviewed` is dispatched through the
leaf's one `editShape` write chain, so it takes the same sequencing, the same expected version and
the same refusal routing as every other designer write; a write-boundary refusal goes to
`notifyIfRefused` rather than to a paragraph in the panel, because this action has no input for a
user to correct.

**Identity/unit/quantity/calibration invariants:** no identity changed and no coordinate moved.
`CalibrateAsset` deliberately does not touch the flag — AD14-R1 refuses reusing `clearancePending`
partly *because* a calibration would clear a review, and `rescaled`'s `...shape` spread is what
makes that true without a line of its own; a case pins it. The preserved clearance keeps its
millimetres exactly, which is the whole point: the visible mismatch against the smaller object is
the notice, and the flag is only what makes it survive a reopen.

**Shared root/runtime/locales wiring still required:** none for this card — `DesignerInspector.vue`
was sub-let and the mount line is in. The locale pair was created empty by the integrator and is
filled; it is NOT a pair to delete. **The one wire outstanding is the ICR above.**

**Rollback/recovery considerations:** code rollback alone is insufficient once a v4 document has
been written, which is C09's standing rule and not new here. A v3 build refuses such a sidecar
rather than loading it and stripping the flag — that refusal is the recovery-relevant behaviour and
it is deliberate. A vault that must go back needs a restored backup or a hand edit dropping the
`clearanceNeedsReview` key and the `schemaVersion` to 3; no downgrade is claimed lossless.

## Reviewer and integrator acceptance

**Reviewer outcome and findings:** **APPROVE FOR INTEGRATION**, conditional on the one change
request, with six non-blocking accuracy findings. The reviewer also ran **49 spec files this
report's seven passes had missed** (597 passed, 1 skipped), discharging its own finding rather than
only filing it — the normalisation touches every validated shape, so a `toEqual` in an unrun
directory would have gone red.

**Integrated commit:** `7908969d3`, which merges the candidate AND applies the change request.

**Post-integration checks/evidence.**

- **The change request turned the deliberate red green.** `DesignerClearanceHelper`'s `generate()`
  now writes `clearanceNeedsReview: false`, because regenerating the boundary IS the review. The
  reviewer verified it independently as the last unreached clearing site, and its stated blast
  radius — a stale notice, never lost data — was confirmed by reading the call site.
- **The ruling's grep-rather-than-list instruction earned its keep**, which is worth recording for
  the next ruling written that way. The grep found **two clear sites the ruling's own examples
  omitted** — `SetAssetFootprint`'s inherited shape, and `sameClearance`, without which re-tracing a
  boundary at identical coordinates is declined as a no-op and the notice never clears — and **one
  example site that does not exist**. Coding from the ruling's list would have shipped a notice a
  user cannot dismiss.
- **Four accuracy findings fixed, each RE-MEASURED by the integrator rather than taken from the
  review.** All four confirmed: `shapeEdits.ts` claimed three clearance writes and called them the
  whole of what the grep prints, when the fourth arrived in the same change; `AssetShape.ts` carried
  61 sites across 41 files, measured before this card's own files existed, against 66 across 43 now;
  the German table cited `Überprüfen Sie` as a `de.ts` precedent when that string appears **exactly
  once** in `locales/` — inside the comment claiming it — where the form actually chosen has nine
  real hits; and ADR-0034 named two amended fixtures where three were.
- `tests/presentation/designer/` + `tests/domain/asset/` + the geometry DTO: 77 files / 1248 tests.
- **All six gates exit 0 on `4521f6acf`** (the wave-5 integration SHA carrying both cards): 1050
  test files, 11591 tests, 1 skipped, zero failures, at 99.22 / 98.04 / 99.26 / 99.67 against
  99/98/99/98; `analyze` clean, 0 dead exports of 2392, no leaks, no duplication, 0 complexity
  findings above threshold.

**Final status: integrated.** NOT verified — no Obsidian and no pinned Chromium. The reviewer named
the specific exposure and it is the sharpest one this wave leaves: the new block is a **second**
bordered `.rp-designer-clearance` section directly beneath the helper's, with no heading of its own,
carrying **the longest sentence in the designer inspector**. Nothing here can measure its wrapping,
spacing or contrast, and no `accessibility*.test.ts` reaches it either — it draws nothing unless the
flag is set, so every existing designer scan passes straight over it. A live-vault pass and a 460 px
capture should look at that block before beta.

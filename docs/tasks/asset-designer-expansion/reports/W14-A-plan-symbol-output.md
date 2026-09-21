# Task report — W14-A (AD15 rows T28 and T30, the plan-symbol output half)

Outcome: **both rows are regrades, not gaps.** T28's output half is STRUCTURAL and got no test,
deliberately. T30's was **already covered under another name** — `placedOpenGraphic.test.ts` — which
this card missed on its first pass and which the fix round corrected; what remains is one case kept
for two measured non-redundant assertions, plus a cross-reference in each of the two files.
Owner / worktree / branch: W14-A / `.worktrees/ad07` / `w14a-plan-symbol-output`
Base commit / candidate commit: `7069a3d8b` / the latest commit on this branch
Accepted contract revision: wave 14 base, `r1`, plus the fix round's header-comment-only lease
extension for `tests/presentation/editor/elements/placedOpenGraphic.test.ts`
Allowed scope and shared-file leases: EDIT `tests/presentation/editor/elements/assetShapeConfig.test.ts`;
CREATE any test file under `tests/`; EDIT any existing test file or harness fixture this change turns
red; **no `src/` change**; and the header of `placedOpenGraphic.test.ts`, comment only.
`AD15-validation-matrix.md` is not leased here and is untouched.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/editor/elements/assetShapeConfig.test.ts` | One solid open-graphic case, kept for the two assertions measured as non-redundant against the suite, with a docblock narrowed to what it drives and a pointer to the file that holds the wider claim | yes — the one file leased for edit |
| `tests/presentation/editor/elements/placedOpenGraphic.test.ts` | Header comment only: the matching pointer back | yes — fix-round lease extension |
| `docs/tasks/asset-designer-expansion/reports/W14-A-plan-symbol-output.md` | This report | yes — the card's own deliverable |

No `src/` path appears in the diff.

## T30 — the row is WRONG, and this card believed it

**`tests/presentation/editor/elements/placedOpenGraphic.test.ts` existed at the wave base**
(`git cat-file -e 7069a3d8b:…` succeeds; it arrived in `1940aad0e`, AD11) and its subject is
exactly the arm the row calls unasserted. Its first case, titled verbatim
`draws it unclosed and unfilled, whatever its line says`, asserts `closed: false` and an absent
`fill` on a SOLID open graphic **and** `closed: false, dash: [4, 3]` with an absent `fill` on a
DASHED one — the second of which this card's case does not reach at all. Its second case asserts
both endpoints surviving placement. `AD11-open-lines.md` in this same reports folder records it,
and its watched-red table already contains this card's first mutation.

**Where the row goes wrong is a change of unit mid-sentence.** *"`assetShapeConfig.test.ts` has no
OPEN-graphic case"* is a TRUE statement about a FILE. *"so the plan renderer's handling of an open
polyline is unasserted"* is a FALSE statement about a BEHAVIOUR. The file was the wrong unit, and
this card took the second clause on trust: it read the one file the lease named and never listed
the directory that file sits in, where the sibling is four entries away.

**Proposed grade for T30: `pass`, on the evidence that already existed** — `placedOpenGraphic.test.ts`
for the plan renderer, plus the three consumers the row already cites. Not `partial`. The row's
other clause, "there is no exporter" (`r1` row 4), is a statement about a subsystem that does not
exist and cannot make a covered row partial; if the matrix wants that tracked it belongs on an
exporter row, not on this one. The earlier version of this report called T30 "still partial, for
the other reason only", which conceded the wrong point — the finding is that **the row is wrong**,
not that it is half out of scope.

**What was kept, and why it is not a duplicate.** The case stays, with two assertions measured as
catching what nothing else in the directory catches — each watched red directory-wide, below:
`strokeWidth` on a detail (asserted nowhere else in `tests/`: `grep -rn "asset-detail" tests/ |
grep strokeWidth` prints exactly this card's line) and the ABSENT `dash` on a solid open graphic.
`listening: false` is in the case too and is NOT counted as a gain — the existing
`details use zoneStroke regardless of selection, and do not listen` already holds it for a closed
detail, and the field is unconditional in the config.

**A near-duplicate between two `*.test.ts` files is invisible to every gate this repository has,
permanently** (CLAUDE.md, the `analyze` bullet: fallow skips `*.test.ts` for duplicates), so the
two files now point at each other by hand. That is the only instrument available for it.

## T28 — why no test was written

**The row's output half cannot be expressed at `assetShapeConfig`, and a case pretending to
express it would certify the gap rather than close it.** This section is unchanged by the fix
round; the reviewer and coordinator both let it stand.

Traced end to end rather than assumed:

- `assetShapeConfig(element, shapeOf, state)` takes a `NamedSpatialElement`, a
  `ShapeLookup = (assetId: string) => AssetShape | null`, and
  `{ selected, hovered, tokens, zoom }`. Read in full: `SpatialElement` declares
  `id`, `kind`, `color`, `points`, `stair`, `assetId`, `labelOffset`, `width`, `loadBearing`,
  `offset`, `flipped` and `size` — no hidden, no locked. `ShapeLookup` answers an `AssetShape`.
- `AssetShape.details` is `AssetDetail[]`, and `DetailBase` declares `id`, `name`, `label?`,
  `line` and `pending`. `grep -n "hidden\|locked" src/domain/asset/AssetDetail.ts src/domain/asset/AssetShape.ts`
  prints ONE line, and it is the prose "dashed means overhead or hidden" in `AssetDetail`'s
  docblock — no field of either name exists anywhere on the path to the plan renderer.
- Hidden and locked live in `src/presentation/designer/parts/partView.ts`, as two
  `Ref<ReadonlySet<string>>` on a leaf-local `PartView`. Its own docblock states the property the
  row is asking about: "Transient, leaf-local and never written… This holds ids and nothing else —
  no shape, no command, no port". Every importer of that module is under
  `src/presentation/designer/`; the single hit outside it in a grep for the name is
  `src/domain/asset/detailEdits.ts`, which only *mentions* `PartView.locked` in a docblock and
  imports nothing from it.

So there is no input to `assetShapeConfig` that can be set to "hidden". A case added here could
only build a shape with a detail, call it "the hidden one" in its title, and assert that the detail
renders — which is behaviourally identical to the existing
`draws each detail: solid covers with the canvas colour, dashed is unfilled` case, and which would
stay GREEN on exactly the day hiding *did* reach output, because the fixture cannot express hiding
either way. That is CLAUDE.md's "a test asserting 'this placeholder region is empty for a stated
reason' stays green on exactly the day somebody forgets, so it certifies the gap", and the wave
instruction's "never a case that asserts the absence of a state the types cannot express".

**The LOCK half is also already complete, under another name.** `resolveParticipants` in
`src/domain/asset/detailEdits.ts` is the one place a lock reaches pure code, through its
`immovable` parameter, and its only effect there is to REFUSE the whole operation with
`locked-part`. A lock therefore cannot produce a *different* written shape — refusal is the only
outcome it has.

**Proposed grade for T28: `pass` — the row is true by construction and its evidence should say so.**
The evidence is the designer-side pair the row already cites, plus `partView.ts`'s "holds ids and
nothing else, never written", plus `resolveParticipants`'s refusal-only `immovable`.

An import-graph pin ("`src/presentation/editor/` must not reach `partView.ts`") was considered and
is deliberately not proposed: it would guard a regression nobody has and that the layer bans do not
forbid anyway (presentation may import presentation), while the regression that would actually
matter — moving `hidden` onto the PERSISTED `AssetDetail` — is a deliberate schema change arriving
with its own tests and its own migration.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| T30, the plan renderer's open polyline | already covered at the wave base | `placedOpenGraphic.test.ts` > `draws it unclosed and unfilled, whatever its line says` (both `line` values) and `keeps both of its endpoints, translated to where the placement sits`; `AD11-open-lines.md` | The matrix row's second clause is false and the integrator is fixing it |
| T30, two assertions that coverage lacked | added | `assetShapeConfig.test.ts` > `draws an open graphic unclosed and unfilled even though it is solid`; mutations 3 and 4 below redden it and nothing else in the directory | None |
| T28, the plan-symbol output half | structural, no test written | `SpatialElement`, `DetailBase` and `ShapeLookup` read in full; `partView.ts`'s docblock; `resolveParticipants`'s `immovable` refusal | None. A case here would certify the gap |

## Watched red — verbatim, and what each is evidence OF

**The first two mutations were originally run with a ONE-FILE lens and the inference drawn from
them was wrong.** The verbatim output is kept; what it is evidence of is corrected. Re-taken over
the whole directory (`npx vitest run tests/presentation/editor/elements`, 13 files, 69 tests),
mutations 1 and 2 each redden **two** tests in **two** files — this card's case *and*
`placedOpenGraphic.test.ts`'s first case. That second failure is finding 1 for free, and a
directory-wide lens on the first pass would have handed it over before any case was written. This
is CLAUDE.md's "measure a set with an instrument that can see all of it": the instrument was one
file wide and the set was not.

All four mutations are of `src/presentation/editor/elements/assetShapeConfig.ts` and were restored
after each run; `git status` reports no `src/` path afterwards.

**Mutation 1** — `closed: detail.closed` → `closed: true` in the `details` map.

Originally observed, one file:

```
 FAIL  |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts > assetShapeConfig > draws an open graphic unclosed and unfilled even though it is solid
AssertionError: expected { name: 'asset-detail', …(5) } to match object { name: 'asset-detail', …(5) }

- Expected
+ Received

@@ -1,7 +1,7 @@
  {
-   "closed": false,
+   "closed": true,
    "listening": false,
    "name": "asset-detail",
    "points": [
      900,
      900,

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

Re-taken, whole directory:

```
 ❯ |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts (10 tests | 1 failed) 22ms
     × draws an open graphic unclosed and unfilled even though it is solid 10ms
 ❯ |suite| tests/presentation/editor/elements/placedOpenGraphic.test.ts (2 tests | 1 failed) 13ms
     × draws it unclosed and unfilled, whatever its line says 11ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 ❯ tests/presentation/editor/elements/assetShapeConfig.test.ts:59:29
 ❯ tests/presentation/editor/elements/placedOpenGraphic.test.ts:47:29
 Test Files  2 failed | 11 passed (13)
      Tests  2 failed | 67 passed (69)
```

**Mutation 2** — `...(detail.line === 'solid' ? (detail.closed ? { fill } : {}) : { dash: … })`
→ `...(detail.line === 'solid' ? { fill } : { dash: … })`, i.e. a solid OPEN graphic gets filled.

Originally observed, one file:

```
 FAIL  |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts > assetShapeConfig > draws an open graphic unclosed and unfilled even though it is solid
AssertionError: expected { name: 'asset-detail', …(6) } to not have property "fill"

- Expected:
undefined

+ Received:
"bg"

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

Re-taken, whole directory:

```
 ❯ |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts (10 tests | 1 failed) 19ms
     × draws an open graphic unclosed and unfilled even though it is solid 7ms
 ❯ |suite| tests/presentation/editor/elements/placedOpenGraphic.test.ts (2 tests | 1 failed) 15ms
     × draws it unclosed and unfilled, whatever its line says 12ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 ❯ tests/presentation/editor/elements/assetShapeConfig.test.ts:60:33
 ❯ tests/presentation/editor/elements/placedOpenGraphic.test.ts:48:33
 Test Files  2 failed | 11 passed (13)
      Tests  2 failed | 67 passed (69)
```

**Mutation 3** — a solid OPEN graphic wrongly acquires a dash:
`(detail.closed ? { fill } : {})` → `(detail.closed ? { fill } : { dash: [4 / zoom, 3 / zoom] })`.
This is the first of the two kept assertions, and **only this card's case sees it**:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts > assetShapeConfig > draws an open graphic unclosed and unfilled even though it is solid
 ❯ tests/presentation/editor/elements/assetShapeConfig.test.ts:61:33
 Test Files  1 failed | 12 passed (13)
      Tests  1 failed | 68 passed (69)
```

**Mutation 4** — a detail is stroked at the footprint's weight: `strokeWidth: 1 / zoom` →
`strokeWidth: 2 / zoom` in the `details` map. The second kept assertion, and again **only this
card's case sees it**:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/editor/elements/assetShapeConfig.test.ts > assetShapeConfig > draws an open graphic unclosed and unfilled even though it is solid
 Test Files  1 failed | 12 passed (13)
      Tests  1 failed | 68 passed (69)
```

## The `detailPolyline` observation, and its correct attribution

An earlier version of this report offered as a novel finding that `pathPolyline` and
`polygonPolyline` are indistinguishable on a path's own data, so `detailPolyline`'s docblock
overstates what it prevents. **The observation is correct and it was not new.**
`tests/domain/spatial/assetPlacement.test.ts` has carried it since `f1cbe86ef`, in a docblock that
states the mechanism more precisely than the probe did — it names the condition ("The two agree by
construction for every straight closing edge, and an open path cannot bow one") rather than merely
observing the equality across six bulge configurations. The claim is withdrawn as a finding and
recorded here as a rediscovery, which is the honest status. No `src/` change was made for it.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/editor/elements` | working tree, after the fix round | pass | `Test Files 13 passed` / `Tests 69 passed` |
| Same, under mutations 1–4, `src/` mutated then restored each time | working tree | fail each time: 2 tests / 2 tests / 1 test / 1 test | verbatim above; `git status` after each restore reports no `src/` path |
| `git cat-file -e 7069a3d8b:tests/presentation/editor/elements/placedOpenGraphic.test.ts` | base | success | the sibling existed at the wave base; `git log` dates it to `1940aad0e` |
| `grep -rln "openGraphic" tests/` | working tree | **11** files | re-taken as a grep after the fix round; see below |
| `grep -rn "asset-detail" tests/ \| grep strokeWidth` | working tree | one line, this card's | `strokeWidth` on a detail is asserted nowhere else |
| `npx oxlint` on both changed test files | working tree | exit 0, no output | oxlint prints nothing when clean |
| `npx eslint` on both changed test files | working tree | exit 0 | — |
| `npx vue-tsc -noEmit` | working tree (first pass) | exit 0, no diagnostics | run once over the whole program; the fixture crosses a branded type, which vitest transpiles without checking. **Not re-run after the fix round**, which changed comments only |

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`** — explicitly not this
  card's to run; two sibling cards were executing concurrently on a 7.8 GB machine, and CLAUDE.md's
  own workflow rule puts the full gate in CI. Coverage in particular is CI's: this change adds
  assertions over existing `src/` branches and introduces no new arm, so it can only hold or raise
  the measured numbers — but that is an expectation, not a measurement.
- **`npm run harness`, `harness-shot`, `asset-library-shots`, `concept-shots`** — this change draws
  nothing; it asserts a Konva CONFIG object, and no pixel of the plan symbol changed.
- **`npm run test-build` and any vault walk** — no behaviour changed, so there is nothing for a host
  to show. How an open graphic looks in a real vault stays with the manual cases, unrun here.
- **The suite outside `tests/presentation/editor/elements/`** — the directory was run in full, which
  is the lens the fix round required and the one that reaches every file this change could redden.
  Beyond it, **the earlier version of this report claimed no such file exists on the strength of a
  two-item enumeration, which was a guess written as a fact.** Re-taken as the grep it should always
  have been: `grep -rln "openGraphic" tests/` prints **eleven** files —
  `tests/domain/asset/openGraphicEdits.test.ts`, `tests/helpers/assetShapes.ts`,
  `tests/helpers/arrangeShapes.ts`,
  `tests/infrastructure/obsidian/repositories/assetGeometrySidecarDetails.test.ts`,
  `tests/presentation/designer/selection/hitTest.test.ts`,
  `tests/presentation/designer/selection/marquee.test.ts`,
  `tests/presentation/designer/selection/partMeasure.test.ts`,
  `tests/presentation/designer/tools/designerSelectSnapping.test.ts`,
  `tests/presentation/designer/designerSelectionInspector.test.ts`, and the two in this directory.
  The conclusion survives the correction — no helper signature moved, so none of the other nine can
  have reddened — but the enumeration was not the grep, and the eleventh entry is the file this card
  should have found on day one.
- **`npm run analyze`'s duplication half** — not run, and it could not see this anyway: fallow skips
  `*.test.ts` files entirely for duplicates. That is precisely why the near-duplication between the
  two files in this directory is handled with a hand-written cross-reference in each header rather
  than left for a gate.

## Data and integration implications

Schema/migration change: none. No `src/` file was changed.
Relevant renderer/export/revision consumers: `assetShapeConfig` is the PLAN renderer's config
function, and `placedOpenGraphic.test.ts`'s own header already enumerates the consumer set `r1`
settled — the authoring canvas, the library mark (which reads `shape.footprint` alone, a
`CurvedPolygon` that can never be a path) and plan placement. There is no exporter.
Undo/no-op/conflict/failure coverage: not applicable — no command, no write.
Identity/unit/quantity/calibration invariants: T28's quantity half rests on the same structural
argument as its output half — designer view state holds ids in a leaf-local `Ref`, reaches no port
and is never written, so no quantity input can see it.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: reverting this branch removes one test case, two header
cross-references and this report. **It does not leave the open-graphic arm unasserted** — the
earlier version of this line said "previously unasserted" and that word is withdrawn;
`placedOpenGraphic.test.ts` held the arm before this card existed and holds it after.

## Reviewer and integrator acceptance

Reviewer outcome and findings: fix round raised four corrections — T30 already covered under
another name, a one-file lens on mutations 1 and 2, an enumeration standing in for a grep, and an
over-wide docblock. All four are accepted and addressed above; the T28 half was left standing.
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

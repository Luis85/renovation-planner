# Task report — W14-A (AD15 rows T28 and T30, the plan-symbol output half)

Outcome: partially implemented — **T30's gap is closed with one case; T28's remaining half is
STRUCTURAL and no test was written for it, deliberately.**
Owner / worktree / branch: W14-A / `.worktrees/ad07` / `w14a-plan-symbol-output`
Base commit / candidate commit: `7069a3d8b` / the single commit on this branch
Accepted contract revision: wave 14 base, `r1`
Allowed scope and shared-file leases: EDIT `tests/presentation/editor/elements/assetShapeConfig.test.ts`;
CREATE any test file under `tests/`; EDIT any existing test file or harness fixture this change turns
red; **no `src/` change**. `AD15-validation-matrix.md` is not leased here and is untouched.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/editor/elements/assetShapeConfig.test.ts` | Adds the OPEN-graphic case the T30 row names as missing, and imports `openGraphic` from `tests/helpers/assetShapes.ts` rather than hand-writing one (a `CurvedPath` is branded, so a literal cannot be one) | yes — the one file leased for edit |
| `docs/tasks/asset-designer-expansion/reports/W14-A-plan-symbol-output.md` | This report | yes — the card's own deliverable |

No other file changed. `git status` after the work reports exactly those two paths.

## T28 — why no test was written

**The row's output half cannot be expressed at `assetShapeConfig`, and a case pretending to
express it would certify the gap rather than close it.**

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
outcome it has — so "locks do not change output" is a property of that signature rather than
anything the plan renderer could be asked about.

**Proposed regrade for T28: not `partial` — the row is true by construction and its evidence
should say so.** The evidence is the designer-side pair the row already cites, plus `partView.ts`'s
"holds ids and nothing else, never written", plus `resolveParticipants`'s refusal-only `immovable`.
Nothing is missing; the plan renderer is not *told* about designer view state, and there is no
honest instrument at `assetShapeConfig` that could say so.

An import-graph pin ("`src/presentation/editor/` must not reach `partView.ts`") was considered and
is deliberately not proposed: it would guard a regression nobody has and that the layer bans do not
forbid anyway (presentation may import presentation), while the regression that would actually
matter — moving `hidden` onto the PERSISTED `AssetDetail` — is a deliberate schema change arriving
with its own tests and its own migration.

## T30 — the case added

One case, `draws an open graphic unclosed and unfilled even though it is solid`, asserting the plan
renderer's open arm: `closed: false`, no `fill` although `line` is `solid` (AD05/C10 — a solid open
path is a stroke and has no interior), no `dash`, plus `stroke`, `strokeWidth`, `listening` and the
placed points. The fixture is `openGraphic` from `tests/helpers/assetShapes.ts`, which mints the
`CurvedPath` brand through `createCurvedPath`; a hand-written literal could not be an `OpenDetail`.

**Proposed regrade for T30: still `partial`, and for the row's OTHER reason only.** The
`assetShapeConfig` gap the row names is closed. The row's remaining words — "there is no exporter"
(`r1` row 4) — are out of this card's scope and were not built, per the brief.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| T30, the `assetShapeConfig` open-graphic gap | closed | `assetShapeConfig.test.ts` > `draws an open graphic unclosed and unfilled even though it is solid`; watched red under two independent mutations, verbatim below | The row's exporter half is untouched and out of scope |
| T28, the plan-symbol output half | structural, no test written | `SpatialElement`, `DetailBase` and `ShapeLookup` read in full; `partView.ts`'s docblock; `resolveParticipants`'s `immovable` refusal | None. A case here would certify the gap |

## Watched red — verbatim

**Mutation 1** — `src/presentation/editor/elements/assetShapeConfig.ts`, `closed: detail.closed` →
`closed: true` in the `details` map (restored afterwards):

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

**Mutation 2** — same file, `...(detail.line === 'solid' ? (detail.closed ? { fill } : {}) : { dash: … })`
→ `...(detail.line === 'solid' ? { fill } : { dash: … })`, i.e. a solid OPEN graphic gets filled
(restored afterwards):

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

Both mutations reddened **only** the new case — `1 failed | 9 passed` each time — which is the
measurement that the file held no other assertion over either arm before this change.

## A measured finding the integrator should have, and the docblock it contradicts

**A third mutation did NOT turn the case red, and the reason is worth recording.** Replacing
`detailPolyline(detail, …)` with `polygonPolyline(detail.outline as CurvedPolygon, …)` inside
`placedOutline` — flattening an open path as if it were a ring — left all ten tests passing.

That is not a hole in the new case; the two functions are **indistinguishable on a path's own
data**. Measured with a throwaway probe (deleted; it is not in the diff) comparing `pathPolyline`
and `polygonPolyline` over one 3-point run at six bulge configurations:

```
undefined path=3 ring=3 equal=true | [0,0] path=3 ring=3 equal=true | [1,0] path=10 ring=10 equal=true |
[0,1] path=10 ring=10 equal=true | [0.4,0.7] path=13 ring=13 equal=true | [1,1] path=17 ring=17 equal=true
```

The mechanism: `polygonPolyline` drops each segment's last point, but it also emits a WRAP segment
whose bulge a path's array never supplies (a path carries `n-1` bulges, so index `n-1` reads
`undefined`, hence `0`), and that straight wrap contributes exactly its own start — the path's
final vertex — back.

**`detailPolyline`'s docblock in `src/domain/asset/AssetDetail.ts` therefore overstates its case**:
"using it on a path loses the path's final vertex" is false for every path this codebase can build.
What actually stops a renderer treating a path as a ring is the `CurvedPath` brand, exactly as
`CurvedPath.ts` itself says ("The brand is the whole safety property of this type"), and the brand
is already pinned by `tests/core/geometry/geometryBrands.test-d.ts`. **No `src/` change was made** —
that is outside this lease — and no test was written against the overstatement, because the
sentence is prose about a mechanism rather than a guarantee anything depends on. It is handed to
the integrator as a finding.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/editor/elements/assetShapeConfig.test.ts` | working tree, this branch | pass | `Test Files 1 passed (1)` / `Tests 10 passed (10)` |
| Same, under mutation 1 and under mutation 2 | working tree, `src/` mutated then restored | fail, once each | verbatim above; `git status` after restore reports no `src/` path |
| `npx oxlint tests/presentation/editor/elements/assetShapeConfig.test.ts` | working tree | exit 0, no output | oxlint prints nothing when clean |
| `npx eslint tests/presentation/editor/elements/assetShapeConfig.test.ts` | working tree | exit 0 | — |
| `npx vue-tsc -noEmit` | working tree | exit 0, no diagnostics | run once over the whole program; the new fixture crosses a branded type, which vitest transpiles without checking |

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`** — explicitly not this
  card's to run; two sibling cards were executing concurrently on a 7.8 GB machine, and CLAUDE.md's
  own workflow rule puts the full gate in CI. Coverage in particular is CI's: this change adds
  assertions over an existing `src/` branch and introduces no new arm, so it can only hold or raise
  the measured numbers — but that is an expectation, not a measurement.
- **`npm run harness`, `harness-shot`, `asset-library-shots`, `concept-shots`** — this change draws
  nothing; it asserts a Konva CONFIG object, and no pixel of the plan symbol changed.
- **`npm run test-build` and any vault walk** — no behaviour changed, so there is nothing for a host
  to show. How an open graphic looks in a real vault stays with the manual cases, unrun here.
- **The rest of the suite** — only the one leased file was run, narrowly, by instruction. A sibling
  file this change could turn red does not exist: nothing imports this test, and `openGraphic` was
  already exported and already consumed by `tests/helpers/arrangeShapes.ts` and by
  `tests/helpers/assetShapes.ts` itself, so no helper signature moved.
- **`npm run analyze`'s duplication half** — not run, and it could not see this anyway: fallow skips
  `*.test.ts` files entirely for duplicates (CLAUDE.md, the `analyze` bullet).

## Data and integration implications

Schema/migration change: none. No `src/` file was changed; the code diff is one test file.
Relevant renderer/export/revision consumers: `assetShapeConfig` is the PLAN renderer's config
function. The designer canvas (`detailsLayer.ts`), the library mark (`assetMark`) and
`ListAssetOutlines` are the other consumers of the same geometry, and each already carries its own
open-graphic case, per the T30 row's own evidence column. There is no exporter — measured by `r1`
row 4, and deliberately not built here.
Undo/no-op/conflict/failure coverage: not applicable — no command, no write.
Identity/unit/quantity/calibration invariants: T28's quantity half rests on the same structural
argument as its output half — designer view state holds ids in a leaf-local `Ref`, reaches no port
and is never written, so no quantity input can see it.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: reverting this branch removes one test case and restores the
previously unasserted open-graphic arm of the plan renderer.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

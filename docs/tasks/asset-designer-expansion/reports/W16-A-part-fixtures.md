# Task report — W16-A (matrix row F12, the 25/250/1000 part fixture family)

Outcome: partially implemented — **F12 splits, and only its FIXTURE half is closed here.** The
measurement half is untouched and is argued below rather than deferred silently.
Owner / worktree / branch: W16-A / `.worktrees/ad11` / `w16a-part-fixtures`
Base commit / candidate commit: `1157ed28daaa37772842bf071d556be1829b1f06` / see the hand-off line
Accepted contract revision: wave 16 base, `r1`
Allowed scope and shared-file leases: MODIFY `tests/helpers/assetShapes.ts`; CREATE
`tests/domain/asset/partFixtures.test.ts` and this report. **No new helper file was created** —
the optional one-file allowance went unused, because `assetShapes.ts` came to **164 lines**
(`wc -l`, raw, comments and blanks included) against the **450** that `eslint.config.mjs`'s
`tests/`-facing block sets for `max-lines`, which skips blank lines and comments on top of that.
The cap was never in question, and `npx eslint` on the file exits 0. Nothing under `src/`, no
locale table, no styles partial, no matrix row and no `state.json` was touched.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/helpers/assetShapes.ts` | Adds `shapeWithParts(parts)` and its private `partAt`, `CELL` and `PART`, following the file's existing convention (compose a literal, put it through the real `validateAssetShape`, `expectOk` the result) | yes — MODIFY |
| `tests/domain/asset/partFixtures.test.ts` | The consumer that makes those fixtures legal in this tree, and the check under every count the new docblock states | yes — CREATE |
| `docs/tasks/asset-designer-expansion/reports/W16-A-part-fixtures.md` | This report | yes — CREATE |

## What the row asked for, read at source

`ACCEPTANCE-AND-QA.md` §1 F12: *"25, 250 and 1000 graphic parts with documented vertex counts"*,
existing for *"typical/stress performance and graceful degradation"*. §6's table names two of the
three sizes by job — a **250-part fixture** behind *selection response p95 ≤ 100 ms* and *drag
frame time p95 ≤ 33 ms*, and a **1000-part fixture with documented path/vertex complexity** behind
*stress behaviour*. §6's preamble constrains what may be concluded: *"Do not generalize benchmark
results to arbitrary hardware or unlimited drawing size."*

The matrix row paraphrases this as *"No performance fixture exists at any size"*, which was
confirmed before anything was written rather than taken on trust — `grep -rln "1000 parts\|250-part\|250
parts\|partCount\|manyDetails\|largeShape\|stressShape" tests/ src/` returned **nothing**, and the
existing files in `tests/domain/asset/` were listed and read for an equivalent under another name.
There was none. Counted after this card's own change rather than before it, which is the direction
that catches a stale number: `find tests/domain/asset -name "*.test.ts" | wc -l` prints **16**
against **15** at the base commit, and `ls tests/domain/asset/*.test.ts | wc -l` prints **14**
against 13 — the two differ by the two files under `presets/`, which `ls` does not recurse into.

## The fixture, and why it is shaped this way

`shapeWithParts(parts)` lays `parts` graphics on a square-ish grid of 100 mm cells, each part 60 mm
across, with the footprint sized to the grid. Three part kinds **cycle**, so every size carries all
three and the vertex total is arithmetic rather than a measurement:

| kind | points | curved edges |
|---|---|---|
| closed square (`rect`) | 4 | 0 |
| closed circle (`circle`) | 4 | 4 |
| open two-segment polyline (`openGraphic`) | 3 | 0 |

| parts | squares | circles | open paths | vertices | curved edges |
|---|---|---|---|---|---|
| 25 | 9 | 8 | 8 | 92 | 32 |
| 250 | 84 | 83 | 83 | 917 | 332 |
| 1000 | 334 | 333 | 333 | 3667 | 1332 |

A stress fixture of nothing but rectangles would understate what §6 asks about — `validateCurvedBoundary`
and `arcRadius` only do work on an edge whose bulge is non-zero — and one of nothing but circles would
overstate it. The three-kind cycle is the reason `curved edges` is reported as its own column: that
column, not the vertex total, is the "path complexity" §6 names for the 1000-part row.

It reuses `rect`, `circle` and the file's own `openGraphic` rather than introducing geometry; no new
constructor, no new concept, and no dependency.

### What this family measures, and what it does NOT

Recorded here rather than tuned, because the realism nobody can validate is realism nobody should
pay for while the measurement half does not exist.

**It measures**: part-count scaling across 25 / 250 / 1000, and genuine curved-edge cost — 1332
curved edges at the top size is real arc work through `validateBulgeEdge`, `arcRadius` and
`validateCurvedBoundary`, not a degenerate straight-line best case.

**It does not measure**: overlap or occlusion between parts (the grid deliberately separates them,
so a draw-order or z-fighting cost is absent); per-part **path depth** (four vertices against the
dozens a traced outline carries, so this scales the NUMBER of parts and not the complexity of one);
groups; a clearance; or pending coordinates. Each of those last three is another suite's subject,
and a benchmark carrying them could not say which of them it was timing.

A figure taken against this family is therefore a statement about part count and arc volume, and
about nothing else — which is the narrower form of §6's own *"do not generalize benchmark results
to arbitrary hardware or unlimited drawing size."*

One narrower claim in the same direction: the containment case measures every part's **vertices**,
not its arc envelope, and both its name and its docblock now say so. A bulged edge bows outside the
chord between its endpoints, so a curved graphic can in principle reach past a box its points sit
inside; that costs nothing here only because the one curved kind is `circle`, whose four points are
cardinal and reach exactly the radius its arcs do — and the clearance is 20 mm either way regardless.

## The 1000-part case was checked FIRST, as the card directed

Nothing in the domain refuses a shape that large. `validateDetails` iterates without a count cap and
`validateAssetShape` asks no question about `details.length`. **No zod `.max()` in `src/` applies to
an array LENGTH at all** — the ones that exist bound scalars (`planGeometry.ts`'s group `name` is
`z.string().trim().min(1).max(100)`, and `treads` carries a `.max(200)`), and `memberIds`, the one
array nearby, has a `.min(1)` and no maximum. (An earlier draft of this report called the `name`
bound "array-ish" and named it as the only one; both were wrong, and the substance — no length cap
anywhere on the path a 1000-part shape takes — is unchanged.) The 1000-part shape
validates, and re-validates, in well under the case budget — the whole 12-case file runs in **97 ms**
of test time. **There is no finding to report here**: the domain accepts the size the row asks for,
so the family did not have to be narrowed.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| F12 — family exists at 25, 250 and 1000 | closed | `shapeWithParts` + `builds $parts parts at the documented complexity` (3 cases) | none |
| F12 — vertex counts DOCUMENTED | closed | the table above, repeated in `shapeWithParts`'s docblock | none |
| F12 — vertex counts ASSERTED | closed | `vertexCount` / `curvedEdgeCount` / `kindCounts` against the `SIZES` table | none |
| F12 — the domain accepts each size | closed | `is accepted by the real validateAssetShape at $parts parts` (3 cases) | none |
| §6 — selection response p95 ≤ 100 ms | **not closed** | nothing asserted | needs a host and a benchmark harness |
| §6 — drag frame time p95 ≤ 33 ms | **not closed** | nothing asserted | as above |
| §6 — stress behaviour (no crash, no unbounded write burst, no irreversible UI lock) | **not closed** | nothing asserted | as above; two of its three terms are about a renderer and a writer, neither of which this fixture touches |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/domain/asset/partFixtures.test.ts` | candidate, Windows, Node from the worktree | pass | `Test Files 1 passed (1)`, `Tests 12 passed (12)`, `Duration 718ms … tests 97ms` |
| `npx oxlint tests/helpers/assetShapes.ts tests/domain/asset/partFixtures.test.ts` | candidate | exit 0 | no output; the exit code was read, since a clean oxlint run prints nothing |
| `npx eslint tests/helpers/assetShapes.ts tests/domain/asset/partFixtures.test.ts` | candidate | exit 0 | no output |
| `npx vue-tsc -noEmit` | candidate | exit 0 | whole-tree type check, run because `tsconfig.json` includes `tests/**` and neither vitest nor the two linters would have seen a type error in a test file |

### Watched failing — three mutations, each restored

**1. The instrument was proven before it was believed.** `vertexCount`'s reducer was changed from
`total + detail.outline.points.length` to `total + 1`, so it counted GRAPHICS instead of vertices:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/domain/asset/partFixtures.test.ts > the counting instruments > counts editableShape by hand: two graphics, eight vertices, four curved edges
AssertionError: expected 2 to be 8 // Object.is equality

- Expected
+ Received

- 8
+ 2

 ❯ tests/domain/asset/partFixtures.test.ts:54:30
     52|   const shape = editableShape();
     53|   expect(shape.details).toHaveLength(2);
     54|   expect(vertexCount(shape)).toBe(8);
       |                              ^
```

The two instrument cases are driven against `editableShape()` and `shapeWithOpenGraphic()`, whose
answers are countable by hand (one rectangle + one circle = 8 points, 4 curved edges; plus
`OPEN_POINTS`' three-point polyline = 11 points, still 4 curved edges) — because a counter that
reaches nothing reports the same zero a correct tree would.

**2. The documented complexity.** `partAt`'s circle arm was replaced with a second square arm, which
leaves the VERTEX total unchanged (4 either way) and is caught by the kind and curved-edge columns:

```
 FAIL  |suite| tests/domain/asset/partFixtures.test.ts > shapeWithParts — F12 at its three sizes > builds 25 parts at the documented complexity
AssertionError: expected { squares: 17, circles: +0, …(1) } to deeply equal { Object (squares, circles, ...) }

- Expected
+ Received

  {
-   "circles": 8,
+   "circles": 0,
    "openPaths": 8,
-   "squares": 9,
+   "squares": 17,
  }

 ❯ tests/domain/asset/partFixtures.test.ts:85:29
```

**3. The invariant stated in the new docblock.** The docblock claims the parts sit INSIDE the object
rather than piled on the origin. Nothing in the domain enforces that — no rule relates a graphic to
the footprint — so it is exactly the kind of comment that gets a case. `footprint: rect(columns *
CELL, rows * CELL)` was changed to `rect(CELL, CELL)`:

```
 FAIL  |suite| tests/domain/asset/partFixtures.test.ts > shapeWithParts — F12 at its three sizes > lays every part's vertices inside the footprint at 25 parts
AssertionError: expected [ 'part-1', 'part-2', 'part-3', …(21) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "part-1",
+   "part-2",
```

All three were restored and the file re-run green (`Tests 12 passed (12)`) before anything was
committed.

### Two further measurements, taken in the fix round

Both were run to check a claim this report's own prose was making, and both changed the prose rather
than the code.

**4. The `?? []` fallback in `curvedEdgeCount` IS load-bearing.** Removing it and reading
`detail.outline.bulges.filter(...)` directly:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
TypeError: Cannot read properties of undefined (reading 'filter')
```

**5. The `!== 0` filter beside it is NOT.** Reducing the counter to `(detail.outline.bulges ?? []).length`
leaves every case green:

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

That is a complete proof that the squares and the open polylines carry no `bulges` array at all
rather than an array of zeros — an array of zeros would have non-zero length, and the circles alone
account for the whole 1332 (333 × 4). The docblock claimed both parts were load-bearing; it now
claims it of the fallback only, names `stadium` (`[0, 1, 0, 1]`) and `roundFront` (`[0, 0, 1, 0]`)
as the mixed arrays the filter really guards, and records that no fixture here carries one. **No
`stadium` case was added**: it would buy a property this card does not need.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run**, by the card's instruction: three cards share this machine, and two full gates at once
  produce a wrong red (a destroyed `coverage/.tmp/coverage-N.json`, `tests/build/` ESLint boots over
  budget) rather than a slow one. These are the integrator's.
- **`npm run analyze` specifically.** This change adds exactly one export, `shapeWithParts`, and the
  file it is imported by exists in the same commit — which is what the fallow dead-export check is
  about, and why the test file is not optional decoration. That reasoning is not a run of the gate,
  and the integrator should confirm the count is still 0 dead exports.
- **The coverage floors.** Not measured. The new helper's branches are all driven by the new test
  (three arms of `partAt`, each hit at every size), but counting in units rather than percentage
  points is the integrator's job with `coverage-final.json`.
- **No browser, host, migration or capture check.** Nothing here draws, persists, migrates or
  renders; `npm run harness`, `npm run harness-shot` and `npm run test-build` have no subject in
  this diff. No sidecar schema is touched, so no round trip was exercised.
- **THE MEASUREMENT HALF OF F12 IS ENTIRELY UNPERFORMED, AND DELIBERATELY SO.** §6's four
  fixture-backed metrics — selection response p95, drag frame time p95, warm asset opening and
  stress behaviour — are not measured anywhere in this diff, and no timing assertion was added.
  Three reasons, in the order that decides:
  1. This repository has **no benchmark harness**. `npm run perf` is on CLAUDE.md's "Deliberately
     absent" list and its trigger is *a render cost somebody can argue about*; building one is an
     increment with its own argument, not a line in a fixture card.
  2. §6's measurement conditions are **"warmed renderer, recorded hardware and leaf width"**.
     None of those exists under vitest in jsdom: jsdom has no rendering engine, `@napi-rs/canvas`
     stands in for rasterisation only, and the hardware is a shared 7.8 GB box running three agents.
  3. A p95 assertion on that hardware would be a flake wearing a gate's clothes, and §6's own
     preamble forbids generalising a result from it anyway.

  **What the integrator can regrade F12 to is therefore "partial", not "adequate"**: the fixture
  exists at all three sizes with its complexity documented and asserted, and every §6 row that
  rests on it remains **not-run**.

### The exact matrix edits this card owes

`AD15-validation-matrix.md` is outside this card's lease and was not touched. **Three rows state a
reason this card falsifies**, and the replacement text for each is given here so the integrator
applies it rather than re-deriving it. An earlier draft of this report named only the first of the
§6 rows and described the correction to it wrongly; both are fixed below.

**Row `F12 25/250/1000 parts` (line 63)** — grade `none` → `partial`:

```
| F12 25/250/1000 parts | **partial** | The fixture family exists at all three sizes since W16-A — `shapeWithParts` in `tests/helpers/assetShapes.ts`, driven by `tests/domain/asset/partFixtures.test.ts`, with part, vertex and curved-edge counts documented and asserted, and every size accepted by the real `validateAssetShape`. **The measurement half is untouched**: §6's targets need a benchmark harness and a host, neither of which exists here |
```

**Line 194, selection response** — the clause that dies is *"which does not exist"*. **The clause
that stays load-bearing is the THIRD, "and a warmed renderer in a host"**, which is the whole reason
this row is still `not-run`:

```
| Selection response p95 ≤ 100 ms | **not-run** | F12's 250-part fixture exists since W16-A; still needs a warmed renderer in a host, which nothing in this repository can provide |
```

**Line 197, stress at 1000 parts** — its entire stated reason, *"No fixture at any size"*, is now
false:

```
| Stress at 1000 parts | **not-run** | F12's 1000-part fixture exists since W16-A, at 3667 vertices and 1332 curved edges; still needs a host to observe crash, write-burst and UI-lock behaviour in |
```

**Line 195, drag frame time, needs NO edit** — checked rather than assumed. It reads `Same, plus a
real compositor. jsdom draws nothing`, and its `Same` refers to line 194's reason; once 194 is
corrected, 195 inherits the correction and stays accurate as written.

## Data and integration implications

Schema/migration change: none. Nothing under `src/` was touched and no persisted format is involved.
Relevant renderer/export/revision consumers: none yet — the fixture has one consumer, its own test.
It is written to be the input a designer-canvas or selection-store benchmark would take when one
exists, which is why `shapeWithParts` takes the count as a parameter rather than exporting three
constants.
Undo/no-op/conflict/failure coverage: not applicable; no command, no reversible write, no dispatch.
Identity/unit/quantity/calibration invariants: every part id is distinct (asserted at 1000), every
coordinate is in millimetres like the rest of the domain, and the fixture carries **no clearance, no
group and no pending flag** — each of those is another suite's subject, and a benchmark carrying
them could not say which it was timing.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: the diff is two test-tree files; reverting the commit removes both
and leaves F12 graded exactly as the matrix grades it today.

## Collision notes for the integrator

W16-C's lease permits it to modify an existing harness fixture under `tests/helpers/` if it cannot
drive a theme flip otherwise. **This card's change to `tests/helpers/assetShapes.ts` is purely
additive** — one exported function, one private function and two private constants appended after
`openGraphic`, with no existing export's body, signature or docblock altered — so a textual conflict
would be confined to the end of that file if W16-C happened to pick the same one.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.

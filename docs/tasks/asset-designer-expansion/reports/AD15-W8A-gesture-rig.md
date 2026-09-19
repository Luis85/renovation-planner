# Task report — AD15 / wave 8 card W8-A

Outcome: **implemented**
Owner / worktree / branch: worker agent · `.worktrees/ad07` (reused, carries `node_modules`) · `ad15-w8-gesture-rig`
Base commit / candidate commit: `07d961321` / `ef1ba2dff`, fix round `dded01474`
Accepted contract revision: `r1`
Allowed scope and shared-file leases: EDIT exactly `tests/helpers/designerRig.ts`,
`tests/presentation/designer/designerCanvasGestureOwnership.test.ts`,
`tests/presentation/designer/designerMarqueeCanvas.test.ts`. No other file, in `tests/` or `src/`.
Test-only; `src/` integrator-owned this wave.

**Two hand-off items merged into one card, and the merge is the lease's load-bearing decision.**
`RESUME.md` listed factoring the duplicated rig helpers and closing T25's two residual gaps as
separate items. They touch the same two files, so split across two workers they would have
collided on both plus `designerRig.ts`, and the second would have wanted helpers the first was
still moving. Wave 7's "exactly one new file per card" clause therefore does not hold here, and
the replacement disjointness guarantee is written into the lease table beside the grant that
needed it.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/helpers/designerRig.ts` | Receives the shared sweep vocabulary — `band`, `selecting`, `held`, `SHORT`, `FROM`, `TO`. `held` was WIDENED into the rig's existing private `pointer()` rather than added beside it | yes |
| `tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | Loses its copies; gains the two cases closing T25's gaps | yes |
| `tests/presentation/designer/designerMarqueeCanvas.test.ts` | Loses its copies; six `held(` call sites migrated from screen to world coordinates | yes |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| The clone between the two files is one definition | **met** | `comm -12` reported 32 identical non-trivial lines at base. `band`, `selecting`, `held` now have exactly one definition, in `tests/helpers/designerRig.ts` | A THIRD `held` clone survives out of lease — see below |
| That definition is one a gate can scan | **met** | `tests/helpers/` is read by fallow's duplication check; `*.test.ts` is not. The run prints `skipped N files matching default duplicates ignores`, N equalling `find tests -name "*.test.ts" \| wc -l` at both values measured | none |
| T25 gap 1 — the `keyDoors.ts` arm of `gestureInFlight()` is driven | **met** | New case drives a `+` keydown at `rig.canvasEl` and reads `editor.viewport.zoom`. Watched failing by deleting `surface.gestureInFlight() \|\|` from `keyDoors.ts`: `AssertionError: expected 0.12 to be 0.1`. **Only that case went red — the wheel case stayed green**, which is the evidence the two doors are separate instruments | none |
| T25 gap 2 — a release outside the leaf COMMITS | **met** | New `describe`. Watched failing by inserting an early return in `EditorSurface.onPointerUp` for an outside client point: `AssertionError: expected [] to deeply equal [ …(2) ]` | The case does not pin that the commit uses the RELEASE point rather than the last move's — both are `TO` |
| The card's `SHAPE` premise | **corrected** | The brief said five files. Five carry the spelling; one (`tools/designerSelectSnapping.test.ts`) is `editableShape({ details: [...] })`, a different shape. The clone is **four**. `SHAPE` was not exported at all — `selecting(shape = editableShape())` takes the factory call as its default — so the binding is gone from both leased files | The two files outside the lease keep a correct local binding; no follow-up owed |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run` over the two leased files | `dded01474`, worktree `ad07` | 0 — 2 files, 17 tests | worker |
| `npx vitest run tests/presentation/designer` + `tests/harness/accessibilityDesignerSelection.test.ts` | `ef1ba2dff` | 0 — **65 files, 891 tests**, no timeouts, no re-runs | worker. That harness file is the only dependent outside the designer directory of the twenty `grep -rln helpers/designerRig tests/` prints |
| `npx oxlint` / `npx eslint` over all three files | `dded01474` | 0, no output | worker and reviewer independently |
| `npx vue-tsc -noEmit` over the whole tree | `ef1ba2dff` | 0 | worker only — the reviewer was not cleared for it and says so |
| Independent review | `ef1ba2dff` | **APPROVE conditional on three prose corrections** | Reviewer re-measured `??` vs `\|\|` on a passed `0`, all six migrated `held(` sites, the SHAPE census, both `keyDoors.ts` sites, and the rig geometry (`at({1000,1000})=148`, `at({900,900})=138`, `at({-1000,-1000})=-52`) |
| Fix round, prose only | `dded01474` | three corrections applied, one reviewer finding itself corrected | below |
| `npx vitest run tests/presentation/designer` + `tests/build/buttonBoxNeutralised.test.ts` | integration merge `160fab6f5` | 0 — **65 files, 891 tests**, 102s | integrator |

### The three corrections, and the one that went the other way

1. **`designerRig.ts`'s vocabulary header said "used by every case whose subject is a sweep".** A
   grep falsifies it: `grep -rn "from '.*designerRig'" tests/presentation/designer/` prints
   nineteen files and three sweep-subject ones are absent.
2. **The new `describe` contradicted a sibling with nothing linking the two sides.**
   `tools/designerSelectMarquee.test.ts` still says, twice, that `EditorSurface` routes *"a release
   outside the leaf"* to `abandonGesture` — verbatim the sentence `dropMarquee`'s docblock was
   corrected for last session. That file is another lease, so the pointer goes in this one
   (ADR-0015's rule: a contradiction findable from only one side is resolved the wrong way).
3. **A header sentence a reader falsifies three lines down** — *"the one thing here that is NOT an
   interruption"*, when every interruption row is seeded by `drag(rig, FROM, TO)`, whose release
   also lands outside the pane and also commits.

**The worker corrected the reviewer on finding 1, with a grep.** The review said all three absent
files drive `SelectToolRig`; `selection/marquee.test.ts` drives neither rig — it calls the pure
`swept` function directly. The shipped sentence splits them two ways rather than one.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze`, `eslint .` over the tree** — not
  run by the worker or the reviewer, by the lease: they are the integrator's, run once on the
  integration SHA, on a shared 7.8 GB box where two gates at once produce a wrong red rather than
  a slow one. Their result is recorded against the integration SHA, not here.
- **The four mutation reds are the worker's own observations and the reviewer could not reproduce
  them**, because a reviewer may not edit files. The reviewer checked them for arithmetic
  consistency against the code instead (`0.12` = `KEY_ZOOM_STEP` applied once; `expected 138 to be
  less than 0` = the guard pointed at `SHORT`; `expected []` = `marquee.initial` on a fresh rig)
  and reports that as consistency, not as replication. Same for the factoring watch counts
  (`held`→8 red, `band`→5, `selecting`→13, `SHORT`→4).
- **Tests outside `tests/presentation/designer/` and that one harness file** — not run by the
  worker. The exposure of a `tests/helpers/` edit is its dependents, and all twenty ran.
- **`npm run build` / the stylesheet assembler** — not run; this card touches no stylesheet.
- **`npm run harness`, `harness-shot`, `test-build`** — not run. Nothing here draws differently,
  and there is no pinned Chromium on this machine in any case (`playwright-core` pins revision
  1234, the cache holds 1223).
- **Coverage effect not measured by the card.** The worker's expectation is that the keyboard case
  reaches `keyDoors.ts`'s `zoomShortcut` through a second surface while the outside-release case
  adds no new arm, so the floors should not move — explicitly not claimed, and settled only by the
  integrator's `test:coverage` run.

## Data and integration implications

Schema/migration change: **none**. Test-only card.
Relevant renderer/export/revision consumers: none.
Undo/no-op/conflict/failure coverage: the outside-leaf case asserts the COMMIT path; the three
interruption rows already covered the no-op path (`a cancelled sweep is no command and no history
entry`).
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: none — reverting the merge restores two self-contained test
files and a helper with three fewer exports.

## Found and not fixed

- **A third `held` clone survives out of lease**: `tests/presentation/designer/designerDrawDetails.test.ts`
  declares a local arrow `held = (type, at, buttons) => …` taking pre-converted SCREEN corners,
  the same dispatch shape as the two merged. The next lease touching that file should import the
  rig's `held` and pass world points.
- **`tools/designerSelectMarquee.test.ts` carries the refuted sentence twice** — in the docblock
  above its `it.each` and in that table's own label — and is now pointed at from this side while
  still standing on its own. Whoever holds that file should strike *"or a release outside the
  leaf"* from both. **Its cases need no change**: they call `tool.abandonGesture()` directly and
  assert what an abandonment leaves, which is true of the two inputs that really do reach it. Only
  the third item in each list names a door `EditorSurface` does not have.
- **Nothing in `src/` needs a change** and none was taken. Both gaps closed against the code as it
  stands.

## Reviewer and integrator acceptance

Reviewer outcome and findings: **APPROVE conditional**, three prose findings (two MUST, one
SHOULD), all applied in `dded01474`; one of them corrected by the worker in turn. The reviewer
verified lease compliance itself: `git diff --stat 07d961321..ef1ba2dff` names exactly the three
files, `-- src/` is empty, and the candidate worktree is clean.

Disjointness against the wave's other card, verified mechanically by the integrator before either
merge: `comm -12` over `git diff --name-only 07d961321..dded01474` and
`…..6d0bb73c1` is **empty**.

Integrated commit: `160fab6f5`.

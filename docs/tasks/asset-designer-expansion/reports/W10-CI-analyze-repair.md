# Task report — the red-CI analyze repair (session eight, integrator)

Outcome: **implemented**
Owner / worktree / branch: integrator / `renovation-planner-asset-designer-bc5539` / same
Base commit / candidate commit: `61462d58d` / **`c3527450b`**
Accepted contract revision: `r1`
Allowed scope and shared-file leases: integrator-owned; no card held any of these files.

## The hand-off's diagnosis did not survive measurement, and both halves were wrong

`reports/RESUME.md` led with two claims. Neither holds.

**Claim 1 — "none of the reported files was touched by this branch."** False for the health half.
The breach is `src/presentation/designer/inspector/DesignerInspector.vue`, which this branch edited
heavily: it is W9-A's own `Object | Reference` tabs. The file named on fallow's `Failed:` line,
`src/presentation/editor/renovation/renovationSummary.ts`, is genuinely untouched — but it is not a
breach at all. It is the top of **53 refactoring targets**, a quick-win ROI ranking that fails
nothing. The `Failed:` line appends that headline after the failing sections, and reading it as the
cause is the trap. It is the same trap twice over: session seven also guessed "fallow measures
complexity against coverage, so a coverage change elsewhere can move it", and that guess was
attached to the wrong file.

**Claim 2 — the duplication failure is the `ignoredClones` renumbering trap.** The duplication
never gated at all. `duplicates.threshold` defaults to **0**, which fallow's own schema documents as
*"max duplication percentage, 0 = no limit"*. The `✗` on that section is a glyph, not a gate.

That is demonstrated rather than reasoned. At the merge base `ed5c50b76`, which `main` is green on,
CI printed:

```
note: skipped 1022 files matching default duplicates ignores
● Duplicates (7 clone groups)
✗ 80 lines (0.1%) duplicated across 7 files
✗ 0 above threshold · 7697 analyzed · maintainability 86.7 (good)
```

Seven clone groups, the `✗`, and the run was **green**, with no `Failed:` line. The difference
between that green run and the red one is the single `above threshold` count, nothing else.

**The branch had in fact IMPROVED duplication, 7 groups → 4.** Reproduced locally at the base
(twice, deterministic) and diffed against HEAD: it removed three groups in
`scripts/editor-usability-combined-check.mjs` / `editor-usability-fidelity-check.mjs` and one in
`ObsidianPlanGeometrySidecar.ts` — all four files this branch genuinely edited — and added one in
the split designer CSS. 7 − 4 + 1 = 4, which is exactly what both CI and local print at HEAD.

**So W9-A's reviewer finding M4 was a false alarm**, and the wave-9 suppression it worried about is
not involved. The finding was still correct to raise; only an `analyze` run could settle it, and
none had been run. That remains the lesson — not the hypothesis it carried.

## The actual cause

One finding: the `<template>` of `DesignerInspector.vue` at **cognitive 17** against fallow's
`maxCognitive` of **15**. Every boolean operator inside a `v-if` counts, and AD18-R2's two tabpanels
pushed it over. Base read `✗ 0 above threshold`; HEAD read `✗ 1`.

## A local-vs-CI discrepancy that was itself a measurement artefact

The first local run reported **2** above threshold, against CI's 1 — the extra being
`AssetDesignerRoot.vue:265 editDimensions` at CRAP 71.3. That was **stale coverage**: fallow matched
7740/29667 functions locally against CI's 7762, so `editDimensions` fell back to the static estimate.
With fresh coverage it matches CI (7755 matched, finding gone). Recorded because a figure read off a
stale `coverage/coverage-final.json` looks exactly like a real regression.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/inspector/DesignerInspector.vue` | Two compound `v-if` conditions hoisted into named computeds; `setMultiSelectionMode?.()` at the call site | yes — integrator-owned, no card held it |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| `npm run analyze` exits 0 | pass | `✗ 0 above threshold`, no `Failed:` line, `● Duplicates (4 clone groups)` and `✗ 101 lines (0.1%) duplicated across 6 files` **unchanged from the failing run** | none |
| Multi-selection condition is behaviour-preserving | pass, watched failing | see below | none |
| Unscaled-dimensions condition is behaviour-preserving | pass, **NOT pinned by anything** | see below | recorded at the code |
| `npm run check` | pass | `CHECKEXIT=0`, `Test Files 1065 passed`, `Tests 11757 passed \| 1 skipped` | none |

**Watched failing, verbatim.** Removing `|| props.multiSelectionMode === true`:

```
× draws no control for a design with one graphic, until the mode is already on 39ms
FAIL  tests/presentation/designer/designerInspector.test.ts > a selection of several parts > draws no control for a design with one graphic, until the mode is already on
AssertionError: expected false to be true // Object.is equality
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 84 passed (85)
```

**The second condition was watched too and NOTHING went red** — 70 cases green across
`designerInspector`, `assetDimensions` and `designerReferencePanels` with the first term deleted.
That is not a missing test; the state is **unreachable**. `GetAssetDesign` sets `dimensions` from
the footprint exactly when `shape !== null`, and `dimensionsUnscaled` is
`shape?.footprintPending ?? false` — so a `true` second term already implies a non-null first. The
producing invariant is pinned where it is produced: `getAssetDesign.test.ts` asserts
`dimensionsUnscaled` is `false` on a design with no shape, and its own comment records that the
field *"IS `footprintPending`, with no second term"*.

The term is **kept rather than deleted**. Dropping an unreachable guard is a real way to recover
branch headroom and this repository says so, but it is a behaviour change and does not belong in a
commit whose subject is the gate. The finding is written at the code.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npm run analyze` | `61462d58d`, stale coverage | 1 — `Failed: dupes (4 clone groups), health (2 above threshold)` | `analyze-1.log` |
| `npx fallow` at merge base `ed5c50b76` | worktree `adq`, stub coverage | 7 clone groups, deterministic over two runs | `analyze-base.log`, `analyze-base-2.log` |
| `gh run view` on main's CI at `ed5c50b76` | GitHub | 7 clone groups + `✗ 80 lines` on a **green** run | run `35126250337` |
| `npm run analyze` | `c3527450b` working tree, fresh coverage | **0** | `analyze-2.log` |
| `npx vue-tsc -noEmit` | `c3527450b` | 0 | after the `?.` fix |
| `npm run check` | `c3527450b` | **0**, 1065 files / 11757 passed | `check-2.log` |

**One failure of my own, recorded because it nearly shipped as a false green.** The first
`npm run check` was wrapped as `npm run check > log 2>&1; echo "CHECKEXIT=$?" >> log`, whose exit
status is the `echo`'s. The task notification said "exit code 0" and I reported the gate green. It
was **not**: `CHECKEXIT=2`, on
`DesignerInspector.vue(470,15): error TS2722: Cannot invoke an object which is possibly 'undefined'`
— hoisting the condition out of the `v-if` removed `vue-tsc`'s narrowing of the optional prop inside
that element. Fixed with `setMultiSelectionMode?.(…)`, whose reason is now written at the code with
the error text that produced it. The re-run propagates the real exit code. *A tool's silence is not
a clean bill, and neither is a wrapper's.*

## Verification not performed

- **No browser or rendered check.** The change moves two conditions into computeds and adds an
  optional call; it alters no markup, no class and no rule, so there is nothing for a rendered
  capture to compare. Not run because there is nothing it could show, not because it was unavailable.
- **No `npm run test-build` / Obsidian session.** Same reason.
- **No `harness-shot` capture.** Same reason, and there is no pinned Chromium on this machine
  (`playwright-core` pins 1234, the cache holds 1223); captures would go through
  `RP_CHROMIUM_EXECUTABLE` with the not-the-pinned-build caveat attached.
- **The unreachable-guard claim is NOT proven by a test of its own.** It rests on reading
  `GetAssetDesign` plus the producer-side assertions in `getAssetDesign.test.ts`. A hand-built
  `AssetDesignDto` could still carry the impossible pair, which is exactly why the guard stays.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — no DTO, command or query changed.
Undo/no-op/conflict/failure coverage: unaffected.
Identity/unit/quantity/calibration invariants: unaffected.
Shared root/runtime/locales wiring still required: none for this commit.
Rollback/recovery considerations: a single-file revert restores the prior template and re-reds the
gate; nothing else depends on it.

## Findings recorded but NOT acted on

- `tests/presentation/designer/assetDimensions.test.ts` states *"`DesignerInspector` was the ONLY
  reader of `dimensionsUnscaled` in the tree."* `DesignerSelectionInspector.vue` reads it too
  (`designerSelectionInspector.test.ts` drives it at two sites). A stale "only" claim — the shape
  this repository names most often. Left for a card rather than patched mid-gate-fix.
- `.fallowrc.json`'s `duplicates.ignoredClones` block argues at length about key renumbering. The
  argument is sound, but nothing in it says that duplication **does not gate at all**, which is why
  two sessions in a row read a duplication `✗` as a build failure. That block is worth one sentence.

## Reviewer and integrator acceptance

Reviewer outcome and findings: **not independently reviewed.** This was the integrator's own repair
under the hand-off's explicit instruction that the CI fix is the integrator's. It is a one-file,
behaviour-preserving change whose claim is carried by a gate that now runs on it in CI.
Integrated commit: `c3527450b`, pushed.
Post-integration checks/evidence: `npm run check` exit 0 locally; CI on `c3527450b` running at the
time of writing across four `verify` legs.
Final status: **integrated**, pending the CI confirmation it was pushed to obtain.

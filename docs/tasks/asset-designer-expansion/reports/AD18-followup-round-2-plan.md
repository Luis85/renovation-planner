# AD18 second follow-up round — plan (session nineteen, 2026-09-25)

**Authority: ruling AD18-R24** in `contracts/DECISIONS.md`. The follow-up round (AD18-R23) recorded items rather
than fixing them. This session checked each one at source and found two of the hand-off's premises false. Four
items are defects fixed without a ruling, four are already fine and recorded as such, and three went to the user
in one batched round, which took every recommendation. Five code tasks below come from those items. The last
three are the manual-pass steps, the hand-off and the delivery record. If a task would contradict an earlier
ruling (AD18-R1…R24, AD14-R1, AD12-R1, AD11, AD08-R1, C01–C12, r1) or would need a stored field, STOP and report
NEEDS_CONTEXT rather than choosing.

**No two tasks own the same file.** Tasks may run in parallel only on disjoint files, and then each stages
**by explicit path only**.

## Global constraints (every task)

- Read `CLAUDE.md` at the worktree root before editing. It is long; the Testing, Claims and Gotchas
  sections bind every task.
- **Verify every instruction in your brief at the code before applying it.** Every brief in this
  package's history has carried at least one false premise, this one's author included; the last hand-off
  carried two. If the code disagrees with the brief, the code wins and your report says so.
- **File ownership is binding.** Each task names the files it OWNS. Edit only those, plus NEW files
  you create, plus your own new or existing test files for the code you own. Shared test helpers
  (`tests/helpers/**`, `tests/harness/**`) are READ-ONLY unless your task names them. If you need
  something from a file you do not own, stop and report NEEDS_CONTEXT naming the file and the edit.
- Layering and lint: no user-visible literal at the `I18N_LITERAL_BAN` call sites. Only Task 2 needs new
  copy, and its locale module pair is pre-created and registered (`src/presentation/i18n/locales/{en,de}/designerTypedLanding.ts`).
  `en.ts`/`de.ts` and both `editor.ts` files are owned by nobody. No inline styles. No hard-coded colour in
  `styles/`. No new dependency. No schema change and no new stored field.
- **400-line cap**, and an SFC's `<template>` comments COUNT against it (`max-lines` does not skip them).
  `AssetDesignerRoot.vue` is at 399 of 400 counted lines. `styles/designer.css` is at 400. `tests/**` caps
  at 450: split a suite into a sibling file rather than trimming it. `restingLabels.test.ts` is at 448.
  Check a file's count with `npx eslint <file> --max-warnings 0`, not with `wc -l`.
- Every `.vue` under `src/presentation/designer/` must stay reachable by import from
  `AssetDesignerView.ts`, and `npm run analyze` (fallow) fails on an unused export or file. **Fallow reads
  `tests/helpers/` and `tests/harness/` exports too**: a private type named in an exported signature there
  fails CI (`private-type-leaks`), and a new or grown function can fail `health` on cognitive complexity.
  Run `npx fallow health --complexity` and look for a `!` on the cognitive or cyclomatic column in the files
  you touched. Local CRAP is inflated by missing coverage; ignore that column locally.
- Coverage floors are 99/99/99/98 and TIGHT: every new branch gets a test. An unreachable guard is not free.
- A test for an invariant is watched failing: make a temporary in-place edit that reverts the fix, see red,
  restore it. **Never `git stash` in any form**: the stash stack is shared across sessions.
- **Ask of every test you add: does it test what SHIPS, and can it fail?** Reviews caught a test on a fixture
  no preset produces, a flag-parity input where the old and new code agree, and vacuous `?.` assertions. Say
  in the report how you saw each one fail.
- **A fix is measured against every caller, not the one that asked for it.** Last round the first solver fix
  broke a shrub's corner drag in 12 of 8,550 moves. Grep every caller of what you change, and sweep every
  preset, every selection and all eight handles, not the case in the ticket.
- **`only`, `cannot`, `never`, `exactly`, `NEAREST` and `opens in` in docblocks went false repeatedly**, and so
  did numbers in docblocks (a "19 × 19" grid that was 22 × 22, a "7.3 ms" from one machine). Grep your diff
  for them and check each against the code.
- **Removing or renaming an ARIA state, class or attribute? Grep `styles/` and `scripts/` for selectors keyed
  on it.** Dropping `aria-pressed` silently killed two shipped CSS rules, and `scripts/harness-shot.mjs` waits on
  selectors that `tests/gates/harness-shot.test.ts` compares only as text.
- **Obsidian's base stylesheet sets `button { height: var(--input-height); white-space: nowrap }`** and
  centres flex children (`align-items: center`).
- **Accessible names are load-bearing in tests** (`tests/helpers/accessibleName.ts`, `designerRig.ts`
  `toolbarButton`, `tests/harness/assetDesigner.ts` `pressTool`). Obsidian's tooltip reads `aria-label` only.
  If you change a name, grep `tests/` and `scripts/` for text lookups.
- Commands: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before any node command. The machine has 7.8 GB
  shared with other sessions, so re-run a named file alone before believing a timeout. Run narrow
  `npx vitest run <paths>` only. On EVERY touched file, UNPIPED (never through `tail`/`head`, which replaces
  the exit code): `npx eslint <files> --max-warnings 0`, `npx oxlint --deny-warnings <files>`, and once
  before reporting `npx vue-tsc --noEmit -p tsconfig.json`. Paste each exit code into the report.
  Do NOT run `npm run check`, `check:fast`, `test:coverage` or `analyze`: CI runs those.
- Do not touch `docs/tests/cases/`, `MANUAL-PASS.md`, `RESUME.md`, `DECISIONS.md` or `state.json` (Task 6 and the integrator own them).
  Do not push. Commit on the current branch with a message ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- You have no browser. Anything about LAYOUT or on-screen position is a prediction: write it as a number
  you could be wrong about. The integrator measures every UI task in Chromium afterwards.
- **Measure the selection the reviewer will probe, not the one you happened to pick**: the footprint, the
  clearance and each detail, at every preset, not just one.
- Use typographic-dash-safe edits. For a multi-line splice, write a script to a file and splice on a content
  anchor, never on a line number.

## Task 1: Core geometry stops refusing valid circles (AD18-R24 defect)

**Why:** `arcArc` in `src/core/geometry/circularIntersections.ts` reports a phantom intersection about 1.1e-7 mm
from the shared corner of two adjacent arcs lying on nearly the same circle — just past the 1e-7 mm
`curveTolerance` — because the radical line's `offset = -c / magnitude` carries that much rounding. So
`invalidEdgeContact` (`src/core/geometry/CurvedPolygon.ts`) refuses a four-arc circle whose axes differ by a few
parts per million. The session's read-only investigator measured (UNVERIFIED — reproduce before you rely on it):
`Set dimensions` W = D on the default tree preset refused ("not a shape this plugin can store",
`asset.invalid-footprint`) for 109 whole-millimetre sizes, e.g. 2987 × 2987; rotating a stored 4500 × 4500 tree
refused 769 times in 2,000; the inspector and a diagonal corner drag missing by up to 0.4 mm. Every `circle()`
outline reaches it (tree footprint and trunk, shrub, round-table footprint and clearance), and so do zones and
rooms. C04 says translation, rotation and positive uniform scaling preserve an arc.

**Owns:** `src/core/geometry/circularIntersections.ts`, its existing tests, `src/domain/asset/scaleSolve.ts`
(DOCBLOCK ONLY: the tree / M7 paragraph, around the words `1.4999944` / `1.50192`, becomes false once this
lands), and NEW test files you create.

Requirements:
- Root-cause fix in `arcArc`, not a wider tolerance. The investigator's candidate (a starting point, not a
  spec): when the two arcs already share a point (`endpoints.length > 0`), anchor the radical line at that shared
  point instead of at the noisy `nx*offset, ny*offset`, and skip the `reach` early exit in that case, so a
  genuine second crossing is still found. Show it removes the false refusals and keeps every true one.
- **Callers first.** `circularEdgeIntersections` reaches every `createCurvedPolygon` (asset footprint,
  clearance, details), `Zone.ts`, `encloseRoom.ts`, `PlanGeometryStore.ts` (a sidecar READ — a refusal there is
  a note that fails to load), `GroupGeometryCommand.ts`, `curveDraft.ts` and `structureGeometry.ts` (walls).
  Grep them yourself. For each, say in the report whether it can now ACCEPT something it refused and whether
  that something is a genuinely self-intersecting outline. Tests must include a true crossing between two arcs
  sharing an endpoint (a figure-eight or a bow-tie of arcs) that is still refused.
- Regression tests that fail on HEAD: a `Set dimensions` / `scaleDesignToDimensions` W = D on the default tree
  (e.g. 2987 × 2987) that lands exactly, and a direct `circularEdgeIntersections` case for the phantom. Watch each
  red against the unpatched `arcArc`.
- Sweep and report counts before and after: every preset with an arc (list them from the preset module), W = D
  and W ≠ D typed sizes over a range, rotations, and the zone/room outlines the suite builds. Zero new
  refusals of a valid shape, zero acceptances of a crossing one.
- Correct `scaleSolve.ts`'s tree paragraph to what is now true (grep the file for `1.4999944`, `1.50192`, `tree`).
- Model: Opus.

## Task 2: A typed size that lands away from the number typed says so (AD18-R24)

**Why:** a TYPED size a part cannot reach lands on the nearest reachable size with no message. A hand-drawn quad
typed to Width 67 lands at 202.5; before AD18-R23 that input was refused with a reason. The user ruled: land as
now, and raise a WARNING notice naming the landed size when it misses the typed value by more than 0.5 mm.
Drags stay silent (the pointer is their feedback), so a drag and a typed size still land the same numbers
(AD18-R23 row 3).

**Owns:** `src/presentation/i18n/locales/en/designerTypedLanding.ts` and `.../de/designerTypedLanding.ts`
(pre-created, empty, registered), one NEW module under `src/presentation/designer/` for the check (suggested
`selection/typedLanding.ts`), and the typed doors — which the integrator believes are:
`AssetDesignerRoot.vue` (`editDimensions`'s scaling path, `scaleDesignToDimensions`), 
`inspector/DesignerSelectionInspector.vue` (Width and Depth, `resizeToExtent`), and the dimension-label commit
(`dimensions/dimensionFigures.ts` and whichever component dispatches it). **Verify that list at the code** —
every door that types a Width, Depth or whole-design size — and report NEEDS_CONTEXT for a door outside it.
Do not edit `scaleSolve.ts`, `partExtent.ts`, `selectionDrag.ts` or `shapeEdits.ts`.

Requirements:
- Only the typed doors warn; a box-handle drag must not (test that it does not).
- The check compares the LANDED extent (measured from the written shape the way the door measures it) with the
  TYPED value, per axis, threshold 0.5 mm (the inspector shows whole millimetres). Name the landed size in the
  display unit the field uses.
- The warning goes through the existing notice door (`notifyWarning` or the designer's own equivalent; find the
  precedent), only after the write resolved ok. A refusal keeps its existing message. A typed value equal to
  the offered one still dispatches nothing (C03).
- One English and one German string, sentence case; German reviewed for grammar. Check both locale test
  families (`labelInName`, sentence case, strings pins) still pass.
- `AssetDesignerRoot.vue` is at 399 of 400 counted lines: the root may gain at most ONE counted line; move
  logic into the new module. Show the eslint `max-lines` result.
- Tests at the component level through the real dispatch (a rig or the `&writable` composition), for each door:
  the quad (or another shape whose reach you verify) lands and warns; a reachable size lands and does not warn;
  a drag lands and does not warn.
- Model: Opus.

## Task 3: One shared disclosure chevron (AD18-R24)

**Why:** fallow reports clone `dup:893211b2` — `styles/designer-selection.css` (the `.rp-designer-collapsible >
summary::before` chevron, its `[open]` rotation and `::-webkit-details-marker`) copies `styles/project-list.css`
(`.rp-project-list__completed`). The designer copy arrived in 84aad8e38 (AD18-R16 Task 6). Ruled: one shared
rule for both summaries, both copies removed. NOT an `ignoredClones` entry.

**Owns:** `styles/designer-selection.css`, `styles/project-list.css`, `styles/index.css` (only if you add a
partial), one NEW partial if you choose one, and the stylesheet tests that pin these selectors (grep `tests/`
for `rp-designer-collapsible` and `rp-project-list__completed`; list every one you edit in the report).

Requirements:
- Computed styles of both chevrons, closed and open, identical before and after (the integrator measures in
  Chromium, both themes). Nothing else in either file moves.
- `npx fallow dupes` reports no clone group for these two files afterwards; paste the output.
- Grep `scripts/` and `tests/` for every selector you move.
- Model: Sonnet.

## Task 4: `designerComposition.ts` really is the one definition (AD18-R24 defect, final review N2)

**Why:** `tests/helpers/designerComposition.ts` says it composes the designer's persistence side "ONCE … One
definition rather than two copies, because fallow reads `tests/helpers/`", while
`tests/helpers/assetDesignHarness.ts` (around `seeded`) still builds the same nine-command
`AssetDesignCommandBundle` and a byte-identical `SPEC_SHEETS` / `specSheetProbe`. Make the claim true.

**Owns:** `tests/helpers/designerComposition.ts`, `tests/helpers/assetDesignHarness.ts`.

Requirements:
- `assetDesignHarness.ts` builds its bundle and probe from what `designerComposition.ts` exports. Keep what it
  needs of its own: the `sidecar`/`assets` wrapper knobs, and the concrete `setFacingCommand` /
  `setHeightCommand` instances its cases dispatch `execute` on (read its comments on why).
- **The fallow trap in CLAUDE.md** ("The five repositories are deliberately NOT in that foundation"): fallow
  resolves class members through the annotation where the consuming expression sits and does not follow a field
  across modules, so moving a `new` into a shared function can produce `unused-class-members` findings. Run
  `npx fallow` (dead code) and paste the result; no new finding, no `private-type-leaks`.
- Every consumer of both helpers still passes (grep `tests/` for each; run them).
- The docblock's claim matches what is left after your change.
- Model: Sonnet.

## Task 5: The Shift corner clearance-drag case can fail (AD18-R24 defect, T5-M1)

**Why:** in `tests/presentation/designer/selection/selectionDragClearance.test.ts`, the Shift CORNER case (the
round-table clearance) tells the solve from the plain scale by about 5.7e-7 mm of solver noise, so it cannot
tell them apart. CLAUDE.md's Testing rules require a test that fails without what it guards.

**Owns:** that test file (and a sibling test file if the change pushes it past 450 lines).

Requirements:
- Choose an input (preset, handle, delta) where a Shift corner drag's solve and a plain scale differ by at least
  1 mm, verified by computing both, and assert the solved result against the pointer and the held corner.
- Watch it red against a temporary in-place revert of the solve for the clearance in `selectionDrag.ts`
  (restore it; do not commit it), and say in the report what the revert was and what the failure printed.
- Check the neighbouring cases' docblocks still describe their inputs.
- Model: Sonnet.

## Task 6: Manual-pass steps for the new work, and the count re-derived

**Owns:** `docs/tests/cases/*.md` and `docs/tasks/asset-designer-expansion/reports/MANUAL-PASS.md`.

Requirements:
- Steps for everything this round ships: Task 1 (e.g. a round shape typed W = D at a size the old code refused,
  and a rotation of it; a Plan Editor round zone if one is reachable), Task 2 (each typed door warns with the
  landed size; a drag does not; a reachable size does not), Task 3 (both chevrons look and turn as before, both
  themes).
- **T3-b**: a step for AD18-R23's read-back rule reached by a CALIBRATION: a hidden PENDING clearance re-shows
  when a calibration rescales it, and after the calibration's undo (`CalibrateAsset.ts`). Step 36a of
  `Calibrate a sheet and reserve space` already covers `Set dimensions`.
- Rewrite every existing step this round makes false (grep the cases for the tree example, `1.4999944`, "lands
  on the nearest", "no notice", the quad, 202.5).
- Re-derive the MANUAL-PASS count with the command the index prints (it was 232) and put the command's output in
  the report. Every expectation is checked against SOURCE, never against a report.
- Model: Sonnet.

## Task 7: Rewrite `reports/RESUME.md` for the manual-walk session (integrator)

## Task 8: Delivery note in `DECISIONS.md` and `state.json` evidence (integrator)

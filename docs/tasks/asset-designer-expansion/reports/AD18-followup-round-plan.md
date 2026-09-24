# AD18 follow-up round — plan (session eighteen, 2026-09-24)

**Authority: ruling AD18-R23** in `contracts/DECISIONS.md`. The polish round (AD18-R20…R22) recorded
seven items rather than fixing them. This session checked each one at source. Two are defects fixed
without a ruling, two are already fine and recorded as such, and three plus a harness proposal went to
the user in one batched round, which took all four recommendations. The six code tasks below are those
items. The last three are the manual-pass steps, the hand-off and the delivery record. If a task would
contradict an earlier ruling (AD18-R1…R22, AD14-R1, AD12-R1, AD11, AD08-R1, C01–C12, r1) or would need a
stored field, STOP and report NEEDS_CONTEXT rather than choosing.

**No two tasks own the same file.** Tasks may run in parallel only on disjoint files, and then each
stages **by explicit path only**.

## Global constraints (every task)

- Read `CLAUDE.md` at the worktree root before editing. It is long; the Testing, Claims and Gotchas
  sections bind every task.
- **Verify every instruction in your brief at the code before applying it.** Every brief in this
  package's history has carried at least one false premise, this one's author included. If the code
  disagrees with the brief, the code wins and your report says so.
- **File ownership is binding.** Each task names the files it OWNS. Edit only those, plus NEW files
  you create, plus your own new or existing test files for the code you own. Shared test helpers
  (`tests/helpers/**`, `tests/harness/**`) are READ-ONLY unless your task names them. If you need
  something from a file you do not own, stop and report NEEDS_CONTEXT naming the file and the edit.
- Layering and lint: no user-visible literal at the `I18N_LITERAL_BAN` call sites. No task in this round
  needs new copy; if yours turns out to, report NEEDS_CONTEXT (`en.ts`/`de.ts` are near their cap and owned
  by nobody). No inline styles. No hard-coded colour in `styles/`. No new dependency. No schema change and
  no new stored field.
- **400-line cap**, and an SFC's `<template>` comments COUNT against it. `AssetDesignerRoot.vue` is AT its
  cap (owned by no task). `styles/designer.css` is at 400. `tests/**` caps at 450: split a suite into a
  sibling file rather than trimming it.
- Every `.vue` under `src/presentation/designer/` must stay reachable by import from
  `AssetDesignerView.ts`, and `npm run analyze` (fallow) fails on an unused export or file. Fallow does not
  read `*.test.ts` for duplication but DOES read `tests/helpers/`.
- Coverage floors are 99/99/99/98 and TIGHT: every new branch gets a test. An unreachable guard is not free.
- A test for an invariant is watched failing: make a temporary in-place edit that reverts the fix, see red,
  restore it. **Never `git stash` in any form**: the stash stack is shared across sessions.
- **Ask of every test you add: does it test what SHIPS, and can it fail?** Reviews last round caught a
  test that passed under the wrong tool, a sweep over anchors the component no longer produced, and
  vacuous `?.` assertions. Say in the report how you saw each one fail.
- **`only`, `cannot`, `never`, `exactly` and `opens in` in docblocks went false repeatedly.** Grep your diff
  for them and check each against the code.
- **Obsidian's base stylesheet sets `button { height: var(--input-height); white-space: nowrap }`** and
  centres flex children (`align-items: center`).
- **Accessible names are load-bearing in tests** (`tests/helpers/accessibleName.ts`, `designerRig.ts`
  `toolbarButton`, `tests/harness/assetDesigner.ts` `pressTool`). Obsidian's tooltip reads `aria-label` only.
  If you change a name, grep `tests/` and `scripts/` for text lookups.
- Commands: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before any node command. The machine has 7.8 GB
  shared with other sessions; under load the designer suite ran 5x slower and a worker-start timeout turned
  a green run into exit 1, so re-run a named file alone before believing a failure. Run narrow
  `npx vitest run <paths>` only. On EVERY touched file, UNPIPED (never through `tail`/`head`, which replaces
  the exit code): `npx eslint <files> --max-warnings 0`, `npx oxlint --deny-warnings <files>`, and once
  before reporting `npx vue-tsc --noEmit -p tsconfig.json`. Paste each exit code into the report.
  `npx fallow health --complexity` checks template complexity locally. Do NOT run `npm run check`,
  `check:fast`, `test:coverage` or `analyze`: CI runs those.
- Do not touch `docs/tests/cases/`, `MANUAL-PASS.md` or `RESUME.md` (Task 7 and the integrator own them).
  Do not push. Commit on the current branch with a message ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- You have no browser. Anything about LAYOUT or on-screen position is a prediction: write it as a number
  you could be wrong about. The integrator measures every UI task in Chromium afterwards; last round those
  measurements caught five defects every gate passed.
- **Measure the selection the reviewer will probe, not the one you happened to pick**: the footprint, the
  clearance and each detail, not just one. Last round a card measured one detail and nothing selected, and a
  reviewer's probe then selected the footprint and found the defect in 9,050 of 77,964 frames.
- Use typographic-dash-safe edits. For a multi-line splice, write a script to a file and splice on a content
  anchor, never on a line number.

## Task 1: A `&writable` harness knob over the real write path (AD18-R23)

**Why:** the browser harness refuses every write (`unavailableAssetDesignerCommands()` in
`tests/harness/assetDesigner.ts`, whose header says so), so no successful Group, undo or redo has ever been
observed in a browser. Tasks 3 and 5 of this round need writes to be measured.

**Owns:** `tests/helpers/designerRig.ts`, `tests/harness/assetDesigner.ts`, `tests/harness/page.ts`, one NEW
vitest-free composition helper under `tests/helpers/` (suggested `designerComposition.ts`), and one NEW
harness test file (suggested `tests/harness/assetDesignerWritable.test.ts`).

Requirements:
- `?view=asset-designer&preset=<id>&writable` mounts the designer over the in-memory repository stack
  (`createRepositoryStack`, `tests/helpers/vault.ts`) and the REAL `AssetDesignCommandBundle` and
  `createAssetDesignerCommands`, seeded with that preset's shape, with `GetAssetDesignQuery` reading back
  what was written and `onDesignChanged` over a real event bus, so a committed write re-hydrates the leaf.
  Without `&writable` every existing knob and capture behaves exactly as today.
- The composition `designerRig` builds today (stack, sidecar, the bundle, `createAssetDesignerCommands`, the
  queries, `onDesignChanged`) moves into the ONE new helper that both `designerRig` and the harness call.
  That helper imports nothing from `vitest`: the harness runs in a browser. `designerRig`'s own test-only
  parts (`FaultingSidecar`, fault injection, `unrecoveredSettings`) may stay in `designerRig` or be passed
  in; the rig's existing callers must not change. Verify at source that `createRepositoryStack` and its
  imports are browser-safe under the harness's Vite config (the `obsidian` alias to the mock).
- Writes persist until reload. `&stale` beside `&writable` is not required to work; refuse the combination
  loudly (the `&draw` knob's `console.error` precedent) or document why it composes.
- A jsdom harness test that mounts through the same function the page uses, selects two details, groups them
  from the right-click menu (`tests/helpers/designerRightClick.ts`), and asserts the group is in the design
  READ BACK from the stack. Watch it fail against the refusing commands. Update the header docblock of
  `tests/harness/assetDesigner.ts`, which says every write refuses.
- `tests/gates/harness-shot.test.ts` and `scripts/harness-shot.mjs` are NOT owned: add no fixed shot.
- Nothing in `src/` changes. `tests/gates/prototypes-not-bundled.test.ts` must still hold.

## Task 2: An overall label with no free outside slot steps onto the drawing before it covers a handle (AD18-R23)

**Owns:** `src/presentation/designer/dimensions/dimensionFigures.ts` and the tests under
`tests/presentation/designer/dimensions/` (a new sibling file if a suite would pass 450 lines).

Today (`overallSlot` and its caller's docblocks): an OVERALL label whose anchor is not free takes the nearest
free slot along its own line or further out, and with none free keeps its anchor, over the handle. On 280–360
px canvases that leaves 205 of 77,964 modelled frames with an overall label on a handle, which may then be
unreachable. **Ruled:** in exactly that case, when no along-line or outward slot is free AND the anchor covers a
handle, the label takes the nearest free slot on the drawing's side too, before it covers a handle. Every other
frame keeps AD18-R21 fix round 2's rule (never onto the drawing). A label whose anchor overlaps only another
LABEL keeps today's behaviour; only a handle earns the inward step.

- Rebuild the 77,964-frame probe as a temporary script (definition: `.superpowers/sdd/round3/task-5-report.md`,
  "Probe counts": every preset × {nothing, footprint, clearance, each detail} × {transform, points, bend} × the
  fit-camera grid 280..900 × 280..700 in 40 × 20 steps plus the four modelled leaves). Report before and after
  for: labels on a handle (was 205), overall labels inside/onto the drawing (was 0), overlapping pairs (was 0),
  moves over 100 px (was 2,366). The target is 0 on a handle; state every other count that moved, and why.
- A committed test pins at least one real frame that was on a handle before and is off it after, watched red.
- Correct every docblock in the file that states the old rule ("keeps its anchor", "never onto the drawing").

## Task 3: A clearance swapped by a read-back re-shows when its geometry changes (AD18-R23)

**Owns:** `src/presentation/designer/runtime.ts` and its tests (find the suite that pins `clearanceReveals`'s
absent-to-present rule; a new sibling test file is fine).

Today `clearanceReveals` watches `(store.design?.shape?.clearance ?? null) !== null` and turns
`showClearance` on only when that goes from false to true. **Ruled:** it turns it on whenever a read-back
brings a clearance whose GEOMETRY (points and bulges, compared by value) differs from the one before,
including absent-to-present. A read-back that leaves the clearance's geometry unchanged (a detail moved, a name
edited, the same design re-read) does NOT re-show it. Present-to-absent never touches the switch.

- Verify at source what else about the clearance a read-back may change without the geometry changing (the
  pending flag, AD14-R1's review flag) and say in the report whether those re-show; the ruling covers geometry.
- Tests: a swap by undo, by redo and by an external (peer) write each re-show; an unrelated write does not; the
  existing absent-to-present cases still pass. Watch each fail against today's presence watch.
- Update `runtime.ts`'s docblocks that record the swap gap as known behaviour.

## Task 4: The rulers' selection band and `Shift+2` follow `drawnSelection` (AD18-R23 defect)

**Owns:** `src/presentation/designer/rulers/DesignerRulers.vue`, `src/presentation/designer/DesignerCanvas.vue`
and their tests.

`drawnSelection` (`selection/hitTest.ts`) is the one rule for what a selection draws (AD18-R20); the canvas
marks, the dimension labels and the selection keys ask it. Two readers do not:
- `DesignerRulers.vue`'s `model` passes `selection.value` to `selectionFrame`, so the rulers band the extent of
  a selected clearance while `Show clearance` is off, or of a Parts-hidden selected graphic.
- `DesignerCanvas.vue`'s `framedBounds(false)` (`Shift+2`) passes `selection.value`, so Shift+2 frames a part the
  canvas does not draw. With `drawnSelection` answering `null`, `framedBounds` answers `null`, and a fit with
  nothing to frame does nothing (the rule `framedBounds`' docblock already states).

Requirements: both read `drawnSelection` with the view facts `DesignerCanvas`'s `marks` already passes. Showing
the part again brings the band and the frame back. Tests for both, each watched red; update both docblocks.
`Shift+1` and the toolbar's fit are untouched.

## Task 5: A box-handle drag on a curved clearance solves like every other curved part (AD18-R23)

**Owns:** `src/presentation/designer/selection/selectionDrag.ts` and its tests.

`keptCurves` returns `null` (the plain scale) for `part.kind === 'clearance'`, and `fittedResize`'s parameter
type excludes the clearance. A typed clearance Width or Depth already solves through `resizeToExtent`
(`inspector/DesignerSelectionInspector.vue`'s `sizeLine`). **Ruled:** a clearance handle drag solves too, so the
side opposite the handle stays put and the curve-aware box lands where the pointer asks, or as near as a typed
size would. Task 13 of the polish round's clearance exclusion is withdrawn.

- Verify at source that `resizeToExtent`, `partMeasure` and `moveOutline` accept the clearance, and what a
  handle drag on the clearance does to `clearancePending` and AD14-R1's review flag today versus the typed path.
  The ruling is that both paths behave the same; if they would differ, report NEEDS_CONTEXT.
- Tests with the round-table (`circle`) and oval-table (`stadium`) preset clearances: a side drag and a corner
  drag keep the opposite side and land the typed path's size, watched red against the plain scale. Shift keeps
  the uniform scale.
- Rewrite the docblocks that say the clearance keeps the plain scale "deliberately" under C07.

## Task 6: The Plan Editor's zone lock toggle drops `aria-pressed` (AD18-R23 defect)

**Owns:** `src/presentation/editor/shell/ZoneLockToggle.vue` and the tests that assert its `aria-pressed`
(grep `tests/` for `rp-editor-inspector-lock`, `data-rp-lock` and `aria-pressed`). Comment-only edits are
authorized in any designer file whose docblock cites `ZoneLockToggle` carrying `aria-pressed` as a convention.

The toggle carries a swapping accessible name (`editor.input.lock` / `editor.input.unlock`) AND
`:aria-pressed="locked"`, so a locked zone announces "Unlock Kitchen, toggle button, pressed", which is the
contradiction 3405aab95 removed from the designer's `DesignerPartControls.vue` (read its docblock). Drop
`aria-pressed`; the swapping name and the glyph carry the state. Grep the Plan Editor for any other control with
the same pair and REPORT it (do not fix it). Tests watched red; the accessibility suites under `tests/harness/`
must still pass.

## Task 10: The designer's Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y (AD18-R23 defect, found while measuring Task 1)

**Runs before Task 7.** Numbered 10 because it was added after the plan was written.

**Owns:** `src/presentation/designer/AssetDesignerRoot.vue` (see the cap rule below), one NEW module under
`src/presentation/designer/` if the wiring needs a home, and their tests.

Measured by the integrator in Chromium on `&writable` (Task 1): a Group, then the toolbar's Undo and Redo, read
back correctly, but **Ctrl+Z with the designer canvas focused did nothing**. `grep` finds no history key binding
anywhere under `src/presentation/designer/`. The Plan Editor binds one on its ROOT element
(`PlanEditorRoot.vue`'s `onRootKeydown` calls `editorHistoryShortcut` from
`src/presentation/editor/surface/historyShortcut.ts`, which owns the chord rule, the focused-field and modal
exemptions, and the autorepeat and mid-gesture refusal). C12 binds the designer to the Plan Editor's interaction
conventions, and the manual case `Calibrate a sheet and reserve space` step 13 already expects Ctrl+Z in the
designer.

Requirements:
- The designer's root answers Ctrl+Z (undo), Ctrl+Shift+Z and Ctrl+Y (redo), Cmd on macOS, through
  `editorHistoryShortcut` itself rather than a copy, with the designer runtime's `undo`/`redo`/`canUndo`/`canRedo`
  and whatever the designer has for "writes blocked", a modal dialog open, and a gesture in flight. Verify each of
  those at source; if the designer has no equivalent of one, report what you used and why.
- A focused text field, number field or select keeps its own native undo (the helper's `EDITING` rule): the
  Inspector's inputs must not lose Ctrl+Z to the leaf.
- The existing root `@keydown` handler (`contextMenu.key`) keeps working: the menu's keys are unchanged.
- **`AssetDesignerRoot.vue` is AT its 400-line cap, and SFC template comments count against it.** Net growth is not
  allowed. Move wiring into your new module, or move a TEMPLATE comment's prose into the script docblock
  (script comments are skipped) and leave a one-line pointer, which is the house remedy.
- Tests: each chord undoes or redoes a real write (`designerRig` over the real write path), a focused Inspector
  input keeps its native Ctrl+Z, and a chord pressed mid-gesture or with a dialog open is refused. Watch each fail.

## Task 11: `solveScale` lands the NEAREST reachable extent, monotonically (AD18-R23 defect, found by Task 5's review)

**Runs before Task 7.** Numbered 11 because it was added after the plan was written.

**Owns:** `src/domain/asset/scaleSolve.ts`, `tests/domain/asset/scaleSolve.test.ts`, the docblocks (only) of
`src/presentation/designer/selection/selectionDrag.ts` and `src/presentation/designer/selection/partExtent.ts`, and
new tests beside them.

Task 5's reviewer measured `draggedShape` and the typed Width on the oval-table preset's clearance (a stadium whose
width is `800·f + 2200`, so 2200 is an asymptote no positive factor reaches), left side held at -1500, handle 3
dragged inward: pointer x 700.5 lands the right edge on 700.50; x 700 (typed Width 2200) lands **1286.67**, 587 mm
OUTWARD of the pointer; x 699.5 lands 773.32; x 650 lands 771.67; x 0 lands 750.00; x -1400 lands 703.33. The
round-table clearance stalls past about -600 with reversals up to 21 mm; the vanity basin (a detail) jumps 8 mm
(pointer 90.5 lands 90.50, 90 lands 98.44). Cause (`solveScale`): a secant step to a factor at or below zero is
HALVED toward zero, and the best of `MAX_STEPS` = 4 attempts wins, so an unreachable target lands wherever the
fourth halving stopped. The docblock promises "the NEAREST attempt", and that sentence and
`selectionDrag.ts`'s "reach the same NEAREST extent" are false at the limit.

Requirements:
- For a target the kept bulges cannot reach, the solve lands the NEAREST reachable extent (the infimum as the factor
  goes to zero, within a tolerance you state and justify against the whole millimetres the inspector shows), and
  the landed extent is MONOTONE non-decreasing in the target: moving the pointer inward never throws the side
  outward. A reachable target still lands within `TOLERANCE_MM` as today; a straight outline still lands exactly.
- Never a refusal where something landed, and never a mirror (a non-positive factor). If validation refuses a factor
  close to zero (a degenerate outline), the answer is the nearest factor that validation accepts, not a jump.
- Bounded: state the new worst-case count of `apply` calls per solve; the drag calls this on every pointer move.
- Tests: a sweep of targets across each preset's reach limit (oval-table and round-table clearances, the vanity basin,
  and the curved footprints `scaleDesignToDimensions` solves) asserts monotonicity and nearness; the reviewer's
  table above is pinned. Watch them fail on today's solver.
- Every caller keeps its contract: `scaleDesignToDimensions` (`shapeEdits.ts`), `resizeToExtent` (`partExtent.ts`)
  and `fittedResize` (`selectionDrag.ts`). Correct the "NEAREST" sentences in all three files' docblocks.

## Task 7: Manual-pass steps for the new work, and the count re-derived

**Owns:** `docs/tests/cases/*.md` and `docs/tasks/asset-designer-expansion/reports/MANUAL-PASS.md`.

- Add steps for: the swap re-show (Task 3), the inward last-resort label (Task 2, a 280–360 px canvas), the rulers
  band and Shift+2 on a hidden selection (Task 4), a curved clearance handle drag (Task 5), and the zone lock
  toggle's announcement (Task 6, in the Plan Editor's case file if one covers the lock).
- Rewrite every existing step or "known behaviour" line this round makes false. Grep the cases for: `swapped`,
  `stays hidden`, `plain scale`, `on a handle`, `205`, `rulers`, `Shift+2`, `aria-pressed`, `pressed`.
- Re-derive the MANUAL-PASS count with the command the file prints, verbatim, and update the number and its
  history line. It was 215.
- Every expectation is checked against SOURCE by an independent reviewer; write each so it can be.

## Task 8: Rewrite `reports/RESUME.md` for the manual-walk session (integrator)

Wholesale rewrite, not an append: branch, PR draft status, last green sha and run id, what this round shipped
(AD18-R23), known behaviour the walk must not file, what only the walk can settle, and the `&writable` knob.

## Task 9: Delivery note in `DECISIONS.md` and `state.json` evidence (integrator)

One paragraph under AD18-R23 and one `state.json` evidence line, in the same edit: tasks, fix rounds, measurements,
the final green sha by run id, and the manual-pass count.

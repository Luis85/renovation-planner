# AD18 parity round — plan (session fifteen, 2026-09-22)

**Authority: ruling AD18-R16** in `contracts/DECISIONS.md`. The user reviewed a fresh audit of the
running harness against `references/01-overall-look-and-feel.png` and
`references/02-interaction-concepts.png` and approved all twelve gaps below. Every item here is
OUTSIDE AD18's *Deliberately absent* table and outside every earlier AD18 ruling. If a task would
contradict an earlier ruling (AD18-R1…R15, AD14-R1, AD12-R1, AD08-R1), STOP and report
NEEDS_CONTEXT rather than choosing.

## Global constraints (every task)

- Read `CLAUDE.md` at the worktree root before editing. It is long; the Testing, Claims and
  Gotchas sections bind every card.
- **Verify every instruction in your brief at the code before applying it.** Five of the last
  session's briefs carried a false premise. If the code disagrees with the brief, the code wins and
  your report says so.
- Layering and lint: no user-visible literal at the `I18N_LITERAL_BAN` call sites; every new string
  is a locale key in BOTH `src/presentation/i18n/locales/en/` and `de/` (find the file the
  neighbouring keys live in); no inline styles; no hard-coded colour anywhere in `styles/` (host CSS
  variables only); no new dependency.
- **400-line cap**, and an SFC's `<template>` comments COUNT against it. `AssetDesignerRoot.vue`
  sits near 392 counted lines — add nothing to it you can put in a child component.
- Every `.vue` under `src/presentation/designer/` must stay reachable by import from
  `AssetDesignerView.ts` (`tests/presentation/designer/regionsReachable.test.ts`).
- Icons go through `HostIcon.vue`. A harness fixture icon is TWO files — the SVG in
  `tests/fixtures/editor-icons/` and its entry in `tests/helpers/editorIconNodes.ts` — or neither
  (`tests/helpers/editorIconNodes.test.ts` checks both directions). Existing fixtures include
  `minus`, `plus`, `maximize`, `arrow-left`, `anchor`, `group`, `ungroup`, `copy`, `trash`.
- Coverage floors are 99/99/99/98 and TIGHT: every new branch gets a test. An unreachable guard is
  not free. `npm run analyze` (fallow) fails on an unused export or file.
- Tests: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before any node command. Run narrow
  `npx vitest run <paths>` only, plus `npx eslint <touched files> --max-warnings 0` and
  `npx oxlint <touched files>`. Also run `npx vue-tsc --noEmit -p tsconfig.json` once before
  reporting. Do NOT run `npm run check`, `check:fast`, `test:coverage` or `analyze` — CI runs
  those. The machine has ~1 GB free RAM shared with other sessions.
- A test for an invariant is watched failing: revert the fix, run it and see red, then restore.
- Do not touch `docs/tests/cases/`, `MANUAL-PASS.md` or `RESUME.md` (Task 13 and the integrator own
  them). Do not push. Commit your work on the current branch with a message ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- You have no browser. Anything about LAYOUT (wrapping, widths, overlap) is a prediction: write it
  in your report as a number you could be wrong about, and the integrator will measure it.

## Task 1: Toolbar zoom cluster

Board 01 draws `− 100% +` and board 02 `100% ▾` beside undo/redo. The designer ships a
`Zoom NN%` readout in its status region (`AssetDesignerRoot.vue`, `zoomPercent`, AD18 item 1) and
no zoom controls at all.

- In `DesignerToolbar.vue`'s trailing cluster (beside undo/redo, before the `View` menu), add a
  `role="group"` zoom cluster: a zoom-out button (`HostIcon` `minus`), an `<output>` showing
  whole-percent zoom, a zoom-in button (`plus`) and a fit button (`maximize`). Factor 1.25 about
  the stage centre, exactly as `src/presentation/editor/shell/EditorViewMenu.vue`'s `zoom()` does.
  Fit uses the SAME fit the designer's opening camera uses — find it and call it; do not write a
  second fit. Reuse the editor's `editor.view.zoom-out` / `editor.view.zoom-in` / `editor.zoom` keys
  where they say the right thing; new keys for the group name and the fit button.
- The readout MOVES: the status region's `Zoom NN%` is removed, with its docblock carried to the
  new home, because two standing answers to one question is refused (AD18-R1's shape). Keep its
  gate: nothing is stated while `design` is `null`.
- Buttons are icon-only with an accessible name and a `title`/tooltip consistent with the other
  designer tool buttons.
- Tests: each button changes `editorStore.viewport.zoom` in the stated direction; fit restores the
  opening camera; the readout tracks zoom and is absent without a design; the status region no
  longer states zoom. Re-point any existing test that pinned the status readout.

## Task 2: Back-to-library header button

Board 02 draws `← Back to library`. `DesignerHeader.vue` draws a text `Open library` button
(`designer.inspector.open-library`).

- Prefix the button with `HostIcon` `arrow-left`; label `Back to library` (en) /
  `Zurück zur Bibliothek` (de) under a `designer.header.*` key. Remove the old key if nothing else
  uses it (grep first).
- AD18's own report measured this button at 143.6 px of a 460 px header, more than the asset name
  kept. Under the header's narrow container width, visually hide the label (keep it as the
  accessible name) so the icon alone stands. Use the house visually-hidden pattern if one exists.
- Tests: icon present, accessible name, click calls `openLibrary`, not drawn when unbound.

## Task 3: Labelled Basic-shape tiles in the Add rail

Board 01's `Basic shapes` section is a tile grid, icon above a visible label. `DesignerAddPanel.vue`
draws four `DesignerToolButton`s whose labels the toolbar CSS hides.

- In the Add rail only, draw the shape buttons as tiles: icon above a visible label, a two-column
  grid that degrades to one column when the rail is narrow. A visible `Basic shapes` sub-heading
  (`designer.shapes.group`, already minted) names the group via `aria-labelledby`.
- Order within the rail follows board 01: the preset door first, then `Basic shapes`.
- Must NOT change the main toolbar's buttons. Styles live in `styles/designer-add.css`.
- Tests: labels visible (not the hidden-label class), group named by the heading, pressed state
  still tracks the active tool.

## Task 4: Canvas legend

Board 01 draws a legend over the canvas's bottom-left corner: Clearance, Footprint, Details,
Placement point, Front direction.

- New `DesignerLegend.vue`, a non-interactive DOM overlay in the canvas's overlay slot (where the
  rulers and dimension labels already mount — find that slot, do not invent a second one). Each row
  is a small swatch plus a label. Swatches take the SAME stroke/dash/colour conventions the Konva
  layers use for that part, from the same host CSS variables (read how the layers resolve colour).
- List only what the design has: no Clearance row without a clearance, no Details row without
  details.
- `View` menu gains a `Legend` checkbox (`data-rp-view="legend"`), default ON, LEAF-LOCAL and not
  persisted — AD18-R12 is the precedent and the reason.
- Hidden while the empty-state overlay is drawn, and hidden by container query at the narrow
  breakpoint `designer-narrow.css` uses (AD18-R10 binds canvas share there). `pointer-events: none`.
- Tests: rows match the design's parts; toggle hides/shows; hidden in empty state; default on.

## Task 5: Compact field rows

Both boards draw `Width [800 mm]`: short label on the left, unit inside the field's right edge.
`DesignerFieldRow.vue` draws `Width in millimetres` stacked above its input.

- `DesignerFieldRow` renders one row: short visible label | input with a unit suffix
  (`aria-hidden`). The input's accessible name stays the FULL existing label (e.g. `Width in
  millimetres`), so the visible text is contained in the name (WCAG 2.5.3 label-in-name).
- Every caller passes a short label key and a unit (`mm`, `°`, or none, e.g. for a scale factor
  or a count). New `…short` keys in en and de. Converge the inspector's other numeric millimetre
  inputs onto `DesignerFieldRow` where they are the same shape (clearance helper, repeat spacing,
  height) — but only where the swap is mechanical; list any you left and why.
- Hint text (`aria-describedby`) behaviour is unchanged.
- Tests: accessible name is the full label; visible label is the short one; unit suffix is
  `aria-hidden`; change still dispatches.

## Task 6: Collapse Arrange and Repeat

The boards fold advanced groups (`› Advanced`, `› Appearance`, `› Order`). With a detail selected the
Inspector draws the Arrange set-transform fields and the whole Repeat form open, which makes it
very long.

- In `DesignerArrangePanel.vue` / `DesignerRepeatForm.vue`, wrap the set-transform fields (move
  across/down, rotation, scale) and the Repeat form each in a `<details>` closed by default whose
  `<summary>` carries the existing section title. Group / align / distribute actions stay visible —
  they are the primary multi-selection actions.
- Open state is leaf-local and not persisted.
- Keep any existing focus hand-off working (read `DesignerSelectionInspector`'s focus logic).
- Tests: closed by default; summary names it; opening exposes the fields; actions still visible.

## Task 7: Tidy the Asset block

Board 01 groups `Dimensions: Width, Depth, Height`. The Object tab draws Dimensions `W × D mm`, then
`Edit dimensions`, then a `Select multiple parts` checkbox, then `Height in millimetres`.

- Height sits directly with Dimensions (after the `W × D` row, before `Edit dimensions`).
- `Select multiple parts` is a selection affordance, not an asset fact: move it to the Parts panel
  (under its heading). It must stay reachable wherever it was reachable before (check whether it is
  drawn when no design exists / in the stacked narrow layout). AD08-R1 blesses the Parts panel as a
  selection surface.
- Tests: order within the Asset block; checkbox now in the Parts panel and still toggles
  multi-selection.

## Task 8: Placement segmented control

Board 01 panel 5 draws `Back centre | Centre | Custom` as a segmented control. The Inspector draws a
`Placement point: Centre` text row and two plain buttons.

- Replace the text row and two buttons with a `role="group"` named `Placement point` of three
  toggle buttons with `aria-pressed`: `Back centre`, `Centre`, `Custom`. The first two dispatch the
  commands the current buttons dispatch. `Custom` activates the existing Set-anchor tool and is the
  pressed one whenever the anchor is at neither preset. Icons: `crosshair` (Centre), `anchor`
  (Custom), and for Back centre an icon you justify in the report. `crosshair` is a NEW fixture —
  download it from
  `https://raw.githubusercontent.com/lucide-icons/lucide/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons/crosshair.svg`
  (the user approved this download) and add its helper entry.
- The explanatory hint (`Back centre is the middle of the side…`) and the Front direction row stay.
- Tests: pressed state for each of the three anchor situations; each button's effect.

## Task 9: Inspector asset card

Board 02 opens the Object tab with a thumbnail, `Custom asset`, and a category chip. AD18-R1 keeps
the NAME in the header only.

- At the top of the Asset block, draw the asset's thumbnail (reuse the library's mark/thumbnail
  rendering — `AssetMark.vue` or `presetThumbnail`, whichever renders a design's footprint; do not
  write a third renderer) beside its category as a chip, if the asset has a category. No name.
- Decorative thumbnail: `aria-hidden` or empty alt; the category is text.
- Tests: chip text, thumbnail present when a footprint exists, nothing when not.

## Task 10: Icon align and distribute

Both boards draw align/distribute as an icon row. `DesignerArrangePanel.vue` draws ten text buttons
(`designer.arrange.align.*`, `designer.arrange.distribute.*`).

- Draw them as icon buttons in a compact row (align group, distribute group), each keeping its
  current label as accessible name and tooltip. Lucide names:
  `align-horizontal-justify-start|center|end`, `align-vertical-justify-start|center|end`,
  `align-horizontal-distribute-center`, `align-vertical-distribute-center`,
  `align-horizontal-space-between`, `align-vertical-space-between`. Verify each name exists at the
  pinned revision and pick the closest where one does not.
- Download each SVG from
  `https://raw.githubusercontent.com/lucide-icons/lucide/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons/<name>.svg`
  (user-approved) into `tests/fixtures/editor-icons/` and add the helper entries.
- Disabled states unchanged.
- Tests: each button's accessible name and effect unchanged; icons requested by name.

## Task 11: Canvas and Parts context menu

Board 02 panel 7 draws a right-click menu: Group `Ctrl+G`, Ungroup `Ctrl+Shift+G`, Duplicate
`Ctrl+D`, Delete `Del`. The designer has Delete and Ctrl+D keys (`designerKeys.ts`) and no menu.

- Reuse the Plan Editor's `src/presentation/editor/selection/CanvasContextMenu.vue` /
  `CanvasMenuList.vue` / `menuKeyboard.ts` — import or generalise, do not copy. Open on right-click
  over a selected part on the canvas and over a Parts row, and on Shift+F10 / the ContextMenu key.
- Items: Group, Ungroup, Duplicate, Delete, each disabled when its command would refuse, each
  calling the SAME function the existing button/key calls. Shortcut hints shown.
- Add `Ctrl/Meta+G` (group) and `Ctrl/Meta+Shift+G` (ungroup) to `designerKeys.ts`, following its
  existing modifier discipline (no Alt, not repeat, not composing).
- Tests: menu opens and closes (Escape, outside click), items call their functions, disabled states,
  both new shortcuts including the negative cases.

## Task 12: Corner radius for rounded rectangles

Board 02 panel 8 draws a `Corner radius [12 mm]` slider. `draw-rounded-rect` builds a rounded
rectangle with a fixed radius (`CORNER_FRACTION`, a quarter of the shorter side) and AD11 item 2
says *"Store parameter intent only if subsequent edits can maintain it."*

- First investigate and write down, in your report, whether a detail's radius can be READ BACK from
  its stored geometry (quarter-circle arcs with bulge 1 at the corners of an axis-aligned
  rectangle) without storing a parameter. If yes: when the selected detail IS such a rounded
  rectangle, offer a `Corner radius` number field (mm), bounded to (0, half the shorter side], that
  rebuilds the outline through the existing detail-geometry command as ONE undoable edit. Nothing
  new is persisted and no schema changes.
- If read-back is not reliable, or it would need a schema change: STOP and report NEEDS_CONTEXT
  with the options you see. Do not bump the schema.
- Tests: detection (positive, rotated, non-rounded, degenerate), bounds, one undo entry, round
  trip.

## Task 13: Manual-pass steps for the parity round

The integrator writes this after Tasks 1–12 merge. Add steps to the relevant cases under
`docs/tests/cases/` for every new user-visible behaviour above, in the house format, re-derive the
step count with the command `MANUAL-PASS.md` prints, and update its index.

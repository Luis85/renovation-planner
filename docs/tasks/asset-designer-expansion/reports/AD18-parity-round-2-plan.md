# AD18 parity round 2 — plan (session sixteen, 2026-09-23)

**Authority: rulings AD18-R17, AD18-R18 and AD18-R19** in `contracts/DECISIONS.md`. Session sixteen
re-audited the running harness against `references/01-overall-look-and-feel.png` and
`references/02-interaction-concepts.png` at 1280 and 460 px in both schemes. The user approved fifteen
of sixteen gaps and declined `Preview in plan`. The same audit found three defects in AD18-R16's own
work, and those are fixed here without a new ruling. If a task would contradict an earlier ruling
(AD18-R1…R16, AD14-R1, AD12-R1, AD11, AD08-R1, C01–C12) or would need a stored field, STOP and report
NEEDS_CONTEXT rather than choosing.

## Global constraints (every task)

- Read `CLAUDE.md` at the worktree root before editing. It is long; the Testing, Claims and Gotchas
  sections bind every task.
- **Verify every instruction in your brief at the code before applying it.** Every brief in this
  package's history has carried at least one false premise. If the code disagrees with the brief,
  the code wins and your report says so.
- **File ownership is binding.** Each task names the files it OWNS. Edit only those, plus NEW files
  you create, plus your own new or existing test files for the components you own. Shared test
  helpers (`tests/helpers/**`, `tests/harness/**` outside your task) are READ-ONLY. If you need
  something from a file you do not own, stop and report NEEDS_CONTEXT naming the file and the edit.
  The integrator pre-created, empty, one locale module pair and one stylesheet partial per task
  that needs new copy or CSS. Use yours, and put no key or rule anywhere else.
- Layering and lint: no user-visible literal at the `I18N_LITERAL_BAN` call sites. Every new string
  is a locale key in BOTH `en/` and `de/` of your task's module. No inline styles. No hard-coded
  colour anywhere in `styles/` (host CSS variables only). No new dependency. No schema change and no
  new stored field (AD18-R17).
- **400-line cap**, and an SFC's `<template>` comments COUNT against it. Near the cap: `AssetDesignerRoot.vue`
  (~395 counted, owned by NO task), `styles/designer.css` (400), `styles/designer-selection.css`
  (396), and `en.ts`/`de.ts` (owned by NO task). `tests/**` has a 450-line cap: split a suite into a
  sibling file rather than trimming it.
- Every `.vue` under `src/presentation/designer/` must stay reachable by import from
  `AssetDesignerView.ts` (`tests/presentation/designer/regionsReachable.test.ts`), and `npm run analyze`
  (fallow) fails on an unused export or file.
- Icons go through `HostIcon.vue`. Harness fixtures present for this round include `zoom-in`,
  `zoom-out`, `sprout`, `bath`, `tag`, `list`, `funnel`, `grid-2x2`, `armchair`, `brick-wall`,
  `hammer`, `paintbrush`, `layers`, `pencil`, `arrow-left`, `arrow-right`, `crosshair`, `anchor`,
  `chevron-*`. Downloading any other icon needs the user's approval: report NEEDS_CONTEXT rather
  than fetching.
- Coverage floors are 99/99/99/98 and TIGHT: every new branch gets a test. An unreachable guard is
  not free.
- A test for an invariant is watched failing: make a temporary in-place edit that reverts the fix,
  see red, restore it. **Never `git stash` in any form**, because the stash stack is shared across
  sessions.
- **Obsidian's base stylesheet sets `button { height: var(--input-height); white-space: nowrap }`.**
  Every new tile, segment, chip or menu row inherits it. Override deliberately.
- **Accessible names are load-bearing in tests.** `tests/helpers/accessibleName.ts`, `designerRig.ts`
  `toolbarButton` and `tests/harness/assetDesigner.ts` `pressTool` resolve buttons by ACCESSIBLE
  name. If you change visible text or a name, grep `tests/` and `scripts/` for text-based lookups.
  Label-in-name holds (WCAG 2.5.3): a test derives every `.short` key in both locales.
- Commands: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before any node command. The machine has
  7.8 GB shared with other sessions. Run narrow `npx vitest run <paths>` only. On EVERY touched file,
  UNPIPED (never through `tail`/`head`, which replaces the exit code):
  `npx eslint <files> --max-warnings 0`, `npx oxlint --deny-warnings <files>`, and once before
  reporting `npx vue-tsc --noEmit -p tsconfig.json`. Paste each command's exit code into the report.
  Do NOT run `npm run check`, `check:fast`, `test:coverage` or `analyze`: CI runs those.
- Do not touch `docs/tests/cases/`, `MANUAL-PASS.md` or `RESUME.md` (Task 12, Task 13 and the
  integrator own them). Do not push. Commit on the current branch with a message ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- You have no browser. Anything about LAYOUT (wrapping, widths, overlap, visibility) is a
  prediction. Write it in your report as a number you could be wrong about. The integrator measures
  it in the harness after your task, and five of the last round's twelve tasks passed every gate
  while visibly broken.
- Use typographic-dash-safe edits. For a multi-line splice, write a script to a file and splice on a
  content anchor, never on a line number.

## Task 1: AD18-R16 defect fixes — Placement `Custom` wrap, invisible asset-card thumbnail

**Measured by the integrator** in the harness at a 1280 leaf, `?view=asset-designer&preset=vanity`:

- The Placement segmented control (`role="group"` named `Placement point`, drawn in
  `DesignerReferencePlacement.vue`) draws three 61 × 67 px buttons in a 224 px Inspector. `Custom`'s
  label is **35 px tall and breaks mid-word, `Custo` / `m`**. `Back centre` wraps at its space.
- `DesignerAssetCard.vue`'s thumbnail is an `<svg viewBox>` sized in model millimetres (the vanity:
  `-440 -265 880 530`) drawn at 40 × 40 px, with a computed `stroke-width: 1.5px` in viewBox units.
  That is **0.07 px on screen, so the thumbnail is invisible**. It also draws only the footprint path,
  while `presetPreview()` already returns `details` (dashed ones flagged). Board 02's card shows the
  object with its interior.

Requirements:
- No label in the Placement segment breaks inside a word at a 1280 or a 460 leaf. The three buttons
  stay equal width and equal height. Fix it in the segment's own rules
  (`.rp-designer-placement-modes .rp-designer-selection-button` in `styles/designer-add.css`). If the
  fix needs `styles/designer-selection.css`, report NEEDS_CONTEXT, because Task 4 owns that file.
- The thumbnail's strokes are visible at any asset size. Before inventing anything, find how
  `AssetPresetGallery.vue`'s preview thumbnails keep a legible stroke, and reuse it. It also draws
  `presetPreview`'s details, with dashed ones dashed. It stays decorative (`aria-hidden`).
- Tests: the thumbnail renders one path per detail plus the footprint, and a dashed detail is marked
  dashed. For the CSS, assert only what jsdom can see (the rule exists in the assembled sheet); the
  integrator measures the rest.

**Owns:** `src/presentation/designer/inspector/DesignerAssetCard.vue`, `styles/designer-object.css`
(asset-card rules only), `styles/designer-add.css` (placement-modes rules only), and their tests.

## Task 2: Icon-only toolbar and magnifier zoom icons (AD18-R17)

Boards 01 and 02 draw the tool row icon-only, and board 01 draws magnifiers for zoom.
**Measured**: `styles/designer-toolbar.css` hides `.rp-designer-tool-label` only under
`@container rp-designer (width < 80rem)`, so at a 1280 leaf the labels show. With a part selected,
the toolbar is **71 px (two rows)** at 1280, the zoom cluster wrapping to the second row, and
**109 px (three rows)** at 460. The zoom cluster uses `circle-minus` / `circle-plus` (chosen last round
because `minus` belonged to draw-line).

Requirements:
- Tool buttons are icon-only at EVERY width. Each keeps its accessible name and its tooltip exactly
  as today, and the file's own docblock records the trade, since it currently argues for labels.
- The Add rail's shape tiles KEEP their visible labels (AD18-R16 Task 3). Verify the rail's
  override still wins.
- Zoom out / zoom in use `zoom-out` / `zoom-in`. Both fixtures already exist.
- Target: with `&select=detail-2`, the toolbar fits in ONE row at a 1280 leaf. The Transform /
  Edit points / Bend edges mode segment (`DesignerSelectionModes.vue`) stays text unless one row is
  impossible without changing it. Predict the row's width in your report.
- Tests: labels are hidden at every width (the rule does not sit inside a container query any
  more); names and tooltips unchanged; the zoom icons are requested by their new names. Re-point
  every test that pinned `circle-minus` / `circle-plus` or the 80rem boundary.

**Owns:** `DesignerToolbar.vue`, `DesignerToolButton.vue`, `DesignerSelectionModes.vue`,
`styles/designer-toolbar.css`, `locales/{en,de}/designerToolbarIcons.ts`, and their tests.

## Task 3: One menu separator, and the selection shortcuts on Parts rows (AD18-R17)

Board 02 panel 7 draws Group / Ungroup | Duplicate / Delete with ONE separator. `designerMenu.ts`
gives its four items three groups (`arrange`, `edit`, `destructive`), and `CanvasMenuList` draws a
separator between groups, so two ship. The shortcuts (Ctrl/Meta+G, Ctrl/Meta+Shift+G, Ctrl/Meta+D,
Delete) are bound on the canvas ELEMENT only: `AssetDesignerRoot.vue`'s `onCanvasKeyDown` calls
`designerShortcut(event, designStore, keyActions)`. A focused Parts row (`DesignerPartsPanel.vue`,
whose `onKeydown` does roving focus only) ignores them.

Requirements:
- The menu draws exactly one separator, between Ungroup and Duplicate. `CanvasMenuList` is the Plan
  Editor's shared list: change the designer's GROUPING, not the list.
- While focus is on a Parts row, the same four shortcuts run the SAME functions the canvas runs,
  through `designerShortcut` and `selectionKeyActions`, never a copy. Each shortcut obeys the modifier
  discipline `designerKeys.ts` already has.
- **Never while typing**: a Parts row can expand into a `Label` text input. Delete, Backspace and
  Ctrl+D inside any text field must edit the text, not the part. Test it.
- No double fire: a key handled by the Parts panel does not also reach the canvas handler.
- `AssetDesignerRoot.vue` is owned by no task and sits at its cap. Build what the panel needs inside
  the panel (`DesignerCanvas.vue` already calls `selectionKeyActions` itself; that is the
  precedent). If that is impossible, report NEEDS_CONTEXT.
- Tests: separator count 1; each shortcut from a Parts row; the text-input negatives; the existing
  canvas behaviour unchanged.

**Owns:** `designerMenu.ts`, `designerKeys.ts`, `parts/DesignerPartsPanel.vue`,
`parts/DesignerPartRow.vue`, and their tests.

## Task 4: Selection inspector — radius survives resize, radius slider, paired rows, folds (AD18-R17)

`DesignerSelectionInspector.vue`'s `detailFields` draws one `DesignerFieldRow` per value:
`centre-x`, `centre-y`, `sizeFields` (width, depth), `cornerFields` (corner radius, offered only when
`cornerRadiusOf(detail)` reads a rounded rectangle back from geometry) and `rotate-by`. `anchorFields`
draws `position-x` / `position-y`. The line-style `<select>` is in `DesignerDetailFields.vue`. Order
(Bring forward / Send backward) and Duplicate / Delete are action buttons below.

Requirements:
- **Radius survives resize.** A Width or Depth edit on a detail `cornerRadiusOf` reads as a rounded
  rectangle yields a rounded rectangle again, with radius `min(old radius, half the new shorter
  side)`. It is ONE undoable edit. Nothing is stored: `cornerRadiusOf` still reads the radius back,
  and `roundedRect` / `setCornerRadius` in `src/domain/asset/cornerRadius.ts` and
  `presets/presetGeometry.ts` are the builders. Find where the canvas handle-resize gesture scales a
  detail. If it shares the domain function you change, it is covered. If not, report it and do not
  widen the task. Domain tests: positive, rotated (not offered), clamped radius, a non-rounded detail
  resized as before.
- **Slider.** Beside the Corner radius number field, add an `<input type="range">` over the same
  bounds `setCornerRadius` accepts. It commits ONE edit on `change`, never one per `input` (C05:
  intermediate moves are not commands). Typing the current value creates no command (C03). Its
  accessible name satisfies label-in-name.
- **Paired rows** (board 01 panel 4): `Position X [..] Y [..]` and `Size Width [..] Depth [..]` each on
  one row. That covers the detail's centre and size pair, and the anchor's position pair. Every input
  keeps its FULL accessible name. The `.short` label-in-name test must stay green.
- **Folds**: `Appearance` (the line style) and `Order` (Bring forward / Send backward) as `<details>`,
  closed by default and leaf-local. Duplicate and Delete stay visible. Reuse the Arrange panel's
  Transform/Repeat fold pattern and its measured summary hit target, rather than a second fold style.
- Board 01's `Shape` dropdown is OUT (AD18-R17).
- CSS in `styles/designer-fields.css`, copy in `locales/{en,de}/designerSelectionLayout.ts`.

**Owns:** `inspector/DesignerSelectionInspector.vue`, `inspector/DesignerDetailFields.vue`,
`inspector/DesignerFieldRow.vue`, `inspector/DesignerFieldRowShell.vue`,
`inspector/DesignerActionButton.vue`, `inspector/DesignerActionRow.vue`,
`src/domain/asset/cornerRadius.ts`, `src/domain/asset/presets/presetGeometry.ts` (only if the builder
must change), `styles/designer-fields.css`, `styles/designer-selection.css`, the task's locale pair,
and their tests.

## Task 5: Front-direction picker and the read-only `Source & scale` block (AD18-R17)

`DesignerReferencePlacement.vue` draws `Front direction` as a sentence ("Toward the bottom of the
drawing"), then the Placement-point segment and its hint. The facing is changed only by the Set-facing
tool. `AssetShape.facing` is radians anticlockwise from +x in model space, and C04 says the
math-to-screen mapping is read from the current adapters, never from a mockup.

Requirements:
- **Front direction picker** (board 01): a dropdown offering the four drawing-relative directions
  (up, right, down, left of the drawing, in the words the existing sentence uses) plus `Custom`,
  selected whenever the facing is none of the four. Choosing a direction dispatches the EXISTING
  facing edit as one undoable edit. Choosing the current value dispatches nothing. **No degree
  figure** (AD18-R17, C04). Beside it, a small `aria-hidden` mini preview: the footprint (reuse
  `presetPreview`) with the front arrow drawn in the chosen direction, derived through the same
  model-to-screen convention the canvas uses. Test the four directions against that convention, not
  against a hand-written expectation.
- Board 02's `Show direction in plan` is OUT (a stored flag).
- **`Source & scale`** (board 01): a read-only block after the clearance review. `Source` names how
  the footprint came to be, and `Dimensions set` shows whether the footprint is measured rather than
  pending. Derive both only from facts the design DTO already carries, or from a trivial read of
  stored data. If an honest answer needs a stored field, report NEEDS_CONTEXT. `Mark as needs
  verification` is OUT. No control in the block.
- CSS in `styles/designer-placement.css`, copy in `locales/{en,de}/designerPlacementSource.ts`.
  The segmented control's CSS (`designer-add.css`) is Task 1's; do not touch it.

**Owns:** `inspector/DesignerReferencePlacement.vue`, `inspector/DesignerInspector.vue` (mounting the
new block only), new components you create, `styles/designer-placement.css`, the task's locale pair,
and their tests.

## Task 6: Canvas key — scale bar and legend row detail (AD18-R17)

Board 02 draws a `0 250 500 mm` scale bar at the canvas's bottom-left, and board 01 draws the legend
there with `Clearance (300 mm)` and `Placement point (back centre)`. `DesignerLegend.vue` is mounted in
`DesignerCanvas.vue`'s overlay beside `DesignerRulers` and `DesignerDimensions`. It is hidden in the
empty state and below the narrow container breakpoint. `legendRows.ts` fixes the board order.
`designerGrid` is the ONE step function, and its docblock counts its consumers.

Requirements:
- **Scale bar**: a new `DesignerScaleBar.vue`, rendered by `DesignerLegend.vue` (this task does NOT
  own `DesignerCanvas.vue`). It is a DOM overlay: `pointer-events: none`, `aria-hidden`, positioned
  from the live camera, and stepped by `designerGrid` so it names round lengths that match the ruler.
  The `designerGrid` consumer count in its docblock is updated in the same edit. It shows whenever a
  design exists, including at narrow widths where the legend hides. It must not overlap the legend,
  the rulers or the canvas controls. Predict its box at 1280 and 460.
- **Legend detail**: `Clearance (300 mm)` ONLY when the clearance is the footprint grown by one equal
  amount on all four sides (find whether a read-back of the four setbacks already exists before
  writing one). Otherwise it stays `Clearance`. `Placement point (back centre | centre | custom)`
  answers from the SAME predicate the Placement segment uses for its pressed state, not a copy.
- Tests: the scale bar's value at two zooms; absent in the empty state; the legend detail's equal,
  unequal and non-rectangular cases; placement detail for all three anchor states.

**Owns:** `legend/DesignerLegend.vue`, `legend/legendRows.ts`, new `legend/` files,
`grid/designerGrid.ts` (docblock only), `styles/designer-legend.css`,
`locales/{en,de}/designerLegend.ts`, and their tests.

## Task 7: Clearance — `Show clearance`, a uniform `All sides` field, and the `Advanced` fold (AD18-R17)

Board 01's Clearance section draws a `Show clearance` switch, one `Side clearance [300 mm]` field with
a link icon, and `› Advanced`. `DesignerClearanceHelper.vue` draws four empty fields (Front, Back,
Left, Right), a replace warning and `Generate clearance`. §4 row 7 and AD14-R1 bind: the numbers stay
the user's own, fields start EMPTY, and nothing generates until Generate is pressed.

Requirements:
- `Show clearance`: a switch (checkbox, default on) in the Clearance section, drawn only when the
  design HAS a clearance. It is leaf-local and not persisted (AD18-R12's reasoning), as a ref on the
  designer runtime. Off hides the clearance layer on the canvas. No `link` icon fixture exists, so no
  icon.
- `All sides` (the uniform control): one field whose value fills all four side drafts. The four
  per-side fields move into an `Advanced` `<details>`, closed by default. Editing one side after
  using All sides leaves All sides blank (mixed). `Generate clearance` behaves exactly as today.
- Leave a note in your report naming the runtime ref, because Task 8 reads it to hide the clearance
  dimension labels.
- Tests: the switch hides and shows the layer; All sides fills four; the mixed state; the fold is
  closed by default; Generate unchanged; nothing is pre-filled.

**Owns:** `inspector/DesignerClearanceHelper.vue`, `runtime.ts`, `DesignerCanvas.vue` (clearance
visibility only), `layers/clearanceLayer.ts`, `styles/designer-clearance.css`,
`locales/{en,de}/designerClearanceHelper.ts`, and their tests.

## Task 8: Dimension lines with arrows and extension lines; the resting floor at narrow widths (AD18-R17)

Board 01 draws each dimension as a line with arrowheads and extension lines, labelled `800 mm`.
`DesignerDimensions.vue` draws each value as a boxed number button over the canvas
(`dimensionFigures.ts` computes them, with AD18-R14's collision rule). **Measured at a 460 leaf with
`&select=detail-2`: the RESTING labels overlap in 5 pairs** (`360/126`, `360/800`, `270/220`,
`220/450`, `126/800`), against AD18-R14's floor that the resting state stays at ZERO. That floor was
only ever measured at 1280.

Requirements:
- Each drawn dimension gets a line with an arrowhead at both ends and extension lines to the edges it
  measures, in the same DOM overlay (AD18-R11: no Konva, `pointer-events: none` on the decoration so
  the label buttons still take presses). Colours come from host variables. Labels carry the unit
  (`800 mm`) while staying the same inline-edit buttons.
- Every number still reads the PREVIEW (`preview ?? committed shape`), per AD18-R11's binding.
- Resting-state floor: zero overlapping label pairs at the fit camera at 1280, 760, 580 and 460 leaves,
  with `&select=detail-2` and with nothing selected. `All dimensions` keeps AD18-R14's floor of zero
  unclickable labels at the fit camera at 1280.
- When Task 7's `Show clearance` ref is off, the clearance dimensions are not drawn.
- **Routed from Task 6's review:** resting `.rp-designer-dimension` buttons are `z-index: auto` and the
  canvas key (legend and scale bar, bottom-left, opaque, `pointer-events: none`) is drawn after them in the
  overlay, so at a non-fit camera the key paints over a dimension button: an invisible click target and an
  obscured focus (WCAG 2.4.11). Resting labels must paint above the key; an open inline form stays above
  both. Verify at a zoom that puts a label in the bottom-left corner.
- Predict the four resting overlap counts in your report. The integrator measures them.

**Owns:** `dimensions/DesignerDimensions.vue`, `dimensions/dimensionFigures.ts`, new `dimensions/`
files, `styles/designer-dimensions.css`, `locales/{en,de}/assetDimensionsOnCanvas.ts`, and their tests.

## Task 9: Relative save time on both surfaces (AD18-R19)

`src/presentation/editor/save-state/SaveStateIndicator.vue` is shared by the Plan Editor's status bar
and the designer's header. It draws `Saved`, `Saving`, `Unsaved changes`, `Save error`, plus the
derived `Saved · refresh needed`. Board 02 reads `Saved just now`.

Requirements:
- After a save in this session, `saved` reads `Saved just now` for the first minute, then
  `Saved N min ago`, then `Saved at HH:MM` (locale time) after an hour. With no save this session it
  stays `Saved`, because the time of an earlier save is not known.
- The saved-at time lives in the save-state store beside `state`. The indicator re-renders on a
  minute tick that it cleans up on unmount. The clock is injectable, so tests never sleep.
- `Saved · refresh needed` keeps precedence (C08).
- **A minute tick must not be announced.** Read the indicator's role and live-region semantics
  first, and keep the relative text out of any live announcement if the region is live.
- Both surfaces; the Plan Editor's status-bar tests are updated where they pinned `Saved`.

**Owns:** `editor/save-state/SaveStateIndicator.vue`, `editor/save-state/save-state-store.ts`,
`editor/save-state/save-state.ts`, `styles/editor-status.css`,
`locales/{en,de}/saveStateRelative.ts`, and their tests.

## Task 10: Asset Library Grid view (AD18-R18)

The library (`src/presentation/library/`, authority
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md`) draws shelves of price rows.
Board 01's right-hand column draws a category sidebar with icons, thumbnail tiles with sizes, a
`Create your own` card and a filter button. AD18-R18 rules a Grid view BESIDE the unchanged List.

Requirements:
- A `Grid | List` toggle in the library toolbar. **List is the default and is unchanged**: every
  existing list test stays green untouched.
- Grid: one tile per asset, with the existing `AssetMark` at tile size, the name and the measured
  size in the same wording the row uses. Selecting a tile drives the SAME selection and inspector a
  row does. Keyboard: the same model the shelves use (`shelfFocus.ts`), adapted to two dimensions.
  Do not invent a second focus model.
- A category sidebar: `All` plus the categories the vault actually has (open vocabulary, spec §1a).
  Each carries an icon: `grid-2x2` All, `layers` material, `armchair` furniture, `bath` fixture,
  `sprout` plant, `hammer` equipment, `brick-wall` building element, `pencil` custom, `tag` anything
  else. It FILTERS the shelves in BOTH views and manages nothing (§10).
- The `funnel` filter button toggles that sidebar (leaf-local).
- A `Create your own` card at the end of the grid, calling the existing `New asset` door.
- The chosen view and the category filter live in Obsidian's view state per spec §6.3, and a change
  to either is NOT a navigation (`result.history` stays false).
- §10's anti-goals stand: no sort control, no totals, no bulk edit, no placement. Narrow behaviour
  follows spec §7.
- Do NOT edit `tests/harness/page.ts` or `scripts/harness-shot.mjs` (Task 11 owns them).

**Owns:** `src/presentation/library/**`, `styles/asset-library*.css`,
`locales/en-assetLibrary.ts`, `locales/de-assetLibrary.ts`, and their tests.

## Task 11: Harness knobs — the designer's `stale` state and the library's Grid view

`tests/harness/page.ts` passes `stale` to the PLAN EDITOR only, so the designer's AD18-R13/R15
Try-again retry has no capture. AD18-R15 measured it through an injected probe. Task 10's Grid view
also has no URL.

Requirements:
- `?view=asset-designer&preset=…&stale` puts the leaf into the designer store's REAL stale state,
  through its own API (a re-read that fails non-authoritatively while content is on screen), so the
  notice and `Try again` render. Do not edit `src/` to do it. If that is impossible, report
  NEEDS_CONTEXT.
- `?view=asset-library&layout=grid` (or the name Task 10's view state uses) opens the Grid view.
- `harness-shot` gains the fixed shots for both, in both schemes. `tests/gates/harness-shot.test.ts`
  pins the table in both directions.

**Owns:** `tests/harness/page.ts`, `tests/harness/assetDesigner.ts`, `tests/harness/assetLibrary*.ts`,
`scripts/harness-shot.mjs`, `tests/gates/harness-shot.test.ts`, and the harness tests for those knobs.

## Task 12: Manual-pass steps for the second parity round

The integrator dispatches this after the whole-round review's fixes land. Add steps to the relevant
cases under `docs/tests/cases/` for every new user-visible behaviour above, in the house format.
Rewrite every existing step this round makes false. For example: toolbar labels, `Saved` wording,
the Clearance helper's layout, the menu's separator count, the Placement row, the legend, and the
dimension labels. Re-derive the step count with the command `MANUAL-PASS.md` prints, and update its
index. A reviewer checks every expectation against source.

**Owns:** `docs/tests/cases/**`, `docs/tasks/asset-designer-expansion/reports/MANUAL-PASS.md`.

## Task 13: RESUME.md for the manual-walk session

The integrator rewrites `reports/RESUME.md` for the next session, whose job is the manual vault walk:
what shipped, where the steps are, what stays ruled out, and what is still open.

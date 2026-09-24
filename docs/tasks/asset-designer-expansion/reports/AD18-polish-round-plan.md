# AD18 polish round — plan (session seventeen, 2026-09-24)

**Authority: rulings AD18-R20 and AD18-R21** in `contracts/DECISIONS.md`. The session began with a
user-reported bug: grouping from the right-click menu did nothing, in a real vault. It was root-caused
and fixed as AD18-R20 in b261b1866 and 22c1319eb. A polish audit of the running harness at 1280, 760,
580 and 460 px in both schemes followed, then one batched ruling round. AD18-R20's remaining defects and
AD18-R21's nine approved items are the tasks below. If a task would contradict an earlier ruling
(AD18-R1…R19, AD14-R1, AD12-R1, AD11, AD08-R1, C01–C12) or would need a stored field, STOP and report
NEEDS_CONTEXT rather than choosing.

**Tasks run one at a time, in order.** No two tasks own the same file.

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
  new stored field (AD18-R17, AD18-R21).
- **400-line cap**, and an SFC's `<template>` comments COUNT against it. Near the cap: `AssetDesignerRoot.vue`
  (~395 counted; Task 2 may change one condition and add no line), `styles/designer.css` (400),
  `styles/designer-selection.css` (399), and `en.ts`/`de.ts` (owned by NO task). `tests/**` has a 450-line
  cap: split a suite into a sibling file rather than trimming it.
- Every `.vue` under `src/presentation/designer/` must stay reachable by import from
  `AssetDesignerView.ts` (`tests/presentation/designer/regionsReachable.test.ts`), and `npm run analyze`
  (fallow) fails on an unused export or file.
- Icons go through `HostIcon.vue`. Harness fixtures live in `tests/fixtures/editor-icons/` (list the
  directory); this round added `focus`, `arrow-up` and `arrow-down`. Downloading any other icon needs the
  user's approval: report NEEDS_CONTEXT rather than fetching.
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
- Do not touch `docs/tests/cases/`, `MANUAL-PASS.md` or `RESUME.md` (Task 10, Task 11 and the
  integrator own them). Do not push. Commit on the current branch with a message ending
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- You have no browser. Anything about LAYOUT (wrapping, widths, overlap, visibility) is a
  prediction. Write it in your report as a number you could be wrong about. The integrator measures
  it in the harness after your task, and last round the integrator's measurements overturned a card's premise four
  times while every gate was green.
- Use typographic-dash-safe edits. For a multi-line splice, write a script to a file and splice on a
  content anchor, never on a line number.

- **Reviews last round caught a card's TESTS testing the wrong thing twice**: a sweep over anchors the
  component no longer produced, and a focus assertion that could not fail. For every test you add, say
  in the report how you saw it fail.
- **`only`, `cannot`, `never` and `exactly` in docblocks went false repeatedly.** Grep your diff for them
  and check each one against the code.

## Task 1: Deduplicate the designer test helpers `handed()` and `VAULT_FAILED` (AD18-R20)

Two test helpers are byte-identical copies in several `*.test.ts` files, and fallow's duplicate scan
reads no test file (CLAUDE.md, the analyze step). `rightClick` already moved to
`tests/helpers/designerRightClick.ts` in b261b1866; follow that precedent.

- `handed()`: in `tests/presentation/designer/designerCornerRadius.test.ts` and
  `tests/presentation/designer/designerSelectionInspector.test.ts`.
- `VAULT_FAILED` (`category: 'Persistence'`, `code: 'vault.unexpected-failure'`, message `the vault
  could not be read`): in `designerStaleRetry.test.ts`, `designerRefresh.test.ts`,
  `designerSaveStateStale.test.ts` and `assetDesignStoreSelection.test.ts`.
- **Leave `designerUsageScope.test.ts`'s own `VAULT_FAILED` alone.** It has a different message and
  type, and is a different fixture.
- Verify every copy is byte-identical before moving it. A copy that differs is not a duplicate: report
  it rather than merging it.

Requirements: one definition each in `tests/helpers/assetDesign.ts`, the existing designer-DTO fixture
home, with each call site importing it. No behaviour change: the six files pass before and after.

**Owns:** `tests/helpers/assetDesign.ts` (this task only, exempt from the READ-ONLY helper rule) and the
six test files named above. Model: Sonnet.

## Task 2: The designer rests in Select; clearance re-shows on every birth; `setTool` asks the active tool (AD18-R20)

**Measured by the integrator:** the designer opens with `EditorStore.activeToolId === null`, drawn as
the toolbar's pressed Pan. Nothing under `src/presentation/designer/` sets a tool at mount. A canvas
click then pans instead of selecting, handles are not drawn, and arrows do not nudge.
IMPLEMENTATION-PLAN's "Selection is the resting tool" and C12 bind this, and so does the user's ruling
in AD18-R20.

Requirements:
- **A designer leaf opens with Select active**, and the toolbar shows Select pressed. Find the right
  place for this: the runtime, once its tools are registered and the tool manager can activate one.
  Do not activate a tool before the context it needs exists. If that means waiting for first ready,
  say so in the report. Plan Editor code (`src/presentation/editor/**`) is untouched.
- **The empty state still draws under Select.** Today `emptyStateKey` in `AssetDesignerRoot.vue`
  returns `null` whenever `activeToolId !== null`. Admit Select, as `PlanEditorRoot.vue` already does
  (`tool !== null && tool !== 'select'`). This is the ONE edit allowed in `AssetDesignerRoot.vue`, which
  is near its 400-line cap: a condition change with no added lines.
- **Camera mode keeps the selection keys** (b261b1866). Only the premise changes: the docblock of
  `selectionKeysRefused` in `designerKeys.ts` says camera mode "is the mode the designer OPENS in",
  which becomes false. Rewrite that sentence and nothing else in that file.
- **A clearance re-shows on EVERY birth.** Today `showClearance` goes back to `true` through three
  doors: arming `trace-clearance`, a preset apply, and Generate. So a clearance that comes back
  through redo, an undo of its removal or an external refresh comes back hidden while the switch is
  off. Re-show whenever a read-back takes the design's clearance from absent to present. Say in the
  report whether the three existing doors are now redundant, and keep any that still covers a moment
  the read-back does not, such as arming the trace before anything exists.
- **`setTool`'s clearance-revealing wrapper asks the tool that BECAME active**, not the requested id.
  `clearanceRevealingSwitch` in `runtime.ts` checks `id === 'trace-clearance'` today, while
  `ToolManager.setActiveTool` can no-op through `canDeactivate`. No designer tool implements that
  today, so a test needs a stub tool that refuses to deactivate.
- Tests: the leaf opens in Select, and a canvas click selects. The empty state draws for a shapeless
  asset under Select. Redo of a traced clearance, undo of a removal, and an external refresh (the
  rigs' peer write) each re-show a clearance that was hidden. The wrapper does not reveal when the
  switch is refused.
- **Tests that assume `null` at rest must change**, and a test that asserted the old default must be
  rewritten, not deleted. `tests/presentation/designer/designerGroupFromRest.test.ts`'s `atRest`
  asserts `null`: make it select Pan explicitly so the camera-mode cases keep testing camera mode, and
  add ONE case there showing the same Group works at the new rest. Any other test you change is
  listed in your report with the reason.

**Owns:** `src/presentation/designer/runtime.ts`, `src/presentation/designer/designerKeys.ts` (that
docblock only), the one condition in `src/presentation/designer/AssetDesignerRoot.vue`, and tests
(new files preferred; existing designer tests only where they assume a `null` rest). Model: **Opus**
(keyboard and pointer modes, the write path's read-back).

## Task 3: A hidden but selected clearance draws no outline or handles, and cannot be dragged (AD18-R20)

Today, with `Show clearance` off and the clearance selected (selected through the Parts row):
- `DesignerCanvas.vue` still draws its selection outline and handles. The `asset-selection` layer is
  not bound to `showClearance`, unlike the `asset-clearance` layer.
- `selection/hitTest.ts`'s `nearestHandle` runs BEFORE the `clearanceHidden` check, so a handle drag
  still resizes it.

Requirements: while the clearance is hidden, it draws no selection outline and no handles, and no
press hits a handle of it. The selection itself is kept (the Parts row stays pressed and the
Inspector stays on it), so switching `Show clearance` back on shows the handles again. Other parts'
handles are unaffected. Tests for all three; watch each fail against an in-place revert.

**Owns:** `src/presentation/designer/selection/hitTest.ts`, `src/presentation/designer/DesignerCanvas.vue`
and tests. Model: **Opus** (Konva, pointer).

## Task 4: A canvas HANDLE resize keeps a rounded rectangle's radius (AD18-R21)

AD18-R17 made a typed Width/Depth edit keep a detected rounded rectangle's radius, rebuilt through
`roundedRect` with the radius clamped (`src/domain/asset/cornerRadius.ts`, used by the Inspector and
the canvas dimension labels through `selection/partExtent.ts`). A box-handle drag
(`selection/selectionDrag.ts` `draggedShape`, reached from `tools/designer-select-tool.ts`) previews
and commits a non-uniform scale instead, and the corners stop being circular.

Requirements:
- A box-handle resize of a detected rounded rectangle, in its PREVIEW and in its COMMIT, is the
  rounded rectangle of the new box with the radius clamped by the same rule typed edits use. Find
  that rule and REUSE it; do not write a second one.
- Other shapes, other handles (rotate, vertex, edge) and a Shift-proportional resize behave as today.
  A rotated rounded rectangle: find what the typed-edit path does with rotation and do the same; if it
  refuses, refuse the same way.
- One undo entry per drag, as today.
- Tests: the committed shape's `cornerRadiusOf` equals the old radius (and the clamped value when the
  box gets too small); the preview matches the commit; a plain rectangle and a circle are unchanged.
  Put these in a NEW test file. Task 1 owns the two existing corner-radius test files.

**Owns:** `src/presentation/designer/selection/selectionDrag.ts`,
`src/presentation/designer/tools/designer-select-tool.ts` (only if the preview path needs it),
`src/domain/asset/cornerRadius.ts` (only to EXPORT an existing rule, never to change it), and new tests.
Model: **Opus** (geometry, Konva).

## Task 5: Fewer resting labels while the drawing is small on screen (AD18-R21)

**Measured by the integrator** (vanity preset, fit camera): the footprint draws about 470 px across
at a 1280 leaf, 285 at 760, 190 at 580 and 170 at 460. At 580 and 460, the resting DETAIL dimension
labels (the 270/220/126/54 mm figures) nearly cover the drawing, though none overlap another label.

Requirements:
- While the footprint's on-screen width is below 240 px, the RESTING labels are the overall width
  and depth only. Zooming in past the threshold brings the rest back. `All dimensions` (AD18-R12)
  still shows every label at any size.
- AD18-R14's resting floor (zero overlapping resting labels) still holds at 1280, 760, 580 and 460.
- Name the threshold as a constant next to the other placement rules. Its docblock carries the four
  measurements above and says they are a dated snapshot of the vanity preset.
- Tests: below the threshold only the overall pair rests, and above it the detail labels rest.
  `All dimensions` is unaffected. Update any resting-label test at 460 whose expectation this
  changes, and list each such test in the report.

**Owns:** `src/presentation/designer/dimensions/dimensionFigures.ts`,
`src/presentation/designer/dimensions/DesignerDimensions.vue` and their tests. Model: **Opus**
(on-canvas geometry).

## Task 6: Designer CSS polish: canvas focus ring, styled selects, focus rings, 24 px checkbox rows, equal Add tiles (AD18-R20/R21)

**Measured by the integrator** at a 1280 leaf, with Tab presses in real Chromium:
- The designer canvas (`.rp-plan-canvas`, `tabindex="0"`) shows NO focus indicator. The five designer
  `<select>`s and the designer's checkboxes have none either, because Obsidian's global
  `:focus { outline: none }` removes it and nothing puts it back.
- The selects draw the browser default (a 1 px black border, 19 px tall). The checkboxes are 13 px
  boxes in 19 px label rows: `Select multiple parts` (`.rp-designer-multi-select`), `Show clearance`
  (`.rp-designer-clearance-toggle`), and the four View-menu toggles (`.rp-view-menu__content`).
- The Add-rail shape tiles are 73 px tall in row 1 (two-line `Rounded rectangle`) and 58 px in row 2.

Requirements:
- A `:focus-visible` ring on the DESIGNER canvas only. The Plan Editor's canvas is not touched: scope
  every rule under the designer's root class. Use a 2px `var(--interactive-accent)` ring, inset so the
  leaf does not clip it.
- The designer's `select` elements are styled with host variables so they read like the designer's
  own inputs (border, radius, height, background, text), each with a `:focus-visible` ring. Do not add
  a class to any `.vue` file: select them through the designer root. Checkboxes in the designer get a
  `:focus-visible` ring.
- The label rows of the checkboxes named above are at least 24 px tall; the box itself is unchanged.
- Every Add-rail shape tile is the same height (the tallest).
- Tests: the rules exist in the assembled sheet, the ring rules are scoped away from the Plan Editor,
  and `buttonFocusRing.test.ts`-style checks still pass. The integrator measures the rest.

**Owns:** `styles/designer-polish.css` (pre-created, empty, imported by the integrator),
`styles/designer-add.css` (shape-tile rules only) and their tests. Model: Sonnet.

## Task 7: A selected Parts row's controls as one row of icon buttons (AD18-R21)

Today `DesignerPartControls.vue` draws five text buttons (Hide/Show, Lock/Unlock, Isolate, Bring
forward, Send backward) under the Label field. They wrap onto 2 to 4 ragged lines at 1280 and 580.

Requirements:
- ONE row of icon-only buttons through `HostIcon.vue`: `eye`/`eye-off` (Hide/Show), `lock`/`lock-open`
  (Lock/Unlock), `focus` (Isolate), `arrow-up` (Bring forward), `arrow-down` (Send backward). The
  fixtures `focus`, `arrow-up` and `arrow-down` were added in the setup commit. For each toggle, pick
  the icon so it shows the ACTION the button takes, and say which in the report.
- Each button's accessible name and tooltip is its existing label key (`aria-label`; Obsidian's
  tooltip reads `aria-label` only). The text leaves the button face. Accessible names are unchanged,
  so name-based lookups keep working: grep `tests/` and `scripts/` for them anyway.
- The disabled states (Bring forward on the topmost, Send backward on the bottom) keep working, with
  `aria-pressed` where a toggle has state if the house pattern uses it (find the precedent).
- Each button is at least 24 × 24 px. The row does not wrap in the 159 px Parts rail at 1280, or at
  580 and 460.
- Tests: five buttons, each with its accessible name and icon; the toggles swap icon and name; the
  disabled states hold.

**Owns:** `src/presentation/designer/parts/DesignerPartControls.vue`, `styles/designer-parts.css`
(part-control rules only) and tests. Model: Sonnet.

## Task 8: Library Grid: left-aligned tile names, and a category placeholder on design-less tiles (AD18-R20/R21)

**Measured by the integrator** (`?view=asset-library&layout=grid`, 1280 light):
- A one-line tile name is CENTRED and a two-line one is left-aligned. The cause is Obsidian's
  `button`, which centres its flex children (`align-items: center`), so a one-line name shrinks to fit
  and centres, while a two-line name fills the width and shows `text-align: start`. Board 01
  left-aligns every tile name and size.
- 6 of 17 fixture tiles (the assets with no design: Boxwood hedge, Floor sander, Mineral wool, Site
  management, Tall cabinet, Wall paint) draw an empty box with a floating name.

Requirements:
- Every tile's name and size are left-aligned, and the mark stays centred.
- A tile whose asset has no mark draws its CATEGORY icon where the mark goes: muted, at mark size,
  and `aria-hidden`. Use the same icon the category sidebar draws for that category, through the same
  lookup, not a second table. Nothing is stored.
- Tests: a design-less tile draws its category's icon, and a tile with a design draws its mark and no
  icon. The alignment rule exists.

**Owns:** `src/presentation/library/AssetTile.vue`, `styles/asset-library-grid.css` (tile rules only)
and tests. Model: Sonnet.

## Task 9: A save from an earlier day says which day (AD18-R21 over AD18-R19)

`SaveStateIndicator.vue` shows `Saved just now`, then `Saved N min ago`, then `Saved at HH:MM`. The
last has no date, so after midnight it reads as today. The indicator is shared by the Plan Editor's
status bar and the designer's header (AD18-R19), so both change together.

Requirements:
- A save from an earlier CALENDAR day (local time) reads `Saved {date} at {time}` (EN) and
  `Am {date} um {time} gespeichert` (DE). `{date}` is `Intl.DateTimeFormat` with
  `{ month: 'short', day: 'numeric' }` in the current language, and `{time}` is the same short time
  as today. A same-day save older than an hour stays `Saved at HH:MM`.
- The minute tick must also catch the midnight crossing: an indicator left open across midnight moves
  to the dated form without a new save.
- The screen reader still hears `Saved` only (the visually-hidden word); nothing new is announced.
- Keys go in the existing `saveStateRelative` locale modules, EN and DE.
- Tests with fake timers: same day over an hour, yesterday, several days ago, and an open indicator
  crossing midnight.

**Owns:** `src/presentation/editor/save-state/SaveStateIndicator.vue`,
`src/presentation/i18n/locales/en/saveStateRelative.ts`,
`src/presentation/i18n/locales/de/saveStateRelative.ts` and tests. Model: Sonnet.

## Task 10: Manual-pass steps for this round

Everything this round ships gets a manual step in the right case under `docs/tests/cases/`, including:
- a successful Group from EVERY door, at the new resting Select AND with Pan chosen (the Arrange
  panel's Group button, the right-click menu on the canvas and on a Parts row, Ctrl+G on the canvas
  and on a selected Parts row);
- building a set from the Parts rows with Shift and with `Select multiple parts`;
- Obsidian's own Ctrl+G (graph view) against the designer's Group key, recorded as observed, since no
  gate here can see it;
- group focus after a Group from a Parts row.

Rewrite every existing step this round makes false (the resting tool, Pan-only assumptions, the text
part controls, the handle-resize radius loss that was listed as known behaviour, the undated
`Saved at`, the hidden-clearance outline, the clearance returning hidden). Re-derive
`MANUAL-PASS.md`'s count with the command it prints. An independent reviewer checks every expectation
against source.

**Owns:** `docs/tests/cases/*.md`, `reports/MANUAL-PASS.md`. Model: Sonnet (reviewer: Sonnet).

## Task 11: RESUME.md for the manual-walk session

Rewrite `reports/RESUME.md` wholesale for the next session, which is the manual vault walk: state,
the last green sha and run id, what this round shipped, known behaviour, what only the walk can
settle, and what is still open. **Owns:** `reports/RESUME.md`. The integrator writes it.

## Task 12: Delivery note

A `Delivered` paragraph under AD18-R20 and AD18-R21 in `contracts/DECISIONS.md`, and an evidence line in
`execution/state.json`, in the same edit. **Owns:** those two files. The integrator writes it.

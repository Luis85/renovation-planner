# W24-A — the deferred manual pass, automated wherever a driven Obsidian can settle it

**Date:** 2026-09-25. **Instrument:** `npm run test:e2e`, Obsidian 1.13.7, Windows 11, `--lang=en`.
**Builds on** W23-A (`W23-A-e2e-real-host.md`), which drove about forty of
[[MANUAL-PASS]]'s 241 human steps; this round takes every remaining `obsidian`/`desktop` step a
driven host can settle, across all seven cases that file counts.

## What landed

**106 new cases in 22 new files**, each naming the manual step it discharges, and one
**Automated in Obsidian** clause table per case file — one row per CLAUSE, cited by case name,
with every clause no instrument here can settle written as a `none —` residue rather than left out.

| Manual case | New files | Cases |
| --- | --- | --- |
| Design an Asset | `assetDesignerBasics`, `…BasicsPlan`, `…Dimensions`, `…DimensionsRulers`, `…Parity`, `…ParityMenu`, `…ParityRadius`, `…Followups`, `…FollowupsHistory`, `…FollowupsLanding` | 64 |
| Compose an asset from parts | `composeParts`, `composeGroupDoors` | 10 |
| Browse the asset library | `assetLibrary`, `assetLibraryNarrow`, `assetLibraryState` | 13 |
| Calibrate a sheet and reserve space | `calibrateClearance`, `calibrateClearanceSwitch` | 9 |
| Recover an asset design rather than lose it | `assetDesignerRecoveryMore` | 4 |
| Take an asset from the library into a plan | `assetHandoffMore` | 4 (1 mobile) |
| Two designers on one asset | `twoDesignersMore` | 2 |

Helper modules, one per area: `designerCanvas.ts` (Konva shape boxes, dimension labels, the View
menu, `newDesign`), `designerParity.ts`, `designerFollowups.ts`, `compose.ts`, `library.ts`,
`clearance.ts`, `recovery.ts`. `canvasPoint` moved into `designer.ts`, and the Konva readers of the
parity and follow-up pages go through `designerCanvas`'s `shapeBoxes`, so `fallow dupes` is clean.
`designer.ts`'s `press`/`release`/`drag` are GONE: nothing called them, and `release()` was a
second action chain, whose pointer starts at (0, 0) — a drag through it committed a part thousands
of pixels away.

## The mutation gate

Every new case was run against a one-clause mutation of `src/` or `styles/`, and counted only when
it failed on an assertion of its OWN clause; `src/` and `styles/` were restored after each build
(`git diff --stat src styles` empty). Batches were grouped so no mutation could fail another's case
at a prerequisite; where one did, the case was re-run alone. **Six cases do not go red, and each is
said so in its table rather than counted** — the four below, and Library 31 and Take 10 under the
last bullet of the list that follows:

- **Design an Asset 71b** stays green with the resting label's `z-index: 1` removed: at this
  geometry the label already paints above the key, so the fix is unguarded here.
- **Design an Asset 107**'s "not a plain stretch" clause: a plain stretch lands the same final
  extent as the typed solve, so comparing the two cannot fail. 110 and 111 carry the property for
  the clearance.
- **Design an Asset 105**'s click case and **Two designers step 1** pin the HOST (`:focus-visible`,
  Obsidian's split gestures); no `src/` change reaches either, and step 1's one plugin-side lever,
  `getState`, breaks every designer open rather than the clause.

Mutations, by case (one line each; the case's own table names its clause):

- **Compose.** `drawnPart` ignores `hidden`; the Inspector's Duplicate disabled; `DesignerRulers`
  given the raw selection; `partView`'s hidden set hoisted to module scope; the sidecar reader drops
  `groups`; a Parts row always replaces the selection; the runtime rests in no tool; `runAndRefocus`
  closes with `close(false)`; the menu's `dragState` check dropped; Group's `every(drawn)` dropped.
- **Calibrate.** The Sheet row drops the page; `editDimensions` loses `unscaled ||`; the clearance
  read-back watch loses `showClearance.value = true`; pending lines empty with no background (red one
  level up: the block withdraws with them); the Custom segment's click does nothing; Source's
  typed/traced labels swapped; the Custom tile's padding and font reverted (15c); the clearance
  layer always visible; `drawnSelection` loses its clearance line.
- **Two designers 15.** The geometry store's revision jumps by two after the first write.
- **Design an Asset 1–52.** Info notices last 20 s; the recalibrate confirm loses `danger`; the new
  asset's width and depth swapped; `.rp-designer-tools` does not wrap; the opening `fitTo` skipped;
  the designer `select` rule unmatched; the select tool never holds a gesture behind a write;
  `DUPLICATE_OFFSET_MM` 50; `.rp-canvas-grid` at `z-index: -1`; `editDimensions` always retypes;
  a promoted item's footprint offset 10 mm from its centre; the designer's View slot keyed as the
  Plan Editor's.
- **Design an Asset 53–71a.** The rulers draw nothing; top ruler labels 25 px off; the ruler band
  reads the committed shape, not the preview; the vanity's default width 820; dimension arrows
  empty; `gapOf` absolute; the field neither focused nor selected; `unchanged` strict, then always
  false; `trace-footprint` counted as measuring; All dimensions forced off; figures drawn over an
  unscaled design; `outsideAnchor` returns its anchor; the figures read the committed shape;
  `separateLabels` bypassed.
- **Design an Asset 72–104.** Forty-two mutations, recorded by that round's author — the icon, the
  clipped label, the grid columns, the zoom factor, `fitDesign`, the legend's rows and toggle, the
  save clock, the menu's structure and doors, the chord map, the slider's commit, the radius rules.
- **Design an Asset 105–129.** The ring's ruler inset reverted; `grid-auto-rows: auto`; `keptCurves`
  answers `null`; `RESTING_DETAIL_MIN_PX` 0; `separateLabels`' overall fallback dropped; Ctrl+Shift+Z
  unmapped; `EDITING` loses the Height field, the range slider and `select`; the history gate ignores
  `gestureInFlight`; `arcArc` skips its corner-relative frame; `MISS_MM` at `Infinity` and at `-1`;
  the history shortcut only from inside the canvas; the draft counted as a gesture; the Height
  field's `@blur` commit removed.
- **Library, Recover, Take into a plan.** Recorded by their authors in their own tables' sections:
  each case red on its own clause, except Take step 10 (holds by construction, no plan port) and
  Library step 31 (the host records no leaf history, so it cannot fail today).

## Findings

Each is pinned as measured, in its case's Runs row, so the day the product changes either way is a
red case. **The ruling on every one is the author's.** The five that change what a user can do:

1. **Ctrl+G never groups in a default vault.** Obsidian's `graph:open` (Mod+G) takes the chord at
   window capture, before the designer, from the canvas, a Parts row and the Label field; only
   after unbinding it does grouping work. Ctrl+D is Obsidian's `editor:delete-paragraph` the same
   way. (Compose 43/49/51, Design 90a/90b/95–96a.)
2. **Edit dimensions on a traced, uncalibrated asset replaces its outline** with a typed rectangle
   and leaves the clearance in sheet pixels, pending and hidden. (Calibrate 36a.)
3. **Library view state is lost** — publishing it never makes Obsidian save the layout, and a
   closed-and-reopened library forgets Grid and the category. (Browse 16, 30.)
4. **Leaving the Height field by a click swallows the next Ctrl+Z**, because its `@blur` commits
   the unchanged value as an invisible history step — confirmed by removing the handler. (Design 117.)
5. **One trace point placed does not block Ctrl+Z**, which undoes the previous edit. (Design 120.)

Rows a walker would have failed against a passing build, now corrected in their tables: Compose
7c and 48, Browse 22/24/27, Calibrate 12's precondition, Design 102 (the asset's Edit dimensions
drops the Corner radius row), Design 105 (a click draws no ring).

## Not automated

Every `judgement` row; every screen-reader clause; Electron's native menu (Design 92) and the
ContextMenu key (97); Obsidian's tab drag-and-drop (Two designers 1); a wall or room drawn in the Plan
Editor (Design 27); Take 6's pre-scan window (unreachable through a plugin load); every `browser`- and
`suite`-tier row, which other instruments own.

## What the instrument taught

- **`setWindowSize` is refused by Obsidian's chromedriver.** A leaf is sized through
  `require('@electron/remote').getCurrentWindow().setSize` or `app.workspace.leftSplit.setSize`.
- **Obsidian's default window is 1024 × 800**, a 679px designer leaf. Several rows assume a wider
  one; the cases size the leaf where a row names a width.
- **Focus is a shared resource.** Seven Obsidians on one desktop steal window focus from each other,
  and a held drag behind a pending write is dropped when its window loses focus (Design 32b). The
  sharded full run on a quiet machine saw it once more, in Design 85a's held drag (red once, green
  twice alone) — a condition of the machine, which is why that case is not re-written around it.
- **W23-A's first finding does not hold as a fixed fact.** On a quiet machine with the window
  focused, the host reconciled an external `.rpgeo` write within 5 s in four runs of four, which
  turned W23-A's "no notice for 5 s" pin red every time. The case now takes the host's reconcile
  when it comes and makes the watcher's call by hand when it does not (Recover step 8's row).
- **Under load a draw-tool drag can draw nothing**, and a vitest worker has exited at start with
  `3221226505` (a Windows fast-fail) four times, on four different files; a lone re-run passed
  every time. `designerParity`'s `drawBox` retries, and `compose.ts` waits for the tool to read
  pressed before dragging.

## The final run

The whole of `tests/e2e/` on this branch, Windows 11, Obsidian 1.13.7, in four shards on a quiet
machine (a full run does not fit one ten-minute command): **144 cases — 140 passed and 4 skipped
(mobile-only) on the desktop leg**, after one re-run each for Design 85a (the focus drop above) and
for the two files whose worker exited at start; W23-A's Recover case was re-written as described
above and then passed. The mobile-emulation leg: 8 passed, 136 skipped.

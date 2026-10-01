# AD18 walk automation round 2 — plan (session twenty-one, 2026-09-27)

**Authority: rulings AD18-R30 to AD18-R33** in `contracts/DECISIONS.md`, taken on the second clause audit
in [`MANUAL-PASS-audit-2.md`](MANUAL-PASS-audit-2.md). Its per-case tables, the instrument probe and the
review are in `.superpowers/sdd/audit2/` (gitignored, in this worktree): `design.md`, `others.md`
(reviewer-corrected, changed rows marked `[R]`), `probe.md` (the measured calls, with the probe's final
source at its end) and `review.md`. **Every task re-reads its clauses there before writing a test**, and
treats them as claims. If a task would contradict an earlier ruling or need a stored field, STOP and report
NEEDS_CONTEXT.

**What the rulings build:** ranks 1–15 of the audit's ranked build list. Ranks 16–18 are not built: Recover
6/8's host timing stays a recorded measurement (AD18-R33) and there is no macOS E2E leg (AD18-R31).
**Design 88b's AX-tree clause DISCHARGES; every other proxy is a GUARD** (AD18-R30): a guard is a real test
that must pass the mutation gate, but its step keeps its human tier because the "reads as" judgement stays.

## Global constraints (every task)

Everything in [`AD18-walk-automation-plan.md`](AD18-walk-automation-plan.md)'s *Global constraints* binds
here too (and, through it, [`AD18-followup-round-2-plan.md`](AD18-followup-round-2-plan.md)'s). Read both
sections first; they are not repeated. Substitute `.superpowers/sdd/audit2/` for `.superpowers/sdd/audit/`.
In addition:

- **Locks.** An e2e build compiles `src/`, so a neighbour's temporary mutation lands in it. Before a
  mutation take `.superpowers/sdd/mutation.lock`; before an e2e run take `.superpowers/sdd/e2e.lock`. Take
  a lock only if it is absent (write your task number into it); wait with ONE bounded command
  (`timeout 1200 bash -c 'until [ ! -f <lock> ]; do sleep 20; done'`), never a background loop; remove it
  when done. `git status --short src styles` must print nothing before every e2e build.
- **Thresholds are relations or published floors, never a number measured on this machine.** Contrast:
  WCAG 2.x, 4.5:1 for text and 3:1 for non-text graphics, via `contrastOf` in `tests/e2e/designerParity.ts`
  (read-only import) or the same formula. Size and position: a relation between two measurements in the
  same run (label-to-line distance against the label's own height; a button's width against its leaf's;
  one mark's pixels against another's). A pixel diff compares two renders from the SAME session and asserts
  a relation (different / not different), never a stored image: the probe found screenshots byte-identical
  within a session and did not test across sessions, machines or DPRs.
- **No new dependency or devDependency.** A PNG is decoded in the renderer (`Image` + a 2D canvas's
  `getImageData` inside `browser.execute`), not with a Node PNG library; none is installed.
- **CDP** goes through `browser.sendCommandAndGetResult('<Domain.method>', params)`, as
  `assetDesignerInput.e2e.ts` and `recovery.ts` already do. The AX tree has **no change events** in this
  harness (probe Q1: `Accessibility.nodesUpdated` never fired): poll, with a bounded deadline.
- **Main-process hooks are removed before the case ends**, in a `finally`, including on failure; a hook
  left installed leaks into the next case.
- **A guard's docblock says it is a guard**: what it measures, which part of the clause stays a human
  judgement, and the AD18-R30 ruling.
- Do not touch `docs/`, `CLAUDE.md`, `.superpowers/sdd/audit2/`, or another task's files. Commit by
  explicit path; message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Report file: `.superpowers/sdd/task-N-report.md`. Per clause: step, clause, bucket, test (file and name),
  guard or discharge, and the mutation as `file · change · test · red/green · failing assertion`.

## Task 1: The two suite gaps — Design 89's macOS label and Browse 33's stroke parity (D)

**Model:** Sonnet. **Owns (new):** `tests/presentation/designer/designerContextMenuMac.test.ts`,
`tests/presentation/library/assetTileStrokeParity.test.ts`.

- **Design 89, macOS modifier label** (rank 1). With `Platform.isMacOS = true` (reset it after, within the
  file), the designer's context menu labels its chords with ⌘ — the audit expects
  `['⌘+G','⌘+Shift+G','⌘+D','Del']`; verify against `designerMenu.ts` and the rig in
  `designerContextMenu.test.ts` (read-only; reuse it through `tests/helpers/` if a helper exists, do not
  clone it). Mutation: `modifierLabel()`'s macOS arm returns `'Ctrl'`.
- **Browse 33, same stroke weight** (rank 2). From the ASSEMBLED sheet (the helpers in `tests/helpers/selectors.ts`),
  the category icon's stroke width equals the mark's own `stroke-width` — assert equality between the two
  declarations, not against a literal. Mutation: `.rp-al-mark`'s `stroke-width` changed to `2px` in
  `styles/asset-library-grid.css` (the reviewer's M5 stayed green on the existing tests under exactly this).

## Task 2: The accessibility tree — Design 88b (DISCHARGE) and Calibrate 32 (guard)

**Model:** Opus. **Owns (new):** `tests/e2e/axTree.ts`, `tests/e2e/assetDesignerAxTree.e2e.ts`.

- `axTree.ts`: a small helper over `Accessibility.getFullAXTree` / `getPartialAXTree` / `queryAXTree`
  (probe Q1's calls) returning the nodes a case needs and their live-region ancestry, and a bounded poll.
  Export only what the case imports.
- **Design 88b** (rank 7, DISCHARGES): after a commit, and at the step's other moment (read the row —
  the audit calls it the midnight rollover), the save-state label has NO live-region ancestor in the AX tree
  (`live` absent or `off` on the node and every ancestor), and its text is the saved state. Mutation: add
  `role="status"` to the designer header's save-state wrapper.
- **Calibrate 32** (rank 6, guard): after `editDimensions`, the clearance status node is `live: polite`,
  carries the review text, and the button's AX name is "Mark clearance as reviewed". The review warns
  that the node is inserted together with its text, the pattern screen readers announce least reliably:
  the docblock says so, and that whether it is SPOKEN stays human. Mutation: drop the node's live-region
  attribute (or its role) in `src/`.

## Task 3: Design 92 — "nothing opens" (B, reworded by AD18-R32)

**Model:** Opus. **Owns (new):** `tests/e2e/assetDesignerNoMenu.e2e.ts`.

Read Design 92 and probe Q2 (its final source is at the end of `probe.md`). With the selection cleared,
right-click the designer's anchor dot and facing arrow (and any other target the row names) at points clear
of every part and of the 40 px edge band, once with Obsidian's `nativeMenus` preference on and once off
(`app.vault.setConfig`, restored after). Assert: the `webContents` `context-menu` event fired (so the
right-click reached the host — this is what makes "nothing" non-vacuous), no `Menu.buildFromTemplate` call,
no `.menu` in the DOM, no designer menu (`.rp-canvas-context-menu` or whatever the build uses — verify).
Hooks through `@electron/remote` and `executeObsidian`, removed in `finally`. Mutation: over that target,
open an Obsidian `Menu` instead of nothing. The probe did NOT settle the footprint target (the designer
claims a right-click within hit tolerance of a selected part): leave the footprint out unless you can place a
point the row names that is outside every hit area, and report what you measured.

## Task 4: Legibility guards — contrast and size (P)

**Model:** Opus. **Owns (new):** `tests/e2e/assetDesignerLegibility.e2e.ts`, `tests/e2e/assetLibraryLegibility.e2e.ts`.

- **Design 70, readable** (rank 3): every `[data-rp-dimension]` label the existing clickability walk
  finds has text contrast ≥ 4.5:1 against what is drawn under it and a computed font size ≥ the host's
  `--font-ui-smaller` (read it in the same run). Mutation: the label's font size below that floor.
- **Design 57, legible at thumbnail size** (rank 10): the preset card's footprint and detail strokes
  contrast ≥ 3:1 with the card background, and their rendered stroke width does not shrink with the
  thumbnail's scale (the `vector-effect: non-scaling-stroke` the reviewer found in `styles/designer.css`).
  Mutation: remove that declaration.
- **Design 7, scale bar readable** (rank 12): the drawn sheet's scale-bar region (the fixture PNG's known
  fraction) against a floor you state and justify in the docblock (contrast of its strokes over the
  background at the layer's opacity). Mutation: the background layer's opacity near zero.
- **Browse 33, noticeably fainter** (rank 8): the category icon's colour has LOWER contrast against the
  tile than the mark's `--text-muted` colour (a relation, both read in the same run). Mutation:
  `.rp-al-tile__category-icon { color: var(--text-muted) }`.

## Task 5: Geometry guards (P)

**Model:** Opus. **Owns (new):** `tests/e2e/assetDesignerGeometry.e2e.ts`, `tests/e2e/assetLibraryWidthSweep.e2e.ts`.

- **Design 109, label-to-line distance** (rank 4): on the toilet preset with the footprint selected, the
  overall-width label's box is no farther from its own dimension line than the label's own height.
  Mutation: `dimensionFigures.ts`'s `overallSlot` skips its slide-along-line step.
- **Design 56, room at sidebar width** (rank 13): leaf narrowed with `setLeafWidth` to the width the row
  names (verify; the audit says ~580 px), the canvas's drawing area minus both ruler strips keeps a stated
  share of the canvas (justify the share from the row). Mutation: widen `RULER_SIZE_PX`.
- **Recover 34, the retry button reads as an action** (rank 5): the retry button does not stretch to the
  notice's or the leaf's width (the row names a measured 1024 px full-width defect). Mutation: drop the
  retry's stretch opt-out in `styles/designer-recovery.css`.
- **Browse 11, no unusable width** (rank 9): sweep the library leaf from the narrowest width the row names
  to full, in steps you state; at each, no control's `scrollWidth > clientWidth` and no two interactive
  boxes overlap. Mutation: a fixed `min-width` on the rail.

## Task 6: Pixel guards (P)

**Model:** Opus. **Owns (new):** `tests/e2e/pixels.ts`, `tests/e2e/assetDesignerPresetPixels.e2e.ts`, `tests/e2e/assetLibraryMarkPixels.e2e.ts`.

- `pixels.ts`: capture a clipped region (`Page.captureScreenshot` with `clip`, or `takeElementScreenshot`),
  decode it in the renderer, and return a difference measure between two captures of the same session.
- **Design 57, recognisably not the Washbasin** (rank 11): the vanity preset card's thumbnail differs from
  the Washbasin card's by more than a stated fraction of pixels. Mutation: `presetThumbnail`'s vanity path
  data set equal to the Washbasin's.
- **Browse 3, distinguishable at 20 px** (rank 14): the five `AssetMark` states rendered at 20 px are
  pairwise different. Mutation: remove the `stroke-dasharray` rule that separates `measured` from
  `unscaled` (the reviewer's M4 made the "unreadable" mark draw nothing and the class test stayed green).

## Task 7: Rewrite the case rows (AD18-R28, R30–R33)

**Model:** Sonnet, two agents on disjoint files. **7a owns** `docs/tests/cases/Design an Asset.md`;
**7b owns** the other five cases with human steps (Take, Calibrate, Recover, Two designers, Browse).

- Every new test is cited by NAME in its case's *Automated in Obsidian* table, marked guard or discharge.
- Retag per AD18-R28 **only** where every clause is now discharged: expected Design 88b (if its other
  clauses are A — verify), Design 92, Recover 2 and Browse 31 (AD18-R33 host pins). Every step with a
  guard-only or human clause keeps its human tier.
- Apply the audit's "Corrections to case files not yet applied" list (Design 89's `⌘+G`, Recover 6's
  citation, Browse 3 and 33's overclaims, Calibrate 29 re-asked in full under AD18-R33, and the rest).
- Reviewers open every cited test body.

## Task 8: MANUAL-PASS, the count and the evidence file

**Model:** Sonnet. **Owns:** `docs/tasks/asset-designer-expansion/reports/MANUAL-PASS.md`,
`docs/tasks/asset-designer-expansion/reports/AD18-walk-automation-evidence.md`.

Rewrite MANUAL-PASS's current-count section and re-derive the count with its own command (paste what it
printed). Append each Task 1–6 mutation to the evidence file from the task reports.

## Task 9: RESUME, delivery note, state.json (integrator)

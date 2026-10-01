# AD18 UI critique round — plan (2026-09-29)

**Authority.** The live UI critique of session twenty-two (impeccable `critique`, 25/40, snapshot
`.impeccable/critique/2026-09-29T20-55-56Z__src-presentation-designer.md`, untracked) and the user's answers:
bugs first, the five priority issues, tiles per **AD18-R39**, clearance wording per **AD18-R40** (both in
`contracts/DECISIONS.md`). Executed subagent-driven, one implementer at a time, each task independently reviewed,
then a whole-round review. Nothing here authorizes a schema change, a stored field, a new dependency or
devDependency, AD17/roadmap work, or a *Deliberately absent* element.

## Global constraints

Every task also binds the standing list in `.superpowers/sdd/global-constraints.md` (gitignored; read it first),
with these round-specific amendments, which win where they differ:

- **File ownership** is per task below. Locale modules named in a task are owned by that task. Nobody else touches
  `docs/tests/cases/`, `MANUAL-PASS.md`, `RESUME.md`, `DECISIONS.md`, `state.json` or the evidence file (Task 7 owns them).
- **Locks.** A temporary `src/`/`styles/` mutation takes `.superpowers/sdd/mutation.lock`; a real-Obsidian run takes
  `.superpowers/sdd/e2e.lock`. Take a lock only if absent, write your task id into it, one bounded wait if present,
  delete it after. One Obsidian at a time. `npx vitest run -c tests/e2e/vitest.config.mts <file>` is not how e2e
  runs — use `npm run test:e2e -- <file-or-filter>` (read `scripts/e2e.mjs` for the argument form).
- **Real host for anything the eye judges.** A change to layout, colour or drawing gets an e2e case in real
  Obsidian (Linux CI is the authority; Windows local is DPR 2 and a different font — never pin a pixel measured on one
  platform). Contrast is measured with `tests/e2e/legibility.ts`; geometry with bounding rects.
- **Every new assertion is watched red** under the narrowest `src/`/`styles/` mutation of its clause, restored after;
  the report names the mutation and the red output.

### Task 1: The stale notice's text contrast (WCAG 1.4.3)

**Verified.** `styles/designer.css` `.rp-designer-notice` sets `color: var(--text-warning)` on
`background-color: var(--background-secondary)` at `font-size: var(--font-ui-smaller)`. The same file's
`.rp-designer-unscaled` comment records that pair at "about 2.73:1 … in the light theme, under the 4.5:1 AA floor",
and fixes it with `--text-normal` text and a `--text-warning` leading rule. `styles/designer.css` is at the 400-line cap.
`styles/asset-prices.css:140` `.rp-asset-price-orphan, .rp-asset-price-unreadable` — check whether it uses the same
text colour on a background that fails; fix it the same way only if you MEASURE it failing.

**Do.** Give `.rp-designer-notice` the `.rp-designer-unscaled` treatment (normal text, warning-colour leading rule),
keeping the strip's meaning legible without colour. Stay under the cap (move rules to a new or sibling partial if
needed; `styles/index.css` must import it). Add a real-host guard: the stale notice's text at ≥ 4.5:1 against its
composited background in BOTH themes, reusing `legibility.ts` and the staging `assetDesignerGeometry.e2e.ts`'s
*keeps the stale notice's Try again…* case already uses. Watch it red by restoring `--text-warning` as the text colour.

**Owns.** `styles/designer.css`, any new `styles/` partial and its `styles/index.css` line, `styles/asset-prices.css`
(only if measured failing), a new or existing e2e file under `tests/e2e/` for the guard, `tests/gates/designerRecoveryStyles.test.ts`
if a declaration pin needs updating.

### Task 2: A multi-selection draws every member

**Verified.** `assetDesignStore.ts` keeps `selected: DesignerSelection[]` and derives `selection = selected.at(-1)`;
`DesignerCanvas.vue` (~l.163) computes `drawnPart` from `selection.value` alone and passes it to
`layers/selectionLayer.ts` `selectionMarks(shape, selection, …)`, which takes one part. Live: "2 parts selected" and
two highlighted Parts rows, while the canvas draws handles on the last-clicked part and the other as unselected.
Board 02 panel 6 draws a box on every member.

**Do.** Draw every member of the selection: each member gets the selected restroke; handles (resize/rotate) stay on
the primary (last) member only, so the gesture model is unchanged; when two or more are selected, draw one dashed
frame around their combined bounds (what "Align to: The selection bounds" aligns to). Honour the existing
`drawnSelection` rules per member (hidden details and a hidden clearance draw nothing). Read AD18-R20/R21/R22 and the
`selectionLayer.ts` / `hitTest.ts` docblocks before changing the shape of `selectionMarks`; keep hit-testing as it is.
Tests: vitest over `selectionLayer`/the canvas rig asserting every member is drawn and the bounds frame appears for 2+
and not for 1; an e2e case in real Obsidian selecting two parts via "Select multiple parts" and reading Konva's stage
(`tests/e2e/designerCanvas.ts`) for both members' marks. Watch red by reverting to drawing `selected.at(-1)` only.

**Owns.** `src/presentation/designer/layers/selectionLayer.ts`, `src/presentation/designer/DesignerCanvas.vue`
(the 400-line cap counts template comments — check with eslint), `src/presentation/designer/selection/hitTest.ts` only if
`drawnSelection` must accept a set, their tests, a new e2e file.

### Task 3: Library tiles and the inspector preview draw the asset's details (AD18-R39)

**Verified.** `AssetTile.vue` and the inspector Shape preview reuse `AssetMark.vue`, which draws the listing's
`AssetOutline` (footprint only; design spec `docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §3.4 and §5).
The viewport batch is `src/application/queries/ListAssetOutlines.ts`. `src/presentation/designer/inspector/DesignerAssetCard.vue`
already draws footprint + details from a design. The five mark states (pending, unreadable, measured, unscaled, none)
and the stale-while-revalidate rule (§5.4, 2026-09-29 amendment; `viewportMarks.ts`) must survive.

**Do.** AD18-R39: the Grid tile and the inspector Shape preview draw footprint plus details; the 20 px list-row mark
stays footprint-only. Details are already stored in the geometry sidecar, so this is a READ change: extend what the
batch carries (e.g. the outline plus the detail paths, in the same units) or read per visible tile — choose, and state
why, in the report. No schema change, no new stored field. Keep the unscaled/measured distinction visible, keep the
pending/unreadable pictures, keep the design-less category-icon fallback. Draw with host tokens only; details thinner
or fainter than the footprint as `DesignerAssetCard` does. Update the design spec §3.4/§5 with a dated amendment
citing AD18-R39. Tests: application-level for the batch; jsdom for the tile/preview drawing details and the row mark
NOT drawing them; update the Browse 3 pixel guard / mark-state tests only where they break by design (say which, and
why, per case). Real-host e2e: a tile of a preset with details (vanity) draws more than its footprint path.

**Owns.** `src/application/queries/ListAssetOutlines.ts` (and its DTO types), the infrastructure reader it calls if
the batch must read details, `src/presentation/library/AssetMark.vue`, `AssetTile.vue`, the inspector preview component,
`src/presentation/library/viewportMarks.ts` only if its value type widens, the design spec file, their tests, e2e files
for the library. Opus.

### Task 4: One dialog footer, Cancel then Save, Save as the primary

**Verified.** `src/presentation/dialogs/FormSubmitRow.vue` renders a `.rp-dialog-actions` row with the submit button
inside each form body; `FormDialog.vue` renders a SECOND `.rp-dialog-actions` with Cancel after the body; neither button
carries `mod-cta`. Live: Save above Cancel, right-aligned, in New asset, and in the preset modal (Apply) — whose Apply
also sits below the whole gallery after a card is chosen. Callers include `NewProjectForm`, `NewPlanForm`,
`NewAssetForm`, `AssetPresetForm` (grep `FormSubmitRow` for the full list).

**Do.** One action row per dialog, in Obsidian's order and style: Cancel then the submit, the submit carrying `mod-cta`,
the row pinned at the dialog's foot so a long body (the preset gallery) scrolls above it. Keep the submit a real
`type="submit"` for its form (a `form="…"` attribute is one way) and keep FormSubmitRow's `aria-disabled` focus rule and
`DialogHost`'s Escape/Tab trap intact. In the preset modal, choosing a card brings its fields and preview into view.
Grep `styles/`, `scripts/` and `tests/` for `.rp-dialog-actions` / `.rp-dialog-button` / `data-rp-action` before renaming
anything. Tests: jsdom for one row, order, `mod-cta`, submit still submits, Escape still refused while busy; real-host
e2e that Save and Cancel share one row (same top within a pixel) and the preset Apply is visible without scrolling after
choosing a card at the default leaf.

**Owns.** `FormSubmitRow.vue`, `FormDialog.vue`, the dialog partial(s) in `styles/`, `AssetPresetForm.vue`, callers only
where the row move requires it, their tests, an e2e file.

### Task 5: Clearance reach reads as a positive distance per side (AD18-R40)

**Verified.** `src/presentation/designer/dimensions/dimensionFigures.ts` `gapOf` is signed ("Negative is a part that
reaches outside the footprint"); `measuredParts` includes the clearance under All dimensions and when the clearance is
selected, so the clearance's front reach reads "-600 mm" and its unset sides "0 mm".

**Do.** AD18-R40: wherever the CLEARANCE's offsets are drawn (All dimensions, and the clearance selected), each side
reads its reach outward from the footprint as a positive figure, and a side with no reach (0) draws no label. Details
keep their signed gaps and their 0 mm labels (AD18-R22 unchanged). The clickable number still edits the right side with
the right sign (a typed 600 on the front means 600 mm of front reach). Mind AD18-R14's collision placement and the
existing restingLabels/dimension tests; sweep every preset. Tests: vitest over the figures (positive, zero omitted,
details unchanged, edit round-trip); watch red by restoring the signed value.

**Owns.** `dimensionFigures.ts`, the dimension edit path it feeds (only as needed), their tests.

### Task 6: Plural forms for counts

**Verified.** `en-assetLibrary.ts`: `'view.asset-library.assets': '{count} assets'` (live footer "1 assets"),
`'view.asset-library.search.results': '{count} matching assets'`, and the unreadable notice
`'{count} asset note(s) could not be read. …'`. The house pattern is a separate `.one` key chosen at the caller
(`src/presentation/i18n/locales/en/editor.ts` / `de/editor.ts`).

**Do.** Give each of the three a singular form via the house pattern, in English and German (the German locale module
for the library — find it), and choose at each caller. Sentence case; no "(s)". Grep for any other `{count}` key in the
library/designer locales with the same problem and fix those too, listing them. Tests: per locale, 1 and 2.

**Owns.** the library locale modules (en/de), the callers of those keys, their tests.

### Task 7: Docs, case rows and hand-off

After Tasks 1–6 are reviewed. Update the case rows whose pass condition changed (at least: Browse rows describing the
tile sharing the list row's mark; any Design/Browse row describing the dialog button order or the preset flow; rows
describing clearance labels or multi-select drawing), each citing its new test by NAME; add this round's mutation rows
to `AD18-walk-automation-evidence.md` (a new section); DECISIONS delivery note for AD18-R39/R40; state.json; RESUME
rewritten; re-derive MANUAL-PASS's count (it must not move — no step was retired here). Owns every doc named.

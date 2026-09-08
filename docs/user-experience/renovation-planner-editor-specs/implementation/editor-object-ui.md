# Generic item creation and presentation

This contribution completes the generic Object doorway from mental model §5.6 and the M02 **Item** entry, on the verified integration foundation `88b9ee3d049ed0060ddb3e84107b27649f18d9b4`. It is an implementation checkpoint for the combined editor; the whole-repository gate and final M00–M17 visual acceptance remain open.

## Production behavior

All eleven Add routes invoke implemented tasks or contextual forms. Current-view capability and write guards remain explicit: an unavailable service has a named reason, and openings require an existing wall. Item, Path, Fence and Measurement open Details in constrained leaves, focus their name field, and expose correctly labelled temporary-task Finish/Cancel controls.

Items share one runtime draft and command path for pointer/numeric outlines and an optional numeric rectangle. Position is signed metres from the plan origin; width and depth use the existing positive-length parser, whole-millimetre resolution and 1000 m side limit. Applying replaces only the temporary outline. Finish saves one named item and returns to Select. No new Asset catalogue, geometry authority or persistence schema is introduced by this UI contribution.

Rectangle text belongs to the runtime draft. Invalid or unapplied text blocks pointer/outline changes and every Finish route until applied or discarded. Reflow preserves text, input identity and focus. Native Enter applies the rectangle once; it does not also save the item. Paused/saving states retain text and refuse changes. Cancel retires the draft, and disposal cannot steal focus from another leaf. The shared point form explains invalid/repeated positions and refuses a third measurement point without losing the typed value.

Saved items use the existing precise name/outline edit, confirmed deletion and conditional Undo/Redo. Their canonical names appear under **Plan items**, separately from walls/openings; the shared row appearance and stable IDs support keyboard selection and restoration. The list projects labels and selection outside its template; banner display conditions are computed separately to meet the existing analysis budgets. The shared outline form now uses the neutral **Name** label.

## Visual corrections from browser inspection

- Host error red on white measured 4.2:1 for small text. Editor field messages use host normal text; the warning glyph and invalid border retain error cues.
- Generic Finish no longer says Create room, and name fields no longer say Area name.
- Room-context selects fit the German Inspector at 460 px, with a native control height consistent with surrounding fields. Saved actions use the shared wrapping action group.
- Reference-layer labels retain enough width before their adjacent action wraps. The browser checks nested Inspector overflow as well as page overflow.

Representative checkpoint captures: [invalid rectangle](evidence/editor-object-ui/light-invalid-rectangle.png), [rectangle preview](evidence/editor-object-ui/light-rectangle-preview.png), [German saved item](evidence/editor-object-ui/german-constrained-saved-item.png). These supplement the final all-screen comparison; they do not replace it.

## Verification

- Production build (Vue type check and Vite), changed-file ESLint, whole-project oxlint and whitespace checks passed after the browser corrections. The eleven-file interaction run passed **110 tests**.
- The subsequent list/banner refactor passed type checking, scoped lint and oxlint, then **54 tests in nine files**, including native item-list selection, linear elements, read recovery, Room snapping/free-shape creation, banners and wall/opening selection/actions.
- Focused coverage collected from the 92-test run for `ElementTaskForm.vue`, `ObjectRectangleFields.vue` and `objectRectangleInput.ts` passed the unchanged floors: **120/120 statements, 135/136 branches (99.26%), 35/35 functions and 74/74 lines**. It predates the later presentation extraction and is scoped evidence, not the repository gate.
- Focused-coverage Fallow confirmed the two template cognitive findings and the `elementTask` private parameter-type leak are cleared. Its remaining whole-tree findings are not a pass: three-file coverage cannot measure unrelated code, and finalization owns the combined analysis/clone repairs. No threshold or exclusion was relaxed.
- `node scripts/editor-object-check.mjs` passed **four real browser scenarios** in Edge **152.0.4191.62**, using an explicit executable override: default light/dark at 1440 × 900, custom accent at 1000 × 900 and German dark at 460 × 900. It exercises keyboard Add → Item, invalid input/reflow, rectangle application, save, name/outline edit, Undo/Redo, confirmed deletion and restoration of the same identity through production commands/repositories over FakeVault.
- Eight automated WCAG scans reported **zero violations**. Five scans retained a color-contrast incomplete check: scrolled/overlaid content and the harness's computed OKLCH active-rail color. Raw reports are retained with the [browser report](evidence/editor-object-ui/report.json); incomplete checks are not automated passes. Screenshots were inspected separately.

The final visual runner includes this Object journey, resets only its own generated outputs after checking absolute worktree containment, and regenerates the after/comparison inventory at one clean source revision. Before/iteration evidence is preserved, and stale failed captures cannot enter the final inventory.

Remaining combined acceptance: `npm run check`, CI, all eighteen final reference comparisons, and the separately recorded live Obsidian/device/screen-reader boundaries. Viewport reflow is not actual browser-zoom acceptance.

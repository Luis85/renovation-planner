# Editor View and canvas legibility

Verified UI checkpoint following `4b34a4cc`; final joined editor acceptance remains open.

M00 and the component contract now have a native View disclosure in the context bar. Fit floor,
Fit selection and zoom reuse the existing viewport transform. Canvas shortcuts and View share
one framing calculation, including the prepared reference extent when visible. F fits the floor;
Shift+1/2 remain available. Native fields, host Find modifiers, key repeat and composition do not
invoke F. Camera actions refuse an active gesture.

Grid and automatic object snapping are ephemeral preferences scoped to each editor leaf. The
grid is a visual ruler in 100 mm multiples, decimated at distant zooms to remain legible. It does
not quantize saved coordinates. The existing SnapService uses a live per-leaf enabled predicate;
Room/Object alignment and wall endpoint/axis attraction honor it. Explicit Shift constraints and
required opening-to-wall attachment remain available. The Asset Designer keeps its prior defaults.
Status reports real grid and snapping state; the constrained bar retains snapping and moves the
grid control into View. None of these controls writes project data or creates a history entry.

Selected Room fill is stronger than surrounding Rooms. Captions use a semantic canvas-colored
halo to remain readable over imported floor drawings. Capture URLs use the existing bare harness
mode so its theme toggle no longer covers the production save-state indicator.

The connected Plan Room Inspector no longer repeats “Not available yet” below working Costs,
Documents, Photos and Notes routes. The fallback remains when the required services are absent.
The icon fixture's executable node table now lives under the existing scanned `tests/helpers`
root. This fixes the CI stylesheet-reachability failure without widening or bypassing its guard;
original SVG files and licenses remain in `tests/fixtures/editor-icons`.

## Verification

- Build/type checking passed, as did scoped ESLint and whole-tree Oxlint. The final constrained
  menu CSS correction follows the build and is exercised in the browser; the joined build remains
  the final artifact gate. No lint, coverage or architecture threshold was lowered.
- **184 tests in 12 files passed** (84.40 s, one worker): View, per-leaf snapping, SnapService,
  Room snapping unit/end-to-end, scene/order, status/context bars, canvas navigation, stores and
  the unchanged harness source guard. **22 tests in two files passed** (42.55 s) for connected
  Room overview/Plan navigation and the preserved unavailable-service Inspector fallback.
- Four `--design` overview journeys passed in installed **Edge 152.0.4191.62**, explicitly
  overriding the pinned Chromium build: light, dark, custom accent and German at 460 px.
  Native View zoom/grid/snapping/Fit, containment and Escape checks preserve selection. The
  original inline-dimension, pending-write, contextual actions and shared Work checks remain.
  See [browser report](evidence/editor-view-controls/report.json).
- **16 axe scans reported zero violations**. Incomplete contrast checks for the non-text minus
  glyph and content covered by the open menu/constrained Details remain in the scan files. These are not a screen-
  reader or canvas-text contrast certification.
- Inspected light/dark M00 and View captures and the corrected constrained German menu. The
  first German containment run exposed a real off-pane menu after header wrapping; anchoring
  the constrained menu to the header's right edge fixes it without weakening the assertion.
  The low-zoom check uses two zoom steps and their reversal because one working step can leave
  the rounded percentage unchanged.

The final joined eight-journey/18-reference matrix, downstream workflow integration and actual
Obsidian/device/screen-reader observations remain outstanding. This checkpoint does not declare
the whole UI/UX goal complete. M00 estimate/continuation density must be reviewed after the
finalization branch's More actions disclosure joins.

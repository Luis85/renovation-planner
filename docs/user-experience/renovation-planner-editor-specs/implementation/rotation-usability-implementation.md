# Rotation usability implementation

Baseline: combined `a79baa83`. Contract: [rotation interaction research](rotation-ux-research.md).
Earlier `rotation-handle` evidence remains an attributed predecessor, including its proven
popover occlusion. This topic changes interaction presentation and gesture routing, preserving
the guarded source commands, fixed pivots, typed selection order and current/intended ownership.

| Requirement | Implementation action | Acceptance |
|---|---|---|
| Discover a labelled control | Shared rectangular control layout; top centre, more distant top and side-midpoint candidates | Label and at least 44×44 CSS-pixel target fit the actual viewport and clear controls/vertices |
| Understand before moving | Native circular-arrow icon, persistent Rotate label, hover/press pivot and concise instruction | EN/DE labels and measured hit region agree; meaning is not cursor/color-only |
| Click versus drag | Pending press with existing 4 px threshold; release inside opens the existing numeric action | Jitter creates no geometry/history; outside release cancels; a begun drag never becomes a click |
| Predictable drag | Freeze shape, pivot, initial control and pointer bearing; unwrap angles from the baseline | Off-centre/radial/cross-180° motion, near-pivot stability and viewport changes preserve rigid geometry |
| Visible precision feedback | Direction and active snap-step labels; independent bounded readout | No contextual popover occlusion; no pivot or initial-handle relocation during gesture |
| Safe completion | Existing free-item commit and reviewed wall route | Cancel/retirement/invalid/zero/full turns write nothing; one gesture/one history; exact Undo/Redo remain |

Sequence: implement shared control geometry and hit routing; add pending/drag visual state and
numeric click routing; update the glyph and native-control obstacle projection; add focused
regressions and browser interaction checks; run scoped lint/types/tests; commit source before
fresh browser capture. Parent owns final nine-journey/eighteen-screen, whole-repository and
native/physical-device/screen-reader acceptance. No dependency install is required; tools resolve
the main checkout's existing dependencies.

## Source verification checkpoint

The implementation now uses an 80×62 CSS-pixel rectangular control (112×62 for selected
openings, labelled Rotate wall), a native circular-arrow icon and midpoint stem. Paint and
selection consume the same rectangle. The existing native dimension observer also measures
the real HUD, contextual actions, overlays and constrained Inspector; it keeps one resize
observer, coalesces frames and clears removed controls. Hover/press exposes the frozen centre
and click/drag instruction. Drag feedback gives direction and the configured Shift increment.

The seven scoped files cover 81 cases: geometry/selection, new click/drag interaction, real
Konva glyph, native obstacle measurement, all eight Inspector routes, Object runtime and Wall
runtime. The initial run passed 80/81; the legacy scale-50 pointer ended within the new
8-screen-pixel centre deadzone. Its endpoint was corrected to remain 100 screen pixels from
the centre. Geometry and new interaction then passed 41/41, including the affected case and
final gesture guard changes. Whole Oxlint and production vue-tsc passed. Scoped ESLint covers
the changed TypeScript/Vue source and tests; browser modules use Node syntax validation
because repository ESLint ignores scripts.

The browser driver now requires an actual label hover instruction, a three-pixel jitter click
opening precision without persisted changes, a full rectangular target, and visible 15°
feedback, alongside the existing pan/zoom, exact preview/commit, Undo/Redo and Escape checks.
These new browser checks have **not yet run** at this checkpoint. Parent integrates the source
with the latest shell/Inspector changes before capturing; no old prototype screenshot is
attributed to this interaction. Native, physical-device and screen-reader claims remain separate.

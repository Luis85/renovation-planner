# Rotation handle and keyboard controls

This UI concern follows the user's 2026-09-08 expansion to individually rotate every spatial
item. The generalized rotation engine owns target eligibility, fixed baseline/pivot, shared
paint/hit coordinates, preview, snapping and guarded commands. Wall/Openings use the separately
reviewed host-wall operation. This contribution owns the recognizable handle and shared native
controls, preserving the existing shell and Inspector routes.

## Actionable interaction plan

1. Use the engine's single handle geometry: upper-right diagonal 40 screen pixels from bounds,
   clamped to 28 px side/bottom and 60 px top margins. Visible circle radius is 14 px; the engine's
   grab radius is 22 px. The same idle point feeds painting and hit testing, independent of zoom.
2. Render Obsidian's actual `rotate-cw` icon in the 28 px circle using the existing EvidencePins
   host-icon-to-Konva approach. Preserve a visible stem, show the frozen pivot and signed angle
   during dragging, and rotate the baseline handle/stem about that pivot without accumulated drift.
3. Offer Rotate by and clockwise/counterclockwise quarter turns through shared native Inspector
   controls for every eligible selected item. The recognizable glyph is the canvas affordance;
   keep Edit shape/Add detail in the existing small direct-action popover. Keep EN/DE text and
   visible directions, wrapping controls at constrained widths.
4. Verify rendered geometry at multiple zooms and viewport edges, angle feedback, native icons,
   keyboard/modal routes, canceled/busy/Review states and all supported targets. Integration and
   final visual/host acceptance remain parent-owned and sequential.

Dependency: generalized `runtime.rotationActions` and shared `handleMetrics`, then host-wall
rotation. Source began at `43fd968b` and is now rebased onto wall checkpoint `dfb9e216`,
including the final generalized engine `42176cf2` and its documentation follow-up. The wrapper consumes that API; the shared controls
are wired into every Plan Inspector and the permitted Room/Area/wall/opening Renovate contexts.
Opening controls explicitly say Rotate wall and explain that hosted openings turn together.
The small canvas popover retains Edit/Add only. Shared placement now tries clear alternate
anchors when viewport clamping would overlap a vertex handle or dimension control. The UI
consumes that geometry without repeating hit-testing or placement logic. No selection-priority
decision is made here.

The two new test-only Lucide SVG fixtures are copied unchanged from the same pinned revision
`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860` as the existing icon fixtures; their original license
remains in the fixture directory. Production continues to use Obsidian `setIcon`.

The independent actual-Konva glyph test passed on the initial UI working tree (one test,
32.75 s, of which 337 ms is the test body). It checks the pinned host paths, screen size at
0.2×/1.7× zoom, icon bounds, animated baseline coordinates, frozen pivot, signed rounded angles,
bounded angle labels and cancellation. This precedes generalized runtime/wall integration;
it is not yet a combined interaction or screenshot acceptance claim.

## Integrated verification

Scoped ESLint, the full Vue type check and whole-repository Oxlint pass. A single-worker joint run passed 50 tests in
five files: `rotationHandleGlyph`, `rotationInspectorRoutes`, `objectRotationRuntime`, domain
`rotateWall`, and `wallRotationRuntime`. This includes all 26 wall/domain cases and the newly
added peer-preview/identical-refresh pair. The old-red fork was not run. The Inspector test
opens and cancels each canonical form for Room, Area, Object, Path, Fence, Measurement, Wall
and Opening; it checks explicit host-wall wording, allowed Renovate routes at 460 px, no
geometry controls in Review, no duplicate canvas action bar and unchanged vault bytes.

Oxlint initially rejected two conditional assertions in the new Inspector test. They now run
unconditionally and also check that the opening-specific hint is absent for other targets.
The final two UI tests pass after that correction and removal of an unreachable empty-angle
fallback; scoped lint, types and Oxlint were repeated on those final source bytes.

The actual four-scenario rotation screenshots and native browser inputs still follow this
source gate. Final whole-repository coverage/analysis, original nine journeys/eighteen reference
comparisons, actual Obsidian and physical-device/screen-reader observations remain separate.

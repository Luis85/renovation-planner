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
   controls for every eligible selected item. Direct canvas actions use a compact numeric entry.
   Keep EN/DE text and visible directions, wrapping controls at constrained widths.
4. Verify rendered geometry at multiple zooms and viewport edges, angle feedback, native icons,
   keyboard/modal routes, canceled/busy/Review states and all supported targets. Integration and
   final visual/host acceptance remain parent-owned and sequential.

Dependency: generalized `runtime.rotationActions` and shared `handleMetrics`, then host-wall
rotation. Source begins at `43fd968b`; it will be rebased onto the verified engine checkpoint
before wrapper integration. No selection-priority decision is made in this UI concern.

The two new test-only Lucide SVG fixtures are copied unchanged from the same pinned revision
`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860` as the existing icon fixtures; their original license
remains in the fixture directory. Production continues to use Obsidian `setIcon`.

The independent actual-Konva glyph test passed on the initial UI working tree (one test,
32.75 s, of which 337 ms is the test body). It checks the pinned host paths, screen size at
0.2×/1.7× zoom, icon bounds, animated baseline coordinates, frozen pivot, signed rounded angles,
bounded angle labels and cancellation. This precedes generalized runtime/wall integration;
it is not yet a combined interaction or screenshot acceptance claim.

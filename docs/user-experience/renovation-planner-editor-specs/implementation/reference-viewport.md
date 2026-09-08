# Reference-scale image viewport

Status: implemented with scoped verification; integrated/native visual acceptance pending. User explicitly requested a much
larger image and pan/zoom/Fit in the existing reference-scale modal.

The modal gives most width to the source image and keeps setup fields alongside it at
desktop widths, below it when constrained. A measured, DPR-aware canvas replaces the fixed
400×220 display. The original size remains the transform helper's default for compatibility.
The dialog body is the single scroll area, keeping the framework's Cancel accessible.
Reference source suggestions are also bounded to 20 matching paths so the larger modal does
not create thousands of datalist nodes before the image loads.

Drag, Space/middle-button navigation, arrow keys and the Pan control move only the viewport.
Wheel and +/- buttons zoom around the pointer or image viewport centre; Fit/F restores the
rotated crop bounds. A drag does not also place a calibration point. Each available A/B point
is visible immediately, including when only the first point has been entered.

All screen-to-source conversion inverts the viewport, reference rotation and crop. The form
continues storing A/B as original raster pixel coordinates and rounds picks with its existing
two-decimal rule. Navigation never changes those coordinates, crop, rotation, calibration or
saved appearance. Existing reviewed configuration, busy/conflict/cancel and write boundaries
are retained. Marker colors inherit the live host theme through the existing callback seam.

Verification:

- Scoped ESLint, scoped Oxlint and TypeScript passed.
- The viewport, controls, calibration setup, PDF cleanup and complete reference workflow
  cover **61 tests**. The initial run passed 60; the new toolbar exposed an old first-button
  selector. Back and Another distance now have stable action selectors, and the affected
  cancellation/busy-state tests target those actions explicitly.
- The final full reference-workflow and stylesheet/button batch passed **327/327** tests:
  all 35 workflow cases plus 292 stylesheet/button cases. No expectation was weakened.
- Native canvas tests cover zoomed source-pixel picking, outside-viewport refusal, drag-click
  suppression, Space/middle/cancel behavior, keyboard navigation, resize and subscription disposal.
- Source suggestions are capped at 20 while matching paths beyond the initial choices remain
  reachable. The layout assigns most width to the image and stacks controls below it under 1000px.

The checks do not claim matching screenshots or live Obsidian acceptance. Those remain with
parent integration. No geometry schema, persisted viewport or calibration ownership changed.

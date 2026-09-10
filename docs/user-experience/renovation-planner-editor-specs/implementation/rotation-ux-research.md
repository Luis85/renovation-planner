# Rotation interaction research and revised implementation brief

Research date: 2026-09-08. The user reports that the current handle is not intuitive. This
research addresses the interaction, not only icon size. The existing guarded geometry/history
contract in ADR-0025 remains intact.

## Evidence and applicability

| Source | Finding | Application |
|---|---|---|
| [Microsoft Office rotation](https://support.microsoft.com/en-us/office/graphics-visuals/rotate-or-flip-a-text-box-shape-wordart-or-picture) | A visible handle sits above the selection. Dragging, Shift 15-degree steps, numeric entry and left/right quarter turns are documented. | Familiar visible affordance is a stronger starting point for homeowners than an invisible activation zone. This is a product convention, not a standard. |
| [Figma transforms](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) | Rotation is discovered outside bounds through a cursor, with precise fields and modifier snapping. | Retain precision alternatives; do not assume homeowners know hidden corner gestures. |
| [Sketch rotation](https://www.sketch.com/docs/designing/layer-basics/resizing-and-rotating-layers/), [precise shape angles](https://www.sketch.com/docs/designing/shapes/editing-shapes/) | Handle and Inspector routes coexist; overlap can distinguish a click from a drag. Sign conventions differ between editors. | State that our angle is relative and positive means clockwise; preserve the confirmed selection order. |
| [Adobe rotation](https://helpx.adobe.com/illustrator/desktop/manage-objects/arrange-objects/rotate-objects.html) | Rotation references a centre; moving farther from it can improve precision. | Keep the angular gesture free of radial constraints. Custom pivot editing is unnecessary for this release. |
| [WCAG 2.2, SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | An equivalent single-pointer operation without dragging is required at AA, unless an exception applies. Keyboard-only support is not sufficient by itself; pointer-accessible numeric input can provide an alternative. | Clicking the handle opens the same precise angle control as the Inspector. Numeric Apply/Cancel and quarter-turn controls remain usable by click/tap. |
| [SC 2.5.8 minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA requires a 24×24 CSS-pixel target or a stated exception. Shape and spacing matter: a circular diameter alone is not a square target. | Measure the actual unobstructed hit region and clearance, not just the glyph diameter. |
| [SC 2.5.5 enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) | The enhanced AAA target criterion uses 44×44 CSS pixels, with exceptions. | Aim for at least a 44×44 rectangular hit region and include the visible label. This design target is not a claim of overall AAA conformance. |
| [SC 2.5.2 pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) | Release activation, cancellation and undo reduce unintended actions. | No persistence on press; distinguish click/drag, cancel before commit, and retain Undo afterward. |

WCAG's linked Understanding pages explain the normative criteria in
[WCAG 2.2](https://www.w3.org/TR/WCAG22/); product conventions and the recommendations below
are design choices. No formal usability study or complete accessibility conformance is claimed.

## Observed problem

The retained `c5e93f64` selected/drag screenshots show a corner-attached diagonal stem, a
button-like circular arrow with no useful click behavior, and a pivot that appears only after
movement. During a turn, the shape-action popover covers feedback. These observations support
the user's report; the explanation that the stem can suggest a corner pivot is an inference.

## Revised contract to implement

1. **Discover:** show a clearly labelled Rotate affordance. Prefer a top-centred position;
   use the shared placement model to clear the real dimension controls and viewport edges.
   Try a more distant top position or an explicit alternative side rather than covering a
   ruler or resize handle. The stem must not visually imply that a corner is the pivot.
2. **Explain before movement:** hover/press shows the fixed centre and a concise instruction:
   drag to rotate, click for a precise angle. Keep a standard usable cursor; meaning must not
   depend on a cursor or color alone. The label belongs to the hit region.
3. **Click versus drag:** reuse the existing small screen-space movement threshold. A release
   inside the frozen control without crossing that threshold opens the existing angle dialog,
   creating no history. Leaving the target before a simple click's release cancels that click.
   Once dragging has begun, returning to the start must not accidentally open a dialog.
4. **Drag:** freeze geometry, pivot, initial handle placement and pointer-angle offset. The
   handle follows that initial point around the pivot; no moving-bounds relocation or repeated
   clamping alters the gesture. Allow movement outward for precision. Show clockwise or
   counterclockwise angle feedback and explicitly indicate active 15-degree snapping.
5. **Keep feedback clear:** suppress the direct-action popover during the rotation interaction.
   Keep the readout independently inside the visible workspace without moving the frozen
   geometric pivot. Restore ordinary actions after cancellation/completion.
6. **Finish safely:** free-item release commits once; wall release still opens reviewed impact.
   Escape/pointer cancellation, retired contexts, zero/full turns and invalid geometry do not
   write. Quarter turns and exact numeric input share the guarded source commands.

Acceptance adds off-centre presses, jitter below threshold, click cancellation, drag-return,
crossing 180 degrees, near-pivot movement, pointer travel outside the canvas, snap feedback,
actual label/target hit agreement, obscured-control avoidance and EN/DE constrained layouts.
Test every supported kind's route, including clearly named host-wall rotation for openings.
Existing persistence, preview/commit, exact Undo/Redo, order, peer-conflict and readback tests
remain mandatory. Actual native and physical-device/screen-reader evidence stays separate.

## Later user choice: small edge arrows on hover — 2026-09-08

The user subsequently rejected the permanent labelled handle presentation and requested small
curved-arrow rotation controls on item edges when hovering. This supersedes the always-visible
Rotate label and top-centre placement in items 1–2 above; it is a direct product preference,
not a new research or usability-study finding. The `5853827a` implementation is retained as a
tested predecessor rather than described as accepted final design.

The edge-hover continuation keeps actual 44×44 rectangular targets, centre/guide explanation
when hovering an arrow, click-to-angle input and the four-pixel drag threshold. Hover itself
changes no selection. Pressing an unselected item's arrow selects and freezes that item;
hovering an existing selected-group member preserves its group. The short approach from an
edge to its arrow may retain affordance ownership, while ordinary hover/click resolution still
predicts the actual body under the pointer. Alt suppresses rotation and retains cycling.

Numeric and quarter-turn Inspector routes remain. See the bounded
[edge-hover implementation and pending verification](rotation-edge-hover.md); group actions
and curve persistence keep their separately owned domain contracts.

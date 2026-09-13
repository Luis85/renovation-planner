---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 96
sources:
  - Smart alignment guides design spec §3 (precedence), §5 (rendering), §6 (callers)
  - Interaction spec §22 (snapping is automatic and visible)
status: Ready
---

# Alignment guides while dragging

The smart alignment guides increment: dragging a room, a room corner, an element or a drawing
cursor snaps it to existing geometry and draws a dashed guide with a dot at what it matched.
`docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md` is the design and
`docs/superpowers/plans/2026-09-13-smart-alignment-guides.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
floor with at least two rooms not touching each other. **Create sample renovation project**
seeds one. Snap is ON in the view menu (the magnet in the status bar reads on).

## Why a human is the only instrument for four of these

Every snap decision below is driven in `tests/presentation/editor/snapping/snapServiceGuides.test.ts`
and every gesture in `selectToolAlignmentGuides.test.ts`, `elementMoveAdmission.test.ts`,
`roomSnapping.test.ts` and `drawPolygonToolGuides.test.ts`. Outside all of it:

1. **Whether the guide is legible against the plan.** `SnapGuides.vue` draws a 1 px dashed
   accent line; jsdom draws nothing and the fixed harness shots cannot hold a pointer mid-drag.
2. **Whether 8 screen pixels is the right pull.** Too wide and a room cannot be placed just
   beside another; too narrow and the guide never appears. A number picked, not measured.
3. **Whether the drop lands where the guide said.** The suite proves preview equals commit;
   only a vault shows the written room after the read-back.
4. **Whether the Snap toggle silences it all.** The service reads the preference through a
   getter; a live toggle mid-session is the host's own reactivity.

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Select a room. Drag it slowly until its left edge is within a few pixels of another room's left edge. | The room jumps so the edges share an x; a vertical dashed line joins them with a dot at the neighbour. |
| 2 | Keep dragging past. | The guide disappears and the room follows the pointer again. |
| 3 | Drag until the room's centre lines up with the neighbour's centre. | A guide through both centres. |
| 4 | Drag a corner of the room onto a corner of the neighbour. | The corner lands exactly on it; one short guide from the pointer to the corner, no axis line. |
| 5 | Release. Undo. Redo. | The room is where the guide said; undo and redo restore each position. |
| 6 | Add → Room, drag a rectangle whose right edge nears a neighbour's edge. | Guide and snap as in step 1; the banner reads "Snapped to nearby geometry." |
| 7 | Turn Snap off in the view menu, repeat step 1. | No guide, no jump. |
| 8 | Turn Snap on, press Escape mid-drag. | The room returns, no guide remains on the canvas. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.

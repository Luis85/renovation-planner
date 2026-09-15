# ADR-0032: A wall has two depths from a fixed directed reference

Status: Proposed in the independent wall-face PR, stacked above #212.

## Decision

A wall retains its existing directed `start → end` line or arc. Side A follows the left normal `(tangent.y, -tangent.x)` in the editor's downward-positive y coordinates; B follows the opposite normal. `sideExtents: { a, b }` stores both nonnegative distances in world millimetres. `thickness` remains the derived A+B compatibility and quantity value. Validation rejects an inconsistent total. The existing total bounds, 1–1,000,000 mm, remain in force.

Changing one depth does not move the other face, endpoints, reference direction, hosted opening offsets, room associations or captions. Reversing direction requires swapping A/B and negating the arc bulge to retain the same physical footprint. A total-width bulk edit adds half its delta to each face, preserving their difference; a negative resulting depth is refused.

Geometry sidecar schema 13 requires explicit face values on the wire. The pure 12→13 migration fills actual and intended legacy walls with A=B=old thickness/2. Read migration is in memory only. All writers fill missing legacy-shaped values before validation. A file with any unequal face pair requires schema 13, which older migration runners refuse. A document containing only equal pairs can retain its previous minimum schema because those pairs are losslessly derivable from its total.

## Rendering and interaction

An affected connected wall network uses real offset body polygons. Exterior gaps receive face-specific mitres with a bevel limit; straight T stems are clipped to their host's far face. One nonzero fill unions body and join pieces, preventing interior seams. Unaffected symmetric networks retain the prior rendering path, so backfill alone does not alter their appearance. Arc sampling follows the offset face radius. Opening masks, frames, hit regions, selection framing, room-face queries and asset snapping use the real faces.

An inside arc face reaching its centre is invalid for the independent geometry. Curved T cases requiring clipping, including tangent joins, are explicitly refused. The read/command boundaries validate these constraints rather than silently substituting a centred stroke.

Plan provides a compact exact-entry form and an adjustment overlay with separate 10 mm controls beside each face. Hover and focus show the face and reference direction. Clamped controls retain a tether; the camera stays unchanged. The full Details form exposes the same values. One Apply owns one history transaction. Closing or retiring the editing session invalidates initial write admission around its asynchronous version read, while an admitted history entry remains undoable and redoable.

## Evidence

See the [design contract](../../user-experience/editor-usability-increment/parallel-delivery/evidence/astra-wall-sides/design.md), [visual review](../../user-experience/editor-usability-increment/parallel-delivery/evidence/astra-wall-sides/visual-review.md) and [bilingual help](../../user-experience/editor-usability-increment/wall-thickness-help.md). The delivery receipt records the final local gate and CI separately from preliminary checks.

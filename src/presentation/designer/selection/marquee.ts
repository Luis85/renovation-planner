import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { curvedContains } from '../../../core/geometry/curveContains';
import { detailIsClosed, detailPolyline, type AssetDetail } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { DesignerSelection } from './designerSelection';

/**
 * The asset designer's marquee: which parts a rectangle dragged across the canvas selects
 * (contract C05, AD08's remainder).
 *
 * Pure and knows nothing about pointers — `DesignerSelectTool` owns the gesture and this owns
 * the RULE, so the rule can be driven by a case that names two corners and a shape rather than
 * a pointer stream. Nothing here reads or writes the store, the vault or `RenderState`: a
 * marquee is a preview, and even its result is a SELECTION, which is not a document edit.
 */

/**
 * The rectangle two corners describe, normalised.
 *
 * **This is the whole of C05's "never an accidental dependency on drag direction".** Left to
 * right and right to left produce the identical box here, so no rule downstream can tell which
 * way the pointer travelled, and the alternative — a Windows-style "enclose when dragging right,
 * intersect when dragging left" — is not reachable by accident from anywhere below this line.
 */
export function marqueeBox(a: Point, b: Point): BoundingBox {
	return {
		min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
		max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
	};
}

/**
 * Does the segment `a`–`b` meet the box? The slab test, which also answers point-in-box when the
 * two ends coincide (both deltas zero, so each axis is asked whether the point lies in its slab)
 * — which is why no separate vertex test is written: every vertex is an end of a segment.
 */
function segmentMeetsBox(a: Point, b: Point, box: BoundingBox): boolean {
	let near = 0;
	let far = 1;
	for (const axis of ['x', 'y'] as const) {
		const delta = b[axis] - a[axis];
		if (delta === 0) {
			if (a[axis] < box.min[axis] || a[axis] > box.max[axis]) return false;
			continue;
		}
		const first = (box.min[axis] - a[axis]) / delta;
		const last = (box.max[axis] - a[axis]) / delta;
		near = Math.max(near, Math.min(first, last));
		far = Math.min(far, Math.max(first, last));
		if (near > far) return false;
	}
	return true;
}

/** Every edge of a run, the closing one included when it is a ring. */
function anyEdgeMeetsBox(points: readonly Point[], box: BoundingBox, closed: boolean): boolean {
	return points.some((point, index) => {
		const last = index + 1 === points.length;
		return (closed || !last) && segmentMeetsBox(point, points[(index + 1) % points.length], box);
	});
}

/**
 * Is this graphic in the marquee? INTERSECTION, which C05 names as the starting rule: the box
 * touching the graphic is enough, and neither has to contain the other.
 *
 * The two kinds are asked the same question of different geometry, exactly as `hitTest.ts` asks
 * a PRESS: a closed graphic is its AREA, so a box lying wholly inside a big ring is in it (the
 * last clause), and an open one is its STROKE, which has no interior to be inside of. Asking a
 * path for containment would select a line whenever the box sat in the region its ends imply.
 *
 * `tolerance` is the chord tolerance arcs are flattened at, in world millimetres; the tool
 * passes one screen pixel's worth, so the approximation is finer than anything the user can see
 * at any zoom. What it cannot see is a marquee drawn entirely inside the sliver between an arc
 * and its chord — narrower than a pixel, and the same approximation `hitsGraphic` makes of an
 * open graphic's stroke.
 */
function graphicMeetsBox(detail: AssetDetail, box: BoundingBox, tolerance: number): boolean {
	if (!detailIsClosed(detail)) return anyEdgeMeetsBox(detailPolyline(detail, tolerance), box, false);
	return anyEdgeMeetsBox(detailPolyline(detail, tolerance), box, true) || curvedContains(detail.outline, box.min);
}

/**
 * The parts a marquee over `box` selects, in the shape's own array order.
 *
 * **GRAPHICS only.** The footprint, the clearance, the anchor and the facing are special
 * selections C05 keeps out of bulk composition, and they are excluded HERE as well as by
 * `assetDesignStore.extend` — not merely because the store would refuse them, but because the
 * footprint encloses every graphic there is and the clearance encloses the footprint, so
 * admitting them would make every marquee ever drawn select the same two parts.
 *
 * **A HIDDEN graphic is never a member.** It is not on screen, so a rectangle swept over empty
 * canvas must not pick up something the user cannot see — the rule `hitTest.ts` already applies
 * to a press, which falls through a hidden graphic to whatever is drawn beneath it.
 *
 * **A LOCKED graphic IS a member**, and deliberately: AD09's lock stops a graphic being DRAGGED,
 * never chosen — a press selects one so the user can read its fields and unlock it. A marquee
 * starts no drag at all (it only composes a selection), so there is nothing here for a lock to
 * protect, and skipping locked graphics would make a set built by sweeping differ from the same
 * set built by shift-pressing each part.
 */
export function marqueeMembers(
	shape: AssetShape,
	box: BoundingBox,
	options: { readonly tolerance: number; readonly hidden?: ReadonlySet<string> },
): DesignerSelection[] {
	const hidden = options.hidden ?? new Set<string>();
	return shape.details
		.filter((detail) => !hidden.has(detail.id) && graphicMeetsBox(detail, box, options.tolerance))
		.map((detail): DesignerSelection => ({ kind: 'detail', id: detail.id }));
}

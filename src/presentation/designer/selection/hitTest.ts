import type { Point } from '../../../core/geometry/Point';
import { curvedContains } from '../../../core/geometry/curveContains';
import { distance } from '../../../core/geometry/operations';
import { detailIsClosed, detailPolyline, type AssetDetail } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { VERTEX_GRAB_RADIUS_PX } from '../../editor/handleMetrics';
import { facingTip } from '../layers/anchorLayer';
import type { DesignerSelection, SelectionMode } from './designerSelection';
import { selectionHandles, type HandleRole, type SelectionHandle } from './handles';

export type DesignerHit =
	| { readonly kind: 'handle'; readonly role: HandleRole }
	| { readonly kind: 'part'; readonly selection: DesignerSelection }
	| null;

const part = (selection: DesignerSelection): DesignerHit => ({ kind: 'part', selection });

/** The nearest handle within `radius`, or null. */
function nearestHandle(handles: readonly SelectionHandle[], point: Point, radius: number): SelectionHandle | null {
	let best: SelectionHandle | null = null;
	let bestDistance = radius;
	for (const handle of handles) {
		const gap = distance(handle.at, point);
		if (gap <= bestDistance) {
			best = handle;
			bestDistance = gap;
		}
	}
	return best;
}

/**
 * What a press at `point` lands on, in the spec's deterministic order (Decision 10, PBI extension
 * 1b): the selection's own handles; the anchor, then the facing tip; details, topmost first; the
 * footprint; the clearance band; nothing. Each step is asked only when every earlier one declined,
 * which is what makes a handle drawn over a detail the handle, a detail over the footprint the
 * detail, and the clearance a BAND — by the time it is asked the point is already outside the
 * footprint.
 *
 * The grab radius is `VERTEX_GRAB_RADIUS_PX` screen pixels at every zoom, the plan editor's own.
 */
/**
 * Is this graphic under the pointer?
 *
 * A CLOSED one is hit by its INTERIOR, which is what makes a detail lying over the footprint take
 * the press. An OPEN one has no interior at all, so it is hit within the grab radius of its
 * STROKE — the same radius a vertex uses, so a line is no harder to catch than a corner. Asking
 * `curvedContains` of a path would answer about a ring the object has not got: nothing would ever
 * be selected where the user clicked, and the occasional false hit would land inside an implied
 * area that is not drawn.
 */
function hitsGraphic(detail: AssetDetail, point: Point, radius: number): boolean {
	if (detailIsClosed(detail)) return curvedContains(detail.outline, point);
	const run = detailPolyline(detail, radius / 2);
	return run.some((vertex, index) => index > 0 && distanceToSegment(run[index - 1], vertex, point) <= radius);
}

/** Shortest distance from `point` to the segment `start`–`end`; the open graphic's whole hit rule. */
function distanceToSegment(start: Point, end: Point, point: Point): number {
	const dx = end.x - start.x, dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return distance(start, point);
	const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
	return distance({ x: start.x + t * dx, y: start.y + t * dy }, point);
}

export function hitDesign(
	shape: AssetShape,
	point: Point,
	state: { readonly selection: DesignerSelection | null; readonly mode: SelectionMode; readonly worldPerPixel: number },
): DesignerHit {
	const radius = VERTEX_GRAB_RADIUS_PX * state.worldPerPixel;
	const handle = nearestHandle(selectionHandles(shape, state.selection, state.mode, state.worldPerPixel), point, radius);
	if (handle !== null) return { kind: 'handle', role: handle.role };
	if (distance(shape.anchor, point) <= radius) return part({ kind: 'anchor' });
	if (distance(facingTip(shape, state.worldPerPixel), point) <= radius) return part({ kind: 'facing' });
	const detail = shape.details.findLast((candidate) => hitsGraphic(candidate, point, radius));
	if (detail !== undefined) return part({ kind: 'detail', id: detail.id });
	if (curvedContains(shape.footprint, point)) return part({ kind: 'footprint' });
	if (shape.clearance !== null && curvedContains(shape.clearance, point)) return part({ kind: 'clearance' });
	return null;
}

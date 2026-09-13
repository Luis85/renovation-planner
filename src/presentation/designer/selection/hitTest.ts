import type { Point } from '../../../core/geometry/Point';
import { curvedContains } from '../../../core/geometry/curveContains';
import { distance } from '../../../core/geometry/operations';
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
	const detail = shape.details.findLast((candidate) => curvedContains(candidate.outline, point));
	if (detail !== undefined) return part({ kind: 'detail', id: detail.id });
	if (curvedContains(shape.footprint, point)) return part({ kind: 'footprint' });
	if (shape.clearance !== null && curvedContains(shape.clearance, point)) return part({ kind: 'clearance' });
	return null;
}
